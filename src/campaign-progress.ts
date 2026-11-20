import type { GameObject } from './campaign-format';
import type { Progress } from './game-state';

export function recordObjective(state: Progress, obj: GameObject) {
  for (const flag of obj.consumes ?? []) {
    state.flags = state.flags.filter((f) => f !== flag);
    delete state.inventory[flag];
  }
  for (const flag of obj.gives ?? []) {
    if (!state.flags.includes(flag)) state.flags.push(flag);
    if (obj.kind === 'pickup' && obj.challenge?.kind !== 'haul')
      state.inventory[flag] = obj.name.replace(/^(take|pick up|collect|find|retrieve|grab)\s+/i, '');
  }
  const key = state.stage + '/' + obj.id;
  if (obj.kind !== 'exit' && obj.kind !== 'ending' && !state.completed.includes(key))
    state.completed.push(key);
  if (obj.kind === 'ending' && obj.ending) {
    if (!state.endings.includes(obj.ending)) state.endings.push(obj.ending);
    if (!state.flags.includes(obj.ending)) state.flags.push(obj.ending);
  }
}
