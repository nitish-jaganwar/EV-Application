import { supportsDeviceNotifications, CHARGING_CHANNEL_ID } from '@/services/notifications/notificationService';
import { toNotificationData, type ChargingNotification } from '@/services/notifications/notificationEvents';
import type { Booking } from './bookingTypes';

const reminderId = (bookingId: string, minutes: number) => `${bookingId}:reminder:${minutes}`;

/** Local reminders are optional; the booking remains valid if phone permissions are off. */
export async function scheduleBookingReminders(booking: Booking): Promise<boolean> {
  if (!supportsDeviceNotifications()) return false;
  const Notifications = await import('expo-notifications');
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) return false;
  const scheduled: string[] = [];
  try {
    for (const minutes of [10, 5]) {
      const date = new Date(Date.parse(booking.startsAt) - minutes * 60_000);
      if (date.getTime() <= Date.now()) continue;
      const id = reminderId(booking.id, minutes);
      const alert: ChargingNotification = {
        id, recipientId: booking.ownerId, type: 'booking_reminder',
        title: `Charging slot in ${minutes} minutes`,
        body: `Charger ${booking.chargerId} at ${new Date(booking.startsAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.`,
        createdAt: date.toISOString(), destination: 'SCHEDULE', demo: true, read: false,
      };
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: { title: alert.title, body: alert.body, sound: 'default', data: toNotificationData(alert) },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHARGING_CHANNEL_ID },
      });
      scheduled.push(id);
    }
    return scheduled.length > 0;
  } catch {
    await Promise.all(scheduled.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
    return false;
  }
}

export async function cancelBookingReminders(bookingId: string): Promise<void> {
  if (!supportsDeviceNotifications()) return;
  const Notifications = await import('expo-notifications');
  await Promise.all([10, 5].map((minutes) => Notifications.cancelScheduledNotificationAsync(reminderId(bookingId, minutes))));
}
