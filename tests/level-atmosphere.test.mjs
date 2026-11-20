import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { stages } from '../src/campaign.ts';
import { campaignAtmosphere, levelAtmospheres } from '../src/level-atmosphere.ts';
import { StageLoop } from '../src/stage-loop.ts';

test('every expanded stage has a distinct recording and lighting design', () => {
  const later = Object.keys(stages).slice(Object.keys(stages).indexOf('pipesreturn'));
  assert.deepEqual(Object.keys(levelAtmospheres).sort(), later.sort());
  const recordings = new Set(),
    palettes = new Set();
  for (const id of later) {
    const profile = campaignAtmosphere(id);
    const file = readFileSync(new URL('../public/ambience/' + id + '.mp3', import.meta.url));
    assert.ok(file.length > 10000);
    recordings.add(createHash('sha256').update(file).digest('hex'));
    palettes.add([profile.lamp, profile.fill, profile.pattern].join('/'));
  }
  assert.equal(recordings.size, later.length);
  assert.equal(palettes.size, later.length);
  assert.equal(campaignAtmosphere('lobby'), undefined);
  assert.equal(campaignAtmosphere('constructor'), undefined);
});

function audioContext() {
  const starts = [],
    stops = [],
    gains = [];
  const context = {
    state: 'running',
    currentTime: 40,
    decodeAudioData: async () => ({ duration: 20 }),
    createBufferSource: () => ({
      connect() {},
      disconnect() {},
      start(at, offset) {
        starts.push(offset);
      },
      stop() {
        stops.push(true);
        this.onended();
      },
    }),
    createGain: () => ({
      connect() {},
      disconnect() {},
      gain: {
        setValueAtTime() {},
        cancelScheduledValues() {},
        setTargetAtTime(n) {
          gains.push(n);
        },
      },
    }),
  };
  return { context, starts, stops, gains };
}

test('late joins, resuming, danger ducking and clock corrections follow stage time', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array(1)));
  const { context, starts, stops, gains } = audioContext();
  const loop = new StageLoop(context, {}, '/stage.mp3', 10);
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(loop.sync(27, 0));
  assert.deepEqual(starts, [7]);
  context.currentTime += 1;
  loop.sync(28.04, 0.8);
  assert.deepEqual(starts, [7]);
  assert.ok(gains.at(-1) < gains.at(-2));
  context.currentTime += 1;
  loop.sync(33, 0);
  assert.deepEqual(starts, [7, 13]);
  loop.stop();
  loop.sync(36, 0);
  assert.deepEqual(starts, [7, 13, 16]);
  loop.dispose();
  assert.equal(stops.length, starts.length);
  assert.equal(loop.sync(36, 0), false);
});

test('changing stage during decode cannot start audio from the previous room', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array(1)));
  const { context, starts } = audioContext();
  let finish;
  context.decodeAudioData = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const loop = new StageLoop(context, {}, '/old-stage.mp3', 10);
  await new Promise((resolve) => setImmediate(resolve));
  loop.dispose();
  finish({ duration: 20 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(loop.sync(2, 0), false);
  assert.deepEqual(starts, []);
});
