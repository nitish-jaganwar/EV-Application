import { useAuth } from '@/context/AuthContext';
import {
  type ChargingNotification,
  createDemoNotification,
  createDemoScenarioNotifications,
  mergeNotifications,
  parseNotification,
} from '@/services/notifications/notificationEvents';
import {
  clearAccountDeviceNotifications,
  listenForNotifications,
  type NotificationRegistration,
  registerForNotifications,
  scheduleTestNotification,
  setApplicationBadgeCount,
  supportsDeviceNotifications,
  syncPresentedNotifications,
} from '@/services/notifications/notificationService';
import { loadNotifications, saveNotifications } from '@/services/notifications/notificationStorage';
import { router, useRootNavigationState } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

interface NotificationContextType {
  notifications: ChargingNotification[];
  unreadCount: number;
  isLoading: boolean;
  busy: boolean;
  statusMessage: string;
  permissionDenied: boolean;
  notificationsEnabled: boolean;
  canUseNotifications: boolean;
  deviceNotificationsSupported: boolean;
  /** Register this native token with the authenticated backend; never log it or put it in notification data. */
  devicePushToken?: string;
  devicePushTokenType?: string;
  enableNotifications: () => Promise<void>;
  sendTestNotification: () => Promise<void>;
  addDemoNotifications: () => void;
  clearDemoNotifications: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearReadNotifications: () => void;
  receiveNotification: (data: unknown) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
const INITIAL_REGISTRATION: NotificationRegistration = {
  permission: 'unknown',
  message: 'Checking notification settings…',
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  // The prototype has no backend user ID yet. Replace this with the authenticated
  // account ID when connecting the server; selection of a vehicle is not ownership.
  const recipientId = user?.mobile ?? null;
  const currentRecipient = useRef(recipientId);
  currentRecipient.current = recipientId;
  const previousRecipient = useRef<string | null>(null);
  const [inbox, setInbox] = useState<{
    recipientId: string | null; items: ChargingNotification[]; loaded: boolean;
  }>({ recipientId: null, items: [], loaded: false });
  const [registration, setRegistration] = useState(INITIAL_REGISTRATION);
  const [feedback, setFeedback] = useState('');
  const [storageError, setStorageError] = useState('');
  const [busy, setBusy] = useState(false);
  const actionRunning = useRef(false);
  const [pendingOpen, setPendingOpen] = useState<ChargingNotification | null>(null);
  const navigation = useRootNavigationState();

  const receive = useCallback((notification: ChargingNotification) => {
    if (notification.recipientId !== currentRecipient.current) return;
    setInbox((previous) => ({
      recipientId: notification.recipientId,
      loaded: previous.recipientId === notification.recipientId && previous.loaded,
      items: mergeNotifications(previous.recipientId === notification.recipientId ? previous.items : [], [notification]),
    }));
  }, []);

  const refreshRegistration = useCallback(async (devicePushToken?: import('expo-notifications').DevicePushToken) => {
    const account = currentRecipient.current;
    if (!account) return;
    try {
      const result = await registerForNotifications(false, devicePushToken);
      if (currentRecipient.current === account) setRegistration(result);
    } catch {
      if (currentRecipient.current === account) {
        setRegistration({ permission: 'unknown', message: 'Notification setup could not load. Rebuild the native app after installing the notification packages, then retry.' });
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const previous = previousRecipient.current;
    previousRecipient.current = recipientId;
    if (previous && previous !== recipientId) {
      void clearAccountDeviceNotifications(previous).catch(() => {});
    }
    setRegistration(INITIAL_REGISTRATION);
    setFeedback('');
    setStorageError('');
    setPendingOpen(null);
    setInbox({ recipientId, items: [], loaded: false });
    if (!recipientId) return;

    void loadNotifications(recipientId).then((saved) => {
      if (cancelled) return;
      setInbox((previousInbox) => ({
        recipientId,
        loaded: true,
        items: mergeNotifications(previousInbox.recipientId === recipientId ? previousInbox.items : [], saved),
      }));
    }).catch(() => {
      if (cancelled) return;
      setStorageError('Saved alerts could not load. New alerts are available for this visit.');
      // Do not overwrite existing storage after a failed read.
    });
    return () => { cancelled = true; };
  }, [recipientId]);

  useEffect(() => {
    if (!inbox.loaded || !inbox.recipientId || inbox.recipientId !== recipientId) return;
    let cancelled = false;
    void saveNotifications(inbox.recipientId, inbox.items).catch(() => {
      if (!cancelled) setStorageError('Alerts could not be saved on this device.');
    });
    return () => { cancelled = true; };
  }, [inbox, recipientId]);

  useEffect(() => {
    if (authLoading || !recipientId) return;
    void refreshRegistration();
    const stopListening = listenForNotifications(recipientId, receive, (notification) => {
      receive(notification);
      if (currentRecipient.current === notification.recipientId) setPendingOpen(notification);
    }, (deviceToken) => { void refreshRegistration(deviceToken); }, () => {
      setFeedback('Notification listeners could not start. Rebuild the native app, then retry.');
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshRegistration();
        void syncPresentedNotifications(recipientId, receive).catch(() => {
          if (currentRecipient.current === recipientId) setFeedback('Some phone alerts could not be loaded. Try opening the notification from your phone notification tray.');
        });
      }
    });
    return () => { stopListening(); appState.remove(); };
  }, [authLoading, recipientId, receive, refreshRegistration]);

  useEffect(() => {
    if (!navigation?.key || !pendingOpen || !recipientId || authLoading) return;
    if (pendingOpen.recipientId === recipientId) {
      router.push({ pathname: '/home', params: { notificationTab: pendingOpen.destination, notificationId: pendingOpen.id } });
    }
    setPendingOpen(null);
  }, [navigation?.key, pendingOpen, recipientId, authLoading]);

  const runAction = async (action: (account: string) => Promise<void>) => {
    const account = currentRecipient.current;
    if (!account || actionRunning.current) return;
    actionRunning.current = true;
    setBusy(true);
    setFeedback('');
    try {
      await action(account);
    } catch {
      if (currentRecipient.current === account) setFeedback('The notification action failed. Check phone permissions and try again.');
    } finally {
      actionRunning.current = false;
      setBusy(false);
    }
  };

  const enableNotifications = () => runAction(async (account) => {
    if (registration.permission === 'denied') {
      await Linking.openSettings();
      return;
    }
    const result = await registerForNotifications(true);
    if (currentRecipient.current === account) setRegistration(result);
  });

  const sendTestNotification = () => runAction(async (account) => {
    const notification = createDemoNotification(account);
    if (!supportsDeviceNotifications()) {
      receive(notification);
      setFeedback('Test added to the in-app inbox. Phone delivery requires a native development build.');
      return;
    }
    const result = await registerForNotifications(true);
    if (currentRecipient.current !== account) return;
    setRegistration(result);
    if (result.permission !== 'granted') return;
    await scheduleTestNotification(notification);
    if (currentRecipient.current !== account) {
      await clearAccountDeviceNotifications(account);
      return;
    }
    setFeedback('Test scheduled in 10 seconds. You can put the app in the background to check phone delivery.');
  });

  const updateItems = (update: (items: ChargingNotification[]) => ChargingNotification[]) => {
    setInbox((previous) => previous.recipientId === currentRecipient.current
      ? { ...previous, items: update(previous.items) }
      : previous);
  };
  const notifications = inbox.recipientId === recipientId ? inbox.items : [];
  const unreadCount = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    void setApplicationBadgeCount(recipientId ? unreadCount : 0).catch(() => {});
  }, [recipientId, unreadCount]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      isLoading: authLoading || (!!recipientId && !inbox.loaded && !storageError),
      busy,
      statusMessage: !recipientId
        ? 'Sign in to view your charging notifications.'
        : [feedback || registration.message, storageError].filter(Boolean).join(' '),
      permissionDenied: registration.permission === 'denied',
      notificationsEnabled: registration.permission === 'granted',
      canUseNotifications: !!recipientId && !authLoading,
      deviceNotificationsSupported: supportsDeviceNotifications(),
      devicePushToken: recipientId ? registration.devicePushToken : undefined,
      devicePushTokenType: recipientId ? registration.devicePushTokenType : undefined,
      enableNotifications,
      sendTestNotification,
      receiveNotification: (data) => { const notification = parseNotification(data); if (notification) receive({ ...notification, read: false }); },
      addDemoNotifications: () => {
        if (__DEV__ && recipientId) createDemoScenarioNotifications(recipientId).forEach(receive);
      },
      clearDemoNotifications: () => updateItems((items) => items.filter((item) => !item.demo)),
      markRead: (id) => updateItems((items) => items.map((item) => item.id === id ? { ...item, read: true } : item)),
      markAllRead: () => updateItems((items) => items.map((item) => ({ ...item, read: true }))),
      clearReadNotifications: () => updateItems((items) => items.filter((item) => !item.read)),
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
}
