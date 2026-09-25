import { useNotifications } from '@/context/NotificationContext';
import type {
  ChargingNotification,
  NotificationDestination,
  NotificationType,
} from '@/services/notifications/notificationEvents';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface NotificationCenterProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (destination: NotificationDestination) => void;
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, {
    hour: '2-digit', minute: '2-digit',
  });
}

function dateGroup(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Earlier';
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startToday - startDate) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

const NOTIFICATION_VISUALS: Record<NotificationType, { icon: string; color: string; background: string }> = {
  charging_started: { icon: '⚡', color: '#047857', background: '#D1FAE5' },
  charging_resumed: { icon: '▶', color: '#047857', background: '#D1FAE5' },
  charging_paused: { icon: 'Ⅱ', color: '#92400E', background: '#FEF3C7' },
  charging_interrupted: { icon: '!', color: '#B91C1C', background: '#FEE2E2' },
  session_ended: { icon: '✓', color: '#1D4ED8', background: '#DBEAFE' },
  charger_fault: { icon: '!', color: '#B91C1C', background: '#FEE2E2' },
  charger_offline: { icon: '×', color: '#475569', background: '#E2E8F0' },
  plugged_not_started: { icon: '↯', color: '#92400E', background: '#FEF3C7' },
  booking_confirmed: { icon: '✓', color: '#1D4ED8', background: '#DBEAFE' },
  booking_reminder: { icon: '◷', color: '#1D4ED8', background: '#DBEAFE' },
  booking_ending: { icon: '◷', color: '#92400E', background: '#FEF3C7' },
  charging_nearly_full: { icon: '↗', color: '#047857', background: '#D1FAE5' },
  charging_full: { icon: '✓', color: '#047857', background: '#D1FAE5' },
  unplug_reminder: { icon: '⌁', color: '#92400E', background: '#FEF3C7' },
  test: { icon: 'T', color: '#6D28D9', background: '#EDE9FE' },
};

function groupNotifications(notifications: ChargingNotification[]) {
  const groups: Array<{ title: string; items: ChargingNotification[] }> = [];
  for (const notification of notifications) {
    const title = dateGroup(notification.createdAt);
    const current = groups.at(-1);
    if (current?.title === title) current.items.push(notification);
    else groups.push({ title, items: [notification] });
  }
  return groups;
}

export default function NotificationCenter({ visible, onClose, onSelect }: NotificationCenterProps) {
  const insets = useSafeAreaInsets();
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const {
    notifications, unreadCount, isLoading, statusMessage, busy, permissionDenied, notificationsEnabled,
    enableNotifications, sendTestNotification, addDemoNotifications,
    markRead, markAllRead, clearReadNotifications, clearDemoNotifications,
    canUseNotifications, deviceNotificationsSupported, devicePushToken, devicePushTokenType,
  } = useNotifications();
  const hasPreviews = notifications.some(notification => notification.demo);
  const hasRead = notifications.some(notification => notification.read);
  const actionsDisabled = busy || !canUseNotifications;
  const notificationGroups = groupNotifications(notifications);
  const showPushDiagnostics = __DEV__ || process.env.EXPO_PUBLIC_SHOW_PUSH_DIAGNOSTICS === 'true';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingTop: insets.top + 16 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} accessibilityViewIsModal>
          <View style={styles.header}>
            <View style={styles.headingGroup}>
              <Text style={styles.heading} accessibilityRole="header">Notifications</Text>
              <Text style={styles.caption}>{unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close notifications" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {!deviceNotificationsSupported ? (
              <View style={styles.deliveryStatus}>
                <View style={[styles.deliveryDot, styles.deliveryDotPreview]} />
                <View style={styles.deliveryTextGroup}>
                  <Text style={styles.deliveryTitle}>In-app notifications</Text>
                  <Text style={styles.deliveryCaption}>Phone alerts require a native development build.</Text>
                </View>
              </View>
            ) : notificationsEnabled ? (
              <View style={styles.deliveryStatus}>
                <View style={styles.deliveryDot} />
                <View style={styles.deliveryTextGroup}>
                  <Text style={styles.deliveryTitle}>Phone alerts enabled</Text>
                  <Text style={styles.deliveryCaption}>Charging updates can appear when the app is closed.</Text>
                </View>
              </View>
            ) : (
              <View style={styles.setupCard}>
                <Text style={styles.cardTitle}>Never miss a charging update</Text>
                <Text style={styles.body} accessibilityLiveRegion="polite">{statusMessage}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: actionsDisabled }}
                  disabled={actionsDisabled}
                  style={[styles.primaryButton, actionsDisabled && styles.disabled]}
                  onPress={() => { void enableNotifications(); }}
                >
                  <Text style={styles.primaryButtonText}>{busy ? 'Please wait…' : permissionDenied ? 'Open notification settings' : 'Enable phone alerts'}</Text>
                </Pressable>
              </View>
            )}

            {showPushDiagnostics && canUseNotifications && (
              <View style={styles.previewCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: previewExpanded }}
                  onPress={() => setPreviewExpanded(previous => !previous)}
                  style={styles.previewToggle}
                >
                  <Text style={styles.linkText}>Preview charging alerts</Text>
                  <Text style={styles.linkText}>{previewExpanded ? '−' : '+'}</Text>
                </Pressable>
                {previewExpanded && (
                  <View style={styles.previewContent}>
                    <Text style={styles.hint}>Sample messages for UI development. These do not describe your vehicle or send a push notification.</Text>
                    {devicePushToken && (
                      <View style={styles.tokenCard}>
                        <Text style={styles.tokenLabel}>{devicePushTokenType?.toUpperCase() || 'FCM'} device token</Text>
                        <Text selectable style={styles.tokenText}>{devicePushToken}</Text>
                        <Text style={styles.hint}>Long-press the token to copy it for Firebase testing. Treat it as device registration data.</Text>
                      </View>
                    )}
                    <View style={styles.actions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: actionsDisabled }}
                        disabled={actionsDisabled}
                        onPress={() => { void sendTestNotification(); }}
                        style={[styles.secondaryButton, actionsDisabled && styles.disabled]}
                      >
                        <Text style={styles.linkText}>{deviceNotificationsSupported ? 'Send phone test' : 'Add inbox test'}</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" onPress={addDemoNotifications} style={styles.secondaryButton}>
                        <Text style={styles.linkText}>Add previews</Text>
                      </Pressable>
                      {hasPreviews && (
                        <Pressable accessibilityRole="button" onPress={clearDemoNotifications} style={styles.secondaryButton}>
                          <Text style={styles.linkText}>Clear previews</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                )}
              </View>
            )}

            <View style={styles.listHeading}>
              <Text style={styles.cardTitle}>Recent alerts</Text>
              <View style={styles.listActions}>
                {hasRead && (
                  <Pressable accessibilityRole="button" onPress={clearReadNotifications} style={styles.readAllButton}>
                    <Text style={styles.mutedActionText}>Clear read</Text>
                  </Pressable>
                )}
                {unreadCount > 0 && (
                  <Pressable accessibilityRole="button" onPress={markAllRead} style={styles.readAllButton}>
                    <Text style={styles.linkText}>Mark all read</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {isLoading ? (
              <Text style={styles.emptyText}>Loading notifications…</Text>
            ) : notifications.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.cardTitle}>No notifications yet</Text>
                <Text style={styles.body}>Charging updates and reminders will appear here when received.</Text>
              </View>
            ) : notificationGroups.map(group => (
              <View key={group.title} style={styles.notificationGroup}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                {group.items.map(notification => {
                  const visual = NOTIFICATION_VISUALS[notification.type];
                  return (
                    <Pressable
                      key={notification.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${notification.read ? '' : 'Unread. '}${notification.demo ? 'Preview. ' : ''}${notification.title}. ${notification.body}`}
                      accessibilityHint={`Opens ${notification.destination.toLowerCase()}`}
                      style={[
                        styles.notificationCard,
                        !notification.read && styles.unreadCard,
                        { borderLeftColor: visual.color },
                      ]}
                      onPress={() => { markRead(notification.id); onSelect(notification.destination); onClose(); }}
                    >
                      <View style={[styles.notificationIcon, { backgroundColor: visual.background }]}>
                        <Text style={[styles.notificationIconText, { color: visual.color }]}>{visual.icon}</Text>
                      </View>
                      <View style={styles.notificationMain}>
                        <View style={styles.notificationHeading}>
                          <Text style={styles.notificationTitle}>{notification.title}</Text>
                          {!notification.read && <View style={styles.unreadDot} />}
                          {notification.demo && <Text style={styles.demoBadge}>Preview</Text>}
                        </View>
                        <Text style={styles.body}>{notification.body}</Text>
                        <View style={styles.notificationFooter}>
                          <Text style={styles.date}>{formatTime(notification.createdAt)}</Text>
                          <Text style={styles.destinationText}>View {notification.destination.toLowerCase()} ›</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.42)' },
  sheet: { width: '100%', maxWidth: 520, maxHeight: '90%', backgroundColor: '#F6F8FA', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headingGroup: { flex: 1 },
  heading: { fontSize: 21, fontWeight: '700', color: '#0F172A' },
  caption: { fontSize: 12, color: '#64748B', marginTop: 4 },
  closeButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, backgroundColor: '#F1F5F9' },
  closeText: { fontSize: 28, color: '#475569', lineHeight: 30 },
  content: { padding: 16, gap: 12 },
  setupCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#DDE6F1', gap: 9 },
  deliveryStatus: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#DDE6F1', gap: 10 },
  deliveryDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#10B981' },
  deliveryDotPreview: { backgroundColor: '#64748B' },
  deliveryTextGroup: { flex: 1 },
  deliveryTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  deliveryCaption: { fontSize: 11, lineHeight: 16, color: '#64748B', marginTop: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  body: { fontSize: 13, lineHeight: 20, color: '#475569' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryButton: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', flexShrink: 1 },
  primaryButtonText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },
  secondaryButton: { minHeight: 44, paddingHorizontal: 13, paddingVertical: 12, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', flexShrink: 1 },
  linkText: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  hint: { fontSize: 12, lineHeight: 18, color: '#64748B' },
  disabled: { opacity: 0.5 },
  previewCard: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#DDE6F1' },
  previewToggle: { minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  previewContent: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  tokenCard: { padding: 11, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', gap: 6 },
  tokenLabel: { fontSize: 11, fontWeight: '700', color: '#475569' },
  tokenText: { fontSize: 11, lineHeight: 16, color: '#0F172A' },
  listHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: 8 },
  listActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  readAllButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  mutedActionText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  emptyCard: { padding: 24, backgroundColor: '#FFFFFF', borderRadius: 16, gap: 8 },
  emptyText: { color: '#64748B', textAlign: 'center', padding: 24 },
  notificationGroup: { gap: 8 },
  groupTitle: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  notificationCard: { flexDirection: 'row', padding: 13, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderLeftWidth: 3, borderColor: '#E2E8F0', gap: 11 },
  unreadCard: { borderColor: '#BFDBFE', backgroundColor: '#F0F7FF' },
  notificationIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  notificationIconText: { fontSize: 16, fontWeight: '800' },
  notificationMain: { flex: 1, gap: 6 },
  notificationHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  notificationTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0F172A' },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2563EB' },
  demoBadge: { fontSize: 10, fontWeight: '700', color: '#92400E', backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  notificationFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  date: { fontSize: 11, color: '#64748B' },
  destinationText: { fontSize: 11, fontWeight: '700', color: '#2563EB' },
});
