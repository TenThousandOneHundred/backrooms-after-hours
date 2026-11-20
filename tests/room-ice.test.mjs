import test from 'node:test';
import assert from 'node:assert/strict';
import { roomIceServers } from '../src/multiplayer/ice.ts';

test('relay credentials extend the direct routes and invalid responses preserve them', async (t) => {
  const direct = await roomIceServers();
  const relay = {
    urls: ['turn:relay.example.org:3478', 'turns:relay.example.org:443?transport=tcp'],
    username: 'temporary', credential: 'temporary',
  };
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ iceServers: [relay] }));
  assert.deepEqual(await roomIceServers('https://example.org/ice'), [...direct, relay]);
  fetch.mock.mockImplementation(async () => Response.json([null, { urls: 'https://example.org' }, relay]));
  assert.deepEqual(await roomIceServers('https://example.org/ice'), [...direct, relay]);
  fetch.mock.mockImplementation(async () => new Response('', { status: 503 }));
  assert.deepEqual(await roomIceServers('https://example.org/ice'), direct);
  fetch.mock.mockImplementation(async () => { throw new Error('Offline'); });
  assert.deepEqual(await roomIceServers('https://example.org/ice'), direct);
});
