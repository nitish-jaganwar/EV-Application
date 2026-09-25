import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { atLocalTime, dateKey } from './bookingRules';

interface Props {
  visible: boolean;
  allowedDays: string[];
  selectedDay: string;
  onSelect: (day: string) => void;
  onClose: () => void;
}

export default function BookingCalendarPicker({ visible, allowedDays, selectedDay, onSelect, onClose }: Props) {
  const [draftDay, setDraftDay] = useState(selectedDay);
  const [month, setMonth] = useState(() => atLocalTime(selectedDay, 12 * 60));

  useEffect(() => {
    if (!visible) return;
    setDraftDay(selectedDay);
    setMonth(atLocalTime(selectedDay, 12 * 60));
  }, [visible, selectedDay]);

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const cells = Array.from({ length: Math.ceil((first.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7 }, (_, index) => {
    const day = new Date(month.getFullYear(), month.getMonth(), index - first.getDay() + 1);
    return { key: dateKey(day), date: day.getDate(), inMonth: day.getMonth() === month.getMonth() };
  });
  const allowed = new Set(allowedDays);
  const monthAllowed = (offset: number) => allowedDays.some((day) => {
    const date = atLocalTime(day, 12 * 60);
    return date.getFullYear() === new Date(month.getFullYear(), month.getMonth() + offset, 1).getFullYear()
      && date.getMonth() === new Date(month.getFullYear(), month.getMonth() + offset, 1).getMonth();
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Select date</Text>
          <View style={styles.monthRow}>
            <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              disabled={!monthAllowed(-1)} accessibilityRole="button" accessibilityLabel="Previous month">
              <Text style={[styles.arrow, !monthAllowed(-1) && styles.disabled]}>‹</Text>
            </Pressable>
            <Text style={styles.month}>{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
            <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              disabled={!monthAllowed(1)} accessibilityRole="button" accessibilityLabel="Next month">
              <Text style={[styles.arrow, !monthAllowed(1) && styles.disabled]}>›</Text>
            </Pressable>
          </View>
          <View style={styles.grid}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) =>
              <Text key={`${label}${index}`} style={styles.weekday}>{label}</Text>)}
            {cells.map((cell) => {
              const enabled = cell.inMonth && allowed.has(cell.key);
              const active = draftDay === cell.key;
              return <Pressable key={cell.key} style={[styles.day, active && styles.dayActive]}
                onPress={() => setDraftDay(cell.key)} disabled={!enabled} accessibilityRole="button"
                accessibilityLabel={`${cell.key}${enabled ? '' : ', unavailable'}`}>
                <Text style={[styles.dayText, !enabled && styles.disabled, active && styles.dayTextActive]}>{cell.inMonth ? cell.date : ''}</Text>
              </Pressable>;
            })}
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onClose} accessibilityRole="button"><Text style={styles.cancelText}>Cancel</Text></Pressable>
            <Pressable style={styles.apply} onPress={() => { onSelect(draftDay); onClose(); }} accessibilityRole="button">
              <Text style={styles.applyText}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18, 28, 47, 0.35)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 18 },
  title: { fontSize: 18, fontWeight: '600', color: '#17233C' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 22, paddingHorizontal: 8 },
  arrow: { fontSize: 28, color: '#17233C', paddingHorizontal: 12 },
  month: { fontSize: 16, fontWeight: '500', color: '#17233C' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.285%', textAlign: 'center', color: '#8A94A4', fontSize: 12, marginBottom: 10 },
  day: { width: '14.285%', height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  dayActive: { backgroundColor: '#E8F0FF' },
  dayText: { color: '#24314A', fontSize: 14 },
  dayTextActive: { color: '#2459C4', fontWeight: '600' },
  disabled: { color: '#C9CED7' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cancel: { flex: 1, alignItems: 'center', padding: 13, borderWidth: 1, borderColor: '#DDE3EC', borderRadius: 12 },
  cancelText: { color: '#39465B', fontWeight: '600' },
  apply: { flex: 1, alignItems: 'center', padding: 13, backgroundColor: '#2563EB', borderRadius: 12 },
  applyText: { color: '#FFFFFF', fontWeight: '600' },
});
