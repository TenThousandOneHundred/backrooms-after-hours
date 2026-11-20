import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Expedition, capacity } from '../src/multiplayer/expedition.ts';
import { stages, ENDINGS } from '../src/campaign.ts';
import { TILE } from '../src/game-entity.ts';
import { stages as itinerary, endByStage } from './campaign-itinerary.mjs';

function room() {
  const r = new Expedition();
  for (let i = 0; i < capacity; i++) r.add();
  r.start();
  return r;
}
function use(r, slot, obj, code = obj.code) {
  const s = stages[r.journal.stage],
    task = obj.challenge;
  if (task?.kind === 'haul') {
    r.command(slot, r.epoch, {
      type: 'pose',
      pose: { ...r.players.get(slot), x: obj.x * TILE, z: obj.z * TILE },
    });
    r.command(slot, r.epoch, { type: 'carry', id: obj.id });
  }
  const pos =
    task?.kind === 'haul'
      ? s.objects.find((o) => o.id === task.destination || o.gives?.includes(task.destination))
      : obj;
  r.command(slot, r.epoch, {
    type: 'pose',
    pose: { ...r.players.get(slot), x: pos.x * TILE, z: pos.z * TILE },
  });
  r.command(slot, r.epoch, { type: 'use', id: obj.id, code });
}

test('ten arrivals get eight seats; late joiners enter the current campaign', () => {
  const r = room();
  assert.deepEqual([r.add(), r.add()], [0, 0]);
  r.remove(4);
  assert.equal(r.add(), 4);
  assert.equal(r.snapshot().players.length, capacity);
});

test('team finishes every campaign scene and all five endings, alternating explorers and resolving concurrent uses once', () => {
  const r = room(),
    visited = new Set(),
    challenges = new Set();
  let seat = 0;
  const next = () => 1 + (seat++ % capacity);
  for (const [i, id] of itinerary.entries()) {
    assert.equal(r.journal.stage, id);
    visited.add(id);
    const s = stages[id];
    assert.equal(r.snapshot().monsters.length, (s.threat ? 1 : 0) + s.additionalThreats.length);
    for (let pass = 0; pass < s.objects.length; pass++) {
      const before = r.revision;
      for (const obj of s.objects) {
        if (
          obj.target ||
          obj.kind === 'hide' ||
          (obj.kind === 'note' && !obj.gives?.length) ||
          obj.need?.some((f) => !r.journal.flags.includes(f)) ||
          r.journal.completed.includes(id + '/' + obj.id)
        )
          continue;
        if (obj.kind === 'code') {
          use(r, next(), obj, 'incorrect');
          assert.ok(!r.journal.completed.includes(id + '/' + obj.id));
        }
        use(r, next(), obj);
        const rev = r.revision;
        use(r, next(), obj);
        assert.equal(r.revision, rev);
        assert.ok(r.journal.completed.includes(id + '/' + obj.id), obj.id);
        if (obj.challenge) challenges.add(obj.challenge.kind);
      }
      if (r.revision === before) break;
    }
    const dest = itinerary[i + 1];
    const exit = s.objects.find(
      (o) =>
        (dest ? o.target === dest : o.ending === 'final') &&
        (o.need ?? []).every((f) => r.journal.flags.includes(f)),
    );
    assert.ok(exit, id + ' to ' + dest);
    const oldEpoch = r.epoch;
    use(r, next(), exit);
    if (exit.ending) {
      assert.equal(r.journal.pending.ending, endByStage[id]);
      r.command(3, r.epoch, { type: 'continue' });
      assert.ok(r.journal.pending);
      r.command(1, r.epoch, { type: 'continue' });
      assert.equal(r.journal.pending, null);
    }
    assert.ok(r.epoch > oldEpoch, id);
    const previous = { ...r.players.get(2) };
    r.command(2, oldEpoch, { type: 'down', cause: 'stale' });
    assert.deepEqual(r.players.get(2), previous);
  }
  assert.deepEqual(visited, new Set(Object.keys(stages)));
  assert.deepEqual(new Set(r.journal.endings), new Set(Object.keys(ENDINGS)));
  assert.equal(challenges.size, 7);
});

test('range and state validation, team capture, retry and save restoration', () => {
  const r = room(),
    rail = stages.lobby.objects.find((o) => o.gives?.includes('rail1'));
  r.command(1, r.epoch, { type: 'use', id: rail.id });
  assert.equal(r.journal.flags.length, 0);
  const pos = r.players.get(2).x;
  r.command(2, r.epoch, { type: 'pose', pose: { ...r.players.get(2), x: Infinity } });
  assert.equal(r.players.get(2).x, pos);
  use(r, 2, rail);
  for (const p of r.players.values())
    r.command(p.slot, r.epoch, { type: 'down', cause: 'The Veil caught your gaze.' });
  assert.equal(r.phase, 'lost');
  r.start();
  assert.equal(r.phase, 'playing');
  assert.ok([...r.players.values()].every((p) => p.alive));
  const restored = new Expedition();
  restored.add();
  restored.start(structuredClone(r.journal));
  assert.deepEqual(restored.journal.flags, ['rail1']);
});

test('remote explorer ships with a skinned suit and four independently playable animations', () => {
  const b = readFileSync(new URL('../public/models/explorer.glb', import.meta.url));
  const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
  assert.deepEqual(new Set(g.animations.map((a) => a.name)), new Set(['Walk', 'Run', 'Idle', 'Crouch']));
  assert.ok(g.skins[0].joints.length >= 12);
  assert.ok(g.meshes[0].primitives.every((p) => p.attributes.WEIGHTS_0 !== undefined));
});

test('a shared Bone Thief can catch a noisy guest while the other explorers survive', () => {
  const r = new Expedition();
  r.add();
  r.add();
  r.journal.stage = 'redrooms';
  r.start();
  const s = stages.redrooms,
    guest = r.players.get(2);
  const site = [s.threat, ...s.additionalThreats].find((h) => h.kind === 'bonethief');
  for (let i = 0; i < 220 && guest.alive; i++) {
    r.command(2, r.epoch, {
      type: 'pose',
      pose: { ...guest, x: site.x * TILE, z: site.z * TILE, voice: 0.5 },
    });
    r.step(0.05);
  }
  assert.equal(guest.alive, false);
  assert.equal(r.players.get(1).alive, true);
  assert.equal(r.phase, 'playing');
});

test('two players hear the same Bellwether warning; only the one who makes noise is captured', () => {
  const r = room(),
    sites = stages.lobby.residents;
  const i = sites.findIndex((s) => s.kind === 'bellwether'),
    site = sites[i];
  let listened = false;
  for (let t = 0; t < 260; t++) {
    for (const slot of [1, 2])
      r.command(slot, r.epoch, {
        type: 'pose',
        pose: { ...r.players.get(slot), x: site.x * TILE, z: site.z * TILE, voice: slot === 2 ? 1 : 0 },
      });
    r.step(0.05);
    if (r.snapshot().residents[i].phase === 'listening') listened = true;
  }
  assert.ok(listened);
  assert.equal(r.players.get(2).cause, 'Caught by bellwether.');
  assert.ok(r.players.get(1).alive);
});
