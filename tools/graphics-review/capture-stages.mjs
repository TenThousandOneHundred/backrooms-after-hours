// node capture-stages.mjs before 5173  (or after 5174), with Playwright and Chrome installed.
import { chromium } from 'playwright';
import fs from 'node:fs';
const [side, port] = process.argv.slice(2),
  out = process.env.GRAPHICS_OUTPUT || './graphics-results',
  dir = out + '/stages/' + side;
fs.mkdirSync(dir, { recursive: true });
const views = JSON.parse(
    fs.readFileSync(new URL('./stage-views.json', import.meta.url))
  ),
  errors = [];
const browser = await chromium.launch({
  channel: 'chrome',
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
  ],
});
try {
  for (let block = 0; block < views.length; block += 8) {
    if (
      process.env.ONLY &&
      !views
        .slice(block, block + 8)
        .some((v) => process.env.ONLY.split(',').includes(v.id))
    )
      continue;
    const p = await browser.newPage({
      viewport: { width: 896, height: 504 },
      deviceScaleFactor: 1,
    });
    p.on('pageerror', (e) => errors.push(String(e)));
    p.on('console', (e) => {
      if (e.type() === 'error') errors.push(e.text().slice(0, 300));
    });
    await p.addInitScript(() => {
      let n = 123;
      window.reseed = (k) => {
        n = k;
      };
      Math.random = () =>
        (n = (Math.imul(1664525, n) + 1013904223) >>> 0) / 4294967296;
      localStorage.setItem(
        'backrooms-after-hours:settings',
        JSON.stringify({ quality: 'standard', headBob: false })
      );
    });
    await p.goto('http://127.0.0.1:' + port + '/');
    await p.evaluate(async () => {
      const src = await (await fetch('/src/main.ts')).text();
      const { Game } = await import(
        src.match(/import\("([^"]*\/game\.ts[^"]*)"\)/)?.[1] ?? '/src/game.ts'
      );
      const start = Game.prototype.start;
      Game.prototype.start = function (...args) {
        window.g = this;
        return start.apply(this, args);
      };
      Game.prototype.run = function () {};
    });
    await p.locator('#enter').click();
    await p.waitForFunction(() => window.g?.world, null, { timeout: 60000 });
    for (let i = block; i < Math.min(block + 8, views.length); i++) {
      if (
        process.env.ONLY &&
        !process.env.ONLY.split(',').includes(views[i].id)
      )
        continue;
      const s = views[i];
      if (!s.anchor) throw Error('missing anchor ' + s.id);
      await p.evaluate(
        ({ id, anchor, i }) => {
          window.reseed(1000 + i);
          g.enter(id);
          g.time = 4;
          g.hidden = false;
          const { x, z, dx, dz } = anchor;
          g.x = 3.2 * x - dx * 0.95 + dz * 0.47;
          g.z = 3.2 * z - dz * 0.95 - dx * 0.47;
          const tx = (x + 0.49 * dx) * 3.2,
            tz = (z + 0.49 * dz) * 3.2;
          g.yaw = Math.atan2(tx - g.x, -(tz - g.z));
          g.pitch = -0.18;
          g.cameraPose(0, false);
        },
        { ...s, i }
      );
      await p.waitForLoadState('networkidle');
      for (const light of [false, true]) {
        const data = await p.evaluate(async (light) => {
          g.state.flashlight = light;
          g.cameraPose(0, false);
          for (let j = 0; j < 3; j++) {
            g.world.update(4, 0, g.camera);
            g.renderView(0);
            await new Promise(requestAnimationFrame);
          }
          const dest = document.createElement('canvas');
          dest.width = 896;
          dest.height = 504;
          g.renderView(0);
          dest
            .getContext('2d')
            .drawImage(g.renderer.domElement, 0, 0, dest.width, dest.height);
          return dest.toDataURL('image/jpeg', 0.89).split(',')[1];
        }, light);
        fs.writeFileSync(
          dir + '/' + s.id + (light ? '-on' : '-off') + '.jpg',
          Buffer.from(data, 'base64')
        );
      }
      console.log(i + 1, s.id);
    }
    await p.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(
    dir + '/browser-errors.json',
    JSON.stringify([...new Set(errors)], null, 2)
  );
}
