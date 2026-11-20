import test from 'node:test';
import assert from 'node:assert/strict';
import { pack, unpack } from 'peerjs-js-binarypack';
import { Expedition } from '../src/multiplayer/expedition.ts';
import { stateDelta, applyStateDelta } from '../src/multiplayer/state-delta.ts';
import { speechSdp } from '../src/multiplayer/voice-codec.ts';
import worker from '../tools/relay-worker.mjs';

test('eight moving explorers get the same snapshots after skipped sends with substantially fewer bytes', async t => {
  const game = new Expedition();
  for (let i=0; i<8; i++) game.add();
  game.start();
  let previous = game.snapshot(), guest = unpack(await pack(previous));
  let before = 0, after = 0;
  for (let tick=1; tick<=120; tick++) {
    for (const p of game.players.values()) {
      p.x += Math.sin(tick/10+p.slot)*.06;
      p.z += Math.cos(tick/10+p.slot)*.05;
      p.yaw = tick/12;
      p.moving = true;
      p.voice = (Math.sin(tick/7+p.slot)+1)/2;
    }
    game.step(.05);
    if (tick % 7 === 0) continue; // Simulate backpressure on one guest only.
    const next = game.snapshot();
    const {journal, ...frame} = next;
    const full = await pack({type:'state',state:frame});
    const delta = stateDelta(previous,next);
    assert.ok(delta);
    const compact = await pack({type:'delta',frame:delta});
    guest = applyStateDelta(guest,unpack(compact).frame);
    assert.deepEqual(guest, unpack(await pack(next)));
    before += full.byteLength; after += compact.byteLength; previous = next;
  }
  t.diagnostic('Moving eight-player snapshot payload: '+before+' full bytes vs '+after+' delta bytes.');
  assert.ok(after < before*.55);
  assert.equal(stateDelta(previous,{...previous,epoch:previous.epoch+1}),undefined);
  assert.equal(stateDelta(previous,{...previous,players:previous.players.slice(1)}),undefined);
  assert.equal(applyStateDelta(guest,{...stateDelta(previous,previous),players:[[99,{x:1}]]}),undefined);
});

test('voice negotiates speech bitrate, silence suppression and longer packets only for Opus audio', () => {
  const video = 'm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=rtpmap:96 VP8/90000\r\n';
  for (const params of ['', 'a=fmtp:111 minptime=10;useinbandfec=1;stereo=1\r\na=ptime:20\r\n']) {
    const input = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\n'+params+video;
    const output=speechSdp(input);
    assert.match(output,/maxaveragebitrate=16000;usedtx=1;stereo=0/);
    assert.match(output,/a=ptime:40\r\n/);
    assert.equal(speechSdp(output),output);
    assert.ok(output.endsWith(video));
    if(params) assert.ok(output.includes('useinbandfec=1'));
  }
});

test('relay switch calls only the chosen provider and keeps its API token out of the browser response', async t => {
  const request = new Request('https://relay.example/ice',{headers:{Origin:'https://tenthousandonehundred.github.io'}});
  const servers = [{urls:'turn:relay.example:3478',username:'temporary',credential:'temporary'}];
  const fetch=t.mock.method(globalThis,'fetch',async()=>Response.json({iceServers:servers}));
  for(const [provider,host] of [['cloudflare','rtc.live.cloudflare.com'],['turnix','turnix.io'],['metered','example.metered.live']]){
    const env={ACTIVE_PROVIDER:provider,CLOUDFLARE_TURN_KEY_ID:'example',CLOUDFLARE_TURN_TOKEN:'private',
      TURNIX_API_TOKEN:'private',METERED_CREDENTIALS_URL:'https://example.metered.live/ice'};
    if (provider==='metered') fetch.mock.mockImplementation(async()=>Response.json(servers));
    const response=await worker.fetch(request,env);
    assert.deepEqual(await response.json(),{iceServers:servers});
    const [url,options]=fetch.mock.calls.at(-1).arguments;
    assert.equal(new URL(url).hostname,host);
    if(provider!=='metered') assert.equal(options.headers.Authorization,'Bearer private');
  }
  assert.equal((await worker.fetch(request,{ACTIVE_PROVIDER:'unknown'})).status,503);
  assert.equal((await worker.fetch(new Request(request.url),{})).status,403);
});
