import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceMix } from '../src/multiplayer/voice-range.ts';

const stage = { map: Array.from({ length: 12 }, () => '.'.repeat(64)) };
const at = (x, z, extra = {}) => ({ x, z, y: 0, yaw: 0, voice: .44, hidden: false, ...extra });
test('the speaker controls range independently of the listening player', () => {
  const listener = at(4, 4, { voice: 0 });
  assert.equal(voiceMix(stage, listener, at(6, 4)).gain, 1);
  assert.ok(voiceMix(stage, listener, at(14, 4)).gain > 0);
  assert.equal(voiceMix(stage, listener, at(18, 4)).gain, 0);
  const far = at(64, 4);
  assert.equal(voiceMix(stage, { ...listener, voice: 1 }, far).gain, 0);
  const shout = voiceMix(stage, listener, { ...far, voice: 1 });
  assert.ok(shout.gain > .1 && shout.gain < .2);
  assert.equal(voiceMix(stage, listener, at(4, 4, { voice: 1, y: 96 })).inRange, false);
});
test('turning reverses stereo direction and walls and lockers muffle speech', () => {
  const listener = at(4, 4),
    speaker = at(15, 4);
  const direct = voiceMix(stage, listener, speaker);
  assert.equal(direct.pan, 1);
  assert.equal(voiceMix(stage, { ...listener, yaw: Math.PI }, speaker).pan, -1);
  const blocked = { map: [...stage.map] };
  blocked.map[1] = '...#............';
  const wall = voiceMix(blocked, listener, speaker);
  assert.ok(wall.gain < direct.gain && wall.cutoff < direct.cutoff);
  assert.equal(voiceMix(stage, listener, { ...speaker, hidden: true }).gain, wall.gain);
});

import { EventEmitter } from 'node:events';
import { ProximityVoice } from '../src/multiplayer/proximity-voice.ts';

test('voice calls follow room membership, stage changes, survival and mic state', (t) => {
  t.mock.method(globalThis, 'setTimeout', () => 0);
  globalThis.window = Object.assign(new EventTarget(), { setTimeout: globalThis.setTimeout });
  globalThis.AudioContext = class {
    state = 'running';
    async close() {}
  };
  t.after(() => {
    delete globalThis.window;
    delete globalThis.AudioContext;
  });

  class Call extends EventEmitter {
    constructor(id, metadata) {
      super();
      this.peer = id;
      this.metadata = metadata;
    }
    answer(stream) {
      assert.equal(stream, undefined);
      this.answered = true;
    }
    close() {
      this.closed = true;
      this.emit('close');
    }
  }
  const peer = new EventEmitter(),
    dialed = [];
  peer.call = (id, stream, { metadata }) => {
    assert.ok(stream.active);
    const call = new Call(id, metadata);
    dialed.push(call);
    return call;
  };
  const voice = new ProximityVoice(peer);
  const members = [
    { id: 'self', slot: 1 },
    { id: 'friend', slot: 2 },
    { id: 'far', slot: 3 },
  ];
  const state = {
    epoch: 1,
    phase: 'playing',
    journal: { stage: 'lobby' },
    players: [
      { ...at(4, 4), slot: 1, alive: true },
      { ...at(5, 4), slot: 2, alive: true },
      { ...at(104, 4), slot: 3, alive: true },
    ],
  };
  voice.update(1, state, members, true);
  const incoming = (id, epoch = 1) => {
    const call = new Call(id, { purpose: 'proximity', epoch });
    peer.emit('call', call);
    return call;
  };
  assert.ok(incoming('outsider').closed);
  assert.ok(incoming('far').closed);
  const friend = incoming('friend');
  assert.ok(friend.answered);
  assert.equal(dialed.length, 0);
  voice.setStream({ active: true });
  assert.deepEqual(
    dialed.map((c) => c.peer),
    ['friend'],
  );
  state.players[1].x = 64;
  for (const volume of [0, 1, .44, 0]) {
    state.players[1].voice = volume;
    voice.update(1, state, members, true);
    assert.ok(!friend.closed && !dialed[0].closed);
    assert.equal(dialed.length, 1);
  }
  voice.setStream();
  assert.ok(dialed[0].closed);
  assert.ok(!friend.closed);
  voice.update(1, { ...state, epoch: 2 }, members, true);
  assert.ok(friend.closed);
  assert.ok(incoming('friend', 1).closed);
  state.players[1].alive = false;
  voice.update(1, state, members, true);
  assert.ok(incoming('friend').closed);
  state.players[1].alive = true;
  voice.update(1, state, members, true);
  const again = incoming('friend');
  assert.ok(again.answered);
  voice.update(1, state, members.slice(0, 1), true);
  assert.ok(again.closed);
  voice.update(1, state, members, false);
  assert.ok(incoming('friend').closed);
  voice.dispose();
  assert.equal(peer.listenerCount('call'), 0);
});
