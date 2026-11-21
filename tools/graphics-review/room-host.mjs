import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const b = await chromium.launch({
  channel: 'chrome',
  args: [
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
try {
  const url = 'http://127.0.0.1:' + process.argv[2],
    host = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await host.goto(url);
  await host.evaluate(async () => {
    const main = await (await fetch('/src/main.ts')).text(),
      { Game } = await import(
        main.match(/import\("([^"]*\/game\.ts[^"]*)"\)/)?.[1] || '/src/game.ts'
      );
    const start = Game.prototype.start;
    Game.prototype.start = function (...args) {
      window.g = this;
      return start.apply(this, args);
    };
    localStorage.setItem(
      'backrooms-after-hours:settings',
      JSON.stringify({ quality: 'standard' })
    );
  });
  await host.locator('#multiplayer').click();
  await host.locator('#host-room').click();
  const code = await host.locator('#room-code').innerText({ timeout: 50000 });
  const guests = await Promise.all(
    Array.from({ length: 7 }, async () => {
      const p = await b.newPage();
      await p.route('**/graphics-network-fixture', (r) =>
        r.fulfill({
          contentType: 'text/html',
          body: '<title>Remote explorer</title>',
        })
      );
      await p.goto(url + '/graphics-network-fixture');
      await p.evaluate(async (code) => {
        const { Room } = await import('/src/multiplayer/room.ts');
        window.client = new Room(
          code,
          false,
          (s) => (window.snap = s),
          (e) => (window.failure = e),
          () => {},
          []
        );
      }, code);
      return p;
    })
  );
  await host
    .locator('#room-roster')
    .filter({ hasText: '8 / 8' })
    .waitFor({ timeout: 45000 });
  await host.locator('#start-room').click();
  await host.waitForFunction(
    () => window.g?.room?.state?.phase === 'playing',
    null,
    { timeout: 65000 }
  );
  await Promise.all(
    guests.map((p) =>
      p.waitForFunction(
        () => window.snap?.phase === 'playing' && snap.players.length === 8,
        null,
        { timeout: 45000 }
      )
    )
  );
  await host.bringToFront();
  const pose = await host.evaluate(() => ({ x: g.x, z: g.z, yaw: g.yaw }));
  await Promise.all(
    guests.map((p, i) =>
      p.evaluate(
        ({ i, pose }) => {
          const d = i < 4 ? 2.75 : 4.3,
            side = (i < 4 ? i - 1.5 : i - 5) * 0.78,
            fx = Math.sin(pose.yaw),
            fz = -Math.cos(pose.yaw),
            rx = Math.cos(pose.yaw),
            rz = Math.sin(pose.yaw);
          const tick = () => {
            const me = snap.players.find((r) => r.slot === client.slot);
            client.command(snap.epoch, {
              type: 'pose',
              pose: {
                ...me,
                x: pose.x + fx * d + rx * side,
                z: pose.z + fz * d + rz * side,
                yaw: pose.yaw + Math.PI,
                moving: true,
                sprint: false,
                voice: 0.15,
              },
            });
          };
          tick();
          window.timer = setInterval(tick, 120);
        },
        { i, pose }
      )
    )
  );
  await host.waitForFunction(
    () => g.team.root.children.filter((o) => o.visible).length === 7,
    null,
    { timeout: 15000 }
  );
  const info = await host.evaluate(async (first) => {
    const results = [];
    const renderer = g.renderer;
    renderer.info.autoReset = false;
    const original = g.renderView;
    g.renderView = function (dt) {
      renderer.info.reset();
      original.call(this, dt);
    };
    const qualityOrder =
      first === 'standard'
        ? ['standard', 'performance']
        : ['performance', 'standard'];
    for (const quality of qualityOrder) {
      g.applySettings({ ...g.settings, quality });
      const frames = [],
        draws = [],
        tris = [];
      let t = await new Promise(requestAnimationFrame);
      let minMeshes = 7;
      for (let i = 0; i < 300; i++) {
        const n = await new Promise(requestAnimationFrame);
        if (i >= 120) {
          frames.push(n - t);
          draws.push(renderer.info.render.calls);
          tris.push(renderer.info.render.triangles);
          minMeshes = Math.min(
            minMeshes,
            g.team.root.children.filter((o) => o.visible).length
          );
        }
        t = n;
      }
      const q = (a, p) => a.sort((a, b) => a - b)[Math.ceil(a.length * p) - 1];
      const snapshot = {
        roster: g.room.state.players.length,
        visibleExplorerMeshes: g.team.root.children.filter((o) => o.visible)
          .length,
        minMeshes,
        quality: g.settings.quality,
        intervalMedian: q(frames, 0.5),
        intervalP95: q(frames, 0.95),
        calls: q(draws, 0.5),
        triangles: q(tris, 0.5),
        resources: { ...renderer.info.memory },
        programs: renderer.info.programs.length,
        warmupFrames: 120,
        sampledFrames: 180,
        mode: g.mode,
        viewport: [innerWidth, innerHeight],
        buffer: [renderer.domElement.width, renderer.domElement.height],
      };
      const samples = [];
      let activeStart;
      const syncTeam = g.syncTeam,
        draw = g.renderView,
        gl = renderer.getContext(),
        pixel = new Uint8Array(4);
      g.syncTeam = function (...a) {
        activeStart = performance.now();
        return syncTeam.apply(this, a);
      };
      g.renderView = function (...a) {
        draw.apply(this, a);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        samples.push(performance.now() - activeStart);
      };
      for (let i = 0; i < 114; i++) await new Promise(requestAnimationFrame);
      g.renderView = draw;
      g.syncTeam = syncTeam;
      const stable = samples.slice(-90);
      if (stable.length !== 90)
        throw Error('No synchronized game loop samples');
      snapshot.workMedian = q(stable, 0.5);
      snapshot.workP95 = q(stable, 0.95);
      snapshot.workFrames = stable.length;
      results.push(snapshot);
    }
    return results;
  }, process.argv[3]);
  for (const row of info) {
    assert.equal(row.roster, 8);
    assert.equal(row.minMeshes, 7);
    assert.equal(row.mode, 'playing');
    assert.ok(row.calls > 0);
  }
  console.log(JSON.stringify(info));
} finally {
  await b.close();
}
