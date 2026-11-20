import type { Snapshot } from './expedition';

type Row = Snapshot['players'][number] | Snapshot['monsters'][number] | Snapshot['residents'][number];
type Changes<T> = [number, Partial<T>][];
type Group = 'players' | 'monsters' | 'residents';
type Delta = Omit<Snapshot, Group | 'journal'> & { [K in Group]: Changes<Snapshot[K][number]> };

// The reliable, ordered room channel lets each guest build on its last delivered frame.
function changes<T extends Row>(before: T[], after: T[]): Changes<T> | undefined {
  if (before.length !== after.length) return;
  const result: Changes<T> = [];
  for (let i = 0; i < after.length; i++) {
    const old = before[i], next = after[i];
    const keys = Object.keys(next) as (keyof T)[];
    if (keys.length !== Object.keys(old).length) return;
    let patch: Partial<T> | undefined;
    for (const key of keys) {
      if (!Object.hasOwn(old, key)) return;
      if (next[key] !== old[key]) {
        patch ??= {};
        patch[key] = next[key];
      }
    }
    if (patch) result.push([i, patch]);
  }
  return result;
}

export function stateDelta(previous: Snapshot, next: Snapshot): Delta | undefined {
  if (previous.epoch !== next.epoch || previous.revision !== next.revision || previous.phase !== next.phase ||
      next.players.some((p, i) => previous.players[i]?.slot !== p.slot)) return;
  const { journal, players, monsters, residents, ...meta } = next;
  const p = changes(previous.players, players), m = changes(previous.monsters, monsters), r = changes(previous.residents, residents);
  if (p && m && r) return { ...meta, players: p, monsters: m, residents: r };
}

function restore<T extends Row>(before: T[], patches: Changes<T>): T[] | undefined {
  if (!Array.isArray(patches) || patches.length > before.length) return;
  if (!patches.length) return before;
  const result = before.slice();
  for (const entry of patches) {
    if (!Array.isArray(entry)) return;
    const [index, patch] = entry;
    if (!Number.isInteger(index) || !before[index] || !patch || typeof patch !== 'object' ||
        !Object.keys(patch).every(key => Object.hasOwn(before[index], key))) return;
    result[index] = { ...before[index], ...patch };
  }
  return result;
}

export function applyStateDelta(previous: Snapshot, packet: unknown): Snapshot | undefined {
  if (!packet || typeof packet !== 'object') return;
  const delta = packet as Delta;
  if (delta.epoch !== previous.epoch || delta.revision !== previous.revision || delta.phase !== previous.phase ||
      !Number.isFinite(delta.time)) return;
  const players = restore(previous.players, delta.players), monsters = restore(previous.monsters, delta.monsters),
    residents = restore(previous.residents, delta.residents);
  if (players && monsters && residents) return { ...delta, players, monsters, residents, journal: previous.journal };
}
