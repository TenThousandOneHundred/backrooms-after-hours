import * as T from 'three';
import { closets, covers, doorCenterX, doorPanel } from './concourse-cover';
import type { ModelKit } from './world-models';

export function buildConcourseCover(kit: ModelKit, statics: T.Group, root: T.Group) {
  const doors: T.Group[] = [];
  for (const s of covers) {
    const { x, z, floor: y } = s;
    for (const p of s.parts)
      kit.cube(
        statics,
        p.color,
        (p.x0 + p.x1) / 2,
        (p.bottom + p.top) / 2,
        (p.z0 + p.z1) / 2,
        p.x1 - p.x0,
        p.top - p.bottom,
        p.z1 - p.z0,
      );
    const box = (color: string, dx: number, h: number, dz: number, w: number, height: number, d: number) =>
      kit.cube(statics, color, x + dx, y + h, z + dz, w, height, d);
    if (s.kind === 'alcove') {
      for (const side of [-1, 1]) {
        box('#676b62', side * 2.45, 1.42, 4.61, 0.42, 2.84, 0.31);
        box('#767a6e', side * 2.45, 2.67, 4.46, 0.62, 0.25, 0.53);
      }
      box('#696d64', 0, 3.02, 4.68, 5.34, 0.45, 0.34);
      for (const v of [0.2, 2.3, 4.0]) box('#4b514b', 0, 2.65, v, 4.58, 0.23, 0.19);
      box('#303831', 0, 0.012, 0.21, 4.54, 0.024, 2.94);
      for (const dx of [-1.7, -1.35]) box('#4a4d44', dx, 2.55, 1.4, 0.11, 0.11, 5.8);
    } else if (s.kind === 'closet') {
      const panel = doorPanel(s, 0),
        g = new T.Group();
      g.position.set((panel.x0 + panel.x1) / 2, y, z + 1.63);
      root.add(g);
      doors[s.door] = g;
      kit.cube(g, '#778578', 0, 1.02, 0, panel.x1 - panel.x0, 2.04, 0.12);
      for (const side of [-1, 1]) {
        kit.cube(g, '#b5b5a1', 0.42, 1.08, side * 0.087, 0.055, 0.37, 0.054);
        for (let j = 0; j < 5; j++)
          kit.cube(g, '#3e4a44', 0, 1.54 + j * 0.065, side * 0.067, 0.7, 0.026, 0.022);
      }
      box('#373e39', 0, 0.016, 0.01, 3.14, 0.032, 3.16);
      for (const dx of [-1.59, 0.1, 1.49]) box('#404c45', dx, 1.07, 1.749, 0.045, 2.14, 0.037);
      box('#39433e', 0.15, 2.14, 1.76, 2.98, 0.095, 0.13);
      box('#b5ab80', 0.81, 2.23, 1.755, 0.65, 0.1, 0.024);
    } else if (s.kind === 'duct') {
      const len = s.parts[0].z1 - s.parts[0].z0;
      box('#46514f', 0, 0.012, 0, 1.4, 0.024, len);
      for (const end of [-1, 1]) {
        const lip = end * (len / 2 + 0.025);
        for (const side of [-1, 1]) {
          box('#8c9891', side * 0.78, 0.66, lip, 0.16, 1.32, 0.07);
          for (const h of [0.13, 0.64, 1.17]) box('#47514d', side * 0.78, h, lip + end * 0.04, 0.045, 0.045, 0.022);
        }
        box('#8c9891', 0, 1.29, lip, 1.71, 0.12, 0.07);
        box('#343d3b', 0, 1.77, lip, 1.63, 0.66, 0.055);
        for (let j = 0; j < 6; j++) {
          const louver = box('#758079', 0, 1.5 + j * 0.105, lip + end * 0.05, 1.56, 0.043, 0.085);
          louver.rotation.x = end * -0.32;
        }
      }
      for (let v = -len / 2 + 0.06; v < len / 2; v += 1.6) {
        for (const side of [-1, 1]) box('#798680', side * 0.694, 0.61, v, 0.03, 1.22, 0.055);
        box('#798680', 0, 1.221, v, 1.4, 0.024, 0.055);
      }
    } else if (s.kind === 'cubicle') {
      box('#89917b', 0, 1.447, -1.4, 4.25, 0.035, 0.16);
      box('#89917b', -2.05, 1.447, -0.03, 0.16, 0.035, 2.9);
      const monitor = box('#353d39', 0.55, 1.01, -1.06, 0.62, 0.39, 0.12);
      monitor.rotation.y = 0.11;
      box('#454e45', 0.55, 0.84, -1.04, 0.11, 0.14, 0.09);
      for (let j = 0; j < 7; j++) {
        const a = -1.98 + j * 0.57,
          v = 0.09 * Math.sin(j * 1.3 + x),
          next = 0.09 * Math.sin((j + 1) * 1.3 + x);
        kit.rod(
          statics,
          '#526047',
          [x + a, y + 1.49 + v, z - 1.4],
          [x + a + 0.57, y + 1.49 + next, z - 1.4],
          0.035,
        );
      }
      // Vines follow the partition tops, hanging down the fabric on either side.
      for (let j = 0; j < 5; j++) {
        const offset = -1.7 + j * 0.81,
          drop = 0.42 + 0.31 * Math.abs(Math.sin(x + j));
        kit.rod(
          statics,
          '#414c35',
          [x + offset, y + 1.52, z - 1.4],
          [x + offset + 0.19, y + 1.45 - drop, z - 1.27],
          0.023,
        );
        for (let k = 0; k < 4; k++) {
          const leaf = kit.ball(
            statics,
            k % 2 ? '#53633f' : '#394e36',
            x + offset + 0.05 * k + (k % 2 ? 0.075 : -0.07),
            y + 1.47 - (drop * k) / 4,
            z - 1.27,
            0.29,
            0.1,
            0.12,
          );
          leaf.rotation.z = k % 2 ? 0.6 : -0.64;
        }
      }
    } else {
      // Ribbed motor housing, longitudinal exhaust and flanged pump barrels.
      for (const dx of [-1.65, 1.65]) {
        const barrel = kit.cylinder(statics, '#505e59', x + dx, y + 3.72, z, 1.32, 6.15);
        barrel.rotation.x = Math.PI / 2;
        for (const dz of [-2.6, -1.6, -0.6, 0.4, 1.4, 2.6]) {
          const rib = kit.cylinder(statics, '#788178', x + dx, y + 3.72, z + dz, 1.48, 0.12);
          rib.rotation.x = Math.PI / 2;
        }
      }
      for (const end of [-1, 1]) {
        for (const dx of [-1.65, 1.65]) {
          // The bolted end bells are visible from both crawlspace approaches.
          for (const [diameter, depth, offset, tint] of [
            [1.34, 0.18, 3.48, '#47534e'],
            [1.18, 0.12, 3.59, '#889185'],
            [0.91, 0.12, 3.69, '#4d5a55'],
          ] as const) {
            const cap = kit.cylinder(statics, tint, x + dx, y + 2.88, z + end * offset, diameter, depth);
            cap.rotation.x = Math.PI / 2;
          }
          for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            box(
              '#a29f85',
              dx + 0.525 * Math.cos(angle),
              2.88 + 0.525 * Math.sin(angle),
              end * 3.665,
              0.095,
              0.095,
              0.055,
            );
          }
        }
        box('#3b4641', 0, 2.63, end * 3.45, 1.38, 1.06, 0.1);
        for (let j = 0; j < 7; j++) box('#7d897a', 0, 2.22 + j * 0.13, end * 3.53, 1.23, 0.045, 0.1);
      }
      for (const sign of [-1, 1]) {
        for (const h of [2.48, 2.83])
          kit.rod(
            statics,
            '#85755c',
            [x + sign * 2.9, y + h, z - 2.86],
            [x + sign * 2.9, y + h, z + 2.86],
            0.11,
          );
      }
      for (const v of [-3.69, 3.69]) box('#b3a170', 0, 1.55, v, 2.03, 0.16, 0.08);
    }
  }
  return (travel: readonly number[]) =>
    doors.forEach((mesh, i) => {
      const s = closets[i];
      mesh.position.x = doorCenterX(s, travel[i] ?? 0);
    });
}
