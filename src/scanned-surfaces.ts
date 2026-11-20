import * as THREE from 'three';
import type { Finish } from './world-materials';

// The color scans are stored relative to middle gray so campaign and mod palettes
// still come through. Normals use OpenGL orientation, including on mirrored walls.
const finishes: Partial<Record<Finish, [string, number, number]>> = {
  paper: ['paper', 1, .55], hotel: ['paper', 1, .52], carpet: ['carpet', 1.8, .62],
  ceiling: ['ceiling', 1.6, .65], tile: ['tile', .60, .65], hospital: ['tile', .56, .50],
  concrete: ['concrete', 1, .8], wood: ['wood', .95, .75], plaster: ['plaster', 1.2, .68],
  brick: ['brick', 1.1, .88], metal: ['metal', 1.05, .55], road: ['road', 1.2, .64],
  earth: ['earth', 1.7, .9], rock: ['rock', 1, .95], grass: ['grass', .9, .82],
};

export function roomSurfaceScans() {
  const sheets = new Map<string, Promise<THREE.Texture[] | undefined>>();
  const textures: THREE.Texture[] = [];
  const loader = new THREE.ImageLoader();
  let active = true;

  function load(key: string, repeat: number) {
    const id = key + '/' + repeat;
    let pair = sheets.get(id);
    if (!pair) {
      pair = Promise.all(['', '-n'].map(suffix =>
        loader.loadAsync(import.meta.env.BASE_URL + 'surfaces/' + key + suffix + '.webp'),
      )).then(images => {
        if (!active) return;
        return images.map(image => {
          const texture = new THREE.Texture(image);
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.setScalar(repeat);
          texture.anisotropy = 4;
          texture.needsUpdate = true;
          textures.push(texture);
          return texture;
        });
      }).catch(() => undefined); // The generated base material remains playable offline.
      sheets.set(id, pair);
    }
    return pair;
  }

  return {
    apply(mat: THREE.MeshPhongMaterial, finish: Finish, floor: boolean, tint: string) {
      const spec = finishes[finish];
      if (!spec) return;
      const [source, repeat, relief] = spec;
      const scanned = { value: null as THREE.Texture | null };
      const wallpaper = finish === 'paper' || finish === 'hotel';
      mat.customProgramCacheKey = () => wallpaper ? 'aged-paper' : 'room-scan';
      mat.onBeforeCompile = shader => {
        shader.uniforms.uRoomScan = scanned;
        shader.vertexShader = 'varying vec3 vScanPos;\n' + shader.vertexShader.replace(
          '#include <begin_vertex>', '#include <begin_vertex>\nvScanPos = position;',
        );
        shader.fragmentShader = 'varying vec3 vScanPos; uniform sampler2D uRoomScan;\n' + shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          #ifdef USE_NORMALMAP
            vec3 wear = texture2D(uRoomScan, vNormalMapUv).rgb;
            float strength = ${wallpaper ? `clamp(.29 + .51 * exp(-max(0.,vScanPos.y) * .95)
              + .31 * smoothstep(-.15,.9,sin(dot(vScanPos.xz,vec2(.64,.45))) + .4*cos(vScanPos.z*1.16)), 0., 1.)` : '1.'};
            diffuseColor.rgb *= mix(vec3(1.), max(vec3(.12), wear * 2.), strength);
          #endif`,
        );
      };
      void load(finish === 'concrete' && floor ? 'slab' : source, repeat).then(pair => {
        if (!active || !pair) return;
        scanned.value = pair[0];
        // A photographed joint already has its own grout and relief. Remove the
        // generated grid once the scan is ready so two tile scales never overlap.
        if (!wallpaper && finish !== 'carpet' && finish !== 'ceiling') {
          mat.map = null;
          mat.color.set(tint);
        }
        mat.bumpMap = null;
        mat.normalMap = pair[1];
        mat.normalScale.setScalar(relief);
        mat.needsUpdate = true;
      });
    },
    dispose() {
      active = false;
      textures.forEach(texture => texture.dispose());
      sheets.clear();
    },
  };
}
