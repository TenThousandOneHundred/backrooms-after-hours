import { stages } from '../campaign.ts';
import { canStandAt, clearSight, Encounter, playerSpeed, TILE as tileSize } from '../game-entity.ts';

export const capacity = 8;
export { tileSize };
const lobby = stages.lobby;
export const level = {
  ...lobby,
  residents: [],
  additionalThreats: [],
  objects: lobby.objects.filter(
    (o) => o.gives?.some((flag) => /^rail[1-4]$/.test(flag)) || o.kind === 'exit',
  ),
};
export const rails = level.objects.filter((o) => o.kind === 'pickup');
const door = level.objects.find((o) => o.kind === 'exit')!;
export type Phase = 'waiting' | 'playing' | 'escaped' | 'lost';
export type Controls = {
  forward: number;
  side: number;
  yaw: number;
  sprint: boolean;
  crouch: boolean;
  use: boolean;
  light: boolean;
  voice: number;
};
export const still: Controls = {
  forward: 0,
  side: 0,
  yaw: 0,
  sprint: false,
  crouch: false,
  use: false,
  light: true,
  voice: 0,
};
export type Explorer = {
  slot: number;
  x: number;
  z: number;
  yaw: number;
  crouch: boolean;
  alive: boolean;
  stamina: number;
};
type Monster = {
  x: number;
  z: number;
  yaw: number;
  speed: number;
  wind: boolean;
  strike: boolean;
  heard: boolean;
  reach: number;
};
export type Snapshot = {
  phase: Phase;
  players: Explorer[];
  collected: string[];
  monster: Monster;
  round: number;
};

export function validControls(data: unknown): data is Controls {
  if (!data || typeof data !== 'object') return false;
  const c = data as Controls;
  return (
    [c.forward, c.side].every((v) => Number.isInteger(v) && Math.abs(v) <= 1) &&
    Number.isFinite(c.yaw) &&
    Number.isFinite(c.voice) &&
    c.voice >= 0 &&
    c.voice <= 1 &&
    [c.sprint, c.crouch, c.use, c.light].every((v) => typeof v === 'boolean')
  );
}

export function nearby(player: Explorer, object: { x: number; z: number }) {
  return (
    Math.hypot(player.x / tileSize - object.x, player.z / tileSize - object.z) < 1.08 &&
    clearSight(level, player.x / tileSize, player.z / tileSize, object.x, object.z)
  );
}
export function interaction(p: Explorer, collected: string[]) {
  return rails.find((o) => !collected.includes(o.id) && nearby(p, o)) ?? (nearby(p, door) ? door : undefined);
}
function spawn(slot: number): Explorer {
  return {
    slot,
    x: level.spawn[0] * tileSize + (((slot - 1) % 4) - 1.5) * 0.54,
    z: level.spawn[1] * tileSize + (slot > 4 ? 0.34 : -0.34),
    yaw: level.facing ?? 0,
    crouch: false,
    alive: true,
    stamina: 100,
  };
}

// Only the hosting tab owns this state. Guests send controls, never world positions or pickup results.
export class Expedition {
  readonly players = new Map<number, Explorer>();
  private inputs = new Map<number, { control: Controls; expires: number; use: boolean }>();
  private exhausted = new Set<number>();
  private target = 0;
  private elapsed = 0;
  private hunter = new Encounter(level, tileSize);
  private monsterSpeed = 0;
  phase: Phase = 'waiting';
  round = 0;
  collected: string[] = [];
  add() {
    if (this.players.size >= capacity) return 0;
    for (let i = 1; i <= capacity; i++)
      if (!this.players.has(i)) {
        this.players.set(i, spawn(i));
        return i;
      }
    return 0;
  }
  remove(slot: number) {
    if (this.target === slot) {
      this.target = 0;
      this.hunter.releaseContact();
    }
    this.players.delete(slot);
    this.inputs.delete(slot);
    this.exhausted.delete(slot);
  }
  start() {
    if (this.phase === 'playing') return;
    this.phase = 'playing';
    this.round++;
    this.elapsed = 0;
    this.target = 0;
    this.monsterSpeed = 0;
    this.hunter = new Encounter(level, tileSize);
    this.inputs.clear();
    this.exhausted.clear();
    this.collected = [];
    for (const slot of this.players.keys()) this.players.set(slot, spawn(slot));
  }
  input(slot: number, control: Controls) {
    if (this.phase !== 'playing' || !this.players.get(slot)?.alive || !validControls(control)) return;
    this.inputs.set(slot, {
      control,
      expires: this.elapsed + 0.55,
      use: control.use || !!this.inputs.get(slot)?.use,
    });
  }
  step(dt: number) {
    if (this.phase !== 'playing') return;
    this.elapsed += dt;
    let target: Explorer | undefined;
    let best = Infinity;
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const record = this.inputs.get(p.slot);
      const c = record && record.expires >= this.elapsed ? record.control : { ...still, yaw: p.yaw };
      const moving = !!(c.side || c.forward);
      const sprint = moving && !c.crouch && c.sprint && !this.exhausted.has(p.slot);
      p.yaw = c.yaw;
      p.crouch = c.crouch;
      p.stamina = Math.max(0, Math.min(100, p.stamina + dt * (sprint ? -11.5 : 7.3)));
      if (p.stamina <= 0.1) this.exhausted.add(p.slot);
      if (p.stamina >= 20) this.exhausted.delete(p.slot);
      const norm = Math.hypot(c.forward, c.side) || 1;
      const distance =
        ((c.crouch ? playerSpeed.crouch : sprint ? playerSpeed.sprint : playerSpeed.walk) * dt) / norm;
      const x = p.x + (Math.sin(p.yaw) * c.forward + Math.cos(p.yaw) * c.side) * distance;
      const z = p.z + (-Math.cos(p.yaw) * c.forward + Math.sin(p.yaw) * c.side) * distance;
      if (canStandAt(level, x, p.z)) p.x = x;
      if (canStandAt(level, p.x, z)) p.z = z;
      if (record?.use) {
        record.use = false;
        const o = interaction(p, this.collected);
        if (o === door && this.collected.length === rails.length) {
          this.phase = 'escaped';
          return;
        }
        if (o?.kind === 'pickup') this.collected.push(o.id);
      }
      const px = p.x / tileSize,
        pz = p.z / tileSize;
      const dist = Math.hypot(px - this.hunter.x, pz - this.hunter.z);
      const heard = this.hunter.canHearVoice(c.voice, px, pz, false);
      const visible = clearSight(level, this.hunter.x, this.hunter.z, px, pz);
      const score = dist + (visible ? 0 : 9) - (heard ? 6 : 0) - (p.slot === this.target ? 1 : 0);
      if (score < best) {
        target = p;
        best = score;
      }
    }
    if (!target) {
      this.phase = 'lost';
      return;
    }
    const input = this.inputs.get(target.slot);
    const c = input && input.expires >= this.elapsed ? input.control : still;
    if (this.target !== target.slot) this.hunter.releaseContact();
    this.target = target.slot;
    const x = this.hunter.x,
      z = this.hunter.z;
    this.hunter.tick(
      dt,
      target.x / tileSize,
      target.z / tileSize,
      false,
      false,
      !!(c.forward || c.side),
      c.sprint,
      c.crouch,
      false,
      c.light,
      Math.max(0, 8 - this.elapsed),
      undefined,
      c.voice,
    );
    this.monsterSpeed = (Math.hypot(x - this.hunter.x, z - this.hunter.z) * tileSize) / dt;
    if (this.hunter.contact) {
      target.alive = false;
      if (![...this.players.values()].some((p) => p.alive)) this.phase = 'lost';
    }
  }
  snapshot(): Snapshot {
    const h = this.hunter;
    return {
      phase: this.phase,
      round: this.round,
      players: [...this.players.values()].map((p) => ({ ...p })),
      collected: [...this.collected],
      monster: {
        x: h.x * tileSize,
        z: h.z * tileSize,
        yaw: h.angle,
        speed: this.monsterSpeed,
        wind: h.winding,
        strike: h.lunging,
        heard: h.heardVoice,
        reach: h.contactPose,
      },
    };
  }
}
