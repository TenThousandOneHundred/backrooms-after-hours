import { AnimationMixer, AnimationUtils, Group, LoopOnce, SkinnedMesh } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { bacteriaChargeSeconds } from './game-entity';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

let asset: GLTF | undefined;
export async function loadBacteria() {
  if (asset) return;
  const model = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + 'models/bacteria.glb');
  // glTF clips can share accessor buffers. Convert a private copy of the overlay.
  model.animations = model.animations.map(clip =>
    ['SoundTurn', 'BankLeft', 'BankRight'].includes(clip.name) ? AnimationUtils.makeClipAdditive(clip.clone()) : clip,
  );
  asset = model;
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
  const soundTurn = actions.get('SoundTurn')!.setLoop(LoopOnce, 1);
  const left = actions.get('BankLeft')!.setLoop(LoopOnce, 1);
  const right = actions.get('BankRight')!.setLoop(LoopOnce, 1);
  let wasHearing = false;
  let nextReaction = 0;
  let nextBank = 0;
  let state = 'Listen';
  let current = actions.get(state)!;
  let pace = 0;
  current.play();
  mixer.update(0);
  const locomotion = (name: string) => name === 'Chase' || name === 'Stalk';
  root.userData.pose = (time: number, dt: number, speed: number, winding: boolean, lunging: boolean, heardVoice = false,
    _reach = 0, _heldByGaze = false, turn = 0) => {
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
    } else current.timeScale = state === 'Strike' ? current.getClip().duration / bacteriaChargeSeconds : 1;
    if (winding || lunging) {
      for (const overlay of [soundTurn, left, right]) if (overlay.isRunning()) overlay.stop();
    } else if (heardVoice && !wasHearing && time >= nextReaction && state !== 'Recover') {
      left.stop();
      right.stop();
      soundTurn.reset().play();
      nextReaction = time + soundTurn.getClip().duration + .45;
    } else if (locomotion(state) && speed > 1 && Math.abs(turn) > .60 && !soundTurn.isRunning() && time >= nextBank) {
      const bank = turn > 0 ? left : right;
      bank.reset().play();
      nextBank = time + bank.getClip().duration;
    }
    wasHearing = heardVoice;
    mixer.update(dt);
  };
  root.userData.release = () => {
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
    model.traverse(child => { if (child instanceof SkinnedMesh) child.skeleton.dispose(); });
  };
  return root;
}
