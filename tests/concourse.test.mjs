import test from 'node:test';
import assert from 'node:assert/strict';
import { stages } from '../src/campaign.ts';
import { atriumWell, concourseFloor, concourseRoof, officeTile, waterline } from '../src/concourse-plan.ts';
import { TILE, canStandAt, clearSight } from '../src/game-entity.ts';

const stage = stages.lobby;
const walk = (x, z) => canStandAt(stage, x * TILE, z * TILE);

test('the atrium rails block travel while preserving views between the upper and lower routes', () => {
  assert.equal(concourseFloor(47, 8), 6.4);
  assert.equal(concourseFloor(45, 11), -3.4);
  for (const [x, z] of [
    [47, 8],
    [47, 16],
    [45, 12],
    [36, 14],
    [35, 11],
  ])
    assert.ok(walk(x, z));
  assert.equal(atriumWell(42, 10), true);
  assert.equal(walk(42, 10), false);
  assert.ok(clearSight(stage, 42, 8, 42, 11));
  assert.equal(clearSight(stage, 3, 4, 10, 4), false);
});

test('the planted floors of all connected tiles meet continuously', () => {
  for (let z = 1; z < stage.map.length - 1; z++)
    for (let x = 1; x < stage.map[z].length - 1; x++) {
      if (!walk(x, z)) continue;
      for (const [dx, dz] of [
        [1, 0],
        [0, 1],
      ]) {
        if (!walk(x + dx, z + dz)) continue;
        const a = concourseFloor(x + 0.499 * dx, z + 0.499 * dz),
          b = concourseFloor(x + 0.501 * dx, z + 0.501 * dz);
        assert.ok(Math.abs(a - b) < 0.01, 'floor step at ' + [x, z]);
      }
    }
});

test('three independent ramps join the office, hall and atrium to knee-deep water', () => {
  for (const x of [10, 55, 87]) {
    for (let z = 23; z <= 35; z += 0.25) assert.ok(walk(x, z));
    assert.equal(concourseFloor(x, 23), 0);
    assert.ok(Math.abs(waterline - concourseFloor(x, 35) - 0.52) < 0.0001);
  }
  assert.ok(clearSight(stage, 64, 8, 89, 8));
});

test('the first view meets a wallpaper partition and every ladder piece is reachable on the office floor', () => {
  const [sx, sz] = stage.spawn;
  assert.equal(concourseRoof(sx, sz), 3.08);
  assert.equal(clearSight(stage, sx, sz, sx + 8, sz), false);
  const queue = [stage.spawn], seen = new Set([stage.spawn.join(',')]);
  for (const [x, z] of queue) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const u = x + dx, v = z + dz, key = [u, v].join(',');
      if (seen.has(key) || !officeTile(u, v) || !walk(u, v)) continue;
      seen.add(key);
      queue.push([u, v]);
    }
  }
  for (const obj of stage.objects.filter(o => o.gives?.some(flag => /^rail[1-4]$/.test(flag)) || o.target === 'pitwalk'))
    assert.ok(seen.has([obj.x, obj.z].join(',')), obj.name);
});
