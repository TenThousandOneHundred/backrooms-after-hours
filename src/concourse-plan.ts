// Coordinates are tile centres. Elevations are metres above the main hall.
export const basementBed = -4.8;

export function concourseFloor(_x: number, z: number) {
  return z <= 23.5 ? 0 : basementBed * Math.min(1, (z - 23.5) / 8);
}

function buildPlan() {
  const cells = Array.from({ length: 47 }, () => Array<string>(91).fill('#'));
  function rect(x0: number, z0: number, x1: number, z1: number, tile = '.') {
    for (let z = z0; z <= z1; z++) cells[z].fill(tile, x0, x1 + 1);
  }

  // Preserve the original entry doorway and objective coordinates. The large
  // chambers inside this perimeter are divided by the real walls in level-zero-rooms.
  rect(1, 1, 89, 23);
  rect(5, 7, 5, 11, '#');
  rect(5, 13, 5, 16, '#');
  rect(10, 11, 10, 12, '#');
  // Broad carpeted descents connect the three upper wings to the records suites.
  for (const x of [8, 52, 84]) rect(x, 24, x + 4, 32);
  rect(3, 33, 88, 45);

  const marks: [number, number, string][] = [
    [4, 12, '@'],
    [2, 8, 'W'],
    [2, 13, 'N'],
    [3, 8, 'H'],
    [16, 3, '2'],
    [30, 19, '!'],
    [2, 5, 'L'],
    [2, 4, 'K'],
    [1, 3, 'E'],
    [71, 9, '&'],
    [22, 22, '%'],
    [68, 2, '1'],
    [86, 9, '3'],
    [88, 8, 'F'],
    [89, 7, 'J'],
    [65, 15, 'G'],
    [89, 20, 'T'],
    [65, 3, 'A'],
    [69, 22, '&'],
    [88, 16, '%'],
    [7, 18, '4'],
    [4, 45, 'U'],
    [32, 45, 'U'],
    [5, 43, 'P'],
  ];
  for (const [x, z, mark] of marks) {
    if (cells[z][x] !== '.') throw new Error('Blocked concourse marker ' + mark);
    cells[z][x] = mark;
  }
  return cells.map((row) => row.join('')).join('\n');
}

export const concoursePlan = buildPlan();
