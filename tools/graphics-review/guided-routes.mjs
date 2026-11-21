// Run against two local Vite servers with Playwright installed.
// node guided-routes.mjs BASELINE_PORT CANDIDATE_PORT
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const out = process.env.GRAPHICS_OUTPUT || './graphics-results';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  channel: 'chrome',
  args: [
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
async function open(port) {
  const p = await b.newPage({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => {
    if (m.type() === 'error')
      errors.push([m.text().slice(0, 300), m.location().url.split('/').pop()]);
  });

  await p.addInitScript(() => {
    window.seed = 123;
    Math.random = () =>
      (window.seed = (Math.imul(1664525, window.seed) + 1013904223) >>> 0) /
      4294967296;
  });
  await p.goto('http://127.0.0.1:' + port + '/');
  await p.evaluate(async () => {
    const src = await (await fetch('/src/main.ts')).text(),
      { Game } = await import(
        src.match(/import\("([^"]*\/game\.ts[^"]*)"\)/)?.[1] || '/src/game.ts'
      );
    const start = Game.prototype.start;
    Game.prototype.start = function (...a) {
      window.g = this;
      return start.apply(this, a);
    };
    Game.prototype.run = function () {};
  });
  await p.locator('#enter').click();
  await p.waitForFunction(() => window.g?.mode === 'playing' && g.world, null, {
    timeout: 90000,
  });
  await p.waitForLoadState('networkidle');
  await p.evaluate(async () => {
    const E = await import('/src/multiplayer/explorers.ts');
    await E.loadExplorer();
    const { Expedition } = await import('/src/multiplayer/expedition.ts');
    const { terrainHeight } = await import('/src/world.ts');
    const gl = g.renderer.getContext(),
      ext = gl.getExtension('WEBGL_debug_renderer_info');
    window.gpu = ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    window.setup = (route, quality) => {
      window.seed = 501;
      g.applySettings({ ...g.settings, quality, headBob: false });
      g.enter(route === 'pool' ? 'deepool' : 'lobby');
      g.state.flashlight = true;
      g.grace = 10000;
      const r = g.renderer;
      r.info.autoReset = false;
      let path;
      for (const [cx, cz] of [
        [47, 12],
        [35, 18],
        [15, 10],
        [7, 6],
        [8, 8],
        [12, 12],
        ...g.stage.map.flatMap((row, z) => Array.from(row, (_, x) => [x, z])),
      ]) {
        for (const [dx, dz] of [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ]) {
          const x = cx * 3.2,
            z = cz * 3.2;
          if (
            Array.from({ length: 41 }, (_, i) => i * 0.25).every((d) =>
              g.canStand(x + dx * d, z + dz * d)
            )
          ) {
            path = { x, z, dx, dz };
            break;
          }
        }
        if (path) break;
      }
      if (!path) throw Error('No open ten metre aisle');
      const { x: x0, z: z0, dx, dz } = path,
        yaw = Math.atan2(dx, -dz);
      g.x = x0;
      g.z = z0;
      g.yaw = yaw;
      g.pitch = 0;
      g.keys.clear();
      const metrics = {
        start: null,
        end: null,
        phases: { approach: 0, windup: 0, strike: 0, recover: 0 },
      };
      let team, sim;
      if (route === 'host') {
        sim = new Expedition();
        for (let i = 0; i < 8; i++) sim.add();
        sim.start();
        team = new E.Explorers();
        team.attach(g.scene);
      }
      const fx = Math.sin(yaw),
        fz = -Math.cos(yaw),
        rx = Math.cos(yaw),
        rz = Math.sin(yaw);
      function update(i) {
        const u = i / 60,
          dt = 1 / 60;
        if (route === 'aisle' && i >= 0) g.keys.add('KeyW');
        if (i === 0) metrics.start = [g.x, g.z];
        g.step(dt);
        if (route === 'attack') {
          const m = g.world.entity,
            phase =
              i < 0
                ? 'approach'
                : i < 32
                ? 'approach'
                : i < 56
                ? 'windup'
                : i < 75
                ? 'strike'
                : 'recover';
          const distance =
            i < 0
              ? 6
              : i < 32
              ? 6 - (3.4 * i) / 31
              : i < 56
              ? 2.6
              : i < 75
              ? 2.6 - (1.73 * (i - 56)) / 18
              : 0.87 + (0.9 * (i - 75)) / 14;
          if (i >= 0) metrics.phases[phase]++;
          m.visible = true;
          m.position.set(
            g.x + dx * distance,
            terrainHeight(g.stage, g.x + dx * distance, g.z + dz * distance),
            g.z + dz * distance
          );
          m.rotation.y = Math.atan2(-dx, -dz);
          m.userData.pose?.(
            Math.max(0, u),
            dt,
            phase === 'approach' ? 5 : phase === 'strike' ? 15 : 0,
            phase === 'windup',
            phase === 'strike',
            false,
            0,
            false,
            0
          );
          g.camera.lookAt(m.position.x, m.position.y + 1.7, m.position.z);
          g.camera.updateMatrixWorld(true);
        }
        metrics.end = [g.x, g.z];
        if (sim) {
          for (const v of sim.players.values()) {
            const slot = v.slot - 2;
            const side = (slot < 4 ? slot - 1.5 : slot - 5) * 0.72;
            const d = slot < 4 ? 2.9 : 4.3;
            v.x = x0 + fx * d + rx * side + 0.05 * Math.sin(u + slot);
            v.z = z0 + fz * d + rz * side;
            v.yaw = yaw + Math.PI;
            v.moving = true;
            v.sprint = false;
          }
          if (i % 3 === 0) sim.step(0.05);
          const snap = sim.snapshot();
          team.update(snap.players, 1, 0, dt, (x, z) =>
            terrainHeight(g.stage, x, z)
          );
        }
      }
      window.focusRun = async (quant, cap) => {
        const arr = [],
          calls = [],
          tris = [],
          cad = [],
          px = new Uint8Array(4);
        let last;
        for (let i = -24; i < quant; i++) {
          const raf = await new Promise(requestAnimationFrame);
          const at = performance.now();
          update(i);
          r.info.reset();
          g.renderView(1 / 60);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          if (i >= 0) {
            arr.push(performance.now() - at);
            cad.push(raf - last);
            calls.push(r.info.render.calls);
            tris.push(r.info.render.triangles);
          }
          last = raf;
        }
        const percentile = (a, v) =>
          a.slice().sort((a, b) => a - b)[Math.ceil(a.length * v) - 1];
        const probe = {
          median: percentile(arr, 0.5),
          p95: percentile(arr, 0.95),
          rafMedian: percentile(cad, 0.5),
          rafP95: percentile(cad, 0.95),
          calls: percentile(calls, 0.5),
          tri: percentile(tris, 0.5),
          size: [gl.drawingBufferWidth, gl.drawingBufferHeight],
          mem: { ...r.info.memory },
          programs: r.info.programs.length,
          avatars: team?.root.children.filter((o) => o.visible).length || 0,
        };
        if (cap) {
          const c = document.createElement('canvas');
          c.width = gl.drawingBufferWidth;
          c.height = gl.drawingBufferHeight;
          c.getContext('2d').drawImage(r.domElement, 0, 0);
          probe.img = c.toDataURL('image/webp', 0.93);
        }
        g.keys.clear();
        probe.path = path;
        probe.groundDistanceMetres = Math.hypot(
          metrics.end[0] - metrics.start[0],
          metrics.end[1] - metrics.start[1]
        );
        probe.animationSamples = metrics.phases;
        if (route === 'aisle' && probe.groundDistanceMetres < 5.9)
          throw Error('Incomplete walk ' + probe.groundDistanceMetres);
        if (route === 'attack' && metrics.phases.strike < 18)
          throw Error('Missing strike');
        team?.dispose();
        return probe;
      };
    };
  });
  return { p, errors, gpu: await p.evaluate(() => window.gpu) };
}

const cases = ['aisle', 'attack'],
  tiers = ['standard', 'performance'];
const flavors =
  process.argv[4] && process.argv[4] !== 'both'
    ? [process.argv[4]]
    : ['baseline', 'candidate'];
const output = process.argv[5] || 'paired';
const passes = Number(process.argv[6] || 3);
const rendered = { baseline: [], candidate: [] };
const N = Number(process.env.PHOTO_FRAMES || 90);
try {
  const entries = {};
  for (const flavor of flavors) {
    entries[flavor] = await open(
      flavor === 'baseline' ? process.argv[2] : process.argv[3]
    );
    console.log(flavor, entries[flavor].gpu);
  }
  for (let j = 1; j <= passes; j++)
    for (const route of cases)
      for (const quality of j % 2 ? tiers : tiers.slice().reverse()) {
        const order =
          (j + cases.indexOf(route) + tiers.indexOf(quality)) % 2
            ? flavors
            : flavors.slice().reverse();
        for (const flavor of order) {
          const { p, errors, gpu } = entries[flavor];
          await p.bringToFront();
          await p.evaluate(([a, b]) => window.setup(a, b), [route, quality]);
          const res = await p.evaluate(
            ([n, cap]) => window.focusRun(n, cap),
            [N, j === 1 && quality === 'standard']
          );
          if (res.img) {
            writeFileSync(
              out + '/' + flavor + '-' + route + '.webp',
              Buffer.from(res.img.split(',')[1], 'base64')
            );
            delete res.img;
          }
          rendered[flavor].push({ j, route, quality, ...res });
          writeFileSync(
            out + '/' + output + '-' + flavor + '.json',
            JSON.stringify(
              { gpu, results: rendered[flavor], errors, frames: N },
              null,
              2
            )
          );
          console.log(
            j,
            route,
            quality,
            flavor,
            res.p95.toFixed(2),
            res.median.toFixed(2),
            res.rafP95.toFixed(2),
            res.calls,
            res.tri,
            res.avatars
          );
        }
      }
} finally {
  await b.close();
}
