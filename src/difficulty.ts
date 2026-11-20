export const livesPerLevel = { easy: 5, medium: 3, hard: 1 } as const;
export type Difficulty = keyof typeof livesPerLevel;

export function readDifficulty(value: unknown): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'medium';
}

export function readLives(value: unknown, difficulty: Difficulty): number {
  const limit = livesPerLevel[difficulty];
  return typeof value === 'number' && Number.isInteger(value) ? Math.max(0, Math.min(limit, value)) : limit;
}

export function lifeCount(count: number) {
  return count + (count === 1 ? ' life' : ' lives');
}

export function difficultyName(difficulty: Difficulty) {
  return difficulty[0].toUpperCase() + difficulty.slice(1);
}

export function difficultyPicker(id: string) {
  const choices = (Object.keys(livesPerLevel) as Difficulty[]).map(d =>
    '<option value="' + d + '"' + (d === 'medium' ? ' selected' : '') + '>' +
    difficultyName(d) + ' · ' + lifeCount(livesPerLevel[d]) + '</option>');
  return '<label class="difficulty-picker">Difficulty <select id="' + id + '">' + choices.join('') + '</select></label>';
}
