import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [label, port] = process.argv.slice(2),
  browser = await chromium.launch({
    channel: 'chrome',
    args: [
      '--disable-background-timer-throttling',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
try {
  const page = await browser.newPage({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('http://127.0.0.1:' + port);
  await page.evaluate(async () => {
    const main = await (await fetch('/src/main.ts')).text(),
      { Game } = await import(
        main.match(/import\("([^"]*\/game\.ts[^"]*)"\)/)?.[1] || '/src/game.ts'
      );
    const start = Game.prototype.start;
    Game.prototype.start = function (...a) {
      window.g = this;
      return start.apply(this, a);
    };
  });
  await page.locator('#enter').click();
  await page.waitForFunction(() => window.g?.world);
  await page.waitForLoadState('networkidle');
  const results = [];
  for (let pass = 0; pass < 3; pass++)
    for (const quality of ['standard', 'performance'])
      for (const kind of ['bacteria', 'hound', 'smiler']) {
        const sample = await page.evaluate(
          async ({ quality, kind }) => {
            const { stages } = await import('/src/campaign.ts');
            const s = Object.values(stages).find(
              (s) => s.threat?.kind === kind
            );
            g.enter(s.id);
            g.change('playing');
            g.grace = 10000;
            g.applySettings({ ...g.settings, quality });
            await new Promise((r) => setTimeout(r, 250));
            const mesh = g.world.entity;
            mesh.visible = true;
            const frames = [];
            await new Promise(requestAnimationFrame);
            const start = performance.now();
            g.caught(kind, mesh);
            const setup = performance.now() - start;
            let last = start;
            for (let i = 0; i < 46; i++) {
              const t = await new Promise(requestAnimationFrame);
              frames.push(t - last);
              last = t;
            }
            frames.sort((a, b) => a - b);
            return {
              kind,
              quality,
              setup,
              median: frames[22],
              p95: frames[43],
              buffer: [
                g.renderer.domElement.width,
                g.renderer.domElement.height,
              ],
            };
          },
          { quality, kind }
        );
        results.push(sample);
      }
  const out = process.env.GRAPHICS_OUTPUT || './graphics-results';
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(
    path.join(out, 'catch-' + label + '.json'),
    JSON.stringify({ results, errors })
  );
  console.log(label, results.length, errors);
} finally {
  await browser.close();
}
