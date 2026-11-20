import { ClosetDoors, coverZone, reachableDoor } from '../concourse-cover.ts';
import { shoutStrength } from '../voice-reach.ts';
import type { Hunt, HuntResult } from './hunt.ts';
import { livesPerLevel, readLives, type Difficulty } from '../difficulty.ts';
import { START, stages } from '../campaign.ts';
import { recordObjective } from '../campaign-progress.ts';
import { canStandAt, clearSight, Encounter, TILE, tileAt } from '../game-entity.ts';
import { ResidentBehavior, type ResidentSite } from '../resident-behavior.ts';
import { freshProgress, type Progress } from '../game-state.ts';

export const capacity = 8;
export const roomSave = 'backrooms-after-hours.coop.v2';
export type Pose = {
  x: number;
  z: number;
  y: number;
  yaw: number;
  pitch?: number;
  stamina?: number;
  sanity?: number;
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
  | { type: 'closet'; id:number; open:boolean }
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
  closets?: { open:number; travel:number[] };
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
  hostSlot = 1;
  private doors = new ClosetDoors();
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
    this.configureHunt(this.players.has(this.hunt.monster) ? this.hunt.monster : this.hostSlot);
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

  private disconnected = new Map<string, { player: Explorer; epoch: number; holdUntil: number; respawnAt?: number }>();
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

  private joinTeam(player: Explorer) {
    const stage = stages[this.journal.stage];
    for (const teammate of this.players.values()) {
      if (!this.fresh.has(teammate.slot) || !teammate.alive || teammate.hidden || teammate.crouch || teammate.y !== 0) continue;
      const tx = teammate.x / TILE, tz = teammate.z / TILE;
      if (tileAt(stage, tx, tz) !== '.') continue;
      for (const [dx, dz] of [[.9,0], [-.9,0], [0,.9], [0,-.9]]) {
        const x = teammate.x + dx, z = teammate.z + dz;
        // Stay on the same floor tile so an offset cannot cross a pit or beam.
        if (Math.round(x/TILE) !== Math.round(tx) || Math.round(z/TILE) !== Math.round(tz) ||
          !canStandAt(stage, x, z, false, 0, this.doors.travel) ||
          !clearSight(stage, tx, tz, x/TILE, z/TILE, 1.58, 1.58, this.doors.travel)) continue;
        if ([...this.players.values()].some(p => p !== player && p.alive && Math.hypot(x-p.x,z-p.z) < .65)) continue;
        player.x = x;
        player.z = z;
        player.yaw = teammate.yaw;
        return;
      }
    }
  }

  private seatHeld(slot: number) {
    for (const entry of this.disconnected.values())
      if (entry.player.slot === slot && entry.holdUntil > Date.now()) return true;
    return false;
  }

  add(identity?: string, verified = false) {
    if (this.hunt && this.phase === 'playing') this.checkSurvivors();
    const id = !this.players.size ? 'host' : typeof identity === 'string' && (verified && identity === 'host' || /^[a-f0-9-]{36}$/i.test(identity))
      && ![...this.identities.values()].includes(identity) ? identity : crypto.randomUUID();
    const saved = this.disconnected.get(id);
    let slot = 0;
    if (saved && !this.players.has(saved.player.slot) && (saved.holdUntil > Date.now() || !this.seatHeld(saved.player.slot)))
      slot = saved.player.slot;
    if (!slot) {
      for (slot = 1; slot <= capacity; slot++)
        if (!this.players.has(slot) && !this.seatHeld(slot)) break;
      if (slot > capacity) return 0;
    }
    this.disconnected.delete(id);
    this.identities.set(slot, id);
    this.spawnPlayer(slot);
    const player = this.players.get(slot)!;
    if (this.phase === 'playing') {
      if (saved?.epoch === this.epoch) {
        const old = saved.player;
        const stage = stages[this.journal.stage];
        const fits = canStandAt(stage, old.x, old.z, old.crouch, old.y, this.doors.travel);
        const cargo = old.cargo && !this.journal.completed.includes(stage.id + '/' + old.cargo)
          && ![...this.players.values()].some(p => p.cargo === old.cargo) ? old.cargo : '';
        const position = fits ? {} : {x: player.x, z: player.z, y: 0, hidden: false, crouch: false};
        Object.assign(player, old, position, { slot, cargo, voice: 0, sprint: false, moving: false, gaze: 0, beam: 0, watching: 0 });
        if (saved.respawnAt != null) this.respawns.set(slot, saved.respawnAt);
      } else if (player.alive && !this.hunt && !this.journal.pending) this.joinTeam(player);
      if (player.alive) this.immunity.set(slot, Infinity);
    }
    return slot;
  }
  remove(slot: number, holdSeat = false) {
    const id = this.identities.get(slot), player = this.players.get(slot);
    if (!id || !player) return;
    if (this.phase === 'playing') {
      this.disconnected.set(id, { player: { ...player }, epoch: this.epoch,
        holdUntil: holdSeat ? Date.now() + 120_000 : 0, respawnAt: this.respawns.get(slot) });
    }
    this.players.delete(slot);
    this.identities.delete(slot);
    this.respawns.delete(slot);
    this.fresh.delete(slot);
    this.radioNoise.delete(slot);
    this.immunity.delete(slot);
    for (const r of this.residents) r.exposure.delete(slot);
    if (this.hunt?.monster === slot) {
      if (this.phase === 'waiting') this.configureHunt(this.hostSlot);
      else if (!holdSeat) this.finishHunt('abandoned');
    } else if (this.hunt && this.players.size < 2 && !holdSeat) this.finishHunt('abandoned');
    this.checkSurvivors();
  }
  private checkSurvivors() {
    if (this.phase !== 'playing' || !this.players.size) return;
    if (this.hunt && !this.players.has(this.hunt.monster) && !this.seatHeld(this.hunt.monster)) {
      this.finishHunt('abandoned');
      return;
    }
    if ([...this.players.values()].some(p => p.slot !== this.hunt?.monster && p.lives > 0)) return;
    for (const saved of this.disconnected.values())
      if (saved.epoch === this.epoch && saved.player.lives > 0 && saved.player.slot !== this.hunt?.monster && saved.holdUntil > Date.now()) return;
    if (this.hunt) this.finishHunt('caught');
    else this.phase = 'lost';
  }
  start(saved?: Progress | null) {
    if (this.phase === 'playing' || this.phase === 'finished' || (this.hunt && (this.players.size < 2 || !this.players.has(this.hunt.monster)))) return;
    const resume = this.phase === 'waiting' && !this.hunt && saved && Object.hasOwn(stages, saved.stage);
    if (resume) this.journal = saved;
    this.enter(this.journal.stage, !!resume);
    this.checkSurvivors();
  }
  private enter(stage: string, resume = false) {
    this.phase = 'playing';
    this.journal.stage = stage;
    this.doors = new ClosetDoors();
    if (!resume) this.journal.teamLives = {};
    this.respawns.clear();
    for (const [id, entry] of this.disconnected)
      if (entry.holdUntil <= Date.now()) this.disconnected.delete(id);
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
      if (slot === this.hostSlot && j.pending) {
        const target = j.pending.target;
        j.pending = null;
        this.enter(target);
      }
      return;
    }
    if (!p.alive || j.pending) return;
    if (action.type === 'closet') {
      if(s.id==='lobby' && typeof action.open==='boolean' && Number.isInteger(action.id) &&
        reachableDoor(p.x,p.z)?.door===action.id) {
        if(action.open)this.doors.open |= 1<<action.id;
        else this.doors.open &= ~(1<<action.id);
      }
      return;
    }
    if (action.type === 'pose') {
      const q = action.pose;
      if (
        !q ||
        q.spawnId !== p.spawnId ||
        ![q.x, q.z, q.y, q.yaw, q.voice].every(Number.isFinite) ||
        Math.abs(q.y) > 10 ||
        Math.abs(q.x) > s.map[0].length * TILE ||
        Math.abs(q.z) > s.map.length * TILE ||
        !canStandAt(s, q.x, q.z, q.crouch, q.y, this.doors.travel) ||
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
        hidden: q.hidden && (s.id !== 'lobby' || s.objects.some(o =>
          o.kind === 'hide' && Math.hypot(o.x * TILE - q.x, o.z * TILE - q.z) < 4.85 &&
          clearSight(s, q.x / TILE, q.z / TILE, o.x, o.z, 1.45, 1.45, this.doors.travel))),
        moving: q.moving,
        sprint: q.sprint,
        light: q.light,
        gaze: q.gaze,
        beam: q.beam,
        watching: q.watching,
        voice: Math.max(0, Math.min(1, q.voice)),
      });
      if (this.immunity.get(slot) === Infinity) this.immunity.set(slot, this.time + 3);
      if (Number.isFinite(q.pitch)) p.pitch = Math.max(-1.36, Math.min(1.36, q.pitch!));
      if (Number.isFinite(q.stamina)) p.stamina = Math.max(0, Math.min(100, q.stamina!));
      if (Number.isFinite(q.sanity)) p.sanity = Math.max(0, Math.min(100, q.sanity!));
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
    if(s.id==='lobby')this.doors.step(dt,alive);
    for (const p of alive)
      if (this.time - (this.fresh.get(p.slot) ?? 0) > 0.65) {
        p.voice = 0;
        p.sprint = false;
        p.moving = false;
      }
    if (this.hunt) { this.checkSurvivors(); return; }
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
          (!veil || !this.enclosed(p)) &&
          clearSight(s, p.x / TILE, p.z / TILE, site.x, site.z,p.y+(p.crouch?.97:1.58),veil?1.85:2.2,this.doors.travel),
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
      let p: Explorer | undefined;
      let bestRank = -1, bestDistance = Infinity;
      for (const player of active) {
        if (!player.alive) continue;
        const loudness = this.audibleLevel(player);
        const cues = e.perceive(player.x / TILE, player.z / TILE,
          { ...player, voice: loudness }, this.doors.travel, player.y);
        const inReach = e.kind === 'bonethief' && !cues.hidden && cues.line && cues.distance < 0.77;
        const detected = cues.heardVoice || cues.heardSteps || cues.seen || inReach;
        const rank = detected ? 2 : cues.hidden ? 0 : 1;
        const distance = cues.distance - (cues.heardVoice ? 6 + 32 * shoutStrength(loudness) : 0) - (h.target === player.slot ? 0.8 : 0);
        if (rank > bestRank || (rank === bestRank && distance < bestDistance)) {
          p = player;
          bestRank = rank;
          bestDistance = distance;
        }
      }
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
        this.doors.travel,
        p.y,
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
  private enclosed(p: Explorer){
    const zone=this.journal.stage==='lobby' && coverZone(p.x,p.z,p.crouch,this.doors.travel,p.y);
    return !!zone && zone!=='cubicle';
  }
  checkpoint() {
    return { savedAt: Date.now(), previousHost: this.hostSlot, state: this.snapshot(), identities: [...this.identities], disconnected: [...this.disconnected],
      respawns: [...this.respawns], immunity: [...this.immunity].map(([slot,until]) => [slot, Number.isFinite(until) ? until : -1] as const),
      warning: this.warning, alarm: this.alarm, hunters: this.hunters.map(h => h.ai.checkpoint()),
      exposures: this.residents.map(r => [...r.exposure]) };
  }

  static takeOver(copy: ReturnType<Expedition['checkpoint']>, hostSlot: number) {
    const game = new Expedition(), s = copy.state;
    game.hostSlot = hostSlot;
    game.journal = structuredClone(s.journal);
    if (s.phase !== 'waiting') game.enter(s.journal.stage, true);
    game.epoch = s.epoch;
    game.revision = s.revision;
    game.time = s.time;
    game.phase = s.phase;
    game.hunt = s.hunt ? {...s.hunt} : undefined;
    game.identities = new Map(copy.identities);
    // Reservations use wall time locally. Translate their remaining duration
    // when moving between computers whose clocks can differ.
    const clockOffset = Date.now() - copy.savedAt;
    game.disconnected = new Map(copy.disconnected.map(([id,entry]) => [id,{...entry, holdUntil:entry.holdUntil + clockOffset}]));
    game.respawns = new Map(copy.respawns);
    game.immunity = new Map(copy.immunity.map(([slot,until]) => [slot, until < 0 ? Infinity : until]));
    game.warning = copy.warning;
    game.alarm = copy.alarm;
    if (s.closets) { game.doors.open = s.closets.open; game.doors.travel = [...s.closets.travel]; }
    game.hunters.forEach((h,i) => {
      h.ai.restore(copy.hunters[i]);
      const frame = s.monsters[i];
      if (frame) { h.target = frame.target; h.speed = frame.speed; h.visible = frame.visible; }
    });
    game.residents.forEach((r,i) => {
      const frame = s.residents[i];
      if (frame) {
        Object.assign(r.behavior, {phase:frame.phase, time:frame.time, exposure:frame.exposure});
        r.target = frame.target;
      }
      r.exposure = new Map(copy.exposures[i]);
    });
    for (const player of s.players) game.players.set(player.slot, {...player});
    // Park the other browsers until their replacement data channels arrive.
    // This also reserves their original seats in a lobby or on the results screen.
    for (const p of s.players) if (p.slot !== hostSlot) {
      const id = game.identityOf(p.slot)!;
      game.disconnected.set(id, {player:{...p}, epoch:s.epoch, holdUntil:Date.now()+120000, respawnAt:game.respawns.get(p.slot)});
      game.players.delete(p.slot);
      game.identities.delete(p.slot);
      game.respawns.delete(p.slot);
    }
    if (game.hunt && game.phase === 'waiting' && game.hunt.monster === copy.previousHost) game.hunt.monster = hostSlot;
    return game;
  }

  snapshot(): Snapshot {
    return {
      phase: this.phase,
      hunt: this.hunt ? { ...this.hunt } : undefined,
      epoch: this.epoch,
      revision: this.revision,
      time: this.time,
      journal: this.journal,
      closets: this.journal.stage==='lobby' ? {open:this.doors.open,travel:[...this.doors.travel]} : undefined,
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
