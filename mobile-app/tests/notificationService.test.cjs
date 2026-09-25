const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const events = require('../src/services/notifications/notificationEvents.ts');

// Exercise our native bridge without a device or additional test dependencies.
// Expo itself is mocked; real platform delivery still needs a development build.
const filename = path.join(__dirname, '../src/services/notifications/notificationService.ts');
const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

function createHarness(options = {}) {
  const calls = [];
  const listeners = {};
  let nativeLoads = 0;
  let handler = null;
  let permissions = options.permissions ?? { granted: true, canAskAgain: true };
  let presented = options.presented ?? [];
  let lastResponse = options.lastResponse ?? null;
  const addListener = (name, callback) => {
    listeners[name] = callback;
    return { remove: () => { calls.push(`remove:${name}`); delete listeners[name]; } };
  };
  const native = {
    AndroidImportance: { HIGH: 4 },
    IosAuthorizationStatus: { PROVISIONAL: 3 },
    SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
    DEFAULT_ACTION_IDENTIFIER: 'default',
    setNotificationChannelAsync: async (id) => { calls.push(['channel', id]); },
    getPermissionsAsync: async () => { calls.push('permissions'); return permissions; },
    requestPermissionsAsync: async () => {
      calls.push('requestPermission');
      permissions = { granted: true, canAskAgain: true };
      return permissions;
    },
    getDevicePushTokenAsync: async () => {
      calls.push('nativeTokenAcquisition');
      return { type: 'fcm', data: 'fcm-device-token' };
    },
    scheduleNotificationAsync: async (request) => { calls.push(['schedule', request]); return request.identifier; },
    setNotificationHandler: (nextHandler) => { handler = nextHandler; calls.push('handler'); },
    addNotificationReceivedListener: (callback) => addListener('received', callback),
    addNotificationResponseReceivedListener: (callback) => addListener('opened', callback),
    addPushTokenListener: (callback) => addListener('token', callback),
    getPresentedNotificationsAsync: async () => {
      calls.push('presented');
      if (options.trayError) throw new Error('Tray read failed');
      return presented;
    },
    getLastNotificationResponse: () => { calls.push('lastResponse'); return lastResponse; },
    clearLastNotificationResponse: () => { calls.push('clearResponse'); lastResponse = null; },
    getAllScheduledNotificationsAsync: async () => options.scheduled ?? [],
    cancelScheduledNotificationAsync: async (id) => { calls.push(['cancel', id]); },
    dismissNotificationAsync: async (id) => { calls.push(['dismiss', id]); },
  };
  const exports = {};
  const context = {
    exports,
    require: (name) => {
      if (name === 'expo-constants') return {
        __esModule: true,
        default: {
          executionEnvironment: options.environment ?? 'standalone',
          expoConfig: { extra: { eas: { projectId: options.missingProject ? undefined : 'test-project' } } },
        },
      };
      if (name === 'react-native') return { Platform: { OS: options.platform ?? 'android' } };
      if (name === './notificationEvents') return events;
      if (name === 'expo-notifications') { nativeLoads++; return native; }
      throw new Error(`Unexpected dependency: ${name}`);
    },
  };
  vm.runInNewContext(source, context, { filename });
  return {
    service: exports, calls, listeners,
    nativeLoads: () => nativeLoads,
    handler: () => handler,
    setPresented: (notifications) => { presented = notifications; },
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));
function nativeNotification(recipientId = 'resident-1') {
  const notification = events.createDemoNotification(recipientId);
  return { request: { identifier: notification.id, content: { data: events.toNotificationData(notification) } } };
}

test('web and Expo Go do not load or call native notification APIs', async () => {
  for (const options of [{ platform: 'web' }, { environment: 'storeClient' }]) {
    const harness = createHarness(options);
    assert.equal(harness.service.supportsDeviceNotifications(), false);
    assert.equal((await harness.service.registerForNotifications(true)).permission, 'unknown');
    assert.equal(await harness.service.scheduleTestNotification(events.createDemoNotification('resident-1')), null);
    const stop = harness.service.listenForNotifications('resident-1', () => {}, () => {}, () => {}, () => {});
    await flush();
    stop();
    assert.equal(harness.nativeLoads(), 0);
    assert.equal(harness.calls.length, 0);
  }
});

test('startup permission check never prompts or registers a denied device', async () => {
  const harness = createHarness({ permissions: { granted: false, canAskAgain: true } });
  assert.equal((await harness.service.registerForNotifications()).permission, 'unknown');
  assert.equal(harness.calls.includes('requestPermission'), false);
  assert.equal(harness.calls.includes('nativeTokenAcquisition'), false);
});

test('Android channel is created before the explicit permission request', async () => {
  const harness = createHarness({ permissions: { granted: false, canAskAgain: true } });
  const result = await harness.service.registerForNotifications(true);
  assert.equal(result.permission, 'granted');
  assert.equal(result.devicePushToken, 'fcm-device-token');
  assert.equal(result.devicePushTokenType, 'fcm');
  const channelIndex = harness.calls.findIndex((call) => Array.isArray(call) && call[0] === 'channel');
  assert.ok(channelIndex >= 0 && channelIndex < harness.calls.indexOf('requestPermission'));
});

test('permanently denied permission directs the user to settings without another prompt', async () => {
  const harness = createHarness({ permissions: { granted: false, canAskAgain: false } });
  const result = await harness.service.registerForNotifications(true);
  assert.equal(result.permission, 'denied');
  assert.match(result.message, /phone settings/);
  assert.equal(harness.calls.includes('requestPermission'), false);
});

test('iOS provisional authorization is accepted without requesting again', async () => {
  const harness = createHarness({ platform: 'ios', permissions: { granted: false, canAskAgain: true, ios: { status: 3 } } });
  assert.equal((await harness.service.registerForNotifications(true)).permission, 'granted');
  assert.equal(harness.calls.includes('requestPermission'), false);
  assert.equal(harness.calls.some((call) => Array.isArray(call) && call[0] === 'channel'), false);
});

test('iOS currently permits local tests without Android FCM registration', async () => {
  const harness = createHarness({ platform: 'ios' });
  const result = await harness.service.registerForNotifications();
  assert.equal(result.permission, 'granted');
  assert.equal(result.devicePushToken, undefined);
  assert.equal(harness.calls.includes('nativeTokenAcquisition'), false);
});

test('rotated native token is forwarded instead of reacquired in the token callback', async () => {
  const harness = createHarness();
  const rotatedToken = { type: 'android', data: 'rotated-native-token' };
  let result;
  const stop = harness.service.listenForNotifications('resident-1', () => {}, () => {}, async (token) => {
    result = await harness.service.registerForNotifications(false, token);
  }, () => {});
  await flush();
  harness.listeners.token(rotatedToken);
  await flush();
  assert.equal(result.permission, 'granted');
  assert.equal(result.devicePushToken, rotatedToken.data);
  assert.equal(result.devicePushTokenType, rotatedToken.type);
  assert.equal(harness.calls.includes('nativeTokenAcquisition'), false);
  stop();
});

test('test notification uses an OS trigger with the validated recipient payload', async () => {
  const harness = createHarness();
  const notification = events.createDemoNotification('resident-1');
  assert.equal(await harness.service.scheduleTestNotification(notification), notification.id);
  const request = harness.calls.find((call) => Array.isArray(call) && call[0] === 'schedule')[1];
  assert.equal(request.trigger.seconds, 10);
  assert.equal(request.trigger.repeats, false);
  assert.equal(request.trigger.channelId, harness.service.CHARGING_CHANNEL_ID);
  assert.equal(request.content.data.recipientId, 'resident-1');
  assert.equal(request.content.data.demo, true);
  assert.equal(request.content.data.schemaVersion, 1);
});

test('listeners and foreground presentation accept only the current account', async () => {
  const own = nativeNotification();
  const other = nativeNotification('resident-2');
  const harness = createHarness({ presented: [own, other] });
  const received = [];
  const opened = [];
  const stop = harness.service.listenForNotifications('resident-1', (item) => received.push(item), (item) => opened.push(item), () => {}, () => {});
  await flush();
  assert.equal(received.length, 1);
  assert.equal(received[0].recipientId, 'resident-1');
  assert.equal((await harness.handler().handleNotification(own)).shouldShowBanner, true);
  assert.equal((await harness.handler().handleNotification(other)).shouldShowBanner, false);
  harness.listeners.received(other);
  harness.listeners.opened({ actionIdentifier: 'default', notification: other });
  assert.equal(received.length, 1);
  assert.equal(opened.length, 0);
  harness.listeners.opened({ actionIdentifier: 'default', notification: own });
  assert.equal(opened[0].read, true);
  stop();
  assert.equal(harness.handler(), null);
  assert.deepEqual(Object.keys(harness.listeners), []);
});

test('cold-start tap is consumed even if tray recovery fails', async () => {
  const own = nativeNotification();
  const harness = createHarness({ lastResponse: { actionIdentifier: 'default', notification: own }, trayError: true });
  const opened = [];
  let errors = 0;
  const stop = harness.service.listenForNotifications('resident-1', () => {}, (item) => opened.push(item), () => {}, () => { errors++; });
  await flush();
  assert.equal(opened.length, 1);
  assert.equal(opened[0].id, own.request.identifier);
  assert.equal(opened[0].read, true);
  assert.ok(harness.calls.includes('clearResponse'));
  assert.equal(errors, 1);
  stop();
});

test('disposing before async setup finishes prevents handlers and subscriptions from leaking', async () => {
  const harness = createHarness();
  let delivered = 0;
  const stop = harness.service.listenForNotifications('resident-1', () => { delivered++; }, () => { delivered++; }, () => {}, () => {});
  stop();
  await flush();
  assert.equal(delivered, 0);
  assert.equal(harness.handler(), null);
  assert.deepEqual(Object.keys(harness.listeners), []);
});

test('foreground tray sync recovers a background delivery without remounting listeners', async () => {
  const harness = createHarness();
  const received = [];
  const receive = (item) => received.push(item);
  const stop = harness.service.listenForNotifications('resident-1', receive, () => {}, () => {}, () => {});
  await flush();
  const own = nativeNotification();
  harness.setPresented([own, nativeNotification('resident-2')]);
  await harness.service.syncPresentedNotifications('resident-1', receive);
  assert.equal(received.length, 1);
  assert.equal(received[0].id, own.request.identifier);
  assert.equal(received[0].read, false);
  stop();
});

test('sign-out cleanup cancels and dismisses only notifications for that account', async () => {
  const own = nativeNotification();
  const other = nativeNotification('resident-2');
  const harness = createHarness({ presented: [own, other], scheduled: [own.request, other.request] });
  await harness.service.clearAccountDeviceNotifications('resident-1');
  assert.deepEqual(harness.calls.filter((call) => Array.isArray(call)), [
    ['cancel', own.request.identifier], ['dismiss', own.request.identifier],
  ]);
});
