// Map the waveform's RMS level to a game volume. Ignore DC offset and the quiet noise floor.
export function voiceVolume(samples: Float32Array) {
  let sum = 0, squares = 0;
  for (const sample of samples) {
    sum += sample;
    squares += sample * sample;
  }
  const power = squares / samples.length - (sum / samples.length) ** 2;
  if (power <= 0) return 0;
  return Math.max(0, Math.min(1, (10 * Math.log10(power) + 48) / 30));
}

export class VoiceInput {
  state: 'off' | 'starting' | 'live' = 'off';
  private request = 0;
  private context?: AudioContext;
  private stream?: MediaStream;
  private analyser?: AnalyserNode;
  private samples = new Float32Array(1024);
  private volume = 0;

  private onError: (message: string) => void;

  constructor(onError: (message: string) => void) { this.onError = onError; }

  async start() {
    if (this.state !== 'off') return;
    const request = ++this.request;
    this.state = 'starting';
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error('Microphone input needs a browser with microphone support on HTTPS or localhost.');
      const context = new AudioContext();
      this.context = context;
      const capture = navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }, video: false,
      }).then(stream => {
        if (this.request !== request) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        this.stream = stream;
        const track = stream.getAudioTracks()[0];
        if (!track || track.readyState !== 'live') throw new Error('No active microphone was found.');
        track.onended = () => {
          if (this.request === request) this.fail('Microphone disconnected. Press M to reconnect.');
        };
        const analyser = context.createAnalyser();
        analyser.fftSize = this.samples.length;
        context.createMediaStreamSource(stream).connect(analyser);
        this.analyser = analyser;
      });
      await Promise.all([capture, context.resume()]);
      if (this.request === request) this.state = 'live';
    } catch (error) {
      if (this.request !== request) return;
      const name = error instanceof Error ? error.name : '';
      this.fail(name === 'NotAllowedError' ? 'Microphone access denied. Allow it in site permissions and press M to retry.'
        : name === 'NotFoundError' ? 'No microphone found. Connect one and press M to retry.'
        : error instanceof Error ? error.message : 'Microphone unavailable. Press M to retry.');
    }
  }

  read(dt: number) {
    if (this.state !== 'live' || !this.analyser || this.context?.state !== 'running') return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    const target = voiceVolume(this.samples);
    this.volume += (target - this.volume) * (1 - Math.exp(-dt * (target > this.volume ? 22 : 10)));
    return this.volume;
  }

  stop() {
    this.request++;
    this.state = 'off';
    this.volume = 0;
    this.analyser?.disconnect();
    this.analyser = undefined;
    for (const track of this.stream?.getTracks() ?? []) {
      track.onended = null;
      track.stop();
    }
    this.stream = undefined;
    if (this.context) void this.context.close().catch(() => {});
    this.context = undefined;
  }

  private fail(message: string) {
    this.stop();
    this.onError(message);
  }
}
