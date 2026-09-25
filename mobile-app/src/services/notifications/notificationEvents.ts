export type NotificationDestination = 'LIVE' | 'SCHEDULE' | 'RECORDS';

export type NotificationType =
  | 'charging_started'
  | 'charging_paused'
  | 'charging_resumed'
  | 'charging_interrupted'
  | 'session_ended'
  | 'charger_fault'
  | 'charger_offline'
  | 'plugged_not_started'
  | 'booking_confirmed'
  | 'booking_reminder'
  | 'booking_ending'
  | 'charging_nearly_full'
  | 'charging_full'
  | 'unplug_reminder'
  | 'test';

export interface ChargingNotification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  destination: NotificationDestination;
  sessionId?: string;
  demo: boolean;
  read: boolean;
}

const NOTIFICATION_TYPES: readonly NotificationType[] = [
  'charging_started', 'charging_paused', 'charging_resumed', 'charging_interrupted',
  'session_ended', 'charger_fault', 'charger_offline', 'plugged_not_started',
  'booking_confirmed', 'booking_reminder', 'booking_ending', 'charging_nearly_full',
  'charging_full', 'unplug_reminder', 'test',
];
const DESTINATIONS: readonly NotificationDestination[] = ['LIVE', 'SCHEDULE', 'RECORDS'];
const INBOX_LIMIT = 100;

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 35) return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts || !Number.isFinite(Date.parse(value))) return false;

  const [, year, month, day, hours, minutes, seconds] = parts;
  const daysInMonth = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return Number(month) >= 1 && Number(month) <= 12
    && Number(day) >= 1 && Number(day) <= daysInMonth
    && Number(hours) < 24 && Number(minutes) < 60 && Number(seconds) < 60;
}

/** Accept only the app's versioned payload; navigation is a fixed tab, never a supplied URL. */
export function parseNotification(data: unknown): ChargingNotification | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  // FCM data values arrive as strings. Local notifications retain native JSON types.
  const schemaVersion = value.schemaVersion === '1' ? 1 : value.schemaVersion;
  const demo = value.demo === 'true' ? true : value.demo === 'false' ? false : value.demo;
  const read = value.read === 'true' ? true : value.read === 'false' ? false : value.read;
  if (
    schemaVersion !== 1
    || !isText(value.id, 160)
    || !isText(value.recipientId, 160)
    || !NOTIFICATION_TYPES.includes(value.type as NotificationType)
    || !isText(value.title, 120)
    || !isText(value.body, 600)
    || !isTimestamp(value.createdAt)
    || !DESTINATIONS.includes(value.destination as NotificationDestination)
    || typeof demo !== 'boolean'
    || (read !== undefined && typeof read !== 'boolean')
    || (value.sessionId !== undefined && !isText(value.sessionId, 160))
    || (value.type === 'test' && demo !== true)
  ) return null;

  return {
    id: value.id,
    recipientId: value.recipientId,
    type: value.type as NotificationType,
    title: value.title,
    body: value.body,
    createdAt: value.createdAt,
    destination: value.destination as NotificationDestination,
    ...(typeof value.sessionId === 'string' ? { sessionId: value.sessionId } : {}),
    demo,
    read: read === true,
  };
}

/** Use this object as Expo notification content.data and as the backend push data contract. */
export function toNotificationData(notification: ChargingNotification): Record<string, unknown> {
  const { read: _read, ...content } = notification;
  return { schemaVersion: 1, ...content };
}

/** Duplicate delivery must not make an already-read notification unread again. */
export function mergeNotifications(
  existing: readonly ChargingNotification[],
  incoming: readonly ChargingNotification[],
): ChargingNotification[] {
  const byId = new Map<string, ChargingNotification>();
  for (const notification of [...existing, ...incoming]) {
    const key = JSON.stringify([notification.recipientId, notification.id]);
    const previous = byId.get(key);
    if (!previous) {
      byId.set(key, { ...notification });
    } else {
      const latest = Date.parse(notification.createdAt) > Date.parse(previous.createdAt)
        ? notification : previous;
      byId.set(key, { ...latest, read: previous.read || notification.read });
    }
  }
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id))
    .slice(0, INBOX_LIMIT);
}

let demoSequence = 0;

export function createDemoNotification(recipientId: string): ChargingNotification {
  return {
    id: `demo-${Date.now()}-${++demoSequence}-${Math.random().toString(36).slice(2, 8)}`,
    recipientId,
    type: 'test',
    title: 'Test notification',
    body: 'This is a local notification test. It does not describe a real charging session.',
    createdAt: new Date().toISOString(),
    destination: 'LIVE',
    demo: true,
    read: false,
  };
}

interface EventBase {
  /** Stable backend event ID, reused for retries of the same notification. */
  eventId: string;
  recipientId: string;
  occurredAt: string;
  chargerName: string;
  sessionId?: string;
}

type SessionEventBase = EventBase & { sessionId: string };
type BookingEventBase = EventBase & { bookingId: string };

/**
 * Input from an authenticated backend after associating the event with its owner.
 * These are confirmed transitions, not raw MeterValues or the selected UI vehicle.
 * The backend handles event ordering, repeat suppression, and reminder scheduling.
 */
export type ChargingNotificationEvent =
  | (SessionEventBase & { kind: 'charging_started' | 'charging_resumed' })
  | (SessionEventBase & { kind: 'charging_paused' | 'charging_interrupted'; reason?: string })
  | (SessionEventBase & { kind: 'session_ended'; energyKwh?: number; reason?: string })
  | (EventBase & { kind: 'charger_fault'; errorCode: string })
  | (EventBase & { kind: 'charger_offline' })
  | (EventBase & {
    kind: 'plugged_not_started'; waitingMinutes: number;
    connectedConfirmed: boolean; scheduledOrIntentionalWait: boolean;
  })
  | (BookingEventBase & { kind: 'booking_confirmed' })
  | (BookingEventBase & { kind: 'booking_reminder' | 'booking_ending'; minutesRemaining: number })
  | (SessionEventBase & {
    kind: 'charging_nearly_full'; minutesRemaining: number; reliableEta: boolean;
    etaSource: 'vehicle' | 'charger' | 'backend_estimate';
  })
  | (SessionEventBase & {
    kind: 'charging_full'; confirmedFull: boolean; confirmationSource: 'vehicle' | 'charger';
  })
  | (SessionEventBase & {
    kind: 'unplug_reminder'; sessionEndedConfirmed: boolean; stillConnectedConfirmed: boolean;
  });

function isPositiveMinutes(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** No SoC, full-charge, or session-end inference is made from zero/nonzero power. */
export function buildChargingNotification(event: ChargingNotificationEvent): ChargingNotification | null {
  if (
    !isText(event.eventId, 160) || !isTimestamp(event.occurredAt)
    || !isText(event.recipientId, 160)
    || !isText(event.chargerName, 80)
    || (event.sessionId !== undefined && !isText(event.sessionId, 160))
  ) return null;

  const sessionKinds = [
    'charging_started', 'charging_paused', 'charging_resumed', 'charging_interrupted',
    'session_ended', 'charging_nearly_full', 'charging_full', 'unplug_reminder',
  ];
  if (sessionKinds.includes(event.kind) && !isText(event.sessionId, 160)) return null;

  let title: string;
  let body: string;
  let destination: NotificationDestination = 'LIVE';
  const charger = event.chargerName;

  switch (event.kind) {
    case 'charging_started':
      title = 'Charging started';
      body = `Your charging session at ${charger} has started.`;
      break;
    case 'charging_paused':
      title = 'Charging paused';
      body = `Charging at ${charger} is paused. Open Live to check the session.`;
      break;
    case 'charging_resumed':
      title = 'Charging resumed';
      body = `Charging at ${charger} has resumed.`;
      break;
    case 'charging_interrupted':
      title = 'Charging interrupted';
      body = `Your charging session at ${charger} was interrupted. Open Live for the latest status.`;
      break;
    case 'session_ended': {
      const energy = event.energyKwh;
      if (energy !== undefined && (!Number.isFinite(energy) || energy < 0)) return null;
      title = 'Charging session ended';
      body = `Your session at ${charger} has ended.${energy !== undefined ? ` Energy delivered: ${energy.toFixed(2)} kWh.` : ''} Open Records for details.`;
      destination = 'RECORDS';
      break;
    }
    case 'charger_fault':
      if (!isText(event.errorCode, 80) || event.errorCode === 'NoError') return null;
      title = 'Charger needs attention';
      body = `${charger} reported an error (${event.errorCode}). Check the session or contact building support.`;
      break;
    case 'charger_offline':
      title = 'Charger connection lost';
      body = `${charger} is offline. Live charging status is temporarily unavailable.`;
      break;
    case 'plugged_not_started':
      if (
        event.connectedConfirmed !== true || event.scheduledOrIntentionalWait !== false
        || !isPositiveMinutes(event.waitingMinutes) || event.waitingMinutes < 2
      ) return null;
      title = 'Plugged in, charging not started';
      body = `Your vehicle is connected to ${charger}, but charging has not started. Open Live to check the session.`;
      break;
    case 'booking_confirmed':
      if (!isText(event.bookingId, 160)) return null;
      title = 'Booking confirmed';
      body = `Your booking at ${charger} is confirmed. Open Schedule to view the time.`;
      destination = 'SCHEDULE';
      break;
    case 'booking_reminder':
    case 'booking_ending':
      if (!isText(event.bookingId, 160) || !isPositiveMinutes(event.minutesRemaining)) return null;
      title = event.kind === 'booking_reminder' ? 'Charging booking starts soon' : 'Charging booking ends soon';
      body = `Your booking at ${charger} ${event.kind === 'booking_reminder' ? 'starts' : 'ends'} in about ${Math.ceil(event.minutesRemaining)} minutes.`;
      destination = 'SCHEDULE';
      break;
    case 'charging_nearly_full':
      if (
        event.reliableEta !== true || !['vehicle', 'charger', 'backend_estimate'].includes(event.etaSource)
        || !isPositiveMinutes(event.minutesRemaining) || event.minutesRemaining > 15
      ) return null;
      title = 'Charging nearly complete';
      body = `Estimated time to full at ${charger}: about ${Math.ceil(event.minutesRemaining)} minutes. This estimate may change.`;
      break;
    case 'charging_full':
      if (event.confirmedFull !== true || !['vehicle', 'charger'].includes(event.confirmationSource)) return null;
      title = 'Battery fully charged';
      body = `Full charge has been confirmed at ${charger}. Please unplug when it is safe to do so and free the charging space.`;
      break;
    case 'unplug_reminder':
      if (event.sessionEndedConfirmed !== true || event.stillConnectedConfirmed !== true) return null;
      title = 'Please free the charging space';
      body = `Your session at ${charger} has ended and the vehicle is still connected. Please unplug when it is safe to do so.`;
      break;
    default:
      return null;
  }

  return parseNotification({
    schemaVersion: 1,
    id: event.eventId,
    recipientId: event.recipientId,
    type: event.kind,
    title,
    body,
    createdAt: event.occurredAt,
    destination,
    sessionId: event.sessionId,
    demo: false,
  });
}

/** UI preview only: these are samples and must never be scheduled as real session alerts. */
export function createDemoScenarioNotifications(recipientId: string): ChargingNotification[] {
  const prefix = createDemoNotification(recipientId).id;
  const now = Date.now();
  const base = {
    recipientId,
    chargerName: 'Demo Charger C0',
    sessionId: `${prefix}-session`,
    occurredAt: new Date(now).toISOString(),
    eventId: prefix,
  };
  const events: ChargingNotificationEvent[] = [
    { ...base, kind: 'charging_started' },
    { ...base, kind: 'charging_nearly_full', minutesRemaining: 15, reliableEta: true, etaSource: 'vehicle' },
    { ...base, kind: 'charging_full', confirmedFull: true, confirmationSource: 'vehicle' },
    { ...base, kind: 'charging_interrupted' },
    { ...base, kind: 'session_ended', energyKwh: 2.05 },
    { ...base, kind: 'unplug_reminder', sessionEndedConfirmed: true, stillConnectedConfirmed: true },
    { ...base, kind: 'booking_reminder', bookingId: `${prefix}-booking`, minutesRemaining: 15 },
  ];
  return events.flatMap((event, index) => {
    const notification = buildChargingNotification({
      ...event,
      eventId: `${prefix}-${index}`,
      occurredAt: new Date(now - index * 1000).toISOString(),
    });
    return notification ? [{
      ...notification,
      title: `[Demo] ${notification.title}`,
      body: `Sample only — ${notification.body}`,
      demo: true,
    }] : [];
  });
}
