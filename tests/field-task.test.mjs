import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { FieldChallenge } from '../src/campaign-challenges.ts';

class Element {
  dataset = {};
  style = {};
  children = [];
  textContent = '';
  append(...children) {
    this.children.push(...children);
  }
  remove() {
    this.children = [];
  }
}
before(() => {
  globalThis.document = { body: new Element(), createElement: () => new Element() };
});
after(() => {
  delete globalThis.document;
});
const frame = (overrides = {}) => ({
  dt: 0.1,
  holding: false,
  range: 1,
  aimed: true,
  entityInFrame: false,
  dropRange: 10,
  moveCargo: () => {},
  ...overrides,
});
const object = (kind) => ({ kind: 'switch', name: 'Fixture', challenge: { kind } });

test('physical tasks require matching input, visibility, delivery distance and timing', () => {
  const task = new FieldChallenge();
  let cleaned = false;
  task.start(object('wind'), () => {
    cleaned = true;
  });
  for (let i = 0; i < 20; i++) assert.notEqual(task.tick(frame({ holding: true, aimed: false })), 'done');
  for (let i = 0; i < 15; i++) assert.notEqual(task.tick(frame({ holding: true })), 'done');
  task.tick(frame({ holding: true }));
  assert.equal(task.tick(frame({ holding: true })), 'done');
  task.clear();
  assert.ok(cleaned);

  task.start(object('align'), () => {});
  task.tick(frame());
  assert.equal(task.press(), false);
  for (let i = 0; i < 7; i++) task.tick(frame());
  assert.equal(task.press(), true);
  task.start(object('entity-photo'), () => {});
  for (let i = 0; i < 6; i++) task.tick(frame());
  assert.equal(task.press(), false);
  for (let i = 0; i < 6; i++) task.tick(frame({ entityInFrame: true }));
  assert.equal(task.press(), true);

  task.start(
    { ...object('haul'), challenge: { kind: 'haul', destination: 'dock', delivery: 'the dock' } },
    () => {},
  );
  let moved = false;
  task.tick(
    frame({
      dropRange: 12,
      moveCargo: () => {
        moved = true;
      },
    }),
  );
  assert.ok(moved);
  assert.equal(task.press(), false);
  task.tick(frame({ dropRange: 2 }));
  assert.equal(task.press(), true);
  task.start(object('coaster'), () => {});
  assert.equal(task.tick(frame({ range: 20 })), 'cancelled');
  task.clear();
});
