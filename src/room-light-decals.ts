import * as THREE from 'three';

// Both gradients ride on the receiving surface. Depth testing hides them behind walls.
export function roomLightDecals(lamp: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const fade = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [radius, alpha] of [[0, 1], [.34, .83], [.58, .43], [.8, .12], [1, 0]])
    fade.addColorStop(radius, 'rgba(255,255,255,' + alpha + ')');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  const plane = new THREE.PlaneGeometry(1, 1);
  const base = { map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 };
  const shadow = new THREE.MeshBasicMaterial({ ...base, color: 0x120e0a, opacity: .56 });
  const bloom = new THREE.MeshBasicMaterial({ ...base, color: lamp, opacity: .25, blending: THREE.AdditiveBlending });
  const bounds = new THREE.Box3();
  return {
    shadow(group: THREE.Group) {
      // Measure in the prop's own space before the caller positions or rotates it.
      bounds.setFromObject(group);
      if (bounds.isEmpty() || bounds.max.y < .10 || bounds.min.y > .48) return;
      const mesh = new THREE.Mesh(plane, shadow);
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.set(Math.min(5, bounds.max.x - bounds.min.x) * 1.25 + .3,
        Math.min(5, bounds.max.z - bounds.min.z) * 1.25 + .3, 1);
      mesh.position.set((bounds.max.x + bounds.min.x) / 2, .018, (bounds.max.z + bounds.min.z) / 2);
      group.add(mesh);
    },
    glow(parent: THREE.Group, x: number, y: number, z: number, w: number, l: number) {
      const mesh = new THREE.Mesh(plane, bloom);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x, y, z);
      mesh.scale.set(w + 2.6, l + 2.8, 1);
      parent.add(mesh);
    },
    plane, shadowMaterial: shadow, glowMaterial: bloom, texture,
  };
}
