import { AnimationMixer, Group, LoopOnce, SkinnedMesh } from 'three';
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
  for (const name of ['Windup', 'Strike', 'Recover']) {
    const action = actions.get(name)!;
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
  }
  let state = 'Listen';
  let current = actions.get(state)!;
  let pace = 0;
  current.play();
  mixer.update(0);
  const locomotion = (name: string) => name === 'Chase' || name === 'Stalk';
  root.userData.pose = (_time: number, dt: number, speed: number, winding: boolean, lunging: boolean) => {
    pace += (speed - pace) * (1 - Math.exp(-dt * 14));
    let nextState: string;
    if (lunging) nextState = 'Strike';
    else if (winding) nextState = 'Windup';
    else if (state === 'Strike' || (state === 'Recover' && current.time < current.getClip().duration - 0.001))
      nextState = 'Recover';
    else if (pace < 0.11) nextState = 'Listen';
    else if (pace > (state === 'Chase' ? 1.9 : 2.3)) nextState = 'Chase';
    else nextState = 'Stalk';

    if (nextState !== state) {
      const next = actions.get(nextState)!;
      const phase = current.time / current.getClip().duration;
      const blend = nextState === 'Strike' ? 0.06 : 0.14;
      current.fadeOut(blend);
      next.reset().fadeIn(blend).play();
      if (locomotion(state) && locomotion(nextState))
        next.time = (phase % 1) * next.getClip().duration;
      current = next;
      state = nextState;
    }
    // Cycle distance matches the planted-foot travel baked into each Blender gait.
    if (locomotion(state)) {
      const stride = state === 'Chase' ? 2.24 : 1.26;
      current.timeScale = speed * current.getClip().duration / stride;
    } else current.timeScale = 1;
    mixer.update(dt);
  };
  root.userData.release = () => {
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
    model.traverse(child => { if (child instanceof SkinnedMesh) child.skeleton.dispose(); });
  };
  return root;
}
