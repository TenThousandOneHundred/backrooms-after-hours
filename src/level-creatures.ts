import { AnimationMixer, Group } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

const modelNames: Record<string, string> = {
  neighborhoodwatch: 'NeighborhoodWatch',
  farmer: 'FarmerFaceling',
  membri: 'AraneaMembri',
  scratcher: 'Scratcher',
  bonethief: 'BoneThief',
  partyhost: 'PartyHost',
};
let asset: GLTF;
export async function loadLevelCreatures() {
  asset ??= await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + 'models/level-creatures.glb');
}

export function makeLevelCreature(kind: string) {
  const name = modelNames[kind];
  if (!name) return;
  const root = new Group();
  const model = asset.scene.getObjectByName(name)!.clone(true);
  model.position.set(0, 0, 0);
  root.add(model);
  const mixer = new AnimationMixer(model);
  const clip = asset.animations.find(clip => clip.name === name + 'Motion')!;
  const action = mixer.clipAction(clip).play();
  if (kind === 'bonethief') action.paused = true;
  mixer.update(0);
  root.userData.pose = (_time: number, dt: number, speed: number, _wind: boolean, _strike: boolean, _voice: boolean, reach = 0) => {
    if (kind === 'bonethief') action.time = reach * (clip.duration - 0.001);
    else action.timeScale = Math.min(2.8, 0.15 + speed * 0.56);
    mixer.update(dt);
  };
  root.userData.release = () => {
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
  };
  return root;
}
