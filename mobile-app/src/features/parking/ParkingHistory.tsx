import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { parkingRepository } from './parkingRepository';
import { durationLabel, timeLabel, type Allocation } from './parkingRules';

export default function ParkingHistory({ ownerId }: { ownerId: string | null }) {
  const [items, setItems] = useState<Allocation[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = () => void parkingRepository.load().then(state => {
      if (active) { setItems(state.allocations.filter(a => a.ownerId === ownerId).reverse()); setError(''); }
    }).catch(() => { if (active) setError('Parking history could not load.'); });
    refresh(); const unsubscribe = parkingRepository.subscribe(refresh);
    return () => { active = false; unsubscribe(); };
  }, [ownerId]);
  return <View style={{ gap: 12, marginVertical: 16 }}><Text style={{ fontSize: 17, fontWeight: '600', color: '#17233B' }}>Parking allocations</Text>
    {error || !items.length ? <Text style={{ color: '#64748B' }}>{error || 'No parking allocations yet.'}</Text> : null}
    {items.map(a => <View key={a.id} style={{ borderBottomWidth: 1, borderColor: '#E2E8F0', paddingBottom: 12, gap: 5 }}>
      <Text style={{ fontSize: 15, color: '#334155' }}>{a.bayId} · {a.vehicleName} · {a.status === 'COMPLETED' ? 'Bay released' : a.status === 'CANCELLED' ? 'Cancelled' : a.status === 'PARKED' ? 'Parked' : 'Reserved'}</Text>
      <Text style={{ color: '#64748B', lineHeight: 20 }}>{timeLabel(a.startsAt)} · {a.energyKwh} kWh requested · {durationLabel(a.startsAt, a.endsAt)} estimated</Text>
    </View>)}
  </View>;
}
