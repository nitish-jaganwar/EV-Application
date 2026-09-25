import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import type { MeterPoint } from '@/services/chargerHistory';

type Metric = 'powerKw' | 'voltageV' | 'currentA' | 'energyKwh';
const METRICS: { key: Metric; label: string; unit: string; color: string }[] = [
  { key: 'powerKw', label: 'Power', unit: 'kW', color: '#0b9d77' },
  { key: 'voltageV', label: 'Voltage', unit: 'V', color: '#376ad8' },
  { key: 'currentA', label: 'Current', unit: 'A', color: '#eb8b19' },
  { key: 'energyKwh', label: 'Energy', unit: 'kWh', color: '#8b5cd9' },
];
const WINDOWS = [30, 60, 180] as const;

interface Props {
  points: MeterPoint[];
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
}

export default function LiveTelemetryChart({ points, isLoading, error, isStale }: Props) {
  const [metric, setMetric] = useState<Metric>('powerKw');
  const [windowMinutes, setWindowMinutes] = useState<number>(60);
  const [cardWidth, setCardWidth] = useState(340);
  const selected = METRICS.find((item) => item.key === metric)!;
  const now = Date.now();
  const readings = useMemo(() => points.filter((point) =>
    Date.parse(point.timestamp) >= now - windowMinutes * 60_000 && point[metric] !== undefined,
  ), [points, metric, windowMinutes, now]);
  const latest = readings.at(-1);
  const values = readings.map((point) => point[metric] as number);
  const minimum = values.length ? Math.min(...values) : 0;
  const maximum = values.length ? Math.max(...values) : 0;
  // A local baseline makes small changes in voltage/current visible without changing reported values.
  const baseline = metric === 'energyKwh' || metric === 'voltageV'
    ? Math.max(0, Math.floor(minimum - Math.max((maximum - minimum) * 2, metric === 'voltageV' ? 2 : 0.1)))
    : 0;
  const range = Math.max(maximum - baseline, metric === 'voltageV' ? 4 : metric === 'energyKwh' ? 0.2 : 1);
  const chartWidth = Math.max(180, cardWidth - 90);
  const spacing = readings.length > 1 ? Math.max(24, chartWidth / (readings.length - 1)) : chartWidth;
  const chartData = readings.map((point) => ({
    value: (point[metric] as number) - baseline,
    label: '',
  }));
  const timeLabel = (point: MeterPoint) =>
    new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.card} onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}>
      <View style={styles.heading}>
        <View>
          <Text style={styles.title}>Live charging graph</Text>
          <Text style={styles.subtitle}>Actual charger meter readings</Text>
        </View>
        <View style={[styles.badge, isStale && styles.badgeStale]}>
          <Text style={[styles.badgeText, isStale && styles.badgeTextStale]}>{isStale ? 'LAST READING' : 'LIVE'}</Text>
        </View>
      </View>
      <View style={styles.controls}>
        {METRICS.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setMetric(item.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: metric === item.key }}
            style={[styles.metricButton, metric === item.key && { backgroundColor: item.color }]}
          >
            <Text style={[styles.metricText, metric === item.key && styles.metricTextSelected]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.summary}>
        <Text style={styles.currentValue}>
          {latest ? (latest[metric] as number).toFixed(metric === 'energyKwh' ? 3 : 2) : '—'}
          <Text style={styles.unit}> {selected.unit}</Text>
        </Text>
        <View style={styles.windows}>
          {WINDOWS.map((minutes) => (
            <Pressable
              key={minutes}
              onPress={() => setWindowMinutes(minutes)}
              accessibilityRole="button"
              accessibilityState={{ selected: windowMinutes === minutes }}
              style={[styles.windowButton, windowMinutes === minutes && styles.windowSelected]}
            >
              <Text style={[styles.windowText, windowMinutes === minutes && styles.windowTextSelected]}>
                {minutes === 180 ? '3h' : `${minutes}m`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {readings.length ? (
        <View style={styles.chart}>
          <LineChart
            data={chartData}
            width={chartWidth}
            height={180}
            color={selected.color}
            thickness={3}
            curved={readings.length > 2}
            areaChart={readings.length > 1}
            startFillColor={selected.color}
            endFillColor="#ffffff"
            startOpacity={0.18}
            endOpacity={0.01}
            dataPointsColor={selected.color}
            dataPointsRadius={readings.length < 3 ? 5 : 3}
            // Gifted Charts adds touch-responder props to SVG circles that react-native-web rejects.
            hideDataPoints={Platform.OS === 'web'}
            maxValue={range * 1.15}
            noOfSections={4}
            spacing={spacing}
            initialSpacing={4}
            endSpacing={4}
            yAxisLabelWidth={43}
            yAxisTextStyle={styles.axisText}
            xAxisLabelTextStyle={styles.axisText}
            xAxisColor="#d9e4ef"
            yAxisColor="#d9e4ef"
            rulesColor="#e8eef5"
            formatYLabel={(label) => (Number(label) + baseline).toFixed(metric === 'energyKwh' ? 1 : 0)}
            isAnimated={Platform.OS !== 'web'}
          />
          <View style={styles.timeAxis}>
            <Text style={styles.timeAxisText}>{timeLabel(readings[0])}</Text>
            {readings.length > 2 && <Text style={styles.timeAxisText}>{timeLabel(readings[Math.floor(readings.length / 2)])}</Text>}
            {readings.length > 1 && <Text style={styles.timeAxisText}>{timeLabel(readings[readings.length - 1])}</Text>}
          </View>
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{isLoading ? 'Loading meter history…' : 'No readings in this time range'}</Text>
          <Text style={styles.emptyText}>{error ? 'History unavailable; new readings will appear here.' : 'Try 3h, or wait for the next charger meter report.'}</Text>
        </View>
      )}
      <Text style={styles.footer}>
        {latest ? `${readings.length} meter reading${readings.length === 1 ? '' : 's'} · Last ${new Date(latest.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No estimated or repeated data points'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce6f2', borderRadius: 18, padding: 16, overflow: 'hidden' },
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '800', color: '#17243b' },
  subtitle: { fontSize: 12, color: '#66758b', marginTop: 3 },
  badge: { backgroundColor: '#d8f8ea', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  badgeStale: { backgroundColor: '#eef2f7' },
  badgeText: { color: '#087353', fontSize: 10, fontWeight: '800' },
  badgeTextStale: { color: '#607086' },
  controls: { flexDirection: 'row', gap: 5, marginTop: 18 },
  metricButton: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9, backgroundColor: '#f0f5fb' },
  metricText: { color: '#566983', fontSize: 11, fontWeight: '700' },
  metricTextSelected: { color: '#fff' },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 10 },
  currentValue: { color: '#142e3e', fontSize: 26, fontWeight: '800' },
  unit: { fontSize: 14, fontWeight: '700' },
  windows: { flexDirection: 'row', gap: 4 },
  windowButton: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f0f5fb' },
  windowSelected: { backgroundColor: '#dcefff' },
  windowText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  windowTextSelected: { color: '#135cc4' },
  chart: { marginTop: 10, marginLeft: -2 },
  timeAxis: { flexDirection: 'row', justifyContent: 'space-between', marginLeft: 45, marginRight: 10, marginTop: -1 },
  timeAxisText: { color: '#77869b', fontSize: 9 },
  axisText: { color: '#77869b', fontSize: 9 },
  empty: { height: 190, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#34435a', fontWeight: '700', fontSize: 14 },
  emptyText: { color: '#7b899b', fontSize: 12, marginTop: 5, textAlign: 'center' },
  footer: { color: '#758398', fontSize: 11, marginTop: 9 },
});
