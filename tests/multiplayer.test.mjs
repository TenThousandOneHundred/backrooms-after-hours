import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Expedition, capacity } from '../src/multiplayer/expedition.ts';
import { stages, ENDINGS } from '../src/campaign.ts';
import { TILE } from '../src/game-entity.ts';
import { stages as itinerary, endByStage } from './campaign-itinerary.mjs';

function room(difficulty = 'medium') {
  const r = new Expedition();
  r.setDifficulty(difficulty);
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
  const r = room('hard'),
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

test('a late arrival joins a teammate in the current level with its shared progress', () => {
  const game = new Expedition();
  const host = game.add();
  const journal = {...game.journal, stage: 'garage', flags: ['lift-ready'], completed: ['lobby/rail']};
  game.start(journal);
  const epoch = game.epoch;
  const pose = { ...game.players.get(host), x: 5*TILE, z: 2*TILE, yaw: 1.3 };
  game.command(host, epoch, { type: 'pose', pose });
  const guest = game.players.get(game.add());
  assert.ok(Math.abs(Math.hypot(guest.x-pose.x, guest.z-pose.z)-.9) < 1e-6);
  assert.equal(guest.yaw, pose.yaw);
  assert.equal(game.epoch, epoch);
  assert.deepEqual(game.snapshot().journal.completed, ['lobby/rail']);
  assert.equal(game.snapshot().journal.stage, 'garage');
  assert.equal(game.players.get(host).x, pose.x);
});

test('a late arrival uses the level entrance when the team is on the broken floor', () => {
  const game = new Expedition();
  const host = game.add();
  game.start({...game.journal, stage:'pitwalk'});
  const pose = { ...game.players.get(host), x: 3*TILE, z: 3*TILE };
  game.command(host, game.epoch, { type:'pose', pose });
  assert.equal(game.players.get(host).x, pose.x);
  const guest = game.players.get(game.add());
  const [sx,sz] = stages.pitwalk.spawn;
  assert.ok(Math.hypot(guest.x-sx*TILE, guest.z-sz*TILE)<1);
});

test('disconnect holds the seat and restores the explorer without replaying stale voice or movement', () => {
  const room = new Expedition(), id = crypto.randomUUID();
  room.add(); const slot = room.add(id);
  room.start({ ...room.journal, stage: 'garage' });
  const pose = { ...room.players.get(slot), x: 9*TILE, z: 3*TILE, yaw: .9, pitch: .2,
    sanity: 64, stamina: 42, light: true, moving: true, voice: .5 };
  room.command(slot, room.epoch, { type:'pose', pose });
  room.remove(slot, true);
  for (let i=3; i<=capacity; i++) assert.equal(room.add(), i);
  assert.equal(room.add(), 0);
  assert.equal(room.add(id), slot);
  const back = room.players.get(slot);
  for (const key of ['x','z','yaw','pitch','sanity','stamina','light','lives']) assert.equal(back[key],pose[key]);
  assert.equal(back.moving,false);
  assert.equal(back.voice,0);
});

test('an expired seat can be reused while the returning explorer still recovers their own state', t => {
  let now = Date.now(); t.mock.method(Date, 'now', () => now);
  const room = new Expedition(), id = crypto.randomUUID();
  room.add(); room.add(id); room.start({ ...room.journal, stage: 'garage' });
  room.command(2, room.epoch, {type:'pose', pose:{...room.players.get(2), x:9*TILE, z:3*TILE}});
  room.remove(2,true); now += 121000;
  assert.equal(room.add(),2);
  const back = room.add(id);
  assert.equal(back,3); assert.equal(room.players.get(back).x,9*TILE);
});

test('rejoining across a level change receives the current level and its lives', () => {
  const room = new Expedition(), id = crypto.randomUUID();
  room.add(); room.add(id); room.start();
  room.command(2, room.epoch, {type:'down', cause:'Caught.'});
  room.remove(2,true);
  room.journal.pending={ending:'wrong',target:'garage'};
  room.command(1,room.epoch,{type:'continue'});
  const back=room.players.get(room.add(id));
  assert.equal(room.journal.stage,'garage'); assert.equal(back.alive,true);
  assert.equal(back.lives,room.players.get(1).lives);
  assert.ok(Math.hypot(back.x-stages.garage.spawn[0]*TILE,back.z-stages.garage.spawn[1]*TILE)<1);
});

test('disconnect during respawn preserves the lost life and completes the existing respawn', () => {
  const room = new Expedition(), id = crypto.randomUUID();
  room.add(); room.add(id); room.start();
  room.command(2,room.epoch,{type:'down',cause:'Caught.'});
  room.remove(2,true); room.step(3);
  assert.equal(room.add(id),2); room.step(.05);
  assert.equal(room.players.get(2).alive,true);
  assert.equal(room.players.get(2).lives,2);
});

test('a disconnected hunt monster can return to its role before the seat expires', t => {
  let now = Date.now(); t.mock.method(Date,'now',()=>now);
  const room = new Expedition(), id=crypto.randomUUID();
  room.add(); room.add(id); room.configureHunt(2); room.start();
  room.remove(2,true); room.step(.05);
  assert.equal(room.phase,'playing'); assert.equal(room.add(),3);
  assert.equal(room.add(id),2); assert.equal(room.hunt.monster,2);
  room.remove(2,true); now+=121000; room.step(.05);
  assert.equal(room.hunt.result,'abandoned');
});

test('host handoff keeps campaign state, roles, return seats and the pending ending', () => {
  const room = new Expedition(), guest = crypto.randomUUID(), other = crypto.randomUUID();
  room.add(); room.add(guest); room.add(other); room.start();
  room.command(3,room.epoch,{type:'down',cause:'Caught.'});
  room.journal.flags.push('rail1');
  room.journal.inventory.rail1 = 'Left rail';
  room.journal.pending = {ending:'wrong',target:'garage'};
  const copy = structuredClone(room.checkpoint()), next = Expedition.takeOver(copy,2);
  assert.equal(next.hostSlot,2); assert.equal(next.epoch,room.epoch);
  assert.equal(next.journal.inventory.rail1,'Left rail');
  assert.deepEqual(next.snapshot().monsters,room.snapshot().monsters);
  assert.equal(next.add(other,true),3); assert.equal(next.players.get(3).alive,false);
  assert.equal(next.add('host',true),1);
  next.command(1,next.epoch,{type:'continue'}); assert.equal(next.journal.stage,'lobby');
  next.command(2,next.epoch,{type:'continue'}); assert.equal(next.journal.stage,'garage');
  assert.equal(room.journal.stage,'lobby');
});

test('a second host can take over a hunt with the same monster, lives and clock', () => {
  const room = new Expedition(), a=crypto.randomUUID(), b=crypto.randomUUID();
  room.add();room.add(a);room.add(b);room.configureHunt(2);room.start();room.step(.5);
  const second=Expedition.takeOver(structuredClone(room.checkpoint()),2);
  assert.equal(second.add(b,true),3);
  const third=Expedition.takeOver(structuredClone(second.checkpoint()),3);
  assert.equal(third.phase,'playing');assert.equal(third.hunt.monster,2);
  assert.equal(third.time,.5);assert.equal(third.add(a,true),2);
  assert.deepEqual(third.players.get(2),room.players.get(2));
  assert.equal(third.add('host',true),1);
});

test('a lobby successor can start the game with the original explorer slots', () => {
  const room = new Expedition();room.add();room.add();
  const next=Expedition.takeOver(structuredClone(room.checkpoint()),2);
  assert.equal(next.phase,'waiting');
  assert.equal(next.add('host',true),1);
  next.start(); assert.equal(next.phase,'playing');assert.equal(next.hostSlot,2);
});
