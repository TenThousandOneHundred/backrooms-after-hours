import { stage, type Stage, type GameObject } from './campaign-format.ts';

export const MOD_LIMIT = 128 * 1024;
const themes = ['lobby', 'hotel', 'pool', 'pipes', 'archive', 'office', 'garage', 'arcade', 'blackout'];
const monsters = ['bacteria', 'hound', 'smiler', 'crawler', 'watcher', 'partygoer', 'neighborhoodwatch', 'farmer', 'membri', 'scratcher', 'bonethief', 'partyhost'];
const models = ['key', 'flashlight', 'note', 'door', 'elevator', 'terminal', 'breaker', 'locker',
  'shelf', 'desk', 'chair', 'crate', 'barrel', 'plant', 'valve', 'sign'];
const defaults = { pickup: 'key', switch: 'breaker', code: 'terminal', hide: 'locker',
  note: 'note', exit: 'door', escape: 'door', prop: 'crate' };
type Marker = Parameters<typeof stage>[7][string];

export type ModPack = {
  name: string;
  start: string;
  stages: Record<string, Stage>;
};

function fail(path: string, message: string): never {
  throw new Error(path + ' — ' + message);
}
function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected an object');
  return value as Record<string, unknown>;
}
function fields(obj: Record<string, unknown>, allowed: string[], path: string) {
  for (const key of Object.keys(obj)) if (!allowed.includes(key)) fail(path + '.' + key, 'unknown field');
}
function string(value: unknown, path: string, max = 240): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    fail(path, 'expected text of 1–' + max + ' characters');
  return value.trim();
}
function id(value: unknown, path: string) {
  const s = string(value, path, 32);
  if (!/^[a-z][a-z0-9-]*$/.test(s)) fail(path, 'use lowercase letters, digits, or hyphens, starting with a letter');
  return s;
}
function choice(value: unknown, options: string[], path: string) {
  if (typeof value !== 'string' || !options.includes(value)) fail(path, 'choose ' + options.join(', '));
  return value;
}
function flag(value: unknown, path: string) {
  const name = id(value, path);
  return name === 'torch' ? name : 'flag-' + name;
}
function readMarker(data: unknown, path: string, destinations: Map<string, string>): Marker {
  const m = record(data, path);
  const kind = choice(m.kind, Object.keys(defaults), path + '.kind') as keyof typeof defaults;
  const allowed = ['kind', 'model'];
  if (kind !== 'prop') allowed.push('name');
  if (['note', 'pickup', 'switch', 'code'].includes(kind)) allowed.push('text');
  if (['pickup', 'switch', 'code'].includes(kind)) allowed.push('gives');
  if (['pickup', 'switch', 'code', 'exit', 'escape'].includes(kind)) allowed.push('need');
  if (kind === 'code') allowed.push('code');
  if (kind === 'exit') allowed.push('to');
  fields(m, allowed, path);
  const model = m.model === undefined ? defaults[kind] : choice(m.model, models, path + '.model');
  if (kind === 'prop') return { model };
  const action: Omit<GameObject, 'id' | 'x' | 'z'> = {
    kind: kind === 'escape' ? 'ending' : kind, name: string(m.name, path + '.name', 72), model,
  };
  if (kind === 'note' || m.text !== undefined) action.description = string(m.text, path + '.text');
  if (['pickup', 'switch', 'code'].includes(kind)) action.gives = [flag(m.gives, path + '.gives')];
  if (m.need !== undefined) {
    if (!Array.isArray(m.need) || m.need.length > 16) fail(path + '.need', 'expected a list of up to 16 flags');
    action.need = m.need.map(v => flag(v, path + '.need'));
  }
  if (kind === 'code') action.code = string(m.code, path + '.code', 32);
  if (kind === 'exit') {
    const dest = id(m.to, path + '.to');
    action.target = destinations.get(dest) ?? fail(path + '.to', 'unknown level ' + dest);
  }
  if (kind === 'escape') action.ending = 'mod-escape';
  return action;
}

export function parseMod(source: string): ModPack {
  if (new TextEncoder().encode(source).length > MOD_LIMIT) fail('File', 'limit is 128 KiB');
  let json: unknown;
  try { json = JSON.parse(source); } catch (e) { fail('JSON', (e as Error).message); }
  const pack = record(json, 'Mod');
  fields(pack, ['format', 'name', 'start', 'levels'], 'Mod');
  if (pack.format !== 1) fail('format', 'expected the number 1');
  const name = string(pack.name, 'name', 72);
  if (!Array.isArray(pack.levels) || !pack.levels.length || pack.levels.length > 12)
    fail('levels', 'include 1–12 levels');
  const destinations = new Map<string, string>();
  const levels = pack.levels.map((data, i) => {
    const path = 'levels[' + i + ']';
    const level = record(data, path);
    fields(level, ['id', 'name', 'objective', 'theme', 'map', 'markers', 'monster', 'speed'], path);
    const key = id(level.id, path + '.id');
    if (destinations.has(key)) fail(path + '.id', 'duplicate level ' + key);
    const internal = 'mod-' + (i + 1);
    destinations.set(key, internal);
    return { level, path: key, internal };
  });
  const start = destinations.get(id(pack.start, 'start')) ?? fail('start', 'unknown starting level');
  const stages: Record<string, Stage> = {};
  for (const { level, path, internal } of levels) {
    const title = string(level.name, path + '.name', 72);
    const objective = string(level.objective, path + '.objective');
    const theme = choice(level.theme, themes, path + '.theme');
    const rows = level.map;
    if (!Array.isArray(rows) || rows.length < 3 || rows.length > 32) fail(path + '.map', 'use 3–32 rows');
    const width = typeof rows[0] === 'string' ? rows[0].length : 0;
    const legend = record(level.markers, path + '.markers');
    const markers: Record<string, Marker> = {};
    for (const [letter, data] of Object.entries(legend)) {
      if (!/^[A-Z]$/.test(letter)) fail(path + '.markers', 'each marker must be one uppercase letter');
      markers[letter] = readMarker(data, path + '.markers.' + letter, destinations);
    }
    let spawns = 0, hunters = 0, residents = 0, objects = 0;
    for (const [y, row] of rows.entries()) {
      const loc = path + '.map row ' + (y + 1);
      if (typeof row !== 'string' || width < 3 || width > 32 || row.length !== width)
        fail(loc, 'use equal widths of 3–32 characters');
      for (let x = 0; x < width; x++) {
        const tile = row[x];
        if ((y === 0 || x === 0 || y === rows.length - 1 || x === width - 1) && tile !== '#')
          fail(loc, 'enclose the map with # walls');
        if (tile === '@') spawns++;
        else if (tile === '!') hunters++;
        else if (tile === '%' || tile === '&') residents++;
        else if (Object.hasOwn(markers, tile)) objects++;
        else if (!'#.='.includes(tile)) fail(loc + ', column ' + (x + 1), 'undefined tile ' + tile);
      }
    }
    if (spawns !== 1) fail(path + '.map', 'place exactly one @ spawn');
    if (residents > 6 || objects > 96) fail(path + '.map', 'limit is 6 residents and 96 letter tiles per level');
    const monster = level.monster === undefined ? undefined : choice(level.monster, monsters, path + '.monster');
    if (hunters !== (monster ? 1 : 0)) fail(path + '.map', 'pair one ! tile with one monster, or omit both');
    const room = stage(internal, name, title, theme, objective, objective, rows.join('\n'), markers, monster);
    if (level.speed !== undefined) {
      if (!room.threat || typeof level.speed !== 'number' || level.speed < 0.5 || level.speed > 16)
        fail(path + '.speed', 'use 0.5–16 with a roaming monster');
      room.threat.speed = level.speed;
    }
    checkRoomAccess(room, path);
    stages[internal] = room;
  }
  checkProgression(stages, start);
  return { name, start, stages };
}

function checkRoomAccess(room: Stage, path: string) {
  const width = room.map[0].length;
  const [x, z] = room.spawn;
  const queue = [z * width + x];
  const visited = new Set(queue);
  for (let i = 0; i < queue.length; i++) {
    const tile = queue[i];
    for (const next of [tile - 1, tile + 1, tile - width, tile + width]) {
      if (visited.has(next) || room.map[Math.floor(next / width)][next % width] === '#') continue;
      visited.add(next);
      queue.push(next);
    }
  }
  for (const obj of room.objects) {
    if (!visited.has(obj.z * width + obj.x))
      fail(path + '.map', obj.name + ' is walled off from the spawn');
  }
}

function checkProgression(stages: Record<string, Stage>, start: string) {
  const reachable = new Set([start]);
  const obtainable = new Set<string>();
  let escaped = false;
  let previousCount: number;
  do {
    previousCount = reachable.size + obtainable.size;
    for (const key of reachable) {
      for (const obj of stages[key].objects) {
        if (obj.need?.some(flag => !obtainable.has(flag))) continue;
        for (const flag of obj.gives ?? []) obtainable.add(flag);
        if (obj.target) reachable.add(obj.target);
        if (obj.kind === 'ending') escaped = true;
      }
    }
  } while (previousCount !== reachable.size + obtainable.size);
  if (!escaped) fail('levels', 'add a reachable escape marker and check its required flags and exits');
  if (reachable.size !== Object.keys(stages).length) fail('levels', 'some levels are unreachable from start');
}
