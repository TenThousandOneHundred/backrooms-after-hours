import { Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ResidentBehavior, type ResidentSite } from './resident-behavior';

let models: Group;
export async function loadResidents() {
  models = (await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + 'models/residents.glb')).scene;
}

export function makeResident(site: ResidentSite, tile: number, height: number) {
  const veil = site.kind === 'veil';
  const mesh = models.getObjectByName(veil ? 'Veil' : 'Bellwether')!.clone(true);
  mesh.position.set(site.x * tile, veil ? 1.85 : height - 0.04, site.z * tile);
  const body = mesh.getObjectByName(veil ? 'VeilFaces' : 'BellThroat')!;
  const fringe = mesh.getObjectByName(veil ? 'VeilHem' : 'BellFan')!;
  const faces = veil ? [0, 1, 2].map(i => mesh.getObjectByName('Face' + i)!) : [];
  const behavior = new ResidentBehavior(site.kind);
  function animate(t: number, yaw: number) {
    if (veil) {
      mesh.rotation.y = yaw;
      body.position.y = fringe.position.y = Math.sin(t * 1.3) * .065;
      body.rotation.z = .12 * Math.sin(t * 1.7) + behavior.exposure * .13;
      body.position.z = behavior.exposure * .15;
      faces.forEach((face, i) => {
        face.rotation.x = .07 * Math.sin(t * 1.65 + i * 2.1) - .12 * behavior.exposure;
        face.position.y = (i ? -.02 : .13) + .035 * Math.sin(t * 1.8 + i * 2);
      });
      fringe.rotation.y = .16 * Math.sin(t * 1.5);
      fringe.scale.y = 1 + behavior.exposure * .18;
    } else {
      const open = behavior.phase === 'listening' ? 1 : behavior.phase === 'warning' ? .5 : 0;
      const spread = 0.75 + open * .55 + .04 * Math.sin(t * (open ? 12 : 2));
      fringe.scale.set(spread, 1 - .12 * open, spread);
      body.rotation.z = Math.sin(t * (open ? 9 : 1.7)) * (.04 + open * .18);
    }
  }
  return { site, mesh, behavior, animate };
}
