const limit = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class Soundscape {
  private context?: AudioContext;
  private master?: GainNode;
  private bed?: GainNode;
  private bg: AudioScheduledSourceNode[] = [];
  private buffers = new Map<string, AudioBuffer>();
  private theme = '';
  private volume = 0.65;
  private nextDetail = 3;
  private stepSide = -1;
  private closed = false;
  private paused = false;

  unlock() {
    if (this.closed) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume * 0.52;
        this.master.connect(this.context.destination);
        this.ambience(this.theme);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch {
      /* Audio is optional on devices that disable Web Audio. */
    }
  }
  setVolume(v: number) {
    this.volume = limit(v, 0, 1);
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(this.volume * 0.52 * (this.paused ? 0.22 : 1), this.context.currentTime, 0.045);
  }
  private noise(color: string): AudioBuffer {
    const cached = this.buffers.get(color);
    if (cached) return cached;
    const ac = this.context!;
    const buffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const samples = buffer.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < samples.length; i++) {
      const white = Math.random() * 2 - 1;
      prev = (prev + 0.045 * white) / 1.02;
      samples[i] = color === 'brown' ? prev * 4.5 : white;
    }
    this.buffers.set(color, buffer);
    return buffer;
  }
  private sound(
    hz: number,
    end: number,
    duration: number,
    volume: number,
    pan = 0,
    shape: OscillatorType | 'noise' = 'sine',
    delay = 0,
  ) {
    const ac = this.context;
    if (!ac || !this.master || this.volume === 0 || ac.state !== 'running') return;
    const at = ac.currentTime + delay;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.00001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.00001, at + duration);
    const spatial = ac.createStereoPanner();
    spatial.pan.value = limit(pan, -1, 1);
    gain.connect(spatial);
    spatial.connect(this.master);
    let source: OscillatorNode | AudioBufferSourceNode;
    let filter: BiquadFilterNode | undefined;
    if (shape === 'noise') {
      source = ac.createBufferSource();
      source.buffer = this.noise('white');
      source.loop = true;
      filter = ac.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 0.7;
      filter.frequency.setValueAtTime(hz, at);
      filter.frequency.exponentialRampToValueAtTime(Math.max(30, end), at + duration);
      source.connect(filter);
      filter.connect(gain);
    } else {
      source = ac.createOscillator();
      source.type = shape;
      source.frequency.setValueAtTime(hz, at);
      source.frequency.exponentialRampToValueAtTime(Math.max(20, end), at + duration);
      source.connect(gain);
    }
    source.onended = () => {
      source.disconnect();
      filter?.disconnect();
      gain.disconnect();
      spatial.disconnect();
    };
    source.start(at);
    source.stop(at + duration + 0.02);
  }
  ambience(theme: string) {
    this.theme = theme;
    const ac = this.context;
    if (!ac || !this.master) return;
    for (const s of this.bg) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
      s.disconnect();
    }
    this.bg = [];
    this.bed?.disconnect();
    this.bed = ac.createGain();
    this.bed.connect(this.master);
    const outside = /suburb|outside|town|field|grass|farm|village|forest|overgrowth|sky/.test(theme);
    const wet = /water|depth|ocean|sea|pool|cave|sewer/.test(theme);
    const industrial = /electric|pipe|power|bunker|service|industrial|station/.test(theme);
    const fundamental = outside ? 43 : wet ? 62 : industrial ? 49.6 : 59.9;
    for (const [mult, g] of [
      [1, 0.052],
      [2, 0.024],
      [3.016, 0.009],
      [5, 0.003],
    ]) {
      const src = ac.createOscillator(),
        level = ac.createGain();
      src.frequency.value = fundamental * mult;
      src.type = mult === 1 ? 'sine' : 'triangle';
      level.gain.value = g;
      src.connect(level);
      level.connect(this.bed);
      src.start();
      this.bg.push(src);
    }
    const wind = ac.createBufferSource();
    wind.buffer = this.noise('brown');
    wind.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = outside ? 1500 : wet ? 640 : 430;
    const gain = ac.createGain();
    gain.gain.value = outside ? 0.16 : wet ? 0.12 : 0.045;
    wind.connect(filter);
    filter.connect(gain);
    gain.connect(this.bed);
    wind.start();
    this.bg.push(wind);
    this.nextDetail = 3.5;
  }
  step(fast: boolean, crouch: boolean, wet: boolean) {
    this.stepSide *= -1;
    const level = crouch ? 0.055 : fast ? 0.19 : 0.13;
    this.sound(wet ? 290 : 125, wet ? 88 : 53, wet ? 0.24 : 0.14, level, this.stepSide * 0.16);
    this.sound(wet ? 2300 : 780, wet ? 510 : 270, 0.115, level * 0.7, this.stepSide * 0.18, 'noise');
  }
  tick(dt: number, danger: number, pan: number, farmerActive = false) {
    this.nextDetail -= dt;
    if (this.nextDetail > 0) return;
    if (farmerActive) {
      this.sound(59, 116 + 38 * danger, 0.65, 0.025 + 0.13 * danger, pan, 'sawtooth');
      this.sound(129, 58, 0.5, 0.015 + 0.08 * danger, pan, 'sawtooth', 0.42);
    }
    if (danger > 0.28) {
      this.sound(71, 38, 0.22, 0.06 + danger * 0.18, pan * 0.3);
      this.sound(62, 32, 0.2, 0.045 + danger * 0.1, pan * 0.3, 'sine', 0.18);
      if (danger > 0.6) this.sound(480, 125, 0.42, 0.042 * danger, pan, 'noise');
      this.nextDetail = 1.18 - danger * 0.52;
    } else {
      const side = Math.random() * 1.7 - 0.85;
      if (/pool|water|cave|sea|ocean|depth/.test(this.theme)) {
        this.sound(1400, 780, 0.36, 0.065, side);
        this.sound(920, 600, 0.38, 0.019, -side, 'sine', 0.24);
      } else if (/suburb|outside|town|field|grass|forest|overgrowth/.test(this.theme)) {
        this.sound(490, 380, 0.5, 0.035, side, 'noise');
      } else {
        this.sound(178, 111, 0.42, 0.035, side, 'triangle');
        this.sound(940, 360, 0.35, 0.027, side, 'noise');
      }
      this.nextDetail = 3.2 + Math.random() * 5;
    }
  }
  event(kind: 'use' | 'locked' | 'exit' | 'scan' | 'death' | 'pickup' | 'click') {
    if (kind === 'death') {
      this.sound(280, 34, 0.8, 0.4, 0, 'sawtooth');
      this.sound(1300, 80, 0.62, 0.26, 0, 'noise');
    } else if (kind === 'locked') {
      this.sound(144, 93, 0.15, 0.1, 0, 'square');
    } else if (kind === 'scan') {
      this.sound(340, 1720, 0.23, 0.1);
      this.sound(800, 280, 0.52, 0.068, 0, 'sine', 0.18);
    } else if (kind === 'exit') {
      this.sound(170, 73, 0.55, 0.13);
      this.sound(540, 180, 0.4, 0.11, 0.2, 'noise');
    } else if (kind === 'pickup') {
      this.sound(410, 660, 0.12, 0.08);
      this.sound(600, 790, 0.16, 0.035, 0, 'sine', 0.075);
    } else {
      this.sound(610, 170, 0.075, 0.1, 0.08, 'noise');
    }
  }
  residentCue(cue: 'harmony' | 'knock' | 'listen' | 'toll', pan: number) {
    if (cue === 'harmony') {
      for (const pitch of [211, 267, 315]) this.sound(pitch, pitch * 1.09, 1.1, .12, pan, 'sine');
    } else if (cue === 'knock') {
      for (const delay of [0, .39]) this.sound(175, 48, .19, .43, pan, 'triangle', delay);
    } else if (cue === 'listen') {
      this.sound(1480, 1010, .34, .19, pan, 'noise');
    } else {
      this.sound(308, 293, 1.45, .34, pan, 'sine');
      this.sound(718, 655, .83, .10, pan, 'triangle');
    }
  }
  inhale() {
    this.sound(340, 2100, 0.54, 0.28, -0.15, 'noise');
    this.sound(68, 136, 0.58, 0.20, 0.12, 'sawtooth');
    this.sound(140, 39, 0.23, 0.33, 0, 'triangle', 0.58);
  }
  scrape(pan: number) {
    for (const [delay, pitch] of [[0, 1480], [0.27, 1270], [0.84, 1710]]) {
      this.sound(pitch, pitch * 0.31, 0.23, 0.22, pan, 'noise', delay);
      this.sound(pitch * 0.22, 103, 0.19, 0.06, pan, 'sawtooth', delay);
    }
  }
  telephone(pan: number, strength: number) {
    for (const delay of [0, 0.24]) {
      this.sound(445, 438, 0.16, 0.19 * strength, pan, 'square', delay);
      this.sound(533, 516, 0.17, 0.11 * strength, pan, 'triangle', delay);
    }
  }
  alarm() {
    for (let i = 0; i < 10; i++) {
      this.sound(770, 650, 0.35, 0.14, 0.78, 'triangle', i * 1.4);
      this.sound(820, 730, 0.38, 0.06, 0.58, 'sine', i * 1.4 + 0.18);
    }
  }
  pause(paused: boolean) {
    this.paused = paused;
    if (!this.master || !this.context) return;
    this.master.gain.setTargetAtTime(
      this.volume * 0.52 * (paused ? 0.22 : 1),
      this.context.currentTime,
      0.08,
    );
  }
  dispose() {
    this.closed = true;
    for (const s of this.bg) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
      s.disconnect();
    }
    this.master?.disconnect();
    if (this.context) void this.context.close().catch(() => {});
  }
}
