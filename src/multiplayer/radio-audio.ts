import { radioRate, radioSamples } from './radio-packet';

export class RadioAudio {
  private stream?: MediaStream;
  private encoder?: AudioWorkletNode;
  private capture: AudioNode[] = [];
  private module?: Promise<void>;
  private generation = 0;
  private output?: GainNode;
  private playing = new Map<number, Set<AudioBufferSourceNode>>();
  private nextStart = new Map<number, number>();
  private context: () => AudioContext | undefined;
  private send: (packet: string) => void;
  constructor(context: () => AudioContext | undefined, send: (packet: string) => void) {
    this.context = context;
    this.send = send;
  }

  get transmitting() {
    return !!this.encoder;
  }
  get receiving() {
    return [...this.playing.keys()];
  }

  async setStream(stream?: MediaStream) {
    if (this.stream === stream) return;
    const generation = ++this.generation;
    this.stream = stream;
    if (this.encoder) {
      this.encoder.port.onmessage = null;
      this.encoder.port.postMessage('stop');
      this.encoder.port.close();
      this.encoder = undefined;
    }
    for (const node of this.capture) node.disconnect();
    this.capture = [];
    if (!stream) return;
    const ctx = this.context();
    if (!ctx?.audioWorklet) throw new Error('Radio audio is unavailable in this browser.');
    this.module ??= ctx.audioWorklet
      .addModule(new URL('./radio-worklet.js', import.meta.url).href)
      .catch((error) => {
        this.module = undefined;
        throw error;
      });
    await this.module;
    if (this.generation !== generation || !stream.active) return;
    const source = ctx.createMediaStreamSource(stream);
    const high = ctx.createBiquadFilter(),
      low = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 310;
    low.type = 'lowpass';
    low.frequency.value = 2900;
    const encoder = new AudioWorkletNode(ctx, 'walkie-talkie', {
      numberOfOutputs: 0,
      channelCount: 1,
      channelCountMode: 'explicit',
      processorOptions: { rate: radioRate, samples: radioSamples },
    });
    this.encoder = encoder;
    this.capture = [source, high, low, encoder];
    encoder.port.onmessage = ({ data }: MessageEvent<Uint8Array>) => {
      if (generation === this.generation) this.send(btoa(String.fromCharCode(...data)));
    };
    source.connect(high).connect(low).connect(encoder);
  }

  play(slot: number, pcm: Float32Array, volume: number) {
    const ctx = this.context();
    if (ctx?.state !== 'running') return;
    if (!this.output) {
      this.output = ctx.createGain();
      this.output.connect(ctx.destination);
    }
    this.setVolume(volume);
    // Bound the jitter buffer so a delayed data channel cannot replay old speech for seconds.
    const now = ctx.currentTime,
      next = this.nextStart.get(slot) ?? 0;
    if (next > now + 0.22) return;
    const buffer = ctx.createBuffer(1, pcm.length, radioRate);
    buffer.getChannelData(0).set(pcm);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    const sources = this.playing.get(slot) ?? new Set<AudioBufferSourceNode>();
    this.playing.set(slot, sources);
    sources.add(source);
    source.onended = () => {
      source.disconnect();
      sources.delete(source);
      if (!sources.size && this.playing.get(slot) === sources) {
        this.playing.delete(slot);
        this.nextStart.delete(slot);
      }
    };
    const start = next < now ? now + 0.045 : next;
    source.start(start);
    this.nextStart.set(slot, start + buffer.duration);
  }
  setVolume(volume: number) {
    if (this.output) this.output.gain.value = volume;
  }
  silence(slot?: number) {
    for (const [id, sources] of this.playing) {
      if (slot !== undefined && slot !== id) continue;
      for (const source of sources) {
        source.stop();
        source.disconnect();
      }
      this.playing.delete(id);
      this.nextStart.delete(id);
    }
  }
  reset() {
    void this.setStream();
    this.silence();
    this.output?.disconnect();
    this.output = undefined;
  }
}
