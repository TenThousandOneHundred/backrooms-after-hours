import test from 'node:test';
import assert from 'node:assert/strict';
import { covers, closets, ClosetDoors, coverZone, coverBlocksSight } from '../src/concourse-cover.ts';
import { canStandAt, clearSight, Encounter, TILE } from '../src/game-entity.ts';
import { stages } from '../src/campaign.ts';
import { Expedition } from '../src/multiplayer/expedition.ts';

const lobby = stages.lobby;
test('each shaft and machine has a two-ended, crouch-height passage', () => {
  for (const s of covers.filter((s) => s.kind === 'duct' || s.kind === 'machine')) {
    const half = s.kind === 'machine' ? 3.75 : (s.parts[0].z1 - s.parts[0].z0) / 2;
    for (let dz = -half - 0.55; dz < half + 0.55; dz += 0.11)
      assert.ok(canStandAt(lobby, s.x, s.z + dz, true), s.kind + ' passage');
    for (const dir of [-1, 1]) {
      assert.ok(canStandAt(lobby, s.x, s.z + dir * (half + 0.6)));
      assert.equal(canStandAt(lobby, s.x, s.z + dir * (half - 0.1)), false);
    }
    assert.ok(!canStandAt(lobby, s.x + 1.2, s.z, true));
    assert.equal(coverZone(s.x, s.z, true, []), s.kind);
    assert.equal(coverZone(s.x, s.z + half + 1, true, []), undefined);
  }
});
test('a cubicle hides a crouched head behind its screen but leaves the aisle-facing opening exposed', () => {
  const s = covers.find((s) => s.kind === 'cubicle'),
    x = s.x / TILE,
    z = s.z / TILE;
  assert.ok(clearSight(lobby, x, z - 3 / TILE, x, z, 1.58, 1.58));
  assert.equal(clearSight(lobby, x, z - 3 / TILE, x, z, 1.58, 0.97), false);
  assert.ok(clearSight(lobby, x, z + 2 / TILE, x, z, 1.58, 0.97));
  assert.equal(canStandAt(lobby, s.x, s.z - 1.4, true), false);
});
test('an alcove return wall blocks sight and leaves a walkable path to the rear recess', () => {
  const s = covers.find((s) => s.kind === 'alcove');
  assert.ok(coverBlocksSight(s.x, 1.6, s.z + 4, s.x, 1.6, s.z, []));
  for (let z = 5; z >= 0; z -= 0.08) assert.ok(canStandAt(lobby, s.x + 1.55, s.z + z));
  assert.equal(coverZone(s.x, s.z, false, []), 'alcove');
});
test('closet collision, visibility and cover follow the sliding panel and a player stops it closing', () => {
  const s = closets[0],
    d = new ClosetDoors(),
    x = s.x + 0.81,
    z = s.z + 1.63;
  assert.equal(canStandAt(lobby, x, z, false, 0, d.travel), false);
  assert.ok(coverBlocksSight(x, 1.58, z + 1, x, 1.58, z - 1, d.travel));
  assert.equal(coverZone(x, s.z, false, d.travel), 'closet');
  d.open = 1;
  d.step(1, []);
  assert.ok(canStandAt(lobby, x, z, false, 0, d.travel));
  assert.equal(coverBlocksSight(x, 1.58, z + 1, x, 1.58, z - 1, d.travel), false);
  assert.equal(coverZone(x, s.z, false, d.travel), undefined);
  d.open = 0;
  for (let i = 0; i < 30; i++) d.step(0.05, [{ x, z }]);
  assert.equal(d.travel[0], 1);
  d.open = 0;
  d.step(1, []);
  assert.equal(d.travel[0], 0);
  d.restore(0, { x, z });
  assert.ok(canStandAt(lobby, x, z, false, 0, d.travel));
  d.restore(0, { x, z: s.z });
  assert.equal(d.travel[0], 0);
});
test('a hunter loses visual contact in a duct but can still hear a nearby voice', () => {
  const s = covers.find((s) => s.kind === 'duct'),
    x = s.x / TILE,
    z = (s.parts[0].z0 + 1.4) / TILE;
  const ai = new Encounter(lobby, TILE);
  ai.x = x;
  ai.z = z - 0.65;
  ai.angle = 0;
  ai.tick(0.05, x, z, true, true, false, false, true, false, true, 0, undefined, 0);
  assert.equal(ai.danger, 0);
  assert.equal(ai.contact, false);
  ai.tick(0.05, x, z, true, true, false, false, true, false, true, 0, undefined, 1);
  assert.equal(ai.heardVoice, true);
});
test('host accepts nearby door pulls, synchronizes travel, and checks posture inside the shaft', () => {
  const r = new Expedition();
  r.add();
  const slot = r.add();
  r.start();
  const s = closets[0],
    g = r.players.get(slot);
  const pose = (x, z, crouch) => r.command(slot, r.epoch, { type: 'pose', pose: { ...g, x, z, crouch } });
  const open = () => r.command(slot, r.epoch, { type: 'closet', id: 0, open: true });
  open();
  assert.equal(r.snapshot().closets.open, 0);
  pose(s.x + 0.81, s.z + 2.54, false);
  open();
  r.step(0.05);
  const snapshot = r.snapshot().closets;
  assert.equal(snapshot.open, 1);
  assert.ok(snapshot.travel[0] > 0 && snapshot.travel[0] < 1);
  const shaft = covers.find((s) => s.kind === 'duct');
  pose(shaft.x, shaft.z, false);
  assert.notEqual(g.x, shaft.x);
  pose(shaft.x, shaft.z, true);
  assert.equal(g.x, shaft.x);
});
