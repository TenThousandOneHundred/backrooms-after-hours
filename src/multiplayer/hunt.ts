import type { Explorer } from './expedition.ts';

export const monsterVoiceRange = 44;
export type HuntResult = 'escaped' | 'caught' | 'abandoned';
export type Hunt = { monster: number; result?: HuntResult; strikeUntil: number };

export function soundBearing(listener: Pick<Explorer, 'x' | 'z' | 'yaw'>, players: Explorer[], self: number) {
  let strongest = 0;
  let cue: { angle: number; strength: number; footsteps: boolean } | undefined;
  for (const source of players) {
    if (!source.alive || source.slot === self) continue;
    const steps = source.moving && !source.hidden ? (source.crouch ? 5 : source.sprint ? 40 : 23) : 0;
    const speech = source.voice >= 0.06 ? Math.min(monsterVoiceRange, 12 + source.voice * 64) : 0;
    const reach = Math.max(steps, speech);
    const dx = source.x - listener.x, dz = source.z - listener.z;
    const distance = Math.hypot(dx, dz);
    if (distance >= reach) continue;
    const strength = 1 - distance / reach;
    if (strength <= strongest) continue;
    strongest = strength;
    cue = { angle: Math.atan2(dx, -dz) - listener.yaw, strength, footsteps: steps > 0 && distance < steps };
  }
  return cue;
}
