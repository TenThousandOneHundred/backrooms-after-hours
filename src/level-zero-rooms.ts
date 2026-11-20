// Endpoints and thickness are in navigation tiles. Render, collision, hearing
// and hunter navigation all use these same freestanding partitions.
type Endpoints = readonly [number, number, number, number];
export const halfWall = 0.085;

function partition([ax, az, bx, bz]: Endpoints) {
  const length = Math.hypot(bx - ax, bz - az);
  return { ax, az, bx, bz, length, ux: (bx - ax) / length, uz: (bz - az) / length };
}

const lobby: Endpoints[] = [
  // West rooms open around the original offset entrance.
  [0.5, 6, 8, 4.3], [10, 3.8, 14, 3], [14, 3, 16, 8],
  [6.8, 16.2, 11, 14], [11, 14, 17.5, 16], [16.4, 11.7, 22, 8.5],
  [18.8, 0.5, 22.5, 5.8], [25, 4, 27.7, 11], [29, 13.7, 33.3, 17.2],
  [18, 23.5, 20.6, 17], [23, 14.9, 28.6, 16.5],
  // The former atrium is a series of carpeted fan-shaped rooms.
  [29.2, 0.5, 34, 6], [36.5, 8.9, 41, 14.3], [41, 14.3, 35.7, 20.7],
  [36, 4.3, 42.3, 2.7], [43, 0.5, 47.5, 6], [47.5, 6, 53, 5],
  [54.6, 1.7, 57.1, 8], [56, 10.8, 49.3, 14.6], [49.3, 14.6, 46, 20],
  [45, 8.5, 40.6, 9.3], [47.5, 23.5, 53.6, 18.4], [56, 16, 63, 18.6],
  // Stagger the breaks between wall runs: each broad chamber has a doorway
  // on a different bearing from the one through which the player entered.
  [16, 8, 12.6, 10.1], [17.5, 16, 15.8, 21.8], [22.5, 5.8, 26, 4.3],
  [27.7, 11, 31.2, 9.5], [33.1, 8.6, 36.5, 8.9],
  [35.7, 20.7, 38.4, 23.5], [41.5, 15.2, 45.8, 17.1],
  [43, 6.1, 45, 8.5], [49.3, 14.6, 48, 11.8], [54.4, 4.8, 57, 3.9],
  [57.1, 8, 61.1, 6.7], [63, 18.6, 62.7, 21.6],
  // The east rooms narrow at one end and open through offset gaps at the other.
  [62.7, 0.5, 65.2, 5], [65, 8, 59.8, 11.4], [59.8, 11.4, 62, 14.9],
  [72, 0.5, 75, 6.5], [77.8, 7.2, 82, 5.4], [82, 5.4, 86, 2.6],
  [68.7, 15.7, 70.4, 10.8], [75, 13.8, 80.5, 16.3],
  [80.5, 16.3, 78.4, 21.4], [85, 17.3, 89.5, 19.1],
  [61.8, 23.5, 65.8, 19.5], [69.3, 18.4, 74, 19.6],
  [65.2, 5, 66.45, 5.3], [72.2, 8.3, 75, 6.5], [70.4, 10.8, 73.5, 10.1],
  [74, 19.6, 75.8, 23.5], [84.6, 14.1, 89.5, 12.2],
  // Three approaches enter the lower records suites from different directions.
  [2.5, 38.5, 10.6, 36.2], [12.6, 32.5, 17.4, 38.5], [17.4, 38.5, 13.6, 43],
  [20.8, 45.5, 24.5, 39.1], [24.5, 39.1, 30.3, 37],
  [27.8, 32.5, 32.8, 35], [35.1, 36.1, 39.9, 40.8], [39.9, 40.8, 37.2, 45.5],
  [44.4, 32.5, 47, 38.2], [47, 38.2, 52.5, 40.8],
  [56, 45.5, 59.3, 39.6], [59.3, 39.6, 64.4, 36.2],
  [65.7, 32.5, 69.3, 37], [70.7, 45.5, 75.7, 41.6],
  [74.4, 37.7, 80.5, 35.5], [82.1, 38, 88.5, 41.2],
  [17.4, 38.5, 20.4, 37.1], [24.5, 39.1, 22.5, 35.8],
  [32.8, 35, 34.7, 33.8], [39.9, 40.8, 44, 39.1],
  [47, 38.2, 50.2, 36.4], [55.3, 40.3, 59.3, 39.6],
  [64.4, 36.2, 62.3, 32.5], [75.7, 41.6, 78.4, 42.9],

];

const walls = (segments: Endpoints[]) => segments.map(partition);
const layouts: Record<string, ReturnType<typeof partition>[]> = {
  lobby: walls(lobby),
  pitwalk: walls([[16, .5, 20.8, 3.1], [13, 11.2, 18.6, 13.4], [21.4, 8.6, 23.1, 10.4]]),
  lower: walls([[4, .5, 6.4, 3.5], [4, 5.5, 1, 7], [10, 1.6, 13, 4.1], [8, 6, 10, 8.5]]),
};
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
  for (const w of layouts[id]) {
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
