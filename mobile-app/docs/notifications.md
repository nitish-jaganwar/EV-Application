# Charging notifications

The mobile client now has a notification inbox, native permission/token setup,
notification listeners, and tap handling. The existing home telemetry is still a
historical fixture. It does not generate real charging notifications.

## Files

- `src/services/notifications/notificationEvents.ts`: shared types, payload validation,
  message builders, full/ETA evidence checks, and inbox deduplication.
- `src/services/notifications/notificationService.ts`: Expo permissions, Android channel,
  push token acquisition/refresh, native listeners, and the ten-second local test.
- `src/services/notifications/notificationStorage.ts`: account-scoped AsyncStorage inbox.
- `src/context/NotificationContext.tsx`: inbox state, unread counts, lifecycle, and navigation.
- `src/components/notifications/NotificationCenter.tsx`: the notification sheet.
- `src/app/home.tsx`: bell count and a single notification-center component.

## Try it locally

1. Sign in with the project's existing demo login.
2. Tap the bell. The inbox starts empty; the previous hardcoded reservation is removed.
3. On web or Expo Go, **Test in-app** adds a clearly labeled test to the inbox.
4. In a native development build, **Enable notifications** requests OS permission.
   **Send test** schedules a local notification in ten seconds. Background the app to
   check presentation, then tap the notification to open Live.
5. During development, expand **Preview charging alerts** and add sample messages for
   started, nearly full, full, interrupted, ended, unplug, and booking reminders.
   These previews do not send push notifications or use the selected vehicle's data.
6. Tap an entry to mark it read and open its tab, or use **Mark all read**. Refresh the
   app and sign in as the same demo user to check persistence. **Clear previews** removes
   only demo/test inbox entries.

Native packages were installed using Expo's SDK 57 compatibility selection:
`expo-notifications` and `@react-native-async-storage/async-storage`. The notification
config plugin was added to `app.json`. An existing native development build needs
rebuilding after these native dependency/config changes; a Metro refresh alone is insufficient.

## Native push configuration still required

This project does not yet provide an EAS project ID, native application identifiers,
push credentials, or an authenticated notification backend. Those were not invented
or provisioned. Local test delivery does not require a charging backend.

For real pushes, configure the actual Android package/iOS bundle ID, EAS project ID
(`extra.eas.projectId`), Android Firebase/FCM and iOS APNs credentials for this app,
and rebuild. Use a physical phone for end-to-end verification. See the official
[SDK 57 notifications reference](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)
and [push setup guide](https://docs.expo.dev/push-notifications/push-notifications-setup/).

## Backend connection

The intended delivery flow is:

`Charger -> CitrineOS -> authenticated application backend -> Expo push service -> FCM/APNs -> phone`

The application backend must:

1. Register `useNotifications().expoPushToken` against the authenticated account and
   installation. Upsert when it changes, and revoke the account/device association on
   logout. Token registration is deliberately not sent to an invented endpoint.
   Never ship push service credentials or CitrineOS administrator credentials in the app.
2. Associate each station, connector, transaction, and booking with its actual resident.
   The current prototype uses `user.mobile` as a local `recipientId`; replace it with
   the stable authenticated account ID when real auth is connected. The selected
   vehicle and a future booking are not proof of ownership of the active session.
3. Normalize incoming OCPP events into `ChargingNotificationEvent`, then call
   `buildChargingNotification`. Match station/connector/transaction, process event
   timestamps/sequences, discard stale transitions, and apply a delay before notifying
   about temporary pauses/offline/plugged-without-charging conditions.
4. Persist each alert before sending. Use a stable event ID for retries and suppress
   repeated alerts per session/threshold. Run ETA and booking reminders on the server;
   phone JavaScript timers do not run reliably when the app is closed.
5. Send a visible notification with `title`, `body`, `sound: "default"`,
   `channelId: "charging-updates"`, and `data: toNotificationData(notification)`.
   Choose a short expiration for time-sensitive reminders. Check delivery receipts,
   retry transient failures, and remove invalid device tokens.
6. Provide an authenticated inbox endpoint. Call `receiveNotification(data)` for each
   returned versioned payload after login/resume. The client currently recovers alerts
   from foreground delivery, taps, and the OS tray. It cannot recover a push dismissed
   while the app was closed without that server inbox. Synchronize read state there if
   multiple devices must agree; current read state is local to each installation.

Use ordinary visible pushes for app-closed alerts. Delivery still depends on OS
permission, connectivity, and device settings. Android force-stop requires reopening
the app. See [Expo notification behavior](https://docs.expo.dev/push-notifications/what-you-need-to-know/).

## Payload contract

Example `data` object for a confirmed charging-start event (the outer push's title/body
should match these values):

```json
{
  "schemaVersion": 1,
  "id": "cp002:1:TX-1001:charging-started:1",
  "recipientId": "authenticated-account-id",
  "type": "charging_started",
  "title": "Charging started",
  "body": "Your charging session at Charger C0 has started.",
  "createdAt": "2026-09-10T06:05:00Z",
  "destination": "LIVE",
  "sessionId": "TX-1001",
  "demo": false
}
```

Only `LIVE`, `SCHEDULE`, and `RECORDS` destinations are accepted; payloads cannot open
arbitrary URLs. `read` belongs to local inbox storage, not push delivery. The inbox
keeps the newest 100 entries, deduplicates by recipient/event ID, and preserves read
state on repeat delivery. Notification taps currently open the relevant tab; those
screens still show the project's demo data until the backend supplies real sessions.

The client hides other accounts' messages and cancels this account's scheduled local
tests/tray entries when signing out. Backend token revocation is still necessary:
the OS can display a remote push while JavaScript is not running.

## Charging scenarios and evidence

The shared builder supports charging started, paused, resumed, interrupted, session
ended, charger fault, charger offline, plugged but not started, booking confirmed,
booking starting/ending soon, estimated time to full, confirmed full, and an unplug reminder.

- **15 minutes to full** requires a positive ETA of at most 15 minutes, a recognized
  source, and `reliableEta: true`. Keep the copy explicitly estimated. The current AC
  fixture provides no battery/ETA data, so it cannot generate this alert.
- **Battery fully charged** requires `confirmedFull: true` from the charger or vehicle.
  Zero power, `SuspendedEV`, `Finishing`, and an ended transaction alone do not prove full.
- **Session ended** reports completion of the session and optional delivered energy,
  without claiming the battery reached 100%.
- **Please unplug** requires both confirmed session end and continued connection.
- **Plugged but not started** requires a confirmed connection, at least two minutes
  waiting, and confirmation that the wait is not scheduled/intentional. The server
  must identify the resident before generating this event.
- **Charger offline** reports that status is unavailable; it does not claim energy
  delivery stopped, since a charger may continue offline.

## Checks

```sh
npx tsc --noEmit
node --test tests/*.test.cjs
```

Native OS delivery requires a device build test in addition to these checks and the web UI preview.
