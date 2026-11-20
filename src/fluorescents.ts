import { isLevelZero } from './level-zero-rooms';
import * as T from 'three';
import { hash } from './world-materials';
import { clearSight, TILE } from './game-entity';
import type { Stage } from './campaign';

const banks = 8;
export function fixtureBank(x: number, z: number) {
  const seed = hash(Math.round(x / TILE), Math.round(z / TILE), 317);
  return seed < .47 ? 0 : 1 + Math.floor((seed - .47) / .53 * (banks - 1));
}

// Stage time also advances on the host for late-joining explorers.
export function ballastOutput(bank: number, time: number, reduced: boolean) {
  if (!bank) return 1;
  const failure = bank === 2 ? 29 : bank === 6 ? 68 : Infinity;
  if (time >= failure) return 0;
  const age = (time + bank * 3.71) % (10 + bank * 1.79);
  const remaining = failure - time;
  if (reduced) return Math.min(1, remaining / 1.4);
  if (remaining < 1.6) return remaining * .44 + .07;
  if (age < .22) return .07;
  if (age < .56) return .54;
  if (age < 1.02) return .12;
  return Math.min(1, .12 + (age - 1.02) * 2.4);
}

type Fixture = { x: number; y: number; z: number; height: number; bank: number };
export function fluorescentRig(root: T.Group, stage: Stage, tint: string) {
  const fixtures: Fixture[] = [];
  const states = Array.from({ length: banks }, () => ({
    output: 1, materials: new Map<T.Material, { mat: T.MeshBasicMaterial; color: T.Color }>(),
  }));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const spots = Array.from({length: 2}, () => {
    const light = new T.SpotLight(tint, 0, 18, .99, .23, 2);
    light.name = 'Fluorescent downlight';
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    light.shadow.radius = 1;
    light.shadow.camera.near = .12;
    light.shadow.normalBias = .012;
    light.shadow.bias = -.0003;
    light.shadow.autoUpdate = false;
    root.add(light, light.target);
    return light;
  });
  let nearby: Fixture[] = [], lastSearch = -10, lastShadow = -10, lastTime = -1;
  const lastEye = new T.Vector3(Infinity, 0, 0);
  return {
    spots,
    materials: () => states.flatMap(s=>Array.from(s.materials.values(), v=>v.mat)),
    add(x: number, y: number, z: number, height: number) {
      const bank = fixtureBank(x, z);
      fixtures.push({x, y, z, height, bank});
      return bank;
    },
    bulb(mesh: T.Mesh, bank: number) {
      const base = mesh.material;
      if (!bank || !(base instanceof T.MeshBasicMaterial)) return;
      const palette = states[bank].materials;
      let variant = palette.get(base);
      if (!variant) {
        variant = {mat: base.clone(), color: base.color.clone()};
        palette.set(base, variant);
      }
      mesh.material = variant.mat;
    },
    update(time: number, camera: T.Camera, buzz: (pan: number, volume: number) => void) {
      const eye = camera.position;
      // Shadows and candidate selection run at a lower rate than the lamp animation.
      const moved = lastEye.distanceToSquared(eye) > 2.25;
      const select = moved || time < lastSearch || time - lastSearch >= .22;
      if (select) {
        lastEye.copy(eye);
        lastSearch = time;
        nearby = fixtures.filter(f => Math.abs(f.x-eye.x) < 26 && Math.abs(f.z-eye.z) < 26 &&
          clearSight(stage, eye.x/TILE, eye.z/TILE, f.x/TILE, f.z/TILE));
        nearby.sort((a,b) => (a.x-eye.x)**2 + (a.z-eye.z)**2 - (b.x-eye.x)**2 - (b.z-eye.z)**2);
      }
      for (let i=1; i<banks; i++) {
        const state = states[i], output = ballastOutput(i, time, reduced);
        if (output === state.output) continue;
        if (state.output > .6 && output < .25 && time >= lastTime && time-lastTime < .6) {
          const f = nearby.find(f => f.bank === i);
          if (f) {
            const dx = f.x-eye.x, dz = f.z-eye.z, dist = Math.hypot(dx, f.y-eye.y, dz);
            if (dist < 19) buzz((dx*camera.matrixWorld.elements[0]+dz*camera.matrixWorld.elements[2])/Math.max(1,dist),
              (1-dist/19)**1.5);
          }
        }
        state.output = output;
        for (const {mat, color} of state.materials.values())
          mat.color.copy(color).multiplyScalar(.012 + .988 * output);
      }
      const shadow = moved || time < lastShadow || time-lastShadow >= .09;
      if (shadow) lastShadow = time;
      const chosen = nearby.filter(f => states[f.bank].output > 0);
      for (const [i, light] of spots.entries()) {
        const f = chosen[i];
        if (!f) { light.intensity = 0; continue; }
        const switched = light.position.x !== f.x || light.position.z !== f.z;
        light.position.set(f.x, f.y, f.z);
        light.target.position.set(f.x, f.y-f.height, f.z);
        light.distance = Math.max(9, f.height*2.2);
        light.intensity = ((isLevelZero(stage.id) ? 0.95 : 2.6) * f.height*f.height) * states[f.bank].output;
        if (shadow || switched) light.shadow.needsUpdate = true;
      }
      lastTime = time;
    },
    dispose() {
      for (const light of spots) light.dispose();
      for (const state of states) for (const {mat} of state.materials.values()) mat.dispose();
    },
  };
}
