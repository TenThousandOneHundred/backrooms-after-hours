// Browser regression probe. With `npm run dev` serving a fresh browser profile,
// run `await (await import('/tests/player-route.mjs')).runRoute()` in its console.
// All progression uses DOM movement, interaction, keypad, retry and ending controls.
// Pass {lobbyOnly:true} in a separate fresh profile to verify stalking, hiding,
// the Bacteria's decoded attack plate and death-checkpoint recovery.
// A fixed-step animation clock accelerates the run. GPU frames are sampled per
// scene; this is a control/playability test, separate from visual frame-rate QA.
export async function runRoute({ lobbyOnly = false } = {}) {
  const { Game } = await import('/src/game.ts');
  const { TILE } = await import('/src/world.ts');
  const stages =
    'lobby pitwalk lower garage garagekeys darkdeck hub blackgarage pipes station office hotel hotelrooms pipesreturn fun pool run library village castle dark ocean depths cave projection courtyard1 suburbs outpost suburbs field arcade residential redrooms residential snack hotelchase courtyard2 deepool stagnant funplus school slides slides2 slides3 bunker blackgarage stair bunker dark pink bunker lowstation plastic gym overgrowth grass bunker arcade'.split(
      ' ',
    );
  const endByStage = { slides3: 'wrong', stair: 'suburbs', pink: 'pink', grass: 'city', arcade: 'final' };
  const results = {
    stages: [],
    endings: [],
    challenges: {},
    checks: [],
    lethalAttacks: 0,
    nearMisses: 0,
    capturedAttacks: 0,
    haunts: 0,
    peakDread: 0,
    interactions: 0,
    steps: 0,
    retries: 0,
    seconds: 0,
  };
  const originalStart = Game.prototype.start,
    originalRAF = window.requestAnimationFrame.bind(window);
  const originalCancel = window.cancelAnimationFrame.bind(window);
  const originalRandom = Math.random;
  let seed = 0x1bcd7;
  Math.random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const restore = [];
  let tick,
    game,
    now = performance.now(),
    drawing = '',
    provoke = false;
  window.requestAnimationFrame = (fn) => {
    tick = fn;
    return 19;
  };
  window.cancelAnimationFrame = () => {};
  Game.prototype.start = function (...args) {
    game = this;
    const callbacks = this.callbacks;
    if (!callbacks.auditInstalled) {
      callbacks.auditInstalled = true;
      const scare = callbacks.scare,
        haunt = callbacks.haunt,
        dread = callbacks.dread;
      restore.push(() => { Object.assign(callbacks, { scare, haunt, dread }); delete callbacks.auditInstalled; });
      callbacks.scare = (event) => {
        if (event.lethal) results.lethalAttacks++;
        else results.nearMisses++;
        if (event.frame?.startsWith('data:image/jpeg;base64,') && event.frame.length > 2000)
          results.capturedAttacks++;
        scare?.(event);
      };
      callbacks.haunt = (event) => {
        results.haunts++;
        haunt?.(event);
      };
      callbacks.dread = (value) => {
        results.peakDread = Math.max(results.peakDread, value);
        dread?.(value);
      };
    }
    const draw = this.renderer.render.bind(this.renderer);
    const originalRender = this.renderer.render;
    restore.push(() => { this.renderer.render = originalRender; });
    this.renderer.render = (...args) => {
      if (drawing !== this.stage?.id || args[1] !== this.camera) {
        drawing = this.stage?.id;
        draw(...args);
      }
    };
    return originalStart.apply(this, args);
  };
  const click = (id) => {
    const el = document.getElementById(id);
    if (!el) throw Error('Missing UI #' + id);
    el.click();
  };
  const key = (type, code) =>
    document.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
  const press = (code) => {
    key('keydown', code);
    key('keyup', code);
  };
  const advance = (seconds = 0.11) => {
    now = Math.max(now, performance.now()) + seconds * 1000;
    if (!tick) throw Error('No frame');
    tick(now);
    results.steps++;
    results.seconds += seconds;
  };
  const angleDelta = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const look = (yaw, pitch = 0) => {
    const scale = 0.00212 * game.settings.sensitivity;
    const dx = Math.round(angleDelta(yaw - game.yaw) / scale),
      dy = Math.round((game.pitch - pitch) / scale);
    const canvas = document.getElementById('world');
    if (!game.pointerOwned && !game.dragging)
      canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 0, clientY: 0 }));
    document.dispatchEvent(
      new MouseEvent('mousemove', {
        movementX: dx,
        movementY: dy,
        clientX: game.dragX + dx,
        clientY: game.dragY + dy,
        bubbles: true,
      }),
    );
  };
  const dirs = [
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1],
  ];
  function route(x, z, gx, gz, allowPit = false) {
    const map = game.stage.map,
      width = map[0].length,
      encode = (tx, tz) => tz * width + tx;
    const start = encode(x, z),
      goal = encode(gx, gz),
      parent = new Map(),
      cost = new Map([[start, 0]]),
      queue = [[start, 0]];
    while (queue.length) {
      queue.sort((a, b) => b[1] - a[1]);
      const [current, c] = queue.pop();
      if (c !== cost.get(current)) continue;
      if (current === goal) break;
      const cx = current % width,
        cz = Math.floor(current / width);
      for (const [dx, dz] of dirs) {
        const nx = cx + dx,
          nz = cz + dz,
          node = encode(nx, nz),
          tile = map[nz]?.[nx];
        if (!tile || tile === '#' || (tile === 'X' && !(node === goal && allowPit))) continue;
        const enemy = game.encounter;
        let risk = 0;
        if (enemy && game.grace < 1.5) {
          const distance = Math.hypot(nx - enemy.x, nz - enemy.z);
          if (distance < 2.25) risk = (2.25 - distance) * 4;
        }
        const n = c + 1 + (tile === '!' ? 3 : 0) + risk;
        if (n >= (cost.get(node) ?? Infinity)) continue;
        cost.set(node, n);
        parent.set(node, current);
        queue.push([node, n]);
      }
    }
    if (!cost.has(goal)) return null;
    const path = [];
    for (let n = goal; n !== start; n = parent.get(n)) path.push([n % width, Math.floor(n / width)]);
    return path.reverse();
  }
  const keysDown = new Set();
  const hold = (code, on) => {
    if (on && !keysDown.has(code)) {
      key('keydown', code);
      keysDown.add(code);
    } else if (!on && keysDown.has(code)) {
      key('keyup', code);
      keysDown.delete(code);
    }
  };
  const release = () => {
    for (const code of [...keysDown]) hold(code, false);
  };
  function finishTask(o) {
    const spec = o.challenge;
    if (!spec || !document.querySelector('.field-task')) return;
    advance(0.025);
    if (spec.kind === 'haul') {
      const drop = game.stage.objects.find(
        (d) => d.gives?.includes(spec.destination) || d.id === spec.destination,
      );
      if (!drop) throw Error(`Missing destination for ${o.id}`);
      go(drop, true);
      release();
      if (game.challenge.hauling && !results.checks.includes('haul pause')) {
        const cargo = game.world.objects.get(o.id);
        const position = cargo.position.clone();
        press('Tab');
        if (!game.challenge.hauling || !cargo.position.equals(position)) throw Error('Inventory dropped cargo');
        press('Tab');
        if (!game.challenge.hauling || !cargo.position.equals(position)) throw Error('Resume dropped cargo');
        results.checks.push('haul pause');
      }
    }
    if (spec.kind === 'wind') hold('KeyE', true);
    if (spec.kind === 'coaster' && !game.state.flashlight) press('KeyF');
    for (let n = 0; n < 1250 && game.mode === 'playing' && document.querySelector('.field-task'); n++) {
      const form = document.querySelector('.field-task');
      if (spec.kind === 'entity-photo' || spec.kind === 'coaster') {
        const e = game.encounter;
        if (e) look(Math.atan2(e.x * TILE - game.x, game.z - e.z * TILE));
      }
      if (spec.kind === 'entity-photo' && form.dataset.ready === 'true' && !results.checks.includes('empty frame')) {
        look(game.yaw, 1.36);
        press('KeyE');
        if (!game.challenge.object || form.dataset.ready === 'true') throw Error('Empty photo accepted');
        results.checks.push('empty frame');
      }
      if (form.dataset.ready === 'true') press('KeyE');
      advance(0.09);
    }
    hold('KeyE', false);
    if (game.mode === 'playing' && document.querySelector('.field-task'))
      throw Error(`Could not latch ${o.id} (${spec.kind})`);
    if (game.mode === 'playing') results.challenges[spec.kind] = (results.challenges[spec.kind] ?? 0) + 1;
  }
  function use(o) {
    const v = game.aimOffsets.get(o.id) ?? { x: o.x * TILE, y: 1, z: o.z * TILE };
    const dx = v.x - game.x,
      dz = v.z - game.z,
      dy = v.y - game.camera.position.y;
    look(Math.atan2(dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
    advance(0.02);
    if (game.findTarget()?.id !== o.id) return false;
    release();
    press('KeyE');
    if (game.mode === 'code') {
      document.getElementById('code-input').value = o.code;
      document.getElementById('keypad').requestSubmit();
    }
    finishTask(o);
    results.interactions++;
    return true;
  }
  function go(o, deliver = false) {
    const start = game.stage.id;
    let path = null,
      where = '',
      stuck = 0,
      lastX = game.x,
      lastZ = game.z;
    for (let frame = 0; frame < 1800; frame++) {
      if (game.mode === 'death') {
        release();
        if (provoke) return false;
        results.retries++;
        if (results.retries < 20)
          console.info(
            'ROUTE dodge failed',
            o.id,
            Math.round(game.x / TILE),
            Math.round(game.z / TILE),
            'home',
            game.state.checkpoint,
          );
        click('retry');
        return false;
      }
      if (game.mode === 'pause') {
        click('resume');
        keysDown.clear();
      }
      if (game.stage.id !== start || (game.mode === 'ending' && o.kind === 'ending')) return true;
      if (game.mode !== 'playing') throw Error(`Unexpected screen ${game.mode} at ${start}`);
      const d = Math.hypot(o.x * TILE - game.x, o.z * TILE - game.z);
      if (deliver && d < TILE * 0.96) {
        release();
        return true;
      }
      if (!deliver && o.model !== 'pit' && d < TILE * 0.98 && use(o)) return true;
      const x = Math.round(game.x / TILE),
        z = Math.round(game.z / TILE),
        cell = `${x},${z}`;
      if (where !== cell || !path?.length || stuck > 8) {
        path = route(x, z, o.x, o.z, o.model === 'pit');
        where = cell;
      }
      if (!path) throw Error(`Unreachable ${o.id} from ${cell}`);
      const [nx, nz] = path[0] ?? [o.x, o.z];
      let tx = nx * TILE,
        tz = nz * TILE;
      // Centre the player on the cross-axis before rounding a ninety-degree corner.
      if (nx !== x && Math.abs(game.z - z * TILE) > 0.35) {
        tx = game.x;
        tz = z * TILE;
      } else if (nz !== z && Math.abs(game.x - x * TILE) > 0.35) {
        tx = x * TILE;
        tz = game.z;
      }
      const dx = tx - game.x,
        dz = tz - game.z;
      const crouch = ['wretch', 'crawler', 'camera'].includes(game.stage.threat?.kind);
      let heading = Math.atan2(dx, -dz);
      if (game.encounter && game.grace <= 0 && !crouch) {
        const ex = game.encounter.x * TILE - game.x,
          ez = game.encounter.z * TILE - game.z,
          dist = Math.hypot(ex, ez);
        const approach = (Math.sin(heading) * ex - Math.cos(heading) * ez) / Math.max(0.01, dist);
        if (dist < 3.7 && approach > 0.35) {
          const choices = [-0.95, 0.95, 0]
            .map((turn) => {
              const a = heading + turn,
                sx = Math.sin(a),
                sz = -Math.cos(a);
              const valid = game.canStand(game.x + sx * 0.85, game.z + sz * 0.85);
              const clearance = Math.hypot(sx * 2.7 - ex, sz * 2.7 - ez);
              return { a, score: valid ? clearance - 0.32 * Math.abs(turn) : -100 };
            })
            .sort((a, b) => b.score - a.score);
          if (choices[0].score > 0) heading = choices[0].a;
        }
      }
      const gaze =
        game.encounter &&
        ['watcher', 'hound', 'king', 'kitty', 'animation', 'membri'].includes(game.stage.threat?.kind);
      let offset = 0;
      if (gaze) {
        const e = game.encounter;
        const toward = Math.atan2(e.x * TILE - game.x, game.z - e.z * TILE);
        offset = Math.round(angleDelta(heading - toward) / (Math.PI / 4));
        if (!game.state.flashlight && game.has('torch')) press('KeyF');
      }
      look(heading - (offset * Math.PI) / 4);
      hold('KeyW', Math.cos((offset * Math.PI) / 4) > 0.35);
      hold('KeyS', Math.cos((offset * Math.PI) / 4) < -0.35);
      hold('KeyD', Math.sin((offset * Math.PI) / 4) > 0.35);
      hold('KeyA', Math.sin((offset * Math.PI) / 4) < -0.35);
      hold('KeyC', crouch);
      hold('ShiftLeft', !crouch);
      const enemy = game.encounter;
      if (enemy?.danger > 0.65 && game.state.sanity < 50) press('Digit1');
      advance(Math.max(0.035, Math.min(0.13, Math.hypot(dx, dz) / (crouch ? 1.38 : 5.35))));
      if (Math.hypot(lastX - game.x, lastZ - game.z) < 0.035) stuck++;
      else stuck = 0;
      if (stuck > 70)
        throw Error(
          `Blocked walking to ${o.id} at ${game.x},${game.z} next ${nx},${nz}; yaw ${game.yaw} aim ${Math.atan2(dx, -dz)} input ${[...game.keys]} mode ${game.mode} ground ${game.grounded}`,
        );
      lastX = game.x;
      lastZ = game.z;
    }
    throw Error(`Navigation timed out before ${o.id} at ${game.x / TILE},${game.z / TILE}`);
  }
  try {
    if (localStorage.getItem('backrooms-after-hours.campaign.v1'))
      throw Error('Use a fresh browser profile to avoid replacing an existing run.');
    click('sound');
    click('enter');
    for (let i = 0; !game && i < 300; i++) await new Promise((resolve) => setTimeout(resolve, 20));
    if (!game) throw Error('Game did not start');
    advance(0.02);
    if (lobbyOnly) {
      const lobby = game.stage;
      const nearest = (objects) =>
        objects.sort(
          (a, b) =>
            Math.hypot(game.x / TILE - a.x, game.z / TILE - a.z) -
            Math.hypot(game.x / TILE - b.x, game.z / TILE - b.z),
        )[0];
      const rail = nearest(
        lobby.objects.filter((o) => o.kind === 'pickup' && o.gives?.some((f) => /^rail/.test(f))),
      );
      go(rail);
      advance(0.11);
      if (game.lobbyWarning < 0) throw Error('Pickup did not awaken hunter');
      const shelter = nearest(lobby.objects.filter((o) => o.kind === 'hide'));
      go(shelter);
      if (!game.hidden) throw Error('Locker did not conceal player');
      for (let i = 0; i < 140; i++) advance(0.12);
      if (game.mode !== 'playing' || !game.world.entity.visible || game.encounter.danger > 0)
        throw Error('Concealment failed during an active hunt');
      press('KeyE');
      release();
      if (game.hidden) throw Error('Failed to emerge from shelter');
      let closeDodge = false;
      // Draw the hunter with footsteps at the locker, then enter before it makes contact.
      for (let i = 0; i < 1900 && game.mode === 'playing'; i++) {
        const e = game.encounter,
          d = Math.hypot(e.x - game.x / TILE, e.z - game.z / TILE);
        if (d < 3.8 && e.danger > 0.52) {
          const v = game.aimOffsets.get(shelter.id);
          look(
            Math.atan2(v.x - game.x, game.z - v.z),
            Math.atan2(v.y - game.camera.position.y, Math.hypot(v.x - game.x, v.z - game.z)),
          );
          advance(0.02);
          press('KeyE');
          if (game.hidden) {
            for (let n = 0; n < 100; n++) advance(0.12);
            closeDodge = game.mode === 'playing' && game.encounter.danger === 0;
            press('KeyE');
            break;
          }
        }
        hold('KeyA', i % 4 < 2);
        hold('KeyD', i % 4 >= 2);
        hold('ShiftLeft', true);
        advance(0.065);
      }
      release();
      if (!closeDodge) throw Error('No close-range hiding escape was observed');
      provoke = true;
      for (let attempt = 0; attempt < 24 && game.mode === 'playing'; attempt++) {
        const e = game.encounter;
        go({ id: 'approach hunter', x: Math.round(e.x), z: Math.round(e.z) }, true);
        release();
        for (let n = 0; n < 75 && game.mode === 'playing'; n++) advance(0.12);
      }
      if (game.mode !== 'death') throw Error('The lobby hunter did not catch the player');
      const impact = document.querySelector('#capture-impact.striking[data-lethal="true"]');
      if (!impact || document.querySelector('#dialog-title')?.textContent !== 'You died')
        throw Error('Attack did not produce a lethal jumpscare and death UI');
      const background = getComputedStyle(impact.querySelector('.attack-image')).backgroundImage;
      const src = background.match(/url\(["']?([^"')]+)/)?.[1];
      if (!src || !src.endsWith('encounters/wire.webp')) throw Error('Missing Bacteria plate: ' + background);
      const plate = new Image();
      plate.src = src;
      await plate.decode();
      if (plate.naturalWidth < 200) throw Error('Invalid attack image');
      const checkpoint = game.state.checkpoint;
      await new Promise((resolve) => setTimeout(resolve, 1150));
      click('retry');
      advance(0.03);
      if (
        game.mode !== 'playing' ||
        Math.hypot(game.x - checkpoint.x, game.z - checkpoint.z) > 0.05 ||
        !game.has(rail.gives[0])
      )
        throw Error('Death retry lost checkpoint or pickup');
      return {
        ending: 'survived retry',
        hunter: 'bacteria',
        closeDodge,
        deathTitle: 'You died',
        plate: src,
        platePixels: [plate.naturalWidth, plate.naturalHeight],
        savedPickup: rail.gives[0],
        peakDread: results.peakDread,
        haunts: results.haunts,
      };
    }
    for (let index = 0; index < stages.length; index++) {
      const id = stages[index],
        next = stages[index + 1],
        stage = game.stage;
      if (stage.id !== id) throw Error(`Expected ${id}; loaded ${stage.id}`);
      if (id === 'dark' && !results.checks.includes('LiDAR')) {
        press('KeyF');
      }
      results.stages.push(id);
      console.info(`ROUTE ${index + 1}/${stages.length} ${id} (${results.retries} retries)`);
      let failures = 0;
      while (game.stage.id === id && game.mode !== 'ending') {
        if (++failures > 110)
          throw Error(
            `Repeated failure at ${id} (${results.retries} retries; last input ${game.target?.id}; flags ${game.state.flags.slice(-6)})`,
          );
        const candidates = stage.objects.filter(
          (o) => ['pickup', 'code', 'switch'].includes(o.kind) && game.eligible(o) && !game.done(o),
        );
        candidates.sort(
          (a, b) =>
            Math.hypot(a.x * TILE - game.x, a.z * TILE - game.z) -
            Math.hypot(b.x * TILE - game.x, b.z * TILE - game.z),
        );
        const finish = stage.objects.find(
          (o) => o.kind === 'ending' && o.ending === endByStage[id] && game.eligible(o),
        );
        const exit = stage.objects.find((o) => o.kind === 'exit' && o.target === next && game.eligible(o));
        const target = candidates[0] ?? finish ?? exit;
        if (!target) throw Error(`No unlocked progression from ${id} to ${next}`);
        if (id === 'plastic' && target.kind === 'exit') {
          // Follow the north passage around the shark's spawn in the south channel.
          if (!go({ x: 18, z: 4 }, true) || !go({ x: 23, z: 3 }, true)) continue;
        }
        go(target);
        if (id === 'lobby' && target.kind === 'pickup' && !results.checks.includes('checkpoint')) {
          release();
          press('Escape');
          const x = game.x,
            z = game.z,
            flags = [...game.state.flags];
          click('title');
          click('enter');
          advance(0.02);
          if (
            game.stage.id !== 'lobby' ||
            Math.hypot(game.x - x, game.z - z) > 0.05 ||
            !flags.every((f) => game.state.flags.includes(f))
          )
            throw Error('Continue lost position or puzzle progress');
          results.checks.push('checkpoint');
        }
        if (id === 'dark' && game.has('lidar') && !results.checks.includes('LiDAR')) {
          press('KeyF');
          advance(0.02);
          if (!game.scan) throw Error('LiDAR failed to illuminate geometry');
          results.checks.push('LiDAR');
        }
        if (results.retries > 110) throw Error(`Too many retries on ${target.id}`);
      }
      if (game.mode === 'ending') {
        const ending = game.state.pending.ending;
        results.endings.push(ending);
        click('ending-continue');
      }
      release();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (results.endings.join(',') !== 'wrong,suburbs,pink,city,final')
      throw Error('Incomplete endings: ' + results.endings.join(','));
    if (
      !results.lethalAttacks ||
      !results.capturedAttacks ||
      !results.nearMisses ||
      results.peakDread < 0.55 ||
      !results.haunts
    )
      throw Error('Incomplete horror coverage: ' + JSON.stringify(results));
    return { ...results, seconds: Math.round(results.seconds) };
  } finally {
    release();
    if (game?.mode === 'playing') press('Escape');
    Game.prototype.start = originalStart;
    window.requestAnimationFrame = originalRAF;
    window.cancelAnimationFrame = originalCancel;
    Math.random = originalRandom;
    for (const undo of restore.reverse()) undo();
    if (game && !game.disposed) { game.frameId = 0; game.run(); }
  }
}
