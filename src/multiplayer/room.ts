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

// Chrome can report an open data channel long after its tab has gone away.
function answersProbe(conn: DataConnection): Promise<boolean> {
  if (!conn.open) return Promise.resolve(false);
  const nonce = crypto.randomUUID();
  return new Promise(resolve => {
    const finish = (alive: boolean) => {
      clearTimeout(timer);
      conn.off('data', reply);
      conn.off('close', closed);
      resolve(alive);
    };
    const reply = (value: unknown) => {
      if (value && typeof value === 'object' && 'rejoinAck' in value && value.rejoinAck === nonce) finish(true);
    };
    const closed = () => finish(false);
    const timer = window.setTimeout(closed, 1800);
    conn.on('data', reply);
    conn.on('close', closed);
    try { conn.send({ type: 'rejoin-probe', nonce }); } catch { closed(); }
  });
}

type Backup = { session: string; owner: number; game: ReturnType<Expedition['checkpoint']>; tokens: [string,string][] };

// The accompanying normal state frame already carries positions and journal changes.
type WireBackup = Omit<Backup, 'game'> & {
  game: Omit<Backup['game'], 'state'>;
  teamLives?: Snapshot['journal']['teamLives'];
};

async function fingerprint(token: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('');
}

export class Room {
  private session = crypto.randomUUID() as string;
  private backup?: Backup;
  private claim?: Peer;
  private monitor = 0;
  private nextElection = 0;
  private electionStarted = 0;
  private dialStarted = 0;
  private lastContact = performance.now();
  private lastBackup = -Infinity;
  private rosterKey = '';
  migrating = false;
  hostSeat = 1;
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
  private resumeTokens = new Map<string, string>();
  private readonly resumeKey: string;
  private sentRevision = new WeakMap<DataConnection, number>();
  private savedRevision = 0;
  private upstream?: DataConnection;
  private timer = 0;
  private deadline = 0;
  private lookupRetry = 0;
  private retriedLookup = false;
  private retriedRoute = false;
  private hasRelay: boolean;
  private closed = false;
  slot = 0;
  state?: Snapshot;
  constructor(
    readonly code: string,
    public hosting: boolean,
    private change: (s: Snapshot) => void,
    private failure: (message: string) => void,
    private progress: (message: string) => void,
    private iceServers: RTCIceServer[],
  ) {
    this.resumeKey = 'backrooms-after-hours.rejoin.' + code;
    const id = 'explorer-' + crypto.randomUUID();
    this.hasRelay = iceServers.some(server => [server.urls].flat().some(url => /^turns?:/i.test(url)));
    this.peer = new Peer(id, { config: { iceServers } });
    this.voice = new ProximityVoice(this.peer);
    this.radio = new RadioAudio(
      () => this.voice.audioContext,
      (packet) => this.sendRadio(packet),
    );
    this.waitFor('Connecting to the room service…', 'The room service did not answer. Check your connection and retry.', 12000);
    this.peer.on('error', (error) => {
      if (this.migrating && error.type === 'peer-unavailable') return;
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
      if (this.hosting) this.createRoom();
      else this.connectToHost();
    });
    this.maintainSignaling(this.peer);
    this.monitor = window.setInterval(() => {
      if (this.hosting && this.hostGame?.phase !== 'playing') {
        for (const conn of this.guests.keys()) if (conn.open) conn.send({type:'heartbeat'});
      } else if (!this.hosting && !this.migrating && this.backup && performance.now()-this.lastContact > 9000) {
        this.recover();
      }
    }, 2000);
  }

  private createRoom() {
    if (this.claim) return;
    const endpoint = new Peer(namespace + this.code, {config:{iceServers:this.iceServers}});
    this.claim = endpoint;
    endpoint.on('error', error => {
      if (!this.state) this.fail(error.type === 'unavailable-id' ? 'This room code is already taken. Create a new room.' : 'Could not register the room code.');
    });
    endpoint.once('open', async () => {
      const token = crypto.randomUUID(), digest = await fingerprint(token);
      if (this.closed) return;
      this.hostGame = new Expedition();
      this.slot = this.hostGame.add();
      this.resumeTokens.set(digest, 'host');
      this.rememberToken(token);
      this.serve(endpoint);
      this.publish();
    });
  }

  private recoveryCopy(): Backup {
    return {session:this.session, owner:this.slot, game:this.hostGame!.checkpoint(), tokens:[...this.resumeTokens]};
  }

  private serve(endpoint: Peer) {
    this.listen(endpoint);
    // Losing the signaling registration releases our claim to the code even if
    // some WebRTC channels survive. Stop the old simulation before electing.
    endpoint.on('disconnected', () => {
      if (this.closed || this.claim !== endpoint || !this.hostGame) return;
      this.backup = this.recoveryCopy();
      clearInterval(this.timer);
      this.claim = undefined;
      this.hosting = false;
      this.hostGame = undefined;
      this.notifyHandoff();
      this.guests.clear();
      this.guestListeners.clear();
      this.nextRadioPacket.clear();
      endpoint.destroy();
      this.recover();
    });
  }

  private listen(endpoint: Peer) {
    endpoint.on('connection', (conn) => {
      if (!this.hosting || conn.label !== 'campaign-v4') {
        conn.close();
        return;
      }
      let lastActivity = performance.now(), presenceTimer = 0;
      conn.once('open', async () => {
        if (this.closed || !this.hostGame) {
          conn.close();
          return;
        }
        if (conn.metadata?.session && conn.metadata.session !== this.session) { conn.close(); return; }
        const token = conn.metadata?.resumeToken;
        const returningId = typeof token === 'string' ? this.resumeTokens.get(await fingerprint(token)) : undefined;
        // A reload can reconnect before WebRTC reports the old channel closed.
        // Only a token from a previous welcome may take over that connection.
        if (returningId) for (const [old, seat] of this.guests) {
          if (this.hostGame.identityOf(seat) !== returningId) continue;
          if (!conn.metadata?.sameTab) {
            const alive = await answersProbe(old);
            if (this.closed || !conn.open) return;
            const owner = [...this.guests].find(([, current]) => this.hostGame?.identityOf(current) === returningId);
            if (owner && (owner[0] !== old || alive)) {
              conn.send({ type: 'still-connected' });
              conn.close({ flush: true });
              return;
            }
            if (!owner) break;
          }
          this.guests.delete(old);
          this.guestListeners.delete(old);
          this.nextRadioPacket.delete(seat);
          this.hostGame.remove(seat, true);
          old.close();
          this.publishVoiceRoster();
          break;
        }
        const resumeToken = returningId ? token : crypto.randomUUID();
        const digest = await fingerprint(resumeToken);
        if (this.closed || !conn.open) return;
        const proposed = conn.metadata?.explorerId;
        const used = [...this.resumeTokens.values()].includes(proposed);
        const slot = this.hostGame.add(returningId ?? (used ? undefined : proposed), !!returningId);
        if (!slot) {
          conn.send({ type: 'full' });
          conn.close({ flush: true });
          return;
        }
        this.guests.set(conn, slot);
        if (conn.metadata?.canProbe) {
          presenceTimer = window.setInterval(async () => {
            if (!this.guests.has(conn) || this.closed) { clearInterval(presenceTimer); return; }
            if (performance.now() - lastActivity < 5000) return;
            const since = lastActivity;
            if (!await answersProbe(conn) && lastActivity === since && this.guests.has(conn)) {
              leave();
              conn.close();
            }
          }, 5000);
        }
        const explorerId = this.hostGame.identityOf(slot)!;
        this.resumeTokens.set(digest, explorerId);
        conn.send({ type: 'welcome', session:this.session, slot, explorerId, resumeToken });
        conn.send({ type: 'voice-roster', members: this.voiceMembers });
        this.publish();
      });
      conn.on('data', (value) => {
        lastActivity = performance.now();
        const slot = this.guests.get(conn);
        if (slot && value && typeof value === 'object' && 'type' in value && value.type === 'depart') {
          leave();
          conn.close();
          return;
        }
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
        clearInterval(presenceTimer);
        const slot = this.guests.get(conn);
        if (!slot || this.closed) return;
        this.guests.delete(conn);
        this.nextRadioPacket.delete(slot);
        if (this.guestListeners.delete(conn)) this.publishVoiceRoster();
        this.hostGame?.remove(slot, true);
        this.publish();
      };
      conn.on('close', leave);
      conn.on('error', () => {
        leave();
        conn.close();
      });
    });
  }

  private maintainSignaling(endpoint: Peer) {
    endpoint.on('disconnected', () => {
      window.setTimeout(() => {
        if (!this.closed && !endpoint.destroyed && endpoint.disconnected) endpoint.reconnect();
      }, 1500);
    });
  }

  private rememberToken(token: string) {
    try {
      sessionStorage.setItem(this.resumeKey, token);
      localStorage.setItem(this.resumeKey, token);
    } catch { /* Browser storage is optional. */ }
  }

  private notifyHandoff() {
    for (const conn of this.guests.keys()) {
      if (conn.open) try { conn.send({type:'host-leaving'}); } catch { /* Channel already lost. */ }
    }
  }

  private recover() {
    if (this.closed || this.hosting || this.migrating || !this.backup) return;
    this.migrating = true;
    this.electionStarted = performance.now();
    const old = this.upstream;
    this.upstream = undefined;
    old?.close();
    this.radio.reset();
    this.voiceMembers = [];
    this.updateVoice();
    if (this.state) this.change(this.state);
    const eligible = this.backup.game.state.players.map(p => p.slot).filter(n => n !== this.hostSeat).sort((a,b)=>a-b);
    this.nextElection = window.setTimeout(() => this.tryElection(), 200 + (this.hostSeat === this.slot ? eligible.length : Math.max(0,eligible.indexOf(this.slot)))*1100);
  }

  private tryElection() {
    if (!this.migrating || this.closed) return;
    if (performance.now()-this.electionStarted > 95000) { this.fail('Host handoff timed out. Rejoin with the same room code.'); return; }
    if (!this.peer.open) {
      this.nextElection = window.setTimeout(() => this.tryElection(), 1500);
      return;
    }
    // The signaling service grants the original room ID to only one browser.
    // Keep our explorer peer for voice while this separate endpoint accepts guests.
    const candidate = new Peer(namespace + this.code, {config:{iceServers:this.iceServers}});
    this.claim = candidate;
    const retry = () => {
      if (this.claim !== candidate || !this.migrating) return;
      this.claim = undefined;
      candidate.destroy();
      // Leave a slow ICE negotiation running alongside the election.
      if (!this.upstream || (!this.upstream.open && performance.now()-this.dialStarted > 18000)) {
        const old = this.upstream;
        if (old?.peerConnection?.remoteDescription && this.hasRelay) this.retriedRoute = true;
        this.upstream = undefined;
        old?.close();
        this.connectToHost();
      }
      this.nextElection = window.setTimeout(() => this.tryElection(), 3500 + this.slot*100);
    };
    const timeout = window.setTimeout(retry, 6500);
    candidate.on('error', (error) => {
      clearTimeout(timeout);
      if (this.hosting && this.claim === candidate && error.type === 'unavailable-id')
        this.fail('Another explorer is hosting now. Rejoin with the same code.');
      else retry();
    });
    candidate.once('open', () => {
      clearTimeout(timeout);
      if (!this.migrating || this.claim !== candidate || this.closed) { candidate.destroy(); return; }
      const backup = this.backup!;
      this.hostGame = Expedition.takeOver(backup.game, this.slot);
      this.hosting = true;
      this.hostSeat = this.slot;
      this.migrating = false;
      this.resumeTokens = new Map(backup.tokens);
      const old = this.upstream;
      this.upstream = undefined;
      old?.close();
      this.serve(candidate);
      this.publishVoiceRoster();
      this.publish();
      this.runHost();
    });
  }

  private resumeToken() {
    try {
      const session = sessionStorage.getItem(this.resumeKey);
      return { resumeToken: session ?? localStorage.getItem(this.resumeKey), sameTab: !!session };
    } catch { return {}; }
  }
  private connectToHost() {
    if (this.closed || this.upstream || (this.state && !this.migrating)) return;
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
        metadata: { session:this.migrating ? this.session : undefined, explorerId: explorerIdentity(), canProbe: true, ...this.resumeToken() },
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
    this.dialStarted = performance.now();
    const pc = conn.peerConnection;
    const routeFailed = () => {
      if (this.closed || this.upstream !== conn) return;
      if (this.migrating) {
        if (pc.remoteDescription && this.hasRelay) this.retriedRoute = true;
        this.upstream = undefined;
        conn.close();
        return;
      }
      if (this.state && this.backup) { this.recover(); return; }
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
    this.lastContact = performance.now();
    if (value.type === 'host-leaving') { this.recover(); return; }
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
    if (value.type === 'rejoin-probe' && 'nonce' in value && typeof value.nonce === 'string') {
      if (this.upstream?.open) this.upstream.send({ rejoinAck: value.nonce });
      return;
    }
    if (value.type === 'still-connected') {
      this.fail('Your explorer is still connected in another tab. Close that tab, then retry this room.');
      return;
    }
    if (value.type === 'full') {
      this.fail('All eight seats are occupied or held for reconnecting players. Try again in a moment.');
      return;
    }
    if (
      value.type === 'welcome' &&
      'slot' in value &&
      typeof value.slot === 'number' &&
      Number.isInteger(value.slot) &&
      value.slot >= 1 &&
      value.slot <= capacity
    ) {
      this.slot = value.slot;
      if ('session' in value && typeof value.session === 'string') this.session = value.session;
      if ('resumeToken' in value && typeof value.resumeToken === 'string') this.rememberToken(value.resumeToken);
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
      if ('backup' in value && value.backup) {
        const backup = value.backup as WireBackup;
        if (backup.session === this.session) {
          this.backup = {session:backup.session, owner:backup.owner, tokens:backup.tokens,
            game:{...backup.game, state:{...state, journal:{...state.journal, teamLives:backup.teamLives}}}};
          this.hostSeat = backup.owner;
        }
      }
      if (this.migrating) {
        this.migrating = false;
        clearTimeout(this.nextElection);
        this.claim?.destroy();
        this.claim = undefined;
        if (this.listening) this.upstream?.send({type:'voice-ready', listening:true});
      }
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
    const roster = state.players.map(p => p.slot).join(',');
    const refresh = this.guests.size > 0 && ([...this.guests.keys()].some(c => !this.sentRevision.has(c)) || roster !== this.rosterKey || phaseChanged ||
      this.state?.revision !== state.revision || performance.now()-this.lastBackup >= 800);
    let backup: WireBackup | undefined;
    if (refresh) {
      const copy = this.recoveryCopy();
      const {state: checkpoint, ...simulation} = copy.game;
      backup = {session:copy.session, owner:copy.owner, tokens:copy.tokens, game:simulation, teamLives:checkpoint.journal.teamLives};
      this.lastBackup = performance.now();
    }
    this.rosterKey = roster;
    for (const conn of this.guests.keys()) {
      if (!conn.open) continue;
      const changed = this.sentRevision.get(conn) !== state.revision;
      if (phaseChanged || changed || conn.dataChannel.bufferedAmount < 32768) {
        conn.send({ type: 'state', backup, state: changed ? { ...frame, journal: { ...journal, teamLives: undefined } } : frame });
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
    this.runHost();
  }
  private runHost() {
    if (this.hostGame?.phase !== 'playing') return;
    clearInterval(this.timer);
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
    if (this.hosting) this.notifyHandoff();
    clearInterval(this.monitor);
    clearTimeout(this.nextElection);
    this.claim?.destroy();
    if (this.upstream?.open) {
      try { this.upstream.send({type: 'depart'}); } catch { /* Channel already dropped. */ }
    }
    clearInterval(this.timer);
    clearTimeout(this.lookupRetry);
    clearTimeout(this.deadline);
    this.radio.reset();
    this.voice.dispose();
    this.guestListeners.clear();
    this.peer.destroy();
    this.guests.clear();
  }
}
