import type { AnimationClip, AnimationMixer } from 'three';

// The first third is anticipation. The remaining frames follow the encounter's contact timer.
export function createContactPose(mixer: AnimationMixer, clip: AnimationClip) {
  const action = mixer.clipAction(clip);
  action.paused = true;
  let phase = 0;
  let weight = 0;
  return (dt: number, target: number) => {
    if (target > 0) {
      if (weight === 0) action.play();
      phase = Math.max(target, phase - dt * 3);
      weight = Math.min(1, weight + dt * 18);
      action.time = phase * clip.duration;
    } else {
      if (weight === 0) return;
      // Release a missed grab from the current pose without playing the bite backwards.
      weight = Math.max(0, weight - dt * 5);
      if (weight === 0) {
        phase = 0;
        action.stop();
        action.paused = true;
      }
    }
    action.setEffectiveWeight(weight);
  };
}
