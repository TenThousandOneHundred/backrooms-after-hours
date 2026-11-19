import { AnimationMixer, Group, SkinnedMesh } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

let asset: GLTF | undefined;
export async function loadBacteria() {
  asset ??= await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + 'models/bacteria.glb');
}

export function makeBacteria() {
  if (!asset) throw new Error('The Bacteria model has not finished loading.');
  const root = new Group();
  const model = clone(asset.scene);
  root.add(model);
  const mixer = new AnimationMixer(model);
  const actions = new Map(asset.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
  let current = actions.get('Listen')!;
  current.play();
  mixer.update(0);
  root.userData.pose = (_time: number, dt: number, speed: number, winding: boolean, lunging: boolean) => {
    const name = lunging ? 'Strike' : winding ? 'Windup' : speed > 0.12 ? 'Stalk' : 'Listen';
    const next = actions.get(name)!;
    if (next !== current) {
      current.fadeOut(0.12);
      next.reset().fadeIn(0.12).play();
      current = next;
    }
    current.timeScale = name === 'Stalk' ? Math.max(0.45, Math.min(2.2, speed / 2.1)) : 1;
    mixer.update(dt);
  };
  root.userData.release = () => {
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
    model.traverse(child => { if (child instanceof SkinnedMesh) child.skeleton.dispose(); });
  };
  return root;
}
