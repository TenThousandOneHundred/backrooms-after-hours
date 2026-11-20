import { loadProgress } from '../game-state';
import { Room, newCode } from './room';
import { capacity, roomSave, type Snapshot } from './expedition';
import { stages } from '../campaign';

type UI = {
  panel: (mode: string, section: string, title: string, html: string, back?: () => void) => void;
  button: (id: string, text: string, symbol?: string, primary?: boolean) => string;
  enter: (room: Room) => void;
  prepare: () => Promise<void>;
  stop: () => void;
  exit: () => void;
};
const get = (id: string) => document.getElementById(id)!;
export class RoomMenu {
  private room?: Room;
  private inGame = false;
  private rendering = false;
  private generation = 0;
  private phase = '';
  constructor(private ui: UI) {}
  menu() {
    this.disconnect();
    const button = this.ui.button;
    this.ui.panel(
      'coop-menu',
      'Co-op expedition',
      'Multiplayer',
      '<p class="panel-text">Play the full campaign with up to eight explorers. Voice chat gets quieter as friends move away.</p>' +
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
        this.ui.panel('coop-loading', 'Co-op expedition', 'Entering the campaign', '', () => this.leave());
        void this.play(r);
      }
      get('coop-count').textContent = state.players.length + ' / ' + capacity;
      get('coop-status').textContent = stages[state.journal.stage]?.name ?? '';
      return;
    }
    if (this.phase !== state.phase) {
      this.phase = state.phase;
      this.generation++;
      if (this.inGame) this.ui.stop();
      this.inGame = false;
      this.rendering = false;
      get('coop-hud').hidden = true;
      const waiting = state.phase === 'waiting';
      const text = waiting
        ? 'Any explorer can lead the team through an exit. During play, press M to talk to nearby teammates. Monsters can hear you too.'
        : 'Everyone was caught. Retry this level with your shared objectives intact.';
      this.ui.panel(
        'coop-room',
        'Campaign · Co-op',
        waiting ? 'Room lobby' : 'Team lost',
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
            ? this.ui.button('start-room', waiting ? 'Start expedition' : 'Retry level', 'play', true)
            : '') +
          (r.hosting && waiting && loadProgress(roomSave)
            ? this.ui.button('resume-room', 'Continue saved campaign')
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
      if (get('resume-room')) get('resume-room').onclick = () => r.start(true);
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
      await this.ui.prepare();
      if (generation !== this.generation || this.room !== r || r.state?.phase !== 'playing') return;
      this.inGame = true;
      this.ui.enter(r);
      get('coop-hud').hidden = false;
      get('coop-code').textContent = r.code;
      get('coop-count').textContent = r.state.players.length + ' / ' + capacity;
      get('coop-leave').textContent = r.hosting ? 'Close room' : 'Leave room';
      get('coop-leave').onclick = () => this.leave();
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
    if (this.inGame) this.ui.stop();
    this.inGame = false;
    this.room?.close();
    this.room = undefined;
    get('coop-hud').hidden = true;
  }
  leave() {
    this.disconnect();
    this.ui.exit();
  }
}
