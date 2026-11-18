import test from 'node:test';
import assert from 'node:assert/strict';

test('campaign saves survive stale writers, resets, legacy data and denied writes', async () => {
  const tab = id => import('../src/game-state.ts?tab=' + id);
  const first = await tab(1), second = await tab(2);
  let raw = JSON.stringify(first.freshProgress('lobby'));
  let denied = false;
  const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let queue = Promise.resolve();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: (_key, action) => (queue = queue.then(action))
  }});
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => raw,
    setItem: (_key, value) => { if (denied) throw Error('Quota exceeded'); raw = value; }
  }});
  try {
    const old = first.loadProgress(), newer = second.loadProgress();
    newer.stage = 'bunker';
    newer.endings.push('wrong');
    assert.deepEqual(await Promise.all([second.storeProgress(newer), first.storeProgress(old)]), ['saved', 'stale']);
    assert.deepEqual(first.loadProgress().endings, ['wrong']);
    const pendingExit = first.storeProgress(old);
    assert.equal(first.loadProgress().stage, 'bunker');
    await pendingExit;
    assert.equal(await first.storeProgress(first.freshProgress('lobby')), 'saved');
    assert.equal(await second.storeProgress(newer), 'stale');
    const live = first.loadProgress();
    denied = true;
    live.stage = 'hotel';
    assert.equal(await first.storeProgress(live), 'unavailable');
    assert.equal(first.loadProgress().stage, 'hotel');
    assert.equal(JSON.parse(raw).stage, 'lobby');
  } finally {
    delete navigator.locks;
    delete globalThis.localStorage;
    if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks);
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  }
});
