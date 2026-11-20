import { campaignAtmosphere } from './level-atmosphere';
import * as THREE from 'three';
export { loadLevelCreatures } from './level-creatures';
export { loadResidents } from './residents';
export { loadBacteria } from './bacteria';
import { ENDINGS, START, stages as campaignStages, type GameObject, type Stage } from './campaign';
import { buildWorld, terrainHeight, TILE } from './world';
import { Encounter, canStandAt, clearSight, playerSpeed, tileAt } from './game-entity';
import { Soundscape } from './game-sound';
import { Explorers } from './multiplayer/explorers';
import type { Room } from './multiplayer/room';
import type { Pose, Monster } from './multiplayer/expedition';
import { recordObjective } from './campaign-progress';
import { FieldChallenge } from './campaign-challenges';
import type { ModPack } from './mods';
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
  voice: number;
  heardVoice: boolean;
};
type Screen = 'playing' | 'pause' | 'death' | 'ending' | 'code' | 'spectating';
export type GameCallbacks = {
  hud: (h: GameHUD) => void;
  message: (s: string) => void;
  screen: (s: Screen, detail?: string) => void;
  scare?: (encounter: { kind: string; lethal: boolean; frame?: string }) => void;
  dread?: (intensity: number) => void;
  microphone?: (dt: number) => number;
  haunt?: (event: 'flicker' | 'steps' | 'breath' | 'silhouette') => void;
};
export function readSummary(): { stage: string; endings: string[] } | null {
  const state = loadProgress();
  return state && campaignStages[state.stage]
    ? { stage: state.stage, endings: state.endings.filter((id) => Object.hasOwn(ENDINGS, id)) }
    : null;
}
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const pitFloor = (stage: Stage, x: number, z: number) => {
  const tile = tileAt(stage, x / TILE, z / TILE);
  return tile === 'X' || (tile === '|' && Math.abs(x / TILE - Math.round(x / TILE)) * TILE > 0.56);
};
const labelOf = (id: string) => id.replace(/[-_:]/g, ' ');
const creatureNames: Record<string, string> = {
  neighborhoodwatch: 'the Neighborhood Watch', farmer: 'the Farmer Faceling',
  bonethief: 'the Bone Thief', partyhost: 'the Party Host', membri: 'the Aranea Membri',
  scratcher: 'the Scratcher',
};
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
export { playerSpeed };
const defaultSettings: GameSettings = { sensitivity: 1, volume: 0.65, headBob: true, quality: 'high' };

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(70, 1, 0.06, 145);
  private lamp = new THREE.SpotLight(0xfff2d1, 0, 29, 0.54, 0.56, 1.15);
  private lampTarget = new THREE.Object3D();
  private world?: ReturnType<typeof buildWorld>;
  private encounter?: Encounter;
  private additionalHunters: { encounter: Encounter; mesh: THREE.Group; kind: string; height: number }[] = [];
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
  private lockerView?: { eye: THREE.Vector3; facing: number; yaw: number; pitch: number };
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
  private nextRing = 0;
  private residentHint = '';
  private voice = 0;
  private heardTime = 0;
  private nextLockerScrape = 0;
  private receiverScareAt = -1;
  private phone?: GameObject;
  private enemyWasVisible = false;
  private scan?: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private scanAge = 100;
  private warnedStorage = false;
  private disposed = false;
  private entityCenterHeight = 1;
  private projected = new THREE.Vector3();
  private lightOrigin = new THREE.Vector3();
  private lightAxis = new THREE.Vector3();
  private vector = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private aimOffsets = new Map<string, THREE.Vector3>();

  private team?: Explorers;
  private epoch = -1;
  private revision = -1;
  private poseTime = 0;
  private frameTime = 0;
  private moving = false;
  private sprinting = false;
  private restoredSupply = 0;
  private spawnId = 0;
  private cargoOrigins = new Map<string,THREE.Vector3>();
  private carrying = '';
  get guest() { return !!this.room && !this.room.hosting; }
  get roomEndings() { return this.room ? this.state.endings : undefined; }
  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: GameCallbacks,
    private mod?: ModPack & { slot: string },
    private room?: Room,
  ) {
    if(room) this.team = new Explorers();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.lamp.shadow.mapSize.set(512, 512);
    this.lamp.shadow.camera.near = .15;
    this.lamp.shadow.bias = -.0004;
    this.lamp.shadow.normalBias = .018;
    this.lamp.shadow.autoUpdate = false;
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
    this.renderer.shadowMap.enabled = this.settings.quality === 'high';
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
    if (this.room) {
      this.sound.unlock();
      this.syncTeam(0);
      this.run();
      return;
    }
    const state = resume ? loadProgress(this.mod?.slot) : null;
    const stages = this.mod?.stages ?? campaignStages;
    const validEnding = (id: string) => this.mod ? id === 'mod-escape' : Object.hasOwn(ENDINGS, id);
    this.state = state && stages[state.stage] ? state : freshProgress(this.mod?.start ?? START);
    this.activeClock = 0;
    this.lastScare = -90;
    this.scareStages.clear();
    this.nextHaunt = 11;
    this.nextBeat = 0;
    this.state.endings = this.state.endings.filter(validEnding);
    if (
      this.state.pending &&
      (!validEnding(this.state.pending.ending) || !stages[this.state.pending.target])
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
    const stage = (this.mod?.stages ?? campaignStages)[id];
    if (!stage) throw new Error(`Unknown campaign destination ${id}`);
    this.clearScan();
    this.scene.remove(this.camera);
    this.world?.dispose();
    this.scene = new THREE.Scene();
    this.stage = stage;
    this.world = buildWorld(this.scene, stage, this.mod ? undefined : campaignAtmosphere(stage.id));
    if (this.world.entity) this.entityCenterHeight = new THREE.Box3().setFromObject(this.world.entity).getCenter(this.vector).y;
    this.scene.add(this.camera);
    this.team?.attach(this.scene);
    this.encounter = stage.threat ? new Encounter(stage, TILE) : undefined;
    this.additionalHunters = this.world.additionalEntities.map(({site, mesh}) => ({
      encounter: new Encounter(stage, TILE, site), mesh, kind: site.kind,
      height: new THREE.Box3().setFromObject(mesh).getCenter(this.vector).y,
    }));
    this.state.stage = id;
    this.time = 0;
    this.alarmTime = 0;
    this.grace = ['run', 'hotelchase'].includes(id) ? 2.75 : 8;
    this.enemyWasVisible = false;
    this.lobbyWarning = -1;
    this.nextRing = 0;
    this.residentHint = '';
    this.heardTime = 0;
    this.nextLockerScrape = 0;
    this.receiverScareAt = -1;
    this.phone = stage.objects.find(o => o.model === 'telephone');
    this.tension = 0;
    this.callbacks.dread?.(0);
    this.keys.clear();
    this.hidden = false;
    this.lockerView = undefined;
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
    this.cargoOrigins.clear();this.carrying='';
    this.world.objects.forEach((mesh, id) => {
      const obj = stage.objects.find((o) => o.id === id);
      if (!obj) return;
      if(this.room && obj.challenge?.kind==='haul')this.cargoOrigins.set(id,mesh.position.clone());
      const box = new THREE.Box3().setFromObject(mesh);
      if (!box.isEmpty()) {
        const v = box.getCenter(new THREE.Vector3());
        const floor = terrainHeight(stage, v.x, v.z);
        v.y = clamp(v.y, floor + 0.35, floor + 1.85);
        this.aimOffsets.set(id, v);
      }
      if (this.done(obj)) this.placeCompleted(obj);
    });
    this.sound.ambience(`${stage.theme} ${stage.id}`.toLowerCase(), this.mod ? undefined : stage.id);
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
    if (next === 'ending' && detail && !this.mod) {
      this.cinema = new EndingCinema(detail);
      this.cinema.render(this.renderer, this.camera.aspect, 0);
    }
    if (next === 'pause' || next === 'playing') this.challenge.setPaused(next === 'pause');
    else this.challenge.clear();
    this.mode = next;
    if (next !== 'playing') {
      this.voice = 0;
      this.heardTime = 0;
    }
    this.keys.clear();
    this.dragging = false;
    if (next !== 'playing' && document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.sound.pause(next !== 'playing' && next !== 'spectating');
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
    if(this.room){this.room.command(this.epoch,{type:'continue'});return;}
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
    this.complete(panel,true,text.trim().toUpperCase());
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
    if (owned && this.mode !== 'playing') {
      document.exitPointerLock();
      return;
    }
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
    for (const s of Object.values(this.mod?.stages ?? campaignStages)) {
      const o = s.objects.find((obj) => obj.gives?.includes(flag));
      if (o) return o.name.replace(/^(take|pick up|collect|use|read|find|retrieve|grab)\s+/i, '');
    }
    return ENDINGS[flag] ?? labelOf(flag);
  }
  private interact() {
    if (this.challenge.object) {
      if (this.challenge.object.challenge?.kind === 'entity-photo') {
        this.cameraPose(0, false);
        this.updateChallenge(0);
      }
      if (this.challenge.press()) this.finishChallenge();
      return;
    }
    if (this.hidden) {
      this.hidden = false;
      this.lockerView = undefined;
      this.cameraPose(0, false);
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
      const mesh = this.world?.objects.get(obj.id);
      if (mesh?.userData.lockerEye) {
        this.lockerView = {
          eye: mesh.localToWorld(mesh.userData.lockerEye.clone()),
          facing: mesh.rotation.y + Math.PI,
          yaw: this.yaw,
          pitch: this.pitch,
        };
        this.cameraPose(0, false);
      }
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
      if(this.room && obj.challenge.kind==='haul'){
        const carrier=this.room.state?.players.find(p=>p.alive && p.cargo===obj.id);
        if(carrier) this.callbacks.message('Explorer '+carrier.slot+' is transporting this item.');
        else {this.sendPose();this.room.command(this.epoch,{type:'carry',id:obj.id});}
      }else this.startChallenge(obj);
      return;
    }
    if (obj.kind === 'code') {
      this.keypad = obj;
      this.change('code', obj.name);
      return;
    }
    this.complete(obj);
  }
  private startChallenge(obj: GameObject) {
    const mesh = this.world?.objects.get(obj.id),
      origin = mesh?.position.clone();
    this.challenge.start(obj, () => {
      if (mesh && origin) mesh.position.copy(origin);
    });
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
  private entityPoint(e: Encounter, height: number) {
    return this.vector.set(e.x * TILE, height, e.z * TILE);
  }
  private entityVisible(frame = 1, e = this.encounter, height = this.entityCenterHeight) {
    if (!e || Math.hypot(e.x - this.x / TILE, e.z - this.z / TILE) >= 14) return false;
    const point = this.projected.copy(this.entityPoint(e, height)).project(this.camera);
    return point.z >= -1 && point.z <= 1 && Math.abs(point.x) <= frame && Math.abs(point.y) <= frame &&
      clearSight(this.stage, this.x / TILE, this.z / TILE, e.x, e.z);
  }
  private entityLit(e = this.encounter, height = this.entityCenterHeight) {
    if (!this.lamp.intensity || !e) return false;
    this.lamp.getWorldPosition(this.lightOrigin);
    this.lampTarget.getWorldPosition(this.lightAxis).sub(this.lightOrigin).normalize();
    const offset = this.entityPoint(e, height).sub(this.lightOrigin);
    return offset.length() <= this.lamp.distance && offset.normalize().dot(this.lightAxis) >= Math.cos(this.lamp.angle);
  }
  private updateChallenge(dt: number) {
    const obj = this.challenge.object;
    if (!obj?.challenge) return;
    const spec = obj.challenge;
    const mesh = this.world?.objects.get(obj.id);
    const range = Math.hypot(this.x - obj.x * TILE, this.z - obj.z * TILE);
    const entityInFrame = spec.kind === 'entity-photo' && this.entityVisible(0.65);
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
  private complete(obj: GameObject, notify = true, code?:string) {
    if(this.room){
      this.sendPose();
      this.room.command(this.epoch,{type:'use',id:obj.id,code});
      return;
    }
    recordObjective(this.state,obj);
    this.placeCompleted(obj);
    this.sound.event(
      obj.kind === 'pickup' ? 'pickup' : obj.kind === 'exit' || obj.kind === 'ending' ? 'exit' : 'use',
    );
    if (obj.kind === 'ending' && obj.ending) {
      const id = obj.ending;
      this.state.pending = { ending: id, target: obj.target ?? this.mod?.start ?? START };
      this.persist();
      this.change('ending', id);
      return;
    }
    if (obj.target && (this.mod?.stages ?? campaignStages)[obj.target]) {
      this.enter(obj.target);
      if (notify) this.callbacks.message(this.stage.description);
      return;
    }
    if (this.phone && (obj === this.phone || (obj.gives?.includes('rail3') && !this.has('exchange-call')))) {
      this.haunt('flicker');
      this.receiverScareAt = this.time + 1.3;
      this.encounter?.investigate(this.phone.x, this.phone.z);
    }
    if (obj.gives?.includes('archive-alarm')) {
      this.alarmTime = 18;
      this.sound.alarm();
    }
    if ((this.encounter?.danger ?? 0) < 0.42 && this.additionalHunters.every(h => h.encounter.danger < 0.42))
      this.markCheckpoint();
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
    if(this.room){
      this.room.command(this.epoch,{type:'consume',key:entry[0]});
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
      objective: this.residentHint || this.stage.objective || this.stage.description,
      prompt,
      stamina: Math.round(this.state.stamina),
      sanity: Math.round(this.state.sanity),
      items,
      voice: Math.round(this.voice * 100),
      heardVoice: this.heardTime > 0,
    };
    const encoded = JSON.stringify(hud);
    if (encoded !== this.lastHUD) {
      this.lastHUD = encoded;
      this.callbacks.hud(hud);
    }
  }
  private canStand(x: number, z: number) {
    return canStandAt(this.stage, x, z);
  }
  private markCheckpoint() {
    if (this.grounded && !['X', '!'].includes(tileAt(this.stage, this.x / TILE, this.z / TILE)))
      this.state.checkpoint = { x: this.x, z: this.z, yaw: this.yaw, pitch: this.pitch };
  }
  private async persist() {
    if (!this.stage || this.room) return;
    if (this.grounded && !pitFloor(this.stage, this.x, this.z) && !this.hidden && this.mode !== 'death')
      this.state.position = { x: this.x, z: this.z, yaw: this.yaw, pitch: this.pitch };
    const result = await storeProgress(this.state, this.mod?.slot);
    if (this.disposed) return;
    if (result !== 'saved' && !this.warnedStorage) {
      this.warnedStorage = true;
      this.callbacks.message(result === 'stale' ? 'Another tab updated this campaign. Return to the title screen to load its save.' : 'Browser storage unavailable. Progress will last for this session.');
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
    if (this.hidden && this.lockerView) {
      const locker = this.lockerView;
      this.camera.position.copy(locker.eye);
      this.camera.rotation.set(clamp(this.pitch - locker.pitch, -.85, .85),
        locker.facing - (this.yaw - locker.yaw), 0, 'YXZ');
    } else this.camera.rotation.set(this.pitch, -this.yaw, 0, 'YXZ');
    this.camera.updateMatrixWorld(true);
    const scanner = this.isScanner();
    this.lamp.intensity = scanner ? 0 : this.state.flashlight && !this.hidden ? 12 : 0;
    this.lamp.castShadow = this.lamp.intensity > 0 && this.renderer.shadowMap.enabled;
    this.lamp.shadow.needsUpdate = this.lamp.castShadow;
  }
  private isScanner() {
    return !this.mod && (this.stage.id === 'dark' || /lights out/i.test(this.stage.name));
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
    if (this.room) {
      this.room.command(this.epoch,{type:'down',cause:reason});
      this.change('spectating',reason);
      return;
    }
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
    this.heardTime = Math.max(0, this.heardTime - dt);
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
      const speed = crouched ? playerSpeed.crouch : sprint ? playerSpeed.sprint : playerSpeed.walk;
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
    this.moving=distance>.001; this.sprinting=sprint;
    this.cycle += distance * (crouched ? 5.8 : sprint ? 3 : 5);
    this.footDist += this.grounded ? distance : 0;
    const highCeiling = this.world?.underMonitor(this.x / TILE, this.z / TILE);
    if (this.footDist > (sprint ? 2.8 : crouched ? 1 : 1.46)) {
      this.footDist = 0;
      this.sound.step(sprint, crouched, /pool|water|ocean|cave|depth/.test(this.stage.theme), highCeiling);
    }
    this.cameraPose(dt, distance > 0.001);
    this.updateChallenge(dt);
    if (this.phone) this.updateExchange();
    if(this.room && this.encounter)this.closeEncounter(!this.world?.entity?.visible);
    if (!this.room && this.encounter) {
      const day = this.stage.id === 'village' && (this.time % 80 < 32 || this.time % 80 >= 69);
      if (this.stage.id === 'lobby' && this.lobbyWarning < 0) {
        const heard = this.grace <= 0 && this.encounter.canHearVoice(this.voice, this.x / TILE, this.z / TILE, this.hidden);
        if (heard || this.time > 42 || this.state.flags.some(f => /^rail\d/.test(f))) {
          this.lobbyWarning = this.time;
          this.haunt('steps');
          this.nextHaunt = Math.max(this.nextHaunt, this.activeClock + 27);
          if (heard) {
            this.encounter.investigate(Math.round(this.x / TILE), Math.round(this.z / TILE));
            this.heardTime = 0.65;
          }
        }
      }
      const lurking =
        this.stage.id === 'lobby' && (this.lobbyWarning < 0 || this.time - this.lobbyWarning < 9);
      const offDuty =
        lurking ||
        day ||
        (this.stage.id === 'field' && !this.has('wind-east')) ||
        (this.stage.id === 'funplus' && this.has('fun-blue')) ||
        (this.stage.threat?.kind === 'camera' && this.has('office-camera')) ||
        (this.stage.id === 'outpost' && this.has('cured-agent'));
      this.alarmTime = Math.max(0, this.alarmTime - dt);
      const mesh = this.world?.entity;
      if (mesh && ['village', 'lobby', 'field', 'funplus'].includes(this.stage.id)) mesh.visible = !offDuty;
      this.tickHunter(this.encounter, mesh, this.entityCenterHeight, dt, distance > 0.001, sprint, crouched, offDuty);
      if (this.encounter.contact && this.stage.threat?.kind === 'camera') {
        if (!this.has('office-camera')) {
          this.enter(this.stage.id);
          this.callbacks.message('The camera caught you. Stay low or disable the security feed.');
          return;
        }
      } else if (this.encounter.contact) {
        this.caught(this.stage.threat!.kind, mesh);
        return;
      }
      this.closeEncounter(offDuty);
    }
    let otherDanger = 0;
    for (const { encounter, mesh, kind, height } of this.room ? [] : this.additionalHunters) {
      this.tickHunter(encounter, mesh, height, dt, distance > 0.001, sprint, crouched, false);
      otherDanger = Math.max(otherDanger, encounter.danger);
      if (encounter.contact) {
        this.caught(kind, mesh);
        return;
      }
    }
    const residentDanger = this.room ? 0 : this.updateResidents(dt, distance, crouched);
    if (this.mode === 'death' || this.mode === 'spectating') return;
    const danger = Math.max(otherDanger, residentDanger, this.encounter?.danger ?? 0);
    const infectedWater = tile === '!' && this.stage.theme === 'pool';
    const sanityDelta = this.hidden ? 0.75 : infectedWater ? -28 : tile === '!' ? -11 : danger > 0.56 ? -2.2 * danger : -0.016;
    this.state.sanity = clamp(this.state.sanity + sanityDelta * dt, 0, 100);
    if (this.state.sanity === 0) {
      this.die(infectedWater ? 'The Hydrolitis Plague took hold. Stay in the pale water.' : 'You lost your bearings in the dark.');
      return;
    }
    let pan = 0;
    if (this.encounter) {
      const dx = this.encounter.x - this.x / TILE,
        dz = this.encounter.z - this.z / TILE;
      pan = (dx * Math.cos(this.yaw) + dz * Math.sin(this.yaw)) / Math.max(1, Math.hypot(dx, dz));
    }
    this.sound.syncStage(this.time, danger);
    this.sound.tick(dt, danger, pan, this.stage.threat?.kind === 'farmer' && this.has('wind-east'), highCeiling);
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
      this.nextHaunt = this.activeClock + (this.stage.id === 'lobby' ? 14 + noise * 24 : 22 + noise * 45);
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
  private caught(kind: string, mesh: THREE.Object3D | null | undefined) {
    this.callbacks.scare?.({ kind, lethal: true, frame: this.contactFrame(kind, mesh) });
    this.lastScare = this.activeClock;
    this.die(`Caught by ${creatureNames[kind] ?? labelOf(kind)}.`);
  }
  private tickHunter(encounter: Encounter, mesh: THREE.Group | null | undefined, height: number,
    dt: number, moving: boolean, sprint: boolean, crouched: boolean, offDuty: boolean) {
    const previousX = encounter.x, previousZ = encounter.z;
    const wasWinding = encounter.winding;
    const previousReach = encounter.reach;
    encounter.tick(
      dt,
      this.x / TILE,
      this.z / TILE,
      this.entityVisible(1, encounter, height),
      this.entityLit(encounter, height),
      moving,
      sprint,
      crouched,
      this.hidden,
      this.state.flashlight,
      offDuty ? 1 : this.grace,
      this.alarmTime > 0 ? this.stage.objects.find((o) => o.gives?.includes('archive-alarm')) : undefined,
      this.voice,
    );
    if (encounter.heardVoice) this.heardTime = 0.65;
    if (encounter.winding && !wasWinding) {
      this.sound.inhale();
      this.world?.haunt('flicker', this.camera);
    }
    if (mesh) {
      mesh.position.x = encounter.x * TILE;
      mesh.position.z = encounter.z * TILE;
      const delta = encounter.angle - mesh.rotation.y;
      const turn = Math.atan2(Math.sin(delta), Math.cos(delta));
      if (encounter.kind === 'camera') mesh.rotation.y = encounter.angle;
      else if (!encounter.heldByGaze) mesh.rotation.y += turn * (1 - Math.exp(-dt * 15));
      const speed = Math.hypot(encounter.x - previousX, encounter.z - previousZ) * TILE / Math.max(dt, 0.001);
      if (!encounter.heldByGaze) mesh.userData.setContactPose?.(dt, encounter.contactPose);
      mesh.userData.pose?.(this.time, dt, speed, encounter.winding, encounter.lunging, encounter.heardVoice, encounter.reach, encounter.heldByGaze, turn);
    }
    if (previousReach <= 0 && encounter.reach > 0) {
      this.sound.scrape(0);
      this.callbacks.message('Fingernails scrape the rim. Step back.');
    }
  }
  private updateResidents(dt: number, moved: number, crouched: boolean) {
    let danger = 0;
    this.residentHint = '';
    for (const { site, mesh, behavior, animate } of this.world?.residents ?? []) {
      const veil = site.kind === 'veil';
      const dx = this.x - mesh.position.x, dz = this.z - mesh.position.z;
      const range = Math.hypot(dx, dz);
      const near = !this.hidden && this.grace <= 0 && range < (veil ? 12 : 8) &&
        clearSight(this.stage, this.x / TILE, this.z / TILE, site.x, site.z);
      this.vector.copy(mesh.position);
      this.vector.y += veil ? .13 : -.9;
      this.vector.sub(this.camera.position).normalize();
      const watching = this.camera.getWorldDirection(this.direction).dot(this.vector) > 0.94;
      const audible = this.voice >= .1 && range <= 2 + this.voice * 7;
      if (!veil && near && audible && behavior.phase === 'listening') this.heardTime = .65;
      const event = behavior.update(dt, near, watching, audible || (moved > .001 && !crouched) || !this.grounded);
      animate(dt, Math.atan2(dx, dz));
      const pan = (dx * -Math.cos(this.yaw) - dz * Math.sin(this.yaw)) / Math.max(1, range);
      if (event === 'warn') this.sound.residentCue(veil ? 'harmony' : 'knock', pan);
      if (event === 'listen') this.sound.residentCue('listen', pan);
      if (event === 'toll') {
        this.sound.residentCue('toll', pan);
        this.encounter?.investigate(site.x, site.z);
      }
      if (event === 'capture') {
        this.callbacks.scare?.({ kind: site.kind, lethal: true, frame: this.contactFrame(site.kind, mesh) });
        this.die(veil ? 'The Veil caught your gaze. Turn away when its voices rise.' :
          'The Bellwether heard you. After the knocks, keep your voice down and stand still or crouch-walk until it tolls.');
        return 1;
      }
      if (behavior.phase === 'warning' || behavior.phase === 'listening') {
        const hint = veil ? 'The Veil • look away from the faces' : behavior.phase === 'warning' ?
          'Two knocks • get low before it listens' : 'Bellwether listening • hold still or crouch-walk';
        this.residentHint = this.residentHint ? this.residentHint + ' / ' + hint : hint;
        danger = Math.max(danger, Math.min(1, .28 + behavior.exposure / (veil ? 2.2 : .7)));
      }
    }
    return danger;
  }
  private updateExchange() {
    const phone = this.phone!;
    if (this.receiverScareAt >= 0 && this.time >= this.receiverScareAt) {
      this.receiverScareAt = -1;
      if (!this.hidden) {
        this.callbacks.scare?.({ kind: 'bacteria', lethal: false });
        this.lastScare = this.activeClock;
      }
      this.haunt('steps');
    }
    if (this.hidden) {
      const hunter = this.encounter;
      if (hunter && this.lobbyWarning >= 0 && this.time > this.lobbyWarning + 9 && this.time >= this.nextLockerScrape) {
        const dx = hunter.x * TILE - this.x, dz = hunter.z * TILE - this.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 9) {
          this.sound.scrape((dx * Math.cos(this.yaw) + dz * Math.sin(this.yaw)) / Math.max(1, distance));
          this.nextLockerScrape = this.time + 15;
        }
      }
      return;
    }
    if (this.has('exchange-call') || this.time < this.nextRing) return;
    const dx = phone.x * TILE - this.x, dz = phone.z * TILE - this.z;
    const range = Math.hypot(dx, dz);
    if (range > 38) return;
    this.nextRing = this.time + (range < 9 ? 3.7 : 7.5);
    const pan = (dx * Math.cos(this.yaw) + dz * Math.sin(this.yaw)) / Math.max(1, range);
    this.sound.telephone(pan, Math.max(0.12, 1 - range / 40));
    this.encounter?.investigate(phone.x, phone.z);
  }
  private haunt(event: 'flicker' | 'steps' | 'breath' | 'silhouette') {
    this.world?.haunt(event, this.camera);
    this.callbacks.haunt?.(event);
  }
  private contactFrame(kind: string, mesh: THREE.Object3D | null | undefined = this.world?.entity): string | undefined {
    if (!mesh) return;
    const camera = new THREE.PerspectiveCamera(66, this.camera.aspect, 0.06, 100),
      bounds = new THREE.Box3().setFromObject(mesh);
    const size = bounds.getSize(new THREE.Vector3()),
      head = bounds.getCenter(new THREE.Vector3());
    head.y = bounds.min.y + size.y * (kind === 'bellwether' ? .36 : .73);
    mesh.userData.focus?.getWorldPosition(head);
    const skull = kind === 'bacteria' ? mesh.getObjectByName('Skull') : undefined;
    if (skull) {
      skull.getWorldPosition(head);
      head.y += 0.11;
    }
    const facing = mesh.getWorldDirection(new THREE.Vector3());
    facing.y = 0;
    facing.normalize();
    const distance = kind === 'bacteria' ? 0.95 : mesh.userData.focus
      ? clamp(size.x * 0.28 + size.y * 0.22, 0.54, 1.6)
      : clamp(size.y * 0.69, 1.1, 2.8);
    const eye = head.clone().addScaledVector(facing, distance);
    if (mesh.userData.focus) {
      eye.x += facing.z * distance * 0.35;
      eye.z -= facing.x * distance * 0.35;
    }
    eye.y = head.y + 0.05;
    camera.position.copy(eye);
    camera.fov = 66;
    camera.lookAt(head);
    camera.updateProjectionMatrix();
    const rim = new THREE.PointLight(skull ? 0xe0dbc2 : 0xffd1a2, skull ? 1.9 : 7, 5, 1.35);
    rim.position.copy(eye);
    rim.position.y += 0.25;
    if (skull) {
      rim.position.x += facing.z * 0.44;
      rim.position.z -= facing.x * 0.44;
    }
    this.scene.add(rim);
    const isolated: THREE.Object3D[] = [];
    try {
      // Long jaws can reach the next tile. Keep the actual pose visible if a wall intersects the portrait.
      const behindWall = tileAt(this.stage, eye.x / TILE, eye.z / TILE) === '#' ||
        tileAt(this.stage, head.x / TILE, head.z / TILE) === '#' ||
        !clearSight(this.stage, eye.x / TILE, eye.z / TILE, head.x / TILE, head.z / TILE);
      if (behindWall) {
        camera.layers.set(1);
        const include = (part: THREE.Object3D) => {
          if (part.layers.isEnabled(1)) return;
          part.layers.enable(1);
          isolated.push(part);
        };
        mesh.traverse(include);
        this.scene.traverse(part => { if (part instanceof THREE.Light) include(part); });
      }
      this.renderer.render(this.scene, camera);
      return this.canvas.toDataURL('image/jpeg', 0.78);
    } catch {
      return undefined;
    } finally {
      for (const part of isolated) part.layers.disable(1);
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
      this.callbacks.scare?.({ kind: this.stage.threat.kind, lethal: false, frame: this.contactFrame(this.stage.threat.kind) });
      this.scareStages.add(this.stage.id);
      this.lastScare = this.activeClock;
    }
    this.enemyWasVisible = visible;
  }
  private sendPose() {
    if (!this.room) return;
    const active = this.mode === 'playing';
    const hunters = [
      ...(this.encounter ? [{ encounter: this.encounter, height: this.entityCenterHeight }] : []),
      ...this.additionalHunters,
    ];
    let gaze = 0,
      beam = 0,
      watching = 0;
    if (active) {
      hunters.forEach(({ encounter: e, height }, i) => {
        if (this.entityVisible(1, e, height)) gaze |= 1 << i;
        if (this.entityLit(e, height)) beam |= 1 << i;
      });
      this.world?.residents.forEach(({ mesh, site }, i) => {
        this.vector.copy(mesh.position);
        this.vector.y += site.kind === 'veil' ? 0.13 : -0.9;
        this.vector.sub(this.camera.position).normalize();
        if (this.camera.getWorldDirection(this.direction).dot(this.vector) > 0.94) watching |= 1 << i;
      });
    }
    const pose: Pose = {
      x: this.x,
      z: this.z,
      y: this.y,
      yaw: this.yaw,
      crouch: this.crouchBlend > 0.45,
      hidden: this.hidden,
      moving: active && this.moving,
      sprint: active && this.sprinting,
      voice: active ? this.voice : 0,
      light: this.state.flashlight,
      gaze,
      beam,
      watching,
      spawnId: this.spawnId,
    };
    this.room.command(this.epoch, { type: 'pose', pose });
  }
  private showHunter(e: Encounter, mesh: THREE.Group | null | undefined, m: Monster, dt: number) {
    if (!mesh) return;
    e.x = m.x / TILE;
    e.z = m.z / TILE;
    e.angle = m.yaw;
    e.danger = m.target === this.room!.slot ? m.danger : 0;
    if (m.heard && m.target === this.room!.slot) this.heardTime = 0.65;
    mesh.visible = m.visible;
    mesh.position.x = THREE.MathUtils.damp(mesh.position.x, m.x, 22, dt);
    mesh.position.z = THREE.MathUtils.damp(mesh.position.z, m.z, 22, dt);
    const turn = Math.atan2(Math.sin(m.yaw - mesh.rotation.y), Math.cos(m.yaw - mesh.rotation.y));
    mesh.rotation.y += turn * (1 - Math.exp(-18 * dt));
    mesh.userData.setContactPose?.(dt, m.contactPose);
    mesh.userData.pose?.(this.time, dt, m.speed, m.wind, m.strike, m.heard, m.reach, m.frozen, turn);
  }
  private syncTeam(dt: number) {
    const room = this.room!,
      snap = room.state;
    if (!snap || snap.phase !== 'playing') return;
    const self = snap.players.find((p) => p.slot === room.slot);
    if (!self) return;
    const transition = this.epoch !== snap.epoch;
    if (this.revision !== snap.revision || transition) {
      const j = snap.journal,
        before = this.state.completed,
        oldPending = this.state.pending;
      this.state.flags = j.flags.slice();
      this.state.completed = j.completed.slice();
      this.state.endings = j.endings.slice();
      this.state.inventory = { ...j.inventory };
      this.state.pending = j.pending ? { ...j.pending } : null;
      this.revision = snap.revision;
      if (transition) {
        this.epoch = snap.epoch;
        this.restoredSupply = self.supplies;
        this.spawnId = self.spawnId;
        this.enter(j.stage);
        this.x = self.x;
        this.z = self.z;
        this.moving = this.sprinting = false;
        this.cameraPose(0, false);
        this.change('playing');
        this.callbacks.message(this.stage.description);
      } else {
        for (const obj of this.stage.objects) {
          if (!this.done(obj) || before.includes(this.stage.id + '/' + obj.id)) continue;
          if (this.challenge.object === obj) this.challenge.clear();
          if (this.keypad === obj) {
            this.keypad = undefined;
            this.change('playing');
          }
          this.placeCompleted(obj);
          this.sound.event(obj.kind === 'pickup' ? 'pickup' : 'use');
          this.callbacks.message(obj.description ?? obj.name);
          if (obj === this.phone || obj.gives?.includes('rail3')) this.receiverScareAt = this.time + 1.3;
          if (obj.gives?.includes('archive-alarm')) this.sound.alarm();
        }
        if (this.mode !== 'spectating') this.refreshHUD();
      }
      if (this.state.pending && (transition || !oldPending)) this.change('ending', this.state.pending.ending);
    }
    if (this.spawnId !== self.spawnId) {
      this.spawnId = self.spawnId;
      this.x = self.x;
      this.z = self.z;
      this.y = 0;
      this.yaw = self.yaw;
      this.hidden = false;
      this.challenge.clear();
      this.change('playing');
      this.cameraPose(0, false);
      this.callbacks.message('The camera spotted you. Stay low or disable the feed.');
    }
    if (self.supplies !== this.restoredSupply) {
      this.restoredSupply = self.supplies;
      if (self.lastSupply === 'almond') this.state.sanity = Math.min(100, this.state.sanity + 54);
      else {
        this.state.stamina = Math.min(100, this.state.stamina + 80);
        this.sprintLocked = false;
      }
      this.sound.event('pickup');
    }
    if (!self.alive && this.mode !== 'spectating' && !this.state.pending) {
      const kind = self.cause.match(/^Caught by (\w+)\./)?.[1];
      if (kind)
        this.callbacks.scare?.({
          kind,
          lethal: true,
          frame: this.contactFrame(
            kind,
            this.world?.residents.find((r) => r.site.kind === kind)?.mesh ??
              this.additionalHunters.find((h) => h.kind === kind)?.mesh ??
              this.world?.entity,
          ),
        });
      this.change('spectating', self.cause);
    }
    if (self.alive && this.mode === 'playing' && this.carrying !== self.cargo) {
      this.carrying = self.cargo;
      const obj = this.stage.objects.find((o) => o.id === self.cargo);
      if (obj) this.startChallenge(obj);
    }
    for (const [id, origin] of this.cargoOrigins) {
      const obj = this.stage.objects.find((o) => o.id === id)!;
      if (this.done(obj)) continue;
      const carrier = snap.players.find((p) => p.alive && p.cargo === id);
      const mesh = this.world?.objects.get(id);
      if (mesh && carrier && carrier.slot !== room.slot)
        mesh.position.set(
          carrier.x - Math.sin(carrier.yaw) * 1.18,
          origin.y,
          carrier.z + Math.cos(carrier.yaw) * 1.18,
        );
      else if (mesh && !carrier) mesh.position.copy(origin);
    }
    this.time = snap.time;
    if (this.encounter && snap.monsters[0])
      this.showHunter(this.encounter, this.world?.entity, snap.monsters[0], dt);
    this.additionalHunters.forEach((h, i) => {
      const m = snap.monsters[i + (this.encounter ? 1 : 0)];
      if (m) this.showHunter(h.encounter, h.mesh, m, dt);
    });
    this.residentHint = '';
    this.world?.residents.forEach(({ mesh, site, behavior, animate }, i) => {
      const remote = snap.residents[i];
      if (!remote) return;
      const previous = behavior.phase;
      behavior.phase = remote.phase;
      behavior.time = remote.time;
      behavior.exposure = remote.exposure;
      const p = snap.players.find((p) => p.slot === remote.target);
      animate(dt, p ? Math.atan2(p.x - mesh.position.x, p.z - mesh.position.z) : mesh.rotation.y);
      if (this.mode !== 'playing' || Math.hypot(this.x - mesh.position.x, this.z - mesh.position.z) > 12)
        return;
      const veil = site.kind === 'veil';
      if (previous !== remote.phase) {
        const cue =
          remote.phase === 'warning'
            ? veil
              ? 'harmony'
              : 'knock'
            : remote.phase === 'listening'
              ? 'listen'
              : remote.phase === 'quiet'
                ? 'toll'
                : null;
        if (cue) this.sound.residentCue(cue, 0);
      }
      if (remote.phase === 'listening' || remote.phase === 'warning')
        this.residentHint = veil
          ? 'The Veil • look away from the faces'
          : remote.phase === 'listening'
            ? 'Bellwether listening • hold still or crouch-walk'
            : 'Two knocks • get low before it listens';
    });
    const watch = this.mode === 'spectating' ? snap.players.find((p) => p.alive) : undefined;
    this.team?.update(snap.players, room.slot, watch?.slot ?? 0, dt, (x, z) =>
      terrainHeight(this.stage, x, z),
    );
    if (watch) {
      this.x = watch.x;
      this.z = watch.z;
      this.y = watch.y;
      this.yaw = watch.yaw;
      this.pitch = 0;
      this.state.flashlight = watch.light;
      this.cameraPose(dt, false);
      this.sound.syncStage(this.time, 0);
      this.world?.update(this.time, dt);
      this.renderer.render(this.scene, this.camera);
    }
    this.poseTime += dt;
    if (self.alive && this.poseTime >= 0.06) {
      this.poseTime = 0;
      this.sendPose();
    }
  }
  private run() {
    if (this.frameId) return;
    this.lastFrame = performance.now();
    this.frameId = requestAnimationFrame(this.frame);
  }
  private frame = (now: number) => {
    if (this.disposed) return;
    if(this.room && this.settings.quality==='standard' && now-this.frameTime<1000/31){
      this.frameId=requestAnimationFrame(this.frame);return;
    }
    this.frameTime=now;
    const elapsed = clamp((now - this.lastFrame) / 1000, 0, 0.14);
    this.lastFrame = now;
    if(this.room)this.syncTeam(elapsed);
    if (this.mode === 'playing') {
      this.voice = this.callbacks.microphone?.(elapsed) ?? 0;
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
    this.team?.dispose();
    this.sound.dispose();
    this.clearScan();
    this.scene.remove(this.camera);
    this.world?.dispose();
    this.lamp.dispose();
    this.renderer.dispose();
  }
}
