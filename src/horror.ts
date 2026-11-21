import './horror.css';
import { catchShot } from './catch-shots';

export type Haunt = 'flicker' | 'steps' | 'breath' | 'silhouette';
export type Attack = { kind: string; lethal: boolean; caught?: boolean; frame?: string };
const plates: Record<string, string> = { bacteria: 'wire', hound: 'hound', smiler: 'smiler' };
const base = import.meta.env.BASE_URL + 'encounters/';
const creatureSamples = new Map<string, HTMLImageElement>();
const clamp = (v: number) => Math.max(0, Math.min(1, v));

export class Horror {
  private audio?: AudioContext;
  private output?: GainNode;
  private noise?: AudioBuffer;
  private volume = 0.65;
  private nextHeartbeat = 0;
  private cueTimer = 0;
  private attackTimer = 0;
  private prepared = new Map<string, { controller: AbortController; bytes: Promise<Blob | undefined> }>();
  private playing?: HTMLVideoElement;
  private movieUrl?: string;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private view = document.createElement('div');
  private impact = document.createElement('div');
  private curtain = document.createElement('div');

  constructor() {
    this.view.id = 'peripheral';
    this.impact.id = 'capture-impact';
    this.curtain.className = 'attack-image';
    this.view.setAttribute('aria-hidden', 'true');
    this.impact.setAttribute('aria-hidden', 'true');
    this.impact.append(this.curtain);
    document.body.append(this.view, this.impact);
  }

  preload() {
    for (const name of Object.values(plates)) {
      if (creatureSamples.has(name)) continue;
      const img = new Image();
      img.decoding = 'async';
      img.src = base + name + '.webp';
      creatureSamples.set(name, img);
    }
  }
  unlock() {
    try {
      if (!this.audio) {
        const ctx = new AudioContext();
        this.audio = ctx;
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -16;
        compressor.knee.value = 9;
        compressor.ratio.value = 7;
        compressor.connect(ctx.destination);
        this.output = ctx.createGain();
        this.output.gain.value = this.volume * 0.65;
        this.output.connect(compressor);
        this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const samples = this.noise.getChannelData(0);
        let previous = 0;
        for (let i = 0; i < samples.length; i++) {
          previous = 0.42 * previous + 0.58 * (2 * Math.random() - 1);
          samples[i] = previous;
        }
      }
      if (this.audio.state === 'suspended') void this.audio.resume().catch(() => {});
    } catch {
      /* The visual encounter still plays if audio is unavailable. */
    }
  }
  setVolume(volume: number) {
    this.volume = clamp(volume);
    if (this.audio && this.output)
      this.output.gain.setTargetAtTime(this.volume * 0.65, this.audio.currentTime, 0.03);
  }
  private voice(
    at: number,
    duration: number,
    frequency: number,
    end: number,
    amp: number,
    pan: number,
    wave: OscillatorType | 'noise',
    attack = 0.025,
  ) {
    const ctx = this.audio,
      output = this.output;
    if (!ctx || !output || ctx.state !== 'running' || this.volume <= 0) return;
    const start = ctx.currentTime + at;
    const source = wave === 'noise' ? ctx.createBufferSource() : ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    filter.type = wave === 'noise' ? 'bandpass' : 'lowpass';
    filter.Q.value = wave === 'noise' ? 1.35 : 0.55;
    if (source instanceof OscillatorNode) {
      source.type = wave as OscillatorType;
      source.frequency.setValueAtTime(frequency, start);
      source.frequency.exponentialRampToValueAtTime(end, start + duration);
      filter.frequency.value = wave === 'sawtooth' ? 1200 : 2400;
    } else {
      source.buffer = this.noise!;
      source.loop = true;
      filter.frequency.setValueAtTime(frequency, start);
      filter.frequency.exponentialRampToValueAtTime(end, start + duration);
    }
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, amp),
      start + Math.min(attack, duration * 0.4),
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    const stereo = ctx.createStereoPanner();
    stereo.pan.value = Math.max(-1, Math.min(1, pan));
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(stereo);
    stereo.connect(output);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
      stereo.disconnect();
    };
    source.start(start);
    source.stop(start + duration + 0.02);
  }
  dread(intensity: number) {
    this.view.style.setProperty('--danger', String(clamp(intensity)));
    const now = performance.now();
    if (intensity < 0.3 || now < this.nextHeartbeat) return;
    this.nextHeartbeat = now + Math.max(420, 960 - intensity * 470);
    this.voice(0, 0.22, 62, 32, 0.12 + intensity * 0.17, -0.05, 'sine');
    this.voice(0.16, 0.19, 57, 33, 0.09 + intensity * 0.13, 0.05, 'sine');
  }
  haunt(event: Haunt) {
    this.view.dataset.cue = event;
    window.clearTimeout(this.cueTimer);
    this.cueTimer = window.setTimeout(() => delete this.view.dataset.cue, 1050);
    const side = Math.random() < 0.5 ? -0.86 : 0.86;
    if (event === 'steps') {
      [0, 0.53, 1.27].forEach((at, i) => {
        this.voice(at, 0.14, 95 - i * 3, 40, 0.25, side * (1 - i * 0.18), 'triangle');
        this.voice(at + 0.03, 0.21, 530, 156, 0.13, side, 'noise');
      });
    } else if (event === 'breath') {
      this.voice(0.02, 0.69, 820, 1820, 0.2, side, 'noise', 0.25);
      this.voice(0.79, 1.11, 1500, 450, 0.24, side * 0.72, 'noise', 0.33);
    } else if (event === 'flicker') {
      this.voice(0, 0.2, 110, 44, 0.17, side, 'sawtooth');
      this.voice(0.13, 0.35, 2200, 440, 0.13, side, 'noise');
    } else {
      this.voice(0.07, 1.2, 91, 46, 0.21, side, 'triangle', 0.17);
      this.voice(0.32, 0.48, 390, 820, 0.12, side, 'noise', 0.1);
    }
  }
  prepareCatches(kinds: string[]) {
    const needed = new Set(this.reduced.matches ? [] : kinds.filter(kind => catchShot(kind)));
    for (const [kind, source] of this.prepared) {
      if (needed.has(kind)) continue;
      source.controller.abort();
      this.prepared.delete(kind);
    }
    for (const kind of needed) {
      if (this.prepared.has(kind)) continue;
      // Buffer compressed bytes. A lobby or corridor needs no idle video decoders.
      const controller = new AbortController();
      const bytes = fetch(base + 'catches/' + kind + '.mp4', {signal: controller.signal, priority:'low'})
        .then(response => response.ok ? response.blob() : undefined)
        .catch(() => undefined);
      this.prepared.set(kind, { controller, bytes });
    }
  }
  get catchVisible() { return this.playing !== undefined; }
  stopScare() {
    clearTimeout(this.attackTimer);
    this.impact.className = '';
    this.curtain.style.backgroundImage = '';
    if (this.playing) {
      const video = this.playing;
      this.playing = undefined;
      video.onended = video.onplaying = null;
      video.remove();
      video.pause();
      video.removeAttribute('src');
      video.load();
      if (this.movieUrl) URL.revokeObjectURL(this.movieUrl);
      this.movieUrl = undefined;
    }
  }
  private playCatch(kind: string) {
    const shot = catchShot(kind);
    if (!shot) return false;
    this.stopScare();
    const video = document.createElement('video');
    video.className = 'catch-film';
    video.muted = video.playsInline = true;
    video.setAttribute('aria-hidden','true');
    video.dataset.kind = kind;
    video.poster = base + 'catches/' + kind + '.webp';
    this.playing = video;
    this.impact.dataset.kind = kind;
    this.impact.className = 'caught-film';
    this.curtain.style.backgroundImage = 'url("' + video.poster + '")';
    if (!this.reduced.matches) {
      this.impact.append(video);
      video.onplaying = () => {
        if (this.playing !== video) return;
        clearTimeout(this.attackTimer);
        const remaining = Number.isFinite(video.duration) ? video.duration - video.currentTime : 1.6;
        this.attackTimer = window.setTimeout(() => this.stopScare(), 350 + remaining * 1000);
      };
      video.onended = () => { if (this.playing === video) this.stopScare(); };
      const source = this.prepared.get(kind);
      void Promise.resolve(source?.bytes).then(bytes => {
        if (this.playing !== video) return;
        if (bytes) this.movieUrl = URL.createObjectURL(bytes);
        video.src = this.movieUrl ?? base + 'catches/' + kind + '.mp4';
        void video.play().catch(() => { if (this.playing === video) video.remove(); });
      });
    }
    // A still remains available on a cold connection and for reduced motion.
    // A stalled decoder must always yield to the death or spectator screen.
    this.attackTimer = window.setTimeout(() => this.stopScare(), this.reduced.matches ? 750 : 1850);
    const [, , side, , , , style, pitch, impactFrame] = shot;
    const at = impactFrame / 24, pan = side / 100;
    this.voice(0, at, pitch * .76, pitch, .18, pan, style === 'water' ? 'sine' : 'triangle', .08);
    if (style === 'dive' || style === 'lock')
      this.voice(at * .55, at * .44, pitch * 2.3, pitch * 1.4, .18, -pan, 'sine');
    this.voice(at, .32, style === 'water' ? 68 : 104, 29, .66, 0, 'sine', .009);
    this.voice(at + .012, .43, pitch * 6.4, pitch * 1.12, .55, -pan, 'noise', .012);
    this.voice(at + .05, .46, pitch * 1.45, pitch * .61, .26, pan, style === 'blackout' ? 'sine' : 'sawtooth');
    return true;
  }
  scare(hit: Attack) {
    const kind = hit.kind.toLowerCase();
    if (hit.caught && this.playCatch(kind)) return;
    if (this.playing) return;
    const plate = plates[kind];
    const frame = hit.frame ?? (plate ? base + plate + '.webp' : undefined);
    const duration = hit.lethal ? 1080 : 370;
    clearTimeout(this.attackTimer);
    this.impact.className = '';
    this.impact.removeAttribute('data-lethal');
    this.curtain.style.backgroundImage = frame ? 'url("' + frame + '")' : 'none';
    // Restart a lunge even if a real capture immediately follows a near miss.
    void this.impact.offsetWidth;
    this.impact.style.setProperty('--strike-time', duration + 'ms');
    this.impact.dataset.lethal = String(hit.lethal);
    this.impact.dataset.portrait = String(Boolean(frame));
    this.impact.className = 'striking';
    this.attackTimer = window.setTimeout(() => {
      this.impact.className = '';
      this.curtain.style.backgroundImage = '';
    }, duration);
    const gain = hit.lethal ? 1 : 0.58;
    this.voice(0, 0.3, 113, 31, 0.71 * gain, 0, 'sine', 0.009);
    if (kind === 'smiler') {
      this.voice(0.022, 0.65, 420, 710, 0.31 * gain, -0.27, 'sawtooth');
      this.voice(0.033, 0.61, 431, 624, 0.21 * gain, 0.28, 'triangle');
      this.voice(0.07, 0.72, 2500, 650, 0.58 * gain, 0.12, 'noise');
    } else if (kind === 'hound') {
      this.voice(0.02, 0.56, 156, 49, 0.46 * gain, -0.25, 'sawtooth');
      this.voice(0.035, 0.54, 980, 220, 0.85 * gain, 0.12, 'noise');
    } else {
      this.voice(0.008, 0.72, 207, 45, 0.37 * gain, 0.13, 'sawtooth');
      this.voice(0.028, 0.67, 2850, 470, 0.79 * gain, -0.23, 'noise');
      this.voice(0.13, 0.52, 780, 142, 0.22 * gain, 0.29, 'triangle');
    }
    if (hit.lethal) this.voice(0.49, 0.53, 138, 41, 0.23, 0, 'sine');
  }
  quiet() {
    this.view.style.setProperty('--danger', '0');
    delete this.view.dataset.cue;
    clearTimeout(this.cueTimer);
  }
  clear() {
    this.quiet();
    this.stopScare();
    this.prepareCatches([]);
  }
}
