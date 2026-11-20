import { detailCreature } from './creature-surfaces';
import { AnimationMixer, AnimationUtils, Group, MathUtils, SkinnedMesh, type AnimationClip, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createContactPose } from './contact-animation';
import { makeBacteria } from './bacteria';
import { creatureLibraries } from './creature-roster';

type Motion =
  | { type: 'gait'; idle: AnimationClip; stalk: AnimationClip; chase: AnimationClip; contact: AnimationClip }
  | { type: 'reach' | 'scan'; clip: AnimationClip };
const templates = new Map<string, { model: Object3D; motion: Motion }>();

export async function loadLevelCreatures() {
  await Promise.all(Object.entries(creatureLibraries).map(async ([file, entries]) => {
    if (Object.keys(entries).every(kind => templates.has(kind))) return;
    const asset = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + 'models/' + file + '.glb');
    detailCreature(asset.scene);
    for (const [kind, name] of Object.entries(entries)) {
      const model = asset.scene.getObjectByName(name);
      if (!model) throw new Error('Missing model for ' + name + ' in ' + file);
      const action = (suffix: string) => {
        const clip = asset.animations.find(a => a.name === name + suffix);
        if (!clip) throw new Error('Missing ' + name + suffix + ' in ' + file);
        return clip;
      };
      let motion: Motion;
      if (kind === 'bonethief') motion = { type: 'reach', clip: action('Reach') };
      else if (kind === 'camera') motion = { type: 'scan', clip: action('Scan') };
      else {
        if (!(model.userData.walkStride > 0 && model.userData.chaseStride > 0))
          throw new Error('Missing stride lengths for ' + name);
        motion = {
          type: 'gait',
          idle: action('Idle'),
          stalk: action('Stalk'),
          chase: action('Chase'),
          contact: AnimationUtils.makeClipAdditive(action('Contact').clone()),
        };
      }
      templates.set(kind, { model, motion });
    }
  }));
}

export function makeLevelCreature(kind: string) {
  if (kind === 'bacteria') return makeBacteria();
  const template = templates.get(kind);
  if (!template) throw new Error('Missing creature model for ' + kind);
  const root = new Group();
  const model = clone(template.model);
  model.position.set(0, 0, 0);
  root.add(model);
  root.userData.focus = model.getObjectByName(model.name + '_Focus');
  const mixer = new AnimationMixer(model);
  const motion = template.motion;
  if (motion.type === 'gait') {
    root.userData.setContactPose = createContactPose(mixer, motion.contact);
    const idle = mixer.clipAction(motion.idle).play();
    const walk = mixer.clipAction(motion.stalk).setEffectiveWeight(0).play();
    const run = mixer.clipAction(motion.chase).setEffectiveWeight(0).play();
    const wingBeat = kind === 'moth';
    walk.paused = run.paused = true;
    idle.paused = wingBeat;
    let phase = 0, pace = 0;
    root.userData.pose = (_time: number, dt: number, speed: number, _wind: boolean, _strike: boolean,
      _voice: boolean, _reach: number, frozen = false) => {
      if (frozen) return;
      pace = MathUtils.damp(pace, speed, 12, dt);
      const moving = MathUtils.smoothstep(pace, 0.035, 0.62);
      const chasing = MathUtils.smoothstep(pace, 1.6, 2.9);
      idle.setEffectiveWeight(1 - moving);
      walk.setEffectiveWeight(moving * (1 - chasing));
      run.setEffectiveWeight(moving * chasing);
      // Keep all gaits on the same contact foot while blending. Distances are baked into the Blender rigs.
      const stride = MathUtils.lerp(model.userData.walkStride, model.userData.chaseStride, chasing);
      const travel = wingBeat
        ? dt * ((1 - moving) / motion.idle.duration + moving * (1 - chasing) / motion.stalk.duration + moving * chasing / motion.chase.duration)
        : speed * dt / stride;
      phase = (phase + travel) % 1;
      walk.time = phase * motion.stalk.duration;
      run.time = phase * motion.chase.duration;
      if (wingBeat) idle.time = phase * motion.idle.duration;
      mixer.update(dt);
    };
  } else {
    const action = mixer.clipAction(motion.clip).play();
    action.paused = motion.type === 'reach';
    root.userData.pose = (_time: number, dt: number, _speed: number, _wind: boolean, _strike: boolean,
      _voice: boolean, reach = 0) => {
      if (action.paused) action.time = MathUtils.clamp(reach, 0, 1) * motion.clip.duration;
      mixer.update(dt);
    };
  }
  mixer.update(0);
  model.updateMatrixWorld(true);
  root.userData.release = () => {
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
    model.traverse(child => { if (child instanceof SkinnedMesh) child.skeleton.dispose(); });
  };
  return root;
}
