import test from 'node:test';
import assert from 'node:assert/strict';
import { stages, START, ENDINGS } from '../src/campaign.ts';

const key = (x, z) => x + ',' + z;
const neighbors = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function reachableFloor(stage) {
  const open = [stage.spawn];
  const visited = new Set();
  while (open.length) {
    const [x, z] = open.pop();
    const tile = stage.map[z]?.[x];
    if (!tile || tile === '#' || tile === 'X' || visited.has(key(x, z))) continue;
    visited.add(key(x, z));
    for (const [dx, dz] of neighbors) open.push([x + dx, z + dz]);
  }
  return visited;
}

test('every scene has a bounded floor, reachable interactions and valid destinations', () => {
  const problems = [];
  for (const stage of Object.values(stages)) {
    const walkable = reachableFloor(stage);
    const edges = stage.map[0] + stage.map.at(-1) + stage.map.map((row) => row[0] + row.at(-1)).join('');
    if (/[^#]/.test(edges)) problems.push(stage.id + ' boundary is open');
    const ids = new Set();
    for (const obj of stage.objects) {
      if (ids.has(obj.id)) problems.push('duplicate ' + obj.id);
      ids.add(obj.id);
      if (obj.target && !(obj.target in stages)) problems.push(obj.id + ' refers to missing ' + obj.target);
      if (obj.kind === 'ending' && !(obj.ending in ENDINGS)) problems.push('unknown ending ' + obj.id);
      if (obj.model === 'pit') {
        assert.equal(stage.map[obj.z][obj.x], 'X');
        continue; // Interior tiles of a large pit can only be reached by falling.
      }
      if (!walkable.has(key(obj.x, obj.z))) problems.push(obj.id + ' is unreachable');
    }
    for (const entity of [stage.threat, ...stage.additionalThreats]) {
      if (entity && !walkable.has(key(entity.x, entity.z)))
        problems.push(stage.id + ' ' + entity.kind + ' cannot enter the player area');
    }
  }
  assert.deepEqual(problems, []);
});

function visit(stageId, flags, completed) {
  const stage = stages[stageId];
  for (let pass = 0; pass <= stage.objects.length; pass++) {
    const previous = completed.size;
    for (const obj of stage.objects) {
      if (!['pickup', 'switch', 'code'].includes(obj.kind) || completed.has(obj.id)) continue;
      if (obj.need?.some((flag) => !flags.has(flag))) continue;
      completed.add(obj.id);
      for (const flag of obj.consumes ?? []) flags.delete(flag);
      for (const flag of obj.gives ?? []) flags.add(flag);
    }
    if (previous === completed.size) break;
  }
}

test('a single fresh save traverses every main-route scene, all four branches and Final Escape', () => {
  const main = [
    'lobby',
    'pitwalk',
    'garage',
    'garagekeys',
    'darkdeck',
    'hub',
    'blackgarage',
    'pipes',
    'station',
    'office',
    'hotel',
    'hotelrooms',
    'pipesreturn',
    'fun',
    'pool',
    'run',
    'library',
    'village',
    'castle',
    'dark',
    'ocean',
    'depths',
    'cave',
    'projection',
    'courtyard1',
    'suburbs',
    'outpost',
    'suburbs',
    'field',
    'arcade',
    'residential',
    'redrooms',
    'residential',
    'snack',
    'hotelchase',
    'courtyard2',
    'deepool',
    'stagnant',
    'funplus',
    'school',
    'slides',
    'slides2',
    'slides3',
    'bunker',
  ];
  const branches = [
    'blackgarage',
    'stair',
    'bunker',
    'dark',
    'pink',
    'bunker',
    'lowstation',
    'plastic',
    'gym',
    'overgrowth',
    'grass',
    'bunker',
    'arcade',
  ];
  assert.equal(main[0], START);
  const flags = new Set(),
    completed = new Set();
  const route = [...main, ...branches];
  for (let i = 0; i < route.length; i++) {
    const id = route[i];
    visit(id, flags, completed);
    if (i === route.length - 1) break;
    const next = route[i + 1];
    const edge = stages[id].objects.find(
      (obj) =>
        ['exit', 'ending'].includes(obj.kind) &&
        obj.target === next &&
        (obj.need ?? []).every((flag) => flags.has(flag)),
    );
    assert.ok(edge, id + ' cannot reach ' + next);
    for (const f of edge.consumes ?? []) flags.delete(f);
    for (const f of edge.gives ?? []) flags.add(f);
    if (id === 'arcade' && i < main.length) {
      const final = stages.arcade.objects.find((obj) => obj.ending === 'final');
      assert.ok(!final.need.every((f) => flags.has(f)), 'finale available on first arcade visit');
    }
  }
  const final = stages.arcade.objects.find((obj) => obj.ending === 'final');
  assert.deepEqual(new Set(final.need), new Set(['wrong', 'suburbs', 'pink', 'city']));
  assert.ok(final.need.every((flag) => flags.has(flag)));
  const alternate = stages.pitwalk.objects.find((obj) => obj.model === 'pit');
  assert.equal(alternate.target, 'lower');
  assert.equal(stages.lower.objects.find((obj) => obj.kind === 'exit').target, 'garage');
  assert.equal(new Set([...route, 'lower']).size, Object.keys(stages).length);
});

test('all four ladder pieces gate the cubby and service door', () => {
  const ladder = stages.lobby.objects.find((o) => o.gives?.includes('ladder-built'));
  assert.equal(ladder.need.length, 4);
  const key = stages.lobby.objects.find((o) => o.gives?.includes('lobby-key'));
  assert.deepEqual(key.need, ['ladder-built']);
  assert.deepEqual(stages.lobby.objects.find((o) => o.kind === 'exit').need, ['lobby-key']);
});

test('every transported object has a reachable, unambiguous delivery point', () => {
  for (const stage of Object.values(stages)) {
    for (const obj of stage.objects) {
      if (obj.challenge?.kind !== 'haul') continue;
      const destination = obj.challenge.destination;
      assert.equal(
        stage.objects.filter((o) => o.id === destination || o.gives?.includes(destination)).length,
        1,
        obj.id,
      );
    }
  }
});

test('the lobby and flooded depths have lethal encounter spawns, shelter and a safe opening distance', () => {
  for (const id of ['lobby', 'depths']) {
    const stage = stages[id],
      entity = stage.threat;
    assert.ok(entity);
    assert.ok(Math.hypot(stage.spawn[0] - entity.x, stage.spawn[1] - entity.z) > 7, id);
    assert.ok(
      stage.objects.some((o) => o.kind === 'hide'),
      id + ' must offer shelter',
    );
  }
  assert.equal(stages.lobby.threat.kind, 'bacteria');
  assert.equal(stages.depths.threat.kind, 'leviathan');
  assert.ok(stages.lobby.objects.some((o) => o.kind === 'note' && o.description.includes('running feet')));
});
