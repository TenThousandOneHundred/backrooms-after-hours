import assert from 'node:assert/strict';
import test from 'node:test';
import { stages } from '../src/campaign.ts';
import { TILE } from '../src/game-entity.ts';
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
    assert.ok(locker && item && stage.props.some(p => p.model === 'roof-monitor'));

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
