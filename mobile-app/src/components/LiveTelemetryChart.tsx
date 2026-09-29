import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { MeterPoint } from '@/services/chargerHistory';
import { chartReadings, nearestReadingIndex, rangeHours, sampleChartReadings, type ChartMetric } from '@/services/telemetryChart';

const METRICS: { key: ChartMetric; label: string; unit: string; color: string }[] = [
  { key: 'powerKw', label: 'Power', unit: 'kW', color: '#0b9d77' },
  { key: 'voltageV', label: 'Voltage', unit: 'V', color: '#376ad8' },
  { key: 'currentA', label: 'Current', unit: 'A', color: '#eb8b19' },
  { key: 'energyKwh', label: 'Energy', unit: 'kWh', color: '#8b5cd9' },
];
const PLOT_LEFT = 46;
const PLOT_TOP = 16;
const PLOT_HEIGHT = 160;
const CHART_HEIGHT = 202;

interface Props {
  points: MeterPoint[];
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  sessionStartedAt?: string;
  sessionEndedAt?: string;
}

const timeLabel = (timestamp: number | string, seconds = false) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}),
  });

export default function LiveTelemetryChart({
  points, isLoading, error, isStale, sessionStartedAt, sessionEndedAt,
}: Props) {
  const [metric, setMetric] = useState<ChartMetric>('powerKw');
  const [windowHours, setWindowHours] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cardWidth, setCardWidth] = useState(340);
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null);
  const selected = METRICS.find((item) => item.key === metric)!;
  const sessionReadings = useMemo(() =>
    chartReadings(points, metric, null, sessionStartedAt, sessionEndedAt),
  [points, metric, sessionStartedAt, sessionEndedAt]);
  const hours = rangeHours(sessionReadings, sessionStartedAt);
  const effectiveHours = windowHours !== null && hours.includes(windowHours) ? windowHours : null;
  const readings = useMemo(() =>
    chartReadings(sessionReadings, metric, effectiveHours),
  [sessionReadings, metric, effectiveHours]);
  const drawnReadings = useMemo(() => sampleChartReadings(readings, metric), [readings, metric]);

  useEffect(() => {
    setWindowHours(null);
    setSelectedTimestamp(null);
    setMenuOpen(false);
  }, [sessionStartedAt]);

  const latest = readings.at(-1);
  const activeIndex = readings.findIndex((point) => point.timestamp === selectedTimestamp);
  const active = activeIndex >= 0 ? readings[activeIndex] : undefined;
  const values = readings.map((point) => point[metric] as number);
  // Reduce rather than spreading an entire long session into Math.min/Math.max.
  const minimum = values.reduce((min, value) => Math.min(min, value), values[0] ?? 0);
  const maximum = values.reduce((max, value) => Math.max(max, value), values[0] ?? 0);
  const baseline = metric === 'energyKwh' || metric === 'voltageV'
    ? Math.floor(minimum - Math.max((maximum - minimum) * 0.1, metric === 'voltageV' ? 2 : 0.1))
    : Math.min(0, minimum);
  const range = Math.max(maximum - baseline, metric === 'voltageV' ? 4 : metric === 'energyKwh' ? 0.2 : 1) * 1.1;
  const width = Math.max(180, cardWidth - 32);
  const plotWidth = width - PLOT_LEFT - 12;
  const firstTime = readings.length ? Date.parse(readings[0].timestamp) : 0;
  const lastTime = latest ? Date.parse(latest.timestamp) : firstTime;
  const span = Math.max(1, lastTime - firstTime);
  const xFor = (point: MeterPoint) => readings.length === 1
    ? PLOT_LEFT + plotWidth / 2
    : PLOT_LEFT + (Date.parse(point.timestamp) - firstTime) / span * plotWidth;
  const yFor = (point: MeterPoint) => PLOT_TOP + PLOT_HEIGHT - ((point[metric] as number) - baseline) / range * PLOT_HEIGHT;
  const linePath = drawnReadings.map((point, index) =>
    `${index ? 'L' : 'M'} ${xFor(point).toFixed(2)} ${yFor(point).toFixed(2)}`).join(' ');
  const valueLabel = (point: MeterPoint) => `${(point[metric] as number).toFixed(metric === 'energyKwh' ? 3 : 2)} ${selected.unit}`;
  const inspectAt = (offsetX: number) => {
    if (!readings.length || !Number.isFinite(offsetX)) return;
    const fraction = Math.max(0, Math.min(1, (offsetX - PLOT_LEFT) / plotWidth));
    const index = nearestReadingIndex(readings, firstTime + fraction * span);
    setSelectedTimestamp(readings[index].timestamp);
  };
  const moveSelection = (direction: number) => {
    if (!readings.length) return;
    const current = activeIndex < 0 ? readings.length - 1 : activeIndex;
    setSelectedTimestamp(readings[Math.max(0, Math.min(readings.length - 1, current + direction))].timestamp);
  };
  const knownStart = sessionStartedAt ? Date.parse(sessionStartedAt) : NaN;
  const partialHistory = Number.isFinite(knownStart) && sessionReadings.length > 0
    && Date.parse(sessionReadings[0].timestamp) - knownStart > 180_000;

  return (
    <View style={styles.card} onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}>
      <View style={styles.heading}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Live charging graph</Text>
          <Text style={styles.subtitle}>Actual charger meter readings</Text>
        </View>
        <View style={[styles.badge, isStale && styles.badgeStale]}>
          <Text style={[styles.badgeText, isStale && styles.badgeTextStale]}>{isStale ? 'LAST READING' : 'LIVE'}</Text>
        </View>
      </View>
      <View style={styles.controls}>
        <View style={styles.metrics}>
        {METRICS.map((item) => (
          <Pressable key={item.key} onPress={() => { setMetric(item.key); setSelectedTimestamp(null); }}
            accessibilityRole="button" accessibilityState={{ selected: metric === item.key }}
            style={[styles.metricButton, metric === item.key && { backgroundColor: item.color }]}>
            <Text style={[styles.metricText, metric === item.key && styles.metricTextSelected]}>{item.label}</Text>
          </Pressable>
        ))}
        </View>
        <Pressable onPress={() => setMenuOpen((open) => !open)} accessibilityRole="button"
          accessibilityLabel="Select graph time range" accessibilityState={{ expanded: menuOpen }}
          style={styles.rangeButton}>
          <Text style={styles.rangeText}>{effectiveHours === null ? 'Full session' : `Last ${effectiveHours}h`}</Text>
          <Text style={styles.chevron}>{menuOpen ? '⌃' : '⌄'}</Text>
        </Pressable>
      </View>
      {menuOpen && (
        <View style={styles.rangeMenu}>
          <ScrollView style={{ maxHeight: 208 }} nestedScrollEnabled>
            {[null, ...hours].map((hour) => (
              <Pressable key={hour ?? 'session'} accessibilityRole="button"
                accessibilityState={{ selected: effectiveHours === hour }}
                onPress={() => { setWindowHours(hour); setSelectedTimestamp(null); setMenuOpen(false); }}
                style={[styles.rangeOption, effectiveHours === hour && styles.rangeOptionSelected]}>
                <Text style={styles.rangeOptionText}>{hour === null ? 'Full session' : `Last ${hour} hour${hour === 1 ? '' : 's'}`}</Text>
                {effectiveHours === hour && <Text style={styles.check}>✓</Text>}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      {readings.length ? (
        <>
          <View style={{ height: CHART_HEIGHT, marginTop: 10 }}>
            <Svg width={width} height={CHART_HEIGHT}>
              {Array.from({ length: 5 }, (_, index) => {
                const y = PLOT_TOP + PLOT_HEIGHT * index / 4;
                return <ViewGrid key={index} y={y} width={width}
                  label={(baseline + range * (1 - index / 4)).toFixed(metric === 'energyKwh' ? 1 : 0)} />;
              })}
              <Line x1={PLOT_LEFT} y1={PLOT_TOP} x2={PLOT_LEFT} y2={PLOT_TOP + PLOT_HEIGHT} stroke="#d9e4ef" />
              {readings.length > 1 && <Path d={`${linePath} L ${xFor(latest!)} ${PLOT_TOP + PLOT_HEIGHT} L ${xFor(readings[0])} ${PLOT_TOP + PLOT_HEIGHT} Z`} fill={selected.color} fillOpacity={0.08} />}
              <Path d={linePath} fill="none" stroke={selected.color} strokeWidth={2} strokeLinejoin="round" />
              {readings.length === 1 && <Circle cx={xFor(readings[0])} cy={yFor(readings[0])} r={4} fill={selected.color} />}
              {active && <>
                <Line x1={xFor(active)} y1={PLOT_TOP} x2={xFor(active)} y2={PLOT_TOP + PLOT_HEIGHT} stroke={selected.color} strokeDasharray="4 4" strokeOpacity={0.55} />
                <Circle cx={xFor(active)} cy={yFor(active)} r={5} fill={selected.color} stroke="#fff" strokeWidth={2} />
              </>}
              {[0, ...(readings.length > 2 ? [0.5] : []), ...(readings.length > 1 ? [1] : [])].map((fraction) => (
                <SvgText key={fraction} x={readings.length === 1 ? PLOT_LEFT + plotWidth / 2 : PLOT_LEFT + fraction * plotWidth}
                  y={CHART_HEIGHT - 10} fill="#77869b" fontSize={10}
                  textAnchor={readings.length === 1 || fraction === 0.5 ? 'middle' : fraction === 0 ? 'start' : 'end'}>
                  {timeLabel(firstTime + fraction * span)}
                </SvgText>
              ))}
            </Svg>
            {active && (
              <View pointerEvents="none" style={[styles.tooltip, {
                left: Math.max(PLOT_LEFT, Math.min(width - 130, xFor(active) - 62)),
                top: yFor(active) > 68 ? yFor(active) - 62 : yFor(active) + 14,
              }]}>
                <Text style={styles.tooltipTime}>{timeLabel(active.timestamp, true)}</Text>
                <Text style={[styles.tooltipValue, { color: selected.color }]}>{valueLabel(active)}</Text>
              </View>
            )}
            {/* One transparent surface keeps event coordinates independent of SVG children. */}
            <View style={StyleSheet.absoluteFill} accessible accessibilityRole="adjustable"
              accessibilityLabel={`${selected.label} graph. ${readings.length} readings. ${active ? timeLabel(active.timestamp, true) + ', ' + valueLabel(active) : 'Hover or touch to inspect a reading.'}`}
              accessibilityActions={[{ name: 'increment', label: 'Next reading' }, { name: 'decrement', label: 'Previous reading' }]}
              onAccessibilityAction={(event) => moveSelection(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
              onPointerMove={Platform.OS === 'web' ? (event) => inspectAt(event.nativeEvent.offsetX) : undefined}
              onPointerLeave={Platform.OS === 'web' ? () => setSelectedTimestamp(null) : undefined}
              onStartShouldSetResponder={() => Platform.OS !== 'web'}
              onMoveShouldSetResponder={() => Platform.OS !== 'web'}
              onResponderGrant={(event) => inspectAt(event.nativeEvent.locationX)}
              onResponderMove={(event) => inspectAt(event.nativeEvent.locationX)}
              onResponderTerminationRequest={() => false}
            />
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{isLoading ? 'Loading meter history…' : 'No readings in this time range'}</Text>
          <Text style={styles.emptyText}>{error ? 'History unavailable; new readings will appear here.' : 'Select Full session, or wait for the next meter report.'}</Text>
        </View>
      )}
      <Text style={styles.footer}>{latest ? `${readings.length} meter reading${readings.length === 1 ? '' : 's'} · Last ${timeLabel(latest.timestamp)}` : 'No estimated or repeated data points'}</Text>
      {(partialHistory || !Number.isFinite(knownStart)) && readings.length > 0 && (
        <Text style={styles.historyNote}>{partialHistory ? 'Partial session history: earlier readings are unavailable from the server.' : 'Showing available history; the charger has not reported a session start.'}</Text>
      )}
      {error && readings.length > 0 && <Text style={styles.historyNote}>History could not be refreshed. Showing readings already received.</Text>}
    </View>
  );
}

function ViewGrid({ y, width, label }: { y: number; width: number; label: string }) {
  return <>
    <Line x1={PLOT_LEFT} y1={y} x2={width - 12} y2={y} stroke="#e8eef5" />
    <SvgText x={PLOT_LEFT - 8} y={y + 3} fill="#77869b" fontSize={10} textAnchor="end">{label}</SvgText>
  </>;
}

const styles = StyleSheet.create({
  card: { marginTop: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce6f2', borderRadius: 16, padding: 16, overflow: 'hidden' },
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 16, fontWeight: '600', color: '#17243b' },
  subtitle: { fontSize: 12, color: '#66758b', marginTop: 3 },
  badge: { backgroundColor: '#d8f8ea', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  badgeStale: { backgroundColor: '#eef2f7' },
  badgeText: { color: '#087353', fontSize: 10, fontWeight: '600' },
  badgeTextStale: { color: '#607086' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 12 },
  metrics: { flexDirection: 'row', flex: 1, minWidth: 200, gap: 4 },
  metricButton: { flex: 1, alignItems: 'center', minHeight: 34, justifyContent: 'center', borderRadius: 9, backgroundColor: '#f0f5fb' },
  metricText: { color: '#566983', fontSize: 11, fontWeight: '500' },
  metricTextSelected: { color: '#fff' },
  rangeButton: { flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 34, paddingHorizontal: 9, borderRadius: 9, borderWidth: 1, borderColor: '#dce6f2', backgroundColor: '#f8faff' },
  rangeText: { color: '#37608a', fontSize: 11, fontWeight: '500' },
  chevron: { color: '#64748b', fontSize: 18 },
  rangeMenu: { position: 'absolute', right: 16, top: 112, zIndex: 5, elevation: 5, backgroundColor: '#fff', width: 190, borderWidth: 1, borderColor: '#dce6f2', borderRadius: 10, padding: 4, marginBottom: 8 },
  rangeOption: { flexDirection: 'row', justifyContent: 'space-between', minHeight: 44, alignItems: 'center', paddingHorizontal: 10, borderRadius: 7 },
  rangeOptionSelected: { backgroundColor: '#eaf2ff' },
  rangeOptionText: { fontSize: 12, color: '#34435a' },
  check: { color: '#2563eb' },
  tooltip: { position: 'absolute', width: 126, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#dce6f2', borderRadius: 8, backgroundColor: '#fff' },
  tooltipTime: { fontSize: 10, color: '#66758b' },
  tooltipValue: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  empty: { height: 170, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#34435a', fontWeight: '500', fontSize: 14 },
  emptyText: { color: '#7b899b', fontSize: 12, marginTop: 5, textAlign: 'center' },
  footer: { color: '#758398', fontSize: 11, marginTop: 7 },
  historyNote: { color: '#7b899b', fontSize: 11, lineHeight: 16, marginTop: 4 },
});
