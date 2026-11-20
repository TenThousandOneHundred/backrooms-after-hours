import * as T from 'three';
import type { ModelKit } from './world-models';

// Each structure occupies a solid map cell. Its footing follows the collision edge.
export function makeLandmark(k: ModelKit, shape: string, paint: number | string, name: string) {
  const g = new T.Group();
  const steel = '#475152',
    pale = '#d6ceb1',
    black = '#272e30';
  const box = (
    c: string | number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    lit = true,
  ) => k.cube(g, c, x, y, z, w, h, d, lit);
  const pole = (x: number, z: number, h: number) => box(steel, x, h / 2, z, 0.12, h, 0.12);
  const beam = (c: string | number, a: number[], b: number[], r: number) => k.rod(g, c, a, b, r);
  const ball = (c: string | number, x: number, y: number, z: number, w: number, h: number, d: number) =>
    k.ball(g, c, x, y, z, w, h, d);
  const drum = (c: string | number, x: number, y: number, z: number, w: number, h: number) =>
    k.cylinder(g, c, x, y, z, w, h);
  function ring(x: number, y: number, z: number, r: number, c: string | number, spokes = false) {
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8,
        b = ((i + 1) * Math.PI) / 8;
      const end = [x + r * Math.cos(b), y + r * Math.sin(b), z];
      beam(c, [x + r * Math.cos(a), y + r * Math.sin(a), z], end, 0.066);
      if (spokes && i % 2 === 0) beam(steel, [x, y, z], end, 0.037);
    }
  }
  box(steel, 0, 0.105, 0, 3.12, 0.21, 3.12);
  box(paint, 0, 0.215, 0, 2.94, 0.06, 2.94);
  for (const z of [-1.566, 1.566]) {
    box(black, 0, 0.12, z, 2.64, 0.086, 0.03);
    for (const x of [-0.86, 0.86]) box(paint, x, 0.12, z * 1.012, 0.7, 0.045, 0.02, false);
  }
  switch (shape) {
    case 'wheel':
      for (const z of [-0.6, 0.6]) {
        beam(steel, [-0.94, 0.26, z], [0, 1.44, z], 0.12);
        beam(steel, [0.94, 0.26, z], [0, 1.44, z], 0.12);
        ring(0, 1.48, z, 1.13, paint, true);
      }
      beam(black, [0, 1.48, -0.96], [0, 1.48, 0.96], 0.17);
      break;
    case 'organ':
      for (let i = 0; i < 7; i++) {
        const x = (i - 3) * 0.37,
          height = 1.17 + 0.24 * ((i + 3) % 7);
        drum(paint, x, 0.25 + height / 2, 0, 0.32, height);
        drum(black, x, 0.26 + height, 0, 0.24, 0.015);
      }
      for (const y of [0.48, 0.91]) box(steel, 0, y, 0.04, 2.77, 0.14, 0.52);
      break;
    case 'marquee':
      for (const x of [-1.22, 1.22]) {
        pole(x, 0, 2.72);
        for (let i = 0; i < 6; i++) ball(pale, x, 0.55 + i * 0.34, 0.12, 0.13, 0.13, 0.12);
      }
      box(paint, 0, 2.38, 0, 2.95, 0.6, 0.5);
      for (let i = 0; i < 9; i++) box(pale, (i - 4) * 0.31, 2.6, 0.268, 0.12, 0.074, 0.04, false);
      box(black, 0, 1.29, -0.26, 2.25, 1.65, 0.12);
      for (const side of [-1, 1])
        for (let i = 0; i < 3; i++)
          box(paint, side * (0.88 + i * 0.12), 1.31, -0.11 + (i % 2) * 0.08, 0.18, 1.75, 0.13);
      break;
    case 'stacks':
      for (const x of [-1.28, 1.28]) for (const z of [-0.66, 0.66]) pole(x, z, 2.62);
      for (let row = 0; row < 4; row++) {
        const y = 0.4 + row * 0.55;
        box(steel, 0, y, 0, 2.7, 0.075, 1.45);
        for (let col = 0; col < 7; col++) {
          if ((col + 3 * row) % 9 === 0) continue;
          const x = (col - 3) * 0.345;
          box((row + col) % 3 ? paint : pale, x, y + 0.24, 0, 0.29, 0.41, 1.22);
          box(black, x, y + 0.27, 0.622, 0.14, 0.045, 0.02);
        }
      }
      break;
    case 'bell':
      drum(steel, 0, 0.53, 0, 2.4, 0.54);
      ball(paint, 0, 1.33, 0, 2.45, 2.16, 2.45);
      for (const side of [-1, 1]) {
        ball(steel, 0, 1.37, side * 1.06, 1.03, 1.03, 0.25);
        ball('#33494f', 0, 1.37, side * 1.19, 0.76, 0.76, 0.08);
      }
      ring(0, 2.48, 0, 0.22, steel);
      break;
    case 'pavilion':
      for (const x of [-1.2, 1.2]) for (const z of [-1, 1]) pole(x, z, 2.16);
      box(paint, 0, 1.02, -0.97, 2.48, 1.53, 0.15);
      for (const x of [-0.73, 0.73]) {
        const slope = box(paint, x, 2.33, 0, 1.58, 0.13, 2.6);
        slope.rotation.z = -Math.sign(x) * 0.37;
      }
      box(pale, 0, 0.73, 0, 2.23, 0.15, 1.01);
      break;
    case 'glass':
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 0.55,
          height = 2.13 - 0.25 * Math.abs(i - 2);
        box(steel, x, 0.27 + height / 2, 0, 0.56, height, 0.34);
        box(i % 2 ? paint : pale, x, 0.27 + height / 2, 0.19, 0.46, height - 0.18, 0.06, false);
        beam(steel, [x - 0.25, 0.42, 0.24], [x + 0.25, height, 0.24], 0.035);
      }
      break;
    case 'projector':
      box(steel, 0, 0.83, 0, 2.33, 1.2, 1.31);
      for (const x of [-0.57, 0.57]) ring(x, 1.98, 0, 0.53, paint, true);
      box(paint, 0, 1.35, 0.22, 1.17, 0.66, 0.91);
      ball(pale, 0, 1.42, 0.73, 0.48, 0.48, 0.16);
      break;
    case 'faces':
      for (const [x, z, h] of [
        [-0.77, 0.4, 1.1],
        [0.66, 0.32, 0.83],
        [0, -0.69, 1.47],
      ]) {
        box(steel, x, 0.37 + h * 0.21, z, 0.72, 0.24 + h * 0.44, 0.7);
        const y = 0.62 + h * 0.79;
        ball(paint, x, y, z, 0.84, h * 1.09, 0.79);
        box(pale, x, y - 0.06, z + 0.38, 0.13, 0.26, 0.17);
        for (const side of [-1, 1]) box(black, x + side * 0.17, y + 0.12, z + 0.35, 0.18, 0.05, 0.055);
      }
      break;
    case 'trellis':
      for (const x of [-1.16, 1.16]) for (const z of [-0.8, 0.8]) pole(x, z, 2.36);
      for (let i = 0; i < 6; i++) {
        const x = (i - 2.5) * 0.45;
        box(paint, x, 2.4, 0, 0.115, 0.1, 2.33);
        beam(steel, [x, 0.35, -0.76], [x + 0.43, 2.28, -0.76], 0.035);
        for (let j = 0; j < 4; j++)
          ball(j % 2 ? paint : '#526345', x + 0.12 * Math.sin(i + j), 2.26 - j * 0.28, -0.69, 0.27, 0.38, 0.19);
      }
      box(steel, 0, 0.48, -0.65, 2.72, 0.46, 0.71);
      break;
    case 'signal':
      for (const x of [-0.92, 0.92]) pole(x, 0, 2.59);
      box(black, 0, 1.63, 0, 2.8, 1.64, 0.46);
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 6; col++) {
          const x = (col - 2.5) * 0.425,
            y = 1.13 + row * 0.47;
          box(steel, x, y, 0.25, 0.4, 0.38, 0.04);
          box((row + col) % 5 ? paint : pale, x, y, 0.28, 0.31, 0.22, 0.026, false);
          box(black, x, y, 0.3, 0.19, 0.032, 0.018);
        }
      break;
    case 'gantry':
      for (const x of [-1.19, 1.19]) for (const z of [-0.75, 0.75]) pole(x, z, 2.65);
      for (const z of [-0.75, 0.75]) {
        box(paint, 0, 2.56, z, 2.71, 0.26, 0.2);
        for (const x of [-1.19, 1.19]) beam(steel, [x, 1.76, z], [x * 0.45, 2.55, z], 0.075);
      }
      box(steel, 0, 2.55, 0, 0.56, 0.27, 1.6);
      for (const x of [-0.22, 0.22]) beam(black, [x, 2.47, 0], [x, 1.2, 0], 0.04);
      box(paint, 0, 1.02, 0, 1.23, 0.4, 0.78);
      break;
    case 'crystals':
      for (const [x, z, h] of [
        [-0.81, 0.46, 1.4],
        [0.53, 0.56, 1.1],
        [0, -0.25, 2.38],
        [0.87, -0.56, 1.64],
        [-0.78, -0.71, 0.96],
      ]) {
        const shard = k.add(g, k.cone, paint, x, 0.24 + h / 2, z, 0.72, h, 0.83);
        shard.rotation.z = x * 0.22;
        ball('#585d56', x, 0.29, z, 0.86, 0.27, 0.85);
      }
      break;
    case 'bleachers':
      for (let i = 0; i < 4; i++) {
        const h = 0.42 + i * 0.36,
          z = 0.9 - i * 0.58;
        for (const x of [-1.11, 1.11]) box(steel, x, h / 2, z, 0.12, h, 0.45);
        box(i % 2 ? paint : pale, 0, h, z, 2.76, 0.12, 0.61);
      }
      for (const x of [-1.27, 1.27]) {
        pole(x, -0.93, 2.36);
        beam(steel, [x, 0.95, 1.13], [x, 2.33, -0.93], 0.051);
      }
      break;
  }
  // Double-sided identification for teams approaching down opposite aisles.
  for (const side of [-1, 1]) {
    const placard = new T.Group();
    placard.position.set(0, 0.49, side * 1.37);
    placard.rotation.y = side < 0 ? Math.PI : 0;
    box(steel, 0, 0.37, side * 1.37, 0.12, 0.32, 0.08);
    k.cube(placard, black, 0, 0, 0, 1.86, 0.36, 0.055);
    k.label(placard, name, 0, 0, 0.034, 1.78, 0.31, '#292e2d', '#ddd8bb');
    g.add(placard);
  }
  return g;
}

export function makeShelter(k: ModelKit, shape: string, paint: number | string) {
  const g = new T.Group();
  const b = (c: string | number, x: number, y: number, z: number, w: number, h: number, d: number) =>
    k.cube(g, c, x, y, z, w, h, d);
  for (const x of [-0.71, 0.71]) b(paint, x, 0.9, 0, 0.09, 1.8, 1.33);
  b(paint, 0, 0.9, -0.64, 1.48, 1.8, 0.085);
  if (shape === 'blind') {
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) * 0.172;
      b(i % 2 ? '#736d52' : paint, x, 0.65, 0.63, 0.15, 1.3 + 0.08 * Math.sin(i), 0.08);
      b(paint, x, 1.75, 0.63, 0.15, 0.19, 0.08);
    }
    for (const x of [-0.37, 0.37]) {
      const half = b(paint, x, 1.94, 0, 0.82, 0.09, 1.51);
      half.rotation.z = -Math.sign(x) * 0.28;
    }
  } else if (shape === 'drape') {
    b('#807e70', 0, 1.88, 0.61, 1.49, 0.061, 0.06);
    b(paint, 0, 1.84, 0, 1.49, 0.06, 1.39);
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1;
      b(
        i % 2 ? paint : '#696663',
        side * (0.23 + (i % 4) * 0.136),
        0.95,
        0.6 + (i % 2) * 0.06,
        0.15,
        1.74,
        0.09,
      );
    }
  } else {
    b(paint, 0, 1.9, 0, 1.57, 0.13, 1.46);
    b(paint, 0, 0.63, 0.63, 1.46, 1.26, 0.1);
    b(paint, 0, 1.76, 0.63, 1.46, 0.19, 0.1);
    b('#6a6c61', 0, 1.27, 0.66, 1.55, 0.07, 0.22);
    for (const x of [-0.64, -0.27, 0.27, 0.64]) b('#484d48', x, 1.47, 0.64, 0.055, 0.43, 0.08);
  }
  g.userData.lockerEye = new T.Vector3(0, 1.48, -0.22);
  return g;
}
