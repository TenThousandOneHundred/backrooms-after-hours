// Stage audio is local to each listener. Phase comes from game time, including host
// snapshots on a late join. Cancelling a fetch cannot cancel an in-flight decode.
export class StageLoop {
  private request = new AbortController();
  private buffer?: AudioBuffer;
  private voice?: { source: AudioBufferSourceNode; level: GainNode; zero: number };
  private ducked = false;

  private context: AudioContext;
  private destination: AudioNode;
  private period: number;

  constructor(context: AudioContext, destination: AudioNode, url: string, period: number) {
    this.context = context;
    this.destination = destination;
    this.period = period;
    void this.load(url);
  }
  private async load(url: string) {
    try {
      const response = await fetch(url, { signal: this.request.signal });
      if (!response.ok) return;
      const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
      if (!this.request.signal.aborted) this.buffer = buffer;
    } catch {
      // The procedural room tone stays audible if a stage recording is unavailable.
    }
  }
  sync(time: number, danger: number) {
    if (!this.buffer || this.context.state !== 'running') return false;
    const now = this.context.currentTime;
    const length = Math.min(this.period * 2, this.buffer.duration);
    const offset = time % length;
    if (this.voice) {
      const drift = Math.abs((((now - this.voice.zero - offset) % length) + length) % length);
      if (Math.min(drift, length - drift) > 0.55) this.stop();
    }
    const duck = danger > 0.28;
    const volume = duck ? 0.32 : 0.66;
    if (!this.voice) {
      const source = this.context.createBufferSource(),
        level = this.context.createGain();
      source.buffer = this.buffer;
      source.loop = true;
      source.loopEnd = length;
      level.gain.setValueAtTime(0, now);
      level.gain.setTargetAtTime(volume, now, 0.07);
      source.connect(level);
      level.connect(this.destination);
      source.onended = () => {
        source.disconnect();
        level.disconnect();
      };
      source.start(now, offset);
      this.voice = { source, level, zero: now - offset };
    } else if (duck !== this.ducked) {
      this.voice.level.gain.setTargetAtTime(volume, now, duck ? 0.12 : 0.55);
    }
    this.ducked = duck;
    return true;
  }
  stop() {
    if (!this.voice) return;
    const { source, level } = this.voice;
    this.voice = undefined;
    const now = this.context.currentTime;
    level.gain.cancelScheduledValues(now);
    level.gain.setTargetAtTime(0, now, 0.012);
    source.stop(now + 0.06);
  }
  dispose() {
    this.request.abort();
    this.stop();
    this.buffer = undefined;
  }
}
