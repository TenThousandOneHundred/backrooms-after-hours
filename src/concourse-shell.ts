import { surfaceMaterial, markWet } from './wet-finish';
import * as T from 'three';
import type { Stage } from './campaign-format';
import { TILE } from './game-entity';
import {
  atriumWell,
  basementBed,
  concourseFloor,
  concourseRoof,
  officeTile,
  waterline,
} from './concourse-plan';
import { texture, type Finish } from './world-materials';
import type { roomSurfaceScans } from './scanned-surfaces';
import type { ModelKit } from './world-models';

type Point = [number, number, number];
type Faces = { position: number[]; uv: number[]; shade: number[]; indices: number[] };
const faces = (): Faces => ({ position: [], uv: [], shade: [], indices: [] });

// Slabs and wall panels share a few meshes. Dimensions in the plan are tile
// centres; structure is built in world metres so ramps meet their landings.
export function buildConcourseShell(
  stage: Stage,
  kit: ModelKit,
  root: T.Group,
  statics: T.Group,
  scans: ReturnType<typeof roomSurfaceScans>,
  lightStrip: (mesh: T.Mesh) => void,
) {
  const slab = faces(),
    wall = faces(),
    roof = faces(),
    deck = faces(),
    water = faces();
  const ground = (x: number, z: number) => concourseFloor(x / TILE, z / TILE);
  const box = (c: string, x: number, y: number, z: number, w: number, h: number, d: number, lit = true) =>
    kit.cube(statics, c, x, y, z, w, h, d, lit);
  function face(surface: Faces, corners: Point[], levels: number[], axis: 'xz' | 'xy' | 'zy') {
    const i = surface.position.length / 3;
    for (const [j, [x, y, z]] of corners.entries()) {
      surface.position.push(x, y, z);
      surface.uv.push((axis === 'zy' ? z : x) / TILE, (axis === 'xz' ? z : y) / TILE);
      const v = levels[j];
      surface.shade.push(v, v, v);
    }
    surface.indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  const steel = '#52615e',
    edge = '#a29a76';
  const pier = '#707570',
    beam = '#82847b';
  const sides = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const;
  function shell(x: number, z: number, well: boolean) {
    const x0 = (x - 0.5) * TILE,
      z0 = (z - 0.5) * TILE,
      x1 = x0 + TILE,
      z1 = z0 + TILE;
    const corners = [
      [x0, z0],
      [x0, z1],
      [x1, z1],
      [x1, z0],
    ];
    const bridge = x >= 36 && x <= 59 && z >= 4 && z <= 20 && !well;
    const south = z >= 24;
    const top = (u: number, v: number) => (south ? ground(u, v) + 4.5 : concourseRoof(x, z));
    const floorPoints: Point[] = corners.map(([u, v]) => [u, well ? basementBed : ground(u, v), v]);
    const roofPoints: Point[] = corners.map(([u, v]) => [u, top(u, v), v]);
    // Broad shadows beneath each transverse roof beam give scale to the long perspective.
    const shades = corners.map(([, v]) => (south ? 0.42 : 0.62) + 0.17 * Math.cos((v * Math.PI) / (3 * TILE)));
    face(bridge ? deck : slab, floorPoints, well ? [0.23, 0.23, 0.23, 0.23] : shades, 'xz');
    face(roof, roofPoints.reverse(), [0.67, 0.67, 0.67, 0.67], 'xz');
    if (south && ground(x * TILE, z1) < waterline) {
      const shore = (23.5 + (8 * waterline) / basementBed) * TILE;
      const near = Math.max(z0, shore);
      face(
        water,
        [
          [x0, waterline, near],
          [x0, waterline, z1],
          [x1, waterline, z1],
          [x1, waterline, near],
        ],
        [0.83, 0.83, 0.83, 0.83],
        'xz',
      );
    }
    if (bridge) {
      face(
        slab,
        corners.map(([u, v]) => [u, basementBed, v]),
        [0.22, 0.22, 0.22, 0.22],
        'xz',
      );
      const underside = [...floorPoints].reverse().map(([u, y, v]): Point => [u, y - 0.48, v]);
      face(deck, underside, [0.39, 0.39, 0.39, 0.39], 'xz');
      if (z === 8 || z === 16) {
        // Transverse stiffeners describe the span from the lower gallery.
        box(steel, x * TILE, ground(x * TILE, z * TILE) - 0.58, z * TILE, 0.17, 0.34, TILE + 0.1);
      }
    }
    if (well) return;
    for (const [dx, dz] of sides) {
      const nx = x + dx,
        nz = z + dz,
        overWell = atriumWell(nx, nz);
      const solid = stage.map[nz]?.[nx] === '#' && !overWell;
      // Endpoints run clockwise looking into the room.
      const mx = (x + dx * 0.5) * TILE,
        mz = (z + dz * 0.5) * TILE;
      const ax = mx + dz * TILE * 0.5,
        az = mz - dx * TILE * 0.5,
        bx = mx - dz * TILE * 0.5,
        bz = mz + dx * TILE * 0.5;
      const ay = ground(ax, az),
        by = ground(bx, bz),
        axis = dx ? 'zy' : 'xy';
      if (overWell) {
        face(
          wall,
          [
            [ax, ay, az],
            [bx, by, bz],
            [bx, by - 0.48, bz],
            [ax, ay - 0.48, az],
          ],
          [0.8, 0.8, 0.34, 0.34],
          axis,
        );
        if (!bridge)
          face(
            wall,
            [
              [ax, ay - 0.48, az],
              [bx, by - 0.48, bz],
              [bx, basementBed, bz],
              [ax, basementBed, az],
            ],
            [0.52, 0.52, 0.21, 0.21],
            axis,
          );
        // Two continuous rails follow the slope; collisions stop at the same slab edge.
        for (const h of [0.53, 1.02])
          kit.rod(statics, h > 1 ? edge : steel, [ax, ay + h, az], [bx, by + h, bz], 0.043);
        box(steel, mx, (ay + by) / 2 + 0.49, mz, 0.07, 0.98, 0.07);
        continue;
      }
      if (solid && z >= 33) {
        // A tide mark makes the depth visible against the columns and side walls.
        box(
          '#516960',
          mx - dx * 0.015,
          waterline + 0.045,
          mz - dz * 0.015,
          dx ? 0.035 : TILE,
          0.09,
          dz ? 0.035 : TILE,
        );
      }
      const lowA = solid ? ay : nz >= 24 ? ground(ax, az) + 4.5 : concourseRoof(nx, nz);
      const lowB = solid ? by : nz >= 24 ? ground(bx, bz) + 4.5 : concourseRoof(nx, nz);
      if (lowA >= top(ax, az) - 0.001 && lowB >= top(bx, bz) - 0.001) continue;
      face(
        wall,
        [
          [ax, lowA, az],
          [bx, lowB, bz],
          [bx, top(bx, bz), bz],
          [ax, top(ax, az), az],
        ],
        solid ? [0.4, 0.4, 0.93, 0.93] : [0.74, 0.74, 0.91, 0.91],
        axis,
      );
    }
  }
  for (let z = 1; z < stage.map.length - 1; z++)
    for (let x = 1; x < stage.map[z].length - 1; x++) {
      const well = atriumWell(x, z);
      if (!officeTile(x, z) && (well || stage.map[z][x] !== '#')) shell(x, z, well);
    }

  // Longitudinal column lines carry deep transverse concrete lintels.
  for (const z of [4, 10, 16, 22]) {
    box(beam, 16 * TILE, 13.35, z * TILE, 31 * TILE, 2.1, 1.48);
    for (const x of [6, 25]) {
      box(pier, x * TILE, 12.33, z * TILE, 5.5, 0.85, 4.95);
      box('#aaa99c', x * TILE, 11.81, z * TILE, 4.18, 0.3, 3.95);
    }
    for (const x of [6, 25]) {
      for (const side of [-1, 1]) {
        const haunch = box(beam, x * TILE + side * 2.7, 12.6, z * TILE, 3.9, 1.05, 1.44);
        haunch.rotation.z = side * 0.32;
      }
    }
    for (const x of [10, 18]) lightStrip(box('#d9d9c6', x * TILE, 12.26, z * TILE, 9, 0.068, 0.16, false));
  }
  for (const x of [5, 17, 27]) box(beam, x * TILE, 14, 12 * TILE, 0.64, 0.8, 23 * TILE);
  // Repeated high light slots make the hall's side walls legible from the entry.
  for (let x = 2; x < 31; x += 3) {
    box('#505a59', x * TILE, 9.9, 0.5 * TILE + 0.03, 7.8, 2.55, 0.13);
    box('#becbc6', x * TILE, 10.0, 0.5 * TILE + 0.13, 7.12, 1.78, 0.06, false);
    box(steel, x * TILE, 10, 0.5 * TILE + 0.18, 0.11, 1.85, 0.06);
  }

  // Formwork reveals run unbroken along the nave, then stop at its doorways.
  for (const z of [0.5, 23.5]) {
    const v = z * TILE + (z < 1 ? 0.022 : -0.022);
    for (const y of [3.6, 7.2, 10.8]) box('#747a74', 16 * TILE, y, v, 31 * TILE, 0.055, 0.07);
  }
  const span = 30 * TILE;
  for (const z of [3, 9, 15, 21]) {
    const mid = 47.5 * TILE,
      v = z * TILE;
    for (const y of [17.4, 20]) box(steel, mid, y, v, span, 0.31, 0.43);
    for (let i = 0; i < 24; i++) {
      const u = mid - span / 2 + (i * span) / 24;
      kit.rod(statics, steel, [u, i % 2 ? 20 : 17.4, v], [u + span / 24, i % 2 ? 17.4 : 20, v], 0.115);
    }
    for (const x of [38, 48, 57]) lightStrip(box('#cfdbd1', x * TILE, 17.18, v, 4.8, 0.07, 0.22, false));
  }
  for (const x of [36, 47, 59]) box(steel, x * TILE, 20.58, 12 * TILE, 0.42, 0.72, 23 * TILE);
  for (const z of [8, 16]) {
    for (const x of [42, 53]) {
      const y = concourseFloor(x, z);
      box(steel, x * TILE, (y + basementBed) / 2, z * TILE, 0.6, y - basementBed, 0.72);
      box(beam, x * TILE, y - 0.52, z * TILE, 1.2, 0.45, TILE);
    }
  }
  for (const z of [36, 42]) {
    box('#616c67', 45.5 * TILE, -0.68, z * TILE, 86 * TILE, 0.75, 1.0);
    for (let x = 6; x < 88; x += 9) lightStrip(box('#b7c9c3', x * TILE, -1.09, z * TILE, 3.7, 0.06, 0.19, false));
  }

  const time = { value: 0 };
  function mesh(surface: Faces, name: string, finish: Finish, tint: string) {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(surface.position, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(surface.uv, 2));
    geo.setAttribute('color', new T.Float32BufferAttribute(surface.shade, 3));
    geo.setIndex(surface.indices);
    geo.computeVertexNormals();
    const map = texture(finish, tint);
    const wet = finish === 'water';
    const mat = surfaceMaterial(finish, {
      map,
      vertexColors: true,
      side: T.DoubleSide,
      transparent: wet,
      opacity: wet ? 0.66 : 1,
      depthWrite: !wet,
    });
    if (!wet) scans.apply(mat, finish, surface === slab, tint);
    if (wet) {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uBasinTime = time;
        shader.vertexShader =
          'varying vec3 vBasin;\n' +
          shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBasin=position;');
        shader.fragmentShader =
          'varying vec3 vBasin; uniform float uBasinTime;\n' +
          shader.fragmentShader.replace(
            '#include <opaque_fragment>',
            `
            vec2 p = vBasin.xz;
            vec2 ripple = vec2(sin(p.y*3.2+p.x*.7+uBasinTime*.7), cos(p.x*2.1-p.y*.8+uBasinTime*.51));
            vec3 basinRay = reflect(normalize(vBasin-cameraPosition), normalize(vec3(.032*ripple.x,1.,.048*ripple.y)));
            vec2 ceiling = p + basinRay.xz * 3.2/max(.04,basinRay.y);
            float row = abs(mod(ceiling.y-36.*3.2+9.6,19.2)-9.6);
            float bay = abs(mod(ceiling.x-6.*3.2+14.4,28.8)-14.4);
            float strip = (1.-smoothstep(.08,.38,row))*(1.-smoothstep(1.6,2.2,bay));
            float fresnel = pow(1.-max(basinRay.y,0.),2.);
            outgoingLight += vec3(.69,.83,.78)*strip*(.28+.62*fresnel);
            outgoingLight += vec3(.035,.060,.058)*fresnel;
            #include <opaque_fragment>`,
          );
      };
    }
    if (wet || surface === slab) markWet(mat, !wet);
    const part = new T.Mesh(geo, mat);
    part.name = name;
    part.castShadow = !wet;
    part.receiveShadow = true;
    root.add(part);
    kit.geometries.push(geo);
    kit.textures.push(map);
    kit.materials.set(name, mat);
  }
  mesh(slab, 'Concourse slabs', 'concrete', '#8d9189');
  mesh(wall, 'Concourse walls', 'concrete', '#9da39a');
  mesh(roof, 'Concourse soffits', 'concrete', '#7d837b');
  mesh(deck, 'Catwalk plates', 'metal', '#8d9891');
  mesh(water, 'Basement waterline', 'water', '#526d68');
  return (seconds: number) => {
    time.value = seconds;
  };
}
