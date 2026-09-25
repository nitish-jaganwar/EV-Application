import type { Vehicle } from '@/context/VehicleContext';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOOKING_CONFIG } from './bookingConfig';
import { bookingRepository } from './bookingRepository';
import { cancelBookingReminders, scheduleBookingReminders } from './bookingReminders';
import {
  alternatives, atLocalTime, dateKey, dateOptions, formatDuration, formatTime,
  isCompatible, isSlotAvailable, nextWalkInStart, overlaps, timeOptions,
} from './bookingRules';
import { bookingStyles as styles } from './bookingStyles';
import BookingCalendarPicker from './BookingCalendarPicker';
import BookingTimePicker from './BookingTimePicker';
import type { Booking, BookingCharger, BookingRequest } from './bookingTypes';

type Mode = 'NOW' | 'LATER';
type PendingAction = { kind: 'RESERVE'; request: BookingRequest } | { kind: 'CANCEL'; booking: Booking };
type SelectedOffer = { contextKey: string; chargerId: string; startsAt: string };

interface Props {
  vehicle: Vehicle | null;
  ownerId: string | null;
  onSelectVehicle: () => void;
}

function minutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function addMinutes(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * 60_000);
}

function dayLabel(day: string): string {
  return atLocalTime(day, 12 * 60).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
}

export default function BookingSchedule({ vehicle, ownerId, onSelectVehicle }: Props) {
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => new Date());
  const [mode, setMode] = useState<Mode>('LATER');
  const [selectedDay, setSelectedDay] = useState(() => dateKey(new Date()));
  const [selectedMinute, setSelectedMinute] = useState(10 * 60);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadedDay, setLoadedDay] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const days = dateOptions(now);
  const activeDay = mode === 'NOW' ? dateKey(now) : selectedDay;
  const choices = timeOptions(activeDay, durationMinutes, now);
  const preferredStart = mode === 'NOW' ? nextWalkInStart(now)
    : choices.find((choice) => minutes(choice) === selectedMinute) ?? choices[0] ?? null;
  const start = preferredStart && addMinutes(preferredStart, durationMinutes).getTime()
    <= atLocalTime(activeDay, BOOKING_CONFIG.closesAtHour * 60).getTime()
    ? preferredStart : null;
  const contextKey = `${activeDay}|${mode}|${durationMinutes}|${start?.toISOString() ?? 'none'}`;
  const currentOffer = selectedOffer?.contextKey === contextKey ? selectedOffer : null;
  const isChecking = loading || loadedDay !== activeDay;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessage('');
    bookingRepository.list(activeDay).then((result) => {
      if (active) {
        setBookings(result);
        setLoadedDay(activeDay);
      }
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : 'Could not load bookings.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [activeDay]);

  useEffect(() => {
    const timer = setInterval(() => {
      void bookingRepository.list(activeDay).then(setBookings).catch(() => undefined);
    }, 30_000);
    return () => clearInterval(timer);
  }, [activeDay]);

  const compatibleChargers = BOOKING_CONFIG.chargers.filter((charger) =>
    vehicle && isCompatible(vehicle.connectorType, charger.connectorType));
  const myBookings = isChecking ? [] : bookings.filter((booking) => booking.ownerId === ownerId && booking.status === 'CONFIRMED');

  function ownerHasConflict(candidateStart: Date, candidateEnd: Date): boolean {
    return myBookings.some((booking) => overlaps(
      candidateStart.toISOString(), candidateEnd.toISOString(), booking.startsAt, booking.endsAt,
    ));
  }

  function choose(charger: BookingCharger, candidateStart: Date) {
    setSelectedOffer({ contextKey, chargerId: charger.id, startsAt: candidateStart.toISOString() });
    setMessage('');
  }

  const bestSlot = !isChecking && start ? compatibleChargers.flatMap((charger) =>
    choices.filter((candidate) => candidate.getTime() >= start.getTime()).map((candidate) => ({ charger, candidate })))
    .filter(({ charger, candidate }) => {
      const end = addMinutes(candidate, durationMinutes);
      return isSlotAvailable(charger.id, candidate.toISOString(), end.toISOString(), bookings)
        && !ownerHasConflict(candidate, end);
    })
    .sort((a, b) => a.candidate.getTime() - b.candidate.getTime())[0] : undefined;

  const selectedCharger = compatibleChargers.find((charger) => charger.id === currentOffer?.chargerId);
  const selectedStart = currentOffer ? new Date(currentOffer.startsAt) : null;
  const selectedEnd = selectedStart ? addMinutes(selectedStart, durationMinutes) : null;
  const canContinue = Boolean(ownerId && vehicle && selectedCharger && selectedStart && selectedEnd && !isChecking
    && selectedStart.getTime() > now.getTime()
    && dateKey(selectedStart) === activeDay
    && isSlotAvailable(selectedCharger!.id, selectedStart.toISOString(), selectedEnd.toISOString(), bookings)
    && !ownerHasConflict(selectedStart, selectedEnd));

  function reviewBooking() {
    if (!canContinue || !ownerId || !vehicle || !selectedCharger || !selectedStart || !selectedEnd) return;
    setPendingAction({ kind: 'RESERVE', request: {
      apartmentId: BOOKING_CONFIG.apartmentId,
      chargerId: selectedCharger.id,
      vehicleId: vehicle.id,
      vehicleConnectorType: vehicle.connectorType,
      ownerId,
      startsAt: selectedStart.toISOString(),
      endsAt: selectedEnd.toISOString(),
    } });
  }

  async function confirmAction() {
    if (!pendingAction || working) return;
    setWorking(true);
    try {
      if (pendingAction.kind === 'RESERVE') {
        const saved = await bookingRepository.reserve(pendingAction.request);
        const reminders = await scheduleBookingReminders(saved).catch(() => false);
        setMessage(reminders ? 'Slot confirmed. Phone reminders set for 10 and 5 minutes before.' : 'Demo slot confirmed on this device.');
        setSelectedOffer(null);
      } else if (ownerId) {
        await bookingRepository.cancel(pendingAction.booking.id, ownerId);
        await cancelBookingReminders(pendingAction.booking.id).catch(() => undefined);
        setMessage('Booking cancelled. This slot is available again.');
      }
      setBookings(await bookingRepository.list(activeDay));
      setPendingAction(null);
    } catch (error) {
      setPendingAction(null);
      setMessage(error instanceof Error ? error.message : 'Could not save booking.');
      try { setBookings(await bookingRepository.list(activeDay)); } catch { /* Keep the last visible list. */ }
    } finally {
      setWorking(false);
    }
  }

  const durationIndex = BOOKING_CONFIG.durationOptionsMinutes.findIndex((value) => value === durationMinutes);
  const hours = Math.floor(durationMinutes / 60);
  const remainder = durationMinutes % 60;

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 10) + 54 }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>{BOOKING_CONFIG.apartmentName} · Resident charging</Text>
          <Text style={styles.heroTitle}>Book a charging slot</Text>
          <Pressable onPress={onSelectVehicle} style={styles.heroVehicle} accessibilityRole="button" accessibilityLabel="Select vehicle for booking">
            <Text style={styles.heroSub}>{vehicle ? `${vehicle.icon}  ${vehicle.name} · ${vehicle.connectorType}  ▾` : 'Choose vehicle  ▾'}</Text>
          </Pressable>
        </View>

        <View style={styles.sheet}>
          <View style={styles.modeTrack}>
            {(['NOW', 'LATER'] as const).map((option) => (
              <Pressable key={option} style={[styles.modeButton, mode === option && styles.modeActive]}
                onPress={() => { setMode(option); setSelectedOffer(null); }} accessibilityRole="button">
                <Text style={[styles.modeText, mode === option && styles.modeTextActive]}>
                  {option === 'NOW' ? '⚡  Walk-in' : '◷  Book later'}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === 'LATER' && <>
            <Text style={styles.sectionLabel}>Select date</Text>
            <Pressable style={styles.dateField} onPress={() => setCalendarVisible(true)} accessibilityRole="button" accessibilityLabel="Select booking date">
              <Text style={styles.dateFieldText}>{dayLabel(selectedDay)}</Text>
              <Text style={styles.dateFieldIcon}>▦</Text>
            </Pressable>
          </>}

          <Text style={styles.sectionLabel}>{mode === 'NOW' ? 'Earliest walk-in window' : 'Select time'}</Text>
          <View style={styles.timeRow}>
            <Pressable style={[styles.timeCard, mode === 'LATER' && styles.timeCardActive]}
              onPress={() => { if (mode === 'LATER') setTimePickerVisible(true); }} accessibilityRole="button">
              <Text style={styles.timeCardLabel}>START TIME {mode === 'LATER' ? '⌄' : ''}</Text>
              <Text style={styles.timeCardValue}>{start ? formatTime(start.toISOString()) : '—'}</Text>
            </Pressable>
            <View style={styles.timeCard}>
              <Text style={styles.timeCardLabel}>END TIME</Text>
              <Text style={styles.timeCardValue}>{start ? formatTime(addMinutes(start, durationMinutes).toISOString()) : '—'}</Text>
            </View>
          </View>
          <Text style={styles.timeHelp}>{mode === 'NOW' ? 'Walk-in begins at the next 15-minute start.' : dayLabel(activeDay)}</Text>

          <Text style={styles.sectionLabel}>Charging time</Text>
          <View style={styles.durationBox}>
            <Pressable style={[styles.durationControl, durationIndex === 0 && styles.durationControlDisabled]}
              onPress={() => setDurationMinutes(BOOKING_CONFIG.durationOptionsMinutes[Math.max(0, durationIndex - 1)])}
              disabled={durationIndex === 0} accessibilityLabel="Decrease charging time" accessibilityRole="button">
              <Text style={styles.durationControlText}>−</Text>
            </Pressable>
            <View style={styles.durationValue}>
              <Text style={styles.durationMain}>{hours ? `${hours} hr` : ''} {remainder ? `${remainder} min` : ''}</Text>
              <Text style={styles.durationSub}>Max {formatDuration(BOOKING_CONFIG.durationOptionsMinutes.at(-1) ?? 240)}</Text>
            </View>
            <Pressable style={[styles.durationControl, durationIndex === BOOKING_CONFIG.durationOptionsMinutes.length - 1 && styles.durationControlDisabled]}
              onPress={() => setDurationMinutes(BOOKING_CONFIG.durationOptionsMinutes[Math.min(BOOKING_CONFIG.durationOptionsMinutes.length - 1, durationIndex + 1)])}
              disabled={durationIndex === BOOKING_CONFIG.durationOptionsMinutes.length - 1} accessibilityLabel="Increase charging time" accessibilityRole="button">
              <Text style={styles.durationControlText}>+</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>Choose a charger</Text>
          <Text style={styles.selectionHint}>Slots for {start ? `${formatTime(start.toISOString())} – ${formatTime(addMinutes(start, durationMinutes).toISOString())}` : 'the selected time'}</Text>
          {bestSlot && <Pressable style={styles.bestSlot} onPress={() => choose(bestSlot.charger, bestSlot.candidate)} accessibilityRole="button">
            <Text style={styles.bestSlotText}>Suggested: {formatTime(bestSlot.candidate.toISOString())} · Charger {bestSlot.charger.id}</Text>
            <Text style={styles.bestSlotAction}>Select</Text>
          </Pressable>}
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {!vehicle && <Text style={styles.empty}>Select a vehicle in the top bar to see compatible chargers.</Text>}
          {isChecking && <Text style={styles.empty}>Checking demo slots…</Text>}
          {!isChecking && vehicle && !start && <Text style={styles.empty}>No more slots within booking hours. Choose another day or shorter duration.</Text>}
          {!isChecking && start && compatibleChargers.map((charger) => {
            const end = addMinutes(start, durationMinutes);
            const free = isSlotAvailable(charger.id, start.toISOString(), end.toISOString(), bookings)
              && !ownerHasConflict(start, end);
            const selected = currentOffer?.chargerId === charger.id;
            const suggestedTimes = !free && !ownerHasConflict(start, end)
              ? alternatives(charger, start, durationMinutes, bookings, now)
                .filter((suggested) => !ownerHasConflict(suggested, addMinutes(suggested, durationMinutes))) : [];
            return (
              <View key={charger.id} style={[styles.chargerCard, selected && styles.chargerCardSelected]}>
                <Pressable style={styles.chargerRow} onPress={() => { if (free) choose(charger, start); }} accessibilityRole="button">
                  <View style={[styles.radio, selected && styles.radioActive]}>{selected && <View style={styles.radioDot} />}</View>
                  <View style={styles.chargerMain}>
                    <Text style={styles.chargerName}>Charger {charger.id}</Text>
                    <Text style={styles.chargerDetail}>{charger.connectorType} · Rated {charger.ratedPowerKw} kW</Text>
                  </View>
                  <Text style={[styles.status, free ? styles.free : styles.busy]}>
                    {free ? 'Free slot' : ownerHasConflict(start, end) ? 'Your slot overlaps' : selected ? 'Alt selected' : 'Booked'}
                  </Text>
                </Pressable>
                {!free && <View style={styles.suggestionArea}>
                  <Text style={styles.suggestionLabel}>{ownerHasConflict(start, end) ? 'You already have a booking at this time.' : 'Try a later time on this charger'}</Text>
                  <View style={styles.suggestionRow}>
                    {suggestedTimes.map((suggested) => {
                      const active = selected && currentOffer?.startsAt === suggested.toISOString();
                      return (
                        <Pressable key={suggested.toISOString()} style={[styles.suggestionChip, active && styles.suggestionChipActive]}
                          onPress={() => choose(charger, suggested)} accessibilityRole="button">
                          <Text style={[styles.suggestionText, active && styles.suggestionTextActive]}>{formatTime(suggested.toISOString())}</Text>
                        </Pressable>
                      );
                    })}
                    {!ownerHasConflict(start, end) && suggestedTimes.length === 0 && <Text style={styles.empty}>No later slot today.</Text>}
                  </View>
                </View>}
              </View>
            );
          })}

          {myBookings.length > 0 && <>
            <Text style={styles.sectionLabel}>Your bookings · {dayLabel(activeDay)}</Text>
            {myBookings.map((booking) => (
              <View key={booking.id} style={styles.bookingItem}>
                <Text style={styles.bookingItemTitle}>Charger {booking.chargerId}</Text>
                <Text style={styles.bookingItemTime}>{formatTime(booking.startsAt)} – {formatTime(booking.endsAt)}</Text>
                <Pressable onPress={() => setPendingAction({ kind: 'CANCEL', booking })} accessibilityRole="button">
                  <Text style={styles.cancel}>Cancel booking</Text>
                </Pressable>
              </View>
            ))}
          </>}
          <Text style={styles.demoFootnote}>Prototype only · Availability and bookings are sample data saved on this device. A slot does not control a physical charger or guarantee kWh.</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={[styles.primaryButton, !canContinue && styles.primaryDisabled]}
          onPress={reviewBooking} disabled={!canContinue} accessibilityRole="button">
          <Text style={styles.primaryText}>Proceed</Text>
        </Pressable>
        <Text style={styles.footerNote}>{!ownerId
          ? 'Sign in to confirm a booking'
          : currentOffer && canContinue
            ? `Charger ${currentOffer.chargerId} · ${formatTime(currentOffer.startsAt)} · ${formatDuration(durationMinutes)}`
            : 'Select an available charger to continue'}</Text>
      </View>

      <BookingTimePicker visible={timePickerVisible} dateLabel={dayLabel(activeDay)} choices={choices}
        selectedTime={start ? minutes(start) : undefined}
        onSelect={(minute) => { setSelectedMinute(minute); setSelectedOffer(null); }}
        onClose={() => setTimePickerVisible(false)} />

      <BookingCalendarPicker visible={calendarVisible} allowedDays={days} selectedDay={selectedDay}
        onSelect={(day) => { setSelectedDay(day); setSelectedOffer(null); }} onClose={() => setCalendarVisible(false)} />

      <Modal visible={pendingAction !== null} transparent animationType="fade" onRequestClose={() => setPendingAction(null)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{pendingAction?.kind === 'CANCEL' ? 'Cancel booking?' : 'Confirm this slot?'}</Text>
            <Text style={styles.dialogDetail}>
              {pendingAction?.kind === 'RESERVE'
                ? `Charger ${pendingAction.request.chargerId} · ${formatTime(pendingAction.request.startsAt)} – ${formatTime(pendingAction.request.endsAt)} · ${vehicle?.name ?? ''}`
                : pendingAction?.kind === 'CANCEL'
                  ? `Charger ${pendingAction.booking.chargerId} · ${formatTime(pendingAction.booking.startsAt)}` : ''}
            </Text>
            <Text style={styles.dialogNote}>This demo saves the booking on this device only.</Text>
            <View style={styles.dialogActions}>
              <Pressable style={styles.dialogBack} onPress={() => setPendingAction(null)} disabled={working} accessibilityRole="button">
                <Text style={styles.dialogBackText}>Back</Text>
              </Pressable>
              <Pressable style={styles.dialogConfirm} onPress={() => void confirmAction()} disabled={working} accessibilityRole="button">
                <Text style={styles.primaryText}>{working ? 'Saving…' : 'Confirm'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
