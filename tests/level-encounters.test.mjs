import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Encounter, playerSpeed } from '../src/game-entity.ts';
import { creatureLibraries } from '../src/creature-roster.ts';
import { stages } from '../src/campaign.ts';

const street = ['###########', '#....=....#', '#.........#', '###########'];
function hunter(kind, x = 2, z = 1) {
  return new Encounter({ map: street, threat: { kind, x, z } }, 3.2);
}
function tick(e, x, z, grace = 0, voice = 0) {
  e.tick(.05, x, z, true, true, true, true, false, false, true, grace, undefined, voice);
}

test('roaming hunters gain slightly on a sprinter across cell boundaries at different frame rates', () => {
  const row = '#' + '.'.repeat(40) + '#';
  const map = ['#'.repeat(row.length), row, '#'.repeat(row.length)];
  const kinds = new Set(Object.values(stages).flatMap(s => [s.threat, ...s.additionalThreats].flatMap(t => t ? [t.kind] : [])));
  kinds.add('watcher');
  for (const kind of kinds) {
    if (kind === 'bonethief' || kind === 'camera') continue;
    for (const hz of [30, 60, 120]) {
      const e = new Encounter({ map, threat: { kind, x: 6, z: 1 } }, 3.2);
      e.x = 2; // Run across the Party Host’s territory so it stays in pursuit.
      e.angle = Math.PI / 2;
      let runner = e.x + 2;
      for (let frame = 0; frame < hz; frame++) {
        runner += playerSpeed.sprint / (hz * 3.2);
        e.tick(1 / hz, runner, 1, false, false, true, true, false, false, true, 0);
      }
      const travelled = (e.x - 2) * 3.2;
      assert.ok(travelled > playerSpeed.sprint && travelled < playerSpeed.sprint * 1.12, kind + ' at ' + hz + ' Hz: ' + travelled);
    }
  }
});

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

test('contact poses anticipate a nearby hunter, peak on capture and cancel when the player escapes', () => {
  const e = hunter('skinstealer');
  tick(e, 3.05, 1);
  assert.ok(e.contactPose > 0 && e.contactPose < 1 / 3);
  tick(e, 2.1, 1);
  assert.ok(e.contactPose > 1 / 3 && !e.contact);
  tick(e, 6.5, 1);
  assert.equal(e.contactPose, 0);
  for (let i = 0; i < 10; i++) tick(e, e.x, e.z);
  assert.ok(e.contact);
  assert.equal(e.contactPose, 1);
  tick(e, e.x, e.z, 1);
  assert.equal(e.contactPose, 0);
  for (const kind of ['hound', 'animation']) {
    const guarded = hunter(kind);
    tick(guarded, guarded.x, guarded.z);
    assert.equal(guarded.contactPose, 0, kind);
  }
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

test('every roaming campaign species and the mod Watcher resolve to an authored model', () => {
  const kinds = new Set(Object.values(creatureLibraries).flatMap(entries => Object.keys(entries)));
  for (const stage of Object.values(stages)) {
    for (const threat of [stage.threat, ...stage.additionalThreats].filter(Boolean)) {
      assert.ok(threat.kind === 'bacteria' || kinds.has(threat.kind), stage.id + ': ' + threat.kind);
    }
  }
  assert.ok(kinds.has('watcher'));
});

for (const [fileName, entries] of Object.entries(creatureLibraries)) {
  test(fileName + ' exports a drawable body, close-up target and independent motion for each species', () => {
    const file = readFileSync(new URL('../public/models/' + fileName + '.glb', import.meta.url));
    const gltf = JSON.parse(file.toString('utf8', 20, 20 + file.readUInt32LE(12)));
    const roots = gltf.scenes[gltf.scene].nodes;
    assert.deepEqual(roots.map(i => gltf.nodes[i].name).sort(), Object.values(entries).sort());
    for (const root of roots) {
      const tree = new Set();
      function visit(i) {
        tree.add(i);
        for (const child of gltf.nodes[i].children ?? []) visit(child);
      }
      visit(root);
      const name = gltf.nodes[root].name;
      const nodes = [...tree].map(i => gltf.nodes[i]);
      const surfaces = nodes.filter(n => n.mesh !== undefined).flatMap(n => gltf.meshes[n.mesh].primitives);
      assert.ok(surfaces.length, name + ' body');
      for (const {attributes} of surfaces) {
        assert.ok(attributes.COLOR_0 !== undefined, name + ' missing painted vertex colours');
        assert.equal(attributes.COLOR_1, undefined, name + ' paint exported to the secondary layer');
      }
      assert.ok(nodes.some(n => n.name === name + '_Focus'), name + ' focus');
      const suffixes = name === 'BoneThief' ? ['Reach'] : name === 'SecurityCamera' ? ['Scan'] : ['Idle', 'Stalk', 'Chase', 'Contact'];
      if (suffixes.includes('Stalk')) {
        const { walkStride, chaseStride } = gltf.nodes[root].extras;
        assert.ok(walkStride > 0 && chaseStride > 0, name + ' stride lengths');
      }
      for (const suffix of suffixes) {
        const clip = gltf.animations.find(a => a.name === name + suffix);
        assert.ok(clip?.channels.length > 0, name + suffix);
        for (const {target, sampler} of clip.channels) {
          assert.ok(tree.has(target.node), name + ' cross-rig animation');
          const timeline = gltf.accessors[clip.samplers[sampler].input];
          assert.equal(timeline.min[0], 0, clip.name + ' starts late');
          assert.ok(timeline.count > 1 && timeline.max[0] > 0);
        }
      }
      if (['Hound', 'AraneaMembri', 'FarmerFaceling', 'SkinStealer', 'Clump'].includes(name)) {
        assert.ok(surfaces.some(p => p.attributes.WEIGHTS_0 !== undefined && p.attributes.JOINTS_0 !== undefined));
        const skinned = nodes.find(n => n.skin !== undefined);
        const joints = gltf.skins[skinned.skin].joints;
        assert.ok(joints.every(i => tree.has(i)));
        assert.ok(joints.some(i => gltf.nodes[i].name.endsWith('Plant')));
      }
    }
  });
}
