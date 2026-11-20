import assert from 'node:assert/strict';
import test from 'node:test';
import { Expedition, level, rails, still, tileSize } from '../src/multiplayer/expedition.ts';

test('ten arrivals get eight unique seats, including the host, and a departing seat can be reused', () => {
  const room = new Expedition();
  assert.deepEqual(
    Array.from({ length: 10 }, () => room.add()),
    [1, 2, 3, 4, 5, 6, 7, 8, 0, 0],
  );
  room.remove(4);
  assert.equal(room.add(), 4);
  assert.equal(room.snapshot().players.length, 8);
  assert.equal(room.phase, 'waiting');
});

test('host simulates each explorer independently and stale or invalid inputs cannot keep moving a player', () => {
  const room = new Expedition();
  room.add();
  room.add();
  room.start();
  const host = room.players.get(1),
    guest = room.players.get(2);
  const hostX = host.x,
    start = guest.x;
  room.input(2, { ...still, forward: 1, yaw: Math.PI / 2 });
  room.step(0.05);
  assert.equal(host.x, hostX);
  assert.ok(guest.x > start);
  room.input(2, { ...still, side: 999, yaw: NaN });
  for (let n = 0; n < 14; n++) room.step(0.05);
  const stopped = guest.x;
  room.step(0.05);
  assert.equal(guest.x, stopped);
  assert.ok(Number.isFinite(guest.z));
  room.remove(2);
  assert.equal(room.add(), 2);
  assert.notEqual(room.players.get(2).x, stopped);
});

test('shared pickup is collected once, resolves concurrent use and opens the same exit for everyone', () => {
  const room = new Expedition();
  room.add();
  room.add();
  room.start();
  const door = level.objects.find((o) => o.kind === 'exit');
  const use = (slot, o) => {
    const p = room.players.get(slot);
    p.x = o.x * tileSize;
    p.z = o.z * tileSize;
    room.input(slot, { ...still, use: true });
  };
  use(2, door);
  room.step(0.05);
  assert.equal(room.phase, 'playing');
  for (const rail of rails) {
    use(1, rail);
    use(2, rail);
    room.step(0.05);
    assert.equal(room.collected.filter((id) => id === rail.id).length, 1);
  }
  use(2, door);
  room.step(0.05);
  assert.equal(room.snapshot().phase, 'escaped');
  room.start();
  assert.equal(room.round, 2);
  assert.equal(room.phase, 'playing');
  assert.deepEqual(room.collected, []);
});

test('the shared hunter can capture a guest, and the last explorer falling ends the round', () => {
  const room = new Expedition();
  room.add();
  room.add();
  room.start();
  for (let i = 0; i < 162; i++) room.step(0.05);
  function expose(slot) {
    for (let i = 0; i < 100 && room.players.get(slot).alive; i++) {
      const m = room.snapshot().monster;
      room.players.get(slot).x = m.x;
      room.players.get(slot).z = m.z;
      room.input(slot, { ...still, voice: 1 });
      room.step(0.05);
    }
  }
  expose(2);
  assert.equal(room.players.get(2).alive, false);
  assert.equal(room.phase, 'playing');
  expose(1);
  assert.equal(room.phase, 'lost');
});
