const { test } = require('node:test');
const assert = require('node:assert/strict');

const storage = new Map();
global.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
};
global.window = new EventTarget();
window.location = { pathname: '/dashboard' };

const setUser = user => localStorage.setItem('userData', JSON.stringify(user));

test('a matching division must not grant an RFO access to another range', async () => {
  const { matchesUserHierarchy } = await import('../Web/utils/authUtils.js');
  setUser({ cadre: 'RFO', division: 'North SF', range: 'Range A' });
  assert.equal(matchesUserHierarchy({ division: 'North SF', range: 'Range B' }), false);
  assert.equal(matchesUserHierarchy({ division: 'north_sf', range: 'range_a' }), true);
});

test('an assigned beat must not fall back to division when record hierarchy is missing', async () => {
  const { matchesUserHierarchy } = await import('../Web/utils/authUtils.js');
  setUser({ cadre: 'Beat Guard', division: 'North SF', range: 'Range A', beat: 'Beat A' });
  assert.equal(matchesUserHierarchy({ division: 'North SF' }), false);
});

test('shared division words must not match unrelated divisions', async () => {
  const { matchesUserHierarchy } = await import('../Web/utils/authUtils.js');
  setUser({ cadre: 'DCF', division: 'North Forest Division' });
  assert.equal(matchesUserHierarchy({ division: 'South Forest Division' }), false);
});

test('API GET deduplication resolves both callers without a self-referencing promise', { timeout: 2000 }, async () => {
  const { default: apiClient } = await import('../Web/utils/apiClient.js');
  localStorage.setItem('token', 'test-token');
  let calls = 0;
  const adapter = async config => {
    calls += 1;
    return { data: [1], status: 200, statusText: 'OK', headers: {}, config };
  };
  const [first, second] = await Promise.all([
    apiClient.get('/api/regression-dedup', { adapter }),
    apiClient.get('/api/regression-dedup', { adapter }),
  ]);
  assert.deepEqual(first.data, [1]);
  assert.deepEqual(second.data, [1]);
  assert.equal(calls, 1);
});
