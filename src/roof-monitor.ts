import * as THREE from 'three';
import { TILE } from './game-entity';
import { ModelKit } from './world-models';
import { hash } from './world-materials';

export const roofRise = 2.6;
export const roofHalfWidth = 3, roofHalfDepth = 2;

// A strip of high north windows lights the floor below a raised industrial roof.
export function buildRoofMonitor(kit: ModelKit, statics: THREE.Group, root: THREE.Group,
  x: number, z: number, eaves: number, tint: string) {
  const frame = new THREE.Group();
  frame.position.set(x * TILE, eaves, z * TILE);
  statics.add(frame);
  const width = (2 * roofHalfWidth + 1) * TILE, depth = (2 * roofHalfDepth + 1) * TILE;
  const steel = '#505857', zinc = '#89938e';
  const bar = (c: string, u: number, y: number, v: number, w: number, h: number, d: number, lit = true) =>
    kit.cube(frame, c, u, y, v, w, h, d, lit);
  const glassCanvas = document.createElement('canvas');
  glassCanvas.width = 128;
  glassCanvas.height = 256;
  const glass = glassCanvas.getContext('2d')!;
  const daylight = glass.createLinearGradient(0, 0, 0, 256);
  daylight.addColorStop(0, '#b5c3c1');
  daylight.addColorStop(.35, '#fffef1');
  daylight.addColorStop(.82, '#d7d8c5');
  daylight.addColorStop(1, '#8a897c');
  glass.fillStyle = daylight;
  glass.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 120; i++) {
    const streak = glass.createLinearGradient(0, 0, 0, 56 + hash(i, 7, 28) * 190);
    streak.addColorStop(0, 'rgba(67,64,48,.20)');
    streak.addColorStop(1, 'transparent');
    glass.fillStyle = streak;
    glass.fillRect(hash(i, 11, 32) * 128, 0, 1 + hash(i, 3, 52) * 3, 256);
  }
  glass.strokeStyle = 'rgba(62,70,65,.28)';
  glass.lineWidth = .8;
  glass.beginPath();
  for (let i = -256; i < 395; i += 14) {
    glass.moveTo(i, 0); glass.lineTo(i + 256, 256);
    glass.moveTo(i, 0); glass.lineTo(i - 256, 256);
  }
  glass.stroke();
  const glazing = new THREE.CanvasTexture(glassCanvas);
  glazing.colorSpace = THREE.SRGBColorSpace;
  kit.textures.push(glazing);
  const paneMaterial = new THREE.MeshBasicMaterial({ color: tint, map: glazing });
  kit.materials.set('wired-glass', paneMaterial);
  for (const side of [-1, 1]) {
    bar(zinc, side * width / 2, roofRise / 2, 0, .12, roofRise, depth);
    bar(steel, 0, .06, side * depth / 2, width, .12, .20);
    for (let rib = 0; rib < 20; rib++)
      bar(steel, side * (width / 2 - .08), roofRise / 2, -depth / 2 + (rib + .5) * depth / 20,
        .09, roofRise, .047);
    bar(steel, side * (width / 2 - .08), .22, 0, .12, .18, depth);
  }
  bar(zinc, 0, roofRise / 2, depth / 2, width, roofRise, .14);
  bar(steel, 0, roofRise / 2, -depth / 2, width, roofRise, .15);
  for (let bay = 0; bay < 7; bay++) {
    const u = -width / 2 + (bay + .5) * TILE;
    for (let pane = 0; pane < 3; pane++) {
      const glassPane = bar(bay === 5 ? '#687370' : tint, u + (pane - 1) * .98, 1.4, -depth / 2 + .1, .925, 1.86, .055, false);
      if (bay !== 5) glassPane.material = paneMaterial;
    }
    bar(zinc, u, 1.68, -depth / 2 + .16, TILE, .065, .065);
    bar(steel, u, .38, -depth / 2 + .14, TILE, .11, .25);
  }
  for (const v of [-depth / 2 + .3, 0, depth / 2 - .3]) {
    bar(steel, 0, roofRise - .18, v, width, .15, .12);
    bar(steel, 0, roofRise - .94, v, width, .12, .13);
    for (let bay = 0; bay < 14; bay++) {
      const u = -width / 2 + bay * TILE / 2;
      kit.rod(frame, zinc, [u, roofRise - (bay % 2 ? .18 : .94), v],
        [u + TILE / 2, roofRise - (bay % 2 ? .94 : .18), v], .056);
    }
  }

  // Bake the mullion shadows into one feathered floor projection.
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.transform(1, 0, .34, 1, 0, 0);
  ctx.filter = 'blur(3px)';
  const wash = ctx.createLinearGradient(0, 22, 0, 242);
  wash.addColorStop(0, 'transparent');
  wash.addColorStop(.17, 'rgba(255,255,255,.7)');
  wash.addColorStop(.66, 'rgba(255,255,255,.38)');
  wash.addColorStop(1, 'transparent');
  ctx.fillStyle = wash;
  for (let col = 0; col < 21; col++) {
    ctx.globalAlpha = Math.floor(col / 3) === 5 ? .21 : .84;
    ctx.fillRect(5 + col * 32, 22, 28, 62);
    ctx.fillRect(5 + col * 32, 92, 28, 150);
  }
  const tex = new THREE.CanvasTexture(canvas);
  const lightMap = new THREE.MeshBasicMaterial({ color: tint, map: tex, opacity: .44,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width - .2, depth * .74), lightMap);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(frame.position.x, .044, frame.position.z - depth * .09);
  root.add(floor);
  const spill = new THREE.PointLight(tint, 24, 12, 2);
  spill.position.set(frame.position.x, eaves + .8, frame.position.z - depth * .36);
  root.add(spill);

  const positions = new Float32Array(180 * 3);
  for (let i = 0; i < positions.length / 3; i++) {
    positions[3*i] = (hash(i, 0, 190) - .5) * (width - 1);
    positions[3*i+1] = .25 + hash(i, 1, 190) * (eaves + 1);
    positions[3*i+2] = (hash(i, 2, 190) - .5) * 5 - positions[3*i+1] * .8;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dustMat = new THREE.PointsMaterial({ color: tint, size: .024, opacity: .32,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const dust = new THREE.Points(dustGeo, dustMat);
  root.add(dust);
  return {
    update(t: number) {
      dust.position.set(frame.position.x + .18 * Math.sin(t * .23), .12 * Math.sin(t * .31),
        frame.position.z + .17 * Math.cos(t * .19));
    },
    dispose() {
      tex.dispose();
      lightMap.dispose();
      floor.geometry.dispose();
      dustMat.dispose();
      dustGeo.dispose();
      spill.dispose();
    },
  };
}
