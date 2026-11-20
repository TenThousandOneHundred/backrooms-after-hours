// Render original stereo ambience with Node 22.18+ and FFmpeg.
// Run from the repository root: node art/render-soundscapes.mjs [stage]
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { levelAtmospheres } from '../src/level-atmosphere.ts';

const rate = 24000, tau = Math.PI * 2;
// Fractional onset, instrument, starting pitch in Hz, duration, stereo position, level.
const hit = (at, instrument, pitch, seconds, pan = 0, gain = 1) => ({ at, instrument, pitch, seconds, pan, gain });
// Event times are fractions of one light cycle. The second pass changes the reflections.
const scores = {
  // Steam kicks the bypass pipe twice; the bleed valve then lets go.
  pipesreturn: ['motor', 49, .16, [hit(.07,'pipe',106,1.2,-.6),hit(.12,'pipe',83,1.6,.3),hit(.47,'hiss',1020,2.2,.72)]],
  fun: ['tape', 103, .12, [hit(.04,'box',395,.8,-.4),hit(.11,'box',315,1,.2),hit(.18,'box',298,1.7,.4),hit(.65,'rub',165,.8,-.6)]],
  pool: ['tide', 92, .48, [hit(.08,'drop',790,.36,-.7),hit(.13,'drop',1110,.27,.42),hit(.57,'glass',658,2.3,.65)]],
  run: ['motor', 61, .1, [hit(.07,'buzzer',342,.64,-.5),hit(.2,'buzzer',257,1.02,.4),hit(.64,'impact',77,.35,.6)]],
  library: ['tape', 57, .09, [hit(.055,'spool',188,2.1,-.45),hit(.23,'key',760,.12,-.45),hit(.52,'paper',1700,1.2,.7),hit(.62,'key',581,.14,.6)]],
  village: ['wind', 81, .25, [hit(.07,'horn',196,1.7,-.7),hit(.21,'horn',165,2.3,-.5),hit(.66,'hinge',308,1.5,.65)]],
  castle: ['choir', 98, .44, [hit(.06,'bell',247,2.9,-.62),hit(.29,'bell',185,3.2,.56),hit(.7,'wood',125,.32,-.2)]],
  dark: ['carrier', 50, .18, [hit(.05,'radio',760,.26,-.7),hit(.10,'radio',1030,.4,.6),hit(.16,'radio',530,.85,0),hit(.64,'air',330,1.6,.6)]],
  ocean: ['tide', 46, .28, [hit(.08,'horn',91,3.1,-.75),hit(.56,'chain',505,1.18,.6),hit(.70,'splash',470,.9,.3)]],
  depths: ['hull', 63, .55, [hit(.06,'ping',892,2.3,.1),hit(.38,'hull',93,2,-.8),hit(.63,'bubble',355,1.18,.48)]],
  cave: ['wind', 72, .64, [hit(.06,'stone',340,.68,-.8),hit(.16,'glass',1210,1.7,.48),hit(.51,'stone',215,1,.4),hit(.78,'drop',889,.22,-.2)]],
  projection: ['tape', 74, .12, [hit(.05,'spool',265,2.45,-.5),hit(.28,'snap',620,.22,-.45),hit(.54,'spool',314,1.33,.58)]],
  courtyard1: ['choir', 130, .42, [hit(.06,'glass',493,2.3,-.63),hit(.15,'glass',587,2,.12),hit(.25,'glass',739,2.6,.69)]],
  suburbs: ['wind', 54, .16, [hit(.07,'chime',523,.84,.65),hit(.13,'chime',392,1.8,.65),hit(.62,'hinge',187,1.45,-.72)]],
  outpost: ['vent', 84, .19, [hit(.05,'hiss',1760,1.2,-.6),hit(.18,'monitor',775,.23,.45),hit(.26,'monitor',775,.18,.45),hit(.62,'drain',96,1.65,.5)]],
  field: ['wind', 68, .12, [hit(.06,'sail',185,2.2,-.7),hit(.23,'wood',114,.38,.05),hit(.44,'sail',151,2.55,.65),hit(.72,'rub',320,.96,.45)]],
  arcade: ['carrier', 112, .12, [hit(.045,'game',659,.28,-.6),hit(.085,'game',494,.28,0),hit(.13,'game',330,.6,.6),hit(.54,'coin',1280,.55,.53),hit(.60,'coin',970,.42,.39)]],
  residential: ['vent', 65, .18, [hit(.06,'relay',217,.27,-.7),hit(.12,'relay',169,.29,0),hit(.18,'relay',136,.45,.72),hit(.61,'buzzer',95,1.2,.54)]],
  redrooms: ['choir', 73, .32, [hit(.08,'rub',132,1.95,-.6),hit(.32,'bow',164,2.1,.6),hit(.72,'impact',59,.8,.05)]],
  snack: ['motor', 94, .13, [hit(.04,'key',386,.13,-.3),hit(.078,'key',449,.11,-.2),hit(.14,'key',305,.16,-.1),hit(.21,'ding',1210,1.45,.45),hit(.66,'pour',720,1.33,.7)]],
  hotelchase: ['hull', 57, .23, [hit(.05,'chain',315,1.35,-.67),hit(.24,'ding',732,.92,.57),hit(.46,'slide',140,1.45,.4),hit(.72,'impact',83,.45,.4)]],
  courtyard2: ['carrier', 119, .24, [hit(.05,'radio',1510,.44,-.72),hit(.17,'carrier',465,1.48,.64),hit(.47,'radio',770,1.05,.43),hit(.70,'relay',195,.26,-.42)]],
  deepool: ['hull', 54, .49, [hit(.07,'hull',81,1.8,-.68),hit(.19,'pipe',116,1.3,-.1),hit(.43,'splash',290,2.2,.68),hit(.75,'drop',670,.44,.5)]],
  stagnant: ['tide', 68, .25, [hit(.07,'drain',115,1.5,.63),hit(.21,'bubble',247,.85,.4),hit(.51,'bubble',178,1.9,-.62),hit(.78,'rub',93,.75,-.4)]],
  funplus: ['tape', 146, .22, [hit(.06,'reed',392,.65,-.65),hit(.135,'reed',466,.72,.15),hit(.21,'reed',370,1.15,.67),hit(.62,'snap',399,.28,-.35)]],
  school: ['vent', 90, .40, [hit(.055,'bell',916,.72,-.35),hit(.13,'bell',916,.72,-.35),hit(.205,'bell',915,1.55,-.35),hit(.65,'wood',171,.38,.76)]],
  slides: ['vent', 59, .10, [hit(.06,'snap',990,.2,-.61),hit(.105,'spool',260,.56,-.61),hit(.55,'snap',740,.26,.67),hit(.62,'pour',1080,.82,.63)]],
  slides2: ['motor', 44, .23, [hit(.06,'starter',87,1.6,-.65),hit(.245,'starter',97,.85,-.54),hit(.53,'impact',112,.5,.62),hit(.7,'hiss',740,.66,.3)]],
  slides3: ['draft', 88, .51, [hit(.06,'grind',109,2.12,.73),hit(.29,'stone',260,.49,.28),hit(.54,'grind',139,1.46,-.72),hit(.71,'stone',180,.63,-.6)]],
  bunker: ['carrier', 62, .12, [hit(.05,'carrier',620,.16,-.55),hit(.08,'carrier',620,.16,-.55),hit(.12,'carrier',620,.56,-.55),hit(.34,'radio',565,.88,.55),hit(.72,'relay',305,.28,.35)]],
  stair: ['draft', 77, .53, [hit(.05,'clock',660,.25,-.7),hit(.135,'clock',534,.32,.7),hit(.22,'clock',660,.25,-.7),hit(.55,'bell',131,3.2,0)]],
  pink: ['tape', 164, .22, [hit(.06,'box',784,1.1,-.64),hit(.145,'box',622,1,.13),hit(.23,'box',659,1.35,.62),hit(.53,'spring',380,1.48,.58)]],
  lowstation: ['vent', 69, .27, [hit(.07,'glass',1080,1.62,-.6),hit(.16,'bubble',390,1.34,-.3),hit(.50,'breath',500,2.5,.69)]],
  plastic: ['tide', 104, .32, [hit(.055,'squeak',680,.49,-.65),hit(.13,'squeak',505,.64,.61),hit(.39,'bubble',536,.8,-.1),hit(.68,'ping',420,1.2,.48)]],
  gym: ['draft', 85, .46, [hit(.05,'bounce',118,.48,-.7),hit(.14,'bounce',125,.4,-.3,.85),hit(.213,'bounce',128,.3,.03,.67),hit(.271,'bounce',134,.23,.33,.52),hit(.61,'squeak',930,.53,.72)]],
  overgrowth: ['wind', 67, .28, [hit(.07,'paper',700,1.85,-.7),hit(.27,'wood',183,.37,-.2),hit(.51,'breath',319,2.35,.66),hit(.76,'snap',415,.3,.45)]],
  grass: ['draft', 99, .19, [hit(.06,'sail',510,2.28,.64),hit(.29,'seed',1180,1.2,-.46),hit(.53,'reed',261,1.65,-.62),hit(.76,'seed',890,.73,.3)]],
};

function randomFor(key) {
  let seed = 2166136261;
  for (const char of key) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 4294967296) * 2 - 1;
  };
}
const sin = Math.sin,
  exp = Math.exp;
const modes = {
  pipe: [1, 2.71, 5.13],
  hull: [1, 1.44, 2.91],
  glass: [1, 2.32, 4.24],
  bell: [1, 1.19, 2.42, 3.8],
  box: [1, 2.98, 5.02],
  coin: [1, 2.64, 4.35],
  chime: [1, 2, 3.01],
  ding: [1, 2.78, 5.31],
  wood: [1, 1.61, 2.13],
  stone: [1, 1.85, 3.61],
  impact: [1, 1.53, 2.26],
  clock: [1, 2.45, 4.12],
};
function render(id, [bed, root, echo, events]) {
  const period = levelAtmospheres[id].period,
    length = period * 2,
    count = length * rate;
  const channels = [new Float32Array(count), new Float32Array(count)];
  const random = randomFor(id),
    fundamental = Math.round(root * length) / length;
  let low = 0,
    mid = 0;
  for (let i = 0; i < count; i++) {
    const t = i / rate,
      phase = (t * tau) / length,
      angle = t * tau * fundamental;
    const noise = random();
    low += 0.018 * (noise - low);
    mid += 0.16 * (noise - mid);
    const air = (mid - low) * (0.45 + 0.18 * sin(phase * 3)) * Math.min(1, i / 600, (count - i) / 600);
    let tone;
    switch (bed) {
      case 'motor':
        tone =
          0.45 * sin(angle + 0.35 * sin(phase * 8)) + 0.22 * sin(2 * angle) * (1 + 0.65 * sin(phase * 28));
        break;
      case 'tape':
        tone = 0.35 * sin(angle + 0.63 * sin(phase * 7)) + 0.2 * sin(1.5 * angle + 0.5 * sin(phase * 5));
        break;
      case 'vent':
        tone = 0.27 * sin(angle) + air * 2.6 + 0.21 * sin(2 * angle + 0.32 * sin(phase * 16));
        break;
      case 'hull':
        tone = 0.52 * sin(angle + 0.6 * sin(phase * 2)) + 0.17 * sin(3 * angle + sin(phase * 5));
        break;
      case 'carrier':
        tone = 0.32 * sin(angle) + 0.15 * sin(4 * angle) * (1 + 0.6 * sin(phase * 13));
        break;
      case 'choir':
        tone =
          0.37 * sin(angle + 0.7 * sin(phase * 3)) +
          0.21 * sin(angle * 1.5) +
          0.16 * sin(3 * angle + 0.45 * sin(phase * 9));
        break;
      case 'tide':
        tone = air * (1.5 + 0.86 * sin(phase * 4)) + 0.39 * sin(angle + 0.7 * sin(phase));
        break;
      default:
        tone = air * (bed === 'wind' ? 3.3 : 2.1) + 0.26 * sin(angle + 0.55 * sin(phase * 3));
        break;
    }
    // Fade the drone very briefly at the loop seam, including fractional overtones.
    const sample = (tone * 0.18 + air * 0.11) * Math.min(1, i / 400, (count - i) / 400);
    channels[0][i] = sample * (0.94 + 0.1 * sin(phase));
    channels[1][i] = sample * (0.94 - 0.1 * sin(phase));
  }
  function addEvent(e, pass) {
    const start = Math.round((pass + e.at) * period * rate),
      pan = e.pan * (pass ? 0.83 : 1);
    const l = Math.sqrt((1 - pan) / 2),
      r = Math.sqrt((1 + pan) / 2);
    const spacing = Math.round((0.055 + echo * 0.26) * rate),
      samples = Math.round(e.seconds * rate);
    let phase = 0,
      smooth = 0,
      band = 0,
      last = 0;
    for (let i = 0; i < samples; i++) {
      const t = i / rate,
        u = i / samples,
        n = random();
      const speed = 1 + 0.006 * sin(8 * t + 0.3 * pass),
        f = e.pitch;
      phase += (tau * f * speed) / rate;
      smooth += Math.min(0.9, (tau * f) / rate) * (n - smooth);
      band += Math.min(0.85, (tau * f * 2.6) / rate) * (n - band);
      const grit = band - smooth;
      const attack = Math.min(1, t / 0.006),
        tail = Math.min(1, (1 - u) * 22);
      let v = 0;
      if (modes[e.instrument]) {
        const ratios = modes[e.instrument];
        for (let j = 0; j < ratios.length; j++)
          v += (sin(phase * ratios[j]) * exp(-u * (3 + j * 3))) / (1 + j);
        v = v * 0.6 + grit * exp(-t * 80) * 2;
      } else {
        const swell = Math.pow(Math.max(0, sin(Math.PI * u)), 0.72);
        switch (e.instrument) {
          case 'drop':
            v = sin(phase * (1 + 0.52 * u)) * exp(-9 * u) + grit * exp(-22 * u);
            break;
          case 'ping':
            v = sin(phase + 0.4 * sin(1.5 * phase)) * exp(-4 * u) * Math.min(1, t / 0.035);
            break;
          case 'horn':
          case 'reed':
          case 'bow':
            v =
              (sin(phase + 0.42 * sin(phase * 2 + 0.14 * sin(27 * t))) +
                0.32 * sin(3 * phase) +
                grit * 0.42) *
              swell *
              0.67;
            if (e.instrument === 'horn') v *= 0.68 + 0.32 * Math.min(1, t / 0.48);
            if (e.instrument === 'bow') v *= 0.67 + 0.33 * sin(33 * t + sin(4 * t));
            break;
          case 'key':
          case 'snap':
          case 'relay':
            v = (2.7 * grit + 0.42 * sin(phase)) * exp(-t * 83);
            if (t > 0.039) v += (2.8 * grit + 0.36 * sin(phase * 0.71)) * exp(-(t - 0.039) * 112);
            break;
          case 'paper':
          case 'seed':
          case 'chain':
            v =
              (3.9 * grit + 0.3 * sin(2.34 * phase)) *
              swell *
              Math.pow(0.5 + 0.5 * sin(t * (e.instrument === 'seed' ? 107 : 59) + 3 * sin(t * 18)), 3);
            break;
          case 'starter':
          case 'spool':
          case 'buzzer':
            v =
              (sin(phase + 0.8 * sin(phase * 2)) * 0.49 + grit * 1.8) *
              swell *
              (0.25 +
                0.75 *
                  Math.pow(0.5 + 0.5 * sin(t * (e.instrument === 'starter' ? 46 : 129) + 16 * u * u), 2));
            break;
          case 'radio':
          case 'carrier':
          case 'monitor':
          case 'game':
            v =
              (e.instrument === 'radio'
                ? grit * 3 + 0.22 * sin(phase)
                : 0.65 * sin(phase + 0.45 * sin(2 * phase))) * Math.min(1, t / 0.025, (1 - u) * 9);
            if (e.instrument === 'game') v *= 0.66 + 0.33 * sin(84 * t);
            break;
          case 'bubble':
          case 'drain':
            v =
              (sin(phase + 0.75 * sin(t * 32)) + grit) *
              Math.pow(0.5 + 0.5 * sin(t * 22 + 3.2 * sin(t * 6)), 4) *
              swell;
            break;
          case 'rub':
          case 'hinge':
          case 'grind':
          case 'slide':
          case 'squeak':
          case 'spring':
            v = (sin(phase + 0.9 * sin(1.51 * phase) + 2.5 * sin(6 * t)) * 0.4 + grit * 3) * swell;
            v *= 0.4 + 0.6 * Math.abs(sin(t * (e.instrument === 'grind' ? 63 : 21) + 2 * sin(t * 4)));
            break;
          case 'bounce':
            v = sin(phase + 4 * (1 - exp(-t * 45))) * exp(-7 * u) + 2 * grit * exp(-t * 95);
            break;
          case 'breath':
          case 'sail':
          case 'hiss':
          case 'air':
          case 'splash':
          case 'pour':
            v = (3.8 * grit + 0.16 * sin(phase + sin(t * 8))) * swell;
            if (e.instrument === 'pour' || e.instrument === 'splash')
              v *= 0.65 + 0.35 * sin(113 * t + 2 * sin(31 * t));
            break;
          default:
            throw Error('Unknown instrument ' + e.instrument);
        }
      }
      v *= e.gain * attack * tail * 0.54;
      // Short, cross-channel early reflections and a darker, more distant return.
      last += 0.19 * (v - last);
      const j = (start + i) % count;
      channels[0][j] += l * v;
      channels[1][j] += r * v;
      channels[0][(j + spacing) % count] += r * last * echo;
      channels[1][(j + spacing + 283) % count] += l * last * echo;
      channels[0][(j + spacing * 3) % count] += l * last * echo * 0.38;
      channels[1][(j + spacing * 3 + 419) % count] += r * last * echo * 0.38;
    }
  }
  for (const pass of [0, 1]) for (const event of events) addEvent(event, pass);
  let peak = 0;
  for (const ch of channels) for (const s of ch) peak = Math.max(peak, Math.abs(s));
  const scale = 0.77 / Math.max(0.66, peak),
    pcm = Buffer.alloc(count * 4);
  for (let i = 0; i < count; i++)
    for (let c = 0; c < 2; c++) pcm.writeInt16LE(Math.round(channels[c][i] * scale * 32767), (i * 2 + c) * 2);
  const out = 'public/ambience/' + id + '.mp3';
  const proc = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      's16le',
      '-ar',
      String(rate),
      '-ac',
      '2',
      '-i',
      'pipe:0',
      '-codec:a',
      'libmp3lame',
      '-q:a',
      '5',
      out,
    ],
    { input: pcm },
  );
  if (proc.status !== 0) throw Error(proc.error?.message ?? proc.stderr.toString());
}
mkdirSync('public/ambience', { recursive: true });
for (const id of process.argv[2] ? [process.argv[2]] : Object.keys(levelAtmospheres)) render(id, scores[id]);
