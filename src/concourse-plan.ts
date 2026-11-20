// Coordinates are tile centres. Elevations are metres above the main hall.
export const basementBed = -4.8;
export const waterline = basementBed + 0.52;
export const officeStart = 64;
export const atriumStart = 33;

export function atriumWell(x: number, z: number) {
  const lowerGallery = x <= 45 && (z === 11 || z === 14 || (x === 45 && z > 11 && z < 14));
  return (
    !lowerGallery && x >= 36 && x <= 59 && x !== 47 && x !== 48 && z >= 4 && z <= 20 && z !== 8 && z !== 16
  );
}

export function concourseFloor(x: number, z: number) {
  if (z > 23.5) return basementBed * Math.min(1, (z - 23.5) / 8);
  // A folded service gallery descends inside the western bank of the atrium.
  if (x >= 35.5 && x <= 45.5 && z >= 10.5 && z <= 14.5) return -3.4 * Math.min(1, (x - 35.5) / 7);
  // All four approaches rise to the same central deck. The perimeter stays at grade.
  return 6.4 * Math.max(0, Math.min(1, (x - 35.5) / 7, (59.5 - x) / 7, (z - 3.5) / 4, (20.5 - z) / 4));
}

export function concourseRoof(x: number, z: number) {
  if (z >= 24) return 4.5 + concourseFloor(x, z);
  if (x >= officeStart) return 3.08;
  if (x === atriumStart - 1) return 6.8;
  return x < atriumStart ? 14.4 : 21;
}

export function officeTile(x: number, z: number) {
  return x >= officeStart && z <= 23;
}

function buildPlan() {
  const cells = Array.from({ length: 47 }, () => Array<string>(91).fill('#'));
  function rect(x0: number, z0: number, x1: number, z1: number, tile = '.') {
    for (let z = z0; z <= z1; z++) cells[z].fill(tile, x0, x1 + 1);
  }

  // Two process halls separated by a pierced spine wall.
  rect(1, 1, 31, 23);
  rect(33, 1, 62, 23);
  for (const z of [4, 12, 20]) rect(32, z, 32, z + 1);
  for (const z of [4, 10, 16, 22]) for (const x of [6, 25]) rect(x, z, x, z, '#');
  for (let z = 4; z <= 20; z++) for (let x = 36; x <= 59; x++) if (atriumWell(x, z)) cells[z][x] = '#';

  // Interlocking office circuits. The crossovers alternate ends, so no single
  // corridor reveals the whole route. The southern records gallery opens out.
  for (const z of [2, 8, 15, 22]) rect(64, z, 89, z + 1);
  for (const x of [64, 88]) rect(x, 2, x + 1, 23);
  rect(76, 2, 77, 9);
  rect(70, 8, 71, 16);
  rect(81, 15, 82, 23);
  rect(72, 17, 80, 23);
  rect(72, 10, 86, 14); // Cubicle floor between the two office circuits.
  rect(67, 4, 67, 7);   // Return duct between the north galleries.
  for (const z of [2, 15, 22]) rect(63, z, 64, z + 1);

  // Three independent descents serve the column hall, atrium and office wing.
  for (const x of [9, 54, 86]) rect(x, 24, x + 2, 32);
  rect(3, 33, 88, 45);
  rect(29, 33, 29, 45, '#');
  rect(29, 34, 29, 36);
  rect(29, 42, 29, 44);
  rect(60, 33, 60, 45, '#');
  rect(60, 37, 60, 40);
  for (const z of [36, 42]) for (const x of [8, 17, 25, 36, 47, 55, 67, 76, 84]) rect(x, z, x, z, '#');

  const marks: [number, number, string][] = [
    [3, 12, '@'],
    [4, 11, 'W'],
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
    [76, 20, 'Q'],
    [73, 22, 'S'],
    [80, 22, 'S'],
    [74, 17, 'D'],
    [80, 18, 'D'],
    [6, 44, '4'],
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
