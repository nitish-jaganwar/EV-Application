const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  parseNotification,
  toNotificationData,
  mergeNotifications,
  createDemoNotification,
  createDemoScenarioNotifications,
  buildChargingNotification,
} = require('../src/services/notifications/notificationEvents.ts');

const baseEvent = {
  eventId: 'event-1001',
  recipientId: 'resident-1',
  occurredAt: '2026-09-10T06:10:00.000Z',
  chargerName: 'Charger C0',
  sessionId: 'TX-1001',
};
const started = buildChargingNotification({ ...baseEvent, kind: 'charging_started' });

test('versioned notification payload round trips without sending local read state', () => {
  const data = toNotificationData({ ...started, read: true });
  assert.equal(data.schemaVersion, 1);
  assert.equal('read' in data, false);
  assert.deepEqual(parseNotification(data), started);
  assert.equal(parseNotification({ ...data, read: true }).read, true);
});

test('invalid, oversized, unversioned and unsafe navigation payloads are rejected', () => {
  const data = toNotificationData(started);
  for (const payload of [
    null, [], 'notification', {}, { ...data, schemaVersion: 2 },
    { ...data, type: 'arbitrary' }, { ...data, destination: 'https://example.com' },
    { ...data, destination: '/settings' }, { ...data, title: ' ' },
    { ...data, title: 'x'.repeat(121) }, { ...data, body: 'x'.repeat(601) },
    { ...data, id: 'x'.repeat(161) }, { ...data, sessionId: 1 },
    { ...data, recipientId: undefined }, { ...data, recipientId: '' },
    { ...data, createdAt: 'invalid' }, { ...data, createdAt: '2026-02-30T00:00:00Z' },
    { ...data, createdAt: '2026-09-10' }, { ...data, demo: undefined },
  ]) assert.equal(parseNotification(payload), null, JSON.stringify(payload));
});

test('FCM string data values are normalized without weakening payload validation', () => {
  const data = toNotificationData(started);
  const parsed = parseNotification({ ...data, schemaVersion: '1', demo: 'false', read: 'true' });
  assert.deepEqual(parsed, { ...started, read: true });
  assert.equal(parseNotification({ ...data, schemaVersion: '2', demo: 'false' }), null);
  assert.equal(parseNotification({ ...data, schemaVersion: '1', demo: 'yes' }), null);
});

test('unrecognized extra fields cannot supply an arbitrary URL to the UI', () => {
  const parsed = parseNotification({ ...toNotificationData(started), url: 'https://example.com' });
  assert.equal('url' in parsed, false);
  assert.equal(parsed.destination, 'LIVE');
});

test('deduplication preserves read state and does not mutate existing notifications', () => {
  const existing = Object.freeze({ ...started, read: true });
  const incoming = Object.freeze({ ...started, read: false });
  const merged = mergeNotifications([existing], [incoming]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].read, true);
  assert.equal(incoming.read, false);
  assert.equal(mergeNotifications([incoming], [existing])[0].read, true);
});

test('identical event IDs belonging to different recipients are not combined', () => {
  const otherRecipient = { ...started, recipientId: 'resident-2' };
  const merged = mergeNotifications([started], [otherRecipient]);
  assert.equal(merged.length, 2);
  assert.deepEqual(new Set(merged.map((item) => item.recipientId)), new Set(['resident-1', 'resident-2']));
});

test('inbox sorts by event time, handles out-of-order arrivals and retains the latest 100', () => {
  const notifications = Array.from({ length: 102 }, (_, index) => ({
    ...started,
    id: `event-${index}`,
    createdAt: new Date(Date.parse(baseEvent.occurredAt) + index * 1000).toISOString(),
  }));
  const merged = mergeNotifications([notifications[101]], notifications.slice(0, 101));
  assert.equal(merged.length, 100);
  assert.equal(merged[0].id, 'event-101');
  assert.equal(merged.at(-1).id, 'event-2');
});

test('full notification requires explicit confirmation from charger or vehicle', () => {
  const full = { ...baseEvent, kind: 'charging_full', confirmedFull: true, confirmationSource: 'vehicle' };
  assert.equal(buildChargingNotification(full).type, 'charging_full');
  assert.equal(buildChargingNotification({ ...full, confirmationSource: 'charger' }).type, 'charging_full');
  for (const event of [
    { ...full, confirmedFull: false }, { ...full, confirmedFull: undefined },
    { ...full, confirmationSource: 'zero_power' }, { ...full, confirmationSource: undefined },
    { ...full, sessionId: undefined },
  ]) assert.equal(buildChargingNotification(event), null);
});

test('nearly full is guarded by a reliable sourced ETA within fifteen minutes', () => {
  const nearFull = {
    ...baseEvent, kind: 'charging_nearly_full', minutesRemaining: 15,
    reliableEta: true, etaSource: 'backend_estimate',
  };
  assert.match(buildChargingNotification(nearFull).body, /Estimated.*15 minutes/);
  assert.match(buildChargingNotification({ ...nearFull, minutesRemaining: 4.2 }).body, /5 minutes/);
  for (const minutesRemaining of [0, -1, 15.1, NaN, Infinity, undefined]) {
    assert.equal(buildChargingNotification({ ...nearFull, minutesRemaining }), null);
  }
  assert.equal(buildChargingNotification({ ...nearFull, reliableEta: false }), null);
  assert.equal(buildChargingNotification({ ...nearFull, etaSource: 'power_only' }), null);
});

test('session ending never claims full charge and links to Records', () => {
  const ended = buildChargingNotification({ ...baseEvent, kind: 'session_ended', energyKwh: 2.05 });
  assert.equal(ended.destination, 'RECORDS');
  assert.equal(ended.type, 'session_ended');
  assert.match(ended.body, /2.05 kWh/);
  assert.doesNotMatch(`${ended.title} ${ended.body}`, /full|100%/i);
  for (const energyKwh of [-1, Infinity, NaN]) {
    assert.equal(buildChargingNotification({ ...baseEvent, kind: 'session_ended', energyKwh }), null);
  }
});

test('unplug reminders require both confirmed session end and continued connection', () => {
  const event = { ...baseEvent, kind: 'unplug_reminder', sessionEndedConfirmed: true, stillConnectedConfirmed: true };
  assert.equal(buildChargingNotification(event).type, 'unplug_reminder');
  assert.equal(buildChargingNotification({ ...event, sessionEndedConfirmed: false }), null);
  assert.equal(buildChargingNotification({ ...event, stillConnectedConfirmed: false }), null);
});

test('plugged-in reminders wait and exclude scheduled or intentional pauses', () => {
  const event = {
    ...baseEvent, kind: 'plugged_not_started', connectedConfirmed: true,
    scheduledOrIntentionalWait: false, waitingMinutes: 3,
  };
  assert.equal(buildChargingNotification(event).type, 'plugged_not_started');
  assert.equal(buildChargingNotification({ ...event, waitingMinutes: 1 }), null);
  assert.equal(buildChargingNotification({ ...event, connectedConfirmed: false }), null);
  assert.equal(buildChargingNotification({ ...event, scheduledOrIntentionalWait: true }), null);
});

test('booking notifications use Schedule and require an identified booking', () => {
  for (const kind of ['booking_confirmed', 'booking_reminder', 'booking_ending']) {
    const event = { ...baseEvent, kind, bookingId: 'booking-1', minutesRemaining: 10 };
    assert.equal(buildChargingNotification(event).destination, 'SCHEDULE');
    assert.equal(buildChargingNotification({ ...event, bookingId: undefined }), null);
  }
});

test('ordinary confirmed transitions retain the event ID for delivery retries', () => {
  for (const kind of ['charging_started', 'charging_paused', 'charging_resumed', 'charging_interrupted', 'charger_offline']) {
    const notification = buildChargingNotification({ ...baseEvent, kind });
    assert.equal(notification.id, baseEvent.eventId);
    assert.equal(notification.demo, false);
    assert.equal(notification.destination, 'LIVE');
  }
  assert.equal(buildChargingNotification({ ...baseEvent, kind: 'charger_fault', errorCode: 'NoError' }), null);
  assert.equal(buildChargingNotification({ ...baseEvent, kind: 'charger_fault', errorCode: 'OverCurrentFailure' }).type, 'charger_fault');
});

test('local demos are unique and explicitly distinguish a test from real charging', () => {
  const first = createDemoNotification('resident-1');
  const second = createDemoNotification('resident-1');
  assert.notEqual(first.id, second.id);
  assert.equal(first.title, 'Test notification');
  assert.equal(first.type, 'test');
  assert.equal(first.demo, true);
  assert.match(first.body, /does not describe a real charging session/);
  assert.deepEqual(parseNotification(toNotificationData(first)), first);
  assert.equal(parseNotification({ ...toNotificationData(first), demo: false }), null);
});

test('scenario previews are marked as samples and scoped to their recipient', () => {
  const demos = createDemoScenarioNotifications('resident-2');
  assert.equal(demos.length, 7);
  assert.equal(new Set(demos.map((item) => item.id)).size, demos.length);
  for (const notification of demos) {
    assert.equal(notification.recipientId, 'resident-2');
    assert.equal(notification.demo, true);
    assert.match(notification.title, /^\[Demo\]/);
    assert.match(notification.body, /^Sample only/);
    assert.deepEqual(parseNotification(toNotificationData(notification)), notification);
  }
  assert.equal(demos.some((item) => item.type === 'charging_full'), true);
  assert.equal(demos.some((item) => item.destination === 'SCHEDULE'), true);
  assert.equal(demos.some((item) => item.destination === 'RECORDS'), true);
});
