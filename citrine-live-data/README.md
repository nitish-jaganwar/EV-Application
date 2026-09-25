# Citrine live-data backend POC

Java 17/Jersey service between CitrineOS and the tBits Plug app. It receives
CitrineOS webhooks, normalizes OCPP telemetry, keeps the latest charger state,
stores a small in-memory notification history, and sends Android push messages
through Firebase Cloud Messaging (FCM).

## Included behavior

- OCPP 2.x `Heartbeat`, `StatusNotification`, and `TransactionEvent`
- OCPP 1.6 `MeterValues`
- voltage, current, power, cumulative/session energy, SoC when actually reported
- frequency, applied current limit, and temperature with C/F/K conversion
- online/offline state and bounded raw event history
- POC charger ownership (`cp001 -> 8305763637` by default)
- FCM device-token registration without returning stored token values
- push events for charging started, paused, resumed, ended, charger offline, and fault
- in-app notification history and read state

The service deliberately does not infer battery percentage or “fully charged”
from `SuspendedEV`. Those values remain unknown until the charger/vehicle reports SoC.

## Firebase credential placement

Never copy the Firebase Admin JSON into the mobile application or commit it.
On the VM create a private directory and copy your downloaded Admin JSON there:

```bash
cd /root/citrine-live-data
mkdir -p secrets
chmod 700 secrets
# Copy/rename the private key to:
# /root/citrine-live-data/secrets/firebase-service-account.json
chmod 600 secrets/firebase-service-account.json
```

Compose mounts that file read-only at
`/run/secrets/firebase-service-account.json`. Google Application Default
Credentials reads the path from `GOOGLE_APPLICATION_CREDENTIALS`.

## Build and run

```bash
cd /root/citrine-live-data
docker compose build
docker compose up -d
docker logs -f citrine-live-data
```

The Compose file expects the existing external Docker network `citrineos`.
CitrineOS continues to post to:

```text
http://citrine-live-data:9100/api/ocpp-events
```

## POC configuration

```yaml
FIREBASE_ENABLED: "true"
FIREBASE_PROJECT_ID: "ev-test-001"
GOOGLE_APPLICATION_CREDENTIALS: /run/secrets/firebase-service-account.json
POC_CHARGER_OWNERSHIP: "cp001:8305763637"
```

Multiple ownership entries use commas:

```text
cp001:8305763637,cp002:resident-2
```

`X-Resident-Id` is a temporary POC identity header. It proves the ownership
flow but is not secure authentication. Replace it with a verified JWT/user ID
before production.

## API URLs

Existing telemetry:

```text
GET  /api/health
POST /api/ocpp-events
GET  /api/chargers
GET  /api/chargers/{chargerId}
GET  /api/chargers/{chargerId}/events
GET  /api/chargers/{chargerId}/events/latest
```

Push and notification APIs (send `X-Resident-Id: 8305763637`):

```text
POST   /api/users/me/push-tokens
GET    /api/users/me/push-tokens
DELETE /api/users/me/push-tokens/{registrationId}
GET    /api/users/me/notifications
PATCH  /api/users/me/notifications/{notificationId}/read
POST   /api/users/me/notifications/read-all
POST   /api/users/me/notifications/test
```

## Register the phone FCM token

The app must send the native FCM token returned by
`Notifications.getDevicePushTokenAsync()`. Do not send an Expo token.

```bash
curl -X POST http://localhost:9100/api/users/me/push-tokens \
  -H 'Content-Type: application/json' \
  -H 'X-Resident-Id: 8305763637' \
  -d '{
    "token":"PASTE_ANDROID_FCM_TOKEN",
    "platform":"android",
    "provider":"fcm",
    "deviceId":"nitish-test-phone"
  }'
```

Send a test notification:

```bash
curl -X POST http://localhost:9100/api/users/me/notifications/test \
  -H 'X-Resident-Id: 8305763637'
```

Read notification history:

```bash
curl http://localhost:9100/api/users/me/notifications \
  -H 'X-Resident-Id: 8305763637'
```

## POC limitations

Charger state, device tokens, and notifications are kept in memory and reset
when the container restarts. Production should store them in PostgreSQL, use
verified authentication, protect the webhook with a secret or private network,
and add multi-instance event deduplication.
