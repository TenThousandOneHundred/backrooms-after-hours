// The capture graph band-limits the microphone before downsampling.
class RadioEncoder extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.rate = options.processorOptions.rate;
    this.frame = new Uint8Array(options.processorOptions.samples);
    this.phase = this.index = this.position = 0;
    this.active = true;
    this.port.onmessage = () => {
      this.active = false;
    };
  }
  process(inputs) {
    if (!this.active) return false;
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (const sample of input) {
      this.phase += this.rate;
      if (this.phase < sampleRate) continue;
      this.phase -= sampleRate;
      const seconds = this.position++ / this.rate;
      const chirp = seconds < 0.045 ? 0.17 * Math.exp(-seconds * 75) * Math.sin(seconds * 7100) : 0;
      this.frame[this.index++] = Math.min(255, Math.max(0, Math.round(128 + 127 * (sample + chirp))));
      if (this.index === this.frame.length) {
        this.port.postMessage(this.frame, [this.frame.buffer]);
        this.frame = new Uint8Array(this.index);
        this.index = 0;
      }
    }
    return true;
  }
}
registerProcessor('walkie-talkie', RadioEncoder);
