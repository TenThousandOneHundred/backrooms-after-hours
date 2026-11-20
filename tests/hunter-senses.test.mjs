import test from 'node:test';
import assert from 'node:assert/strict';
import { Encounter, TILE } from '../src/game-entity.ts';
import { Expedition } from '../src/multiplayer/expedition.ts';
import { freshProgress } from '../src/game-state.ts';

const map = ['############', '#..........#', '#.########.#', '#..........#', '############'];
const still = { moving: false, sprint: false, crouch: false, hidden: false, light: false, voice: 0 };
function bacteria() {
  const e = new Encounter({ map, threat: { kind: 'bacteria', x: 2, z: 1 } }, TILE);
  e.angle = Math.PI / 2;
  return e;
}

test('Bacteria can see a quiet explorer nearby in front, and crouching reduces that range', () => {
  const e = bacteria();
  assert.ok(e.perceive(3.5, 1, still).seen);
  for (const [x, z, cues] of [[3.5, 1, { ...still, crouch: true }], [1, 1, still], [7, 1, still]]) {
    const contact = e.perceive(x, z, cues);
    assert.ok(!contact.seen && !contact.heardSteps && !contact.heardVoice);
  }
});

test('sprinting carries farther than walking, crouching quiets footsteps, and walls muffle them', () => {
  const e = bacteria();
  const walk = { ...still, moving: true };
  const sprint = { ...walk, sprint: true };
  assert.ok(e.perceive(8, 1, sprint).heardSteps);
  assert.equal(e.perceive(8, 1, walk).heardSteps, false);
  assert.ok(e.perceive(5, 1, walk).heardSteps);
  assert.equal(e.perceive(5, 1, { ...walk, crouch: true }).heardSteps, false);
  assert.equal(e.perceive(8, 3, sprint).heardSteps, false);
  assert.ok(e.perceive(3, 3, sprint).heardSteps);
});

test('host chooses a running explorer over a nearer silent explorer outside the sight cone', () => {
  const room = new Expedition();
  room.add();
  room.add();
  room.start(freshProgress('slides2'));
  room.step(8.1);
  // On slides2 the Bacteria starts at (17, 3) facing south.
  for (const [slot, x, z, moving] of [[1, 17, 2, false], [2, 12, 3, true]]) {
    const pose = { ...room.players.get(slot), x: x * TILE, z: z * TILE, moving, sprint: moving };
    room.command(slot, room.epoch, { type: 'pose', pose });
  }
  const before = room.snapshot().monsters[0];
  room.step(0.05);
  const hunter = room.snapshot().monsters[0];
  assert.equal(hunter.target, 2);
  assert.ok(hunter.x < before.x);
});
