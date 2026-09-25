# Android FCM push testing

The Android POC uses direct Firebase Cloud Messaging. The mobile app obtains a native FCM device token with `expo-notifications`; the Java backend sends through Firebase Admin SDK. Expo Push Service is not part of this flow.

## Credential placement

- `google-services.json` belongs in the mobile project root and is referenced by `app.json`.
- `ev-test-001-firebase-adminsdk-*.json` is a private server credential. Keep it outside the mobile project and mount it read-only into the Java backend container.

The Firebase Android application and `app.json` must both use `com.anonymous.buildingapp` for this POC.

## Build and install

From the project root:

```powershell
npx expo prebuild --platform android
cd android
.\gradlew.bat assembleRelease
adb install -r .\app\build\outputs\apk\release\app-release.apk
```

The current release variant uses the debug keystore and is suitable only for local testing.

## Obtain the FCM token

1. Open the installed APK and sign in.
2. Open Notifications and select **Enable phone alerts**.
3. Grant Android notification permission.
4. Expand **Preview charging alerts**.
5. Long-press the FCM device token to copy it.

The token panel is controlled by `EXPO_PUBLIC_SHOW_PUSH_DIAGNOSTICS=true` and must be disabled for production builds.

## Basic Firebase delivery test

In Firebase Console, open Messaging and send a test message to the copied FCM registration token. Put the app in the background before sending. A basic Firebase test confirms FCM delivery but does not create an item in the app inbox unless it includes the app's normalized data payload.

## App-integrated data payload

FCM custom data values must be strings. Send all of these fields so the app can validate the recipient, populate its inbox, and open the intended tab:

```json
{
  "schemaVersion": "1",
  "id": "event-1001",
  "recipientId": "8305763637",
  "type": "charging_started",
  "title": "Charging started",
  "body": "Your charging session at cp001 has started.",
  "createdAt": "2026-09-17T10:30:00.000Z",
  "destination": "LIVE",
  "sessionId": "transaction-1001",
  "demo": "false"
}
```

`recipientId` must exactly match the signed-in user's account identifier. Supported destinations are `LIVE`, `SCHEDULE`, and `RECORDS`.

## Java backend next step

The backend needs an authenticated device-registration endpoint and Firebase Admin SDK sender:

```http
POST /api/users/me/push-tokens
Content-Type: application/json

{
  "token": "<native-fcm-token>",
  "platform": "android",
  "provider": "fcm"
}
```

Store tokens by authenticated user and device, update them when they rotate, and delete invalid tokens when Firebase reports that a registration token is no longer registered. The backend must derive the recipient from charger ownership and must not trust a user or charger ID supplied by the mobile client.

Mount the private key into the Java container, for example:

```yaml
services:
  citrine-live-data:
    volumes:
      - ./secrets/firebase-service-account.json:/run/secrets/firebase-service-account.json:ro
    environment:
      GOOGLE_APPLICATION_CREDENTIALS: /run/secrets/firebase-service-account.json
```

Never place the private service-account key in the APK, Expo configuration, notification payload, or source repository.
