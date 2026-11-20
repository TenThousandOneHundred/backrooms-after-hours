import assert from 'node:assert/strict';
import test from 'node:test';
import { Expedition } from '../src/multiplayer/expedition.ts';
import { freshProgress, loadProgress } from '../src/game-state.ts';

const down = (room, slot, spawnId = room.players.get(slot).spawnId) =>
  room.command(slot, room.epoch, { type: 'down', cause: 'You fell.', spawnId });
const tickRespawn = room => { for (let i = 0; i < 52; i++) room.step(.05); };

test('each explorer gets the selected number of lives, including their current life', () => {
  for (const [difficulty, count] of [['easy', 5], ['medium', 3], ['hard', 1]]) {
    const room = new Expedition();
    room.add();
    room.setDifficulty(difficulty);
    room.add();
    room.start();
    for (let left = count - 1; left >= 0; left--) {
      const oldSpawn = room.players.get(2).spawnId;
      down(room, 2);
      down(room, 2);
      assert.equal(room.players.get(2).alive, false);
      assert.equal(room.players.get(2).lives, left);
      assert.equal(room.players.get(1).lives, count);
      tickRespawn(room);
      assert.equal(room.players.get(2).alive, left > 0);
      down(room, 2, oldSpawn);
      assert.equal(room.players.get(2).lives, left);
    }
    assert.equal(room.phase, 'playing');
    room.journal.pending = { ending: 'wrong', target: 'bunker' };
    room.command(1, room.epoch, { type: 'continue' });
    assert.ok([...room.players.values()].every(p => p.alive && p.lives === count));
  }
});

test('when the whole team is down, reserves allow respawns and exhaustion allows a level retry', () => {
  const room = new Expedition();
  room.add();
  room.add();
  room.start();
  room.journal.flags.push('rail1');
  for (let i = 0; i < 3; i++) {
    down(room, 1);
    down(room, 2);
    assert.equal(room.phase, i === 2 ? 'lost' : 'playing');
    tickRespawn(room);
  }
  room.start();
  assert.deepEqual(room.journal.flags, ['rail1']);
  assert.ok([...room.players.values()].every(p => p.alive && p.lives === 3));
});

test('saved and rejoining guests recover their own lives even when assigned a different slot', () => {
  const id = crypto.randomUUID();
  const room = new Expedition();
  room.add();
  room.setDifficulty('easy');
  room.add(id);
  room.start();
  down(room, 2);
  room.remove(2);
  assert.equal(room.add(), 2);
  assert.equal(room.add(id), 3);
  assert.equal(room.players.get(3).lives, 4);
  assert.equal(room.players.get(2).lives, 5);
  const restored = new Expedition();
  restored.add();
  restored.add(id);
  restored.start(structuredClone(room.journal));
  assert.equal(restored.players.get(2).lives, 4);
  assert.equal(restored.journal.difficulty, 'easy');
});

test('legacy saves default to Medium and stored lives cannot exceed the selected allocation', () => {
  const saved = freshProgress('lobby');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => JSON.stringify(saved) } });
  try {
    delete saved.difficulty;
    delete saved.lives;
    assert.equal(loadProgress().difficulty, 'medium');
    assert.equal(loadProgress().lives, 3);
    Object.assign(saved, { difficulty: 'hard', lives: 5 });
    assert.equal(loadProgress().lives, 1);
    saved.lives = 0;
    assert.equal(loadProgress().lives, 0);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
