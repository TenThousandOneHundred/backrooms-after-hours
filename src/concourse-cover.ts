// All bounds are in world metres. Their vertical coordinates are relative to
// the floor of the feature, including the recessed basement plant.
import { concourseFloor } from './concourse-plan.ts';
import { TILE as tile } from './world-units.ts';
export const bodyRadius = 0.27,
  standingHeight = 1.76,
  crouchingHeight = 1.13;
export type CoverKind = 'alcove' | 'closet' | 'duct' | 'cubicle' | 'machine';
export type Bounds = { x0: number; x1: number; z0: number; z1: number; bottom: number; top: number };
type Part = Bounds & { color: string };
type Site = { kind: CoverKind; x: number; z: number; floor: number; parts: Part[]; zone: Bounds; door: number };
export type Body = { x: number; z: number };
export const covers: Site[] = [];
export const closets: Site[] = [];
function site(kind: CoverKind, tx: number, tz: number, width: number, length: number) {
  const x = tx * tile,
    z = tz * tile,
    floor = concourseFloor(tx, tz);
  const s: Site = {
    kind,
    x,
    z,
    floor,
    parts: [],
    zone: {
      x0: x - width / 2,
      x1: x + width / 2,
      z0: z - length / 2,
      z1: z + length / 2,
      bottom: floor,
      top: floor + 2.2,
    },
    door: -1,
  };
  covers.push(s);
  function part(cx: number, cz: number, w: number, d: number, bottom: number, top: number, color: string) {
    s.parts.push({
      x0: x + cx - w / 2,
      x1: x + cx + w / 2,
      z0: z + cz - d / 2,
      z1: z + cz + d / 2,
      bottom: floor + bottom,
      top: floor + top,
      color,
    });
  }
  return { s, part };
}

// Sheltered rear pocket behind an offset return wall, with one open approach.
for (const tx of [9, 22]) {
  const { part } = site('alcove', tx, 1, 4.4, 1.5);
  part(-2.45, 1.6, 0.36, 6.2, 0, 3.1, '#505550');
  part(2.45, 1.6, 0.36, 6.2, 0, 3.1, '#5d6058');
  part(0, -1.37, 5.2, 0.28, 0, 3.1, '#3d413d');
  part(-0.76, 1.32, 3.35, 0.32, 0, 2.8, '#565b55');
  part(0, 1.6, 5.26, 6.25, 2.8, 3.3, '#454c47');
}
const panelWidth = 1.32,
  doorDepth = 0.12;
for (const [tx, tz] of [
  [1.05, 17],
  [61.95, 6],
  [30.05, 40],
]) {
  const { s, part } = site('closet', tx, tz, 2.85, 2.75);
  s.door = closets.length;
  closets.push(s);
  part(-1.68, 0, 0.2, 3.48, 0, 2.54, '#525e59');
  part(1.68, 0, 0.2, 3.48, 0, 2.54, '#525e59');
  part(0, -1.65, 3.48, 0.2, 0, 2.54, '#43504c');
  part(-0.72, 1.63, 1.85, 0.2, 0, 2.54, '#626c62');
  part(1.55, 1.63, 0.28, 0.2, 0, 2.54, '#626c62');
  part(0.81, 1.63, 1.35, 0.2, 2.04, 2.54, '#697267');
  for (const h of [0.56, 1.48]) part(-1.35, -1, 0.35, 0.8, h - 0.0275, h + 0.0275, '#676e63');
  part(0, 0, 3.55, 3.55, 2.47, 2.65, '#47524c');
}
for (const [tx, tz, rows] of [
  [84, 12, 5],
  [67, 5.5, 4],
]) {
  const length = rows * tile;
  const { part } = site('duct', tx, tz, 1.3, length - 1.8);
  // Fill the cut through the masonry completely. Only the steel airway is passable.
  for (const sign of [-1, 1]) part(sign * 1.15, 0, 0.9, length, 0, 3.08, '#596260');
  part(0, 0, 1.41, length, 1.23, 2.95, '#465250');
}
for (const tz of [11.22])
  for (const tx of [87.5, 89]) {
    const { part } = site('cubicle', tx, tz, 3.55, 2.3);
    part(0, -1.4, 4.25, 0.15, 0, 1.44, '#5e6e5c');
    part(-2.05, -0.03, 0.15, 2.9, 0, 1.44, '#737965');
    part(2.05, -0.65, 0.15, 1.57, 0, 1.44, '#697461');
    // Narrow worktop at the back leaves the kneeling bay and its entrance clear.
    part(0, -1.01, 3.86, 0.64, 0.71, 0.79, '#797766');
  }
for (const [tx, tz] of [
  [86.5, 43],
]) {
  const { part } = site('machine', tx, tz, 1.6, 4.6);
  for (const sign of [-1, 1]) {
    part(sign * 1.96, 0, 1.9, 7.3, 0, 1.6, '#484f4c');
    part(sign * 1.96, 0, 2.15, 7.6, 0, 0.25, '#60635b');
  }
  part(0, 0, 6.02, 7.45, 1.25, 2.03, '#667167');
  part(0, 0, 5.6, 6.88, 2.03, 3.65, '#697369');
}
const buckets = new Map<string, Site[]>();
for (const s of covers) {
  const xs = s.parts.flatMap((p) => [p.x0, p.x1]),
    zs = s.parts.flatMap((p) => [p.z0, p.z1]);
  for (let z = Math.floor((Math.min(...zs) - 0.5) / tile); z <= Math.floor((Math.max(...zs) + 0.5) / tile); z++)
    for (
      let x = Math.floor((Math.min(...xs) - 0.5) / tile);
      x <= Math.floor((Math.max(...xs) + 0.5) / tile);
      x++
    ) {
      const key = x + ',' + z,
        bucket = buckets.get(key) ?? [];
      bucket.push(s);
      buckets.set(key, bucket);
    }
}
function nearby(x: number, z: number) {
  return buckets.get(Math.floor(x / tile) + ',' + Math.floor(z / tile)) ?? [];
}
export function doorCenterX(s: Site, travel: number) {
  return s.x + 0.81 - travel * 1.41;
}
export function doorPanel(s: Site, travel: number): Bounds {
  const cx = doorCenterX(s, travel);
  return {
    x0: cx - panelWidth / 2,
    x1: cx + panelWidth / 2,
    z0: s.z + 1.63 - doorDepth / 2,
    z1: s.z + 1.63 + doorDepth / 2,
    bottom: s.floor,
    top: s.floor + 2.04,
  };
}
function touches(p: Bounds, x: number, z: number, r: number) {
  return Math.hypot(x - Math.max(p.x0, Math.min(x, p.x1)), z - Math.max(p.z0, Math.min(z, p.z1))) < r;
}
export function coverFits(x: number, z: number, crouch: boolean, jump = 0, doors: readonly number[] = []) {
  const foot = concourseFloor(x / tile, z / tile),
    head = foot + Math.max(0, jump) + (crouch ? crouchingHeight : standingHeight);
  const hits = (b: Bounds) => head > b.bottom && foot < b.top && touches(b, x, z, bodyRadius);
  return !nearby(x, z).some(
    (s) => s.parts.some(hits) || (s.door >= 0 && hits(doorPanel(s, doors[s.door] ?? 0))),
  );
}
export function headroom(x: number, z: number) {
  const floor = concourseFloor(x / tile, z / tile);
  let clearance = Infinity;
  for (const s of nearby(x, z))
    for (const b of s.parts)
      if (b.bottom >= floor + crouchingHeight && touches(b, x, z, bodyRadius))
        clearance = Math.min(clearance, b.bottom - floor);
  return clearance;
}
export function coverZone(x: number, z: number, crouch: boolean, doors: readonly number[], jump = 0) {
  if (jump > 0.08) return;
  return nearby(x, z).find((s) => {
    const b = s.zone;
    return (
      x > b.x0 &&
      x < b.x1 &&
      z > b.z0 &&
      z < b.z1 &&
      (s.kind === 'alcove' || (s.kind === 'closet' ? (doors[s.door] ?? 0) < 0.04 : crouch))
    );
  })?.kind;
}
export function reachableDoor(x: number, z: number) {
  return closets.find((s) => Math.abs(x - s.x - 0.81) < 1.23 && Math.abs(z - s.z - 1.63) < 1.72);
}
export class ClosetDoors {
  open = 0;
  travel = closets.map(() => 0);
  restore(mask: number, player?: Body | null) {
    this.open = mask;
    for (const s of closets) {
      // A save can capture a player crossing a door that's still sliding shut.
      if (player && touches(doorPanel(s, 0), player.x, player.z, bodyRadius)) this.open |= 1 << s.door;
      this.travel[s.door] = (this.open >> s.door) & 1;
    }
  }
  step(dt: number, bodies: readonly Body[]) {
    for (const s of closets) {
      const id = s.door,
        target = (this.open >> id) & 1,
        from = this.travel[id];
      if (from === target) continue;
      const to = from + Math.sign(target - from) * Math.min(Math.abs(target - from), dt * 2.6);
      if (!target && bodies.some((p) => touches(doorPanel(s, to), p.x, p.z, bodyRadius))) {
        this.open |= 1 << id;
      } else this.travel[id] = to;
    }
  }
}

// Clip a finite eye-to-eye segment against a solid, including thin sheet metal.
function intersects(b: Bounds, x: number, y: number, z: number, dx: number, dy: number, dz: number) {
  let near = 0,
    far = 1;
  for (const [o, d, lo, hi] of [
    [x, dx, b.x0, b.x1],
    [y, dy, b.bottom, b.top],
    [z, dz, b.z0, b.z1],
  ]) {
    if (Math.abs(d) < 1e-8) {
      if (o < lo || o > hi) return false;
      continue;
    }
    const a = (lo - o) / d,
      c = (hi - o) / d;
    near = Math.max(near, Math.min(a, c));
    far = Math.min(far, Math.max(a, c));
    if (near > far) return false;
  }
  return true;
}
export function coverBlocksSight(
  x: number,
  y: number,
  z: number,
  px: number,
  py: number,
  pz: number,
  doors: readonly number[],
) {
  const dx = px - x,
    dy = py - y,
    dz = pz - z;
  for (const s of covers) {
    // Bound each site before clipping its individual parts.
    if (
      s.x < Math.min(x, px) - 4 ||
      s.x > Math.max(x, px) + 4 ||
      s.z < Math.min(z, pz) - 9 ||
      s.z > Math.max(z, pz) + 9
    )
      continue;
    const hit = (b: Bounds) => intersects(b, x, y, z, dx, dy, dz);
    if (s.parts.some(hit) || (s.door >= 0 && hit(doorPanel(s, doors[s.door] ?? 0)))) return true;
  }
  return false;
}
