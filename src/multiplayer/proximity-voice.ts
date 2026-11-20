import type Peer from 'peerjs';
import type { MediaConnection } from 'peerjs';
import { stages } from '../campaign.ts';
import type { Snapshot } from './expedition';
import { monsterHearing } from './hunt.ts';
import { voiceMix } from './voice-range.ts';

type Mix = ReturnType<typeof voiceMix>;
type Channel = {
  call: MediaConnection;
  deadline: number;
  release?: () => void;
  apply?: (mix: Mix, volume: number) => void;
};
export type VoiceMember = { id: string; slot: number };

// Each speaker places a one-way call. A listener can answer without opening a microphone.
export class ProximityVoice {
  private context?: AudioContext;
  private output?: DynamicsCompressorNode;
  private outputTrim?: GainNode;
  private incoming = new Map<string, Channel>();
  private outgoing = new Map<string, Channel>();
  private nextDial = new Map<string, number>();
  private nearby = new Map<string, Mix>();
  private listenersInRange = new Set<string>();
  private stream?: MediaStream;
  private epoch = -1;
  private volume = 1;
  private listeners = new AbortController();

  get audioContext() { return this.context; }

  private peer: Peer;

  constructor(peer: Peer) {
    this.peer = peer;
    this.unlock();
    const options = { signal: this.listeners.signal, capture: true };
    window.addEventListener('pointerdown', this.unlock, options);
    window.addEventListener('keydown', this.unlock, options);
    peer.on('call', this.answer);
  }

  private unlock = () => {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch {
      /* The room and monster hearing still work without voice playback. */
    }
  };

  setStream(stream?: MediaStream) {
    if (this.stream === stream) return;
    this.stream = stream;
    this.clear(this.outgoing);
    this.nextDial.clear();
    this.dialNearby();
  }

  setVolume(volume: number) {
    this.volume = volume;
    for (const [id, channel] of this.incoming) {
      const mix = this.nearby.get(id);
      if (mix) channel.apply?.(mix, volume);
    }
  }

  update(slot: number, state: Snapshot, members: VoiceMember[], listening: boolean) {
    if (state.epoch !== this.epoch) {
      this.clear(this.outgoing);
      this.clear(this.incoming);
      this.nextDial.clear();
      this.epoch = state.epoch;
    }
    this.nearby.clear();
    this.listenersInRange.clear();
    const self = state.players.find((p) => p.slot === slot);
    if (listening && state.phase === 'playing' && !state.journal.pending && self?.alive) {
      for (const { id, slot: other } of members) {
        if (other === slot) continue;
        const speaker = state.players.find((p) => p.slot === other);
        if (!speaker?.alive) continue;
        const stage = stages[state.journal.stage];
        const mix = voiceMix(stage, self, speaker, slot === state.hunt?.monster ? monsterHearing : 1);
        const reverse = state.hunt && (slot === state.hunt.monster || other === state.hunt.monster)
          ? voiceMix(stage, speaker, self, other === state.hunt.monster ? monsterHearing : 1) : mix;
        // Keep media connected between words so a distant yell is audible immediately.
        if (reverse.inRange) this.listenersInRange.add(id);
        if (mix.inRange) this.nearby.set(id, mix);
      }
    }
    for (const [id, channel] of this.incoming) {
      const mix = this.nearby.get(id);
      if (mix) channel.apply?.(mix, this.volume);
      else this.drop(this.incoming, channel);
    }
    for (const [id, channel] of this.outgoing) if (!this.listenersInRange.has(id)) this.drop(this.outgoing, channel);
    const now = performance.now();
    for (const [id, next] of this.nextDial) if (!this.listenersInRange.has(id) && next <= now) this.nextDial.delete(id);
    this.dialNearby();
  }

  private dialNearby() {
    if (!this.stream?.active || this.peer.disconnected || this.peer.destroyed) return;
    const now = performance.now();
    for (const id of this.listenersInRange) {
      if (this.outgoing.has(id) || (this.nextDial.get(id) ?? 0) > now) continue;
      this.nextDial.set(id, now + 2200);
      const call = this.peer.call(id, this.stream, { metadata: { purpose: 'proximity', epoch: this.epoch } });
      if (!call) continue;
      this.track(this.outgoing, call);
    }
  }

  private answer = (call: MediaConnection) => {
    if (
      !this.context ||
      !this.nearby.has(call.peer) ||
      call.metadata?.purpose !== 'proximity' ||
      call.metadata?.epoch !== this.epoch
    ) {
      call.close();
      return;
    }
    const channel = this.track(this.incoming, call);
    call.on('stream', (stream) => {
      const mix = this.nearby.get(call.peer);
      if (!mix || this.incoming.get(call.peer) !== channel || !stream.getAudioTracks().length) return;
      channel.release?.();
      const ctx = this.context!;
      // Chromium's WebRTC playout needs a media element to pull the remote stream.
      // Only the spatial mix reaches the speakers.
      const audio = new Audio();
      audio.muted = true;
      audio.srcObject = stream;
      void audio.play().catch(() => {});
      const source = ctx.createMediaStreamSource(stream);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const pan = ctx.createStereoPanner();
      if (!this.output) {
        // Limit the combined nearby voices after distance, wall filtering and panning.
        this.output = ctx.createDynamicsCompressor();
        this.output.threshold.value = -8;
        this.output.knee.value = 6;
        this.output.ratio.value = 8;
        this.output.attack.value = .003;
        this.output.release.value = .12;
        this.outputTrim = ctx.createGain();
        this.outputTrim.gain.value = .72;
        this.output.connect(this.outputTrim).connect(ctx.destination);
      }
      source.connect(filter).connect(gain).connect(pan).connect(this.output);
      let previousGain = -1,
        previousPan = -2,
        previousCutoff = -1;
      channel.apply = (m, volume) => {
        const level = m.gain * volume;
        if (previousCutoff !== m.cutoff) filter.frequency.setTargetAtTime(m.cutoff, ctx.currentTime, 0.045);
        if (previousGain !== level) gain.gain.setTargetAtTime(level, ctx.currentTime, 0.035);
        if (previousPan !== m.pan) pan.pan.setTargetAtTime(m.pan, ctx.currentTime, 0.045);
        previousGain = level;
        previousPan = m.pan;
        previousCutoff = m.cutoff;
      };
      channel.release = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
        pan.disconnect();
        audio.pause();
        audio.srcObject = null;
      };
      channel.apply(mix, this.volume);
    });
    call.answer();
  };

  private track(map: Map<string, Channel>, call: MediaConnection) {
    const previous = map.get(call.peer);
    if (previous) this.drop(map, previous);
    const channel: Channel = { call, deadline: 0 };
    map.set(call.peer, channel);
    channel.deadline = window.setTimeout(() => {
      if (call.peerConnection?.connectionState !== 'connected') this.drop(map, channel);
    }, 10000);
    call.on('close', () => this.release(map, channel));
    call.on('error', () => this.drop(map, channel));
    return channel;
  }

  private release(map: Map<string, Channel>, channel: Channel) {
    clearTimeout(channel.deadline);
    if (map.get(channel.call.peer) === channel) map.delete(channel.call.peer);
    channel.release?.();
    channel.release = undefined;
  }

  private drop(map: Map<string, Channel>, channel: Channel) {
    if (map.get(channel.call.peer) !== channel) return;
    // An unanswered PeerJS call may close without emitting a close event.
    this.release(map, channel);
    channel.call.close();
  }

  private clear(map: Map<string, Channel>) {
    for (const channel of map.values()) this.drop(map, channel);
  }

  dispose() {
    this.listeners.abort();
    this.peer.off('call', this.answer);
    this.nearby.clear();
    this.stream = undefined;
    this.clear(this.incoming);
    this.clear(this.outgoing);
    this.output?.disconnect();
    this.outputTrim?.disconnect();
    if (this.context) void this.context.close().catch(() => {});
  }
}
