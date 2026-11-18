import { opening } from './campaign-opening.ts';
import { middle } from './campaign-middle.ts';
import { late } from './campaign-late.ts';
import { endingStages } from './campaign-endings.ts';
import type { Stage } from './campaign-format.ts';

export type { Stage, Theme, GameObject, ObjKind, Prop } from './campaign-format.ts';
export const START = 'lobby';
export const ENDINGS: Record<string, string> = {
  wrong: 'Wrong Door',
  suburbs: 'The Suburbs',
  pink: 'The Pink House',
  city: 'Empty City',
  final: 'Final Escape',
};
export const stages: Record<string, Stage> = Object.fromEntries(
  [...opening, ...middle, ...late, ...endingStages].map((stage) => [stage.id, stage]),
);
