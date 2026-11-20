// Reserve long-distance carry for the loud end of the microphone meter.
export function shoutStrength(volume: number) {
  const t = Math.max(0, Math.min(1, (volume - 0.62) / 0.32));
  return t * t * (3 - 2 * t);
}

export const maxVoiceReach = 96;

export function speechReach(volume: number) {
  return 8 + 24 * volume * volume + (maxVoiceReach - 32) * shoutStrength(volume);
}
