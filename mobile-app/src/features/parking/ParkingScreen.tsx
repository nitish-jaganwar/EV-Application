import type { Vehicle } from '@/context/VehicleContext';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parkingRepository } from './parkingRepository';
import { cancelParkingReminder, scheduleParkingReminder } from './parkingNotifications';
import { BAYS, PARKING_CONFIG, bayStatus, durationLabel, fits, isActive, isReady, recommend, timeLabel, validateEnergy,
  type Allocation, type Offer, type ParkingState } from './parkingRules';

type Props = { vehicle: Vehicle | null; ownerId: string | null; onSelectVehicle: () => void };
type Confirmation = { kind: 'RESERVE'; offer: Offer } | { kind: 'CANCEL' | 'VACATE' | 'ARRIVE'; allocation: Allocation };

export default function ParkingScreen({ vehicle, ownerId, onSelectVehicle }: Props) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ParkingState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [energyText, setEnergyText] = useState('');
  const [requested, setRequested] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [alternatives, setAlternatives] = useState(false);
  const [bayId, setBayId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  useEffect(() => {
    let mounted = true;
    const refresh = () => { void parkingRepository.load().then(data => { if (mounted) { setState(data); setNow(Date.now()); setError(''); } })
      .catch(() => { if (mounted) setError('Parking availability could not load. Please try again.'); }); };
    refresh(); const timer = setInterval(refresh, 15_000); const unsubscribe = parkingRepository.subscribe(refresh);
    return () => { mounted = false; clearInterval(timer); unsubscribe(); };
  }, []);
  useEffect(() => { setRequested(null); setEnergyText(''); setConfirmation(null); }, [vehicle?.id]);
  const mine = state?.allocations.find(a => a.ownerId === ownerId && isActive(a));
  const energy = mine?.energyKwh ?? requested;
  const offers = state && vehicle && energy && (!mine || mine.vehicleId === vehicle.id)
    ? recommend(state, vehicle, energy, now, mine?.id) : [];
  const selectedBay = BAYS.find(b => b.id === bayId);
  const occupied = state?.occupied.find(o => o.bayId === bayId);
  const ready = !!(mine && state && isReady(mine, state, now));
  const delayed = !!(mine && state && mine.status === 'RESERVED' &&
    ((now >= mine.startsAt && !ready) || state.occupied.some(o => o.bayId === mine.bayId && o.expectedVacantAt > mine.startsAt)));
  const disabled = busy || !!error;

  async function confirm() {
    if (!confirmation || !ownerId || busy) return;
    setBusy(true); setMessage('');
    try {
      if (confirmation.kind === 'RESERVE') {
        if (!vehicle || !energy) return;
        const previous = mine;
        const allocation = await parkingRepository.reserve(ownerId, vehicle, energy, confirmation.offer, mine?.id);
        if (previous) await cancelParkingReminder(previous).catch(() => undefined);
        const reminder = await scheduleParkingReminder(allocation).catch(() => false);
        setMessage(`Parking ${allocation.bayId} confirmed.${reminder ? ' Your 5-minute reminder is set.' : ' Updates appear in the app. Phone reminders require enabled device notifications and at least 5 minutes lead time.'}`);
        setRequested(null); setAlternatives(false);
      } else {
        await parkingRepository.update(confirmation.allocation.id, ownerId, confirmation.kind);
        await cancelParkingReminder(confirmation.allocation).catch(() => undefined);
        setMessage(confirmation.kind === 'VACATE' ? 'Thank you. Your bay is now available.' : confirmation.kind === 'ARRIVE' ? 'Bay marked occupied. Parking confirmation does not start the charger.' : 'Allocation cancelled. The reservation has been released.');
      }
      setConfirmation(null);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Please try again.'); setConfirmation(null); }
    finally { setState(await parkingRepository.load().catch(() => state)); setNow(Date.now()); setBusy(false); }
  }
  function findParking() {
    if (!vehicle) { onSelectVehicle(); return; }
    const value = Number(energyText.trim()); const validation = validateEnergy(value, vehicle);
    if (validation) { setMessage(validation); return; }
    setMessage(''); setRequested(value); setAlternatives(false);
  }
  const offerCard = (offer: Offer, index: number) => <View key={offer.bayId} style={s.offer}>
    <Text style={s.small}>{index === 0 ? 'Recommended for you' : 'Another available bay'}</Text>
    <Text style={s.cardTitle}>Parking {offer.bayId} · {offer.startsAt <= now + 60_000 ? 'Available now' : 'Available later'}</Text>
    <Text style={s.body}>{timeLabel(offer.startsAt)} → {timeLabel(offer.endsAt)}</Text>
    <Text style={s.small}>{energy} kWh · About {durationLabel(offer.startsAt, offer.endsAt)} · Estimated</Text>
    <Pressable accessibilityRole="button" disabled={disabled || !ownerId} style={[s.primary, disabled && s.disabled]}
      onPress={() => setConfirmation({ kind: 'RESERVE', offer })}><Text style={s.primaryText}>{mine ? `Switch to ${offer.bayId}` : `Confirm parking ${offer.bayId}`}</Text></Pressable>
  </View>;

  return <ScrollView contentContainerStyle={[s.content, { paddingBottom: 100 + insets.bottom }]} keyboardShouldPersistTaps="handled">
    <Text style={s.title}>Parking</Text><Text style={s.small}>{PARKING_CONFIG.name} · 15 charging bays · Demo</Text>
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {message ? <Text accessibilityRole="alert" style={s.notice}>{message}</Text> : null}
    {!ownerId ? <Text style={s.notice}>Sign in to confirm a parking allocation.</Text> : null}
    {!state && !error ? <Text style={s.body}>Loading parking availability…</Text> : null}
    {mine ? <View style={s.card}>
      <Text style={s.small}>Your allocation · {mine.vehicleName}</Text>
      <Text style={s.cardTitle}>{mine.bayId} · {mine.status === 'PARKED' ? 'Vehicle parked' : ready ? 'Your bay is ready' : delayed ? 'Bay delayed' : 'Reserved'}</Text>
      <Text style={s.body}>{mine.energyKwh} kWh · About {durationLabel(mine.startsAt, mine.endsAt)}</Text>
      <Text style={s.small}>{timeLabel(mine.startsAt)} → {timeLabel(mine.endsAt)} (estimated)</Text>
      {delayed ? <Text style={s.notice}>This bay is not vacant yet. Choose another suggestion below, or wait for a vacancy update.</Text> : null}
      {mine.status === 'PARKED' ? <><Text style={s.small}>When charging has stopped and your vehicle is removed, release the bay below.</Text>
        <Pressable accessibilityRole="button" style={s.primary} disabled={disabled} onPress={() => setConfirmation({ kind: 'VACATE', allocation: mine })}><Text style={s.primaryText}>Vehicle removed · Release bay</Text></Pressable></> : <>
        {ready ? <Pressable accessibilityRole="button" style={s.primary} disabled={disabled} onPress={() => setConfirmation({ kind: 'ARRIVE', allocation: mine })}><Text style={s.primaryText}>I have parked</Text></Pressable> : <Text style={s.small}>5-minute estimated reminder, then a vacancy confirmation.</Text>}
        <Pressable accessibilityRole="button" style={s.secondary} disabled={disabled} onPress={() => setConfirmation({ kind: 'CANCEL', allocation: mine })}><Text style={s.link}>Cancel allocation</Text></Pressable>
      </>}
    </View> : <View style={s.card}>
      <Pressable accessibilityRole="button" onPress={onSelectVehicle} style={s.vehicle}><Text style={s.body}>{vehicle?.name ?? 'Select your vehicle'}</Text><Text style={s.link}>Change</Text></Pressable>
      <Text style={s.label}>How much energy do you need?</Text>
      <View style={s.inputRow}><TextInput accessibilityLabel="Required energy in kWh" keyboardType="decimal-pad" placeholder="e.g. 2" value={energyText}
        onChangeText={text => { setEnergyText(text); setRequested(null); }} style={s.input} /><Text style={s.body}>kWh</Text></View>
      <Text style={s.small}>kWh is the amount of electricity to add.{vehicle ? ` Battery capacity: ${vehicle.batteryCapacityKwh} kWh.` : ''}</Text>
      <Pressable accessibilityRole="button" disabled={disabled || !state} style={[s.primary, (disabled || !state) && s.disabled]} onPress={findParking}><Text style={s.primaryText}>Find parking</Text></Pressable>
    </View>}
    {state && energy && (!mine || (delayed && mine.status === 'RESERVED')) ? <>
      {mine && vehicle?.id !== mine.vehicleId ? <Pressable accessibilityRole="button" style={s.secondary} onPress={onSelectVehicle}><Text style={s.link}>Select {mine.vehicleName} to see alternatives</Text></Pressable>
        : offers.length ? <>{offerCard(offers[0], 0)}
          {offers.length > 1 ? <Pressable accessibilityRole="button" style={s.secondary} onPress={() => setAlternatives(!alternatives)}><Text style={s.link}>{alternatives ? 'Hide other bays' : `Other available bays (${offers.length - 1})`}</Text></Pressable> : null}
          {alternatives ? offers.slice(1).map((offer, i) => offerCard(offer, i + 1)) : null}</>
          : <Text style={s.notice}>No compatible bay can complete this request within 24 hours. Try a smaller energy amount or check again later.</Text>}
      <Text style={s.small}>Times depend on vehicle speed, building power and the previous driver leaving. We confirm vacancy separately.</Text>
    </> : null}
    <View style={s.sectionRow}><Text style={s.cardTitle}>Parking layout</Text><Text style={s.small}>{state ? BAYS.filter(b => bayStatus(b, state, now) === 'Available').length : '—'} available now</Text></View>
    <Text style={s.small}>Tap a bay for its charger and availability.</Text>
    {state ? <View style={s.layout}>{[0, 1, 2, 3, 4].map(row => <View key={row}>
      {row === 0 || row === 3 ? <Text style={s.lane}>{row === 0 ? 'ENTRY →     DRIVE AISLE' : 'DRIVE AISLE →'}</Text> : null}
      <View style={s.bayRow}>{BAYS.slice(row * 3, row * 3 + 3).map(bay => {
        const status = bayStatus(bay, state, now); const available = status === 'Available';
        return <Pressable key={bay.id} accessibilityRole="button" accessibilityLabel={`${bay.id}, ${status}, ${bay.connector}`} onPress={() => setBayId(bay.id)}
          style={[s.bay, available ? s.free : status === 'Offline' ? s.offline : s.occupied]}>
          <Text style={s.bayName}>{bay.id}</Text><Text style={s.bayStatus}>{status}</Text>
        </Pressable>;
      })}</View></View>)}</View> : null}
    <Text style={s.small}>Illustrative layout. Vacancy is confirmed independently from charging completion.</Text>
    <Modal visible={!!selectedBay} transparent animationType="fade" onRequestClose={() => setBayId(null)}>
      <View style={s.overlay}><View style={s.dialog}>
        <Text style={s.cardTitle}>Parking {selectedBay?.id}</Text>
        <Text style={s.body}>Charger {selectedBay?.chargerId} · {selectedBay?.connector} · {selectedBay?.powerKw} kW</Text>
        <Text style={s.body}>{selectedBay && state ? bayStatus(selectedBay, state, now) : ''}{selectedBay && vehicle && !fits(vehicle, selectedBay) ? ' · Not compatible with your selected vehicle' : ''}</Text>
        {occupied ? <><Text style={s.small}>Expected vacant: {timeLabel(occupied.expectedVacantAt)}. This is an estimate.</Text>
          <Text style={s.label}>Demo occupancy controls</Text>
          {(['VACATE', 'DELAY'] as const).map(action => <Pressable key={action} accessibilityRole="button" disabled={busy} style={s.secondary} onPress={async () => {
            setBusy(true); try { await parkingRepository.demoBay(occupied.bayId, action); setBayId(null); }
            catch { setMessage('Could not update the demo bay.'); } finally { setBusy(false); }
          }}><Text style={s.link}>{action === 'VACATE' ? 'Mark demo vehicle removed' : 'Delay vacancy by 15 minutes'}</Text></Pressable>)}</> : null}
        <Pressable accessibilityRole="button" style={s.primary} onPress={() => setBayId(null)}><Text style={s.primaryText}>Close</Text></Pressable>
      </View></View>
    </Modal>
    <Modal visible={!!confirmation} transparent animationType="fade" onRequestClose={() => { if (!busy) setConfirmation(null); }}>
      <View style={s.overlay}><View style={s.dialog}>
        <Text style={s.cardTitle}>{confirmation?.kind === 'RESERVE' ? 'Confirm your parking' : confirmation?.kind === 'VACATE' ? 'Is your vehicle removed?' : confirmation?.kind === 'ARRIVE' ? 'Confirm you have parked' : 'Cancel this allocation?'}</Text>
        <Text style={s.body}>{confirmation?.kind === 'RESERVE' ? `${vehicle?.name} · ${energy} kWh\nParking ${confirmation.offer.bayId}\n${timeLabel(confirmation.offer.startsAt)}\nEstimated finish: ${timeLabel(confirmation.offer.endsAt)}`
          : confirmation?.kind === 'VACATE' ? 'Confirm only after charging has stopped and your vehicle is out of the bay. This makes the bay available to the next driver.' : confirmation?.kind === 'ARRIVE' ? 'This marks the bay occupied. Start charging separately using the charger controls.' : 'Your reserved bay will be released. No charging session will be stopped.'}</Text>
        <Pressable accessibilityRole="button" style={[s.primary, busy && s.disabled]} disabled={busy} onPress={() => void confirm()}><Text style={s.primaryText}>{busy ? 'Saving…' : 'Confirm'}</Text></Pressable>
        <Pressable accessibilityRole="button" style={s.secondary} disabled={busy} onPress={() => setConfirmation(null)}><Text style={s.link}>Go back</Text></Pressable>
      </View></View>
    </Modal>
  </ScrollView>;
}

const s = StyleSheet.create({
  content: { padding: 18, gap: 10 }, title: { fontSize: 24, fontWeight: '600', color: '#17233B' },
  card: { padding: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, gap: 10, marginTop: 6 },
  offer: { padding: 16, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#CBDDF8', borderRadius: 16, gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#17233B' }, body: { fontSize: 15, color: '#334155', lineHeight: 23 },
  small: { fontSize: 13, color: '#64748B', lineHeight: 20 }, label: { fontSize: 15, color: '#17233B', fontWeight: '500', marginTop: 8 },
  vehicle: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12 },
  input: { flex: 1, minHeight: 48, fontSize: 20, color: '#17233B' },
  primary: { backgroundColor: '#2563EB', minHeight: 48, padding: 12, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  primaryText: { fontSize: 15, fontWeight: '500', color: '#FFFFFF' }, secondary: { minHeight: 44, padding: 10, justifyContent: 'center', alignItems: 'center' },
  link: { fontSize: 14, fontWeight: '500', color: '#1D4ED8' }, disabled: { opacity: 0.5 },
  error: { color: '#B91C1C', fontSize: 14 }, notice: { backgroundColor: '#EFF6FF', padding: 12, borderRadius: 10, color: '#334155', fontSize: 14, lineHeight: 22 },
  sectionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  layout: { backgroundColor: '#F1F5F9', borderRadius: 14, padding: 10, gap: 8 }, bayRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  bay: { flex: 1, minHeight: 78, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 6, gap: 5 },
  free: { backgroundColor: '#ECFDF5', borderColor: '#A7D9C4' }, occupied: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  offline: { backgroundColor: '#E2E8F0', borderColor: '#CBD5E1' }, bayName: { fontSize: 16, fontWeight: '600', color: '#17233B' }, bayStatus: { fontSize: 12, color: '#334155' },
  lane: { color: '#64748B', fontSize: 11, textAlign: 'center', paddingVertical: 10, letterSpacing: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 430, borderRadius: 18, padding: 22, gap: 14, backgroundColor: '#FFFFFF' },
});
