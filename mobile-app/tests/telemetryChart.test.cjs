const assert = require('node:assert/strict');
const { test } = require('node:test');
const { chartReadings, rangeHours, nearestReadingIndex, sampleChartReadings } =
  require('../src/services/telemetryChart.ts');
const at = (hour, powerKw = hour) => ({
  timestamp: new Date(Date.UTC(2030, 0, 1, hour)).toISOString(), powerKw,
});
test('full session excludes previous and later sessions and invalid metric values', () => {
  const points = [at(0), at(1), at(2), at(3), at(4), at(5, NaN)];
  assert.deepEqual(chartReadings(points, 'powerKw', null, at(1).timestamp, at(3).timestamp), points.slice(1, 4));
});
test('last-hour range anchors to final reading rather than the wall clock', () => {
  const points = [at(1), at(2), at(3), at(4)];
  assert.deepEqual(chartReadings(points, 'powerKw', 1), points.slice(2));
  assert.deepEqual(rangeHours(points), [1, 2, 3]);
  assert.deepEqual(rangeHours([at(1), at(1)]), []);
});
test('time ranges use a reported start even when early history is missing', () => {
  assert.deepEqual(rangeHours([at(3), at(4)], at(1).timestamp), [1, 2, 3]);
});
test('hover picks actual readings across irregular intervals and clamps the edges', () => {
  const points = [at(0), at(1), at(4)];
  assert.equal(nearestReadingIndex(points, Date.parse(at(3).timestamp)), 2);
  assert.equal(nearestReadingIndex(points, Date.parse(at(2).timestamp)), 1);
  assert.equal(nearestReadingIndex(points, -1), 0);
  assert.equal(nearestReadingIndex(points, Infinity), 2);
  assert.equal(nearestReadingIndex([], Date.now()), -1);
});
test('large sessions keep first/last reports and spikes while limiting rendered points', () => {
  const points = Array.from({ length: 5000 }, (_, index) => ({
    timestamp: new Date(index * 1000).toISOString(), powerKw: index === 2345 ? 100 : index === 3456 ? -10 : 7,
  }));
  const sampled = sampleChartReadings(points, 'powerKw');
  assert.equal(sampled[0], points[0]);
  assert.equal(sampled.at(-1), points.at(-1));
  assert.ok(sampled.includes(points[2345]));
  assert.ok(sampled.includes(points[3456]));
  assert.ok(sampled.length <= 600);
  assert.equal(points.length, 5000);
  assert.deepEqual(chartReadings(points, 'powerKw', null), points);
});
