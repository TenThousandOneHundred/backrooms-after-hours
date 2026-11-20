import { halfWall, partitionsFor } from './level-zero-rooms';
import { TILE } from './world-units';

type Vec = [number, number, number];
type WallFace = (corner: Vec, span: Vec, normal: Vec, tx: number, tz: number) => void;

// Emit both papered faces and the two finished ends. Short spans follow the
// room's baked lighting and fit into the existing region-culling batches.
export function partitionFaces(id: string, emit: WallFace) {
  for (const w of partitionsFor(id)) {
    const nx = -w.uz * halfWall, nz = w.ux * halfWall;
    const corners = [[w.ax + nx, w.az + nz], [w.bx + nx, w.bz + nz],
      [w.bx - nx, w.bz - nz], [w.ax - nx, w.az - nz]];
    for (let i = 0; i < 4; i++) {
      const [x, z] = corners[i], [endX, endZ] = corners[(i + 1) % 4];
      const dx = endX - x, dz = endZ - z, length = Math.hypot(dx, dz);
      const steps = Math.ceil(length), normal: Vec = [-dz / length, 0, dx / length];
      for (let j = 0; j < steps; j++) {
        const u = x + j * dx / steps, v = z + j * dz / steps;
        emit([u * TILE, 0, v * TILE], [dx * TILE / steps, 0, dz * TILE / steps], normal,
          Math.round(u + dx / (2 * steps)), Math.round(v + dz / (2 * steps)));
      }
    }
  }
}
