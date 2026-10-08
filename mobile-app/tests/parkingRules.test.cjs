const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const r = require('../src/features/parking/parkingRules.ts');
const car = { id: 'car', name: 'Test car', connectorType: 'CCS2', type: '4W', batteryCapacityKwh: 40 };
const scooter = { ...car, id: 'scooter', type: '2W', connectorType: '15A Socket', batteryCapacityKwh: 4 };
const now = Date.now();
test('15 bays, compatible recommendations, offline excluded, duration from energy', () => {
  assert.equal(r.BAYS.length, 15);
  const offers = r.recommend(r.initialParking(now), scooter, 2, now);
  assert.ok(offers.every(o => r.BAYS.find(b => b.id === o.bayId).connector === '15A Socket'));
  assert.equal(offers[0].endsAt - offers[0].startsAt, 2 * 3600000);
  assert.ok(!r.recommend(r.initialParking(now), car, 10, now).some(o => o.bayId === 'P09'));
  for (const value of [0, -1, NaN, Infinity, 5]) assert.equal(r.recommend(r.initialParking(now), scooter, value, now).length, 0);
});
test('expiry of charging estimate never automatically makes an occupied bay ready', () => {
  const state = r.initialParking(now);
  const a = { id: 'a', bayId: 'P12', status: 'RESERVED', startsAt: now, endsAt: now + 3600000 };
  assert.equal(r.isReady(a, state, now + 3600000), false);
  state.occupied = state.occupied.filter(o => o.bayId !== 'P12');
  assert.equal(r.isReady(a, state, now + 3600000), true);
});
test('recommendation preserves duration and fits between reservations with turnover buffer', () => {
  const state = { version: 1, occupied: [], allocations: [{ id: 'a', bayId: 'P01', status: 'RESERVED', startsAt: now, endsAt: now + 3600000 }] };
  const offer = r.recommend(state, car, 7.2, now).find(o => o.bayId === 'P01');
  assert.equal(offer.startsAt, now + 65 * 60000);
  assert.equal(offer.endsAt - offer.startsAt, 3600000);
});
test('local repository serializes conflicts, enforces ownership, cancellation and physical vacancy', async () => {
  const memory = new Map(); const load = Module._load;
  Module._load = function(name, ...args) {
    if (name === '@react-native-async-storage/async-storage') return { __esModule: true, default: {
      getItem: async key => memory.get(key) ?? null, setItem: async (key, value) => { memory.set(key, value); },
    }};
    return load.call(this, name, ...args);
  };
  const { parkingRepository: repo } = require('../src/features/parking/parkingRepository.ts'); Module._load = load;
  let state = await repo.load(); const offer = r.recommend(state, scooter, 2, Date.now())[0];
  const results = await Promise.allSettled([repo.reserve('one', scooter, 2, offer), repo.reserve('two', scooter, 2, offer)]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  const a = results[0].value;
  await assert.rejects(repo.update(a.id, 'two', 'CANCEL'));
  await repo.update(a.id, 'one', 'CANCEL');
  state = await repo.load(); assert.equal(r.bayStatus(r.BAYS.find(b => b.id === a.bayId), state, Date.now()), 'Available');
  const b = await repo.reserve('one', scooter, 2, r.recommend(state, scooter, 2, Date.now())[0]);
  await repo.update(b.id, 'one', 'ARRIVE');
  await assert.rejects(repo.update(b.id, 'one', 'CANCEL'));
  await repo.update(b.id, 'one', 'VACATE');
  state = await repo.load(); assert.equal(state.allocations.find(a => a.id === b.id).status, 'COMPLETED');
  const future = r.recommend(state, scooter, 1, Date.now()).find(o => o.bayId === 'P12');
  const waiting = await repo.reserve('one', scooter, 1, future);
  await repo.demoBay('P12', 'DELAY');
  state = await repo.load();
  const revised = r.recommend(state, scooter, 1, Date.now(), waiting.id);
  assert.ok(revised.find(o => o.bayId === 'P12').startsAt > waiting.startsAt);
  assert.notEqual(revised[0].bayId, 'P12');
  await assert.rejects(repo.reserve('one', scooter, 1, future, waiting.id));
  const switched = await repo.reserve('one', scooter, 1, revised[0], waiting.id);
  state = await repo.load();
  assert.equal(state.allocations.find(a => a.id === waiting.id).status, 'CANCELLED');
  assert.equal(state.allocations.find(a => a.id === switched.id).status, 'RESERVED');
});
