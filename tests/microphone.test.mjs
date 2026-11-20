import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceVolume } from '../src/voice-input.ts';
import { Encounter } from '../src/game-entity.ts';

test('mic volume rejects a quiet floor and DC offset, and grows with audible input', () => {
  const tone = amp => Float32Array.from({length: 1024}, (_, i) => .05 + amp * Math.sin(i / 10));
  assert.equal(voiceVolume(tone(0)), 0);
  assert.equal(voiceVolume(tone(.001)), 0);
  assert.ok(voiceVolume(tone(.02)) > 0);
  assert.ok(voiceVolume(tone(.02)) < voiceVolume(tone(.08)));
  assert.equal(voiceVolume(new Float32Array()), 0);
});

test('ordinary speech leaves room on the meter for louder voices', () => {
  // Whole cycles keep the measured RMS independent of the analyser window.
  const meterAt = db => voiceVolume(Float32Array.from({length: 1024}, (_, i) =>
    Math.SQRT2 * 10 ** (db / 20) * Math.sin(2 * Math.PI * i / 32)));
  const normal = meterAt(-18), raised = meterAt(-12), loud = meterAt(-6);
  assert.ok(normal > .43 && normal < .46);
  assert.ok(raised > normal + .1 && loud > raised + .1 && loud < .98);
  assert.equal(voiceVolume(Float32Array.from({length: 1024}, (_, i) => i % 2 ? .85 : -.85)), 1);
});

const map = ['############', '#..........#', '#.########.#', '#..........#', '############'];
const hunter = kind => new Encounter({map, threat: {kind, x: 1, z: 1}}, 3.2);
const tick = (e, px, pz, voice, grace = 0) =>
  e.tick(.03, px, pz, false, false, false, false, false, false, false, grace, undefined, voice);

test('voice hearing respects distance, walls, hiding, grace and silent cameras', () => {
  const e = hunter('bacteria');
  assert.ok(e.canHearVoice(.7, 8, 1, false));
  assert.equal(e.canHearVoice(.7, 8, 3, false), false);
  assert.equal(e.canHearVoice(.7, 8, 1, true), false);
  assert.equal(e.canHearVoice(.1, 8, 1, false), false);
  assert.equal(hunter('camera').canHearVoice(1, 1, 1, false), false);
  tick(e, 4, 1, 1, 2);
  assert.equal(e.heardVoice, false);
});

test('a blind hunter approaches a stationary voice, then searches its last audible location', () => {
  const e = hunter('crawler');
  tick(e, 6, 1, 0);
  assert.equal(e.x, 1);
  for (let i = 0; i < 65; i++) tick(e, 6, 1, .8);
  assert.ok(e.heardVoice && e.x > 3);
  for (let i = 0; i < 70; i++) tick(e, 1, 3, 0);
  assert.equal(e.heardVoice, false);
  assert.ok(e.x > 5);
  assert.equal(e.z, 1);
});

test('a full shout draws Bacteria down a long hall while ordinary speech stays local', () => {
  const e = new Encounter({map: ['.'.repeat(65)], threat: {kind: 'bacteria', x: 1, z: 0}}, 3.2);
  assert.equal(e.canHearVoice(.44, 4, 0, false), true);
  assert.equal(e.canHearVoice(.44, 6, 0, false), false);
  assert.equal(e.canHearVoice(.87, 24, 0, false), true);
  assert.equal(e.canHearVoice(1, 31, 0, false), true);
  assert.equal(e.canHearVoice(1, 50, 0, false), false);
});
