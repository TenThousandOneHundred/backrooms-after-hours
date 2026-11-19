import { AnimationMixer, Group, type AnimationClip, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeBacteria } from './bacteria';
import { creatureLibraries } from './creature-roster';

const templates = new Map<string, { model: Object3D; clip: AnimationClip }>();
export async function loadLevelCreatures() {
  await Promise.all(Object.entries(creatureLibraries).map(async ([file, entries]) => {
    if (Object.keys(entries).every(kind => templates.has(kind))) return;
    const asset = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + 'models/' + file + '.glb');
    for (const [kind, name] of Object.entries(entries)) {
      const model = asset.scene.getObjectByName(name);
      const clip = asset.animations.find(a => a.name === name + 'Motion');
      if (!model || !clip) throw new Error('Missing model or action for ' + name + ' in ' + file);
      templates.set(kind, { model, clip });
    }
  }));
}

export function makeLevelCreature(kind: string) {
  if (kind === 'bacteria') return makeBacteria();
  const template = templates.get(kind);
  if (!template) throw new Error('Missing creature model for ' + kind);
  const root = new Group();
  const model = template.model.clone(true);
  model.position.set(0, 0, 0);
  root.add(model);
  root.userData.focus = model.getObjectByName(model.name + '_Focus');
  const mixer = new AnimationMixer(model);
  const clip = template.clip;
  const action = mixer.clipAction(clip).play();
  const freezes = ['animation', 'watcher', 'kitty'].includes(kind);
  if (kind === 'bonethief') action.paused = true;
  mixer.update(0);
  root.userData.pose = (_time: number, dt: number, speed: number, _wind: boolean, _strike: boolean, _voice: boolean, reach = 0) => {
    if (kind === 'bonethief') action.time = reach * (clip.duration - 0.001);
    else if (kind === 'moth') action.timeScale = 2.6 + Math.min(1.3, speed * .3);
    else if (freezes && speed < .03) action.timeScale = 0;
    else action.timeScale = Math.min(2.8, 0.15 + speed * 0.56);
    mixer.update(dt);
  };
  root.userData.release = () => {
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
  };
  return root;
}
