import { difficultyName, difficultyPicker, lifeCount, livesPerLevel, readDifficulty } from '../difficulty';
import { loadProgress } from '../game-state';
import { roomIceServers } from './ice';
import { Room, newCode } from './room';
import { capacity, roomSave, type Snapshot } from './expedition';
import { stages } from '../campaign';

type UI = {
  panel: (mode: string, section: string, title: string, html: string, back?: () => void) => void;
  button: (id: string, text: string, symbol?: string, primary?: boolean) => string;
  enter: (room: Room) => void;
  prepare: () => Promise<void>;
  stop: (terminal?: boolean, cause?: string) => void;
  exit: () => void;
};
const get = (id: string) => document.getElementById(id)!;
export class RoomMenu {
  private room?: Room;
  private inGame = false;
  private rendering = false;
  private generation = 0;
  private phase = '';
  private panelHost = false;
  constructor(private ui: UI) {}
  menu(invitedCode?: string) {
    this.disconnect();
    const button = this.ui.button;
    this.ui.panel(
      'coop-menu',
      'Co-op expedition',
      'Multiplayer',
      '<p class="panel-text">Play the campaign together, or hunt your friends as the Bacteria. Rooms hold up to eight players.</p>' +
        button('host-room', 'Create room', 'play', true) +
        '<form id="join-form" class="join-room"><label for="join-code">Join a lobby or an active game</label>' +
        '<div><input class="code-input" id="join-code" maxlength="6" autocomplete="off" spellcheck="false" required pattern="[A-Za-z2-9]{6}" placeholder="ABC234">' +
        '<button class="secondary" type="submit">Join room</button></div></form>',
      () => this.leave(),
    );
    if (invitedCode) {
      const field = get('join-code') as HTMLInputElement;
      field.value = invitedCode;
      get('join-form').querySelector('button')?.focus();
    }
    get('host-room').onclick = () => this.connect(newCode(), true);
    get('join-form').onsubmit = (e) => {
      e.preventDefault();
      this.connect((get('join-code') as HTMLInputElement).value.trim().toUpperCase(), false);
    };
  }
  private async connect(code: string, hosting: boolean) {
    const generation = ++this.generation;
    this.ui.panel(
      'coop-connect',
      'Multiplayer',
      hosting ? 'Creating room' : 'Joining room',
      '<p class="panel-text" id="join-progress" role="status">Preparing the connection…</p>',
      () => this.menu(),
    );
    try {
      const iceServers = await roomIceServers(import.meta.env.VITE_TURN_CREDENTIALS_URL);
      if (generation !== this.generation) return;
      this.room = new Room(
        code,
        hosting,
        (s) => this.update(s),
        (m) => this.error(m, hosting ? undefined : code),
        (m) => { get('join-progress').textContent = m; },
        iceServers,
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
      const count = get('coop-count'), roster = r.migrating ? 'Finding the next host…' : state.players.length + ' / ' + capacity + (r.hosting ? ' · Hosting' : ' · Host ' + r.hostSeat);
      if (count.textContent !== roster) count.textContent = roster;
      const radio = get('radio-state'), receiving = r.radio.receiving;
      const label = r.isMonster ? 'E · Grab' : r.radio.transmitting ? 'Radio · Transmitting' : receiving.length ?
        'Radio · Explorer ' + receiving.join(' + ') : 'Hold V · Radio';
      if (radio.textContent !== label) radio.textContent = label;
      const status = get('coop-status'), stage = stages[state.journal.stage]?.name ?? '';
      if (status.textContent !== stage) status.textContent = stage;
      return;
    }
    if (this.phase !== state.phase || this.panelHost !== r.hosting) {
      this.panelHost = r.hosting;
      this.phase = state.phase;
      this.generation++;
      if (this.inGame) {
        const terminal = state.phase === 'lost' || state.hunt?.result === 'caught';
        const self = state.players.find(player => player.slot === r.slot);
        this.ui.stop(terminal, self && !self.alive ? self.cause : undefined);
      }
      this.inGame = false;
      this.rendering = false;
      get('coop-hud').hidden = true;
      const waiting = state.phase === 'waiting';
      const result = state.hunt?.result;
      const text = result === 'escaped' ? 'An explorer opened the service exit.' :
        result === 'caught' ? 'The Bacteria took the explorers’ last life.' :
        result === 'abandoned' ? 'A side left the hunt. Choose roles for another round.' : waiting
        ? 'Press M to speak nearby. Explorers can hold V to use their radios.'
        : 'Everyone is out of lives. Retry this level with your shared objectives intact.';
      this.ui.panel(
        'coop-room',
        state.hunt && !waiting ? 'Monster Hunt · Level 0' : 'Multiplayer',
        waiting ? 'Room lobby' : result === 'escaped' ? 'Explorers escaped' : result === 'caught' ? 'Monster wins' : result ? 'Hunt ended' : 'Team lost',
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
          (waiting && r.hosting ?
            '<label class="difficulty-picker">Game mode <select id="room-mode"><option value="coop">Campaign co-op</option><option value="hunt">Monster Hunt</option></select></label>' +
            '<label class="difficulty-picker" id="monster-choice" hidden>Play as monster <select id="monster-seat"></select></label>' : '') +
          (waiting ? '<p id="mode-brief" class="panel-text"></p>' : '') +
          (waiting && r.hosting ? difficultyPicker('room-difficulty') : '<p class="panel-text" id="room-difficulty-summary"></p>') +
          (r.hosting
            ? this.ui.button('start-room', waiting ? 'Start expedition' : result ? 'Back to lobby' : 'Retry level', 'play', true)
            : '') +
          (r.hosting && waiting && loadProgress(roomSave)
            ? this.ui.button('resume-room', 'Continue saved campaign')
            : '') +
          this.ui.button('leave-room', 'Leave room') +
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
      const picker = get('room-difficulty') as HTMLSelectElement | null;
      if (picker) picker.onchange = () => r.setDifficulty(readDifficulty(picker.value));
      if (r.hosting) {
        get('start-room').onclick = () => state.phase === 'finished' ? r.returnToLobby() : r.start();
        if (waiting) {
          const mode = get('room-mode') as HTMLSelectElement;
          mode.onchange = () => r.configureHunt(mode.value === 'hunt' ? r.slot : 0);
          const seat = get('monster-seat') as HTMLSelectElement;
          seat.onchange = () => r.configureHunt(Number(seat.value));
        }
      }
      if (get('resume-room')) get('resume-room').onclick = () => r.start(true);
      get('leave-room').onclick = () => this.leave();
    }
    if (state.phase === 'waiting') {
      const hunt = state.hunt;
      get('mode-brief').textContent = hunt
        ? 'Monster Hunt · ' + (hunt.monster === r.slot ? 'You are the Bacteria.' : 'Explorer ' + hunt.monster + ' is the Bacteria.') +
          ' The monster tracks footsteps and nearby voices and grabs with E. Explorers must unlock the Level 0 service exit.' +
          (state.players.length < 2 ? ' Waiting for a second player.' : '')
        : 'Campaign co-op · Everyone plays an explorer.';
      if (r.hosting) {
        (get('room-mode') as HTMLSelectElement).value = hunt ? 'hunt' : 'coop';
        const seat = get('monster-seat') as HTMLSelectElement;
        const options = state.players.map(p => '<option value="' + p.slot + '">Explorer ' + p.slot + (p.slot === r.slot ? ' (you)' : '') + '</option>').join('');
        if (seat.innerHTML !== options) seat.innerHTML = options;
        get('monster-choice').hidden = !hunt;
        if (hunt) seat.value = String(hunt.monster);
        (get('start-room') as HTMLButtonElement).disabled = !!hunt && (state.players.length < 2 || !state.players.some(p => p.slot === hunt.monster));
        const resume = get('resume-room');
        if (resume) resume.hidden = !!hunt;
      }
    }
    const difficulty = readDifficulty(state.journal.difficulty);
    const summary = get('room-difficulty-summary');
    if (summary) summary.textContent = difficultyName(difficulty) + ' · ' + lifeCount(livesPerLevel[difficulty]) + ' per explorer per level';
    get('room-roster').textContent =
      r.migrating ? 'Finding the next host…' : state.players.length + ' / ' + capacity + ' explorers · You are Explorer ' + r.slot + ' · Host ' + r.hostSeat;
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
      get('coop-leave').textContent = 'Leave room';
      get('coop-leave').onclick = () => this.leave();
      (get('world') as HTMLCanvasElement).focus();
    } catch {
      if (generation === this.generation)
        this.error('Could not load the multiplayer world. Check graphics acceleration and try again.');
    }
  }
  private error(message: string, code?: string) {
    this.disconnect();
    this.ui.panel(
      'coop-error',
      'Multiplayer',
      'Room unavailable',
      '<p class="panel-text" id="room-error" role="alert"></p>' +
        (code ? this.ui.button('retry-room', 'Rejoin room ' + code, 'play', true) : '') +
        this.ui.button('rooms-back', 'Back to multiplayer'),
      () => this.menu(),
    );
    get('room-error').textContent = message;
    if (code) get('retry-room').onclick = () => void this.connect(code, false);
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
