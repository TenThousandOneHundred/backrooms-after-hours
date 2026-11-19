import { makeResident } from './residents';
import * as THREE from 'three';
import type { Stage } from './campaign';
import { hash, styleFor, texture, type Finish } from './world-materials';
import { makeEntity, makeModel, ModelKit } from './world-models';

export const TILE = 3.2;
// The staircase folds back at each landing. Interpolation keeps movement smooth around the turns.
export function terrainHeight(stage: Stage, x: number, z: number) {
  if (stage.id !== 'stair') return 0;
  const lane = Math.max(0, Math.min(3, (z / TILE - 1) / 2)),
    i = Math.floor(lane),
    u = Math.min(1, Math.max(0, (lane - i - 0.25) * 2));
  const along = Math.max(0, Math.min(19, x / TILE - 1));
  const level = (k: number) => k * 7.6 + (k % 2 ? 19 - along : along) * 0.4;
  return level(i) + (level(Math.min(3, i + 1)) - level(i)) * (u * u * (3 - 2 * u));
}
const DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
type Vec = [number, number, number];
type SurfaceData = { p: number[]; n: number[]; u: number[]; c: number[]; i: number[] };
type Chunk = { geo: THREE.BufferGeometry; mat: THREE.Material; transforms: THREE.Matrix4[] };
function familyLight(stage: Stage) {
  return /suburbs|dark|pipes|blackgarage|run|hotelchase|redrooms/.test(stage.id) ? 1.16 : 1.55;
}
const newSurface = (): SurfaceData => ({ p: [], n: [], u: [], c: [], i: [] });

export function buildWorld(scene: THREE.Scene, stage: Stage) {
  const style = styleFor(stage.theme, stage.id),
    kit = new ModelKit(),
    root = new THREE.Group(),
    statics = new THREE.Group();
  scene.add(root);
  const h = style.height,
    objects = new Map<string, THREE.Object3D>(),
    materials: THREE.Material[] = [],
    geometries: THREE.BufferGeometry[] = [],
    textures: THREE.Texture[] = [];
  const color = (s: string) => new THREE.Color(s);
  const fog = color(style.fog).multiplyScalar(style.open ? 1 : 0.68),
    nightFog = color('#263642'),
    nightSky = color('#141e30');
  let domeHorizon: THREE.Color | undefined, domeTop: THREE.Color | undefined;
  scene.background = fog.clone();
  scene.fog = new THREE.FogExp2(fog, style.open ? 0.018 : style.family === 'blackout' ? 0.063 : 0.033);
  const ambience = new THREE.AmbientLight(
    style.family === 'alarm' ? '#ffc7b5' : '#fff8e9',
    familyLight(stage) * (style.open ? 1 : 0.78),
  );
  const sky = new THREE.HemisphereLight(
    style.open ? '#e2ebe7' : '#fff9df',
    style.open ? '#b2a888' : '#b4ac93',
    style.open ? 1.72 : 1.04,
  );
  const directional = new THREE.DirectionalLight(
    style.open ? '#d8dfcb' : '#e9dabe',
    style.open ? 0.71 : 0.51,
  );
  directional.position.set(-7, 8, 4);
  root.add(ambience, sky, directional);
  const tile = (x: number, z: number) => stage.map[z]?.[x] ?? '#';
  const open = (x: number, z: number) => tile(x, z) !== '#';
  const isOutdoor = !!style.open,
    family = style.family;
  const hotelAisle = stage.map.reduce(
    (best, row, i, rows) => (row.replace(/#/g, '').length > rows[best].replace(/#/g, '').length ? i : best),
    0,
  );
  const walls = newSurface(),
    floors = newSurface(),
    ceilings = newSurface(),
    trim = newSurface();
  const clock = { value: 0 },
    circuit = { value: 0 },
    circuitCenter = { value: new THREE.Vector2() };
  const eye = new THREE.Vector3(),
    view = new THREE.Vector3(),
    temp = new THREE.Vector3();
  let circuitAge = 10,
    apparitionAge = 10;
  const lamps: { x: number; z: number }[] = [];
  for (let z = 0; z < stage.map.length; z++)
    for (let x = 0; x < stage.map[z].length; x++) {
      if (!open(x, z) || isOutdoor) continue;
      // Consecutive unpowered banks leave a pocket of darkness visible across a room.
      const brownout = family === 'lobby' && hash(Math.floor(x / 3), Math.floor(z / 3), 98) < 0.41;
      if (brownout && (x !== stage.spawn[0] || z !== stage.spawn[1])) continue;
      const even = (x + z) % 3 === 0,
        lane = x % 3 === 1 && z % 3 === 1;
      if ((even && hash(x, z, 13) > 0.48) || lane || (x === stage.spawn[0] && z === stage.spawn[1]))
        lamps.push({ x: x * TILE, z: z * TILE });
    }
  const lampGrid = new Map<string, { x: number; z: number }[]>();
  for (const p of lamps) {
    const xi = Math.round(p.x / TILE),
      zi = Math.round(p.z / TILE);
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) {
        const tx = xi + dx,
          tz = zi + dz;
        if (!open(tx, tz)) continue;
        let clear = true;
        for (let step = 1; step < 8; step++) {
          const a = step / 8;
          if (!open(Math.round(xi + dx * a), Math.round(zi + dz * a))) {
            clear = false;
            break;
          }
        }
        if (!clear) continue;
        const key = tx + ',' + tz;
        const arr = lampGrid.get(key) ?? [];
        arr.push(p);
        lampGrid.set(key, arr);
      }
  }
  function shade(
    x: number,
    y: number,
    z: number,
    normal: Vec,
    kind: 'wall' | 'floor' | 'ceil' | 'trim',
    tx: number,
    tz: number,
  ) {
    const lights = lampGrid.get(tx + ',' + tz) ?? [];
    let nearest = 10000,
      second = 10000;
    for (const p of lights) {
      const dx = x - p.x,
        dz = z - p.z,
        d2 = dx * dx + dz * dz;
      if (d2 < nearest) {
        second = nearest;
        nearest = d2;
      } else if (d2 < second) second = d2;
    }
    const pool = kind === 'ceil' ? 1.7 : kind === 'floor' ? 4.5 : 4.0;
    const direct = 1 / (1 + nearest / pool),
      bounce = 1 / (1 + second / 8);
    let value = 0.106 + 0.95 * direct + 0.21 * bounce;
    if (kind === 'floor') value = 0.13 + 0.89 * direct + 0.20 * bounce;
    if (kind === 'ceil') value = 0.15 + 0.89 * direct + 0.15 * bounce;
    if (kind === 'wall' || kind === 'trim') {
      value *= 0.83 + 0.21 * (y / h) + 0.07 * Math.sin((Math.PI * y) / h);
      value *= 1 + normal[0] * 0.17 + normal[2] * 0.09;
    }
    // Ground contact darkening along built walls, with smooth interpolation across the floor.
    const localX = x / TILE - tx,
      localZ = z / TILE - tz;
    const edges = [
      [1, 0, 0.5 - localX],
      [-1, 0, 0.5 + localX],
      [0, 1, 0.5 - localZ],
      [0, -1, 0.5 + localZ],
    ];
    let gap = 1;
    for (const [dx, dz, d] of edges)
      if (!(dx === -normal[0] && dz === -normal[2]) && !open(tx + dx, tz + dz))
        gap = Math.min(gap, Math.max(0, d));
    value *= 1 - (kind === 'floor' ? 0.29 : 0.17) * Math.exp(-gap * 8.5);
    if (kind === 'wall')
      value *= 1 - 0.29 * Math.exp(-Math.max(0, y) * 3.2) - 0.13 * Math.exp(-Math.max(0, h - y) * 3.5);
    if (isOutdoor) value = (kind === 'floor' ? 0.76 : 0.82) + 0.18 * Math.sin(x * 0.28 + z * 0.18);
    if (family === 'lobby') {
      // Banks share a ballast. Their shadows cross floor and wallpaper continuously.
      const bx = x / (TILE * 2.9),
        bz = z / (TILE * 2.9),
        ix = Math.floor(bx),
        iz = Math.floor(bz);
      let u = bx - ix,
        v = bz - iz;
      u = u * u * (3 - 2 * u);
      v = v * v * (3 - 2 * v);
      const field =
        (hash(ix, iz, 673) * (1 - u) + hash(ix + 1, iz, 673) * u) * (1 - v) +
        (hash(ix, iz + 1, 673) * (1 - u) + hash(ix + 1, iz + 1, 673) * u) * v;
      const k = Math.max(0, Math.min(1, (field - 0.32) * 2.1));
      value *= 0.25 + 0.9 * k;
    }
    if (family === 'alarm') value *= 0.73;
    if (family === 'pipes') value *= 0.7;
    if (family === 'suburb' && stage.id === 'suburbs') value *= 0.59;
    if (kind === 'floor' && tile(tx, tz) === '!') value *= 0.13;
    return Math.max(0.022, value * style.level);
  }
  function quad(
    s: SurfaceData,
    origin: Vec,
    U: Vec,
    V: Vec,
    N: Vec,
    du: number,
    dv: number,
    repeat: number,
    kind: 'wall' | 'floor' | 'ceil' | 'trim',
    tx: number,
    tz: number,
  ) {
    const index = s.p.length / 3;
    const cross = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]];
    const forward = cross[0] * N[0] + cross[1] * N[1] + cross[2] * N[2] > 0;
    for (let j = 0; j <= dv; j++)
      for (let i = 0; i <= du; i++) {
        const x = origin[0] + (U[0] * i) / du + (V[0] * j) / dv,
          y = origin[1] + (U[1] * i) / du + (V[1] * j) / dv,
          z = origin[2] + (U[2] * i) / du + (V[2] * j) / dv;
        s.p.push(x, y + terrainHeight(stage, x, z), z);
        s.n.push(...N);
        if (N[1]) s.u.push(x / repeat, z / repeat);
        else s.u.push((N[0] ? z : x) / repeat, y / repeat);
        const light = shade(x, y, z, N, kind, tx, tz);
        s.c.push(light, light * (0.982 + 0.018 * (1 - light)), light * (0.94 + 0.05 * (1 - light)));
        if (i < du && j < dv) {
          const a = index + j * (du + 1) + i,
            b = a + 1,
            c = a + du + 1,
            d = c + 1;
          if (forward) s.i.push(a, b, d, a, d, c);
          else s.i.push(a, d, b, a, c, d);
        }
      }
  }
  function finish(s: SurfaceData, kind: Finish | undefined, col: string) {
    if (!s.p.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(s.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(s.n, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(s.u, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(s.c, 3));
    geo.setIndex(s.i);
    geo.computeBoundingSphere();
    const tex = kind ? texture(kind, col) : null;
    if (tex) textures.push(tex);
    const mat = new THREE.MeshLambertMaterial({
      color: kind ? '#ffffff' : col,
      vertexColors: true,
      map: tex,
    });
    if (kind === 'water')
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uWaterTime = clock;
        shader.vertexShader =
          'varying vec3 vWaterPos;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvWaterPos=position;',
          );
        shader.fragmentShader =
          'uniform float uWaterTime; varying vec3 vWaterPos;\n' +
          shader.fragmentShader.replace(
            '#include <map_fragment>',
            `
        #include <map_fragment>
        vec2 w=vWaterPos.xz; float tm=uWaterTime*.62;
        vec2 wave=vec2(sin(w.y*3.3+tm)+sin(w.x*2.5-w.y*1.8+tm*.6),cos(w.x*3.7-tm)+sin(w.y*2.2+tm*.9));
        float line=abs(sin(w.x*2.13+sin(w.y*2.08+tm)*1.25+tm*.7)+cos(w.y*2.83+sin(w.x*1.54-tm)*1.65));
        diffuseColor.rgb+=vec3(.036,.084,.072)*(1.-smoothstep(.025,.19,line));
        vec3 eye=normalize(vWaterPos-cameraPosition); vec3 beam=reflect(eye,normalize(vec3(.024*wave.x,1.,.024*wave.y)));
        vec2 reflected=w+beam.xz*(4.8/max(.052,beam.y));
        vec2 cell=abs(fract(reflected/6.4+.5)-.5)*6.4;
        float shine=(1.-smoothstep(.25,.46,cell.x))*(1.-smoothstep(.5,.85,cell.y));
        float fresnel=pow(1.-clamp(-eye.y,0.,1.),2.);
        diffuseColor.rgb+=shine*(.028+.27*fresnel)*vec3(.85,1.,.95)+.052*fresnel*vec3(.65,1.,.96);
      `,
          );
      };
    const m = new THREE.Mesh(geo, mat);
    if (s === floors)
      m.onBeforeRender = (_r, _s, camera) => {
        camera.getWorldPosition(eye);
        camera.getWorldDirection(view);
      };
    root.add(m);
    materials.push(mat);
    geometries.push(geo);
  }
  const crop = new THREE.BufferGeometry();
  crop.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        -0.021, 0, 0, 0.021, 0, 0, 0.014, 0.73, 0.015, -0.021, 0, 0, 0.014, 0.73, 0.015, -0.012, 0.75, 0.015,
        0.002, 0.23, 0, 0.024, 0.51, 0.018, 0.18, 0.63, 0.025, 0.004, 0.43, 0, -0.02, 0.6, 0.013, -0.139,
        0.72, 0.013, -0.055, 0.73, 0, 0, 0.99, 0.018, 0.063, 0.76, 0.014, -0.025, 0.77, -0.044, 0.015, 0.98,
        0, 0.035, 0.75, 0.046,
      ],
      3,
    ),
  );
  crop.computeVertexNormals();
  kit.geometries.push(crop);
  const canopy = new THREE.IcosahedronGeometry(0.5, 1);
  kit.geometries.push(canopy);
  const b = (
    col: string,
    x: number,
    y: number,
    z: number,
    w: number,
    height: number,
    d: number,
    emissive = false,
  ) => kit.cube(statics, col, x, y, z, w, height, d, !emissive);
  const sphere = (col: string, x: number, y: number, z: number, w: number, height: number, d: number) =>
    kit.ball(statics, col, x, y, z, w, height, d);
  function makeArch(x: number, z: number, dx: number, dz: number, rand: number) {
    const span = TILE,
      angle = dx ? Math.PI / 2 : 0;
    const nx = x - dx * 0.04,
      nz = z - dz * 0.04;
    function piece(
      c: string,
      u: number,
      y: number,
      depth: number,
      width: number,
      hh: number,
      thick: number,
      lit = true,
    ) {
      const m = kit.cube(
        statics,
        c,
        nx + u * dz - depth * dx,
        y,
        nz - u * dx - depth * dz,
        width,
        hh,
        thick,
        lit,
      );
      m.rotation.y = angle;
      return m;
    }
    if (family === 'lobby' || family === 'office' || family === 'school') {
      if (rand > 0.9) {
        piece('#c5ba96', 0, 0.37, 0.012, 0.085, 0.13, 0.02);
        for (const v of [-0.018, 0.025]) {
          piece('#6b6553', -0.014, 0.37 + v, 0.027, 0.01, 0.028, 0.008);
          piece('#6b6553', 0.014, 0.37 + v, 0.027, 0.01, 0.028, 0.008);
        }
      }
      if (rand < 0.043) {
        piece('#aaa58d', 0.16, 2.4, 0.02, 0.59, 0.26, 0.035);
        for (let i = 0; i < 6; i++) piece('#5e6155', 0.16, 2.29 + i * 0.04, 0.04, 0.5, 0.012, 0.008);
      }
    }
    if (family === 'pipes' || family === 'utility' || family === 'garage') {
      for (let i = 0; i < (family === 'pipes' ? 3 : 1); i++) {
        const y = family === 'garage' ? h - 0.25 : h - 0.33 - i * 0.22,
          off = 0.12 + i * 0.05;
        const start = [nx - dz * span * 0.502 - dx * off, y, nz + dx * span * 0.502 - dz * off],
          end = [nx + dz * span * 0.502 - dx * off, y, nz - dx * span * 0.502 - dz * off];
        kit.rod(statics, i === 1 ? '#997850' : '#737b74', start, end, i === 0 ? 0.075 : 0.043);
        piece('#454f4c', 0.65, y, off, 0.1, i === 0 ? 0.22 : 0.14, 0.19);
      }
      if (family === 'pipes') {
        for (let i = 0; i < 2; i++) {
          const off = 0.22 + i * 0.14,
            yy = 0.5 + i * 0.55;
          kit.rod(
            statics,
            i ? '#907751' : '#716c55',
            [nx - dz * 1.607 - dx * off, yy, nz + dx * 1.607 - dz * off],
            [nx + dz * 1.607 - dx * off, yy, nz - dx * 1.607 - dz * off],
            0.14 + i * 0.035,
          );
          piece('#4c5148', 0.92, yy, off, 0.11, 0.38 + i * 0.05, 0.38 + i * 0.05);
        }
      }
      if (family === 'garage') {
        piece('#7d8d6a', 0, 1.36, 0.014, span, 0.18, 0.015);
        piece('#c2b682', 0, 1.18, 0.014, span, 0.045, 0.015);
      }
    }
    if (family === 'pool') {
      if (rand > 0.56) {
        const wid = 1.38 + rand * 0.83;
        piece('#8caaa6', 0, 2.58, 0.018, wid + 0.12, 2.05, 0.04);
        piece('#d4e3d9', 0, 2.58, 0.048, wid, 1.93, 0.02, false);
        for (const u of [-1, 0, 1]) piece('#b4c8bc', u * wid * 0.42, 2.58, 0.075, 0.05, 1.98, 0.03);
        piece('#b3c6bb', 0, 2.57, 0.073, wid, 0.045, 0.025);
      }
      piece('#539b9b', 0, 0.55, 0.017, span, 0.14, 0.018);
      piece('#d2dacc', 0, 0.68, 0.017, span, 0.045, 0.02);
      if (rand > 0.8) {
        piece('#e1e4c9', 0, h * 0.7, 0.025, 0.87, 0.24, 0.03, false);
        piece('#78928e', 0, h * 0.7 + 0.15, 0.03, 0.95, 0.05, 0.06);
      }
    }
    if (family === 'hotel' && rand > 0.67) {
      for (const u of [-0.105, 0.105]) piece('#997945', u, 1.69, 0.095, 0.06, 3.38, 0.12);
      piece('#866842', 0, 1.68, 0.085, 0.22, 3.35, 0.19);
      piece('#a38955', 0, 3.36, 0.12, 0.33, 0.14, 0.24);
      piece('#b59a67', 0, 0.12, 0.14, 0.38, 0.24, 0.28);
    }
    if (family === 'hotel' || family === 'library' || family === 'pink') {
      piece(family === 'pink' ? '#c27a90' : '#76614c', 0, 0.51, 0.02, span, 0.99, 0.04);
      piece(family === 'pink' ? '#efc8cf' : '#ab8f6f', 0, 1.03, 0.052, span, 0.078, 0.1);
      for (const u of [-1.3, -0.6, 0.1, 0.8, 1.45])
        piece(family === 'pink' ? '#dca4ae' : '#8f7760', u, 0.51, 0.055, 0.045, 0.87, 0.035);
      if (rand > 0.76) {
        piece('#765e47', 0, 1.89, 0.13, 0.085, 0.23, 0.12);
        piece('#f0d5a3', 0, 2.04, 0.17, 0.22, 0.3, 0.16, false);
      }
    }
    if (family === 'alarm' && rand > 0.65) {
      piece('#47312b', 0, 1.08, 0.039, 1.04, 2.15, 0.075);
      piece('#684337', 0, 1.07, 0.088, 0.92, 2.04, 0.036);
      piece('#9d6951', 0, 1.5, 0.114, 0.22, 0.36, 0.021);
      piece('#b18f72', 0.33, 0.99, 0.132, 0.16, 0.04, 0.06);
    }
    if (family === 'hospital' || family === 'alarm') {
      piece(family === 'alarm' ? '#af5144' : '#82a49d', 0, 1.16, 0.015, span, 0.39, 0.025);
      piece('#726e61', 0, 0.88, 0.048, span, 0.084, 0.08);
    }
    if (family === 'court') {
      for (let j = 0; j < 4; j++) {
        const yy = 1.9 + j * 1.48;
        piece('#59655e', 0, yy, 0.04, 1.08, 0.97, 0.08);
        piece(
          rand > 0.78 && j === Math.floor(rand * 10) % 4 ? '#e3d9ab' : '#657772',
          0,
          yy,
          0.095,
          0.94,
          0.82,
          0.042,
          rand < 0.78,
        );
        piece('#a3aba0', 0, yy - 0.49, 0.105, 1.21, 0.055, 0.17);
        piece('#939f94', 0, yy, 0.128, 0.036, 0.83, 0.024);
      }
    }
    if (family === 'castle') {
      piece('#795f4c', 0, 0.45, 0.036, span, 0.86, 0.077);
      if (rand > 0.5) {
        piece('#695344', 0, 2.64, 0.03, 0.77, 1.1, 0.035);
        piece('#84644a', 0, 2.64, 0.055, 0.61, 1.01, 0.04);
        piece('#d3ac6c', 0, 2.63, 0.084, 0.086, 0.72, 0.02);
      }
    }
    if (family === 'stairs') {
      piece('#65746c', 0, 1.06, 0.15, span, 0.055, 0.06);
      for (const u of [-1.15, 0.2, 1.17]) piece('#819087', u, 0.52, 0.15, 0.035, 1.05, 0.04);
    }
    if (family === 'diner') {
      piece('#8e5249', 0, 1.04, 0.018, span, 0.14, 0.038);
      piece('#c4b7a7', 0, 1.18, 0.02, span, 0.045, 0.044);
      if (rand > 0.64) {
        piece('#7eaaa6', 0, 1.98, 0.032, 1.96, 1.07, 0.04);
        piece('#bdd6c9', 0, 2, 0.07, 1.83, 0.96, 0.035);
        piece('#9fac9e', 0, 2, 0.1, 0.062, 1, 0.05);
      }
    }
    if (family === 'cave' || family === 'abyss') {
      for (let j = 0; j < 4; j++) {
        const u = (hash(j, Math.floor(nx + nz), 19) - 0.5) * 2.9,
          ww = 0.45 + hash(j + 2, Math.floor(nx + nz), 32) * 0.63;
        const m = kit.add(
          statics,
          canopy,
          j % 2 ? '#696860' : '#5f5e57',
          nx + u * dz,
          ww * 0.36,
          nz - u * dx,
          ww,
          0.8 * ww,
          ww * 0.7,
        );
        m.rotation.y = j * 1.4;
      }
    }
    if (family === 'garden' && rand > 0.33) {
      for (let i = 0; i < 4; i++) {
        const u = (hash(i, Math.floor(nx + nz), 67) - 0.5) * 2.9,
          length = 0.4 + hash(i, Math.floor(nx + nz), 92) * 1.5;
        piece('#647455', u, h - length / 2, 0.06, 0.034, length, 0.045);
        for (let j = 0; j < Math.floor(length / 0.18); j++) {
          const leaf = piece(
            j % 2 ? '#788557' : '#708355',
            u + (j % 2 ? 0.07 : -0.07),
            h - 0.2 - j * 0.17,
            0.081,
            0.15,
            0.13,
            0.032,
          );
          leaf.rotation.z = (j % 2 ? 1 : -1) * 0.35;
        }
      }
    }
    if (family === 'suburb') {
      const paint = rand > 0.75 ? '#b9b6a2' : rand > 0.42 ? '#a7a592' : '#a4a899';
      for (let yy = 0.48; yy < 3.29; yy += 0.225) piece(paint, 0, yy, 0.005, span, 0.009, 0.011);
      if (rand < 0.24) {
        piece('#64695f', 0, 1.07, 0.04, 0.88, 2.12, 0.08);
        piece('#858674', 0, 1.08, 0.093, 0.74, 1.99, 0.035);
        piece('#b4ab8d', 0.25, 1.02, 0.13, 0.067, 0.038, 0.06);
      }
      piece('#6d7164', 0, 0.25, 0.015, span, 0.5, 0.025);
      if (rand > 0.2) {
        piece('#b6b7a0', 0, 1.7, 0.03, 1.31, 1.02, 0.045);
        piece(rand > 0.78 ? '#cab88c' : '#65716f', 0, 1.71, 0.07, 1.17, 0.87, 0.04);
        piece('#aaae99', 0, 1.71, 0.1, 0.047, 0.9, 0.035);
        piece('#aaae99', 0, 1.72, 0.1, 1.2, 0.045, 0.035);
      }
    }
    if (family === 'garden' && rand > 0.73) {
      const xx = nx - dx * 0.35,
        zz = nz - dz * 0.35,
        height = 2.0 + rand * 0.77;
      kit.rod(statics, '#6b6850', [xx, 0, zz], [xx + 0.12, height, zz], 0.073);
      for (let j = 0; j < 5; j++) {
        const ang = j * 2.39,
          ex = xx + Math.cos(ang) * 0.61,
          ez = zz + Math.sin(ang) * 0.61;
        kit.rod(statics, '#747151', [xx + 0.05, height * 0.68, zz], [ex, height + 0.15, ez], 0.036);
        const leaves = kit.add(
          statics,
          canopy,
          ['#5f7855', '#6e8259', '#788957'][j % 3],
          ex,
          height + 0.25,
          ez,
          0.9,
          0.64,
          1.0,
        );
        leaves.rotation.y = ang;
      }
    }
    if (family === 'sea' && rand > 0.42) {
      const off = 1.35,
        xx = nx + dx * off,
        zz = nz + dz * off;
      for (const u of [-0.74, 0.74])
        for (const v of [-0.5, 0.5]) b('#726c55', xx + u, 0.47, zz + v, 0.135, 0.94, 0.14);
      b('#827d68', xx, 1.56, zz, 1.84, 1.57, 1.53);
      const roof = b('#514f48', xx, 2.42, zz, 2.18, 0.19, 1.88);
      roof.rotation.z = (rand - 0.69) * 0.43;
      piece('#c9bc93', 0, 1.73, -off + 0.81, 0.57, 0.45, 0.032, false);
      piece('#776f5b', 0, 1.73, -off + 0.86, 0.035, 0.45, 0.015);
    }
    if (family === 'field') {
      for (let j = 0; j < 15; j++) {
        const along = span * (hash(j, Math.floor(nx + nz), 22) - 0.5),
          off = hash(j, Math.floor(nx - nz), 14) * 1.6;
        const px = nx + dz * along + dx * off,
          pz = nz - dx * along + dz * off;
        const grain = kit.add(
          statics,
          crop,
          ['#a9934f', '#b39d58', '#94884c', '#b5a66c'][j % 4],
          px,
          0.02,
          pz,
          1,
          1.03 + rand * 0.45,
          1,
        );
        grain.rotation.y = j * 1.97;
        grain.material.side = THREE.DoubleSide;
      }
    }
    if (family === 'arcade' && rand > 0.38) {
      piece('#ad6598', 0, 0.92, 0.04, span, 0.036, 0.045, false);
      piece('#83b3bd', 0, 1.03, 0.04, span, 0.024, 0.045, false);
    }
    if (family === 'party') {
      piece('#7f7591', 0, 0.79, 0.01, span, 0.29, 0.025);
      for (let i = 0; i < 8; i++)
        piece(i % 2 ? '#c49a6c' : '#73969e', -1.39 + i * 0.4, 0.79, 0.029, 0.18, 0.18, 0.014);
    }
  }
  for (let z = 0; z < stage.map.length; z++)
    for (let x = 0; x < stage.map[z].length; x++) {
      if (!open(x, z)) continue;
      const cx = x * TILE,
        cz = z * TILE,
        ox = cx - TILE / 2,
        oz = cz - TILE / 2,
        rand = hash(x, z, 5),
        tileType = tile(x, z),
        beam = tileType === '|',
        pit = tileType === 'X' || beam;
      if (!pit)
        quad(
          floors,
          [ox, family === 'stairs' ? -0.16 : 0, oz],
          [TILE, 0, 0],
          [0, 0, TILE],
          [0, 1, 0],
          4,
          4,
          style.floor === 'carpet' ? 2.05 : TILE,
          'floor',
          x,
          z,
        );
      else {
        if (beam) {
          b('#8d714c', cx, -0.08, cz, 0.85, 0.16, TILE);
          b('#bea25e', cx, 0.006, cz, 0.067, 0.012, TILE);
        }
        b(family === 'stairs' ? '#e8e5d3' : '#171a15', cx, -2.8, cz, TILE, 0.09, TILE, family === 'stairs');
        for (const [dx, dz] of DIRS)
          if (!['X', '|'].includes(tile(x + dx, z + dz)))
            b(
              '#665b43',
              cx + (dx * TILE) / 2,
              -1.37,
              cz + (dz * TILE) / 2,
              dx ? 0.037 : TILE,
              2.72,
              dz ? 0.037 : TILE,
            );
      }
      if (!isOutdoor)
        quad(ceilings, [ox, h, oz], [TILE, 0, 0], [0, 0, TILE], [0, -1, 0], 3, 3, TILE, 'ceil', x, z);
      if (tileType === '!') {
        for (const [dx, dz] of DIRS) {
          if (tile(x + dx, z + dz) !== '!')
            b('#94a985', cx + dx * (TILE / 2 - 0.04), 0.02, cz + dz * (TILE / 2 - 0.04), dx ? 0.08 : TILE, 0.012, dz ? 0.08 : TILE);
        }
      }
      if (family === 'pool' && !pit) {
        if ((x + z) % 4 < 2) {
          const w = 0.12 + rand * 0.35,
            gx = cx + (rand - 0.5) * 1.8,
            gz = cz + Math.sin(rand * 14);
          b('#a2c5ba', gx, 0.013, gz, w, 0.007, 0.022);
          b('#8bbcaf', gx + 0.18, 0.013, gz + 0.14, w * 0.64, 0.007, 0.017);
        }
        if (rand > 0.89 && DIRS.some(([dx, dz]) => !open(x + dx, z + dz)))
          b('#b7c5b5', cx, 0.012, cz, TILE, 0.023, 0.17);
      }
      if (family === 'hotel' && !pit && z === hotelAisle) {
        const east = open(x + 1, z),
          west = open(x - 1, z),
          north = open(x, z - 1),
          south = open(x, z + 1);
        if ((east && west) || (!north && !south)) {
          b('#88493c', cx, 0.014, cz, TILE, 0.018, 1.03);
          for (const side of [-1, 1]) b('#b69961', cx, 0.026, cz + side * 0.45, TILE, 0.008, 0.025);
        } else {
          b('#88493c', cx, 0.014, cz, 1.03, 0.018, TILE);
          for (const side of [-1, 1]) b('#b69961', cx + side * 0.45, 0.026, cz, 0.025, 0.008, TILE);
        }
      }
      if (family === 'stairs' && !pit)
        for (let j = 0; j < 5; j++)
          b('#92988c', ox + ((j + 0.5) * TILE) / 5, -0.03, cz, TILE / 5, 0.105, TILE);
      if (stage.id === 'plastic') {
        const pal = ['#9e5154', '#69858e', '#b4ad70', '#889c79', '#b79898', '#8293b4'];
        for (let j = 0; j < 39; j++) {
          const xx = ox + hash(x * 47 + j, z, 201) * TILE,
            zz = oz + hash(x * 47 + j, z, 202) * TILE,
            r = 0.17 + hash(x + j, z, 205) * 0.15;
          sphere(pal[(j + z) % pal.length], xx, 0.028, zz, r, r, r);
        }
      }
      if (family === 'cave' || family === 'abyss') {
        for (let j = 0; j < 2; j++) {
          const xx = ox + hash(x + j, z, 56) * TILE,
            zz = oz + hash(x, z + j, 89) * TILE;
          const rock = kit.add(
            statics,
            kit.cone,
            '#646159',
            xx,
            h - 0.32,
            zz,
            0.3 + rand * 0.54,
            0.72 + rand * 0.87,
            0.34 + rand * 0.53,
          );
          rock.rotation.z = Math.PI + 0.14 * Math.sin(x + z + j);
        }
      }
      if (family === 'garage' && x % 2 === 0 && z % 2 === 1) {
        b('#c1b484', cx, 0.011, cz, 0.058, 0.014, 2.57);
        b('#c1b484', cx + 0.4, 0.012, cz - 1.24, 0.83, 0.014, 0.057);
      }
      if (family === 'field' && rand > 0.17) {
        for (let j = 0; j < 10; j++) {
          const bx = ox + hash(x * 11 + j, z, 40) * TILE,
            bz = oz + hash(x * 11 + j, z, 42) * TILE,
            hh = 0.26 + hash(x, z + j, 64) * 0.38;
          b('#aa9654', bx, hh / 2, bz, 0.018, hh, 0.018);
          sphere('#bbab71', bx, hh, bz, 0.055, 0.15, 0.047);
        }
      }
      for (const [dx, dz] of DIRS) {
        if (open(x + dx, z + dz)) continue;
        const wx = cx + (dx * TILE) / 2,
          wz = cz + (dz * TILE) / 2,
          side: Vec = [-dx, 0, -dz],
          U: Vec = dx ? [0, 0, TILE] : [TILE, 0, 0],
          orig: Vec = dx ? [wx, 0, oz] : [ox, 0, wz];
        let height = h;
        if (family === 'garden') height = h;
        if (family === 'field') height = 0.22;
        if (family === 'sea') height = 0.16;
        quad(walls, orig, U, [0, height, 0], side, 4, 5, style.wall === 'paper' ? 2.35 : TILE, 'wall', x, z);
        const bottom: Vec = [orig[0] - dx * 0.012, 0.002, orig[2] - dz * 0.012];
        if (!isOutdoor)
          quad(trim, bottom, U, [0, family === 'lobby' ? 0.105 : 0.13, 0], side, 4, 1, 1, 'trim', x, z);
        makeArch(wx, wz, dx, dz, hash(x + dx * 3, z + dz * 2, 3));
        if (family === 'suburb') {
          b('#625e50', wx, 3.39, wz, dx ? 0.25 : TILE + 0.12, 0.18, dz ? 0.25 : TILE + 0.12);
          const roof = b(
            '#535953',
            wx + dx * 0.72,
            3.89,
            wz + dz * 0.72,
            dx ? 1.99 : TILE + 0.13,
            0.16,
            dz ? 1.99 : TILE + 0.13,
          );
          if (dx) roof.rotation.z = dx * 0.47;
          else roof.rotation.x = -dz * 0.47;
          b('#7d8379', wx - dx * 0.31, 0.055, wz - dz * 0.31, dx ? 0.68 : TILE, 0.11, dz ? 0.68 : TILE);
          if (rand > 0.72) {
            const gable = new THREE.BufferGeometry();
            const verts = new Float32Array([
              -1.62, 0, 0, 1.62, 0, 0, 0, 1.31, 0, -1.62, 0, -1.0, 1.62, 0, -1.0, 0, 1.31, -1.0,
            ]);
            gable.setAttribute('position', new THREE.BufferAttribute(verts, 3));
            gable.setIndex([0, 1, 2, 5, 4, 3, 2, 1, 4, 2, 4, 5, 0, 2, 5, 0, 5, 3]);
            gable.computeVertexNormals();
            kit.geometries.push(gable);
            const mat = kit.get('#595f58');
            mat.side = THREE.DoubleSide;
            const face = new THREE.Mesh(gable, mat);
            face.rotation.y = Math.atan2(-dx, -dz);
            face.position.set(wx - dx * 0.15, 3.45, wz - dz * 0.15);
            statics.add(face);
            b('#777b6b', wx + dx * 0.57, 4.63, wz + dz * 0.57, 0.31, 0.95, 0.33);
          }
          if (rand > 0.72 && rand < 0.92) {
            const plant = sphere(
              '#596e50',
              wx - dx * 0.5,
              0.37,
              wz - dz * 0.5,
              dx ? 0.63 : 1.41,
              0.7,
              dz ? 0.62 : 1.41,
            );
            plant.rotation.y = rand;
          }
          if (rand > 0.85) {
            const sx = wx - dx * 0.55,
              sz = wz - dz * 0.55;
            kit.cylinder(statics, '#777f73', sx, 1.81, sz, 0.058, 3.62);
            b('#70786f', sx - dx * 0.34, 3.6, sz - dz * 0.34, dx ? 0.75 : 0.07, 0.07, dz ? 0.75 : 0.07);
            b('#e3cf98', sx - dx * 0.61, 3.55, sz - dz * 0.61, 0.32, 0.07, 0.29, true);
          }
        }
        if (family === 'field' && rand > 0.78) {
          for (const p of [-1.37, 1.37]) b('#746446', wx + dz * p, 0.57, wz - dx * p, 0.082, 1.15, 0.086);
        }
      }
    }
  for (let i = 0; i < lamps.length; i++) {
    const { x, z } = lamps[i],
      n = hash(Math.round(x / TILE), Math.round(z / TILE), 71);
    if (family === 'blackout' && i % 13 !== 0) continue;
    const off = n > 0.978 || family === 'blackout',
      compact = ['cave', 'pipes', 'utility', 'alarm', 'garden'].includes(family);
    const w = family === 'alarm' ? 1.06 : compact ? 0.23 : 0.75,
      l = family === 'alarm' ? 1.91 : compact ? 0.88 : 1.46,
      side = compact ? 0.045 : 0.025,
      hh = h - 0.041;
    const glow = off ? '#75776a' : style.lamp;
    b('#716f60', x, hh, z, w + 0.069, 0.052, l + 0.063);
    b(glow, x, hh - 0.035, z, w, 0.024, l, !off);
    if (!compact) {
      for (let j = 0; j < 3; j++) {
        b(off ? '#858779' : '#fffce6', x + (j - 1) * 0.212, hh - 0.053, z, 0.069, 0.012, l - 0.06, !off);
      }
      for (let j = -2; j <= 2; j++)
        b(off ? '#64685c' : '#bdbda5', x, hh - 0.06, z + j * 0.265, w - 0.03, 0.009, 0.012);
    } else {
      b('#8b8f79', x - w / 2, hh - 0.065, z, side, 0.065, l);
      b('#8b8f79', x + w / 2, hh - 0.065, z, side, 0.065, l);
    }
  }
  if (family === 'sea') {
    // The flooded village sits on a continuous water horizon beyond the playable route.
    const horiz = new THREE.PlaneGeometry(260, 260),
      water = new THREE.MeshLambertMaterial({ color: '#4b686d' });
    const mesh = new THREE.Mesh(horiz, water);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(stage.map[0].length * TILE * 0.5, -0.04, stage.map.length * TILE * 0.5);
    root.add(mesh);
    geometries.push(horiz);
    materials.push(water);
    const maxX = stage.map[0].length * TILE,
      maxZ = stage.map.length * TILE;
    for (let i = 0; i < 26; i++) {
      const angle = i * 2.398,
        xx = maxX / 2 + Math.cos(angle) * (maxX * 0.59 + 10),
        zz = maxZ / 2 + Math.sin(angle) * (maxZ * 0.65 + 8),
        ht = 1.2 + hash(i, 7, 888) * 1.25;
      for (const dx of [-1, 1])
        for (const dz of [-0.7, 0.7]) b('#656b60', xx + dx, 0.6, zz + dz, 0.17, 1.2, 0.15);
      b('#818473', xx, 1.12 + ht / 2, zz, 2.8, ht, 2.4);
      const zr = b('#555b54', xx, 1.2 + ht, zz, 3.2, 0.19, 2.78);
      zr.rotation.z = i % 2 ? 0.11 : -0.1;
      b('#b7b18e', xx, 1.5 + ht * 0.36, zz + 1.219, 0.66, 0.48, 0.018, i % 3 === 0);
    }
  }
  if (isOutdoor) {
    const length = Math.max(stage.map.length, stage.map[0].length) * TILE,
      mx = (stage.map[0].length * TILE) / 2,
      mz = (stage.map.length * TILE) / 2;
    const geo = new THREE.SphereGeometry(Math.max(65, length * 1.6), 28, 16),
      uniforms = {
        top: {
          value: color(
            family === 'suburb' && style.level < 1 ? '#27353f' : family === 'sea' ? '#728e9a' : '#8bafb3',
          ),
        },
        horizon: { value: fog },
      };
    const material = new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader:
        'varying vec3 v; void main(){ v=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w*.9999; }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 horizon; varying vec3 v; void main(){float h=clamp(normalize(v).y,0.,1.);vec3 dir=normalize(v);vec3 sky=mix(horizon,top,smoothstep(0.,.78,h));float disk=smoothstep(.9994,.99979,dot(dir,normalize(vec3(.58,.31,-.72))));float halo=pow(max(0.,dot(dir,normalize(vec3(.58,.31,-.72)))),95.);sky+=disk*vec3(.78,.76,.61)+halo*.16*vec3(.7,.72,.69);gl_FragColor=vec4(sky,1.);\n#include <colorspace_fragment>\n}',
    });
    domeHorizon = uniforms.horizon.value;
    domeTop = uniforms.top.value;
    const dome = new THREE.Mesh(geo, material);
    dome.position.set(mx, 0, mz);
    dome.renderOrder = -20;
    root.add(dome);
    geometries.push(geo);
    materials.push(material);
  }
  finish(walls, style.wall, style.wc);
  finish(floors, style.floor, style.fc);
  finish(
    ceilings,
    ['lobby', 'office', 'school', 'hospital', 'pink'].includes(family)
      ? 'ceiling'
      : family === 'pool'
        ? 'plaster'
        : 'concrete',
    style.cc,
  );
  finish(trim, undefined, style.trim);

  function alignment(x: number, z: number) {
    const near = DIRS.find(([dx, dz]) => !open(x + dx, z + dz));
    if (near) return { angle: Math.atan2(-near[0], -near[1]), dx: near[0], dz: near[1] };
    const vx = stage.spawn[0] - x,
      vz = stage.spawn[1] - z;
    return { angle: Math.atan2(vx, vz), dx: 0, dz: 0 };
  }
  for (const spec of stage.props ?? []) {
    if (spec.model === 'pit') continue;
    const group = makeModel(kit, spec);
    const pos = alignment(spec.x, spec.z);
    group.position.set(spec.x * TILE + pos.dx * 0.2, 0, spec.z * TILE + pos.dz * 0.2);
    group.rotation.y = spec.rotation ?? pos.angle;
    statics.add(group);
  }
  for (const spec of stage.objects) {
    const group = makeModel(kit, spec),
      pos = alignment(spec.x, spec.z);
    const model = spec.model ?? '',
      attached = /door|exit|gate|elevator|vent|sign|portrait|panel|terminal|locker/.test(model);
    const offset = attached ? 1.19 : 0;
    group.position.set(
      spec.x * TILE + pos.dx * offset,
      terrainHeight(stage, spec.x * TILE, spec.z * TILE),
      spec.z * TILE + pos.dz * offset,
    );
    group.rotation.y = pos.angle;
    // A small, broad contact shadow grounds every freestanding pickup and interaction.
    if (spec.model !== 'pit' && !attached) {
      const sh = kit.cube(group, '#6b6552', 0, 0.009, 0, 0.64, 0.012, 0.54);
      sh.material = kit.get('#6b6552');
    }
    objects.set(spec.id, group);
    root.add(group);
  }
  const residents = (stage.residents ?? []).map(site => makeResident(site, TILE, h));
  for (const resident of residents) root.add(resident.mesh);
  const entity = stage.threat ? makeEntity(kit, stage.threat.kind) : null;
  const entityHeightScale = entity?.scale.y ?? 1;
  if (entity && stage.threat) {
    entity.position.set(stage.threat.x * TILE, 0, stage.threat.z * TILE);
    root.add(entity);
  }
  // Repeated architectural details and loose furniture share a small number of draw calls.
  for (const node of statics.children)
    node.position.y += terrainHeight(stage, node.position.x, node.position.z);
  const batches = new Map<string, Chunk>();
  statics.updateMatrixWorld(true);
  statics.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || Array.isArray(obj.material)) return;
    const key = obj.geometry.uuid + '|' + obj.material.uuid;
    let batch = batches.get(key);
    if (!batch) {
      batch = { geo: obj.geometry, mat: obj.material, transforms: [] };
      batches.set(key, batch);
    }
    batch.transforms.push(obj.matrixWorld.clone());
  });
  const instances: THREE.InstancedMesh[] = [];
  for (const batch of batches.values()) {
    const mesh = new THREE.InstancedMesh(batch.geo, batch.mat, batch.transforms.length);
    batch.transforms.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    root.add(mesh);
    instances.push(mesh);
  }
  // A failing ballast affects only its circuit, including the lit panels themselves.
  for (const mat of [...materials, ...kit.materials.values()]) {
    if (!(mat instanceof THREE.MeshLambertMaterial || mat instanceof THREE.MeshBasicMaterial)) continue;
    const original = mat.onBeforeCompile.bind(mat);
    const originalKey = mat.customProgramCacheKey();
    mat.customProgramCacheKey = () => originalKey + '|local-circuit';
    mat.onBeforeCompile = (shader, renderer) => {
      original(shader, renderer);
      shader.uniforms.uCircuit = circuit;
      shader.uniforms.uCircuitCenter = circuitCenter;
      shader.vertexShader =
        'varying vec2 vCircuitPos;\n' +
        shader.vertexShader.replace(
          '#include <project_vertex>',
          `
        #include <project_vertex>
        vec4 cp=vec4(transformed,1.);
        #ifdef USE_INSTANCING
        cp=instanceMatrix*cp;
        #endif
        vCircuitPos=(modelMatrix*cp).xz;
      `,
        );
      shader.fragmentShader =
        'varying vec2 vCircuitPos; uniform vec2 uCircuitCenter; uniform float uCircuit;\n' +
        shader.fragmentShader.replace(
          '#include <opaque_fragment>',
          `
        float affected=1.-smoothstep(2.7,9.4,distance(vCircuitPos,uCircuitCenter));
        outgoingLight*=1.-uCircuit*affected*.92;
        #include <opaque_fragment>
      `,
        );
    };
  }
  const apparition = makeEntity(kit, 'bacteria');
  apparition.visible = false;
  root.add(apparition);
  function haunt(event: 'flicker' | 'steps' | 'breath' | 'silhouette', camera?: THREE.Camera) {
    if (camera) {
      camera.getWorldPosition(eye);
      camera.getWorldDirection(view);
    }
    if (event === 'flicker' || event === 'silhouette') {
      let near = Infinity;
      circuitCenter.value.set(eye.x, eye.z);
      for (const l of lamps) {
        const d = Math.hypot(eye.x + view.x * 3.8 - l.x, eye.z + view.z * 3.8 - l.z);
        if (d < near) {
          near = d;
          circuitCenter.value.set(l.x, l.z);
        }
      }
      if (!isOutdoor) circuitAge = 0;
    }
    if (event !== 'silhouette') return;
    // Place the shape only at a visible, distant point inside the current passage.
    let spot: THREE.Vector3 | undefined;
    for (const yaw of [-0.15, 0.15, -0.3, 0.3, 0]) {
      const dx = view.x * Math.cos(yaw) - view.z * Math.sin(yaw),
        dz = view.x * Math.sin(yaw) + view.z * Math.cos(yaw);
      let far = 0;
      for (let d = 0.3; d < 15; d += 0.28) {
        const xx = eye.x + d * dx,
          zz = eye.z + d * dz;
        if (!open(Math.round(xx / TILE), Math.round(zz / TILE))) break;
        far = d;
      }
      if (far > 6.7) {
        spot = temp.set(eye.x + (far - 0.9) * dx, 0, eye.z + (far - 0.9) * dz);
        break;
      }
    }
    if (spot) {
      apparition.position.copy(spot);
      apparition.position.y = terrainHeight(stage, spot.x, spot.z);
      apparition.rotation.y = Math.atan2(eye.x - spot.x, eye.z - spot.z);
      apparition.visible = true;
      apparitionAge = 0;
    }
  }
  const base = sky.intensity,
    dayFog = color(style.fog),
    daySky = color('#8bafb3');
  return {
    objects,
    residents,
    entity,
    haunt,
    update(t: number, dt: number) {
      clock.value = t;
      circuitAge += dt;
      apparitionAge += dt;
      if (apparition.visible) apparition.userData.pose(t, dt, 0, false, false);
      if (circuitAge < 2.2) {
        const a = circuitAge;
        circuit.value =
          a < 0.14
            ? a / 0.14
            : a < 0.34
              ? 0.76
              : a < 0.65
                ? 0.76 * (1 - (a - 0.34) / 0.31)
                : a < 0.94
                  ? (a - 0.65) / 0.29
                  : a < 1.52
                    ? 1
                    : Math.max(0, 1 - (a - 1.52) / 0.68);
      } else circuit.value = 0;
      if (apparitionAge > 1.65) apparition.visible = false;
      if (stage.id === 'village') {
        const phase = t % 80,
          darkness = phase < 24 ? 0 : phase < 32 ? (phase - 24) / 8 : phase < 69 ? 1 : 1 - (phase - 69) / 11;
        sky.intensity = base * (1 - 0.87 * darkness);
        ambience.intensity = 1.55 * (1 - 0.82 * darkness);
        directional.intensity = 0.71 * (1 - 0.91 * darkness);
        if (scene.fog instanceof THREE.FogExp2) {
          scene.fog.color.copy(dayFog).lerp(nightFog, darkness);
          scene.fog.density = 0.018 + 0.009 * darkness;
        }
        domeHorizon?.copy(dayFog).lerp(nightFog, darkness);
        domeTop?.copy(daySky).lerp(nightSky, darkness);
      }
      if (!isOutdoor) {
        const fluctuation = Math.sin(t * 15.3) * Math.sin(t * 8.6);
        sky.intensity = base * (1 + 0.012 * fluctuation);
      }
      if (entity) {
        const threat = stage.threat?.kind.toLowerCase() ?? '';
        if (/smil|moth|angler/.test(threat)) entity.position.y = 0.07 * Math.sin(t * 3);
        else entity.scale.y = entityHeightScale * (1 + 0.012 * Math.sin(t * 3.7));
      }
    },
    dispose() {
      scene.remove(root);
      apparition.userData.release();
      entity?.userData.release?.();
      for (const m of instances) m.dispose();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const tex of textures) tex.dispose();
      kit.dispose();
    },
  };
}
