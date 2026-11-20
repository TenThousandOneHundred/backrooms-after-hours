import type { GameSettings } from '../game';
import { Room, newCode } from './room';
import { capacity, type Snapshot } from './expedition';
import type { RoomView } from './view';

type UI = {
  panel: (mode: string, section: string, title: string, html: string, back?: () => void) => void;
  button: (id: string, text: string, symbol?: string, primary?: boolean) => string;
  enter: () => void;
  exit: () => void;
};
const get = (id: string) => document.getElementById(id)!;
export class RoomMenu {
  private room?: Room;
  private view?: RoomView;
  private rendering = false;
  private generation = 0;
  private phase = '';
  constructor(
    private ui: UI,
    private settings: GameSettings,
  ) {}
  menu() {
    this.disconnect();
    const button = this.ui.button;
    this.ui.panel(
      'coop-menu',
      'Co-op expedition',
      'Multiplayer',
      '<p class="panel-text">Explore the Lobby together. One computer hosts up to eight explorers.</p>' +
        button('host-room', 'Create room', 'play', true) +
        '<form id="join-form" class="join-room"><label for="join-code">Join with a room code</label>' +
        '<div><input class="code-input" id="join-code" maxlength="6" autocomplete="off" spellcheck="false" required pattern="[A-Za-z2-9]{6}" placeholder="ABC234">' +
        '<button class="secondary" type="submit">Join room</button></div></form>',
      () => this.leave(),
    );
    get('host-room').onclick = () => this.connect(newCode(), true);
    get('join-form').onsubmit = (e) => {
      e.preventDefault();
      this.connect((get('join-code') as HTMLInputElement).value.trim().toUpperCase(), false);
    };
  }
  private connect(code: string, hosting: boolean) {
    this.ui.panel(
      'coop-connect',
      'Multiplayer',
      hosting ? 'Creating room' : 'Joining room',
      '<p class="panel-text">Connecting to the room service…</p>',
      () => this.menu(),
    );
    try {
      this.room = new Room(
        code,
        hosting,
        (s) => this.update(s),
        (m) => this.error(m),
      );
    } catch {
      this.error('This browser could not open a WebRTC connection. Try a current desktop browser.');
    }
  }
  private update(state: Snapshot) {
    const r = this.room;
    if (!r) return;
    if (state.phase === 'playing') {
      if (this.phase !== 'playing') {
        this.phase = 'playing';
        this.ui.panel('coop-loading', 'Co-op expedition', 'Entering the Lobby', '', () => this.leave());
        void this.play(r);
      }
      get('coop-count').textContent = state.players.length + ' / ' + capacity;
      return;
    }
    if (this.phase !== state.phase) {
      this.phase = state.phase;
      this.generation++;
      this.view?.dispose();
      this.view = undefined;
      this.rendering = false;
      get('coop-hud').hidden = true;
      const waiting = state.phase === 'waiting';
      const text = waiting
        ? 'Find four ladder pieces, then open the service door.'
        : 'The expedition has ended.';
      this.ui.panel(
        'coop-room',
        'Level 0 · Co-op',
        waiting ? 'Room lobby' : state.phase === 'escaped' ? 'Team escaped' : 'Team lost',
        '<p class="panel-text">' +
          text +
          '</p><div class="room-ticket"><label>Room code<strong id="room-code"></strong></label>' +
          this.ui.button('copy-code', 'Copy code') +
          '</div><p id="room-roster" class="panel-text" role="status"></p>' +
          '<p class="panel-text">' +
          (r.hosting
            ? 'You are the host. Keep this tab active during play.'
            : 'The host starts the expedition.') +
          '</p>' +
          '<div class="panel-buttons">' +
          (r.hosting
            ? this.ui.button('start-room', waiting ? 'Start expedition' : 'Play again', 'play', true)
            : '') +
          this.ui.button('leave-room', r.hosting ? 'Close room' : 'Leave room') +
          '</div>',
      );
      get('room-code').textContent = r.code;
      get('copy-code').onclick = async () => {
        try {
          await navigator.clipboard.writeText(r.code);
          get('copy-code').textContent = 'Copied';
        } catch {
          get('copy-code').textContent = 'Select the code to copy';
        }
      };
      if (r.hosting) get('start-room').onclick = () => r.start();
      get('leave-room').onclick = () => this.leave();
    }
    get('room-roster').textContent =
      state.players.length + ' / ' + capacity + ' explorers · You are Explorer ' + r.slot;
  }
  private async play(r: Room) {
    if (this.rendering) return;
    this.rendering = true;
    const generation = ++this.generation;
    try {
      const { prepareView, RoomView } = await import('./view');
      await prepareView();
      if (generation !== this.generation || this.room !== r || r.state?.phase !== 'playing') return;
      this.ui.enter();
      get('coop-hud').hidden = false;
      get('coop-code').textContent = r.code;
      get('coop-count').textContent = r.state.players.length + ' / ' + capacity;
      get('coop-leave').textContent = r.hosting ? 'Close room' : 'Leave room';
      get('coop-leave').onclick = () => this.leave();
      const text = get('coop-status');
      this.view = new RoomView(get('world') as HTMLCanvasElement, r, this.settings, (s) => {
        if (text.textContent !== s) text.textContent = s;
      });
      (get('world') as HTMLCanvasElement).focus();
    } catch {
      if (generation === this.generation)
        this.error('Could not load the multiplayer world. Check graphics acceleration and try again.');
    }
  }
  private error(message: string) {
    this.disconnect();
    this.ui.panel(
      'coop-error',
      'Multiplayer',
      'Room unavailable',
      '<p class="panel-text" id="room-error" role="alert"></p>' +
        this.ui.button('rooms-back', 'Back to multiplayer'),
      () => this.menu(),
    );
    get('room-error').textContent = message;
    get('rooms-back').onclick = () => this.menu();
  }
  disconnect() {
    this.generation++;
    this.phase = '';
    this.rendering = false;
    this.view?.dispose();
    this.view = undefined;
    this.room?.close();
    this.room = undefined;
    get('coop-hud').hidden = true;
  }
  leave() {
    this.disconnect();
    this.ui.exit();
  }
}
