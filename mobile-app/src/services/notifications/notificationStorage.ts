import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ChargingNotification, mergeNotifications, parseNotification, toNotificationData } from './notificationEvents';

const pendingWrites = new Map<string, Promise<void>>();
const storageKey = (recipientId: string) => `tbits_notifications_v1:${encodeURIComponent(recipientId)}`;

export async function loadNotifications(recipientId: string): Promise<ChargingNotification[]> {
  const key = storageKey(recipientId);
  await pendingWrites.get(key);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) return [];
  const notifications = data.map(parseNotification)
    .filter((item): item is ChargingNotification => item !== null && item.recipientId === recipientId);
  return mergeNotifications([], notifications);
}

// Serialize writes so a slower earlier save cannot overwrite a newer read state.
export function saveNotifications(recipientId: string, notifications: ChargingNotification[]): Promise<void> {
  const key = storageKey(recipientId);
  const payload = JSON.stringify(notifications.filter((item) => item.recipientId === recipientId)
    .map((item) => ({ ...toNotificationData(item), read: item.read })));
  const write = (pendingWrites.get(key) ?? Promise.resolve()).catch(() => {})
    .then(() => AsyncStorage.setItem(key, payload));
  pendingWrites.set(key, write);
  void write.finally(() => { if (pendingWrites.get(key) === write) pendingWrites.delete(key); }).catch(() => {});
  return write;
}
