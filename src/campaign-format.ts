import type { ResidentSite } from './resident-behavior';
import type { Challenge } from './campaign-challenges';
export type Theme = string;
export type ObjKind = 'pickup' | 'switch' | 'code' | 'exit' | 'ending' | 'note' | 'hide';
export type GameObject = {
  id: string;
  kind: ObjKind;
  x: number;
  z: number;
  name: string;
  description?: string;
  need?: string[];
  gives?: string[];
  consumes?: string[];
  target?: string;
  ending?: string;
  code?: string;
  model?: string;
  color?: number;
  challenge?: Challenge;
};
export type Prop = { x: number; z: number; model: string; color?: number; label?: string; rotation?: number };
export type Threat = { kind: string; x: number; z: number; speed?: number };
export type Stage = {
  additionalThreats?: Threat[];
  residents?: ResidentSite[];
  id: string;
  name: string;
  label: string;
  theme: Theme;
  description: string;
  map: string[];
  spawn: [number, number];
  facing?: number;
  objects: GameObject[];
  props: Prop[];
  threat?: Threat;
  objective?: string;
};

type Action = Omit<GameObject, 'x' | 'z' | 'id'> & { token?: string };
type Decoration = Omit<Prop, 'x' | 'z'>;
type Marker = Action | Decoration | { monster: string };
type Markers = Record<string, Marker>;

// Each marker occupies one tile. Repeated scenery markers create individual props.
export function stage(
  id: string,
  label: string,
  name: string,
  theme: Theme,
  description: string,
  objective: string,
  blueprint: string,
  markers: Markers,
  entity?: string,
  facing = 0,
): Stage {
  const rows = blueprint
    .trim()
    .split('\n')
    .map((line) => line.trim());
  const width = Math.max(...rows.map((row) => row.length));
  const map: string[] = [],
    objects: GameObject[] = [],
    props: Prop[] = [];
  const residents: ResidentSite[] = [];
  const additionalThreats: Threat[] = [];
  let spawn: [number, number] | undefined;
  let threat: Stage['threat'];
  const counts = new Map<string, number>();
  for (let z = 0; z < rows.length; z++) {
    const row = [...rows[z].padEnd(width, '#')]
      .map((tile, x) => {
        if (tile === '#' || tile === '.' || tile === '|' || tile === '=') return tile;
        if (tile === '&' || tile === '%') {
          residents.push({ x, z, kind: tile === '&' ? 'bellwether' : 'veil' });
          return '.';
        }
        if (tile === '~') return '!';
        if (tile === '@') {
          if (spawn) throw new Error(id + ' has duplicate spawn');
          spawn = [x, z];
          return '.';
        }
        if (tile === '!') {
          if (!entity) throw new Error(id + ' missing entity');
          threat = { kind: entity, x, z };
          return '.';
        }
        const marker = markers[tile];
        if (!marker) throw new Error(id + ': unmapped tile ' + tile);
        if ('monster' in marker) {
          additionalThreats.push({ kind: marker.monster, x, z });
          return '.';
        }
        const count = (counts.get(tile) ?? 0) + 1;
        counts.set(tile, count);
        if ('kind' in marker) {
          const { token, ...action } = marker;
          objects.push({ ...action, x, z, id: id + '-' + (token ?? tile) + (count > 1 ? '-' + count : '') });
        } else {
          props.push({ ...marker, x, z });
        }
        return 'model' in marker && marker.model === 'pit' ? 'X' : '.';
      })
      .join('');
    map.push(row);
  }
  if (!spawn) throw new Error(id + ' missing spawn');
  // Keep an authored view whenever possible. A cramped landing should still face open floor.
  const sightLength = (angle: number) => {
    const dx = Math.round(Math.sin(angle)),
      dz = -Math.round(Math.cos(angle));
    let distance = 0;
    while (distance < 8 && map[spawn![1] + dz * (distance + 1)]?.[spawn![0] + dx * (distance + 1)] === '.')
      distance++;
    return distance;
  };
  if (!sightLength(facing))
    facing = [0, Math.PI / 2, Math.PI, -Math.PI / 2].sort((a, b) => sightLength(b) - sightLength(a))[0];
  return { id, label, name, theme, description, objective, map, spawn, facing, objects, props, threat, residents, additionalThreats };
}

export const item = (
  name: string,
  flag: string,
  model: string,
  description: string,
  need: string[] = [],
): Action => ({ kind: 'pickup', name, model, description, need, gives: [flag], token: flag });
export const act = (
  name: string,
  flag: string,
  model: string,
  description: string,
  need: string[] = [],
): Action => ({ kind: 'switch', name, model, description, need, gives: [flag], token: flag });
export const code = (
  name: string,
  digits: string,
  flag: string,
  description: string,
  need: string[] = [],
): Action => ({
  kind: 'code',
  name,
  model: 'terminal',
  description,
  need,
  code: digits,
  gives: [flag],
  token: flag,
});
export const exit = (name: string, target: string, need: string[] = [], model = 'door'): Action => ({
  kind: 'exit',
  name,
  model,
  target,
  need,
});
export const note = (name: string, description: string, model = 'note'): Action => ({
  kind: 'note',
  name,
  model,
  description,
});
export const hide = (name: string, model = 'locker'): Action => ({
  kind: 'hide',
  name,
  model,
  description: 'Stay still. Listen for the footsteps to recede.',
});
export const end = (
  ending: string,
  name: string,
  need: string[],
  description: string,
  model = 'door',
): Action => ({ kind: 'ending', ending, name, model, need, target: 'bunker', description, gives: [ending] });
export const prop = (model: string, color?: number, label?: string, rotation?: number): Decoration => ({
  model,
  color,
  label,
  rotation,
});
export const rangeFlags = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => prefix + (i + 1));
export const noteKeys = (labels: string[], prefix: string, model: string, start = 1): Markers =>
  Object.fromEntries(
    labels.map((label, i) => [String(i + start), item(label, prefix + (i + 1), model, label + ' secured.')]),
  );

export const challenge = (action: Action, spec: Challenge): Action => ({ ...action, challenge: spec });
