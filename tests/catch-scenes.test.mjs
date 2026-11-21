import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { creatureLibraries } from '../src/creature-roster.ts';
import { catchShot, catchShots } from '../src/catch-shots.ts';

test('every hunter, resident and security camera has its own catch film and reduced-motion still', async () => {
  const roster = [
    'bacteria',
    'veil',
    'bellwether',
    ...Object.values(creatureLibraries).flatMap(Object.keys),
  ].sort();
  assert.deepEqual(Object.keys(catchShots).sort(), roster);
  assert.equal(catchShot('constructor'), undefined);
  const films = new Set(),
    posters = new Set();
  for (const kind of roster) {
    const url = new URL(
      '../public/encounters/catches/' + kind,
      import.meta.url
    );
    const [film, poster] = await Promise.all(
      ['.mp4', '.webp'].map((ext) => readFile(new URL(url.href + ext)))
    );
    assert.equal(film.toString('ascii', 4, 8), 'ftyp', kind);
    assert.ok(
      film.indexOf('moov') < film.indexOf('mdat'),
      kind + ' begins playback before the file ends'
    );
    assert.equal(poster.toString('ascii', 8, 12), 'WEBP', kind);
    films.add(createHash('sha256').update(film).digest('hex'));
    posters.add(createHash('sha256').update(poster).digest('hex'));
  }
  assert.equal(films.size, roster.length);
  assert.equal(posters.size, roster.length);
});
