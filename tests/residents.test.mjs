import assert from 'node:assert/strict';
import test from 'node:test';
import { ResidentBehavior } from '../src/resident-behavior.ts';
import { stages } from '../src/campaign.ts';

function advance(monster, seconds, watching, noisy, nearby = true) {
  const events = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const event = monster.update(1 / 60, nearby, watching, noisy);
    if (event) events.push(event);
  }
  return events;
}

test('the Veil releases an averted gaze and captures a sustained stare even while standing still', () => {
  const veil = new ResidentBehavior('veil');
  assert.deepEqual(advance(veil, 1, true, false), ['warn']);
  advance(veil, .4, false, true);
  assert.equal(veil.exposure, 0);
  assert.ok(advance(veil, 2, true, false).includes('capture'));
  advance(veil, .1, true, true, false);
  assert.equal(veil.phase, 'idle');
});

test('the Bellwether gives warning beats, hears noisy movement, and tolls after a quiet listening window', () => {
  const bell = new ResidentBehavior('bellwether');
  assert.deepEqual(advance(bell, 1.6, false, false), ['warn', 'listen']);
  assert.deepEqual(advance(bell, 1.8, true, false), ['toll']);
  assert.equal(advance(bell, 5, false, true).length, 0);
  assert.deepEqual(advance(bell, 2.6, false, true).slice(0, 2), ['warn', 'listen']);
  assert.ok(advance(bell, .65, false, true).includes('capture'));
});

test('the Lobby hosts all three threats and the guest wing and archive have mixed encounters', () => {
  assert.equal(stages.lobby.threat.kind, 'bacteria');
  assert.deepEqual(new Set(stages.lobby.residents.map(s => s.kind)), new Set(['veil', 'bellwether']));
  assert.equal(stages.hotelrooms.residents[0].kind, 'veil');
  assert.equal(stages.library.residents[0].kind, 'bellwether');
});
