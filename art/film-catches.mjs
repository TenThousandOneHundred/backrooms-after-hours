// Start Vite, then run this with Playwright and ffmpeg available.
// node art/film-catches.mjs http://127.0.0.1:5173 /path/to/blender-exports public/encounters/catches
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const [url, libraries, output, ...only] = process.argv.slice(2);
mkdirSync(output, { recursive: true });
const scratch = mkdtempSync(path.join(tmpdir(), 'catch-frames-'));
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.route('**/film-stage', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<body></body>' })
  );
  await page.route('**/film-library/*.glb', (r) =>
    r.fulfill({
      path: path.resolve(
        libraries,
        path.basename(new URL(r.request().url()).pathname)
      ),
    })
  );
  await page.goto(url + '/film-stage');
  const kinds = await page.evaluate(async () => {
    const imports = await (await fetch('/src/bacteria.ts')).text();
    const { GLTFLoader } = await import(
      imports.match(/from "([^"]*GLTFLoader[^"]*)"/)[1]
    );
    const T = await import(imports.match(/from "([^"]*\/three\.js[^"]*)"/)[1]);
    const { catchShots } = await import('/src/catch-shots.ts');
    const { detailCreature } = await import('/src/creature-surfaces.ts');
    const stage = new T.Scene(),
      renderer = new T.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      });
    renderer.setSize(960, 540);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.13;
    const lens = new T.PerspectiveCamera(48, 16 / 9, 0.008, 200);
    const fill = new T.HemisphereLight(0x98abc1, 0x231710, 0.64);
    const key = new T.DirectionalLight(0xfce3ba, 2.5),
      rim = new T.DirectionalLight(0x9db9c5, 2.4);
    key.position.set(-2.7, 3.3, 4);
    rim.position.set(2, 1.6, -2);
    stage.add(key, rim, fill);
    const floor = new T.Mesh(
      new T.PlaneGeometry(80, 80),
      new T.MeshStandardMaterial({ color: 0x292820, roughness: 0.72 })
    );
    floor.rotation.x = -Math.PI / 2;
    stage.add(floor);
    // Backlit repeating door frames give the opening approach an architectural scale.
    const steel = new T.MeshStandardMaterial({ color: 0x414136 }),
      strip = new T.MeshBasicMaterial({ color: 0x999a7f });
    for (let z = -2; z >= -17; z -= 3) {
      for (const x of [-2.6, 2.6]) {
        const post = new T.Mesh(new T.BoxGeometry(0.12, 5, 0.19), steel);
        post.position.set(x, 1, z);
        stage.add(post);
      }
      const lintel = new T.Mesh(new T.BoxGeometry(5.3, 0.11, 0.24), steel);
      lintel.position.set(0, 3, z);
      stage.add(lintel);
      const light = new T.Mesh(new T.BoxGeometry(1.25, 0.024, 0.18), strip);
      light.position.set(0.2, 2.93, z);
      stage.add(light);
    }
    const assets = new Map();
    let current;
    window.prepare = async (kind) => {
      if (current) {
        stage.remove(current.actor);
        current.mixer.stopAllAction();
      }
      const [lib, name, start, end, height, roll, style] = catchShots[kind];
      if (!assets.has(lib))
        assets.set(
          lib,
          await new GLTFLoader().loadAsync('/film-library/' + lib + '.glb')
        );
      const asset = assets.get(lib),
        actor = asset.scene.getObjectByName(name);
      actor.position.set(0, 0, 0);
      stage.add(actor);
      detailCreature(actor);
      const mixer = new T.AnimationMixer(actor);
      const clips = ['Attack', 'Jumpscare'].map((phase) => {
        const clip = asset.animations.find((c) => c.name === name + phase);
        if (!clip) throw Error(name + phase);
        const a = mixer.clipAction(clip);
        a.setLoop(T.LoopOnce, 1);
        a.clampWhenFinished = true;
        return a;
      });
      clips[0].play();
      mixer.setTime(0);
      actor.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(actor, true),
        mid = bounds.getCenter(new T.Vector3()),
        size = bounds.getSize(new T.Vector3());
      const focus =
        actor.getObjectByName(name + '_Focus') ??
        actor.getObjectByName(
          name === 'Bacteria' ? 'Skull' : name === 'Veil' ? 'Mask1' : 'Tongue'
        );
      const head = focus
        ? focus.getWorldPosition(new T.Vector3())
        : mid.clone();
      if (name === 'Bacteria') head.y += 0.09;
      const span = Math.max(size.y, size.x * 0.66, size.z * 0.53, 0.46);
      const close = {
        camera: 0.6,
        watcher: 0.48,
        kitty: 0.45,
        farmer: 1.0,
        faceling: 0.56,
        partygoer: 0.66,
        animation: 0.57,
        king: 0.68,
        bellwether: 0.77,
        leviathan: 1.18,
        shark: 0.72,
        bonethief: 0.79,
      };
      const eyeDistance =
        close[kind] ??
        Math.max(
          0.38,
          span *
            (kind === 'neighborhoodwatch'
              ? 0.27
              : kind === 'bacteria'
              ? 0.37
              : kind === 'smiler'
              ? 0.67
              : 0.43)
        );
      current = {
        actor,
        kind,
        focus,
        mixer,
        clips,
        duration: clips.map((a) => a.getClip().duration),
        start,
        end,
        height,
        roll,
        style,
        span,
        eyeDistance,
        mid,
        head,
        last: 0,
      };
      const water = style === 'water',
        black = style === 'blackout';
      stage.background = new T.Color(
        water ? 0x091d23 : black ? 0x0a0b0e : 0x161611
      );
      stage.fog = new T.FogExp2(stage.background, water ? 0.18 : 0.115);
      floor.visible = kind !== 'bellwether' && kind !== 'bonethief';
      floor.position.y = bounds.min.y - 0.03;
      floor.material.color.setHex(water ? 0x10404b : 0x292820);
      key.color.setHex(
        water ? 0xaccfc3 : kind === 'camera' ? 0xf9b5a1 : 0xf5dab0
      );
      rim.color.setHex(water ? 0x58c0c3 : black ? 0x9baeb8 : 0xc1ae85);
      await renderer.compileAsync(stage, lens);
      return current.duration;
    };
    window.frame = (time) => {
      const s = current,
        [a, b] = s.duration,
        phase = time < a ? 0 : 1;
      const f = phase ? Math.min(1, (time - a) / b) : time / a;
      if (phase !== s.last) {
        s.clips[s.last].stop();
        s.clips[phase].reset().play();
        s.last = phase;
      }
      s.clips[phase].paused = true;
      s.clips[phase].time = f * s.duration[phase];
      s.mixer.update(0);
      const smooth = (v) => {
        v = Math.max(0, Math.min(1, v));
        return v * v * (3 - 2 * v);
      };
      const p = phase ? 1 : smooth((f - 0.24) / 0.76),
        slam = phase ? smooth(f / 0.21) : 0;
      const side =
        ((s.start +
          (s.end - s.start) * p +
          (phase ? Math.sin(f * 6) * 4 * (1 - f) : 0)) *
          Math.PI) /
        180;
      s.actor.updateMatrixWorld(true);
      const head = s.head.clone();
      if (s.focus) {
        s.focus.getWorldPosition(head);
        if (s.kind === 'bacteria') head.y += 0.09;
        if (s.kind === 'farmer') {
          const saw = s.actor.getObjectByName('FarmerFaceling_SawHousing');
          if (saw) head.lerp(saw.getWorldPosition(new T.Vector3()), 0.22);
        }
      }
      const aim = s.mid.clone().lerp(head, 0.19 + 0.81 * p);
      const distance =
        T.MathUtils.lerp(s.span * 1.64, s.eyeDistance * 1.77, p) -
        s.eyeDistance * 0.77 * slam;
      const y =
        s.kind === 'bonethief'
          ? 0.43
          : s.kind === 'bellwether'
          ? -0.9
          : s.height * (1 - 0.7 * p) +
            (s.style === 'dive' ? -0.16 * (1 - p) : 0);
      lens.position
        .copy(aim)
        .addScaledVector(
          new T.Vector3(Math.sin(side), y, Math.cos(side)).normalize(),
          distance
        );
      lens.up.set(0, 1, 0);
      lens.lookAt(aim);
      lens.rotateZ(
        ((s.roll * Math.PI) / 180) *
          ((1 - p) * -0.24 +
            (phase ? Math.sin(f * 9) * Math.exp(-4 * f) : p * 0.12))
      );
      key.intensity =
        (s.style === 'blackout' ? 0.72 : 1.65) + p * 1.13 + slam * 0.45;
      renderer.render(stage, lens);
      return renderer.domElement.toDataURL('image/jpeg', 0.94).split(',')[1];
    };
    return Object.keys(catchShots);
  });
  for (const kind of only.length ? only : kinds) {
    const [attack, scare] = await page.evaluate((k) => window.prepare(k), kind);
    const count = Math.ceil((attack + scare) * 30) + 1;
    for (let i = 0; i < count; i++) {
      const buffer = Buffer.from(
        await page.evaluate((t) => window.frame(t), i / 30),
        'base64'
      );
      writeFileSync(
        path.join(scratch, String(i).padStart(3, '0') + '.jpg'),
        buffer
      );
    }
    const ff = (args) => {
      const run = spawnSync(
        'ffmpeg',
        ['-hide_banner', '-loglevel', 'error', '-y', ...args],
        { stdio: 'inherit' }
      );
      if (run.status !== 0) throw Error('ffmpeg ' + kind);
    };
    ff([
      '-framerate',
      '30',
      '-i',
      path.join(scratch, '%03d.jpg'),
      '-frames:v',
      String(count),
      '-vf',
      'scale=in_range=full:out_range=tv,format=yuv420p',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '24',
      '-movflags',
      '+faststart',
      path.join(output, kind + '.mp4'),
    ]);
    const poster = Math.min(count - 1, Math.floor((attack + 0.12) * 30));
    const still = spawnSync(
      'cwebp',
      [
        '-quiet',
        '-q',
        '81',
        path.join(scratch, String(poster).padStart(3, '0') + '.jpg'),
        '-o',
        path.join(output, kind + '.webp'),
      ],
      { stdio: 'inherit' }
    );
    if (still.status !== 0) throw Error('cwebp ' + kind);
    console.log(kind, count, attack.toFixed(2), scare.toFixed(2));
  }
} finally {
  await browser.close();
  rmSync(scratch, { recursive: true, force: true });
}
