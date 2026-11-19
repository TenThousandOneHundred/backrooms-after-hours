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

test('mods and the campaign keep independent saves during concurrent and failed writes', async () => {
  const { loadProgress, storeProgress, freshProgress } = await import('../src/game-state.ts?tab=mods');
  const slots = new Map();
  const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const modSlot = 'backrooms-after-hours.mod.v1.example';
  let denied = false;
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: (_key, action) => Promise.resolve().then(action)
  }});
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => slots.get(key) ?? null,
    setItem: (key, value) => { if (denied) throw Error('Quota exceeded'); slots.set(key, value); }
  }});
  try {
    const campaign = freshProgress('lobby'), mod = freshProgress('mod-1');
    const writes = [storeProgress(campaign), storeProgress(mod, modSlot)];
    assert.equal(loadProgress().stage, 'lobby');
    assert.equal(loadProgress(modSlot).stage, 'mod-1');
    assert.deepEqual(await Promise.all(writes), ['saved', 'saved']);
    denied = true;
    mod.stage = 'mod-2';
    assert.equal(await storeProgress(mod, modSlot), 'unavailable');
    assert.equal(loadProgress(modSlot).stage, 'mod-2');
    assert.equal(loadProgress().stage, 'lobby');
    assert.equal(loadProgress(modSlot + '-other'), null);
  } finally {
    delete navigator.locks;
    delete globalThis.localStorage;
    if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks);
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  }
});
