import * as T from 'three';
import { buildWorld } from '../world';
import { loadBacteria } from '../bacteria';
import { Soundscape } from '../game-sound';
import { VoiceInput } from '../voice-input';
import type { GameSettings } from '../game';
import { level, rails, interaction, type Controls } from './expedition';
import type { Room } from './room';

export const prepareView = loadBacteria;
const colors = [0xd0a658, 0x78a5bc, 0xb67b7b, 0x94af83, 0xbf93ba, 0xb9b394, 0x929dce, 0xcf9261];
function explorer(slot: number) {
  const model = new T.Group();
  const suit = new T.MeshStandardMaterial({ color: colors[slot - 1], roughness: 0.85 });
  const rubber = new T.MeshStandardMaterial({ color: 0x262b29, roughness: 0.66 });
  const visor = new T.MeshStandardMaterial({ color: 0x283e43, metalness: 0.5, roughness: 0.23 });
  const limb = (x: number, y: number, z: number, r: number, length: number, mat: T.Material) => {
    const m = new T.Mesh(new T.CapsuleGeometry(r, length, 4, 8), mat);
    m.position.set(x, y, z);
    model.add(m);
    return m;
  };
  limb(0, 1, 0, 0.24, 0.38, suit);
  limb(0, 1.55, 0, 0.19, 0.04, suit);
  const face = limb(0, 1.56, -0.11, 0.15, 0.03, visor);
  face.scale.set(1, 0.68, 0.8);
  limb(0, 1.02, 0.22, 0.16, 0.32, rubber);
  const legs = [limb(-0.12, 0.4, 0, 0.105, 0.55, rubber), limb(0.12, 0.4, 0, 0.105, 0.55, rubber)];
  const arms = [limb(-0.28, 1.04, 0, 0.092, 0.39, suit), limb(0.28, 1.04, 0, 0.092, 0.39, suit)];
  return {
    model,
    legs,
    arms,
    cycle: 0,
    dispose() {
      model.traverse((o) => {
        if (o instanceof T.Mesh) o.geometry.dispose();
      });
      suit.dispose();
      rubber.dispose();
      visor.dispose();
    },
  };
}

export class RoomView {
  private scene = new T.Scene();
  private renderer: T.WebGLRenderer;
  private camera = new T.PerspectiveCamera(70, 1, 0.06, 145);
  private lamp = new T.SpotLight(0xfff2d1, 12, 29, 0.54, 0.55, 1.15);
  private world: ReturnType<typeof buildWorld>;
  private avatars = new Map<number, ReturnType<typeof explorer>>();
  private sound = new Soundscape();
  private mic: VoiceInput;
  private events = new AbortController();
  private keys = new Set<string>();
  private yaw = level.facing ?? 0;
  private pitch = 0;
  private elapsed = 0;
  private last = 0;
  private nextInput = 0;
  private frame = 0;
  private use = false;
  private light = true;
  private alive = true;
  private notice = '';
  private noticeUntil = 0;
  private pickups = 0;
  private observed = 0;
  private dragging = false;
  private steps = 0;
  constructor(
    private canvas: HTMLCanvasElement,
    private room: Room,
    private settings: GameSettings,
    private status: (s: string) => void,
  ) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: settings.quality === 'high',
      powerPreference: 'default',
    });
    this.renderer.setPixelRatio(settings.quality === 'high' ? Math.min(devicePixelRatio, 1.5) : 1);
    this.world = buildWorld(this.scene, level);
    this.camera.rotation.order = 'YXZ';
    this.camera.add(this.lamp, this.lamp.target);
    this.lamp.target.position.set(0, -0.03, -1);
    this.scene.add(this.camera);
    this.sound.setVolume(settings.volume);
    this.sound.ambience('lobby');
    this.sound.unlock();
    this.mic = new VoiceInput((message) => {
      this.notice = message;
      this.noticeUntil = performance.now() + 3500;
    });
    this.resize();
    const opts = { signal: this.events.signal };
    window.addEventListener('resize', this.resize, opts);
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey || document.activeElement?.tagName === 'BUTTON') return;
        this.keys.add(e.code);
        if (e.repeat) return;
        if (e.code === 'KeyE') this.use = true;
        if (e.code === 'KeyF') this.light = !this.light;
        if (e.code === 'KeyM' && this.alive) {
          if (this.mic.state === 'off') void this.mic.start();
          else this.mic.stop();
        }
      },
      opts,
    );
    window.addEventListener('keyup', (e) => this.keys.delete(e.code), opts);
    window.addEventListener(
      'blur',
      () => {
        this.keys.clear();
        this.use = false;
        this.dragging = false;
      },
      opts,
    );
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) {
          this.mic.stop();
          this.keys.clear();
        }
      },
      opts,
    );
    canvas.addEventListener(
      'pointerdown',
      () => {
        canvas.focus();
        this.dragging = true;
        this.sound.unlock();
        try {
          void canvas.requestPointerLock?.()?.catch(() => {});
        } catch {
          /* Drag to look. */
        }
      },
      opts,
    );
    window.addEventListener(
      'pointerup',
      () => {
        this.dragging = false;
      },
      opts,
    );
    document.addEventListener(
      'mousemove',
      (e) => {
        if (document.pointerLockElement !== canvas && !this.dragging) return;
        this.yaw += e.movementX * 0.00212 * settings.sensitivity;
        this.pitch = T.MathUtils.clamp(
          this.pitch - e.movementY * 0.00212 * settings.sensitivity,
          -1.36,
          1.36,
        );
      },
      opts,
    );
    this.frame = requestAnimationFrame(this.draw);
  }
  private resize = () => {
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / Math.max(1, innerHeight);
    this.camera.updateProjectionMatrix();
  };
  private draw = (now: number) => {
    this.frame = requestAnimationFrame(this.draw);
    // Standard quality also limits render frequency on high-refresh laptop displays.
    if (now - this.last < 1000 / (this.settings.quality === 'standard' ? 30 : 60) - 1) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.elapsed += dt;
    const state = this.room.state;
    const me = state?.players.find((p) => p.slot === this.room.slot);
    if (!state || !me) return;
    if (this.alive && !me.alive) {
      this.mic.stop();
      this.sound.event('death');
    }
    this.alive = me.alive;
    const eye = me.alive ? me : (state.players.find((p) => p.alive) ?? me);
    const key = (code: string) => Number(this.keys.has(code));
    this.yaw += (key('ArrowRight') - key('ArrowLeft')) * dt * 1.9;
    const c: Controls = {
      forward: Number(!!(key('KeyW') || key('ArrowUp'))) - Number(!!(key('KeyS') || key('ArrowDown'))),
      side: key('KeyD') - key('KeyA'),
      yaw: this.yaw,
      sprint: !!(key('ShiftLeft') || key('ShiftRight')),
      crouch: !!(key('KeyC') || key('ControlLeft') || key('ControlRight')),
      light: this.light,
      use: this.use,
      voice: this.mic.read(dt),
    };
    if (me.alive && (now >= this.nextInput || this.use)) {
      this.room.input(c);
      this.use = false;
      this.nextInput = now + 50;
    }
    const blend = 1 - Math.exp(-dt * 24);
    const moved = Math.hypot(eye.x - this.camera.position.x, eye.z - this.camera.position.z) * blend;
    const height = eye.crouch ? 0.97 : 1.58;
    if (eye.slot !== this.observed) {
      this.camera.position.set(eye.x, height, eye.z);
      this.observed = eye.slot;
    }
    this.camera.position.x += (eye.x - this.camera.position.x) * blend;
    this.camera.position.z += (eye.z - this.camera.position.z) * blend;
    this.camera.position.y += (height - this.camera.position.y) * blend;
    this.camera.rotation.set(this.pitch, -(me.alive ? this.yaw : eye.yaw), 0, 'YXZ');
    this.lamp.intensity = this.light ? 12 : 0;
    this.steps += Math.min(0.75, moved);
    if (this.steps > (c.sprint ? 2.8 : 1.46)) {
      this.steps = 0;
      this.sound.step(c.sprint, c.crouch, false);
    }
    for (const p of state.players) {
      if (p.slot === this.room.slot) continue;
      let avatar = this.avatars.get(p.slot);
      if (!avatar) {
        avatar = explorer(p.slot);
        this.avatars.set(p.slot, avatar);
        this.scene.add(avatar.model);
        avatar.model.position.set(p.x, 0, p.z);
      }
      const m = avatar.model;
      m.visible = p.alive && p.slot !== eye.slot;
      const dist = Math.hypot(m.position.x - p.x, m.position.z - p.z) * blend;
      avatar.cycle += dist * 4.3;
      m.position.x += (p.x - m.position.x) * blend;
      m.position.z += (p.z - m.position.z) * blend;
      m.rotation.y = -p.yaw;
      m.scale.y = p.crouch ? 0.65 : 1;
      const swing = Math.sin(avatar.cycle) * Math.min(dist / Math.max(dt, 0.001), 4) * 0.095;
      avatar.legs[0].rotation.x = swing;
      avatar.legs[1].rotation.x = -swing;
      avatar.arms[0].rotation.x = -swing;
      avatar.arms[1].rotation.x = swing;
    }
    for (const [id, a] of this.avatars)
      if (!state.players.some((p) => p.slot === id)) {
        this.scene.remove(a.model);
        a.dispose();
        this.avatars.delete(id);
      }
    const h = state.monster,
      m = this.world.entity!;
    m.position.x += (h.x - m.position.x) * blend;
    m.position.z += (h.z - m.position.z) * blend;
    m.rotation.y += Math.atan2(Math.sin(h.yaw - m.rotation.y), Math.cos(h.yaw - m.rotation.y)) * blend;
    m.userData.setContactPose?.(dt, h.reach);
    m.userData.pose?.(this.elapsed, dt, h.speed, h.wind, h.strike, h.heard);
    if (this.pickups !== state.collected.length) {
      this.pickups = state.collected.length;
      this.sound.event('pickup');
    }
    for (const rail of rails) this.world.objects.get(rail.id)!.visible = !state.collected.includes(rail.id);
    this.world.update(this.elapsed, dt);
    const danger = Math.max(0, 1 - Math.hypot(eye.x - h.x, eye.z - h.z) / 18);
    this.sound.tick(dt, danger, 0);
    const obj = interaction(me, state.collected);
    const prompt = !me.alive
      ? 'Caught · watching Explorer ' + eye.slot
      : obj?.kind === 'pickup'
        ? 'E · ' + obj.name
        : obj?.kind === 'exit'
          ? this.pickups === rails.length
            ? 'E · Open the service door'
            : 'Service door needs four ladder pieces'
          : this.pickups === rails.length
            ? 'Find the service door'
            : 'Find the four ladder pieces';
    this.status(
      now < this.noticeUntil
        ? this.notice
        : prompt +
            '  ·  ' +
            this.pickups +
            '/4  ·  Stamina ' +
            Math.round(me.stamina) +
            '%  ·  Mic ' +
            (this.mic.state === 'live' ? 'on' : 'off'),
    );
    this.renderer.render(this.scene, this.camera);
  };
  dispose() {
    cancelAnimationFrame(this.frame);
    this.events.abort();
    this.mic.stop();
    this.sound.dispose();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    for (const a of this.avatars.values()) a.dispose();
    this.world.dispose();
    this.renderer.dispose();
  }
}
