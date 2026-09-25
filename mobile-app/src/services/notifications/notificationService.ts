import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  type ChargingNotification,
  parseNotification,
  toNotificationData,
} from './notificationEvents';

type NotificationsModule = typeof import('expo-notifications');
export const CHARGING_CHANNEL_ID = 'charging-updates';

export interface NotificationRegistration {
  permission: 'unknown' | 'granted' | 'denied';
  message: string;
  devicePushToken?: string;
  devicePushTokenType?: string;
}

// Expo Go and the web preview use the in-app inbox. Never load native push APIs there.
export function supportsDeviceNotifications() {
  return Platform.OS !== 'web' && Constants.executionEnvironment !== 'storeClient';
}

async function getNotifications(): Promise<NotificationsModule | null> {
  if (!supportsDeviceNotifications()) return null;
  return import('expo-notifications');
}

async function ensureChannel(notifications: NotificationsModule) {
  if (Platform.OS === 'android') {
    await notifications.setNotificationChannelAsync(CHARGING_CHANNEL_ID, {
      name: 'Charging updates',
      description: 'Charging sessions, reminders, and charger issues',
      importance: notifications.AndroidImportance.HIGH,
      sound: 'default',
      lightColor: '#2563EB',
    });
  }
}

function hasPermission(
  permissions: Awaited<ReturnType<NotificationsModule['getPermissionsAsync']>>,
  notifications: NotificationsModule,
) {
  return permissions.granted || permissions.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
}

/** Prompts only following the user's Enable/Test action; startup checks never prompt. */
export async function registerForNotifications(
  requestPermission = false,
  devicePushToken?: import('expo-notifications').DevicePushToken,
): Promise<NotificationRegistration> {
  const notifications = await getNotifications();
  if (!notifications) {
    return {
      permission: 'unknown',
      message: Platform.OS === 'web'
        ? 'In-app preview. Phone notifications need an Android or iOS development build.'
        : 'In-app preview in Expo Go. Use a development build for phone notifications.',
    };
  }

  // Android 13+ requires a channel before the notification permission request.
  await ensureChannel(notifications);
  let permissions = await notifications.getPermissionsAsync();
  if (!hasPermission(permissions, notifications) && requestPermission && permissions.canAskAgain) {
    permissions = await notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: true },
    });
  }
  if (!hasPermission(permissions, notifications)) {
    return {
      permission: permissions.canAskAgain ? 'unknown' : 'denied',
      message: permissions.canAskAgain
        ? 'Enable phone notifications to receive charging alerts outside the app.'
        : 'Notifications are blocked. Allow them in your phone settings.',
    };
  }

  if (Platform.OS !== 'android') {
    return {
      permission: 'granted',
      message: 'Phone test notifications are ready. Direct server push is currently configured for Android FCM.',
    };
  }
  try {
    const token = devicePushToken ?? await notifications.getDevicePushTokenAsync();
    if (typeof token.data !== 'string' || !token.data.trim()) throw new Error('FCM token unavailable');
    return {
      permission: 'granted',
      devicePushToken: token.data,
      devicePushTokenType: token.type,
      message: 'Android notifications are ready. Register this FCM token with the Java backend for live charging alerts.',
    };
  } catch {
    return {
      permission: 'granted',
      message: 'Phone test notifications are ready, but the FCM token could not be created. Check google-services.json, rebuild the app, and retry.',
    };
  }
}

/** OS-managed test: no JS timer, and no claim that a real charging event occurred. */
export async function scheduleTestNotification(notification: ChargingNotification): Promise<string | null> {
  const notifications = await getNotifications();
  if (!notifications) return null;
  await ensureChannel(notifications);
  const permissions = await notifications.getPermissionsAsync();
  if (!hasPermission(permissions, notifications)) throw new Error('Notification permission is required.');
  return notifications.scheduleNotificationAsync({
    identifier: notification.id,
    content: {
      title: notification.title,
      body: notification.body,
      sound: 'default',
      data: toNotificationData(notification),
    },
    trigger: {
      type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 10,
      repeats: false,
      channelId: CHARGING_CHANNEL_ID,
    },
  });
}

/** Only normalized events addressed to this account can enter its inbox or open a tab. */
export function listenForNotifications(
  recipientId: string,
  onReceived: (notification: ChargingNotification) => void,
  onOpened: (notification: ChargingNotification) => void,
  onTokenChanged: (token: import('expo-notifications').DevicePushToken) => void,
  onError: () => void,
) {
  let disposed = false;
  let cleanup = () => {};
  void (async () => {
    const notifications = await getNotifications();
    if (!notifications || disposed) return;
    const decode = (notification: import('expo-notifications').Notification) => {
      const parsed = parseNotification(notification.request.content.data);
      return parsed?.recipientId === recipientId ? { ...parsed, read: false } : null;
    };
    notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const show = !disposed && decode(notification) !== null;
        return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: show };
      },
    });
    const receive = (notification: import('expo-notifications').Notification) => {
      const parsed = decode(notification);
      if (!disposed && parsed) onReceived(parsed);
    };
    const open = (response: import('expo-notifications').NotificationResponse) => {
      if (disposed || response.actionIdentifier !== notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const parsed = decode(response.notification);
      if (parsed) onOpened({ ...parsed, read: true });
      // Consume once. A different account must never navigate to this notification.
      notifications.clearLastNotificationResponse();
    };
    const received = notifications.addNotificationReceivedListener(receive);
    const opened = notifications.addNotificationResponseReceivedListener(open);
    const token = notifications.addPushTokenListener((deviceToken) => { if (!disposed) onTokenChanged(deviceToken); });
    cleanup = () => {
      received.remove();
      opened.remove();
      token.remove();
      notifications.setNotificationHandler(null);
    };
    // Recover notifications still in the tray after background delivery. A backend
    // inbox sync will be needed for those cleared from the tray while the app was closed.
    const lastResponse = notifications.getLastNotificationResponse();
    if (lastResponse) open(lastResponse);
    const presented = await notifications.getPresentedNotificationsAsync();
    if (!disposed) presented.forEach(receive);
  })().catch(() => { if (!disposed) onError(); });
  return () => { disposed = true; cleanup(); };
}

/** Keep the launcher badge aligned with the authenticated account's unread inbox. */
export async function setApplicationBadgeCount(count: number) {
  const notifications = await getNotifications();
  if (!notifications) return;
  await notifications.setBadgeCountAsync(Math.max(0, Math.floor(count)));
}

/** Also call when reopening via the app icon, without tapping a notification. */
export async function syncPresentedNotifications(
  recipientId: string,
  onReceived: (notification: ChargingNotification) => void,
) {
  const notifications = await getNotifications();
  if (!notifications) return;
  const presented = await notifications.getPresentedNotificationsAsync();
  for (const notification of presented) {
    const parsed = parseNotification(notification.request.content.data);
    if (parsed?.recipientId === recipientId) onReceived({ ...parsed, read: false });
  }
}

/** Clear this account's local tests/tray on sign-out; server token revocation is separate. */
export async function clearAccountDeviceNotifications(recipientId: string) {
  const notifications = await getNotifications();
  if (!notifications) return;
  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  for (const request of scheduled) {
    if (parseNotification(request.content.data)?.recipientId === recipientId) {
      await notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }
  const presented = await notifications.getPresentedNotificationsAsync();
  for (const notification of presented) {
    if (parseNotification(notification.request.content.data)?.recipientId === recipientId) {
      await notifications.dismissNotificationAsync(notification.request.identifier);
    }
  }
}
