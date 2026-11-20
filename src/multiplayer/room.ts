import type { Difficulty } from '../difficulty';
import Peer, { type DataConnection } from 'peerjs';
import { capacity, Expedition, roomSave, type Command, type Snapshot } from './expedition';

import { ProximityVoice, type VoiceMember } from './proximity-voice';
import { RadioAudio } from './radio-audio';
import { readRadioPacket, radioRate, radioSamples } from './radio-packet';
import { voiceVolume } from '../voice-input';
import { loadProgress, storeProgress } from '../game-state';

function explorerIdentity() {
  const key = 'backrooms-after-hours.explorer';
  try {
    const existing = sessionStorage.getItem(key) ?? localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch { return crypto.randomUUID(); }
}

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const namespace = 'backrooms-afterhours-campaign-4-';
export function newCode() {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (byte) => alphabet[byte % alphabet.length],
  ).join('');
}

export class Room {
  private peer: Peer;
  readonly voice: ProximityVoice;
  readonly radio: RadioAudio;
  private volume = 1;
  private nextRadioPacket = new Map<number, number>();
  private listening = false;
  private guestListeners = new Set<DataConnection>();
  private voiceMembers: VoiceMember[] = [];
  private hostGame?: Expedition;
  private guests = new Map<DataConnection, number>();
  private sentRevision = new WeakMap<DataConnection, number>();
  private savedRevision = 0;
  private upstream?: DataConnection;
  private timer = 0;
  private deadline = 0;
  private reconnectTimer = 0;
  private lookupRetry = 0;
  private retriedLookup = false;
  private retriedRoute = false;
  private hasRelay: boolean;
  private closed = false;
  slot = 0;
  state?: Snapshot;
  constructor(
    readonly code: string,
    readonly hosting: boolean,
    private change: (s: Snapshot) => void,
    private failure: (message: string) => void,
    private progress: (message: string) => void,
    iceServers: RTCIceServer[],
  ) {
    const id = hosting ? namespace + code : 'explorer-' + crypto.randomUUID();
    this.hasRelay = iceServers.some(server => [server.urls].flat().some(url => /^turns?:/i.test(url)));
    this.peer = new Peer(id, { config: { iceServers } });
    this.voice = new ProximityVoice(this.peer);
    this.radio = new RadioAudio(
      () => this.voice.audioContext,
      (packet) => this.sendRadio(packet),
    );
    this.waitFor('Connecting to the room service…', 'The room service did not answer. Check your connection and retry.', 12000);
    this.peer.on('error', (error) => {
      if (error.type === 'peer-unavailable') {
        if (!this.hosting && !this.closed && !this.state) {
          if (this.retriedLookup) this.fail('Room not found. Ask the host to open their room tab and confirm the code.');
          else {
            this.retriedLookup = true;
            const old = this.upstream;
            this.upstream = undefined;
            old?.close();
            this.progress('Waiting for the host to reconnect. Trying the code again…');
            this.lookupRetry = window.setTimeout(() => this.connectToHost(), 2000);
          }
        }
      } else if (error.type === 'unavailable-id')
        this.fail('This room code is already taken. Create a new room.');
      else if (!this.state || this.peer.destroyed)
        this.fail('Could not connect to the room service. Check your connection and try again.');
    });
    this.peer.on('open', () => {
      if (this.closed || this.state || this.upstream) return;
      if (hosting) {
        this.hostGame = new Expedition();
        this.slot = this.hostGame.add();
        this.publish();
      } else this.connectToHost();
    });
    this.peer.on('connection', (conn) => {
      if (!hosting || conn.label !== 'campaign-v4') {
        conn.close();
        return;
      }
      conn.once('open', () => {
        if (this.closed || !this.hostGame) {
          conn.close();
          return;
        }
        const slot = this.hostGame.add(conn.metadata?.explorerId);
        if (!slot) {
          conn.send({ type: 'full' });
          conn.close({ flush: true });
          return;
        }
        this.guests.set(conn, slot);
        conn.send({ type: 'welcome', slot, explorerId: this.hostGame.identityOf(slot) });
        conn.send({ type: 'voice-roster', members: this.voiceMembers });
        this.publish();
      });
      conn.on('data', (value) => {
        const slot = this.guests.get(conn);
        if (slot && value && typeof value === 'object' && 'type' in value && value.type === 'radio') {
          if (this.guestListeners.has(conn) && 'epoch' in value && 'packet' in value)
            this.relayRadio(slot, value.epoch, value.packet);
          return;
        }
        if (
          slot &&
          value &&
          typeof value === 'object' &&
          'type' in value &&
          value.type === 'voice-ready' &&
          'listening' in value &&
          typeof value.listening === 'boolean'
        ) {
          if (this.guestListeners.has(conn) === value.listening) return;
          if (value.listening) this.guestListeners.add(conn);
          else {
            this.guestListeners.delete(conn);
            this.hostGame?.quietRadio(slot);
          }
          this.publishVoiceRoster();
          return;
        }
        if (slot && value && typeof value === 'object' && 'epoch' in value && 'action' in value)
          this.hostGame?.command(slot, Number(value.epoch), value.action as Command);
      });
      const leave = () => {
        const slot = this.guests.get(conn);
        if (!slot || this.closed) return;
        this.guests.delete(conn);
        this.nextRadioPacket.delete(slot);
        if (this.guestListeners.delete(conn)) this.publishVoiceRoster();
        this.hostGame?.remove(slot);
        this.publish();
      };
      conn.on('close', leave);
      conn.on('error', () => {
        leave();
        conn.close();
      });
    });
    this.peer.on('disconnected', () => {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = window.setTimeout(() => {
        if (!this.closed && !this.peer.destroyed && this.peer.disconnected) this.peer.reconnect();
      }, 2000);
    });
  }
  private connectToHost() {
    if (this.closed || this.upstream || this.state) return;
    if (!this.peer.open) {
      this.waitFor('Reconnecting to the room service…', 'The room service could not reconnect. Retry with the same code.', 12000);
      return;
    }
    const tryingRelay = this.retriedRoute && this.hasRelay;
    const routeError = this.hasRelay
      ? 'The host answered, but the connection still failed. Try another network and rejoin with the same code.'
      : 'The host answered, but these networks could not connect directly. No relay is available. Try the same Wi-Fi or a phone hotspot.';
    this.waitFor(tryingRelay ? 'Trying the relay…' : this.retriedRoute ? 'Retrying the host connection…' : 'Looking for the host…',
      'The host did not answer. Ask them to open the room tab and check the code.', 14000);
    let conn: DataConnection;
    try {
      conn = this.peer.connect(namespace + this.code, {
        serialization: 'binary', reliable: true, label: 'campaign-v4',
        metadata: { explorerId: explorerIdentity() },
      });
      // PeerJS creates the connection synchronously. ICE gathering starts when its offer is applied.
      if (tryingRelay) conn.peerConnection.setConfiguration({
        ...conn.peerConnection.getConfiguration(), iceTransportPolicy: 'relay',
      });
    } catch {
      this.fail('The browser could not start a connection to the host.');
      return;
    }
    this.upstream = conn;
    const pc = conn.peerConnection;
    const routeFailed = () => {
      if (this.closed || this.upstream !== conn) return;
      if (this.state || conn.open || !pc.remoteDescription) {
        this.fail('The host closed the room or the connection was lost.');
        return;
      }
      if (this.retriedRoute) {
        this.fail(routeError);
        return;
      }
      this.retriedRoute = true;
      this.upstream = undefined;
      conn.close();
      this.connectToHost();
    };
    pc.addEventListener('signalingstatechange', () => {
      if (this.closed || this.upstream !== conn || conn.open || !pc.remoteDescription || pc.signalingState !== 'stable') return;
      this.waitFor(tryingRelay ? 'Host found. Connecting through the relay…' : 'Host found. Connecting the two browsers…',
        routeError, this.retriedRoute ? 22000 : 12000, routeFailed);
    });
    conn.once('open', () => {
      if (this.upstream === conn) this.waitFor('Connected. Receiving the room…',
        'Connected to the host, but the room data did not arrive. Refresh both games and try again.', 10000);
    });
    conn.on('data', (value) => { if (this.upstream === conn) this.receive(value); });
    conn.on('close', routeFailed);
    conn.on('error', routeFailed);
  }
  private waitFor(status: string, timeoutMessage: string, ms: number, onTimeout = () => this.fail(timeoutMessage)) {
    if (this.closed || this.state) return;
    clearTimeout(this.deadline);
    this.deadline = window.setTimeout(onTimeout, ms);
    this.progress(status);
  }
  private receive(value: unknown) {
    if (this.closed) return;
    if (!value || typeof value !== 'object' || !('type' in value)) return;
    if (value.type === 'radio' && 'epoch' in value && 'sender' in value && 'packet' in value) {
      const s = this.state;
      if (
        this.listening &&
        s?.phase === 'playing' &&
        !s.journal.pending &&
        value.epoch === s.epoch &&
        value.sender !== this.slot &&
        s.players.some((p) => p.slot === this.slot && p.alive) &&
        s.players.some((p) => p.slot === value.sender && p.alive)
      ) {
        const pcm = readRadioPacket(value.packet);
        if (pcm) this.radio.play(Number(value.sender), pcm, this.volume);
      }
      return;
    }
    if (value.type === 'voice-roster' && this.slot && 'members' in value && Array.isArray(value.members)) {
      if (
        value.members.length <= capacity &&
        value.members.every(
          (m) =>
            m && typeof m.id === 'string' && Number.isInteger(m.slot) && m.slot >= 1 && m.slot <= capacity,
        )
      ) {
        this.voiceMembers = value.members;
        this.updateVoice();
      }
      return;
    }
    if (value.type === 'full') {
      this.fail('Room full. All eight explorer slots are taken.');
      return;
    }
    if (
      value.type === 'welcome' &&
      'slot' in value &&
      typeof value.slot === 'number' &&
      Number.isInteger(value.slot) &&
      value.slot >= 2 &&
      value.slot <= capacity
    ) {
      this.slot = value.slot;
      if ('explorerId' in value && typeof value.explorerId === 'string') {
        try { sessionStorage.setItem('backrooms-after-hours.explorer', value.explorerId); } catch { /* Private session. */ }
      }
    }
    if (value.type === 'state' && this.slot && 'state' in value) {
      const state = value.state as Snapshot;
      if (
        !state ||
        !['waiting', 'playing', 'lost', 'finished'].includes(state.phase) ||
        !Array.isArray(state.players) ||
        state.players.length > capacity ||
        !Array.isArray(state.monsters) ||
        !state.players.some((p) => p?.slot === this.slot)
      )
        return;
      if (!state.journal && (!this.state || this.state.revision !== state.revision)) return;
      state.journal ??= this.state!.journal;
      this.accept(state);
    }
  }
  setVolume(volume: number) {
    this.volume = volume;
    this.voice.setVolume(volume);
    this.radio.setVolume(volume);
  }
  private sendRadio(packet: string) {
    const s = this.state;
    if (
      !this.listening ||
      !s ||
      s.phase !== 'playing' ||
      s.journal.pending ||
      !s.players.some((p) => p.slot === this.slot && p.alive)
    )
      return;
    if (this.hosting) this.relayRadio(this.slot, s.epoch, packet);
    else if (this.upstream?.open && this.upstream.dataChannel.bufferedAmount < 8192)
      this.upstream.send({ type: 'radio', epoch: s.epoch, packet });
  }
  private relayRadio(sender: number, epoch: unknown, packet: unknown) {
    const game = this.hostGame;
    if (
      !game ||
      game.phase !== 'playing' ||
      game.journal.pending ||
      game.epoch !== epoch ||
      sender === game.hunt?.monster ||
      !game.players.get(sender)?.alive
    )
      return;
    const now = performance.now(),
      next = this.nextRadioPacket.get(sender) ?? 0;
    if (next > now + 180) return;
    const pcm = readRadioPacket(packet);
    if (!pcm) return;
    this.nextRadioPacket.set(sender, Math.max(next, now) + (1000 * radioSamples) / radioRate);
    const loudness = voiceVolume(pcm);
    game.soundRadio(sender, loudness);
    if (sender !== this.slot && !this.isMonster && this.listening && game.players.get(this.slot)?.alive) {
      this.radio.play(sender, pcm, this.volume);
      game.soundRadio(this.slot, loudness);
    }
    for (const conn of this.guestListeners) {
      const slot = this.guests.get(conn);
      if (
        !slot ||
        slot === sender || slot === game.hunt?.monster ||
        !conn.open ||
        !game.players.get(slot)?.alive ||
        conn.dataChannel.bufferedAmount >= 16384
      )
        continue;
      conn.send({ type: 'radio', epoch, sender, packet });
      game.soundRadio(slot, loudness);
    }
  }
  setListening(listening: boolean) {
    if (this.closed || this.listening === listening) return;
    this.listening = listening;
    if (!listening) {
      this.radio.reset();
      this.hostGame?.quietRadio(this.slot);
    }
    if (this.hosting) this.publishVoiceRoster();
    else {
      if (this.upstream?.open) this.upstream.send({ type: 'voice-ready', listening });
      this.updateVoice();
    }
  }
  private updateVoice() {
    if (this.state) this.voice.update(this.slot, this.state, this.voiceMembers, this.listening);
  }
  private publishVoiceRoster() {
    this.voiceMembers = this.listening ? [{ id: this.peer.id, slot: this.slot }] : [];
    for (const conn of this.guestListeners) {
      const slot = this.guests.get(conn);
      if (slot) this.voiceMembers.push({ id: conn.peer, slot });
    }
    for (const conn of this.guests.keys())
      if (conn.open) conn.send({ type: 'voice-roster', members: this.voiceMembers });
    this.updateVoice();
  }
  private accept(state: Snapshot) {
    clearTimeout(this.deadline);
    if (
      state.epoch !== this.state?.epoch ||
      state.phase !== 'playing' ||
      state.journal.pending ||
      !state.players.some((p) => p.slot === this.slot && p.alive)
    )
      this.radio.reset();
    else
      for (const id of this.radio.receiving)
        if (!state.players.some((p) => p.alive && p.slot === id)) this.radio.silence(id);
    this.state = state;
    this.updateVoice();
    this.change(state);
  }
  private publish() {
    if (this.closed || !this.hostGame) return;
    const state = this.hostGame.snapshot();
    const phaseChanged = state.phase !== this.state?.phase;
    const { journal, ...frame } = state;
    if (!state.hunt && state.phase !== 'waiting' && this.savedRevision !== state.revision) {
      this.savedRevision = state.revision;
      void storeProgress(journal, roomSave);
    }
    for (const conn of this.guests.keys()) {
      if (!conn.open) continue;
      const changed = this.sentRevision.get(conn) !== state.revision;
      if (phaseChanged || changed || conn.dataChannel.bufferedAmount < 32768) {
        conn.send({ type: 'state', state: changed ? { ...frame, journal: { ...journal, teamLives: undefined } } : frame });
        this.sentRevision.set(conn, state.revision);
      }
    }
    this.accept(state);
  }
  get isMonster() { return this.slot > 0 && this.state?.hunt?.monster === this.slot; }
  configureHunt(monster: number) {
    this.hostGame?.configureHunt(monster);
    this.publish();
  }
  returnToLobby() {
    this.hostGame?.returnToLobby();
    this.publish();
  }
  setDifficulty(difficulty: Difficulty) {
    this.hostGame?.setDifficulty(difficulty);
    this.publish();
  }
  start(resume = false) {
    if (!this.hostGame || this.hostGame.phase === 'playing') return;
    clearInterval(this.timer);
    this.hostGame.start(resume ? loadProgress(roomSave) : null);
    this.publish();
    if (this.hostGame.snapshot().phase !== 'playing') return;
    this.timer = window.setInterval(() => {
      this.hostGame!.step(0.05);
      this.publish();
      if (this.hostGame!.phase !== 'playing') clearInterval(this.timer);
    }, 50);
  }
  command(epoch: number, action: Command) {
    if (this.hostGame) this.hostGame.command(this.slot, epoch, action);
    else if (
      this.upstream?.open &&
      (action.type !== 'pose' || this.upstream.dataChannel.bufferedAmount < 8192)
    )
      this.upstream.send({ epoch, action });
  }
  private fail(message: string) {
    if (this.closed) return;
    this.close();
    this.failure(message);
  }
  close() {
    if (this.closed) return;
    if (this.hostGame && !this.hostGame.hunt && this.hostGame.phase !== 'waiting' && this.savedRevision !== this.hostGame.revision)
      void storeProgress(this.hostGame.journal, roomSave);
    this.closed = true;
    clearInterval(this.timer);
    clearTimeout(this.lookupRetry);
    clearTimeout(this.deadline);
    clearTimeout(this.reconnectTimer);
    this.radio.reset();
    this.voice.dispose();
    this.guestListeners.clear();
    this.peer.destroy();
    this.guests.clear();
  }
}
