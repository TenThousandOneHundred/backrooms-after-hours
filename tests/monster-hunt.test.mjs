import assert from 'node:assert/strict';
import test from 'node:test';
import { freshProgress } from '../src/game-state.ts';
import { Expedition } from '../src/multiplayer/expedition.ts';
import { stages } from '../src/campaign.ts';
import { TILE } from '../src/game-entity.ts';
import { soundBearing } from '../src/multiplayer/hunt.ts';

function setup(difficulty = 'medium') {
  const game = new Expedition();
  game.add();
  game.add();
  game.configureHunt(2);
  game.setDifficulty(difficulty);
  game.start();
  return game;
}
function pose(game, slot, changes) {
  game.command(slot, game.epoch, { type: 'pose', pose: { ...game.players.get(slot), ...changes } });
}

test('a hunt requires two players, assigns exactly one Bacteria, and leaves the co-op campaign separate', () => {
  const game = new Expedition();
  game.add(); game.configureHunt(1); game.start();
  assert.equal(game.phase, 'waiting');
  game.add(); game.configureHunt(2);
  const saved = freshProgress('bunker');
  game.start(saved);
  assert.equal(game.journal.stage, 'lobby');
  assert.notEqual(game.journal, saved);
  assert.equal(game.snapshot().monsters.length + game.snapshot().residents.length, 0);
  assert.ok(Math.hypot(game.players.get(1).x - game.players.get(2).x, game.players.get(1).z - game.players.get(2).z) > 20);
  game.configureHunt(1); assert.equal(game.hunt.monster, 2);
  game.remove(2); assert.equal(game.hunt.result, 'abandoned');
  game.returnToLobby(); game.configureHunt(0); game.start(saved);
  assert.equal(game.journal.stage, 'bunker');
  assert.equal(game.hunt, undefined);
});

test('only the monster can grab, within reach and facing the target, with respawn protection', () => {
  const game = setup(), victim = game.players.get(1);
  pose(game, 2, { x: victim.x + 1, z: victim.z, yaw: -Math.PI / 2 });
  const grab = slot => game.command(slot, game.epoch, { type: 'grab' });
  grab(2); assert.equal(victim.lives, 3);
  game.step(3.1); grab(1); assert.equal(victim.lives, 3);
  pose(game, 2, {yaw: Math.PI / 2}); grab(2); assert.equal(victim.lives, 3);
  game.step(1.1); pose(game, 2, {yaw: -Math.PI / 2}); grab(2); grab(2);
  assert.equal(victim.lives, 2); assert.equal(victim.alive, false);
  game.step(2.6); grab(2); assert.equal(game.players.get(1).lives, 2);
  game.step(3.1); grab(2); game.step(6); game.step(3.1); grab(2);
  assert.equal(game.phase, 'finished'); assert.equal(game.hunt.result, 'caught');
});

test('only explorers can use the unlocked exit and win the hunt', () => {
  const game = setup('hard'), exit = stages.lobby.objects.find(o => o.target);
  const finish = slot => {
    pose(game, slot, {x: exit.x * TILE, z: exit.z * TILE});
    game.command(slot, game.epoch, {type:'use',id:exit.id});
  };
  finish(1); assert.equal(game.phase, 'playing');
  game.journal.flags.push(...exit.need);
  finish(2); assert.equal(game.phase, 'playing');
  finish(1); assert.equal(game.hunt.result, 'escaped');
});

test('sound direction follows the listener’s yaw and only audible, living explorers produce cues', () => {
  const game = setup(), listener={x:0,z:0,yaw:0}, player={...game.players.get(1), x:30, z:0};
  const cue=(p, yaw=0)=>soundBearing({...listener,yaw},[p],2);
  assert.equal(cue(player), undefined);
  assert.equal(cue({...player,moving:true}), undefined);
  assert.equal(cue({...player,moving:true,sprint:true}).angle, Math.PI/2);
  assert.equal(cue({...player,voice:.7}, Math.PI/2).angle, 0);
  assert.equal(cue({...player,voice:.7,slot:2}), undefined);
  assert.equal(cue({...player,voice:.7,alive:false}), undefined);
  assert.equal(cue({...player,voice:1,x:45}), undefined);
  assert.equal(cue({...player,x:8,moving:true,crouch:true}), undefined);
});
