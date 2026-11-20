import { crossesPartition, partitionsFor } from '../src/level-zero-rooms.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { stages } from '../src/campaign.ts';
import { concourseFloor, basementBed } from '../src/concourse-plan.ts';
import { TILE, canStandAt, clearSight } from '../src/game-entity.ts';

const stage = stages.lobby;
const walk = (x, z) => canStandAt(stage, x * TILE, z * TILE);

test('angled partitions occupy the same space for walking, hunter navigation and sight', () => {
  for (const id of ['lobby', 'pitwalk', 'lower']) {
    for (const wall of partitionsFor(id)) {
      const x = (wall.ax + wall.bx) / 2, z = (wall.az + wall.bz) / 2;
      assert.equal(canStandAt(stages[id], x*TILE, z*TILE), false);
      assert.ok(crossesPartition(id, x - wall.uz, z + wall.ux, x + wall.uz, z - wall.ux, .27/TILE));
      assert.equal(clearSight(stages[id], x - wall.uz, z + wall.ux, x + wall.uz, z - wall.ux), false);
    }
  }
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

test('three independent ramps lead down to the carpeted records rooms', () => {
  for (const x of [10, 55, 87]) {
    for (let z = 23; z <= 35; z += 0.25) assert.ok(walk(x, z));
    assert.equal(concourseFloor(x, 23), 0);
    assert.equal(concourseFloor(x, 35), basementBed);
  }
});

test('every Level 0 objective is reachable through the finished rooms', () => {
  for (const id of ['lobby', 'pitwalk', 'lower']) {
    const room = stages[id], queue = [room.spawn], seen = new Set([room.spawn.join(',')]);
    for (const [x, z] of queue) {
      for (const [dx, dz] of [[1,0], [-1,0], [0,1], [0,-1]]) {
        const u = x + dx, v = z + dz, key = [u,v].join(',');
        if (seen.has(key) || room.map[v]?.[u] === 'X' ||
            !canStandAt(room, u*TILE, v*TILE) || crossesPartition(id, x,z,u,v,.27/TILE)) continue;
        if (![.25,.5,.75].every(t => canStandAt(room,(x+t*dx)*TILE,(z+t*dz)*TILE))) continue;
        seen.add(key);
        queue.push([u,v]);
      }
    }
    for (const obj of room.objects.filter(o => o.model !== 'pit'))
      assert.ok(seen.has([obj.x,obj.z].join(',')), room.id + ' ' + obj.name);
  }
});
