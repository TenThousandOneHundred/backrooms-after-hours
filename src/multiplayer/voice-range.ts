import type { Stage } from '../campaign-format';
import { clearSight, TILE } from '../game-entity.ts';
import { maxVoiceReach, speechReach } from '../voice-reach.ts';

type Position = { x: number; z: number; y: number; yaw: number; hidden: boolean };

export function voiceMix(stage: Stage, listener: Position, speaker: Position & { voice: number }, hearing = 1) {
  const dx = speaker.x - listener.x,
    dz = speaker.z - listener.z;
  const distance = Math.hypot(dx, dz, speaker.y - listener.y);
  const inRange = distance < maxVoiceReach * hearing;
  const range = speechReach(speaker.voice) * hearing;
  if (distance >= range) return { inRange, gain: 0, pan: 0, cutoff: 18000 };
  const clear = clearSight(stage, listener.x / TILE, listener.z / TILE, speaker.x / TILE, speaker.z / TILE);
  const muffled = !clear || speaker.hidden || listener.hidden;
  const fade = Math.min(1, (range - distance) / (range - 2));
  const pan = (dx * Math.cos(listener.yaw) + dz * Math.sin(listener.yaw)) / Math.max(1, distance);
  return { inRange, gain: fade * fade * (muffled ? 0.4 : 1), pan, cutoff: muffled ? 1250 : 18000 };
}
