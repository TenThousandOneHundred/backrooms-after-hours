import { shoutStrength } from '../voice-reach.ts';
import type { Hunt, HuntResult } from './hunt.ts';
import { livesPerLevel, readLives, type Difficulty } from '../difficulty.ts';
import { START, stages } from '../campaign.ts';
import { recordObjective } from '../campaign-progress.ts';
import { canStandAt, clearSight, Encounter, TILE } from '../game-entity.ts';
import { ResidentBehavior, type ResidentSite } from '../resident-behavior.ts';
import { freshProgress, type Progress } from '../game-state.ts';

export const capacity = 8;
export const roomSave = 'backrooms-after-hours.coop.v2';
export type Pose = {
  x: number;
  z: number;
  y: number;
  yaw: number;
  crouch: boolean;
  hidden: boolean;
  moving: boolean;
  sprint: boolean;
  light: boolean;
  voice: number;
  gaze: number;
  beam: number;
  watching: number;
  spawnId: number;
};
export type Explorer = Pose & {
  slot: number;
  alive: boolean;
  lives: number;
  cause: string;
  supplies: number;
  lastSupply: string;
  cargo: string;
};
export type Command =
  | { type: 'pose'; pose: Pose }
  | { type: 'carry'; id: string }
  | { type: 'use'; id: string; code?: string }
  | { type: 'down'; cause: string; spawnId?: number }
  | { type: 'grab' }
  | { type: 'continue' }
  | { type: 'consume'; key: string };
export type Monster = {
  x: number;
  z: number;
  yaw: number;
  wind: boolean;
  strike: boolean;
  speed: number;
  heard: boolean;
  reach: number;
  contactPose: number;
  frozen: boolean;
  target: number;
  danger: number;
  visible: boolean;
};
type ResidentFrame = { phase: ResidentBehavior['phase']; time: number; exposure: number; target: number };
export type Snapshot = {
  phase: 'waiting' | 'playing' | 'lost' | 'finished';
  hunt?: Hunt;
  epoch: number;
  revision: number;
  time: number;
  players: Explorer[];
  monsters: Monster[];
  residents: ResidentFrame[];
  journal: Progress;
};
const spawn = (slot: number, stage: string, lives: number): Explorer => {
  const s = stages[stage];
  return {
    slot,
    x: s.spawn[0] * TILE + ((slot % 3) - 1) * 0.45,
    z: s.spawn[1] * TILE + (Math.floor((slot - 1) / 3) - 1) * 0.42,
    y: 0,
    yaw: s.facing ?? 0,
    alive: lives > 0,
    lives,
    cause: '',
    supplies: 0,
    lastSupply: '',
    cargo: '',
    crouch: false,
    hidden: false,
    moving: false,
    sprint: false,
    light: false,
    voice: 0,
    gaze: 0,
    beam: 0,
    watching: 0,
    spawnId: 0,
  };
};

export class Expedition {
  readonly players = new Map<number, Explorer>();
  private hunters: { ai: Encounter; target: number; speed: number; visible: boolean }[] = [];
  private residents: {
    site: ResidentSite;
    behavior: ResidentBehavior;
    target: number;
    exposure: Map<number, number>;
  }[] = [];
  private immunity = new Map<number, number>();
  private radioNoise = new Map<number, { level: number; until: number }>();
  private warning = -1;
  private alarm = 0;
  private fresh = new Map<number, number>();
  journal = freshProgress(START);
  epoch = 0;
  revision = 0;
  time = 0;
  phase: Snapshot['phase'] = 'waiting';
  hunt?: Hunt;

  configureHunt(monster: number) {
    if (this.phase !== 'waiting' || (monster !== 0 && !this.players.has(monster))) return;
    this.hunt = monster ? { monster, strikeUntil: -1 } : undefined;
    this.revision++;
  }

  returnToLobby() {
    if (this.phase !== 'finished' || !this.hunt) return;
    this.phase = 'waiting';
    this.journal = freshProgress(START, this.journal.difficulty);
    this.configureHunt(this.players.has(this.hunt.monster) ? this.hunt.monster : 1);
    for (const slot of this.players.keys()) this.spawnPlayer(slot);
  }

  private finishHunt(result: HuntResult) {
    if (!this.hunt || this.phase !== 'playing') return;
    this.phase = 'finished';
    this.hunt.result = result;
    this.revision++;
  }

  private grab(monster: Explorer) {
    const hunt = this.hunt!;
    if (this.time < hunt.strikeUntil + .65 || !this.fresh.has(monster.slot)) return;
    hunt.strikeUntil = this.time + .4;
    const stage = stages[this.journal.stage];
    let nearest = 2.25;
    let caught: Explorer | undefined;
    for (const p of this.players.values()) {
      if (p === monster || !p.alive || this.time < (this.immunity.get(p.slot) ?? 0)) continue;
      const dx = p.x - monster.x, dz = p.z - monster.z;
      const distance = Math.hypot(dx, dz, p.y - monster.y);
      if (distance > nearest || dx * Math.sin(monster.yaw) - dz * Math.cos(monster.yaw) < distance * .25 ||
          !clearSight(stage, monster.x / TILE, monster.z / TILE, p.x / TILE, p.z / TILE)) continue;
      nearest = distance;
      caught = p;
    }
    if (caught) this.loseLife(caught, 'Caught by bacteria.');
  }

  private identities = new Map<number, string>();
  private respawns = new Map<number, number>();

  setDifficulty(difficulty: Difficulty) {
    if (this.phase !== 'waiting' || difficulty === this.journal.difficulty) return;
    this.journal.difficulty = difficulty;
    this.journal.lives = livesPerLevel[difficulty];
    for (const p of this.players.values()) p.lives = this.journal.lives;
    this.revision++;
  }

  identityOf(slot: number) { return this.identities.get(slot); }

  private spawnPlayer(slot: number) {
    const id = this.identities.get(slot)!;
    const lives = readLives(this.journal.teamLives?.[id], this.journal.difficulty);
    const player = spawn(slot, this.journal.stage, lives);
    if (slot === this.hunt?.monster) {
      const lair = stages[this.journal.stage].threat!;
      player.x = lair.x * TILE;
      player.z = lair.z * TILE;
    }
    this.players.set(slot, player);
    this.immunity.set(slot, this.time + 3);
  }

  add(identity?: string) {
    for (let i = 1; i <= capacity; i++)
      if (!this.players.has(i)) {
        const id = i === 1 ? 'host' : typeof identity === 'string' && /^[a-f0-9-]{36}$/i.test(identity)
          && ![...this.identities.values()].includes(identity) ? identity : crypto.randomUUID();
        this.identities.set(i, id);
        this.spawnPlayer(i);
        return i;
      }
    return 0;
  }
  remove(slot: number) {
    this.players.delete(slot);
    this.identities.delete(slot);
    this.respawns.delete(slot);
    this.fresh.delete(slot);
    this.radioNoise.delete(slot);
    this.immunity.delete(slot);
    for (const r of this.residents) r.exposure.delete(slot);
    if (this.hunt?.monster === slot) {
      if (this.phase === 'waiting') this.configureHunt(1);
      else this.finishHunt('abandoned');
    } else if (this.hunt && this.players.size < 2) this.finishHunt('abandoned');
    this.checkSurvivors();
  }
  private checkSurvivors() {
    if (this.phase !== 'playing' || !this.players.size) return;
    if ([...this.players.values()].some(p => p.slot !== this.hunt?.monster && p.lives > 0)) return;
    if (this.hunt) this.finishHunt('caught');
    else this.phase = 'lost';
  }
  start(saved?: Progress | null) {
    if (this.phase === 'playing' || this.phase === 'finished' || (this.hunt && this.players.size < 2)) return;
    const resume = this.phase === 'waiting' && !this.hunt && saved && Object.hasOwn(stages, saved.stage);
    if (resume) this.journal = saved;
    this.enter(this.journal.stage, !!resume);
    this.checkSurvivors();
  }
  private enter(stage: string, resume = false) {
    this.phase = 'playing';
    this.journal.stage = stage;
    if (!resume) this.journal.teamLives = {};
    this.respawns.clear();
    this.epoch++;
    this.revision++;
    this.time = 0;
    this.warning = -1;
    this.alarm = 0;
    this.radioNoise.clear();
    this.fresh.clear();
    this.immunity.clear();
    const s = stages[stage];
    this.residents = (s.residents ?? []).map((site) => ({
      site,
      behavior: new ResidentBehavior(site.kind),
      target: 0,
      exposure: new Map(),
    }));
    this.hunters = (s.threat ? [s.threat, ...(s.additionalThreats ?? [])] : (s.additionalThreats ?? [])).map(
      (site) => ({
        ai: new Encounter(s, TILE, site),
        target: 0,
        speed: 0,
        visible: true,
      }),
    );
    for (const slot of this.players.keys()) this.spawnPlayer(slot);
  }
  private loseLife(p: Explorer, cause: string) {
    if (!p.alive) return;
    p.alive = false;
    p.cause = cause;
    p.lives--;
    p.cargo = '';
    this.radioNoise.delete(p.slot);
    this.fresh.delete(p.slot);
    for (const resident of this.residents) resident.exposure.delete(p.slot);
    (this.journal.teamLives ??= {})[this.identities.get(p.slot)!] = p.lives;
    if (p.lives > 0) this.respawns.set(p.slot, this.time + 2.5);
    this.revision++;
    this.checkSurvivors();
  }

  command(slot: number, epoch: number, action: Command) {
    const p = this.players.get(slot),
      j = this.journal,
      s = stages[j.stage];
    if (this.phase !== 'playing' || epoch !== this.epoch || !p || !action || typeof action !== 'object')
      return;
    if (action.type === 'continue') {
      if (slot === 1 && j.pending) {
        const target = j.pending.target;
        j.pending = null;
        this.enter(target);
      }
      return;
    }
    if (!p.alive || j.pending) return;
    if (action.type === 'pose') {
      const q = action.pose;
      if (
        !q ||
        q.spawnId !== p.spawnId ||
        ![q.x, q.z, q.y, q.yaw, q.voice].every(Number.isFinite) ||
        Math.abs(q.y) > 10 ||
        Math.abs(q.x) > s.map[0].length * TILE ||
        Math.abs(q.z) > s.map.length * TILE ||
        !canStandAt(s, q.x, q.z) ||
        ![q.gaze, q.beam, q.watching].every((v) => Number.isInteger(v) && v >= 0 && v < 65536) ||
        ![q.crouch, q.hidden, q.moving, q.sprint, q.light].every((v) => typeof v === 'boolean')
      )
        return;
      Object.assign(p, {
        x: q.x,
        z: q.z,
        y: q.y,
        yaw: q.yaw,
        crouch: q.crouch,
        hidden: q.hidden,
        moving: q.moving,
        sprint: q.sprint,
        light: q.light,
        gaze: q.gaze,
        beam: q.beam,
        watching: q.watching,
        voice: Math.max(0, Math.min(1, q.voice)),
      });
      this.fresh.set(slot, this.time);
      return;
    }
    if (slot === this.hunt?.monster) {
      if (action.type === 'grab') this.grab(p);
      return;
    }
    if (action.type === 'down') {
      if ((action.spawnId ?? 0) === p.spawnId)
        this.loseLife(p, typeof action.cause === 'string' ? action.cause.slice(0, 120) : 'Lost in the dark.');
      return;
    }
    if (action.type === 'consume') {
      if (
        !Object.hasOwn(j.inventory, action.key) ||
        !/almond|\bbar\b/i.test(action.key + ' ' + j.inventory[action.key])
      )
        return;
      p.supplies++;
      p.lastSupply = /almond/i.test(action.key + ' ' + j.inventory[action.key]) ? 'almond' : 'bar';
      delete j.inventory[action.key];
      j.flags = j.flags.filter((f) => f !== action.key);
      this.revision++;
      return;
    }
    if (action.type !== 'use' && action.type !== 'carry') return;
    const obj = s.objects.find((o) => o.id === action.id);
    if (
      !obj ||
      obj.kind === 'hide' ||
      (obj.kind === 'note' && !obj.gives?.length) ||
      j.completed.includes(s.id + '/' + obj.id) ||
      (obj.need?.some((f) => !j.flags.includes(f)) && !j.endings.includes(obj.ending ?? '')) ||
      (obj.kind === 'code' && (action.type !== 'use' || action.code !== obj.code))
    )
      return;
    const challenge = obj.challenge;
    if (action.type === 'carry') {
      if (
        challenge?.kind === 'haul' &&
        !p.cargo &&
        ![...this.players.values()].some((other) => other.alive && other.cargo === obj.id) &&
        Math.hypot(obj.x * TILE - p.x, obj.z * TILE - p.z) < 4.85 &&
        clearSight(s, p.x / TILE, p.z / TILE, obj.x, obj.z)
      )
        p.cargo = obj.id;
      return;
    }
    if (challenge?.kind === 'haul' && p.cargo !== obj.id) return;
    const spot =
      challenge?.kind === 'haul'
        ? s.objects.find((o) => o.id === challenge.destination || o.gives?.includes(challenge.destination))
        : obj;
    const radius =
      challenge?.kind === 'coaster'
        ? 18
        : challenge?.kind === 'entity-photo'
          ? 12
          : challenge?.kind === 'haul'
            ? 3.6
            : 4.85;
    if (
      !spot ||
      Math.hypot(spot.x * TILE - p.x, spot.z * TILE - p.z) > radius ||
      (!challenge && !clearSight(s, p.x / TILE, p.z / TILE, spot.x, spot.z))
    )
      return;
    if (p.cargo === obj.id) p.cargo = '';
    recordObjective(j, obj);
    this.revision++;
    if (obj.ending) {
      j.pending = { ending: obj.ending, target: obj.target ?? START };
      return;
    }
    if (obj.target) {
      if (this.hunt) this.finishHunt('escaped');
      else this.enter(obj.target);
      return;
    }
    if (obj.gives?.includes('archive-alarm')) this.alarm = this.time + 18;
    if (obj.model === 'telephone' || obj.gives?.includes('rail3')) {
      const phone = s.objects.find((o) => o.model === 'telephone');
      if (phone) this.hunters[0]?.ai.investigate(phone.x, phone.z);
    }
  }
  soundRadio(slot: number, level: number) {
    if (this.players.get(slot)?.alive && this.phase === 'playing' && !this.journal.pending && level > 0) {
      const previous = this.radioNoise.get(slot);
      this.radioNoise.set(slot, {
        level: Math.max(level, previous && previous.until > this.time ? previous.level * 0.75 : 0),
        until: this.time + 0.14,
      });
    }
  }
  quietRadio(slot: number) {
    this.radioNoise.delete(slot);
  }
  private audibleLevel(p: Explorer) {
    const radio = this.radioNoise.get(p.slot);
    return Math.max(p.voice, radio && this.time < radio.until ? radio.level : 0);
  }
  step(dt: number) {
    if (this.phase !== 'playing' || this.journal.pending) return;
    this.time += dt;
    for (const [slot, at] of this.respawns) {
      if (this.time < at) continue;
      const previous = this.players.get(slot)!;
      this.spawnPlayer(slot);
      const next = this.players.get(slot)!;
      next.spawnId = previous.spawnId + 1;
      next.cause = previous.cause;
      next.supplies = previous.supplies;
      this.respawns.delete(slot);
    }
    const s = stages[this.journal.stage],
      flags = this.journal.flags;
    const alive = [...this.players.values()].filter((p) => p.alive);
    for (const p of alive)
      if (this.time - (this.fresh.get(p.slot) ?? 0) > 0.65) {
        p.voice = 0;
        p.sprint = false;
        p.moving = false;
      }
    if (this.hunt) return;
    const grace = Math.max(0, (['run', 'hotelchase'].includes(s.id) ? 2.75 : 8) - this.time);
    const active = alive.filter(
      (p) => this.fresh.has(p.slot) && (this.immunity.get(p.slot) ?? 0) <= this.time,
    );
    for (const [i, r] of this.residents.entries()) {
      const { site, behavior } = r,
        veil = site.kind === 'veil';
      const nearby = active.filter(
        (p) =>
          !p.hidden &&
          grace === 0 &&
          Math.hypot(p.x - site.x * TILE, p.z - site.z * TILE) < (veil ? 12 : 8) &&
          clearSight(s, p.x / TILE, p.z / TILE, site.x, site.z),
      );
      const nearSlots = new Set(nearby.map((p) => p.slot));
      for (const slot of r.exposure.keys()) if (!nearSlots.has(slot)) r.exposure.delete(slot);
      if (veil) {
        for (const p of nearby) {
          const amount = Math.max(0, (r.exposure.get(p.slot) ?? 0) + dt * (p.watching & (1 << i) ? 1 : -3.5));
          r.exposure.set(p.slot, amount);
          if (amount >= 1.9) {
            this.loseLife(p, 'Caught by veil.');
          }
        }
        behavior.exposure = Math.max(0, ...r.exposure.values());
        behavior.phase = behavior.exposure >= 0.25 ? 'warning' : 'idle';
      } else {
        const event = behavior.update(dt, nearby.length > 0, false, false);
        if (event === 'toll') this.hunters[0]?.ai.investigate(site.x, site.z);
        if (behavior.phase !== 'listening') r.exposure.clear();
        else
          for (const p of nearby) {
            const range = Math.hypot(p.x - site.x * TILE, p.z - site.z * TILE);
            const loudness = this.audibleLevel(p);
            if ((loudness >= 0.1 && range <= 2 + loudness * 7) || (p.moving && !p.crouch) || p.y > 0.03) {
              const amount = (r.exposure.get(p.slot) ?? 0) + dt;
              r.exposure.set(p.slot, amount);
              if (amount >= 0.48) {
                this.loseLife(p, 'Caught by bellwether.');
              }
            }
          }
        behavior.exposure = Math.max(0, ...r.exposure.values());
      }
      const target = nearby.reduce<Explorer | undefined>(
        (a, p) => (!a || (r.exposure.get(p.slot) ?? 0) > (r.exposure.get(a.slot) ?? 0) ? p : a),
        undefined,
      );
      r.target = target?.slot ?? 0;
    }
    for (const [i, h] of this.hunters.entries()) {
      const e = h.ai;
      const score = (p: Explorer) => {
        const loudness = this.audibleLevel(p);
        const heard = e.canHearVoice(loudness, p.x / TILE, p.z / TILE, p.hidden);
        return Math.hypot(e.x - p.x / TILE, e.z - p.z / TILE) +
          (p.hidden ? 30 : 0) +
          (clearSight(s, e.x, e.z, p.x / TILE, p.z / TILE) ? 0 : 8) -
          (heard ? 6 + 32 * shoutStrength(loudness) : 0) -
          (h.target === p.slot ? 0.8 : 0);
      };
      const p = active
        .filter((p) => p.alive)
        .reduce<Explorer | undefined>((a, b) => (!a || score(b) < score(a) ? b : a), undefined);
      if (!p) break;
      if (p.slot !== h.target) e.releaseContact();
      h.target = p.slot;
      const px = p.x / TILE,
        pz = p.z / TILE;
      if (
        s.id === 'lobby' &&
        this.warning < 0 &&
        (this.time > 42 ||
          flags.some((f) => /^rail\d/.test(f)) ||
          (this.time > 8 && e.canHearVoice(this.audibleLevel(p), px, pz, p.hidden)))
      )
        this.warning = this.time;
      const asleep =
        i === 0 &&
        ((s.id === 'lobby' && (this.warning < 0 || this.time - this.warning < 9)) ||
          (s.id === 'village' && (this.time % 80 < 32 || this.time % 80 >= 69)) ||
          (s.id === 'field' && !flags.includes('wind-east')) ||
          (s.id === 'funplus' && flags.includes('fun-blue')) ||
          (e.kind === 'camera' && flags.includes('office-camera')) ||
          (s.id === 'outpost' && flags.includes('cured-agent')));
      h.visible = !(asleep && ['lobby', 'village', 'field', 'funplus'].includes(s.id));
      const x = e.x,
        z = e.z;
      e.tick(
        dt,
        px,
        pz,
        !!(p.gaze & (1 << i)),
        !!(p.beam & (1 << i)),
        p.moving,
        p.sprint,
        p.crouch,
        p.hidden,
        p.light,
        asleep ? 1 : grace,
        this.time < this.alarm ? s.objects.find((o) => o.gives?.includes('archive-alarm')) : undefined,
        this.audibleLevel(p),
      );
      h.speed = (Math.hypot(e.x - x, e.z - z) * TILE) / dt;
      if (e.contact) {
        if (e.kind === 'camera') {
          const origin = spawn(p.slot, s.id, p.lives);
          Object.assign(p, {
            cause: '',
            x: origin.x,
            z: origin.z,
            y: 0,
            yaw: origin.yaw,
            spawnId: p.spawnId + 1,
            cargo: '',
            hidden: false,
          });
          this.immunity.set(p.slot, this.time + 3);
        } else {
          this.loseLife(p, 'Caught by ' + e.kind + '.');
        }
        e.releaseContact();
      }
    }
    this.checkSurvivors();
  }
  snapshot(): Snapshot {
    return {
      phase: this.phase,
      hunt: this.hunt ? { ...this.hunt } : undefined,
      epoch: this.epoch,
      revision: this.revision,
      time: this.time,
      journal: this.journal,
      residents: this.hunt ? [] : this.residents.map(({ behavior: b, target }) => ({
        phase: b.phase,
        time: b.time,
        exposure: b.exposure,
        target,
      })),
      players: [...this.players.values()].map((p) => ({ ...p })),
      monsters: this.hunt ? [] : this.hunters.map(({ ai: e, speed, target, visible }) => ({
        x: e.x * TILE,
        z: e.z * TILE,
        yaw: e.angle,
        wind: e.winding,
        strike: e.lunging,
        heard: e.heardVoice,
        reach: e.reach,
        contactPose: e.contactPose,
        frozen: e.heldByGaze,
        danger: e.danger,
        speed,
        target,
        visible,
      })),
    };
  }
}
