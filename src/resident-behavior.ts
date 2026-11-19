export type ResidentKind = 'veil' | 'bellwether';
export type ResidentSite = { kind: ResidentKind; x: number; z: number };

export class ResidentBehavior {
  readonly kind: ResidentKind;
  phase: 'idle' | 'warning' | 'listening' | 'quiet' = 'idle';
  time = 0;
  exposure = 0;

  constructor(kind: ResidentKind) { this.kind = kind; }

  update(dt: number, nearby: boolean, watching: boolean, noisy: boolean) {
    if (!nearby) {
      this.phase = 'idle';
      this.time = this.exposure = 0;
      return;
    }
    if (this.kind === 'veil') {
      this.exposure = Math.max(0, this.exposure + dt * (watching ? 1 : -3.5));
      const waking = this.phase === 'idle' && this.exposure >= 0.25;
      this.phase = this.exposure >= 0.25 ? 'warning' : 'idle';
      if (this.exposure >= 1.9) return 'capture';
      if (waking) return 'warn';
      return;
    }
    this.time += dt;
    if (this.phase === 'idle' || (this.phase === 'quiet' && this.time >= 6)) {
      this.phase = 'warning';
      this.time = this.exposure = 0;
      return 'warn';
    }
    if (this.phase === 'warning' && this.time >= 1.5) {
      this.phase = 'listening';
      this.time = 0;
      return 'listen';
    }
    if (this.phase === 'listening') {
      if (noisy) this.exposure += dt;
      if (this.exposure >= 0.48) return 'capture';
      if (this.time >= 1.65) {
        this.phase = 'quiet';
        this.time = this.exposure = 0;
        return 'toll';
      }
    }
  }
}
