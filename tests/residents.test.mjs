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

test('the exported resident actions animate only joints of their own rig', async () => {
  const { readFile } = await import('node:fs/promises');
  const data = await readFile(new URL('../public/models/residents.glb', import.meta.url));
  const model = JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)));
  const names = model.animations.map(a => a.name).sort();
  assert.deepEqual(names, ['BellKnock', 'BellListen', 'BellRoost', 'BellToll', 'VeilDrift', 'VeilFixate']);
  for (const clip of model.animations) {
    const veil = clip.name.startsWith('Veil');
    const skin = model.skins.find(s => s.joints.some(i => model.nodes[i].name === (veil ? 'Mask0' : 'Tongue')));
    assert.ok(clip.channels.every(c => skin.joints.includes(c.target.node)));
    const rotations = clip.channels.filter(c => c.target.path === 'rotation')
      .map(c => model.nodes[c.target.node].name);
    for (const part of veil ? ['Mask0', 'Mask1', 'Mask2', 'Tatter0'] : ['Tongue', 'Petal0', 'Petal9'])
      assert.ok(rotations.includes(part), clip.name + ' missing ' + part);
  }
});
