import assert from 'node:assert/strict';
import test from 'node:test';
import { stages } from '../src/campaign.ts';
import { campaignObjective } from '../src/campaign-objectives.ts';
import { exchangePulses, exchangeTranscript } from '../src/concourse-plan.ts';
import { Expedition } from '../src/multiplayer/expedition.ts';
import { freshProgress } from '../src/game-state.ts';
import { TILE } from '../src/game-entity.ts';

function objective(stage, flags, endings = []) {
  return campaignObjective(stages[stage], { flags, endings });
}

test('both Level 0 routes remain legible after an out-of-order pickup and on legacy saves', () => {
  assert.equal(objective('lobby', []).notes.length, 2);
  assert.match(objective('lobby', ['rail4', 'rail2']).current, /2\/4.*north corridor/);
  assert.match(objective('lobby', ['rail1', 'rail2', 'rail3', 'rail4']).current, /broken ladder/);
  assert.match(objective('lobby', ['ladder-built']).current, /ceiling cubby/);
  assert.match(objective('lobby', ['ladder-built', 'lobby-key']).current, /service door/);
  const call = objective('lobby', ['exchange-call', 'rail1']);
  assert.ok(call.current.includes(exchangeTranscript));
  assert.match(call.notes[0], /1\/4/);
});

test('co-op explorers can split the relay, bleed and hatch without collecting a ladder rail', () => {
  const r = new Expedition();
  const host = r.add(),
    guest = r.add();
  r.start();
  const use = (slot, model, code) => {
    const obj = stages.lobby.objects.find((o) => o.model === model);
    r.command(slot, r.epoch, {
      type: 'pose',
      pose: { ...r.players.get(slot), x: obj.x * TILE, z: obj.z * TILE },
    });
    r.command(slot, r.epoch, { type: 'use', id: obj.id, code });
  };
  use(guest, 'returns-valve');
  use(guest, 'pressure-door');
  assert.equal(r.journal.stage, 'lobby');
  assert.deepEqual(r.journal.flags, []);
  use(host, 'telephone');
  use(guest, 'returns-terminal', '000');
  assert.deepEqual(r.journal.flags, ['exchange-call']);
  use(guest, 'returns-terminal', exchangePulses.join(''));
  assert.match(campaignObjective(stages.lobby, r.snapshot().journal).current, /red valve/);
  use(host, 'returns-valve');
  assert.match(campaignObjective(stages.lobby, r.snapshot().journal).current, /open the hatch/i);
  use(guest, 'pressure-door');
  assert.equal(r.journal.stage, 'lower');
});

test('the archive projector and sixteen-reel routes unlock the same projection', () => {
  const s = stages.library;
  const cart = s.objects.find((o) => o.model === 'projector-cart'),
    deck = s.objects.find((o) => o.model === 'splice-terminal');
  assert.equal(cart.challenge.destination, deck.id);
  assert.deepEqual(deck.need, cart.gives);
  const exit = s.objects.find((o) => o.target === 'village');
  assert.deepEqual(deck.gives, exit.need);
  assert.match(objective('library', ['tape5', 'archive-cart']).current, /tracking needle/);
  assert.match(
    objective(
      'library',
      Array.from({ length: 16 }, (_, i) => 'tape' + (i + 1)),
    ).current,
    /Mount the sixteen/,
  );
  assert.match(objective('library', ['archive-done']).current, /Step through/);
});

test('a guest can deliver the archive cart and a resumed team can calibrate it without any tapes', () => {
  const r = new Expedition();
  r.add();
  const guest = r.add();
  r.start(freshProgress('library'));
  const library = stages.library;
  const cart = library.objects.find((o) => o.model === 'projector-cart');
  const deck = library.objects.find((o) => o.model === 'splice-terminal');
  const at = (room, slot, obj) =>
    room.command(slot, room.epoch, {
      type: 'pose',
      pose: {
        ...room.players.get(slot),
        x: obj.x * TILE,
        z: obj.z * TILE,
      },
    });
  at(r, guest, deck);
  r.command(guest, r.epoch, { type: 'use', id: deck.id });
  assert.deepEqual(r.journal.flags, []);
  at(r, guest, cart);
  r.command(guest, r.epoch, { type: 'carry', id: cart.id });
  assert.equal(r.players.get(guest).cargo, cart.id);
  at(r, guest, deck);
  r.command(guest, r.epoch, { type: 'use', id: cart.id });
  const resume = new Expedition();
  const host = resume.add();
  resume.start(structuredClone(r.snapshot().journal));
  assert.match(campaignObjective(library, resume.journal).current, /tracking needle/);
  at(resume, host, deck);
  resume.command(host, resume.epoch, { type: 'use', id: deck.id });
  const screen = library.objects.find((o) => o.target === 'village');
  at(resume, host, screen);
  resume.command(host, resume.epoch, { type: 'use', id: screen.id });
  assert.equal(resume.journal.stage, 'village');
});

test('stage guidance follows actual progress after hand-ins, in mixed order and on the return from an ending', () => {
  assert.match(objective('hotel', ['hotel-gallery', 'hotel-master']).current, /guest lift/);
  assert.match(objective('station', ['breaker3', 'breaker1']).current, /Bank A.*2\/3/);
  assert.match(objective('station', ['breaker3', 'breaker1', 'breaker2']).current, /Bank B.*0\/3/);
  assert.match(objective('slides2', ['photo4']).current, /service van.*1\/2/);
  assert.match(objective('slides2', ['photo3']).current, /Bacteria.*1\/2/);
  assert.match(objective('bunker', [], ['wrong', 'pink', 'suburbs']).current, /3\/4.*station/);
  assert.match(objective('arcade', [], ['city', 'suburbs', 'wrong', 'pink']).current, /central cabinet/);
  assert.match(objective('overgrowth', ['slide-power', 'patient-b']).current, /green chute.*Bravo/);
  assert.match(objective('funplus', ['fun-pink', 'fun-red', 'fun-cloud']).current, /party popper/);
  assert.equal(
    campaignObjective({ id: 'mod:custom', objective: 'Follow the ink trail.' }, { flags: [], endings: [] })
      .current,
    'Follow the ink trail.',
  );
});
