import { shoutStrength } from './voice-reach.ts';
import type { Stage } from './campaign';

// Entity positions and pathfinding stay in tile space. Geometry and camera are in metres.
type Cell = [number, number];
const key = (x: number, z: number) => `${x},${z}`;
const dirs: Cell[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
export const tileAt = (stage: Stage, x: number, z: number) =>
  stage.map[Math.round(z)]?.[Math.round(x)] ?? '#';
export const TILE = 3.2;
export function canStandAt(stage: Stage, x: number, z: number) {
  const radius = 0.27;
  const minX = Math.floor((x - radius) / TILE + 0.5), maxX = Math.floor((x + radius) / TILE + 0.5);
  const minZ = Math.floor((z - radius) / TILE + 0.5), maxZ = Math.floor((z + radius) / TILE + 0.5);
  for (let iz = minZ; iz <= maxZ; iz++)
    for (let ix = minX; ix <= maxX; ix++)
      if (tileAt(stage, ix, iz) === '#') {
        const nearX = Math.max((ix - 0.5) * TILE, Math.min((ix + 0.5) * TILE, x));
        const nearZ = Math.max((iz - 0.5) * TILE, Math.min((iz + 0.5) * TILE, z));
        if (Math.hypot(x - nearX, z - nearZ) < radius) return false;
      }
  return true;
}
const walkable = (stage: Stage, x: number, z: number) => !['#', 'X'].includes(tileAt(stage, x, z));
export function clearSight(stage: Stage, x: number, z: number, px: number, pz: number) {
  const steps = Math.ceil(Math.hypot(px - x, pz - z) * 4);
  for (let i = 1; i < steps; i++)
    if (tileAt(stage, x + ((px - x) * i) / steps, z + ((pz - z) * i) / steps) === '#') return false;
  return true;
}

function search(stage: Stage, x: number, z: number, target?: Cell): Cell[] {
  const sx = Math.round(x),
    sz = Math.round(z);
  const cells: Cell[] = [[sx, sz]],
    parent: number[] = [-1],
    visited = new Set([key(sx, sz)]);
  let destination = -1;
  for (let i = 0; i < cells.length; i++) {
    const [cx, cz] = cells[i];
    if (target && cx === target[0] && cz === target[1]) {
      destination = i;
      break;
    }
    for (const [dx, dz] of dirs) {
      const tx = cx + dx,
        tz = cz + dz,
        id = key(tx, tz);
      if (visited.has(id) || !walkable(stage, tx, tz)) continue;
      visited.add(id);
      cells.push([tx, tz]);
      parent.push(i);
    }
  }
  if (!target) return cells;
  if (destination < 0) return [];
  const path: Cell[] = [];
  while (destination > 0) {
    path.push(cells[destination]);
    destination = parent[destination];
  }
  return path.reverse();
}

type Profile = {
  sight: number;
  hearing: number;
  speed: number;
  memory: number;
  gaze?: 'freeze' | 'retreat';
  blind?: boolean;
  chase?: boolean;
};
const profiles: Record<string, Profile> = {
  bacteria: { sight: 8, hearing: 4.2, speed: 12.85, memory: 4.5 },
  skinstealer: { sight: 7, hearing: 2.5, speed: 12.8, memory: 4 },
  smiler: { sight: 13, hearing: 5.6, speed: 13.1, memory: 5 },
  hound: { sight: 6, hearing: 4.8, speed: 13.05, memory: 3, gaze: 'retreat' },
  partygoer: { sight: 6, hearing: 3.15, speed: 13, memory: 2.6 },
  crawler: { sight: 0, hearing: 7.2, speed: 13, memory: 3.5, blind: true },
  animation: { sight: 8, hearing: 2, speed: 13.2, memory: 4, gaze: 'freeze' },
  king: { sight: 7, hearing: 3.5, speed: 12.9, memory: 4, gaze: 'retreat' },
  camera: { sight: 7, hearing: 0, speed: 0, memory: 1 },
  membri: { sight: 7, hearing: 1.8, speed: 13.35, memory: 0.8 },
  neighborhoodwatch: { sight: 12, hearing: 0, speed: 13.15, memory: 2.4 },
  farmer: { sight: 8, hearing: 5, speed: 13.05, memory: 5, chase: true },
  scratcher: { sight: 0, hearing: 7.2, speed: 13, memory: 3.5, blind: true },
  bonethief: { sight: 1, hearing: 0, speed: 0, memory: 0 },
  partyhost: { sight: 5, hearing: 4.1, speed: 13.1, memory: 3 },
  leviathan: { sight: 2.3, hearing: 2.3, speed: 12.9, memory: 4 },
  shark: { sight: 7, hearing: 3.8, speed: 13.05, memory: 4.2 },
  wretch: { sight: 0, hearing: 4.5, speed: 12.95, memory: 3.1, blind: true },
  moth: { sight: 2.3, hearing: 1.1, speed: 12.75, memory: 2 },
  watcher: { sight: 9, hearing: 1.4, speed: 13.3, memory: 4, gaze: 'freeze' },
  kitty: { sight: 8, hearing: 2, speed: 13.25, memory: 3, gaze: 'freeze' },
  clump: { sight: 4.4, hearing: 4.3, speed: 12.7, memory: 4.5 },
  faceling: { sight: 6, hearing: 2.2, speed: 12.7, memory: 2.6 },
};
export const playerSpeed = { walk: 4, sprint: 12, crouch: 1.75 } as const;
export const bacteriaChargeSeconds = 0.85;

export class Encounter {
  x: number;
  z: number;
  angle = 0;
  danger = 0;
  contact = false;
  contactPose = 0;
  heardVoice = false;
  heldByGaze = false;
  private stalkClock = 10;
  private pursuitSeconds = 0;
  private recovery = 0;
  get winding() { return this.pursuitSeconds >= 1.1 && this.pursuitSeconds < 1.8; }
  get lunging() { return this.pursuitSeconds >= 1.8; }
  private memory = 0;
  private repath = 0;
  private pause = 1.6;
  private attack = 0;
  reach = 0;
  private tiles: Cell[];
  private path: Cell[] = [];
  private lastSeen: Cell;
  private profile: Profile;
  readonly kind: string;
  private home: NonNullable<Stage['threat']>;
  private stage: Stage;
  private tileSize: number;
  constructor(stage: Stage, tileSize: number, threat = stage.threat!) {
    this.stage = stage;
    this.tileSize = tileSize;
    this.home = threat;
    this.x = threat.x;
    this.z = threat.z;
    this.lastSeen = [this.x, this.z];
    this.tiles = search(stage, this.x, this.z);
    this.kind = threat.kind.toLowerCase().replace(/[^a-z]/g, '');
    this.profile = { ...(profiles[this.kind] ?? profiles.bacteria) };
    if (['run', 'hotelchase', 'pipes', 'pipesreturn'].includes(stage.id)) {
      this.profile.chase = true;
      this.profile.speed = 13.15;
    }
    if (this.kind === 'smiler' && stage.id === 'slides') this.profile.gaze = 'retreat';
    if (threat.speed) this.profile.speed = threat.speed;
  }
  releaseContact() {
    this.attack = 0;
    this.contact = false;
    this.contactPose = 0;
  }
  canHearVoice(volume: number, px: number, pz: number, hidden: boolean) {
    if (volume < 0.1 || this.profile.hearing === 0) return false;
    const radius = this.profile.hearing * (0.25 + 1.25 * volume + 6 * shoutStrength(volume)) * (hidden ? 0.42 : 1);
    const distance = Math.hypot(this.x - px, this.z - pz);
    if (distance > radius) return false;
    return distance <= radius * 0.52 || clearSight(this.stage, this.x, this.z, px, pz);
  }
  investigate(x: number, z: number) {
    this.lastSeen = [x, z];
    this.memory = Math.max(this.memory, 16);
    this.repath = 0;
  }
  tick(
    dt: number,
    px: number,
    pz: number,
    visible: boolean,
    illuminated: boolean,
    moving: boolean,
    sprinting: boolean,
    crouched: boolean,
    hidden: boolean,
    flashlight: boolean,
    grace: number,
    distraction?: { x: number; z: number },
    voice = 0,
  ) {
    this.contact = false;
    this.contactPose = 0;
    const dx = this.x - px,
      dz = this.z - pz,
      distance = Math.hypot(dx, dz);
    const line = distance < 16 && clearSight(this.stage, this.x, this.z, px, pz);
    const home = this.home;
    if (this.kind === 'bonethief') {
      const withinReach = grace <= 0 && !hidden && distance < 0.77 && line;
      if (withinReach) this.angle = Math.atan2(-dx, -dz);
      this.reach = Math.max(0, Math.min(1, this.reach + dt * (withinReach ? 1.35 : -3)));
      this.contact = withinReach && this.reach >= 1;
      this.danger = this.reach;
      return;
    }
    const onPorch = this.kind === 'neighborhoodwatch' && tileAt(this.stage, px, pz) === '=';
    const beyondPartyWing = this.kind === 'partyhost' && Math.hypot(px - home.x, pz - home.z) > 4.7;
    const sheltered = onPorch || beyondPartyWing;
    const wasHearingVoice = this.heardVoice;
    this.heardVoice = !sheltered && grace <= 0 && !distraction && this.canHearVoice(voice, px, pz, hidden);
    if (this.heardVoice && !wasHearingVoice) this.repath = 0;
    hidden ||= sheltered;
    const looking = visible && line && !hidden;
    const enemyFacing = (-dx * Math.sin(this.angle) - dz * Math.cos(this.angle)) / Math.max(0.001, distance);
    const sweepingCamera = this.kind === 'camera';
    const inView = distance < 1.0 || enemyFacing > (sweepingCamera ? 0.68 : this.kind === 'neighborhoodwatch' ? 0.48 : crouched ? 0.52 : -0.32);
    if (sweepingCamera) this.angle += dt * 0.43;
    const p = this.profile,
      hearing = (sprinting ? 1.0 : crouched ? 0.1 : 0.56) * p.hearing;
    const visual =
      p.sight *
      (crouched ? 0.64 : 1) *
      (this.kind === 'leviathan' && flashlight ? 4.6 : this.kind === 'moth' && flashlight ? 3.8 : 1);
    const detectsPlayer =
      (line && !p.blind && inView && distance < visual && (!sweepingCamera || !crouched)) ||
      (moving && distance < hearing);
    const sense = grace <= 0 && !hidden && (detectsPlayer || p.chase === true);
    const exposed = this.kind === 'bacteria' && !distraction && sense && line && inView && distance < 2.2;
    this.recovery = Math.max(0, this.recovery - dt);
    if (this.lunging && !exposed) this.recovery = 3;
    this.pursuitSeconds = exposed && this.recovery === 0 ? this.pursuitSeconds + dt : 0;
    if (this.pursuitSeconds >= 1.8 + bacteriaChargeSeconds) {
      this.pursuitSeconds = 0;
      this.recovery = 3;
    }
    if (sense || this.heardVoice) {
      this.memory = p.memory;
      const nextX = Math.round(px), nextZ = Math.round(pz);
      if (!this.path.length && (this.lastSeen[0] !== nextX || this.lastSeen[1] !== nextZ)) this.repath = 0;
      this.lastSeen = [nextX, nextZ];
    } else this.memory = Math.max(0, this.memory - dt);
    if (hidden && !this.heardVoice) this.memory = 0;
    if (distraction) {
      this.memory = 2;
      this.lastSeen = [distraction.x, distraction.z];
    }
    this.danger =
      hidden || grace > 0 ? 0 : Math.max(0, Math.min(1, (1 - distance / 8) * (this.memory > 0 ? 1 : 0.38)));
    if (sweepingCamera) {
      this.attack = sense ? this.attack + dt : 0;
      this.contact = this.attack > 1.25;
      return;
    }
    this.heldByGaze = looking && p.gaze === 'freeze';
    if (grace > 0 || this.heldByGaze) {
      this.attack = 0;
      return;
    }
    const retreat = looking && p.gaze === 'retreat' && illuminated;
    this.repath -= dt;
    this.pause -= dt;
    this.stalkClock -= dt;
    if (this.repath <= 0) {
      this.repath = this.memory > 0 ? 0.45 : 1.3;
      if (retreat) {
        const near = this.tiles.filter(
          ([x, z]) => Math.hypot(this.x - x, this.z - z) < 4 && Math.hypot(px - x, pz - z) > distance + 1,
        );
        const spot = near[Math.floor(Math.random() * near.length)];
        this.path = spot ? search(this.stage, this.x, this.z, spot) : [];
      } else if (this.memory > 0) {
        this.path = search(this.stage, this.x, this.z, this.lastSeen);
      } else if (this.kind === 'partyhost' || this.kind === 'membri') {
        const post: Cell = [home.x, home.z];
        this.path = Math.round(this.x) === home.x && Math.round(this.z) === home.z
          ? [post] : search(this.stage, this.x, this.z, post);
      } else if (this.kind === 'bacteria' && !hidden && this.stalkClock <= 0) {
        const unseen = this.tiles.filter(([x, z]) => {
          const d = Math.hypot(px - x, pz - z);
          return d >= 3 && d <= 5.5 && !clearSight(this.stage, px, pz, x, z);
        });
        const spot = unseen[Math.floor(Math.random() * unseen.length)];
        if (spot) this.path = search(this.stage, this.x, this.z, spot);
        this.stalkClock = 12 + Math.random() * 7;
      } else if (!this.path.length && this.pause <= 0) {
        const near = this.tiles.filter(
          ([x, z]) =>
            Math.hypot(this.x - x, this.z - z) > 2 &&
            Math.hypot(this.x - x, this.z - z) < 8 &&
            Math.hypot(px - x, pz - z) > 1.9,
        );
        const spot = near[Math.floor(Math.random() * near.length)];
        if (spot) this.path = search(this.stage, this.x, this.z, spot);
        this.pause = 2 + Math.random() * 2.2;
      }
    }
    const tracking = !distraction && !hidden && (sense || this.heardVoice) && !retreat && line;
    const patrolSpeed = Math.min(2.4, p.speed * 0.32);
    // A lost target or a ringing phone draws a searching gait. Confirmed prey triggers the chase.
    const hunting = (sense && detectsPlayer) || this.heardVoice;
    let speed = this.memory > 0 ? Math.min(4.2, p.speed) : patrolSpeed;
    if (hunting) speed = p.speed;
    if (this.winding) speed = Math.min(0.8, p.speed);
    if (this.lunging) speed = Math.max(13.8, p.speed);
    let remaining = dt * speed / this.tileSize;
    // Spend the whole movement budget across cell centres, including frames that cross a corner.
    while (remaining > 0) {
      const ax = Math.round(this.x), az = Math.round(this.z);
      const direct = tracking && Math.round(px) === ax && Math.round(pz) === az;
      let next = direct ? [px, pz] : this.path[0];
      if (!next) break;
      let centering = false;
      if (!direct) {
        if (next[0] !== ax && Math.abs(this.z - az) > 0.035) {
          next = [this.x, az];
          centering = true;
        } else if (next[1] !== az && Math.abs(this.x - ax) > 0.035) {
          next = [ax, this.z];
          centering = true;
        }
      }
      const tx = next[0] - this.x, tz = next[1] - this.z;
      const len = Math.hypot(tx, tz);
      if (len > 0.00001) this.angle = Math.atan2(tx, tz);
      if (len > remaining) {
        this.x += tx * remaining / len;
        this.z += tz * remaining / len;
        break;
      }
      this.x = next[0];
      this.z = next[1];
      remaining -= len;
      if (direct) break;
      if (!centering) this.path.shift();
    }
    const canStrike = !distraction && !hidden && !retreat && this.memory > 0 && line;
    const reach = this.lunging ? 0.52 : 0.4;
    const hold = this.lunging ? 0.12 : 0.38;
    if (canStrike && distance < reach) {
      this.attack += dt;
      if (this.attack > hold) this.contact = true;
    } else this.attack = 0;
    if (canStrike) {
      const approach = Math.max(0, Math.min(1, (1.25 - distance) / (1.25 - reach)));
      this.contactPose = approach / 3 + (2 / 3) * Math.min(1, this.attack / hold);
    }
  }
}
