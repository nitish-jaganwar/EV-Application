import type { MeterPoint } from './chargerHistory';

export type ChartMetric = 'powerKw' | 'voltageV' | 'currentA' | 'energyKwh';

// Longer sessions can expose additional ranges without adding buttons to the UI.
const RANGE_HOURS = [1, 2, 3, 4, 6, 8, 12, 24, 48, 72];

export function chartReadings(
  points: MeterPoint[], metric: ChartMetric, hours: number | null,
  sessionStartedAt?: string, sessionEndedAt?: string,
): MeterPoint[] {
  const start = sessionStartedAt ? Date.parse(sessionStartedAt) : NaN;
  const end = sessionEndedAt ? Date.parse(sessionEndedAt) : NaN;
  const ordered = points.filter((point) => {
    const time = Date.parse(point.timestamp);
    return Number.isFinite(time) && Number.isFinite(point[metric])
      && (!Number.isFinite(start) || time >= start)
      && (!Number.isFinite(end) || time <= end);
  }).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (hours === null || !ordered.length) return ordered;
  // Anchor to the last received reading: ended or stale sessions remain inspectable.
  const cutoff = Date.parse(ordered[ordered.length - 1].timestamp) - hours * 3_600_000;
  return ordered.filter((point) => Date.parse(point.timestamp) >= cutoff);
}

export function rangeHours(points: MeterPoint[], sessionStartedAt?: string): number[] {
  if (!points.length) return [];
  const reportedStart = sessionStartedAt ? Date.parse(sessionStartedAt) : NaN;
  const start = Number.isFinite(reportedStart) ? reportedStart : Date.parse(points[0].timestamp);
  const duration = Date.parse(points[points.length - 1].timestamp) - start;
  return RANGE_HOURS.filter((hour) => hour * 3_600_000 <= duration);
}

/** Locate an actual report by timestamp, including irregular reporting intervals. */
export function nearestReadingIndex(points: MeterPoint[], timestamp: number): number {
  if (!points.length) return -1;
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (Date.parse(points[mid].timestamp) < timestamp) low = mid + 1;
    else high = mid;
  }
  if (low > 0 && timestamp - Date.parse(points[low - 1].timestamp)
    <= Date.parse(points[low].timestamp) - timestamp) return low - 1;
  return low;
}

/** Keep extrema and endpoints when drawing long sessions; tooltips use every raw report. */
export function sampleChartReadings(points: MeterPoint[], metric: ChartMetric, maxPoints = 600): MeterPoint[] {
  if (points.length <= maxPoints) return points;
  const bucketSize = Math.ceil((points.length - 2) / Math.max(1, Math.floor((maxPoints - 2) / 2)));
  const result = [points[0]];
  for (let start = 1; start < points.length - 1; start += bucketSize) {
    const end = Math.min(points.length - 1, start + bucketSize);
    let min = start;
    let max = start;
    for (let index = start + 1; index < end; index++) {
      if (points[index][metric]! < points[min][metric]!) min = index;
      if (points[index][metric]! > points[max][metric]!) max = index;
    }
    result.push(points[Math.min(min, max)]);
    if (min !== max) result.push(points[Math.max(min, max)]);
  }
  result.push(points[points.length - 1]);
  return result;
}
