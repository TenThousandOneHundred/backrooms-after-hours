import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Encounter } from '../src/game-entity.ts';
import { stages } from '../src/campaign.ts';

const street = ['###########', '#....=....#', '#.........#', '###########'];
function hunter(kind, x = 2, z = 1) {
  return new Encounter({ map: street, threat: { kind, x, z } }, 3.2);
}
function tick(e, x, z, grace = 0, voice = 0) {
  e.tick(.05, x, z, true, true, true, true, false, false, true, grace, undefined, voice);
}

test('the campaign roster keeps each mixed encounter and the annex floor sequence', () => {
  assert.deepEqual(['slides', 'slides2', 'slides3'].map(id => stages[id].threat.kind), ['smiler', 'bacteria', 'skinstealer']);
  for (const [stage, expected] of [
    ['overgrowth', ['bacteria', 'bonethief']], ['funplus', ['partyhost', 'partygoer']],
    ['library', ['scratcher']], ['redrooms', ['bonethief']], ['suburbs', ['neighborhoodwatch']],
    ['courtyard2', ['membri']], ['field', ['farmer']],
  ]) {
    const room = stages[stage];
    assert.deepEqual([room.threat, ...room.additionalThreats].map(site => site.kind), expected);
  }
});

test('all pool objectives can be reached without stepping in infected water', () => {
  for (const id of ['pool', 'deepool', 'stagnant']) {
    const {map, objects, spawn, threat} = stages[id];
    assert.equal(threat, undefined);
    assert.ok(map.some(row => row.includes('!')));
    const pending = [spawn], visited = new Set();
    while (pending.length) {
      const [x, z] = pending.pop();
      if (visited.has(x + ',' + z) || map[z]?.[x] !== '.') continue;
      visited.add(x + ',' + z);
      pending.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
    }
    for (const o of objects) assert.ok(visited.has(o.x + ',' + o.z), o.id);
  }
});

test('the Bone Thief warns, releases a retreating player, and kills only inside its reach', () => {
  const e = hunter('bonethief');
  for (let i = 0; i < 5; i++) tick(e, 2.65, 1);
  assert.ok(e.reach > 0 && !e.contact);
  for (let i = 0; i < 8; i++) tick(e, 3.2, 1);
  assert.equal(e.reach, 0);
  for (let i = 0; i < 25; i++) tick(e, 2.65, 1);
  assert.ok(e.contact);
  tick(e, 2.65, 1, 2);
  assert.equal(e.contact, false);
  assert.deepEqual([e.x, e.z], [2, 1]);
});

test('the Neighborhood Watch loses a lit porch even at contact distance', () => {
  const e = hunter('neighborhoodwatch', 5, 1);
  for (let i = 0; i < 45; i++) {
    tick(e, 5, 1, 0, 1);
    assert.ok(!e.heardVoice && !e.contact && e.danger === 0);
  }
  const exposed = hunter('neighborhoodwatch', 4, 1);
  for (let i = 0; i < 12; i++) tick(exposed, 4, 1);
  assert.ok(exposed.contact);
});

test('the Party Host returns to the blue wing when a player leaves its territory', () => {
  const e = hunter('partyhost', 2, 1);
  for (let i = 0; i < 24; i++) tick(e, 4, 1);
  assert.ok(e.x > 3);
  for (let i = 0; i < 250; i++) tick(e, 9, 1, 0, 1);
  assert.ok(Math.abs(e.x - 2) < .1 && !e.heardVoice && !e.contact);
});

test('each Blender creature has an animation targeting only its own model', () => {
  const file = readFileSync(new URL('../public/models/level-creatures.glb', import.meta.url));
  const gltf = JSON.parse(file.toString('utf8', 20, 20 + file.readUInt32LE(12)));
  const roots = gltf.scenes[gltf.scene].nodes;
  assert.equal(roots.length, 6);
  for (const root of roots) {
    const tree = new Set();
    function visit(i) {
      tree.add(i);
      for (const child of gltf.nodes[i].children ?? []) visit(child);
    }
    visit(root);
    const clip = gltf.animations.find(a => a.name === gltf.nodes[root].name + 'Motion');
    assert.ok(clip?.channels.length > 0);
    for (const {target, sampler} of clip.channels) {
      assert.ok(tree.has(target.node));
      assert.ok(gltf.accessors[clip.samplers[sampler].input].count > 1);
    }
  }
});
