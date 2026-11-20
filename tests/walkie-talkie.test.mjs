import test from 'node:test';
import assert from 'node:assert/strict';
import { radioSamples, readRadioPacket } from '../src/multiplayer/radio-packet.ts';
import { Expedition } from '../src/multiplayer/expedition.ts';
import { stages } from '../src/campaign.ts';
import { TILE } from '../src/game-entity.ts';

test('radio accepts one bounded audio frame and preserves signed samples and silence', () => {
  const bytes = new Uint8Array(radioSamples).fill(128);
  bytes[0] = 0;
  bytes[1] = 255;
  const encoded = btoa(String.fromCharCode(...bytes));
  assert.deepEqual([...readRadioPacket(encoded).slice(0, 3)], [-1, 127 / 128, 0]);
  for (const invalid of [null, [], encoded + 'A', encoded.slice(1), '='.repeat(encoded.length)])
    assert.equal(readRadioPacket(invalid), undefined);
});

test('a listening Bellwether hears a nearby receiving radio with its owner standing still and mic off', () => {
  const room = new Expedition();
  room.add();
  room.add();
  room.start();
  const bell = stages.lobby.residents.find((s) => s.kind === 'bellwether');
  const p = room.players.get(2);
  for (let i = 0; i < 8 * 20 + 85; i++) {
    room.command(2, room.epoch, {
      type: 'pose',
      pose: { ...p, x: bell.x * TILE, z: bell.z * TILE, voice: 0 },
    });
    room.soundRadio(2, 0.8);
    room.step(0.05);
  }
  assert.equal(p.voice, 0);
  assert.equal(p.cause, 'Caught by bellwether.');
  assert.equal(room.players.get(1).alive, true);
});
