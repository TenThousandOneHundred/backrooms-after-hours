// Endpoints and thickness are in navigation tiles. Render, collision, hearing
// and hunter navigation all use these same freestanding partitions.
type Endpoints = readonly [number, number, number, number];
export const halfWall = 0.085;

function partition([ax, az, bx, bz]: Endpoints) {
  const length = Math.hypot(bx - ax, bz - az);
  return { ax, az, bx, bz, length, ux: (bx - ax) / length, uz: (bz - az) / length };
}

type Point = readonly [number, number];

// Adjoining rooms share the same jambs and corners. The offset survey lines
// give each room its own bearing without leaving cracks between wall ends.
function suite(columns: number[], rows: number[], seed: number, lobbyEntrance = false) {
  const walls: Endpoints[] = [];
  const lastCol = columns.length - 1, lastRow = rows.length - 1;
  const corners = rows.map((z, r) => columns.map((x, c): Point => [
    x + (c === 0 || c === lastCol ? 0 : Math.sin(r * 2.1 + c * 1.7 + seed) * 1.25),
    z + (r === 0 || r === lastRow ? 0 : Math.cos(c * 2.4 + r * 1.85 + seed) * .95),
  ]));
  // Slide the end of the east dividing wall behind the two desk bays.
  if (lobbyEntrance) corners[2][lastCol] = [columns[lastCol], 9.55];
  const shafts: Point[] = lobbyEntrance ? [[67, 5.5], [84, 12]] : [];
  function edge(a: Point, b: Point, open: boolean, fraction: number) {
    // Where a dividing wall crosses a crawlway, its opening surrounds the duct.
    for (const [x, z] of shafts) {
      if (x <= a[0] || x >= b[0]) continue;
      const t = (x - a[0]) / (b[0] - a[0]);
      if (Math.abs(a[1] + t * (b[1] - a[1]) - z) < 2.8) { open = true; fraction = t; }
    }
    if (!open) { walls.push([...a, ...b]); return; }
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const gap = .76 / Math.hypot(dx, dz);
    walls.push([...a, a[0] + dx * (fraction-gap), a[1] + dz * (fraction-gap)],
      [a[0] + dx * (fraction+gap), a[1] + dz * (fraction+gap), ...b]);
  }
  for (let r = 0; r < lastRow; r++) {
    for (let c = 0; c < lastCol; c++) {
      // Every room has a door to a preceding room. Additional cross-links
      // make loops for pursuit. Alternate jamb positions to break enfilades.
      const west = r === 0 || (c !== 0 && (c + r * 2 + seed) % 4 < 2);
      const across = (r + c) % 2 ? .31 : .67;
      const firstTurn = lobbyEntrance && r === 2 && c === 1;
      if (c > 0) edge(corners[r][c], corners[r+1][c],
        west || (c + 2*r) % 5 === 0 || firstTurn, firstTurn ? .69 : across);
      if (r > 0) edge(corners[r][c], corners[r][c+1],
        !west || (2*c + r) % 5 === 1, 1 - across);
    }
  }
  return walls;
}

const upper = suite([.5, 7.8, 13.5, 20, 26, 32, 38.5, 45, 51, 57.5, 64, 70, 76, 82, 89.5],
  [.5, 5.9, 10.1, 15.7, 20.1, 23.5], 1, true);
const records = suite([2.5, 8, 14, 20.5, 27, 34, 40, 47, 52, 59.5, 66, 72, 79, 84, 88.5],
  [32.5, 37.1, 41.5, 45.5], 3);

const walls = (segments: Endpoints[]) => segments.map(partition);
const layouts: Record<string, ReturnType<typeof partition>[]> = {
  lobby: walls([...upper, ...records]),
  // Leave the marked beam across the service void clear on both banks.
  pitwalk: walls([[5,.5,6.4,2.5], [7.1,3.7,7.5,4.5], [16,.5,17,2], [17,2,19,2.6],
    [20.5,3.1,24.5,4.5], [5.5,14.5,6.5,12.5], [7.2,11.2,7.3,9.5],
    [12.5,14.5,11.7,10.5], [11.7,10.5,14.8,9.3], [16.3,8.8,17.5,7.5],
    [18.7,14.5,20,11.4], [20,11.4,22,10.7], [23.4,10.2,24.5,9.9]]),
  lower: walls(suite([.5,5,10.5,15.5],[.5,4.3,8.5],1)),
};
// Most collision queries cover at most one navigation tile. A one-tile
// apron around each bucket includes adjacent jambs for those short sweeps.
const bucketSize = 6;
const localWalls = new Map<string, Map<number, ReturnType<typeof partition>[]>>();
for (const [id, list] of Object.entries(layouts)) {
  const buckets = new Map<number, typeof list>();
  for (const w of list) {
    for (let z = Math.floor((Math.min(w.az, w.bz)-1)/bucketSize); z <= Math.floor((Math.max(w.az, w.bz)+1)/bucketSize); z++)
      for (let x = Math.floor((Math.min(w.ax, w.bx)-1)/bucketSize); x <= Math.floor((Math.max(w.ax, w.bx)+1)/bucketSize); x++) {
        const key = z * 128 + x;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(w);
      }
  }
  localWalls.set(id, buckets);
}
export function isLevelZero(id: string) {
  return Object.hasOwn(layouts, id);
}
export function partitionsFor(id: string) {
  return isLevelZero(id) ? layouts[id] : [];
}

// Clip a segment in the wall's local coordinate system. A zero-length segment
// checks player clearance. Radius also lets a hunter test its entire next step.
export function crossesPartition(id: string, x: number, z: number, px: number, pz: number, radius = 0) {
  if (!isLevelZero(id)) return false;
  const padding = halfWall + radius;
  const travel = Math.max(Math.abs(px-x), Math.abs(pz-z));
  const candidates = travel + 2*padding <= 1
    ? localWalls.get(id)!.get(Math.floor(z/bucketSize)*128 + Math.floor(x/bucketSize))
    : layouts[id];
  if (!candidates) return false;
  for (const w of candidates) {
    if (Math.max(x, px) < Math.min(w.ax, w.bx) - padding || Math.min(x, px) > Math.max(w.ax, w.bx) + padding ||
        Math.max(z, pz) < Math.min(w.az, w.bz) - padding || Math.min(z, pz) > Math.max(w.az, w.bz) + padding) continue;
    const dx = x - w.ax, dz = z - w.az, vx = px - x, vz = pz - z;
    const along = dx * w.ux + dz * w.uz, across = dz * w.ux - dx * w.uz;
    const alongStep = vx * w.ux + vz * w.uz, acrossStep = vz * w.ux - vx * w.uz;
    let near = 0, far = 1;
    for (const [at, step, lo, hi] of [[along, alongStep, -radius, w.length + radius], [across, acrossStep, -padding, padding]]) {
      if (Math.abs(step) < 1e-9) {
        if (at < lo || at > hi) { far = -1; break; }
      } else {
        const a = (lo - at) / step, b = (hi - at) / step;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
      }
    }
    if (near <= far) return true;
  }
  return false;
}
