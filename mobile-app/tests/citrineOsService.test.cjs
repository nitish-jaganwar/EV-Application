const assert = require('node:assert/strict');
const { test } = require('node:test');

// Node's built-in TypeScript support keeps these pure service tests dependency-free.
const {
  MOCK_METER_VALUES_EVENT,
  MOCK_STATUS_EVENT,
  normalizeChargerTelemetry,
  resolveChargerStatus,
} = require('../src/services/citrineOsService.ts');

const sampleTelemetry = normalizeChargerTelemetry(MOCK_METER_VALUES_EVENT, MOCK_STATUS_EVENT);

test('newer sample power reconciles the older Available status without mutating either event', () => {
  const telemetry = Object.freeze({ ...sampleTelemetry });

  assert.equal(telemetry.totalPowerW, 10710);
  assert.deepEqual(resolveChargerStatus(telemetry), { status: 'Charging', source: 'meter' });
  assert.equal(telemetry.chargerStatus, 'Available');
  assert.equal(MOCK_STATUS_EVENT.status, 'Available');
});

test('newer or simultaneous status reports override earlier high power', () => {
  for (const chargerStatusTimestamp of [
    sampleTelemetry.meterTimestamp,
    '2026-09-06T00:17:13.000Z',
  ]) {
    assert.deepEqual(
      resolveChargerStatus({ ...sampleTelemetry, chargerStatusTimestamp }),
      { status: 'Available', source: 'status' },
    );
  }
});

test('standby, missing, negative and non-finite power never infer charging', () => {
  for (const totalPowerW of [undefined, 0, 0.1, 99, 100, -50, NaN, Infinity, -Infinity]) {
    assert.deepEqual(
      resolveChargerStatus({ ...sampleTelemetry, totalPowerW }),
      { status: 'Available', source: 'status' },
      `power: ${totalPowerW}`,
    );
  }

  assert.deepEqual(
    resolveChargerStatus({ ...sampleTelemetry, totalPowerW: 100.01 }),
    { status: 'Charging', source: 'meter' },
  );
});

test('both event timestamps must be valid before power can imply a state', () => {
  for (const field of ['meterTimestamp', 'chargerStatusTimestamp']) {
    for (const timestamp of ['', 'not-a-date', '2026-99-99T99:99:99Z']) {
      assert.deepEqual(
        resolveChargerStatus({ ...sampleTelemetry, [field]: timestamp }),
        { status: 'Available', source: 'status' },
        `${field}: ${timestamp}`,
      );
    }
  }
});

test('faults, errors, unavailable and finishing states are never hidden by newer power', () => {
  for (const chargerStatus of ['Faulted', 'Unavailable', 'Finishing']) {
    assert.deepEqual(
      resolveChargerStatus({ ...sampleTelemetry, chargerStatus }),
      { status: chargerStatus, source: 'status' },
    );
  }

  assert.deepEqual(
    resolveChargerStatus({ ...sampleTelemetry, chargerErrorCode: 'OverCurrentFailure' }),
    { status: 'Available', source: 'status' },
  );
});

test('a suspension is preserved until newer meaningful power indicates resumed delivery', () => {
  for (const chargerStatus of ['SuspendedEV', 'SuspendedEVSE']) {
    assert.deepEqual(
      resolveChargerStatus({ ...sampleTelemetry, chargerStatus, totalPowerW: 0 }),
      { status: chargerStatus, source: 'status' },
    );
    assert.deepEqual(
      resolveChargerStatus({ ...sampleTelemetry, chargerStatus }),
      { status: 'Charging', source: 'meter' },
    );
    assert.deepEqual(
      resolveChargerStatus({
        ...sampleTelemetry,
        chargerStatus,
        chargerStatusTimestamp: '2026-09-06T00:17:13.000Z',
      }),
      { status: chargerStatus, source: 'status' },
    );
  }
});

test('zero or missing power never turns an explicitly charging connector into Available', () => {
  for (const totalPowerW of [undefined, 0, 10710]) {
    assert.deepEqual(
      resolveChargerStatus({ ...sampleTelemetry, chargerStatus: 'Charging', totalPowerW }),
      { status: 'Charging', source: 'status' },
    );
  }
});

test('telemetry cannot combine readings with the status of another connector', () => {
  assert.throws(
    () => normalizeChargerTelemetry(MOCK_METER_VALUES_EVENT, { ...MOCK_STATUS_EVENT, connectorId: 2 }),
    /same connector/,
  );
});
