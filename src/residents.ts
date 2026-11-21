import { shareActorPalettes } from './actor-rig';
import { detailCreature } from './creature-surfaces';
import { AnimationMixer, LoopOnce } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { ResidentBehavior, type ResidentSite } from './resident-behavior';

let asset: GLTF;
export async function loadResidents() {
  asset ??= await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + 'models/residents.glb');
  detailCreature(asset.scene);
}

export function makeResident(site: ResidentSite, tile: number, height: number) {
  const veil = site.kind === 'veil';
  const mesh = clone(asset.scene.getObjectByName(veil ? 'Veil' : 'Bellwether')!);
  const palettes = shareActorPalettes(mesh);
  mesh.position.set(site.x * tile, veil ? 1.85 : height - 0.04, site.z * tile);
  const behavior = new ResidentBehavior(site.kind);
  const mixer = new AnimationMixer(mesh);
  const idle = veil ? 'VeilDrift' : 'BellRoost';
  const clips = asset.animations.filter(clip => clip.name.startsWith(veil ? 'Veil' : 'Bell'));
  const actions = new Map(clips.map(clip => [clip.name, mixer.clipAction(clip)]));
  for (const [name, action] of actions) {
    if (name === idle) continue;
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
  }
  let active = actions.get(idle)!.play();
  active.time = ((site.x * .31 + site.z * .17) % active.getClip().duration);
  mixer.update(0);

  function animate(dt: number, yaw: number) {
    let name = idle;
    if (veil) {
      const delta = yaw - mesh.rotation.y;
      mesh.rotation.y += Math.atan2(Math.sin(delta), Math.cos(delta)) * (1 - Math.exp(-dt * 9));
      if (behavior.phase === 'warning') name = 'VeilFixate';
      else if (active.getClip().name === 'VeilFixate' ||
        (active.getClip().name === 'VeilRelease' && active.time < active.getClip().duration))
        name = 'VeilRelease';
    } else if (behavior.phase === 'warning') name = 'BellKnock';
    else if (behavior.phase === 'listening') name = 'BellListen';
    else if (behavior.phase === 'quiet') {
      const toll = actions.get('BellToll')!.getClip().duration;
      if (behavior.time < toll) name = 'BellToll';
      else if (behavior.time < toll + actions.get('BellSettle')!.getClip().duration) name = 'BellSettle';
    }
    const next = actions.get(name)!;
    if (active !== next) {
      active.fadeOut(.075);
      active = next.reset().fadeIn(.075).play();
    }
    if (name === 'VeilFixate') {
      // Averting your gaze unwinds the same keyed pose as exposure falls.
      active.paused = true;
      active.time = active.getClip().duration * Math.min(1, Math.max(0, (behavior.exposure - .25) / 1.65));
    }
    mixer.update(dt);
  }
  function dispose() {
    mixer.stopAllAction();
    mixer.uncacheRoot(mesh);
    for (const palette of palettes) palette.dispose();
  }
  return { site, mesh, behavior, animate, dispose };
}
