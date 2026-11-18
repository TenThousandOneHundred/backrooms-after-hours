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

export function loadProgress(): Progress | null {
  try {
    const raw = localStorage.getItem(SLOT);
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
    return result;
  } catch {
    return null;
  }
}

export function storeProgress(state: Progress): boolean {
  try {
    localStorage.setItem(SLOT, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
