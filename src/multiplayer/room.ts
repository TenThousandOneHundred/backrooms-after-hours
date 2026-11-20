import Peer, { type DataConnection } from 'peerjs';
import { capacity, Expedition, roomSave, type Command, type Snapshot } from './expedition';

import { loadProgress, storeProgress } from '../game-state';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const namespace = 'backrooms-afterhours-v2-';
export function newCode() {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (byte) => alphabet[byte % alphabet.length],
  ).join('');
}

export class Room {
  private peer: Peer;
  private hostGame?: Expedition;
  private guests = new Map<DataConnection, number>();
  private sentRevision = new WeakMap<DataConnection, number>();
  private savedRevision = 0;
  private upstream?: DataConnection;
  private timer = 0;
  private deadline = 0;
  private reconnectTimer = 0;
  private closed = false;
  slot = 0;
  state?: Snapshot;
  constructor(
    readonly code: string,
    readonly hosting: boolean,
    private change: (s: Snapshot) => void,
    private failure: (message: string) => void,
  ) {
    this.peer = hosting ? new Peer(namespace + code) : new Peer('explorer-' + crypto.randomUUID());
    this.deadline = window.setTimeout(
      () =>
        this.fail(
          'Connection timed out. Check the code and that the host has the room open. Some networks block peer connections.',
        ),
      25000,
    );
    this.peer.on('error', (error) => {
      if (error.type === 'peer-unavailable') {
        if (!this.hosting && !this.state) this.fail('Room not found. Check the code with the host.');
      }
      else if (error.type === 'unavailable-id')
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
      } else {
        const conn = this.peer.connect(namespace + code, {
          serialization: 'json',
          reliable: true,
          label: 'campaign-v2',
        });
        this.upstream = conn;
        conn.on('data', (value) => this.receive(value));
        conn.on('close', () => this.fail('The host closed the room or the connection was lost.'));
        conn.on('error', () => this.fail('Connection to the host was lost.'));
      }
    });
    this.peer.on('connection', (conn) => {
      if (!hosting || conn.label !== 'campaign-v2') {
        conn.close();
        return;
      }
      conn.once('open', () => {
        if (this.closed || !this.hostGame) {
          conn.close();
          return;
        }
        const slot = this.hostGame.add();
        if (!slot) {
          conn.send({ type: 'full' });
          conn.close({ flush: true });
          return;
        }
        this.guests.set(conn, slot);
        conn.send({ type: 'welcome', slot });
        this.publish();
      });
      conn.on('data', (value) => {
        const slot = this.guests.get(conn);
        if (slot && value && typeof value === 'object' && 'epoch' in value && 'action' in value)
          this.hostGame?.command(slot, Number(value.epoch), value.action as Command);
      });
      const leave = () => {
        const slot = this.guests.get(conn);
        if (!slot || this.closed) return;
        this.guests.delete(conn);
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
  private receive(value: unknown) {
    if (!value || typeof value !== 'object' || !('type' in value)) return;
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
    )
      this.slot = value.slot;
    if (value.type === 'state' && this.slot && 'state' in value) {
      const state = value.state as Snapshot;
      if (
        !state ||
        !['waiting', 'playing', 'lost'].includes(state.phase) ||
        !Array.isArray(state.players) ||
        state.players.length > capacity ||
        !Array.isArray(state.monsters) ||
        !state.players.some((p) => p?.slot === this.slot)
      )
        return;
      state.journal ??= this.state!.journal;
      this.accept(state);
    }
  }
  private accept(state: Snapshot) {
    clearTimeout(this.deadline);
    this.state = state;
    this.change(state);
  }
  private publish() {
    if (this.closed || !this.hostGame) return;
    const state = this.hostGame.snapshot();
    const phaseChanged = state.phase !== this.state?.phase;
    const { journal, ...frame } = state;
    if (this.savedRevision !== state.revision) {
      this.savedRevision = state.revision;
      void storeProgress(journal, roomSave);
    }
    for (const conn of this.guests.keys()) {
      if (!conn.open) continue;
      const changed = this.sentRevision.get(conn) !== state.revision;
      if (phaseChanged || changed || conn.dataChannel.bufferedAmount < 32768) {
        conn.send({ type: 'state', state: changed ? state : frame });
        this.sentRevision.set(conn, state.revision);
      }
    }
    this.accept(state);
  }
  start(resume = false) {
    if (!this.hostGame || this.hostGame.phase === 'playing') return;
    clearInterval(this.timer);
    this.hostGame.start(resume ? loadProgress(roomSave) : null);
    this.publish();
    this.timer = window.setInterval(() => {
      this.hostGame!.step(0.05);
      this.publish();
      if (this.hostGame!.phase !== 'playing') clearInterval(this.timer);
    }, 50);
  }
  command(epoch: number, action: Command) {
    if (this.hostGame) this.hostGame.command(this.slot, epoch, action);
    else if (this.upstream?.open && (action.type !== 'pose' || this.upstream.dataChannel.bufferedAmount < 8192))
      this.upstream.send({epoch, action});
  }
  private fail(message: string) {
    if (this.closed) return;
    this.close();
    this.failure(message);
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.timer);
    clearTimeout(this.deadline);
    clearTimeout(this.reconnectTimer);
    this.peer.destroy();
    this.guests.clear();
  }
}
