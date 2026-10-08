import { useEffect, useRef } from 'react';
import { useNotifications } from '@/context/NotificationContext';
import { supportsDeviceNotifications, CHARGING_CHANNEL_ID } from '@/services/notifications/notificationService';
import { toNotificationData, type ChargingNotification } from '@/services/notifications/notificationEvents';
import { parkingRepository } from './parkingRepository';
import { isReady, PARKING_CONFIG, timeLabel, type Allocation } from './parkingRules';

const reminderId = (a: Allocation) => `${a.id}:five-minutes`;
export async function cancelParkingReminder(a: Allocation) {
  if (!supportsDeviceNotifications()) return;
  const notifications = await import('expo-notifications');
  await notifications.cancelScheduledNotificationAsync(reminderId(a));
}
export async function scheduleParkingReminder(a: Allocation): Promise<boolean> {
  if (!supportsDeviceNotifications()) return false;
  const date = new Date(a.startsAt - PARKING_CONFIG.reminderMinutes * 60_000);
  if (date.getTime() <= Date.now()) return false;
  const notifications = await import('expo-notifications');
  const permission = await notifications.getPermissionsAsync();
  if (!permission.granted && permission.ios?.status !== notifications.IosAuthorizationStatus.PROVISIONAL) return false;
  await notifications.scheduleNotificationAsync({ identifier: reminderId(a),
    content: { title: 'Parking expected in 5 minutes', body: `${a.bayId} is expected at ${timeLabel(a.startsAt)}. Check the app before arriving; vacancy is not yet confirmed.`,
      data: toNotificationData(parkingAlert(reminderId(a), a.ownerId, 'Parking expected in 5 minutes', `${a.bayId}: check current availability before arriving.`)) },
    trigger: { type: notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHARGING_CHANNEL_ID } });
  return true;
}
export function parkingAlert(id: string, ownerId: string, title: string, body: string): ChargingNotification {
  return { id, recipientId: ownerId, title, body, type: 'booking_reminder', createdAt: new Date().toISOString(), destination: 'SCHEDULE', demo: true, read: false };
}

/** Foreground vacancy updates. Production needs server push from verified occupancy events. */
export function useParkingNotifications(ownerId: string | null) {
  const context = useNotifications();
  const current = useRef(context); current.current = context;
  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    const sent = new Set<string>();
    const emit = (id: string, title: string, body: string) => {
      if (sent.has(id) || current.current.notifications.some(n => n.id === id)) return;
      sent.add(id); current.current.receiveNotification(toNotificationData(parkingAlert(id, ownerId, title, body)));
    };
    const check = async () => {
      try {
        const state = await parkingRepository.load(); if (!active) return;
        const now = Date.now();
        for (const a of state.allocations.filter(item => item.ownerId === ownerId && item.status === 'RESERVED')) {
          const occupied = state.occupied.find(o => o.bayId === a.bayId);
          const delayed = (occupied && occupied.expectedVacantAt > a.startsAt) || (now >= a.startsAt && !isReady(a, state, now));
          if (delayed) {
            void cancelParkingReminder(a).catch(() => undefined);
            emit(`${a.id}:delay:${occupied?.expectedVacantAt ?? a.startsAt}`, 'Your bay is delayed', `${a.bayId} is still occupied or reserved. Open Parking to review the next available bay.`);
          } else if (isReady(a, state, now)) emit(`${a.id}:ready`, 'Your bay is ready', `${a.bayId} is vacant. Open Parking to view your allocation.`);
          else if (a.startsAt - now <= 5 * 60_000) emit(reminderId(a), 'Parking expected in 5 minutes', `${a.bayId} is expected at ${timeLabel(a.startsAt)}. We will confirm when it is vacant.`);
        }
      } catch { /* The Parking screen displays data errors and keeps actions disabled. */ }
    };
    void check(); const timer = setInterval(() => void check(), 15_000);
    const unsubscribe = parkingRepository.subscribe(() => void check());
    return () => { active = false; clearInterval(timer); unsubscribe(); };
  }, [ownerId]);
}
