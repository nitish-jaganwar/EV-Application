const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

// Run the pure TypeScript rules with Node's built-in test runner, without a UI test dependency.
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(compiled.outputText, filename);
};

const rules = require('../src/features/booking/bookingRules.ts');

test('back-to-back bookings do not overlap, but intersecting bookings do', () => {
  assert.equal(rules.overlaps('2030-01-01T10:00:00Z', '2030-01-01T11:00:00Z',
    '2030-01-01T11:00:00Z', '2030-01-01T12:00:00Z'), false);
  assert.equal(rules.overlaps('2030-01-01T10:00:00Z', '2030-01-01T11:00:00Z',
    '2030-01-01T10:30:00Z', '2030-01-01T11:30:00Z'), true);
});

test('only matching connector types are suggested', () => {
  assert.equal(rules.isCompatible('15A Socket', 'CCS2'), false);
  assert.equal(rules.isCompatible('15A Socket', '15A Socket'), true);
  assert.equal(rules.isCompatible('CCS2', 'Type 2'), true);
});

test('suggestions start after a reserved slot and keep the requested duration', () => {
  const day = '2030-01-01';
  const blocked = [{
    id: 'b', apartmentId: 'tower-a', chargerId: 'C0', vehicleId: 'other',
    vehicleConnectorType: 'Type 2', ownerId: 'other', status: 'CONFIRMED',
    startsAt: rules.atLocalTime(day, 10 * 60).toISOString(),
    endsAt: rules.atLocalTime(day, 11 * 60).toISOString(),
  }];
  const preferred = rules.atLocalTime(day, 10 * 60);
  const suggestions = rules.alternatives({ id: 'C0', connectorType: 'Type 2', ratedPowerKw: 7.4 },
    preferred, 60, blocked, rules.atLocalTime(day, 9 * 60));
  assert.equal(suggestions[0].getTime(), rules.atLocalTime(day, 11 * 60).getTime());
});

test('date strip rolls over the month and walk-in does not start in the past', () => {
  assert.deepEqual(rules.dateOptions(new Date(2030, 0, 31)).slice(0, 2), ['2030-01-31', '2030-02-01']);
  assert.equal(rules.nextWalkInStart(new Date(2030, 0, 1, 9, 1)).getMinutes(), 15);
  assert.equal(rules.nextWalkInStart(new Date(2030, 0, 1, 22, 59)), null);
});

test('booking options and walk-in suggestions use 15-minute steps', () => {
  const now = rules.atLocalTime('2030-01-01', 9 * 60 + 2);
  const options = rules.timeOptions('2030-01-01', 60, now);
  assert.equal(options[0].getMinutes(), 15);
  assert.equal(options[1].getMinutes(), 30);
  assert.equal(rules.nextWalkInStart(now).getTime(), options[0].getTime());
});

test('local repository rejects a second reservation and frees the slot after cancellation', async () => {
  const values = new Map();
  const storage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
  };
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === '@react-native-async-storage/async-storage') return storage;
    return originalLoad.call(this, request, parent, isMain);
  };
  let repository;
  try {
    repository = require('../src/features/booking/localBookingRepository.ts').localBookingRepository;
  } finally {
    Module._load = originalLoad;
  }
  const day = rules.dateOptions()[1];
  const request = {
    apartmentId: 'tower-a', chargerId: 'C3', vehicleId: 'v1',
    vehicleConnectorType: 'Type 2', ownerId: 'resident-1',
    startsAt: rules.atLocalTime(day, 12 * 60).toISOString(),
    endsAt: rules.atLocalTime(day, 13 * 60).toISOString(),
  };
  const first = await repository.reserve(request);
  await assert.rejects(repository.reserve({ ...request, ownerId: 'resident-2' }), /slot was just taken/i);
  await repository.cancel(first.id, 'resident-1');
  const second = await repository.reserve({ ...request, ownerId: 'resident-2' });
  assert.equal(second.status, 'CONFIRMED');
  const firstOwnerHistory = await repository.listForOwner('resident-1');
  assert.equal(firstOwnerHistory.length, 1);
  assert.equal(firstOwnerHistory[0].status, 'CANCELLED');
});
