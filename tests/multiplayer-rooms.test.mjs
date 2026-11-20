import assert from 'node:assert/strict';
import test from 'node:test';
import { stages } from '../src/campaign.ts';
import { TILE, canStandAt, clearSight } from '../src/game-entity.ts';
import { freshProgress } from '../src/game-state.ts';
import { Expedition } from '../src/multiplayer/expedition.ts';

for (const [stageId, lockerModel, pickupFlag] of [
  ['lobby', 'archive-locker', 'rail4'],
  ['garagekeys', 'bay-locker', 'garagekey4'],
  ['hotelrooms', 'linen-cabinet', 'mail3'],
]) {
  test(stageId + ' co-op guests can hide in the new wing and share its pickup', () => {
    const room = new Expedition();
    room.add();
    const guest = room.add();
    room.start(freshProgress(stageId));
    const stage = stages[room.journal.stage];
    const locker = stage.objects.find(o => o.kind === 'hide' && o.model === lockerModel);
    const item = stage.objects.find(o => o.gives?.includes(pickupFlag));
    assert.ok(locker && item);
    if (stageId !== 'lobby') assert.ok(stage.props.some(p => p.model === 'roof-monitor'));

    function standAt(object, hidden) {
      room.command(guest, room.epoch, {
        type: 'pose',
        pose: { ...room.players.get(guest), x: object.x * TILE, z: object.z * TILE, hidden },
      });
    }

    standAt(locker, true);
    const concealed = room.snapshot().players.find(p => p.slot === guest);
    assert.equal(concealed.hidden, true);
    assert.equal(concealed.x, locker.x * TILE);
    assert.equal(concealed.z, locker.z * TILE);

    standAt(item, false);
    room.command(guest, room.epoch, { type: 'use', id: item.id });
    const state = room.snapshot();
    assert.equal(state.players.find(p => p.slot === guest).hidden, false);
    assert.ok(state.journal.flags.includes(pickupFlag));
    assert.ok(state.journal.completed.includes(stageId + '/' + item.id));
  });
}

test('later campaign wings each have two usable team shelters and cover that stops sightlines', () => {
  const laterStages = Object.values(stages).slice(Object.keys(stages).indexOf('pipesreturn'));
  const names = new Set();
  for (const stage of laterStages) {
    const landmarks = stage.props.filter(p => p.solid);
    const name = landmarks[0]?.label;
    assert.ok(name && !names.has(name), stage.id + ' needs its own landmark');
    names.add(name);
    for (const p of landmarks) {
      assert.equal(canStandAt(stage, p.x * TILE, p.z * TILE), false);
      assert.equal(clearSight(stage, p.x - 1, p.z, p.x + 1, p.z), false);
    }

    const room = new Expedition();
    const seats = [room.add(), room.add()];
    room.start(freshProgress(stage.id));
    const shelters = ['{', '}'].map(marker => stage.objects.find(o => o.id === stage.id + '-' + marker));
    for (const [i, cover] of shelters.entries()) {
      assert.equal(cover?.kind, 'hide', stage.id);
      const slot = seats[i];
      room.command(slot, room.epoch, { type: 'pose', pose: {
        ...room.players.get(slot), x: cover.x * TILE, z: cover.z * TILE, hidden: true,
      } });
    }
    room.step(.05);
    const team = room.snapshot().players;
    assert.ok(team.every(p => p.hidden && p.alive), stage.id);
    assert.ok(team.some(p => p.x !== team[0].x || p.z !== team[0].z), stage.id);
  }
});
