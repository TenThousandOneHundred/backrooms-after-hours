import './style.css';
import { icon } from './icons';
import { Horror } from './horror';
import { VoiceInput } from './voice-input';
import { parseMod, MOD_LIMIT, type ModPack } from './mods';
import { loadProgress } from './game-state';
import type { Game, GameCallbacks, GameSettings } from './game';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const home = el('home'),
  hud = el('hud'),
  overlay = el('overlay'),
  panel = el('panel');
const enter = el<HTMLButtonElement>('enter');
const settingsKey = 'backrooms-after-hours:settings';
const defaults: GameSettings = { volume: 0.65, sensitivity: 1, quality: 'high', headBob: true };
function readSettings(): GameSettings {
  try {
    const data = JSON.parse(localStorage.getItem(settingsKey) || '{}');
    return {
      volume: typeof data.volume === 'number' ? Math.min(1, Math.max(0, data.volume)) : defaults.volume,
      sensitivity: typeof data.sensitivity === 'number' ? Math.min(2, Math.max(0.25, data.sensitivity)) : 1,
      quality: data.quality === 'standard' ? 'standard' : 'high',
      headBob:
        typeof data.headBob === 'boolean'
          ? data.headBob
          : !matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  } catch {
    return { ...defaults };
  }
}
const settings = readSettings();
const horror = new Horror();
horror.setVolume(settings.volume);
let lastVolume = settings.volume || 0.65;
type InstalledMod = ModPack & { slot: string };
let selectedMod: InstalledMod | undefined;
let activeMod: InstalledMod | undefined;
const modKey = 'backrooms-after-hours.last-mod.v1';
let modRequest = 0;
let game: Game | null = null;
let runtime: typeof import('./game') | undefined;
let campaign: typeof import('./campaign') | undefined;
let pendingLoad: Promise<void> | null = null;
let runSummary: ReturnType<(typeof import('./game'))['readSummary']> = null;
let mode = 'home';
let manualTab = 'controls';
let returnTo = 'home';
let previousFocus: HTMLElement | null = null;
let inventory: string[] = [];
let toastTimer = 0;
const safe = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const actions = (id: string, text: string, symbol = '', primary = false) =>
  '<button type="button" class="secondary ' +
  (primary ? 'primary' : '') +
  '" id="' +
  id +
  '">' +
  (symbol ? icon(symbol) : '') +
  safe(text) +
  '</button>';
const wire = (id: string, fn: () => void) => el(id)?.addEventListener('click', fn);

document.querySelectorAll<HTMLElement>('[data-icon]').forEach((node) => {
  node.innerHTML = icon(node.dataset.icon!);
});
function notify(message: string) {
  const node = el('toast');
  node.textContent = message;
  node.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (node.hidden = true), 4300);
}
let voiceEnabled = false;
let roomMicEnabled = false;
let radioHeld = false;
let liveStream: MediaStream | undefined;
let voiceRoom: import('./multiplayer/room').Room | undefined;
const micEnabled = () => voiceRoom ? roomMicEnabled : voiceEnabled;
function setMicEnabled(value: boolean) {
  if (voiceRoom) roomMicEnabled = value;
  else voiceEnabled = value;
}
const mic = new VoiceInput(message => {
  setMicEnabled(false);
  radioHeld = false;
  refreshMic();
  notify(message);
}, stream => {
  liveStream = stream;
  routeRoomMic();
});
function routeRoomMic() {
  const room = voiceRoom;
  if (!room) return;
  room.voice.setStream(roomMicEnabled && !radioHeld ? liveStream : undefined);
  void room.radio.setStream(radioHeld ? liveStream : undefined).catch(() => {
    if (voiceRoom !== room || !radioHeld) return;
    radioHeld = false;
    syncMic();
    notify('Walkie-talkie audio could not start. Hold V to try again.');
  });
}
function releaseRadio() {
  if (!radioHeld) return;
  radioHeld = false;
  syncMic();
}
function refreshMic(volume = 0, heard = false) {
  const live = mic.state === 'live';
  el('mic-label').textContent = live ? (heard ? 'Heard you' : radioHeld ? 'Radio mic' : voiceRoom ? 'Voice chat on' : 'Mic live') :
    mic.state === 'starting' ? 'Connecting…' : 'Mic off';
  const meter = el<HTMLMeterElement>('mic-level');
  meter.value = live ? volume : 0;
  meter.hidden = !live;
  el('mic-hud').classList.toggle('heard', live && heard);
}
function syncMic() {
  const playing = mode === 'playing' && !document.hidden;
  voiceRoom?.setListening(playing);
  if ((micEnabled() || radioHeld) && playing) {
    routeRoomMic();
    void mic.start().then(() => refreshMic());
  } else mic.stop();
  refreshMic();
}
function updateSound() {
  const btn = el<HTMLButtonElement>('sound');
  const name = settings.volume > 0 ? 'Mute audio' : 'Enable audio';
  btn.innerHTML = icon(settings.volume > 0 ? 'speaker' : 'muted');
  btn.title = name;
  btn.setAttribute('aria-label', name);
}
function updateFullscreen() {
  const btn = el<HTMLButtonElement>('fullscreen');
  const label = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen';
  btn.innerHTML = icon(document.fullscreenElement ? 'shrink' : 'full');
  btn.title = label;
  btn.setAttribute('aria-label', label);
}
function persistSettings() {
  try {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
  } catch {
    /* Settings still apply in this session. */
  }
  horror.setVolume(settings.volume);
  game?.applySettings({ ...settings });
  voiceRoom?.setVolume(settings.volume);
  updateSound();
}
function refreshHome() {
  const saved = runtime ? runtime.readSummary() : loadProgress();
  runSummary = saved ? { stage: saved.stage, endings: saved.endings } : null;
  el('enter-text').textContent = runSummary ? 'Continue single player' : 'Single player';
  el('new-game').hidden = !runSummary;
}
function loadRuntime() {
  if (!pendingLoad)
    pendingLoad = Promise.all([import('./game'), import('./campaign')])
      .then(async ([g, c]) => {
        await Promise.all([g.loadBacteria(), g.loadResidents(), g.loadLevelCreatures()]);
        runtime = g;
        campaign = c;
        refreshHome();
      })
      .catch((err) => {
        pendingLoad = null;
        throw err;
      });
  return pendingLoad;
}
function showPanel(next: string, section: string, title: string, body: string, back?: () => void) {
  if (overlay.hidden) previousFocus = document.activeElement as HTMLElement;
  mode = next;
  overlay.dataset.mode = next;
  overlay.hidden = false;
  panel.setAttribute('aria-labelledby', 'dialog-title');
  panel.innerHTML =
    '<div class="panel-head"><div><span class="micro">' +
    safe(section) +
    '</span><h2 id="dialog-title">' +
    safe(title) +
    '</h2></div>' +
    (back
      ? '<button class="icon-button" type="button" id="close-dialog" aria-label="Close">' +
        icon('close') +
        '</button>'
      : '') +
    '</div>' +
    body;
  if (back) wire('close-dialog', back);
  panel.focus({ preventScroll: true });
}
function hidePanel() {
  overlay.hidden = true;
  delete overlay.dataset.mode;
  panel.replaceChildren();
}
function titleScreen() {
  rooms?.disconnect();
  horror.clear();
  game?.dispose();
  game = null;
  activeMod = undefined;
  inventory = [];
  hud.hidden = true;
  home.hidden = false;
  mode = 'home';
  syncMic();
  hidePanel();
  refreshHome();
  el('toast').hidden = true;
  if (previousFocus?.isConnected && home.contains(previousFocus))
    previousFocus.focus({ preventScroll: true });
}
function closeSubmenu() {
  if (returnTo === 'pause' && game) pauseMenu();
  else {
    hidePanel();
    mode = 'home';
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
}
const controls = [
  ['Move', ['W', 'A', 'S', 'D']],
  ['Look', ['Mouse']],
  ['Interact / read', ['E']],
  ['Flashlight / lidar', ['F']],
  ['Toggle mic for monsters and nearby teammates', ['M']],
  ['Hold to use the co-op walkie-talkie', ['V']],
  ['Sprint / crouch', ['Shift', 'C']],
  ['Jump', ['Space']],
  ['Field inventory', ['Tab']],
  ['Almond water / energy bar', ['1', '2']],
  ['Pause / release mouse', ['Esc']],
] as const;
function manual() {
  const endingNames: Record<string, string> = activeMod ? { 'mod-escape': activeMod.name } : campaign?.ENDINGS ?? {
    wrong: 'Wrong Door',
    suburbs: 'The Suburbs',
    pink: 'The Pink House',
    city: 'Empty City',
    final: 'Final Escape',
  };
  const endings = game?.roomEndings ?? (activeMod ? loadProgress(activeMod.slot) : runtime?.readSummary())?.endings ?? [];
  const contents =
    manualTab === 'controls'
      ? controls
          .map(
            ([a, keys]) =>
              '<div class="control-row"><span>' +
              a +
              '</span><div class="keyset">' +
              keys.map((k) => '<kbd>' + k + '</kbd>').join('') +
              '</div></div>',
          )
          .join('') +
        '<p class="panel-text controls-foot">Use headphones to hear threats around corners. If your mouse is free, click the game view to look around.</p>'
      : '<p class="panel-text">Discovered endings stay in your field record across checkpoints.</p>' +
        Object.entries(endingNames)
          .map(
            ([id, name]) =>
              '<div class="record-row ' +
              (endings.includes(id) ? '' : 'locked') +
              '">' +
              icon(endings.includes(id) ? 'check' : 'lock') +
              safe(endings.includes(id) ? name : 'Undiscovered ending') +
              '</div>',
          )
          .join('');
  showPanel(
    'manual',
    'EXPEDITION REFERENCE',
    'Field manual',
    '<div class="tabs"><button class="tab ' +
      (manualTab === 'controls' ? 'active' : '') +
      '" id="controls-tab">Controls</button><button class="tab ' +
      (manualTab === 'endings' ? 'active' : '') +
      '" id="records-tab">Ending record</button><span class="trophy-count">' +
      endings.length +
      ' / ' +
      Object.keys(endingNames).length +
      '</span></div>' +
      contents,
    closeSubmenu,
  );
  wire('controls-tab', () => {
    manualTab = 'controls';
    manual();
    el('controls-tab').focus();
  });
  wire('records-tab', () => {
    manualTab = 'endings';
    manual();
    el('records-tab').focus();
  });
}
function settingsMenu() {
  showPanel(
    'settings',
    'TERMINAL PREFERENCES',
    'Settings',
    '<div class="setting"><label for="volume">Master volume</label><div><input id="volume" type="range" min="0" max="100" value="' +
      Math.round(settings.volume * 100) +
      '"><output id="vol-out"></output></div></div>' +
      '<div class="setting"><label for="sensitivity">Mouse sensitivity</label><div><input id="sensitivity" type="range" min="25" max="200" step="5" value="' +
      Math.round(settings.sensitivity * 100) +
      '"><output id="sens-out"></output></div></div>' +
      '<div class="setting"><label for="quality">Graphics quality</label><select id="quality"><option value="high">High</option><option value="standard">Standard</option></select></div>' +
      '<div class="setting"><label for="head-bob">Head movement</label><input type="checkbox" id="head-bob" ' +
      (settings.headBob ? 'checked' : '') +
      '></div><div class="setting"><label for="voice-enabled">' + (voiceRoom ? 'Speak to nearby teammates and monsters' : 'Monsters hear my microphone') + '</label>' +
      '<input type="checkbox" id="voice-enabled" aria-describedby="voice-help"' + (micEnabled() ? ' checked' : '') + '></div>' +
      '<p class="panel-text" id="voice-help">' + (voiceRoom
        ? 'Press M for proximity chat. Hold V to broadcast to the team. Monsters can hear both ends of a radio call.'
        : 'Press M during play to let monsters hear you. In single player your audio stays on this device.') + '</p>' +
      '<div class="panel-buttons">' +
      actions('settings-done', 'Done', 'check', true) +
      '</div>',
    closeSubmenu,
  );
  const vol = el<HTMLInputElement>('volume'),
    sens = el<HTMLInputElement>('sensitivity'),
    quality = el<HTMLSelectElement>('quality'),
    bob = el<HTMLInputElement>('head-bob');
  quality.value = settings.quality;
  const outputs = () => {
    el('vol-out').textContent = Math.round(settings.volume * 100) + '%';
    el('sens-out').textContent = settings.sensitivity.toFixed(2) + '×';
  };
  outputs();
  vol.oninput = () => {
    settings.volume = Number(vol.value) / 100;
    persistSettings();
    outputs();
  };
  sens.oninput = () => {
    settings.sensitivity = Number(sens.value) / 100;
    persistSettings();
    outputs();
  };
  quality.onchange = () => {
    settings.quality = quality.value === 'standard' ? 'standard' : 'high';
    persistSettings();
  };
  bob.onchange = () => {
    settings.headBob = bob.checked;
    persistSettings();
  };
  const voiceToggle = el<HTMLInputElement>('voice-enabled');
  voiceToggle.onchange = () => { setMicEnabled(voiceToggle.checked); };
  wire('settings-done', closeSubmenu);
}
function pauseMenu() {
  if (!game) return;
  returnTo = 'pause';
  showPanel(
    'pause',
    'EXPEDITION ON HOLD',
    'Paused',
    '<div class="panel-buttons">' +
      actions('resume', 'Resume', 'play', true) +
      actions('pause-manual', 'Field manual', 'book') +
      actions('pause-settings', 'Settings', 'settings') +
      actions('title', 'Title screen', 'exit') +
      '</div>',
    () => game?.resume(),
  );
  wire('resume', () => game?.resume());
  wire('pause-manual', manual);
  wire('pause-settings', settingsMenu);
  wire('title', titleScreen);
}
function showInventory() {
  if (!game) return;
  game.pause();
  showPanel(
    'inventory',
    'FIELD EQUIPMENT',
    'Inventory',
    inventory.length
      ? '<div class="item-list">' +
          inventory.map((v) => '<span class="item">' + safe(v) + '</span>').join('') +
          '</div>'
      : '<p class="panel-text">Your pack is empty.</p>',
    () => game?.resume(),
  );
}
const endingText: Record<string, string> = {
  wrong: 'The slide was a way out of the level. You wake in the Bunker with another route to follow.',
  suburbs:
    'You land on a quiet residential street. Every house is still. The Bunker waits on the other side.',
  pink: 'The toys are back where they belong. A room in the pink house has been set aside for you.',
  city: 'The elevator opens onto an empty city. This ending is now recorded in the Bunker.',
  final: 'The arcade lights come up. For the first time, someone is here to open the door.',
};
const callbacks: GameCallbacks = {
  microphone: dt => mic.read(dt),
  haunt: (event) => horror.haunt(event),
  dread: (level) => horror.dread(level),
  scare: (encounter) => horror.scare(encounter),
  message: notify,
  hud: (h) => {
    refreshMic(h.voice, h.heardVoice);
    el('hud-label').textContent = h.label;
    el('hud-name').textContent = (activeMod?.stages ?? campaign?.stages)?.[h.stage]?.name ?? h.stage;
    el('hud-objective').textContent = h.objective;
    const prompt = el('interact');
    prompt.hidden = !h.prompt;
    prompt.querySelector('span')!.textContent = h.prompt;
    el<HTMLMeterElement>('stamina').value = h.stamina;
    el<HTMLMeterElement>('sanity').value = h.sanity;
    inventory = h.items;
  },
  screen: (screen, detail) => {
    radioHeld = false;
    if (screen !== 'playing') {
      voiceRoom?.setListening(false);
      mic.stop();
      refreshMic();
      horror.quiet();
    }
    if (screen === 'playing') {
      mode = 'playing';
      syncMic();
      home.hidden = true;
      hud.hidden = false;
      hidePanel();
      return;
    }
    if(screen==='spectating'){
      mode='spectating';hidePanel();hud.hidden=false;
      el('hud-objective').textContent=(detail??'You were caught.')+' Watching a teammate. You rejoin at the next level.';
      el('interact').hidden=true;
      return;
    }
    if (screen === 'pause') {
      pauseMenu();
      return;
    }
    if (screen === 'death') {
      const cause = detail || 'Your signal went dark.';
      const advice = /bacteria/i.test(cause)
        ? 'Break its line of sight at a corner, then crouch or hide before it follows.'
        : /hound/i.test(cause)
          ? 'Face the Hound and use your flashlight to make it retreat.'
          : /smiler/i.test(cause)
            ? 'Keep moving when you hear the Smiler. Save enough stamina to reach the next lit refuge.'
            : /partygoer/i.test(cause)
              ? 'Crouch around the Partygoers. A table gives you somewhere to hide.'
              : '';
      showPanel(
        'death',
        'EXPEDITION TERMINATED',
        'You died',
        '<p class="panel-text">' +
          safe(cause + (advice ? ' ' + advice : '')) +
          '</p><div class="panel-buttons">' +
          actions('retry', 'Retry checkpoint', 'play', true) +
          actions('title', 'Title screen', 'exit') +
          '</div>',
      );
      wire('retry', () => game?.retry());
      wire('title', titleScreen);
      return;
    }
    if (screen === 'ending') {
      home.hidden = true;
      hud.hidden = true;
      if (activeMod) {
        showPanel('ending', activeMod.name, 'You escaped', '<div class="panel-buttons">' +
          actions('title', 'Title screen', 'exit', true) + '</div>');
        wire('title', titleScreen);
        return;
      }
      const id = detail || 'final';
      showPanel(
        'ending',
        'ENDING RECORDED',
        campaign?.ENDINGS[id] ?? 'Escape',
        '<p class="panel-text">' +
          safe(endingText[id] || 'Your discovery has been recorded.') +
          '</p><div class="panel-buttons">' +
          (game?.guest ? '<p class="panel-text">Waiting for the host to continue.</p>' : actions('ending-continue', id === 'final' ? 'Continue exploring' : 'Continue', 'arrow', true)) +
          actions('title', 'Title screen', 'exit') +
          '</div>',
      );
      if(!game?.guest) wire('ending-continue', () => game?.continueEnding());
      wire('title', titleScreen);
      return;
    }
    if (screen === 'code') {
      showPanel(
        'code',
        'SECURITY TERMINAL',
        'Access code',
        '<p class="panel-text">' +
          safe(detail || 'Enter the sequence.') +
          '</p><form id="keypad"><input id="code-input" class="code-input" autocomplete="off" spellcheck="false" maxlength="32" aria-label="Access code"><div class="panel-buttons"><button class="secondary primary" type="submit">Submit code</button>' +
          actions('cancel-code', 'Back') +
          '</div></form>',
        () => game?.closeCode(),
      );
      wire('cancel-code', () => game?.closeCode());
      el('keypad').onsubmit = (e) => {
        e.preventDefault();
        game?.submitCode(el<HTMLInputElement>('code-input').value.trim());
      };
      el<HTMLInputElement>('code-input').focus();
      return;
    }
  },
};
async function startRun(resume: boolean, mod?: InstalledMod) {
  horror.unlock();
  horror.preload();
  horror.clear();
  enter.disabled = true;
  el('toast').hidden = true;
  try {
    if (mod) showPanel('loading', mod.name, 'Entering expedition', '');
    if (!runtime) await loadRuntime();
    hidePanel();
    game?.dispose();
    activeMod = mod;
    game = new runtime!.Game(el<HTMLCanvasElement>('world'), callbacks, mod);
    game.applySettings({ ...settings });
    game.start(resume);
  } catch (err) {
    game?.dispose();
    game = null;
    home.hidden = false;
    hud.hidden = true;
    showPanel(
      'error',
      'TERMINAL MESSAGE',
      'Unable to enter',
      '<p class="panel-text">' +
        safe(
          err instanceof Error
            ? err.message
            : 'The 3D renderer could not start. Enable hardware acceleration and try again.',
        ) +
        '</p>',
      titleScreen,
    );
    console.error(err);
  } finally {
    enter.disabled = false;
  }
}
wire('enter', () => void startRun(!!runSummary));
let rooms: import('./multiplayer/menu').RoomMenu | undefined;
async function multiplayer() {
  if(enter.disabled)return;
  const requestedMode=mode;
  try {
    const {RoomMenu}=await import('./multiplayer/menu');
    if(mode!==requestedMode)return;
    rooms ??= new RoomMenu({
      panel:showPanel,button:actions,exit:titleScreen,
      prepare:async()=>{await Promise.all([loadRuntime(), (await import('./multiplayer/explorers')).loadExplorer()]);},
      enter:room=>{
        roomMicEnabled=false; radioHeld=false; voiceRoom=room; room.setVolume(settings.volume);
        activeMod=undefined; horror.unlock(); horror.preload(); horror.clear();
        game=new runtime!.Game(el<HTMLCanvasElement>('world'), callbacks, undefined, room);
        game.applySettings(settings); game.start(false);
      },
      stop:()=>{
        radioHeld=false; voiceRoom?.setListening(false); mic.stop(); voiceRoom=undefined; roomMicEnabled=false;
        game?.dispose();game=null;horror.clear();hud.hidden=true;
      },
    });
    rooms.menu();
  }catch{notify('Could not load multiplayer. Check your connection and try again.');}
}
wire('multiplayer',()=>void multiplayer());
window.addEventListener('pagehide',()=>{rooms?.disconnect();});
wire('new-game', () => {
  showPanel(
    'new',
    'EXPEDITION RECORD',
    'Start over?',
    '<p class="panel-text">Starting a new run replaces your checkpoint and ending record on this browser.</p><div class="panel-buttons">' +
      actions('cancel-new', 'Keep current run') +
      actions('confirm-new', 'Start new run', 'play', true) +
      '</div>',
    titleScreen,
  );
  wire('cancel-new', titleScreen);
  wire('confirm-new', () => void startRun(false));
});
async function installMod(getSource: () => Promise<string>, remember: boolean) {
  const request = ++modRequest;
  const status = el('mod-status');
  status.textContent = 'Reading expedition…';
  try {
    const source = await getSource();
    const pack = parseMod(source);
    const bytes = new TextEncoder().encode(JSON.stringify(JSON.parse(source)));
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const digest = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
    if (request !== modRequest || !status.isConnected) return;
    selectedMod = { ...pack, slot: 'backrooms-after-hours.mod.v1.' + digest };
    let warning = '';
    if (remember) {
      try { localStorage.setItem(modKey, source); }
      catch { warning = 'Available this session. Import the file again after reloading.'; }
    }
    modsMenu(warning);
  } catch (error) {
    if (request === modRequest && status.isConnected)
      status.textContent = error instanceof Error ? error.message : 'Could not read the mod file.';
  }
}
function modsMenu(message = '') {
  const pack = selectedMod;
  const save = pack ? loadProgress(pack.slot) : null;
  const finished = save?.pending?.ending === 'mod-escape';
  const playLabel = finished ? 'Play again' : save ? 'Resume mod' : 'Play mod';
  const levelCount = pack ? Object.keys(pack.stages).length : 0;
  const summary = pack ? '<div class="mod-selection"><strong>' + safe(pack.name) + '</strong><span>' +
    levelCount + (levelCount === 1 ? ' level' : ' levels') + (finished ? ' · Escaped' : '') +
    '</span></div>' : '';
  showPanel('mods', 'Custom expeditions', 'Mods',
    '<p class="panel-text">Import a JSON mod or try the sample expedition.</p>' +
    '<div class="mod-links"><a href="./modding.html" target="_blank" rel="noopener">Modding guide ↗</a>' +
    '<a href="./mods/dead-letter.json" download>Download sample</a></div>' +
    '<div class="panel-buttons">' + actions('mod-import', 'Import file') + actions('mod-example', 'Load sample') +
    '</div><input type="file" accept=".json,application/json" id="mod-file" hidden>' +
    '<p class="mod-status" id="mod-status" role="status">' + safe(message) + '</p>' + summary +
    (pack ? '<div class="panel-buttons">' + actions('mod-play', playLabel, 'play', true) +
      (save && !finished ? actions('mod-restart', 'Start over') : '') + '</div>' : ''), closeSubmenu);
  wire('mod-import', () => el<HTMLInputElement>('mod-file').click());
  el<HTMLInputElement>('mod-file').onchange = event => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void installMod(async () => {
      if (file.size > MOD_LIMIT) throw new Error('File limit is 128 KiB.');
      return file.text();
    }, true);
  };
  wire('mod-example', () => void installMod(async () => {
    const response = await fetch('./mods/dead-letter.json');
    if (!response.ok) throw new Error('The sample could not be loaded.');
    return response.text();
  }, true));
  if (pack) {
    wire('mod-play', () => void startRun(!!save && !finished, pack));
    wire('mod-restart', () => {
      showPanel('mod-restart', pack.name, 'Restart mod?',
        '<p class="panel-text">This replaces this mod’s checkpoint.</p><div class="panel-buttons">' +
        actions('keep-mod', 'Keep checkpoint') + actions('restart-mod', 'Restart', 'play', true) +
        '</div>', () => modsMenu());
      wire('keep-mod', () => modsMenu());
      wire('restart-mod', () => void startRun(false, pack));
    });
  }
}
wire('mods', () => {
  returnTo = 'home';
  modsMenu();
  if (!selectedMod) {
    try {
      const previous = localStorage.getItem(modKey);
      if (previous) void installMod(async () => previous, false);
    } catch { /* Manual import still works. */ }
  }
});
wire('manual', () => {
  returnTo = 'home';
  manualTab = 'controls';
  manual();
});
wire('settings', () => {
  returnTo = 'home';
  settingsMenu();
});
wire('sound', () => {
  if (settings.volume > 0) {
    lastVolume = settings.volume;
    settings.volume = 0;
  } else settings.volume = lastVolume;
  persistSettings();
  notify(settings.volume ? 'Audio enabled' : 'Audio muted');
});
wire('fullscreen', () => {
  void (
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
  ).catch(() => notify('Fullscreen is unavailable in this window.'));
});
wire('hud-bag', showInventory);
wire('hud-pause', () => game?.pause());
window.addEventListener('pagehide', () => { radioHeld=false; mic.stop(); });
window.addEventListener('keyup', e => { if(e.code==='KeyV') releaseRadio(); }, true);
window.addEventListener('blur', releaseRadio);
document.addEventListener('visibilitychange', () => { if(document.hidden) releaseRadio(); });
document.addEventListener('fullscreenchange', updateFullscreen);
document.addEventListener(
  'keydown',
  (event) => {
    if (voiceRoom && mode === 'playing' && event.code === 'KeyV' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (!event.repeat && !radioHeld) {
        radioHeld = true;
        syncMic();
      }
      return;
    }
    if (mode === 'playing' && event.code === 'KeyM' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (!event.repeat) {
        setMicEnabled(!micEnabled());
        syncMic();
      }
      return;
    }
    if (event.code === 'Tab' && (mode === 'playing' || mode === 'inventory')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      if (mode === 'playing') showInventory();
      else game?.resume();
      return;
    }
    if (event.code === 'Escape' && mode.startsWith('coop-')) {
      if (!overlay.hidden) el('close-dialog')?.click();
      return;
    }
    if (event.code === 'Escape' && !['playing', 'home'].includes(mode)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (mode === 'pause' || mode === 'inventory') game?.resume();
      else if (mode === 'code') game?.closeCode();
      else if (mode === 'mod-restart') modsMenu();
      else if (mode === 'mods' || mode === 'settings' || mode === 'manual') closeSubmenu();
      else if (mode === 'new' || mode === 'error') titleScreen();
      return;
    }
    if (event.key === 'Tab' && !overlay.hidden) {
      const buttons = [...panel.querySelectorAll<HTMLElement>('button, input:not([hidden]), select, a[href], [tabindex="0"]')];
      if (!buttons.length) return;
      const first = buttons[0],
        last = buttons.at(-1)!;
      if ((document.activeElement === first || document.activeElement === panel) && event.shiftKey) {
        event.preventDefault();
        last.focus();
      } else if (document.activeElement === last && !event.shiftKey) {
        event.preventDefault();
        first.focus();
      }
    }
  },
  true,
);
updateSound();
updateFullscreen();
refreshHome();
window.setTimeout(() => {
  void loadRuntime().catch(() => {
    /* Retry from the start button if loading failed. */
  });
}, 0);
