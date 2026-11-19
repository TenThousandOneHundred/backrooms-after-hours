import * as T from 'three';
import type { GameObject } from './campaign';

export class ModelKit {
  box = new T.BoxGeometry(1, 1, 1);
  sphere = new T.SphereGeometry(0.5, 12, 9);
  tube = new T.CylinderGeometry(0.5, 0.5, 1, 12);
  cone = new T.ConeGeometry(0.5, 1, 8);
  materials = new Map<string, T.Material>();
  geometries: T.BufferGeometry[] = [];
  textures: T.Texture[] = [];
  get(color: string | number, lit = true) {
    const key = [color, lit].join('/');
    let m = this.materials.get(key);
    if (!m) {
      m = lit ? new T.MeshLambertMaterial({ color }) : new T.MeshBasicMaterial({ color });
      this.materials.set(key, m);
    }
    return m;
  }
  add(
    g: T.Object3D,
    geo: T.BufferGeometry,
    c: string | number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    lit = true,
  ) {
    const m = new T.Mesh(geo, this.get(c, lit));
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    g.add(m);
    return m;
  }
  cube(
    g: T.Object3D,
    c: string | number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    lit = true,
  ) {
    return this.add(g, this.box, c, x, y, z, w, h, d, lit);
  }
  ball(
    g: T.Object3D,
    c: string | number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    lit = true,
  ) {
    return this.add(g, this.sphere, c, x, y, z, w, h, d, lit);
  }
  cylinder(
    g: T.Object3D,
    c: string | number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d = w,
    lit = true,
  ) {
    return this.add(g, this.tube, c, x, y, z, w, h, d, lit);
  }
  rod(g: T.Object3D, c: string | number, a: number[], b: number[], radius: number, lit = true) {
    const from = new T.Vector3(...a),
      to = new T.Vector3(...b),
      dir = to.clone().sub(from);
    const m = this.cylinder(
      g,
      c,
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
      (a[2] + b[2]) / 2,
      radius * 2,
      dir.length(),
      radius * 2,
      lit,
    );
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
    return m;
  }
  label(
    g: T.Object3D,
    words: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    bg = '#24322f',
    fg = '#e1e4d4',
  ) {
    const key = 'label:' + words + bg + fg;
    let m = this.materials.get(key);
    if (!m) {
      const canvas = document.createElement('canvas');
      canvas.width = 384;
      canvas.height = 96;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 384, 96);
      ctx.strokeStyle = fg;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 2;
      ctx.strokeRect(5, 5, 374, 86);
      ctx.globalAlpha = 1;
      ctx.fillStyle = fg;
      ctx.font = 'bold ' + Math.min(48, Math.floor(536 / Math.max(words.length, 1))) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(words.toUpperCase(), 192, 48, 358);
      const tex = new T.CanvasTexture(canvas);
      tex.colorSpace = T.SRGBColorSpace;
      this.textures.push(tex);
      m = new T.MeshBasicMaterial({ map: tex });
      this.materials.set(key, m);
    }
    const geo = new T.PlaneGeometry(width, height);
    this.geometries.push(geo);
    const mesh = new T.Mesh(geo, m);
    mesh.position.set(x, y, z);
    g.add(mesh);
  }
  dispose() {
    for (const g of [this.box, this.sphere, this.tube, this.cone, ...this.geometries]) g.dispose();
    for (const m of this.materials.values()) m.dispose();
    for (const t of this.textures) t.dispose();
  }
}

type Spec = { model?: string; name?: string; label?: string; color?: number; kind?: GameObject['kind'] };
export function makeModel(k: ModelKit, s: Spec) {
  const g = new T.Group(),
    model = (s.model ?? s.kind ?? 'crate').toLowerCase(),
    col = s.color ?? '#a5aa96';
  const b = (
    c: string | number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    lit = true,
  ) => k.cube(g, c, x, y, z, w, h, d, lit);
  const a = (
    c: string | number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    lit = true,
  ) => k.ball(g, c, x, y, z, w, h, d, lit);
  const cy = (c: string | number, x: number, y: number, z: number, w: number, h: number, d = w, lit = true) =>
    k.cylinder(g, c, x, y, z, w, h, d, lit);
  const rod = (c: string | number, v: number[], u: number[], r: number, lit = true) =>
    k.rod(g, c, v, u, r, lit);
  const label = (
    txt: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    bg?: string,
    fg?: string,
  ) => k.label(g, txt, x, y, z, w, h, bg, fg);
  const steel = '#555d5b',
    dark = '#293437',
    wood = '#9a7450',
    white = '#d6d9cb';
  const legs = (w: number, d: number, h: number, c = steel) => {
    for (const x of [-1, 1]) for (const z of [-1, 1]) b(c, (x * w) / 2, h / 2, (z * d) / 2, 0.065, h, 0.065);
  };
  const stand = () => {
    b('#686958', 0, 0.43, 0, 0.48, 0.86, 0.38);
    b('#939182', 0, 0.885, 0, 0.66, 0.05, 0.49);
  };
  const panel = () => {
    b(dark, 0, 0.94, 0, 0.64, 1.86, 0.44);
    b('#929b88', 0, 1.43, 0.246, 0.57, 0.63, 0.08);
    b('#35403e', 0, 1.48, 0.298, 0.45, 0.36, 0.045);
  };
  if (model === 'pit') {
    return g;
  }
  if (model === 'seal') {
    const words = s.name?.toLowerCase() ?? '',
      points: number[][] = [];
    b('#787262', 0, 0.015, 0, 1.23, 0.03, 1.23);
    if (words.includes('star')) {
      for (let i = 0; i <= 10; i++) {
        const r = i % 2 ? 0.23 : 0.5,
          ang = (i * Math.PI) / 5 - Math.PI / 2;
        points.push([r * Math.cos(ang), 0.041, r * Math.sin(ang)]);
      }
    } else if (words.includes('moon')) {
      for (let i = 0; i <= 16; i++) {
        const ang = (i / 16) * Math.PI * 1.5 + Math.PI * 0.25;
        points.push([Math.cos(ang) * 0.45, 0.041, Math.sin(ang) * 0.45]);
      }
      for (let i = 0; i <= 10; i++) {
        const ang = -Math.PI * 0.5 - (i / 10) * Math.PI;
        points.push([0.31 + Math.cos(ang) * 0.32, 0.042, Math.sin(ang) * 0.32]);
      }
    } else {
      for (let i = 0; i <= 22; i++) {
        const ang = (i / 22) * Math.PI * 2;
        points.push([0.44 * Math.cos(ang), 0.041, 0.44 * Math.sin(ang)]);
      }
    }
    for (let i = 1; i < points.length; i++) rod(col, points[i - 1], points[i], 0.026, false);
    return g;
  }
  if (model === 'turbine') {
    cy('#656f66', 0, 0.68, 0, 0.17, 1.36);
    b('#697368', 0, 1.4, 0, 0.83, 0.86, 0.31);
    for (let i = 0; i < 5; i++) {
      const ang = i * Math.PI * 0.4;
      const blade = b('#9fa694', Math.sin(ang) * 0.19, 1.4 + Math.cos(ang) * 0.19, 0.19, 0.18, 0.36, 0.068);
      blade.rotation.z = -ang - 0.43;
    }
    a('#646e65', 0, 1.4, 0.24, 0.16, 0.16, 0.07);
    return g;
  }
  if (/door|elevator|gate|exit|portal/.test(model)) {
    const lift = /lift|elevator/.test(model);
    for (const x of [-0.64, 0.64]) b('#494e4b', x, 1.1, 0, 0.13, 2.2, 0.2);
    b('#555956', 0, 2.22, 0, 1.41, 0.13, 0.2);
    b('#414847', 0, 0.025, 0, 1.38, 0.05, 0.42);
    b(lift ? '#8d9895' : '#696b54', 0, 1.09, -0.015, 1.17, 2.12, 0.13);
    if (lift) {
      b('#36413f', 0, 1.1, 0.06, 0.021, 2.11, 0.01);
      b(steel, 0.79, 1.22, 0, 0.16, 0.34, 0.1);
      a('#e4de9d', 0.79, 1.22, 0.067, 0.074, 0.074, 0.019, false);
    } else {
      b('#353d35', 0.08, 1.58, 0.06, 0.43, 0.52, 0.05);
      b('#92a299', 0.08, 1.58, 0.094, 0.37, 0.46, 0.015);
      b('#3c4239', -0.4, 0.99, 0.091, 0.13, 0.28, 0.027);
      b('#b9b9a0', -0.35, 1.02, 0.15, 0.22, 0.045, 0.055);
      b('#54584d', 0, 0.2, 0.06, 1.16, 0.21, 0.025);
    }
    label(lift ? 'LIFT' : 'EXIT', 0, 2.42, 0.102, 0.57, 0.18, '#23483d', '#e6f2d9');
  } else if (/vent|grate/.test(model)) {
    b(steel, 0, 0.49, 0, 0.94, 0.88, 0.19);
    b('#202827', 0, 0.49, 0.1, 0.83, 0.76, 0.05);
    for (let i = 0; i < 8; i++) b('#94a198', 0, 0.18 + i * 0.088, 0.143, 0.78, 0.045, 0.075);
  } else if (/ladder/.test(model)) {
    const h = s.kind === 'pickup' ? 1.04 : 2.5;
    g.rotation.z = s.kind === 'pickup' ? 0.1 : 0;
    for (const x of [-0.23, 0.23]) {
      b('#b58c55', x, h * 0.5, 0, 0.067, h, 0.088);
      b('#434842', x, 0.035, 0, 0.071, 0.07, 0.094);
    }
    for (let y = 0.19; y < h - 0.04; y += 0.27) b('#bdb49b', 0, y, 0.006, 0.48, 0.057, 0.068);
  } else if (/arcade/.test(model)) {
    b('#292334', 0, 0.5, 0, 0.91, 1, 0.83);
    b('#5f3558', 0, 1.1, -0.13, 0.89, 0.57, 0.51);
    const screen = b('#192c38', 0, 1.47, -0.13, 0.88, 0.67, 0.51);
    screen.rotation.x = -0.12;
    b('#72cbbb', 0, 1.49, 0.15, 0.68, 0.43, 0.025, false);
    b('#254d55', 0, 1.49, 0.17, 0.57, 0.31, 0.02, false);
    for (let i = 0; i < 7; i++)
      b(
        i % 2 ? '#e0b25b' : '#95d5bb',
        -0.23 + i * 0.07,
        1.44 + Math.sin(i * 2) * 0.08,
        0.185,
        0.036,
        0.035,
        0.008,
        false,
      );
    b('#5f405d', 0, 1.12, 0.23, 0.94, 0.12, 0.41);
    cy('#b74f59', -0.24, 1.24, 0.24, 0.1, 0.1);
    for (let i = 0; i < 3; i++) cy('#e8b454', 0.09 + i * 0.09, 1.19, 0.28, 0.06, 0.03);
    b('#382b45', 0, 1.9, -0.06, 0.96, 0.3, 0.62);
    label(s.label ?? 'AFTER HOURS', 0, 1.91, 0.26, 0.8, 0.19, '#814864', '#f5d89b');
  } else if (model === 'telephone') {
    b('#45453c', 0, 0.56, 0, 0.28, 1.12, 0.28);
    b('#514c41', 0, 1.1, 0, 0.95, 0.1, 0.68);
    b('#88322b', 0, 1.22, 0, 0.5, 0.18, 0.37);
    cy('#d2b997', 0, 1.32, 0.05, 0.15, 0.017);
    b('#402622', 0, 1.39, -0.09, 0.51, 0.062, 0.09);
    for (const side of [-1, 1]) a('#762720', side * 0.23, 1.36, -0.09, 0.15, 0.12, 0.15);
    for (let i = 0; i < 14; i++) {
      const x = -0.26 - i * 0.015;
      b('#272721', x, 1.19 - Math.sin(i / 13 * Math.PI) * 0.09, 0.03 * Math.cos(i), 0.022, 0.045, 0.022);
    }
  } else if (/terminal|computer|monitor|keypad/.test(model)) {
    panel();
    b('#223632', 0, 1.49, 0.327, 0.405, 0.3, 0.02);
    for (let i = 0; i < 5; i++)
      b('#83b693', -0.05, 1.57 - i * 0.042, 0.341, 0.23 - (i % 3) * 0.038, 0.011, 0.005, false);
    for (let x = 0; x < 3; x++)
      for (let z = 0; z < 3; z++) b('#a3af9c', -0.1 + x * 0.1, 1.16 + z * 0.065, 0.305, 0.074, 0.046, 0.029);
  } else if (/panel|switch|breaker|reader|button|lever|generator|fusebox|turbine/.test(model)) {
    panel();
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.125;
      b('#23312e', x, 1.48, 0.333, 0.072, 0.2, 0.04);
      b(i === 1 ? '#b3593c' : '#8d9b86', x, 1.49, 0.38, 0.065, 0.078, 0.062);
    }
    label('SERVICE', 0, 1.09, 0.23, 0.39, 0.11, '#bba259', '#262c25');
  } else if (/shelf|bookcase|cart|trolley|spool/.test(model)) {
    for (const x of [-0.54, 0.54]) for (const z of [-0.2, 0.2]) b(steel, x, 0.91, z, 0.04, 1.83, 0.05);
    for (let i = 0; i < 4; i++) {
      b('#847e66', 0, 0.13 + i * 0.52, 0, 1.18, 0.05, 0.49);
      for (let j = 0; j < 4; j++)
        b(
          ['#73614c', '#89917b', '#7c685c', '#b49a70'][(i + j) % 4],
          -0.43 + j * 0.24,
          0.24 + i * 0.52,
          -0.02,
          0.15 + (j % 2) * 0.04,
          0.19 + (i % 2) * 0.04,
          0.27,
        );
    }
  } else if (/locker|closet|cabinet/.test(model)) {
    b('#55635c', 0, 0.98, 0, 0.74, 1.96, 0.57);
    b('#738074', 0, 0.985, 0.296, 0.65, 1.85, 0.03);
    for (let i = 0; i < 6; i++) b('#36483e', 0, 1.54 + i * 0.044, 0.317, 0.36, 0.014, 0.012);
    b(dark, 0.22, 1, 0.33, 0.039, 0.25, 0.046);
  } else if (/table|desk|bench|bed|cot/.test(model)) {
    const bed = /bed|cot/.test(model),
      height = bed ? 0.52 : 0.82,
      w = bed ? 1.2 : 1.48,
      d = bed ? 1.92 : 0.73;
    legs(w - 0.14, d - 0.14, height);
    b(bed ? '#b9bc9b' : wood, 0, height, 0, w, bed ? 0.16 : 0.082, d);
    if (bed) {
      b('#d6d5b8', 0, height + 0.1, -0.64, w * 0.83, 0.12, 0.38);
      b('#8b9c8c', 0, height + 0.09, 0.27, w, 0.055, 1.02);
    }
    if (model === 'desk') {
      b('#676953', 0.37, height - 0.24, 0, 0.5, 0.41, d * 0.83);
      b('#c2c1a7', 0.37, height - 0.18, d * 0.43, 0.16, 0.035, 0.035);
    }
  } else if (/chair|seat/.test(model)) {
    legs(0.39, 0.39, 0.42);
    b('#857351', 0, 0.43, 0, 0.48, 0.08, 0.48);
    b('#8d7b5b', 0, 0.68, -0.2, 0.47, 0.44, 0.06);
  } else if (/car|vehicle/.test(model)) {
    b('#323735', 0, 0.4, 0, 1.25, 0.32, 2.47);
    b(col, 0, 0.66, 0, 1.28, 0.34, 2.38);
    b(col, 0, 0.85, -0.15, 1.12, 0.13, 1.2);
    const roof = b('#414e50', 0, 1.02, -0.13, 1.05, 0.34, 1.05);
    roof.rotation.x = -0.035;
    b(col, 0, 1.21, -0.13, 1.07, 0.065, 0.9);
    for (const side of [-1, 1]) {
      b(col, side * 0.526, 1.04, -0.13, 0.035, 0.32, 0.09);
      for (const z of [-0.78, 0.78]) {
        const wheel = cy('#252a29', side * 0.62, 0.37, z, 0.48, 0.14);
        wheel.rotation.z = Math.PI / 2;
        a('#74776e', side * 0.71, 0.37, z, 0.033, 0.22, 0.22);
      }
      b('#dcd7a5', side * 0.46, 0.68, 1.2, 0.26, 0.13, 0.035);
      b('#a34a3e', side * 0.46, 0.68, -1.2, 0.22, 0.13, 0.035);
    }
    label('MOTOR POOL', 0, 0.46, 1.25, 0.4, 0.105);
  } else if (/camera/.test(model)) {
    cy(steel, 0, 0.96, 0, 0.09, 1.9);
    b(white, 0, 1.86, 0, 0.24, 0.19, 0.45);
    a('#334743', 0, 1.86, 0.238, 0.11, 0.11, 0.05);
  } else if (/boat|raft/.test(model)) {
    const hull = a('#805b3f', 0, 0.32, 0, 1.25, 0.44, 2.36);
    hull.rotation.x = -0.02;
    b('#534737', 0, 0.5, 0, 0.83, 0.06, 1.3);
    for (const z of [-0.55, 0.25]) b('#aa8b62', 0, 0.52, z, 1.04, 0.08, 0.22);
  } else if (/light.?house|tower/.test(model)) {
    cy('#d3d0b5', 0, 0.94, 0, 0.65, 1.88);
    cy('#a6604a', 0, 1.1, 0, 0.67, 0.31);
    cy('#e7d593', 0, 2.12, 0, 0.51, 0.4, 0.51, false);
    k.add(g, k.cone, '#963f37', 0, 2.48, 0, 0.93, 0.39, 0.93);
  } else if (/cage|fence/.test(model)) {
    for (let x = -0.6; x <= 0.61; x += 0.2) {
      b(steel, x, 1, -0.4, 0.025, 2, 0.03);
      b(steel, x, 1, 0.4, 0.025, 2, 0.03);
    }
    for (const y of [0.09, 1.92]) b(steel, 0, y, 0, 1.25, 0.07, 0.89);
  } else if (/slide/.test(model)) {
    for (const x of [-0.4, 0.4]) {
      rod(col, [x, 0.16, 0.94], [x, 1.71, -0.72], 0.067);
      b(steel, x, 0.85, -0.71, 0.07, 1.7, 0.07);
    }
    const ramp = b(col, 0, 0.92, 0.1, 0.76, 0.1, 2.31);
    ramp.rotation.x = 0.74;
  } else if (/portrait|painting|picture|map|poster|sign/.test(model)) {
    b('#7a6043', 0, 1.29, 0, 0.87, 1.18, 0.09);
    b('#b69c72', 0, 1.29, 0.06, 0.76, 1.07, 0.018);
    if (/portrait|paint/.test(model)) {
      a('#635241', 0, 1.34, 0.08, 0.31, 0.42, 0.038);
      a('#66584c', 0, 0.98, 0.083, 0.55, 0.37, 0.03);
      b('#c1aa82', 0, 1.32, 0.081, 0.16, 0.12, 0.04);
    } else label(s.label ?? 'FIELD MAP', 0, 1.34, 0.08, 0.66, 0.27, '#d2c9a6', '#565843');
  } else if (/plant|flower|tree/.test(model)) {
    cy('#9e8258', 0, 0.23, 0, 0.39, 0.46);
    rod('#5e6a3a', [0, 0.44, 0], [0.02, 1.16, 0], 0.023);
    for (let i = 0; i < 8; i++) {
      const ang = i * 2.4,
        x = Math.sin(ang) * 0.19,
        z = Math.cos(ang) * 0.19;
      const leaf = a(['#74874e', '#546e4c', '#85914f'][i % 3], x, 0.66 + i * 0.062, z, 0.17, 0.3, 0.12);
      leaf.rotation.z = -Math.sin(ang) * 0.62;
    }
    if (model === 'flower')
      for (let i = 0; i < 5; i++)
        a('#d5ba64', Math.cos(i * 1.256) * 0.08, 1.22 + Math.sin(i * 1.256) * 0.08, 0, 0.11, 0.11, 0.06);
  } else if (/barrel|drum/.test(model)) {
    cy('#74795d', 0, 0.47, 0, 0.65, 0.94);
    for (const y of [0.14, 0.71, 0.93]) cy(steel, 0, y, 0, 0.67, 0.026);
  } else if (/valve|wheel|crank/.test(model)) {
    cy('#626e68', 0, 0.52, 0, 0.18, 1.04);
    const ring = new T.TorusGeometry(0.235, 0.036, 7, 18);
    k.geometries.push(ring);
    k.add(g, ring, '#ae523e', 0, 1.11, 0.06, 1, 1, 1);
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2;
      rod('#ac5744', [0, 1.11, 0.06], [Math.sin(ang) * 0.22, 1.11 + Math.cos(ang) * 0.22, 0.06], 0.023);
    }
  } else if (/light|lamp|flashlight/.test(model) && !/flashlight/.test(model)) {
    cy('#3b4843', 0, 0.04, 0, 0.45, 0.08);
    cy('#7a8074', 0, 0.82, 0, 0.047, 1.6);
    k.add(g, k.cone, '#c4bb89', 0, 1.71, 0, 0.55, 0.31, 0.55);
  } else if (/hoop/.test(model)) {
    b(steel, 0, 0.96, 0, 0.07, 1.9, 0.07);
    b(white, 0, 1.9, 0, 0.63, 0.44, 0.055);
    const ring = new T.TorusGeometry(0.15, 0.019, 7, 18);
    k.geometries.push(ring);
    const r = k.add(g, ring, '#c37246', 0, 1.74, 0.15, 1, 1, 1);
    r.rotation.x = Math.PI / 2;
  } else if (/crate|box|bin/.test(model) && s.kind !== 'pickup') {
    b('#917953', 0, 0.41, 0, 0.87, 0.82, 0.83);
    for (const x of [-0.37, 0.37]) b('#705f43', x, 0.42, 0.424, 0.078, 0.82, 0.028);
    for (const y of [0.07, 0.74]) b('#735e3f', 0, y, 0.424, 0.86, 0.07, 0.029);
  } else {
    stand();
    if (/key|card/.test(model)) {
      if (/card/.test(model)) {
        b('#bcbcb0', 0, 0.925, 0, 0.29, 0.04, 0.18);
        b('#477266', 0, 0.952, 0, 0.27, 0.012, 0.048);
      } else {
        const ring = new T.TorusGeometry(0.065, 0.016, 6, 14);
        k.geometries.push(ring);
        const mesh = k.add(g, ring, '#d1b26c', -0.09, 0.935, 0, 1, 1, 1);
        mesh.rotation.x = Math.PI / 2;
        b('#cfad61', 0.065, 0.935, 0, 0.21, 0.032, 0.037);
        b('#cfad61', 0.117, 0.935, 0.033, 0.049, 0.032, 0.07);
      }
    } else if (/bottle|water|jar/.test(model)) {
      cy('#93ad9c', 0, 1.055, 0, 0.14, 0.3);
      cy('#b0b9a1', 0, 1.24, 0, 0.073, 0.1);
      cy('#3c6255', 0, 1.3, 0, 0.081, 0.044);
      cy('#dde1c5', 0, 1.045, 0, 0.145, 0.115);
    } else if (/mask/.test(model)) {
      a('#a7b4a8', 0, 1.07, 0, 0.27, 0.3, 0.17);
      for (const x of [-0.065, 0.065]) a('#405251', x, 1.1, 0.069, 0.075, 0.06, 0.04);
    } else if (model === 'tool') {
      b('#ab7048', -0.063, 1, 0, 0.23, 0.19, 0.17);
      b('#a5aaa0', 0.13, 1.025, 0, 0.28, 0.07, 0.05);
      b('#424e48', -0.04, 1.13, 0, 0.16, 0.056, 0.089);
    } else if (model === 'bar') {
      b('#91764a', 0, 0.965, 0, 0.27, 0.1, 0.12);
      b('#baaa75', 0, 0.966, 0, 0.12, 0.108, 0.14);
    } else if (/toy|bear/.test(model)) {
      a('#bd8c77', 0, 1.02, 0, 0.22, 0.27, 0.18);
      a('#bd8c77', 0, 1.22, 0, 0.24, 0.21, 0.19);
      for (const j of [-1, 1]) {
        a('#c49a83', j * 0.11, 1.31, 0, 0.09, 0.1, 0.07);
        a(dark, j * 0.05, 1.23, 0.081, 0.019, 0.019, 0.015);
      }
    } else if (/flashlight/.test(model)) {
      const m = cy('#394348', 0, 1.0, 0, 0.13, 0.31);
      m.rotation.z = Math.PI / 2;
      const head = cy('#64716d', 0.15, 1, 0, 0.18, 0.09);
      head.rotation.z = Math.PI / 2;
    } else if (/tape|vhs/.test(model)) {
      b('#313733', 0, 0.95, 0, 0.32, 0.08, 0.2);
      b('#c2bda2', 0, 0.995, 0, 0.17, 0.01, 0.08);
      for (const x of [-0.105, 0.105]) cy('#898c78', x, 1, 0, 0.048, 0.018);
    } else if (/note|paper|file|clipboard|book/.test(model) || s.kind === 'note') {
      b('#665c47', 0, 0.93, 0, 0.31, 0.035, 0.39);
      b('#d6ceaf', 0, 0.955, 0, 0.26, 0.017, 0.34);
      for (let i = 0; i < 5; i++)
        b('#8c8a72', 0, 0.966, -0.08 + i * 0.034, 0.16 - (i % 2) * 0.025, 0.005, 0.005);
    } else {
      b(col, 0, 1.0, 0, 0.28, 0.18, 0.2);
      b('#c3ac76', 0, 1.095, 0, 0.12, 0.014, 0.08);
    }
  }
  return g;
}
