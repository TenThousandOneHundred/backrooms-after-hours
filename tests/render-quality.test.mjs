import test from 'node:test';
import assert from 'node:assert/strict';
import {AdaptiveResolution, graphicsQuality, pixelRatio} from '../src/render-quality.ts';

test('graphics presets preserve saved choices and adapt only the Auto buffer', () => {
  for (const preset of ['auto','standard','high','performance']) assert.equal(graphicsQuality(preset), preset);
  for (const missing of [null, undefined, 'invalid']) assert.equal(graphicsQuality(missing), 'auto');
  assert.deepEqual(['high','standard','performance','auto'].map(p=>pixelRatio(p,2,.625)), [1.65,1,.75,.625]);
  assert.equal(pixelRatio('auto',.8,1),.8);
});

test('adaptive resolution ignores isolated stalls, lowers after sustained load and recovers slowly', () => {
  const resolution=new AdaptiveResolution();
  const sample=(frames,ms)=>{for(let i=0;i<frames;i++) resolution.sample(ms);};
  sample(35,16.7); sample(1,180); sample(60,16.7);
  assert.equal(resolution.scale,1);
  resolution.resetTiming();
  sample(30,35); resolution.sample(8000); sample(24,35);
  assert.equal(resolution.scale,1);
  sample(250,35);
  assert.equal(resolution.scale,.625);
  sample(280,16.7);
  assert.equal(resolution.scale,.625);
  sample(1500,16.7);
  assert.equal(resolution.scale,1);
});
