import * as THREE from 'three';
import { ENDINGS, START, stages, type GameObject, type Stage } from './campaign';
import { buildWorld, terrainHeight, TILE } from './world';
import { Encounter, clearSight, tileAt } from './game-entity';
import { Soundscape } from './game-sound';
import { FieldChallenge } from './campaign-challenges';
import { EndingCinema } from './ending-cinema';
import './campaign-challenges.css';
import { freshProgress, loadProgress, storeProgress, type Progress } from './game-state';

export type GameSettings = {
  sensitivity: number;
  volume: number;
  headBob: boolean;
  quality: 'standard' | 'high';
};
export type GameHUD = {
  stage: string;
  label: string;
  objective: string;
  prompt: string;
  stamina: number;
  sanity: number;
  items: string[];
};
type Screen = 'playing' | 'pause' | 'death' | 'ending' | 'code';
export type GameCallbacks = {
  hud: (h: GameHUD) => void;
  message: (s: string) => void;
  screen: (s: Screen, detail?: string) => void;
  scare?: (encounter: { kind: string; lethal: boolean; frame?: string }) => void;
  dread?: (intensity: number) => void;
  haunt?: (event: 'flicker' | 'steps' | 'breath' | 'silhouette') => void;
};
export function readSummary(): { stage: string; endings: string[] } | null {
  const state = loadProgress();
  return state && stages[state.stage]
    ? { stage: state.stage, endings: state.endings.filter((id) => Object.hasOwn(ENDINGS, id)) }
    : null;
}
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const pitFloor = (stage: Stage, x: number, z: number) => {
  const tile = tileAt(stage, x / TILE, z / TILE);
  return tile === 'X' || (tile === '|' && Math.abs(x / TILE - Math.round(x / TILE)) * TILE > 0.56);
};
const labelOf = (id: string) => id.replace(/[-_:]/g, ' ');
const controls = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'KeyC',
  'Space',
  'KeyF',
  'KeyE',
  'Digit1',
  'Digit2',
]);
const defaultSettings: GameSettings = { sensitivity: 1, volume: 0.65, headBob: true, quality: 'high' };

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(70, 1, 0.06, 145);
  private lamp = new THREE.SpotLight(0xfff2d1, 0, 29, 0.54, 0.56, 1.15);
  private lampTarget = new THREE.Object3D();
  private world?: ReturnType<typeof buildWorld>;
  private encounter?: Encounter;
  private stage!: Stage;
  private state: Progress = freshProgress(START);
  private mode: Screen | 'idle' = 'idle';
  private settings: GameSettings = { ...defaultSettings };
  private sound = new Soundscape();
  private challenge = new FieldChallenge();
  private cinema?: EndingCinema;
  private keys = new Set<string>();
  private listeners = new AbortController();
  private resizeObserver?: ResizeObserver;
  private pointerOwned = false;
  private dragging = false;
  private dragX = 0;
  private dragY = 0;
  private x = 0;
  private z = 0;
  private y = 0;
  private vy = 0;
  private yaw = 0;
  private pitch = 0;
  private grounded = true;
  private crouchBlend = 0;
  private hidden = false;
  private hideName = '';
  private cycle = 0;
  private footDist = 0;
  private sprintLocked = false;
  private time = 0;
  private alarmTime = 0;
  private grace = 0;
  private lastFrame = 0;
  private hudTimer = 0;
  private saveTimer = 0;
  private frameId = 0;
  private lastHUD = '';
  private target?: GameObject;
  private keypad?: GameObject;
  private activeClock = 0;
  private lastScare = -90;
  private nextHaunt = 11;
  private scareStages = new Set<string>();
  private dreadTimer = 0;
  private tension = 0;
  private nextBeat = 0;
  private lobbyWarning = -1;
  private enemyWasVisible = false;
  private scan?: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private scanAge = 100;
  private warnedStorage = false;
  private disposed = false;
  private vector = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private aimOffsets = new Map<string, THREE.Vector3>();

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: GameCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.camera.rotation.order = 'YXZ';
    this.lamp.position.set(0.12, -0.1, -0.12);
    this.lampTarget.position.set(0.04, -0.05, -7);
    this.camera.add(this.lamp, this.lampTarget);
    this.lamp.target = this.lampTarget;
    const opts = { signal: this.listeners.signal };
    window.addEventListener('keydown', this.onKeyDown, opts);
    window.addEventListener('keyup', this.onKeyUp, opts);
    window.addEventListener('blur', this.onBlur, opts);
    window.addEventListener('pagehide', this.saveOnExit, opts);
    document.addEventListener('visibilitychange', this.onHidden, opts);
    document.addEventListener('pointerlockchange', this.lockChanged, opts);
    document.addEventListener('mousemove', this.mouseMove, opts);
    canvas.addEventListener('pointerdown', this.mouseDown, opts);
    window.addEventListener('pointerup', this.mouseUp, opts);
    window.addEventListener('resize', this.resize, opts);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.resize);
      this.resizeObserver.observe(canvas);
    }
    this.resize();
  }
  applySettings(settings: GameSettings) {
    this.settings = {
      sensitivity: clamp(settings.sensitivity, 0.25, 2),
      volume: clamp(settings.volume, 0, 1),
      headBob: settings.headBob,
      quality: settings.quality,
    };
    this.sound.setVolume(this.settings.volume);
    this.resize();
  }
  private resize = () => {
    const w = this.canvas.clientWidth || innerWidth,
      h = this.canvas.clientHeight || innerHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.settings.quality === 'high' ? 1.65 : 1));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    if (this.cinema) this.cinema.render(this.renderer, this.camera.aspect, 0);
    else if (this.world) this.renderer.render(this.scene, this.camera);
  };
  start(resume: boolean) {
    if (this.disposed) return;
    const state = resume ? loadProgress() : null;
    this.state = state && stages[state.stage] ? state : freshProgress(START);
    this.activeClock = 0;
    this.lastScare = -90;
    this.scareStages.clear();
    this.nextHaunt = 11;
    this.nextBeat = 0;
    this.state.endings = this.state.endings.filter((id) => Object.hasOwn(ENDINGS, id));
    if (
      this.state.pending &&
      (!Object.hasOwn(ENDINGS, this.state.pending.ending) || !stages[this.state.pending.target])
    )
      this.state.pending = null;
    this.mode = 'playing';
    this.sound.unlock();
    if (!this.state.pending) this.capture();
    this.enter(this.state.stage, !!state);
    if (this.state.pending) this.change('ending', this.state.pending.ending);
    else this.change('playing');
    this.persist();
    this.run();
  }
  private enter(id: string, restore = false) {
    this.challenge.clear();
    const stage = stages[id];
    if (!stage) throw new Error(`Unknown campaign destination ${id}`);
    this.clearScan();
    this.scene.remove(this.camera);
    this.world?.dispose();
    this.scene = new THREE.Scene();
    this.stage = stage;
    this.world = buildWorld(this.scene, stage);
    this.scene.add(this.camera);
    this.encounter = stage.threat ? new Encounter(stage, TILE) : undefined;
    this.state.stage = id;
    this.time = 0;
    this.alarmTime = 0;
    this.grace = ['run', 'hotelchase'].includes(id) ? 2.75 : 8;
    this.enemyWasVisible = false;
    this.lobbyWarning = -1;
    this.tension = 0;
    this.callbacks.dread?.(0);
    this.keys.clear();
    this.hidden = false;
    this.hideName = '';
    this.target = undefined;
    this.keypad = undefined;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.cycle = 0;
    this.footDist = 0;
    this.crouchBlend = 0;
    this.sprintLocked = false;
    const saved = restore ? this.state.position : null;
    if (saved && this.canStand(saved.x, saved.z) && !pitFloor(stage, saved.x, saved.z)) {
      this.x = saved.x;
      this.z = saved.z;
      this.yaw = saved.yaw;
      this.pitch = clamp(saved.pitch, -1.36, 1.36);
    } else {
      this.x = stage.spawn[0] * TILE;
      this.z = stage.spawn[1] * TILE;
      this.yaw = stage.facing ?? this.bestFacing();
      this.pitch = 0;
    }
    // Recover at least a little on a level transition to avoid loading into an immediate sanity death.
    if (!restore) {
      this.state.sanity = Math.max(42, this.state.sanity);
      this.state.stamina = Math.max(60, this.state.stamina);
    }
    if (!restore || !this.state.checkpoint) this.markCheckpoint();
    this.aimOffsets.clear();
    this.world.objects.forEach((mesh, id) => {
      const obj = stage.objects.find((o) => o.id === id);
      if (!obj) return;
      const box = new THREE.Box3().setFromObject(mesh);
      if (!box.isEmpty()) {
        const v = box.getCenter(new THREE.Vector3());
        const floor = terrainHeight(stage, v.x, v.z);
        v.y = clamp(v.y, floor + 0.35, floor + 1.85);
        this.aimOffsets.set(id, v);
      }
      if (this.done(obj)) this.placeCompleted(obj);
    });
    this.sound.ambience(`${stage.theme} ${stage.id}`.toLowerCase());
    this.lastHUD = '';
    this.cameraPose(0, false);
    this.refreshHUD();
    this.persist();
  }
  private bestFacing() {
    const [sx, sz] = this.stage.spawn;
    let best = 0,
      distance = -1;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        dx = Math.round(Math.sin(a)),
        dz = -Math.round(Math.cos(a));
      let length = 0;
      while (length < 8 && tileAt(this.stage, sx + dx * (length + 1), sz + dz * (length + 1)) !== '#')
        length++;
      if (length > distance) {
        distance = length;
        best = a;
      }
    }
    return best;
  }
  private change(next: Screen, detail?: string) {
    this.cinema?.dispose();
    this.cinema = undefined;
    if (next === 'ending' && detail) {
      this.cinema = new EndingCinema(detail);
      this.cinema.render(this.renderer, this.camera.aspect, 0);
    }
    if (next !== 'playing') this.challenge.clear();
    this.mode = next;
    this.keys.clear();
    this.dragging = false;
    if (next !== 'playing' && document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.sound.pause(next !== 'playing');
    if (next !== 'playing') this.callbacks.dread?.(0);
    this.callbacks.screen(next, detail);
    if (next === 'playing') {
      this.refreshHUD();
      this.lastFrame = performance.now();
    }
  }
  pause() {
    if (this.mode === 'playing') {
      this.persist();
      this.change('pause');
    }
  }
  resume() {
    if (this.mode === 'pause') this.returnToPlay();
  }
  private returnToPlay() {
    this.sound.unlock();
    this.change('playing');
    this.capture();
  }
  retry() {
    if (this.mode !== 'death') return;
    this.state.position = this.state.checkpoint;
    this.state.sanity = 100;
    this.state.stamina = 100;
    this.enter(this.state.stage, true);
    this.returnToPlay();
    this.persist();
  }
  continueEnding() {
    if (this.mode !== 'ending' || !this.state.pending) return;
    const target = this.state.pending.target;
    this.state.pending = null;
    this.state.sanity = 100;
    this.state.stamina = 100;
    this.enter(target);
    this.returnToPlay();
    this.persist();
  }
  submitCode(text: string) {
    if (this.mode !== 'code' || !this.keypad) return;
    const panel = this.keypad;
    if (text.trim().toUpperCase() !== (panel.code ?? '').trim().toUpperCase()) {
      this.sound.event('locked');
      this.callbacks.message('Incorrect sequence. Check the clues nearby.');
      return;
    }
    this.keypad = undefined;
    this.complete(panel);
    this.returnToPlay();
  }
  closeCode() {
    if (this.mode === 'code') {
      this.keypad = undefined;
      this.returnToPlay();
    }
  }
  private capture() {
    if (document.pointerLockElement === this.canvas || !this.canvas.requestPointerLock) return;
    try {
      const pending = this.canvas.requestPointerLock();
      if (pending && typeof pending.catch === 'function') void pending.catch(() => {});
    } catch {
      /* Drag and arrow controls are always available. */
    }
  }
  private lockChanged = () => {
    const owned = document.pointerLockElement === this.canvas;
    if (this.pointerOwned && !owned && this.mode === 'playing') this.pause();
    this.pointerOwned = owned;
  };
  private onBlur = () => {
    this.keys.clear();
    this.dragging = false;
    if (this.mode === 'playing') this.pause();
  };
  private onHidden = () => {
    if (document.hidden) this.onBlur();
  };
  private saveOnExit = () => {
    if (this.stage) this.persist();
  };
  private mouseDown = (e: PointerEvent) => {
    if (this.mode !== 'playing' || e.button !== 0) return;
    this.sound.unlock();
    this.dragging = true;
    this.dragX = e.clientX;
    this.dragY = e.clientY;
    if (!this.pointerOwned) this.capture();
  };
  private mouseUp = () => {
    this.dragging = false;
  };
  private mouseMove = (e: MouseEvent) => {
    if (this.mode !== 'playing') return;
    if (!this.pointerOwned && !this.dragging) return;
    const dx = this.pointerOwned ? e.movementX : e.clientX - this.dragX,
      dy = this.pointerOwned ? e.movementY : e.clientY - this.dragY;
    this.dragX = e.clientX;
    this.dragY = e.clientY;
    const sensitivity = 0.00212 * this.settings.sensitivity;
    this.yaw += dx * sensitivity;
    this.pitch = clamp(this.pitch - dy * sensitivity, -1.36, 1.36);
  };
  private onKeyDown = (e: KeyboardEvent) => {
    if (this.mode !== 'playing') return;
    if (e.code === 'Escape') {
      e.preventDefault();
      this.pause();
      return;
    }
    if (!controls.has(e.code)) return;
    e.preventDefault();
    this.keys.add(e.code);
    if (e.repeat) return;
    if (e.code === 'KeyE') this.interact();
    else if (e.code === 'KeyF') this.flashlight();
    else if (e.code === 'Space' && this.grounded && !this.hidden) {
      this.vy = 4.9;
      this.grounded = false;
    } else if (e.code === 'Digit1' || e.code === 'Digit2')
      this.consume(e.code === 'Digit1' ? 'almond' : 'bar');
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private has(key: string) {
    return this.state.flags.includes(key) || this.state.endings.includes(key);
  }
  private done(o: GameObject) {
    return this.state.completed.includes(`${this.stage.id}/${o.id}`);
  }
  private eligible(o: GameObject) {
    return (
      !!(o.kind === 'ending' && o.ending && this.state.endings.includes(o.ending)) ||
      (o.need ?? []).every((flag) => this.has(flag))
    );
  }
  private prettyNeed(flag: string) {
    for (const s of Object.values(stages)) {
      const o = s.objects.find((obj) => obj.gives?.includes(flag));
      if (o) return o.name.replace(/^(take|pick up|collect|use|read|find|retrieve|grab)\s+/i, '');
    }
    return ENDINGS[flag] ?? labelOf(flag);
  }
  private interact() {
    if (this.challenge.object) {
      if (this.challenge.press()) this.finishChallenge();
      return;
    }
    if (this.hidden) {
      this.hidden = false;
      this.callbacks.message('You step out of hiding.');
      this.sound.event('use');
      this.refreshHUD();
      return;
    }
    this.target = this.findTarget();
    const obj = this.target;
    if (!obj) return;
    if (this.done(obj) && ['switch', 'code', 'pickup'].includes(obj.kind)) {
      this.callbacks.message(obj.description ?? 'Already completed.');
      return;
    }
    if (!this.eligible(obj)) {
      this.sound.event('locked');
      const first = obj.need?.find((flag) => !this.has(flag));
      this.callbacks.message(first ? `Still needed: ${this.prettyNeed(first)}` : 'The way is blocked.');
      return;
    }
    if (obj.kind === 'hide') {
      this.hidden = true;
      this.hideName = obj.name;
      this.sound.event('use');
      this.callbacks.message(obj.description ?? 'You stay still and wait.');
      this.refreshHUD();
      return;
    }
    if (obj.kind === 'note') {
      this.callbacks.message(obj.description ?? obj.name);
      this.sound.event('use');
      if (obj.gives?.length && !this.done(obj)) this.complete(obj, false);
      return;
    }
    if (obj.challenge) {
      const mesh = this.world?.objects.get(obj.id),
        origin = mesh?.position.clone();
      this.challenge.start(obj, () => {
        if (mesh && origin) mesh.position.copy(origin);
      });
      return;
    }
    if (obj.kind === 'code') {
      this.keypad = obj;
      this.change('code', obj.name);
      return;
    }
    this.complete(obj);
  }
  private placeCompleted(obj: GameObject) {
    const mesh = this.world?.objects.get(obj.id);
    if (!mesh) return;
    const spec = obj.challenge;
    if (spec?.kind === 'haul') {
      const drop = this.stage.objects.find(
        (o) => o.gives?.includes(spec.destination) || o.id === spec.destination,
      );
      if (drop) {
        const group = this.stage.objects.filter(
          (o) => o.challenge?.kind === 'haul' && o.challenge.destination === spec.destination,
        );
        const slot = group.findIndex((o) => o.id === obj.id) - (group.length - 1) / 2;
        mesh.position.set(drop.x * TILE + slot * 0.95, 0, drop.z * TILE + (group.length > 1 ? 0.9 : 0));
        mesh.visible = true;
      }
    } else if (obj.kind === 'pickup') mesh.visible = false;
  }
  private finishChallenge() {
    const obj = this.challenge.object;
    this.challenge.clear();
    if (obj) this.complete(obj);
  }
  private updateChallenge(dt: number) {
    const obj = this.challenge.object;
    if (!obj?.challenge) return;
    const spec = obj.challenge;
    const mesh = this.world?.objects.get(obj.id);
    const range = Math.hypot(this.x - obj.x * TILE, this.z - obj.z * TILE);
    let entityInFrame = false;
    if (spec.kind === 'entity-photo' && this.encounter) {
      const dx = this.encounter.x - this.x / TILE,
        dz = this.encounter.z - this.z / TILE,
        d = Math.hypot(dx, dz);
      const facing = (Math.sin(this.yaw) * dx - Math.cos(this.yaw) * dz) / Math.max(0.01, d);
      entityInFrame =
        d < 14 &&
        facing > 0.89 &&
        clearSight(this.stage, this.x / TILE, this.z / TILE, this.encounter.x, this.encounter.z);
    }
    const destination =
      spec.kind === 'haul'
        ? this.stage.objects.find((o) => o.gives?.includes(spec.destination) || o.id === spec.destination)
        : undefined;
    const dropRange = destination
      ? Math.hypot(this.x - destination.x * TILE, this.z - destination.z * TILE)
      : Infinity;
    const outcome = this.challenge.tick({
      dt,
      holding: this.keys.has('KeyE'),
      range,
      aimed: this.findTarget()?.id === obj.id,
      entityInFrame,
      dropRange,
      moveCargo: () => {
        if (mesh) {
          mesh.position.x = this.x - Math.sin(this.yaw) * 1.18;
          mesh.position.z = this.z + Math.cos(this.yaw) * 1.18;
        }
      },
    });
    if (outcome === 'done') this.finishChallenge();
    else if (outcome === 'cancelled') {
      this.challenge.clear();
      this.callbacks.message('You step away from the equipment.');
    }
  }
  private complete(obj: GameObject, notify = true) {
    for (const flag of obj.consumes ?? []) {
      this.state.flags = this.state.flags.filter((f) => f !== flag);
      delete this.state.inventory[flag];
    }
    for (const flag of obj.gives ?? []) {
      if (!this.state.flags.includes(flag)) this.state.flags.push(flag);
      if (obj.kind === 'pickup' && obj.challenge?.kind !== 'haul')
        this.state.inventory[flag] = obj.name.replace(/^(take|pick up|collect|find|retrieve|grab)\s+/i, '');
    }
    if (obj.kind !== 'exit' && obj.kind !== 'ending' && !this.done(obj))
      this.state.completed.push(`${this.stage.id}/${obj.id}`);
    this.placeCompleted(obj);
    this.sound.event(
      obj.kind === 'pickup' ? 'pickup' : obj.kind === 'exit' || obj.kind === 'ending' ? 'exit' : 'use',
    );
    if (obj.kind === 'ending' && obj.ending) {
      const id = obj.ending;
      if (!this.state.endings.includes(id)) this.state.endings.push(id);
      if (!this.state.flags.includes(id)) this.state.flags.push(id);
      this.state.pending = { ending: id, target: obj.target ?? START };
      this.persist();
      this.change('ending', id);
      return;
    }
    if (obj.target && stages[obj.target]) {
      this.enter(obj.target);
      if (notify) this.callbacks.message(this.stage.description);
      return;
    }
    if (obj.gives?.includes('archive-alarm')) {
      this.alarmTime = 18;
      this.sound.alarm();
    }
    if (!this.encounter || this.encounter.danger < 0.42) this.markCheckpoint();
    if (notify) this.callbacks.message(obj.description ?? obj.name);
    this.refreshHUD();
    this.persist();
  }
  private consume(type: 'almond' | 'bar') {
    const entry = Object.entries(this.state.inventory).find(([key, name]) =>
      type === 'almond'
        ? /almond/i.test(key + ' ' + name)
        : /(^|[- ])bar([ -]|$)|energy bar/i.test(key + ' ' + name),
    );
    if (!entry) {
      this.callbacks.message(
        type === 'almond' ? 'No almond water in your inventory.' : 'No energy bars in your inventory.',
      );
      return;
    }
    if ((type === 'almond' && this.state.sanity >= 99) || (type === 'bar' && this.state.stamina >= 99)) {
      this.callbacks.message(type === 'almond' ? 'Your sanity is full.' : 'Your stamina is full.');
      return;
    }
    delete this.state.inventory[entry[0]];
    this.state.flags = this.state.flags.filter((f) => f !== entry[0]);
    if (type === 'almond') this.state.sanity = Math.min(100, this.state.sanity + 54);
    else {
      this.state.stamina = Math.min(100, this.state.stamina + 80);
      this.sprintLocked = false;
    }
    this.callbacks.message(
      type === 'almond' ? 'Almond water steadies your nerves.' : 'Energy bar consumed. Stamina restored.',
    );
    this.sound.event('pickup');
    this.persist();
    this.refreshHUD();
  }
  private findTarget(): GameObject | undefined {
    this.camera.getWorldDirection(this.direction);
    let best: GameObject | undefined,
      score = -Infinity;
    for (const o of this.stage.objects) {
      if (o.model === 'pit' || (o.kind === 'pickup' && this.done(o))) continue;
      const meshPos = this.aimOffsets.get(o.id);
      this.vector
        .set(meshPos?.x ?? o.x * TILE, meshPos?.y ?? 1, meshPos?.z ?? o.z * TILE)
        .sub(this.camera.position);
      const horizontal = Math.hypot(this.vector.x, this.vector.z);
      if (horizontal > TILE * 1.1 || !clearSight(this.stage, this.x / TILE, this.z / TILE, o.x, o.z))
        continue;
      const dist = this.vector.length(),
        dot = this.vector.normalize().dot(this.direction);
      const lax = horizontal < 0.84 ? -0.2 : horizontal < 1.75 ? 0.5 : 0.78;
      if (dot < lax && horizontal > 0.52) continue;
      const rank = 3.8 * dot - 0.48 * dist - (this.done(o) && o.kind !== 'note' ? 0.25 : 0);
      if (rank > score) {
        best = o;
        score = rank;
      }
    }
    return best;
  }
  private refreshHUD() {
    if (!this.stage) return;
    this.target = this.findTarget();
    const obj = this.target;
    let prompt = '';
    if (this.hidden) prompt = 'Leave hiding place';
    else if (obj && !this.challenge.object)
      prompt =
        obj.kind === 'note'
          ? obj.name
          : obj.kind === 'hide'
            ? obj.name
            : this.done(obj) && obj.kind !== 'exit' && obj.kind !== 'ending'
              ? `${obj.name} · completed`
              : obj.name;
    const items = Object.values(this.state.inventory);
    const hud = {
      stage: this.stage.id,
      label: this.stage.label,
      objective: this.stage.objective ?? this.stage.description,
      prompt,
      stamina: Math.round(this.state.stamina),
      sanity: Math.round(this.state.sanity),
      items,
    };
    const encoded = JSON.stringify(hud);
    if (encoded !== this.lastHUD) {
      this.lastHUD = encoded;
      this.callbacks.hud(hud);
    }
  }
  private canStand(x: number, z: number) {
    const r = 0.27;
    const loX = Math.floor((x - r) / TILE + 0.5),
      hiX = Math.floor((x + r) / TILE + 0.5),
      loZ = Math.floor((z - r) / TILE + 0.5),
      hiZ = Math.floor((z + r) / TILE + 0.5);
    for (let iz = loZ; iz <= hiZ; iz++)
      for (let ix = loX; ix <= hiX; ix++)
        if (tileAt(this.stage, ix, iz) === '#') {
          const nearX = clamp(x, (ix - 0.5) * TILE, (ix + 0.5) * TILE),
            nearZ = clamp(z, (iz - 0.5) * TILE, (iz + 0.5) * TILE);
          if (Math.hypot(x - nearX, z - nearZ) < r) return false;
        }
    return true;
  }
  private markCheckpoint() {
    if (this.grounded && !['X', '!'].includes(tileAt(this.stage, this.x / TILE, this.z / TILE)))
      this.state.checkpoint = { x: this.x, z: this.z, yaw: this.yaw, pitch: this.pitch };
  }
  private persist() {
    if (!this.stage) return;
    if (this.grounded && !pitFloor(this.stage, this.x, this.z) && !this.hidden && this.mode !== 'death')
      this.state.position = { x: this.x, z: this.z, yaw: this.yaw, pitch: this.pitch };
    const ok = storeProgress(this.state);
    if (!ok && !this.warnedStorage) {
      this.warnedStorage = true;
      this.callbacks.message('Browser storage unavailable. Progress will last for this session.');
    }
  }
  private cameraPose(dt: number, moving: boolean) {
    const crouch =
      this.hidden || this.keys.has('KeyC') || this.keys.has('ControlLeft') || this.keys.has('ControlRight');
    this.crouchBlend = THREE.MathUtils.damp(this.crouchBlend, crouch ? 1 : 0, 12, dt);
    const bob =
      this.settings.headBob && moving && this.grounded && !this.hidden ? Math.sin(this.cycle) * 0.027 : 0;
    const floor = terrainHeight(this.stage, this.x, this.z);
    const swell = this.stage.id === 'depths' ? Math.sin(this.time * 1.4) * 0.1 : 0;
    this.camera.position.set(this.x, floor + 1.58 - 0.61 * this.crouchBlend + this.y + bob + swell, this.z);
    this.camera.rotation.set(this.pitch, -this.yaw, 0, 'YXZ');
    this.camera.updateMatrixWorld(true);
    const scanner = this.isScanner();
    this.lamp.intensity = scanner ? 0 : this.state.flashlight && !this.hidden ? 12 : 0;
  }
  private isScanner() {
    return this.stage.id === 'dark' || /lights out/i.test(this.stage.name);
  }
  private flashlight() {
    if (this.isScanner()) {
      if (this.has('lidar')) this.lidar();
      else this.callbacks.message('Find the handheld LiDAR to scan this area.');
      return;
    }
    if (!this.has('torch')) {
      this.callbacks.message('Find a flashlight first.');
      return;
    }
    this.state.flashlight = !this.state.flashlight;
    this.sound.event('click');
    this.persist();
  }
  private lidar() {
    this.clearScan();
    this.scanAge = 0;
    this.sound.event('scan');
    const coords: number[] = [],
      colors: number[] = [];
    for (let j = 0; j < 32; j++)
      for (let i = 0; i < 69; i++) {
        const a = this.yaw + (i / 68 - 0.5) * 2.35,
          p = this.pitch + (j / 31 - 0.5) * 1.58;
        const dx = Math.sin(a) * Math.cos(p),
          dz = -Math.cos(a) * Math.cos(p),
          dy = Math.sin(p);
        for (let d = 0.35; d < 29; d += 0.2) {
          const x = this.x + dx * d,
            y = this.camera.position.y + dy * d,
            z = this.z + dz * d;
          if (y > 0.08 && y < 2.92 && tileAt(this.stage, x / TILE, z / TILE) !== '#') continue;
          coords.push(x - dx * 0.17, clamp(y - dy * 0.16, 0.065, 2.94), z - dz * 0.17);
          const v = clamp(1 - d / 38, 0.26, 1);
          colors.push(0.12 * v, 0.94 * v, 0.73 * v);
          break;
        }
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.scan = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.044,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(this.scan);
  }
  private clearScan() {
    if (this.scan) {
      this.scene.remove(this.scan);
      this.scan.geometry.dispose();
      this.scan.material.dispose();
      this.scan = undefined;
    }
  }
  private die(reason: string) {
    this.state.position = this.state.checkpoint;
    this.state.sanity = 100;
    this.state.stamina = 100;
    this.sound.event('death');
    this.change('death', reason);
    this.persist();
  }
  private step(dt: number) {
    this.time += dt;
    this.activeClock += dt;
    this.grace = Math.max(0, this.grace - dt);
    if (this.keys.has('ArrowLeft')) this.yaw -= 1.9 * this.settings.sensitivity * dt;
    if (this.keys.has('ArrowRight')) this.yaw += 1.9 * this.settings.sensitivity * dt;
    const f =
      Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) -
      Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const s = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    const crouched = this.keys.has('KeyC') || this.keys.has('ControlLeft') || this.keys.has('ControlRight');
    const moving = (f !== 0 || s !== 0) && !this.hidden;
    const sprint =
      moving &&
      !this.challenge.hauling &&
      !crouched &&
      !this.sprintLocked &&
      (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'));
    this.state.stamina = clamp(this.state.stamina + (sprint ? -11.5 : 7.3) * dt, 0, 100);
    if (this.state.stamina <= 0.1) this.sprintLocked = true;
    else if (this.state.stamina >= 20) this.sprintLocked = false;
    const beforeX = this.x,
      beforeZ = this.z;
    if (moving) {
      const norm = Math.hypot(f, s);
      const speed = crouched ? 1.38 : sprint ? 5.35 : 3.12;
      const dx = ((Math.sin(this.yaw) * f + Math.cos(this.yaw) * s) * speed * dt) / norm;
      const dz = ((-Math.cos(this.yaw) * f + Math.sin(this.yaw) * s) * speed * dt) / norm;
      if (this.canStand(this.x + dx, this.z)) this.x += dx;
      if (this.canStand(this.x, this.z + dz)) this.z += dz;
    }
    const tile = tileAt(this.stage, this.x / TILE, this.z / TILE);
    const onPit = pitFloor(this.stage, this.x, this.z);
    if (onPit || !this.grounded) {
      this.grounded = false;
      this.vy -= 12.8 * dt;
      this.y += this.vy * dt;
      if (!onPit && this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.grounded = true;
      }
      if (this.y < -0.95) {
        const pit =
          this.stage.objects.find(
            (obj) =>
              obj.model === 'pit' &&
              Math.round(this.x / TILE) === obj.x &&
              Math.round(this.z / TILE) === obj.z,
          ) ?? this.stage.objects.find((obj) => obj.model === 'pit');
        if (pit && this.eligible(pit) && pit.target) {
          this.complete(pit);
          return;
        }
        this.die('You fell into the dark.');
        return;
      }
    }
    const distance = Math.hypot(this.x - beforeX, this.z - beforeZ);
    this.cycle += distance * (crouched ? 5.8 : 5);
    this.footDist += this.grounded ? distance : 0;
    if (this.footDist > (sprint ? 1.65 : crouched ? 1 : 1.46)) {
      this.footDist = 0;
      this.sound.step(sprint, crouched, /pool|water|ocean|cave|depth/.test(this.stage.theme));
    }
    this.cameraPose(dt, distance > 0.001);
    this.updateChallenge(dt);
    if (this.encounter) {
      const day = this.stage.id === 'village' && (this.time % 80 < 32 || this.time % 80 >= 69);
      if (
        this.stage.id === 'lobby' &&
        this.lobbyWarning < 0 &&
        (this.time > 66 || this.state.flags.some((f) => /^rail\d/.test(f)))
      ) {
        this.lobbyWarning = this.time;
        this.haunt('steps');
        this.nextHaunt = Math.max(this.nextHaunt, this.activeClock + 27);
      }
      const lurking =
        this.stage.id === 'lobby' && (this.lobbyWarning < 0 || this.time - this.lobbyWarning < 9);
      const offDuty =
        lurking ||
        day ||
        (this.stage.threat?.kind === 'camera' && this.has('office-camera')) ||
        (this.stage.id === 'outpost' && this.has('cured-agent'));
      this.alarmTime = Math.max(0, this.alarmTime - dt);
      this.encounter.tick(
        dt,
        this.x / TILE,
        this.z / TILE,
        this.yaw,
        distance > 0.001,
        sprint,
        crouched,
        this.hidden,
        this.state.flashlight,
        offDuty ? 1 : this.grace,
        this.alarmTime > 0 ? this.stage.objects.find((o) => o.gives?.includes('archive-alarm')) : undefined,
      );
      const mesh = this.world?.entity;
      if (mesh) {
        if (this.stage.id === 'village' || this.stage.id === 'lobby') mesh.visible = !offDuty;
        mesh.position.x = this.encounter.x * TILE;
        mesh.position.z = this.encounter.z * TILE;
        mesh.rotation.y = this.encounter.angle;
      }
      if (this.encounter.contact && this.stage.threat?.kind === 'camera') {
        if (!this.has('office-camera')) {
          this.enter(this.stage.id);
          this.callbacks.message('The camera caught you. Stay low or disable the security feed.');
          return;
        }
      } else if (this.encounter.contact) {
        this.callbacks.scare?.({
          kind: this.stage.threat!.kind,
          lethal: true,
          frame: this.contactFrame(this.stage.threat!.kind),
        });
        this.lastScare = this.activeClock;
        this.die(`Caught by ${labelOf(this.stage.threat!.kind)}.`);
        return;
      }
      this.closeEncounter(offDuty);
    }
    const danger = this.encounter?.danger ?? 0;
    const sanityDelta = this.hidden ? 0.75 : tile === '!' ? -11 : danger > 0.56 ? -2.2 * danger : -0.016;
    this.state.sanity = clamp(this.state.sanity + sanityDelta * dt, 0, 100);
    if (this.state.sanity === 0) {
      this.die('You lost your bearings in the dark.');
      return;
    }
    let pan = 0;
    if (this.encounter) {
      const dx = this.encounter.x - this.x / TILE,
        dz = this.encounter.z - this.z / TILE;
      pan = (dx * Math.cos(this.yaw) + dz * Math.sin(this.yaw)) / Math.max(1, Math.hypot(dx, dz));
    }
    this.sound.tick(dt, danger, pan);
    this.world?.update(this.time, dt);
    this.tension = THREE.MathUtils.damp(
      this.tension,
      this.hidden ? 0 : danger,
      danger > this.tension ? 3.6 : 1.4,
      dt,
    );
    this.dreadTimer += dt;
    if (this.dreadTimer >= 1 / 6) {
      this.dreadTimer = 0;
      this.callbacks.dread?.(this.tension);
    }
    if (this.activeClock >= this.nextHaunt) {
      const events =
        this.stage.theme === 'pool' || this.stage.theme === 'ocean'
          ? (['breath', 'steps', 'silhouette'] as const)
          : (['flicker', 'steps', 'silhouette', 'breath'] as const);
      if (!this.hidden && danger < 0.6) {
        this.haunt(events[this.nextBeat % events.length]);
        this.nextBeat++;
      }
      const noise = Math.abs(Math.sin(this.nextBeat * 47.47 + this.stage.id.length * 8.13));
      this.nextHaunt = this.activeClock + 22 + noise * 45;
    }
    if (this.scan) {
      this.scanAge += dt;
      this.scan.material.opacity = clamp(1 - (this.scanAge - 2.5) / 5, 0, 1);
      if (this.scanAge > 7.5) this.clearScan();
    }
    this.hudTimer += dt;
    this.saveTimer += dt;
    if (this.hudTimer > 0.085) {
      this.hudTimer = 0;
      this.refreshHUD();
    }
    if (this.saveTimer > 2) {
      this.saveTimer = 0;
      if (distance > 0.001 || this.keys.size || danger > 0.1) this.persist();
    }
  }
  private haunt(event: 'flicker' | 'steps' | 'breath' | 'silhouette') {
    this.world?.haunt(event, this.camera);
    this.callbacks.haunt?.(event);
  }
  private contactFrame(kind: string): string | undefined {
    const mesh = this.world?.entity;
    if (!mesh || ['smiler', 'bacteria', 'hound'].includes(kind)) return;
    const camera = new THREE.PerspectiveCamera(66, this.camera.aspect, 0.06, 100),
      bounds = new THREE.Box3().setFromObject(mesh);
    const size = bounds.getSize(new THREE.Vector3()),
      head = bounds.getCenter(new THREE.Vector3());
    head.y = bounds.min.y + size.y * 0.73;
    const facing = mesh.getWorldDirection(new THREE.Vector3());
    facing.y = 0;
    facing.normalize();
    const distance = clamp(size.y * 0.69, 1.1, 2.8);
    let eye = head.clone().addScaledVector(facing, distance);
    if (tileAt(this.stage, eye.x / TILE, eye.z / TILE) === '#') {
      const towardPlayer = new THREE.Vector3(this.x - head.x, 0, this.z - head.z).normalize();
      eye = head.clone().addScaledVector(towardPlayer, distance);
    }
    eye.y = head.y + 0.05;
    camera.position.copy(eye);
    camera.fov = 66;
    camera.lookAt(head);
    camera.updateProjectionMatrix();
    const rim = new THREE.PointLight(0xffd1a2, 7, 5, 1.35);
    rim.position.copy(eye);
    rim.position.y += 0.25;
    this.scene.add(rim);
    try {
      this.renderer.render(this.scene, camera);
      return this.canvas.toDataURL('image/jpeg', 0.78);
    } catch {
      return undefined;
    } finally {
      this.scene.remove(rim);
      rim.dispose();
      this.renderer.render(this.scene, this.camera);
    }
  }
  private closeEncounter(offDuty: boolean) {
    const e = this.encounter;
    if (!e || !this.stage.threat || offDuty || this.hidden) {
      this.enemyWasVisible = false;
      return;
    }
    const dx = e.x - this.x / TILE,
      dz = e.z - this.z / TILE,
      d = Math.hypot(dx, dz);
    const facing = (Math.sin(this.yaw) * dx - Math.cos(this.yaw) * dz) / Math.max(d, 0.01);
    const visible =
      d < 2.35 && facing > 0.42 && clearSight(this.stage, this.x / TILE, this.z / TILE, e.x, e.z);
    if (
      visible &&
      !this.enemyWasVisible &&
      e.danger > 0.6 &&
      this.grace <= 0 &&
      this.activeClock - this.lastScare > 62 &&
      !this.scareStages.has(this.stage.id)
    ) {
      this.callbacks.scare?.({ kind: this.stage.threat.kind, lethal: false });
      this.scareStages.add(this.stage.id);
      this.lastScare = this.activeClock;
    }
    this.enemyWasVisible = visible;
  }
  private run() {
    if (this.frameId) return;
    this.lastFrame = performance.now();
    this.frameId = requestAnimationFrame(this.frame);
  }
  private frame = (now: number) => {
    if (this.disposed) return;
    const elapsed = clamp((now - this.lastFrame) / 1000, 0, 0.14);
    this.lastFrame = now;
    if (this.mode === 'playing') {
      const n = Math.max(1, Math.ceil(elapsed / 0.032));
      for (let i = 0; i < n && this.mode === 'playing'; i++) this.step(elapsed / n);
      if (this.mode === 'playing') this.renderer.render(this.scene, this.camera);
    } else if (this.mode === 'ending' && this.cinema)
      this.cinema.render(this.renderer, this.camera.aspect, elapsed);
    this.frameId = requestAnimationFrame(this.frame);
  };
  dispose() {
    if (this.disposed) return;
    if (this.stage) this.persist();
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.listeners.abort();
    this.resizeObserver?.disconnect();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.cinema?.dispose();
    this.cinema = undefined;
    this.challenge.clear();
    this.sound.dispose();
    this.clearScan();
    this.scene.remove(this.camera);
    this.world?.dispose();
    this.renderer.dispose();
  }
}
