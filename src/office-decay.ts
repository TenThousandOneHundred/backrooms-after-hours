import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Stage } from './campaign-format';
import { TILE } from './game-entity';
import { hash } from './world-materials';
import type { ModelKit } from './world-models';
import { corridorPuddles, inSpill, type Spill } from './corridor-puddles';

type Cell = [number, number];
const sides: Cell[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export function buildOfficeDecay(
  stage: Stage,
  cells: Cell[],
  kit: ModelKit,
  statics: T.Group,
  root: T.Group,
  height: number,
  contactShadow: T.Material,
) {
  const loader = new T.TextureLoader();
  const spills: Spill[] = [];
  const occupied = new Set(
    [...stage.objects, ...stage.props, ...(stage.residents ?? [])].map((p) => p.x + ',' + p.z),
  );
  const free = (x: number, z: number) => stage.map[z]?.[x] === '.' && !occupied.has(x + ',' + z);
  const panel = new T.PlaneGeometry(1, 1);
  const padded = new RoundedBoxGeometry(1, 1, 1, 2, 0.16);
  kit.geometries.push(panel, padded);
  function shadow(group: T.Group, x: number, z: number, w: number, d: number) {
    const patch = new T.Mesh(panel, contactShadow);
    patch.position.set(x, 0.017, z);
    patch.rotation.x = -Math.PI / 2;
    patch.scale.set(w, d, 1);
    group.add(patch);
  }

  function surface(asset: string, color: string, options: T.MeshPhongMaterialParameters = {}) {
    const map = loader.load(import.meta.env.BASE_URL + 'surfaces/' + asset + '.webp');
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = 4;
    kit.textures.push(map);
    const material = new T.MeshPhongMaterial({
      map,
      color,
      specular: '#28291f',
      shininess: 13,
      ...options,
    });
    kit.materials.set('damage/' + asset, material);
    return material;
  }
  function piece(
    group: T.Group,
    geometry: T.BufferGeometry,
    mat: T.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) {
    const mesh = new T.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    group.add(mesh);
    return mesh;
  }
  const wall = ['wall-0', 'wall-1'].map((id) =>
    surface('decay/' + id, '#ffffff', {
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  const paperBack = surface('paper', '#fff0af', { side: T.DoubleSide });
  const rust = surface('metal', '#b87850', { shininess: 23 });
  const fabric = surface('carpet', '#676b5e');
  const tile = surface('decay/acoustic', '#fff9e8', { side: T.DoubleSide });
  const casing = surface('plaster', '#e1d7b8');
  const glass = surface('decay/crt', '#c7d1c6', { specular: '#77817e', shininess: 56 });
  const files = ['intake', 'repair'].map((name) =>
    surface('decay/' + name, '#fffae4', { side: T.DoubleSide }),
  );
  function deformed(
    cols: number,
    rows: number,
    offset: (u: number, v: number) => [number, number, number],
  ) {
    const g = new T.PlaneGeometry(1, 1, cols, rows);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++)
      p.setXYZ(i, ...offset(g.attributes.uv.getX(i), g.attributes.uv.getY(i)));
    p.needsUpdate = true;
    g.computeVertexNormals();
    kit.geometries.push(g);
    return g;
  }
  const flaps = [0, 1].map((n) =>
    deformed(9, 9, (u, v) => {
      const fringe = 0.16 * Math.sin(11 * u + n) + 0.085 * Math.cos(24 * u + n) + 0.035 * Math.sin(49 * u);
      return [
        (u - 0.5) * (0.79 + 0.21 * v),
        v - (1 - v) * fringe,
        (1 - v) ** 2 * (0.12 + 0.18 * u) + 0.035 * Math.sin(7 * u) * (1 - v),
      ];
    }),
  );
  const sag = deformed(12, 12, (u, v) => [
    u - 0.5,
    -0.15 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) - 0.21 * u ** 2 * (1 - v) ** 2,
    v - 0.5,
  ]);
  const sheet = deformed(7, 7, (u, v) => [
    u - 0.5,
    0.006 * Math.cos(u * 5 + v * 6) + 0.038 * u ** 4 * (1 - v) ** 2,
    v - 0.5,
  ]);

  function chair(group: T.Group, x: number, z: number) {
    const chair = new T.Group();
    // Five casters radiate from the gas lift. The underside is visible after the chair tips.
    for (let j = 0; j < 5; j++) {
      const a = (j * 2 * Math.PI) / 5,
        dx = 0.32 * Math.cos(a),
        dz = 0.32 * Math.sin(a);
      kit.rod(chair, '#454840', [0, 0.19, 0], [dx, 0.099, dz], 0.033);
      kit.ball(chair, '#232721', dx, 0.065, dz, 0.1, 0.09, 0.085);
    }
    kit.cylinder(chair, '#92968b', 0, 0.31, 0, 0.074, 0.36);
    kit.cube(chair, '#30332e', 0, 0.49, 0, 0.51, 0.08, 0.49);
    piece(chair, padded, fabric, 0, 0.55, 0, 0.55, 0.093, 0.5);
    kit.rod(chair, '#62665a', [0, 0.46, -0.19], [0, 0.89, -0.28], 0.038);
    piece(chair, padded, fabric, 0, 0.89, -0.27, 0.49, 0.39, 0.082).rotation.x = -0.12;
    for (const side of [-1, 1]) {
      kit.rod(chair, '#393c35', [side * 0.2, 0.48, 0.02], [side * 0.29, 0.69, 0.01], 0.021);
      kit.cube(chair, '#3c3d32', side * 0.285, 0.72, 0.01, 0.066, 0.043, 0.23);
    }
    chair.rotation.set(0.28, -0.43, 1.79);
    chair.position.set(x, 0, z);
    chair.position.y = 0.013 - new T.Box3().setFromObject(chair).min.y;
    group.add(chair);
    shadow(group, x, z, 0.96, 1.13);
  }
  function monitor(group: T.Group, x: number, z: number) {
    const crt = new T.Group();
    piece(crt, padded, casing, 0, 0.254, 0, 0.52, 0.43, 0.28);
    piece(crt, padded, casing, 0, 0.257, -0.17, 0.42, 0.32, 0.19);
    kit.cube(crt, '#4f5145', 0, 0.265, -0.3, 0.29, 0.22, 0.09);
    kit.cube(crt, '#41483e', 0, 0.268, 0.147, 0.461, 0.336, 0.025);
    piece(crt, panel, glass, 0, 0.269, 0.162, 0.425, 0.296, 1);
    kit.cube(crt, '#aba58c', 0.166, 0.069, 0.15, 0.055, 0.016, 0.012);
    for (let i = 0; i < 8; i++)
      kit.cube(crt, '#44483e', 0.215, 0.22, -0.222 + i * 0.018, 0.006, 0.147, 0.009);
    crt.rotation.set(-0.14, -0.32, 0.16);
    crt.position.set(x, 0, z);
    crt.position.y = 0.013 - new T.Box3().setFromObject(crt).min.y;
    group.add(crt);
    shadow(group, x, z, 0.77, 0.68);
  }
  function paperwork(group: T.Group, count: number, seed: number) {
    for (let i = 0; i < count; i++) {
      const leaf = piece(
        group,
        sheet,
        files[i % 2],
        (hash(i, seed, 8) - 0.5) * 1.85,
        0.026 + i * 0.002,
        0.44 + hash(i, seed, 9) * 0.88,
        0.23,
        1,
        0.32,
      );
      leaf.rotation.y = hash(i, seed, 10) * 5.5;
    }
  }
  const bend = new T.TubeGeometry(
    new T.CatmullRomCurve3([
      new T.Vector3(0, 0, 0.12),
      new T.Vector3(0.065, 0, 0.112),
      new T.Vector3(0.116, 0, 0.067),
      new T.Vector3(0.125, 0, -0.013),
    ]),
    12,
    0.058,
    10,
    false,
  );
  kit.geometries.push(bend);
  function pipe(group: T.Group, length: number) {
    const y = height - 0.64;
    const body = piece(group, kit.tube, rust, 0, y, 0.12, 0.115, length, 0.115);
    body.rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) {
      const elbow = piece(group, bend, rust, (side * length) / 2, y, 0, 1, 1, 1);
      if (side < 0) {
        elbow.rotation.z = Math.PI;
      }
      const collar = kit.cylinder(group, '#716144', side * (length / 2 + 0.125), y, 0.025, 0.21, 0.035);
      collar.rotation.x = Math.PI / 2;
    }
    for (const x of [-0.4, 0.04, 0.39]) {
      const band = kit.cylinder(group, '#635647', x * length, y, 0.12, 0.151, 0.068);
      band.rotation.z = Math.PI / 2;
      kit.cube(group, '#5b5040', x * length, y - 0.055, 0.066, 0.1, 0.21, 0.08);
    }
    const valve = kit.cylinder(group, '#80583c', 0.06, y, 0.21, 0.066, 0.19);
    valve.rotation.x = Math.PI / 2;
    const wheel = piece(group, ring, iron, 0.06, y, 0.315, 0.15, 0.15, 0.15);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      kit.rod(
        group,
        '#865944',
        [0.06 - 0.125 * Math.cos(a), y - 0.125 * Math.sin(a), 0.315],
        [0.06 + 0.125 * Math.cos(a), y + 0.125 * Math.sin(a), 0.315],
        0.009,
      );
    }
    wheel.rotation.z = 0.15;
  }
  const ring = new T.TorusGeometry(0.86, 0.11, 6, 24);
  const iron = kit.get('#944f35');
  kit.geometries.push(ring);
  const wirePaths = [0, 1].map((i) => {
    const curve = new T.CatmullRomCurve3([
      new T.Vector3(-1.54, 0, 0),
      new T.Vector3(-0.87, -0.16, 0.07),
      new T.Vector3(-0.34, -0.63 - i * 0.23, 0.17),
      new T.Vector3(0.25, -0.81 - i * 0.13, 0.21),
      new T.Vector3(0.91, -0.31, 0.12),
      new T.Vector3(1.52, -0.06, 0.02),
    ]);
    const wire = new T.TubeGeometry(curve, 30, 0.012 + i * 0.004, 6, false);
    kit.geometries.push(wire);
    return wire;
  });
  function leak(x: number, z: number, dx: number, dz: number, n: number) {
    const g = new T.Group();
    g.rotation.y = Math.atan2(-dx, -dz);
    g.position.set((x + dx * 0.5) * TILE, 0, (z + dz * 0.5) * TILE);
    statics.add(g);
    const seed = Math.floor(hash(x, z, 12) * 65000);
    const variant = n % 2;
    const patchWidth = 1.85 + 0.65 * hash(x, z, 34);
    const patchHeight = height * (0.68 + 0.27 * hash(x, z, 35));
    const patchY = height * 0.49 + (hash(x, z, 36) - 0.5) * 0.26;
    piece(g, panel, wall[variant], -0.14, patchY, 0.024, patchWidth, patchHeight, 1);
    piece(
      g,
      flaps[variant],
      paperBack,
      -0.14 - patchWidth * 0.24,
      patchY - patchHeight * 0.03,
      0.036,
      0.21,
      0.47,
      0.82,
    );
    piece(
      g,
      flaps[1 - variant],
      paperBack,
      -0.14 + patchWidth * 0.24,
      patchY - patchHeight * 0.16,
      0.039,
      0.12,
      0.37,
      0.72,
    );
    if (n % 3 !== 2) pipe(g, 2.75);
    if (n % 3 !== 1)
      for (let i = 0; i < 2; i++) {
        piece(
          g,
          wirePaths[i],
          kit.get(i ? '#493f30' : '#262925'),
          0,
          height - 0.22 + i * 0.034,
          0.074,
          1,
          1,
          1,
        );
        kit.cube(g, '#6c6958', i ? 1.48 : -1.48, height - 0.22, 0.064, 0.15, 0.18, 0.09);
      }
    piece(g, sag, tile, 0.31, height - 0.031, 0.66, 1.12, 1, 0.75);
    // A dark reveal behind the dropped corner and a metal suspension runner.
    kit.cube(g, '#555447', 0.31, height - 0.017, 0.66, 1.14, 0.022, 0.77);
    kit.cube(g, '#aaa894', 0.31, height - 0.047, 0.267, 1.17, 0.032, 0.033);
    if (n % 4 === 0 || n % 5 === 1) chair(g, -0.65, 0.5);
    if (n % 4 === 0 || n % 5 === 2) monitor(g, 0.57, 0.39);
    if (n % 4 !== 3) paperwork(g, 3 + (n % 5), seed);
    spills.push({
      x: x * TILE + dx * 0.39,
      z: z * TILE + dz * 0.39,
      length: 1.12 + 0.28 * hash(x, z, 3),
      width: 0.51 + 0.25 * hash(x, z, 4),
      angle: dx ? Math.PI / 2 : 0,
      seed,
    });
  }
  const candidates = cells.filter(
    ([x, z]) =>
      free(x, z) &&
      sides.some(
        ([dx, dz]) => stage.map[z + dz]?.[x + dx] === '#' && !occupied.has(x + dx + ',' + (z + dz)),
      ),
  );
  const [sx, sz] = stage.spawn;
  const closest = [...candidates].sort(
    (a, b) => Math.hypot(a[0] - sx, a[1] - sz) - Math.hypot(b[0] - sx, b[1] - sz),
  )[0];
  const sites: Cell[] = [];
  const sorted = candidates.sort((a, b) => hash(...a, 67) - hash(...b, 67));
  for (const [x, z] of closest ? [closest, ...sorted] : sorted) {
    if (sites.some(([u, v]) => Math.hypot(u - x, v - z) < 3.5)) continue;
    const [dx, dz] = sides.find(
      ([a, b]) => stage.map[z + b]?.[x + a] === '#' && !occupied.has(x + a + ',' + (z + b)),
    )!;
    leak(x, z, dx, dz, sites.length);
    sites.push([x, z]);
    if (sites.length >= 30) break;
  }
  // The abandoned workstation marks the entry even when it opens into the concrete hall.
  const forwardX = Math.round(Math.sin(stage.facing ?? 0)),
    forwardZ = -Math.round(Math.cos(stage.facing ?? 0));
  const ex = sx + forwardX * 2,
    ez = sz + forwardZ * 2;
  if (free(ex, ez) && !sites.some(([x, z]) => Math.hypot(x - ex, z - ez) < 1.5)) {
    const g = new T.Group();
    g.position.set(ex * TILE, 0, ez * TILE);
    g.rotation.y = -(stage.facing ?? 0) + 0.18;
    chair(g, -0.82, 0);
    monitor(g, 0.5, 0.05);
    paperwork(g, 7, 144);
    statics.add(g);
    spills.push({
      x: ex * TILE - forwardX * 0.7,
      z: ez * TILE - forwardZ * 0.7,
      length: 1.36,
      width: 0.69,
      angle: 0.38,
      seed: 36,
    });
  }
  if (!spills.length) return;
  const water = corridorPuddles(spills);
  root.add(water);
  return {
    spills,
    isWet: (x: number, z: number) => spills.some((spill) => inSpill(spill, x, z)),
    dispose() {
      water.geometry.dispose();
      water.dispose();
    },
  };
}
