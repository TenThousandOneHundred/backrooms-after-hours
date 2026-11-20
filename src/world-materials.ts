import { isLevelZero } from './level-zero-rooms';
import * as THREE from 'three';

export type Finish =
  | 'paper'
  | 'carpet'
  | 'ceiling'
  | 'concrete'
  | 'metal'
  | 'tile'
  | 'wood'
  | 'hotel'
  | 'grass'
  | 'rock'
  | 'party'
  | 'water'
  | 'road'
  | 'plaster'
  | 'brick'
  | 'hospital'
  | 'sand'
  | 'earth';
export type Style = {
  family: string;
  wall: Finish;
  floor: Finish;
  wc: string;
  fc: string;
  cc: string;
  trim: string;
  lamp: string;
  fog: string;
  level: number;
  height: number;
  open?: boolean;
};

export function styleFor(theme: string, id: string): Style {
  const name = (theme + ' ' + id).toLowerCase();
  const pick = (
    family: string,
    wall: Finish,
    floor: Finish,
    wc: string,
    fc: string,
    cc: string,
    trim: string,
    lamp: string,
    fog: string,
    level = 1,
    height = 3.08,
    open = false,
  ): Style => ({ family, wall, floor, wc, fc, cc, trim, lamp, fog, level, height, open });
  if (/deepool|stagnant|dark.?pool|37[.-]2|pool.*dark/.test(name))
    return pick(
      'pool',
      'tile',
      'water',
      '#73999a',
      '#256674',
      '#a4bab7',
      '#26575f',
      '#80e4f1',
      '#142d36',
      0.58,
      4.7,
    );
  if (/pool|(^| )37( |$)/.test(name))
    return pick(
      'pool',
      'tile',
      'water',
      '#c7dedb',
      '#54a9a5',
      '#e6e6cd',
      '#529293',
      '#f3fff0',
      '#92b2ab',
      1.15,
      4.8,
    );
  if (/depths/.test(name))
    return pick(
      'abyss',
      'rock',
      'earth',
      '#53666c',
      '#4e6465',
      '#71868a',
      '#384e50',
      '#65b3c3',
      '#182c34',
      0.4,
      5.4,
    );
  if (/castle/.test(name))
    return pick(
      'castle',
      'brick',
      'wood',
      '#a19483',
      '#806d58',
      '#a69886',
      '#63564a',
      '#f1c47f',
      '#66594e',
      0.76,
      4.6,
    );
  if (/stair/.test(name))
    return pick(
      'stairs',
      'concrete',
      'concrete',
      '#b5b9a8',
      '#96958b',
      '#d8dace',
      '#6b7774',
      '#e3e7d2',
      '#89978f',
      0.87,
      5.8,
    );
  if (/courtyard/.test(name))
    return pick(
      'court',
      'concrete',
      'tile',
      '#b7c1b8',
      '#9caaa1',
      '#b8c1bd',
      '#747f77',
      '#c3dcce',
      '#7d918a',
      0.88,
      7.4,
    );
  if (/residential/.test(name))
    return pick(
      'hotel',
      'paper',
      'wood',
      '#b38077',
      '#84644e',
      '#b6a69c',
      '#6d4942',
      '#ebcbb9',
      '#7b5752',
      0.88,
      3.3,
    );
  if (/blackgarage/.test(name))
    return pick(
      'garage',
      'concrete',
      'concrete',
      '#95a697',
      '#78817a',
      '#a3a99e',
      '#4e5e52',
      '#dbe9cc',
      '#314139',
      0.54,
      3.3,
    );
  if (/pink|kitty|974/.test(name))
    return pick(
      'pink',
      'paper',
      'carpet',
      '#e7a0b5',
      '#c47396',
      '#ecdad7',
      '#a84975',
      '#ffe7ef',
      '#74505d',
      1.05,
      3,
    );
  if (/slide|55[.-]1/.test(name))
    return pick(
      'slides',
      'tile',
      'concrete',
      '#a4a491',
      '#8b8f83',
      '#7d8d8e',
      '#a8332e',
      '#c5e7ec',
      '#425159',
      0.82,
      5,
    );
  if (/school|52/.test(name))
    return pick(
      'school',
      'hospital',
      'tile',
      '#e3d9ae',
      '#b5b2a3',
      '#d9d8ce',
      '#465c60',
      '#e8efcf',
      '#667275',
      0.95,
      3.45,
    );
  if (/red.?hall|run.?for|chase|hospital.?run|alarm|hotel-run|sprint/.test(name))
    return pick(
      'alarm',
      'hospital',
      'tile',
      '#aa6151',
      '#7e5a50',
      '#765c51',
      '#783b32',
      '#ff442d',
      '#451a17',
      0.75,
      3.25,
    );
  if (/poolparty|party|fun|birthday/.test(name))
    return pick(
      'party',
      'party',
      'party',
      '#efcb78',
      '#595384',
      '#c2ae80',
      '#8844a0',
      '#ffecc2',
      '#746869',
      0.95,
      3.3,
    );
  if (/arcade|3999/.test(name))
    return pick(
      'arcade',
      'metal',
      'party',
      '#53536d',
      '#4b4263',
      '#383c5a',
      '#43394f',
      '#74d8e3',
      '#27253d',
      0.66,
      4,
    );
  if (/overgrowth|grass|garden|greenhouse/.test(name))
    return pick(
      'garden',
      'concrete',
      'grass',
      '#b4b7a7',
      '#718247',
      '#d7e2dc',
      '#626c62',
      '#f5ffe6',
      '#9cae95',
      1.06,
      5.5,
    );
  if (/cave|cavern|rock/.test(name))
    return pick(
      'cave',
      'rock',
      'earth',
      '#79726d',
      '#726557',
      '#46413e',
      '#3a3833',
      '#d79d64',
      '#302a26',
      0.49,
      4.3,
    );
  if (/farm|wheat|rural|field|level.?10\b/.test(name))
    return pick(
      'field',
      'wood',
      'grass',
      '#a3945e',
      '#a79649',
      '#d6ccb2',
      '#856e42',
      '#fff1c6',
      '#c5b999',
      1.05,
      3.2,
      true,
    );
  if (/suburb|town|neighbou|street|village|94/.test(name))
    return pick(
      'suburb',
      'plaster',
      'road',
      '#b1a58a',
      '#696d65',
      '#c5d2cb',
      '#686346',
      '#eeeece',
      /night|dark|suburb/.test(name) ? '#414c53' : '#a7b5a7',
      /night|dark|suburb/.test(name) ? 0.6 : 1.15,
      3.4,
      true,
    );
  if (/ocean|flood|sea|thalass|lake/.test(name))
    return pick(
      'sea',
      'wood',
      'water',
      '#947e60',
      '#3e707b',
      '#8ba4ad',
      '#51483d',
      '#b6d3cb',
      '#637d82',
      0.7,
      3.1,
      true,
    );
  if (/dark|lights.?out|blackout/.test(name))
    return pick(
      'blackout',
      'concrete',
      'concrete',
      '#7c8381',
      '#666662',
      '#6c7572',
      '#303e40',
      '#adc6bb',
      '#101a1b',
      0.15,
      3.1,
    );
  if (/hotel|courtyard|188|lodge/.test(name))
    return pick(
      'hotel',
      'hotel',
      'carpet',
      '#b59a79',
      '#8a4e43',
      '#dbcaad',
      '#5b4433',
      '#ffe4b2',
      '#6a574d',
      0.96,
      /188|courtyard/.test(name) ? 5.8 : 3.7,
    );
  if (/library|archive|the-end|the_end|^end\b/.test(name))
    return pick(
      'library',
      'wood',
      'carpet',
      '#97754f',
      '#7a6451',
      '#c9b798',
      '#60452e',
      '#ffe4aa',
      '#594b3e',
      0.86,
      3.6,
    );
  if (/snack/.test(name))
    return pick(
      'diner',
      'hospital',
      'tile',
      '#b5d1c4',
      '#c8c4b5',
      '#ddd7c5',
      '#a46a59',
      '#fff0cb',
      '#8a9185',
      1.07,
      3.3,
    );
  if (/office|mall/.test(name))
    return pick(
      'office',
      'plaster',
      'carpet',
      '#b8c3b2',
      '#727e7c',
      '#d3d7ce',
      '#626c62',
      '#f5f8e1',
      '#6c7a74',
      0.98,
      3,
    );
  if (/stair|escher|tower|9223/.test(name))
    return pick(
      'stairs',
      'concrete',
      'concrete',
      '#b5b9a8',
      '#96958b',
      '#d8dace',
      '#6b7774',
      '#e3e7d2',
      '#89978f',
      0.87,
      5.8,
    );
  if (/hospital|plastic|mariana|421|clinic/.test(name))
    return pick(
      'hospital',
      'hospital',
      'tile',
      '#d2ddb6',
      '#8eacae',
      '#e3e0c6',
      '#649498',
      '#e9f6d9',
      '#7e9594',
      0.94,
      3.4,
    );
  if (/garage|habita|parking/.test(name))
    return pick(
      'garage',
      'concrete',
      'concrete',
      '#abb0a1',
      '#8d9187',
      '#acafa1',
      '#596956',
      '#dbead1',
      '#64746b',
      0.84,
      3.3,
    );
  if (/pipe|tunnel|sewer/.test(name))
    return pick(
      'pipes',
      'concrete',
      'metal',
      '#a19d84',
      '#797b71',
      '#8e9080',
      '#676656',
      '#ffcd82',
      '#60594b',
      0.76,
      3,
    );
  if (/bunker|hub|power|station|outpost|electr|industrial|boiler|maintenance|control/.test(name))
    return pick(
      'utility',
      'concrete',
      'concrete',
      '#9caa9e',
      '#747d76',
      '#9a9c8f',
      '#475b56',
      '#d7f1cf',
      '#53655d',
      0.82,
      3.35,
    );
  return pick(
    'lobby',
    'paper',
    'carpet',
    isLevelZero(id) ? '#d2d18a' : '#c6b372',
    isLevelZero(id) ? '#a18d64' : '#9f884f',
    isLevelZero(id) ? '#cec7a1' : '#c4bc98',
    isLevelZero(id) ? '#aa9c68' : '#554735',
    '#fff8d6',
    '#726444',
    1.01,
  );
}

function rand(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function hash(x: number, z: number, k = 0) {
  let a = Math.imul(x + 91, 374761393) + Math.imul(z + 17, 668265263) + k * 421;
  a = Math.imul(a ^ (a >>> 13), 1274126177);
  return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
}
const SIZE = 256;
// Keep a bounded set of deterministic source images for retries and repeated room finishes.
const finishImages = new Map<string, HTMLCanvasElement>();

export function texture(finish: Finish, hex: string, office = false): THREE.CanvasTexture {
  const key = finish + '/' + hex + (office ? '/office' : '');
  let canvas = finishImages.get(key);
  if (canvas) finishImages.delete(key);
  else canvas = drawFinish(finish, hex, office);
  finishImages.set(key, canvas);
  if (finishImages.size > 8) finishImages.delete(finishImages.keys().next().value!);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function drawFinish(finish: Finish, hex: string, office: boolean) {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d')!;
  const seed = Array.from(finish).reduce((n, k) => n * 17 + k.charCodeAt(0), 419) >>> 0,
    rng = rand(seed);
  const base = parseInt(hex.slice(1), 16);
  const rgb = [base >> 16, (base >> 8) & 255, base & 255];
  const img = g.createImageData(SIZE, SIZE);
  const scales = [4, 8, 16, 32].map((s) => ({
    s,
    vals: Float32Array.from({ length: s * s }, () => rng() - 0.5),
  }));
  function noise(x: number, y: number, layer: number) {
    const { s, vals } = scales[layer],
      fx = (x / SIZE) * s,
      fy = (y / SIZE) * s,
      ix = Math.floor(fx),
      iy = Math.floor(fy);
    let a = fx - ix,
      b = fy - iy;
    a = a * a * (3 - 2 * a);
    b = b * b * (3 - 2 * b);
    const v = (dx: number, dy: number) => vals[((iy + dy) % s) * s + ((ix + dx) % s)];
    return (v(0, 0) * (1 - a) + v(1, 0) * a) * (1 - b) + (v(0, 1) * (1 - a) + v(1, 1) * a) * b;
  }
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const a = noise(x, y, 0),
        b = noise(x, y, 1),
        d = noise(x, y, 2);
      const grain = rng() - 0.5;
      let off = grain * 11 + a * 8 + b * 6;
      if (finish === 'carpet')
        off =
          a * 16 + b * 14 + d * 6 + grain * 34 + (y % 3 === 0 ? -4 : 1) + Math.sin((x * Math.PI) / 2 + y) * 4;
      if (finish === 'concrete' || finish === 'rock' || finish === 'earth')
        off = grain * 21 + a * 28 + b * 18 + d * 11;
      if (finish === 'grass' || finish === 'sand') off = a * 18 + b * 22 + grain * 35 + d * 15;
      if (finish === 'water')
        off = a * 16 + b * 10 + Math.sin(y / 4 + Math.sin((x * Math.PI) / 32) * 2) * 4 + grain * 3;
      if (finish === 'wood')
        off = a * 13 + b * 5 + Math.sin(x * 0.29 + Math.sin((y * Math.PI) / 64) * 0.35) * 5 + grain * 9;
      if (finish === 'ceiling') off = grain * 19 + b * 10 + a * 8 + (rng() < 0.031 ? -30 : 0);
      if (finish === 'road') off = grain * 30 + a * 13 + b * 9;
      if (office) off *= finish === 'paper' ? 0.34 : 0.45;
      const p = (y * SIZE + x) * 4;
      for (let n = 0; n < 3; n++) img.data[p + n] = Math.max(0, Math.min(255, rgb[n] + off));
      img.data[p + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  function rect(x: number, y: number, w: number, h: number, style: string) {
    g.fillStyle = style;
    g.fillRect(x, y, w, h);
  }
  function line(coords: number[], style: string, width = 1) {
    g.beginPath();
    g.strokeStyle = style;
    g.lineWidth = width;
    for (let i = 0; i < coords.length; i += 2) {
      if (i === 0) g.moveTo(coords[i], coords[i + 1]);
      else g.lineTo(coords[i], coords[i + 1]);
    }
    g.stroke();
  }
  if (office && finish === 'paper') {
    // A small two-color sprig repeats in staggered vertical lanes on the stock.
    for (let row = -1; row < 9; row++) {
      for (let col = -1; col < 9; col++) {
        const x = col * 32 + (row & 1) * 16, y = row * 32;
        for (const side of [-1, 1]) {
          g.beginPath();
          g.moveTo(x, y - 12);
          g.bezierCurveTo(x + side * 2, y - 3, x + side * 12, y + 1, x + side * 15, y + 16);
          g.strokeStyle = 'rgba(112,116,67,.18)';
          g.lineWidth = 0.9;
          g.stroke();
        }
        line([x, y - 13, x - 1, y - 3, x + 1, y + 7, x, y + 14], 'rgba(102,106,58,.42)', 1);
        for (const side of [-1, 1]) {
          for (let leaf = 0; leaf < 3; leaf++) {
            const tip = y - 12 + leaf * 6;
            g.beginPath();
            g.moveTo(x, tip + 7);
            g.quadraticCurveTo(x + side * 5, tip + 6, x + side * 7, tip);
            g.quadraticCurveTo(x + side * 2, tip + 1, x, tip + 7);
            g.fillStyle = 'rgba(106,109,61,.32)';
            g.fill();
          }
        }
      }
    }
    rect(0, 0, 1, SIZE, 'rgba(99,93,54,.13)');
  } else if (finish === 'paper' || finish === 'hotel') {
    const spacing = 32;
    // Faded interlocking fronds give the paper a woven, vertical 1970s pattern.
    for (let j = -1; j < 9; j++)
      for (let i = -1; i < 9; i++) {
        const cx = i * spacing + ((j % 2) * spacing) / 2,
          cy = j * 32;
        for (const dir of [-1, 1])
          for (let k = 0; k < 4; k++) {
            const y = cy - 6 + k * 4;
            g.beginPath();
            g.moveTo(cx, y + 9);
            g.quadraticCurveTo(cx + dir * (2 + k), y + 2, cx + dir * (5 + k * 1.6), y - 2);
            g.quadraticCurveTo(cx + dir * (4 + k * 1.1), y + 4, cx, y + 10);
            g.strokeStyle = 'rgba(93,78,39,.26)';
            g.lineWidth = 0.65;
            g.stroke();
          }
        line([cx, cy - 1, cx, cy + 22], 'rgba(102,83,40,.22)', 0.7);
        if (finish === 'hotel') {
          g.strokeStyle = 'rgba(90,38,41,.30)';
          g.strokeRect(cx - 11, cy - 14, 22, 27);
        }
      }
    for (let k = 0; k < 1000; k++) {
      const x = rng() * 256,
        y = rng() * 256;
      rect(x, y, 0.5, 1 + rng() * 4, 'rgba(255,245,199,.1)');
    }
    rect(0, 0, 1.5, 256, 'rgba(57,48,24,.18)');
    rect(1.5, 0, 1, 256, 'rgba(251,236,183,.18)');
  }
  if (finish === 'ceiling') {
    g.globalAlpha = office ? .24 : 1;
    for (let y = 0; y < 256; y += 128) {
      rect(0, y, 256, 2.4, 'rgba(50,48,43,.78)');
      rect(0, y + 3, 256, 1.4, 'rgba(250,248,232,.85)');
    }
    for (let x = 0; x < 256; x += 64) {
      rect(x, 0, 1.6, 256, 'rgba(55,53,42,.7)');
      rect(x + 2, 0, 1.2, 256, 'rgba(255,247,225,.76)');
    }
    for (let j = 0; j < 1150; j++) {
      const x = rng() * 256,
        y = rng() * 256;
      line([x, y, x + 1 + rng() * 3, y + rng() * 2], 'rgba(53,51,44,.23)', 0.7);
    }
  }
  if (finish === 'tile' || finish === 'hospital' || finish === 'brick') {
    const cell = finish === 'hospital' ? 64 : 32;
    for (let y = 0; y < 256; y += cell) {
      rect(0, y, 256, 2, 'rgba(46,66,65,.49)');
      rect(0, y + 2, 256, 1, 'rgba(255,255,249,.58)');
      for (let xx = -cell; xx < 256; xx += cell) {
        const x = xx + (finish === 'brick' && y % (cell * 2) === 0 ? cell / 2 : 0);
        rect(x, y, 1.8, cell, 'rgba(51,71,68,.48)');
        rect(x + 2, y + 2, 1, cell - 2, 'rgba(255,251,235,.52)');
        rect(
          x + 3,
          y + 3,
          cell - 3,
          cell - 3,
          `rgba(${rng() > 0.45 ? '252,255,244' : '72,92,88'},${rng() * 0.085})`,
        );
      }
    }
  }
  if (finish === 'wood' || finish === 'metal' || finish === 'concrete') {
    const spacing = finish === 'wood' ? 32 : 128;
    for (let x = 0; x < 256; x += spacing) {
      rect(x, 0, 1.6, 256, 'rgba(30,33,30,.26)');
      rect(x + 2, 0, 1, 256, 'rgba(242,240,221,.28)');
    }
    if (finish !== 'wood') {
      for (const y of [4, 125, 132, 253])
        for (const x of [5, 123, 132, 251]) {
          g.fillStyle = 'rgba(26,33,32,.35)';
          g.beginPath();
          g.arc(x, y, 1.5, 0, Math.PI * 2);
          g.fill();
        }
    }
  }
  if (finish === 'party') {
    for (let i = 0; i < 140; i++) {
      g.save();
      g.translate(rng() * 256, rng() * 256);
      g.rotate(rng() * 6);
      rect(0, 0, 2 + rng() * 7, 2, ['#e9af62', '#b96091', '#73b9bb', '#bfa85f', '#686395'][i % 5]);
      g.restore();
    }
  }
  if (finish === 'grass' || finish === 'carpet') {
    g.globalAlpha = office ? .35 : 1;
    for (let i = 0; i < 7600; i++) {
      const x = rng() * 256,
        y = rng() * 256;
      line(
        [x, y, x + 1 + rng() * 1.5, y - rng() * 3],
        i % 3 ? 'rgba(49,47,30,.12)' : 'rgba(244,232,182,.24)',
        0.65,
      );
    }
  }
  return c;
}
