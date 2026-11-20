export type GraphicsQuality = 'auto' | 'high' | 'standard' | 'performance';

export function graphicsQuality(value: unknown): GraphicsQuality {
  return value === 'high' || value === 'standard' || value === 'performance' ? value : 'auto';
}

// Use sustained frame intervals. One asset upload or a tab switch should never change the resolution.
export class AdaptiveResolution {
  scale = 1;
  private sum = 0;
  private frames = 0;
  private slowWindows = 0;
  private fastWindows = 0;

  resetTiming() {
    this.sum = this.frames = this.slowWindows = this.fastWindows = 0;
  }

  sample(ms: number) {
    if (ms <= 0 || ms > 300) {
      this.resetTiming();
      return false;
    }
    this.sum += ms;
    this.frames++;
    if (this.sum < 650) return false;
    const average = this.sum / this.frames;
    this.sum = this.frames = 0;
    this.slowWindows = average > 22 ? this.slowWindows + 1 : 0;
    this.fastWindows = average < 17.8 ? this.fastWindows + 1 : 0;
    const old = this.scale;
    if (this.slowWindows >= 2) this.scale = Math.max(0.625, old - 0.125);
    if (this.fastWindows >= 10) this.scale = Math.min(1, old + 0.125);
    if (this.scale === old) return false;
    this.resetTiming();
    return true;
  }
}

export function pixelRatio(quality: GraphicsQuality, density: number, adaptiveScale: number) {
  if (quality === 'high') return Math.min(density, 1.65);
  if (quality === 'performance') return Math.min(density, 0.75);
  return Math.min(density, 1) * (quality === 'auto' ? adaptiveScale : 1);
}
