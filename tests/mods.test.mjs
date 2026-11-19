import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMod } from '../src/mods.ts';

const sample = readFileSync(new URL('../public/mods/dead-letter.json', import.meta.url), 'utf8');
const guide = readFileSync(new URL('../public/modding.html', import.meta.url), 'utf8');
const tutorial = guide.match(/<pre><code>([^<]+)<\/code><\/pre>/)[1];

test('the guide and downloadable sample compile into playable expeditions', () => {
  const short = parseMod(tutorial);
  assert.equal(short.stages[short.start].objects.find(o => o.kind === 'ending').ending, 'mod-escape');
  const pack = parseMod(sample);
  const first = pack.stages[pack.start];
  const exit = first.objects.find(o => o.kind === 'exit');
  assert.deepEqual(exit.need, first.objects.find(o => o.model === 'key').gives);
  const second = pack.stages[exit.target];
  assert.equal(second.residents[0].kind, 'bellwether');
  assert.equal(second.objects.find(o => o.kind === 'code').code, '0417');
  assert.ok(first.objects.some(o => o.gives?.includes('torch')));
});

test('custom hunters, speed, residents, switches, props and lockers use the game format', () => {
  const mod = JSON.parse(tutorial), room = mod.levels[0];
  room.map[2] = '#!%&HS..#';
  room.monster = 'crawler';
  room.speed = 2.4;
  room.markers.H = { kind: 'hide', name: 'Climb inside' };
  room.markers.S = { kind: 'switch', name: 'Restore power', gives: 'power' };
  room.markers.E.need.push('power');
  const result = parseMod(JSON.stringify(mod)).stages['mod-1'];
  assert.equal(result.threat.speed, 2.4);
  assert.equal(result.threat.kind, 'crawler');
  assert.equal(result.residents.length, 2);
  assert.equal(result.objects.find(o => o.kind === 'hide').model, 'locker');
});

test('invalid mods identify malformed fields, maps and progression', () => {
  for (const [mutate, expected] of [
    [pack => { pack.format = 2; }, /format/],
    [pack => { pack.levels[0].map[1] = '#@.K..Q.#'; }, /row 2, column 7/],
    [pack => { pack.levels[0].map[0] = '.........'; }, /enclose/],
    [pack => { pack.levels[0].map[2] = '#..@....#'; }, /one @/],
    [pack => { pack.levels[0].map[1] = '#@#K..E.#'; pack.levels[0].map[2] = '#.#.....#'; }, /walled off/],
    [pack => { pack.levels[0].monster = 'hound'; }, /pair one !/],
    [pack => { pack.levels[0].markers.E.need = ['missing']; }, /reachable escape/],
    [pack => { pack.levels[0].markers.E = { kind: 'exit', name: 'Go', to: 'missing' }; }, /unknown level/],
    [pack => { pack.levels[0].markers.K.script = 'unused'; }, /unknown field/],
  ]) {
    const pack = JSON.parse(tutorial);
    mutate(pack);
    assert.throws(() => parseMod(JSON.stringify(pack)), expected);
  }
  assert.throws(() => parseMod('{'), /JSON/);
  assert.throws(() => parseMod(' '.repeat(131073)), /128 KiB/);
});
