const SLOT = 'backrooms-after-hours.campaign.v1';

export type Position = { x: number; z: number; yaw: number; pitch: number };
export type Progress = {
  version: 1;
  stage: string;
  flags: string[];
  completed: string[];
  endings: string[];
  inventory: Record<string, string>;
  position: Position | null;
  checkpoint: Position | null;
  pending: { ending: string; target: string } | null;
  sanity: number;
  stamina: number;
  flashlight: boolean;
};

export function freshProgress(stage: string): Progress {
  return {
    version: 1,
    stage,
    flags: [],
    completed: [],
    endings: [],
    inventory: {},
    position: null,
    checkpoint: null,
    pending: null,
    sanity: 100,
    stamina: 100,
    flashlight: false,
  };
}

const stringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
const boundedStat = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 100;

type Cursor = { run: string; expected: string | null };
type Result = 'saved' | 'unavailable' | 'stale';
const cursors = new WeakMap<Progress, Cursor>();
const sessions = new Map<string, { snapshot: Progress; cursor: Cursor; pending: number; failed: boolean }>();

function revision(raw: string | null): string | null {
  if (!raw) return null;
  try { return JSON.parse(raw).revision ?? raw; } catch { return raw; }
}

export function loadProgress(slot = SLOT): Progress | null {
  const recent = sessions.get(slot);
  let raw: string | null;
  try { raw = localStorage.getItem(slot); } catch { raw = null; }
  if (recent && (recent.failed || (recent.pending && revision(raw) === recent.cursor.expected))) {
    const copy = structuredClone(recent.snapshot);
    cursors.set(copy, recent.cursor);
    return copy;
  }
  try {
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (
      data?.version !== 1 ||
      typeof data.stage !== 'string' ||
      !stringList(data.flags) ||
      !stringList(data.completed) ||
      !stringList(data.endings)
    )
      return null;
    const result = freshProgress(data.stage);
    result.flags = [...new Set<string>(data.flags)];
    result.completed = [...new Set<string>(data.completed)];
    result.endings = [...new Set<string>(data.endings)];
    result.sanity = boundedStat(data.sanity);
    result.stamina = boundedStat(data.stamina);
    result.flashlight = data.flashlight === true;
    if (data.inventory && typeof data.inventory === 'object' && !Array.isArray(data.inventory)) {
      result.inventory = Object.fromEntries(
        Object.entries(data.inventory).filter(([, value]) => typeof value === 'string'),
      ) as Record<string, string>;
    }
    for (const key of ['position', 'checkpoint'] as const) {
      const p = data[key];
      if (p && [p.x, p.z, p.yaw, p.pitch].every(Number.isFinite))
        result[key] = { x: p.x, z: p.z, yaw: p.yaw, pitch: p.pitch };
    }
    if (typeof data.pending?.ending === 'string' && typeof data.pending?.target === 'string')
      result.pending = data.pending;
    cursors.set(result, { run: data.run ?? crypto.randomUUID(), expected: revision(raw) });
    return result;
  } catch {
    return null;
  }
}

export async function storeProgress(state: Progress, slot = SLOT): Promise<Result> {
  const recent = sessions.get(slot);
  let cursor = cursors.get(state);
  const predecessor = !cursor && recent?.pending ? recent.cursor : undefined;
  if (!cursor) {
    let baseline = null;
    try { baseline = revision(localStorage.getItem(slot)); } catch { /* Session-only storage. */ }
    cursor = { run: crypto.randomUUID(), expected: baseline };
    cursors.set(state, cursor);
  }
  const owner = cursor;
  const snapshot = structuredClone(state);
  const entry = recent?.cursor === owner ? recent : { snapshot, cursor: owner, pending: 0, failed: false };
  sessions.set(slot, entry);
  entry.snapshot = snapshot;
  entry.pending++;
  function write(): Result {
    const stored = revision(localStorage.getItem(slot));
    if (stored !== owner.expected && (!predecessor || stored !== predecessor.expected)) return 'stale';
    const next = crypto.randomUUID();
    localStorage.setItem(slot, JSON.stringify({ ...snapshot, run: owner.run, revision: next }));
    owner.expected = next;
    return 'saved';
  }
  try {
    const locks = globalThis.navigator?.locks;
    if (!locks) { entry.failed = true; return 'unavailable'; }
    const result = await locks.request(slot, write);
    entry.failed = false;
    return result;
  } catch {
    entry.failed = true;
    return 'unavailable';
  } finally {
    entry.pending--;
  }
}
