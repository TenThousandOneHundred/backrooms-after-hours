import type { GameObject } from './campaign';

export type Challenge =
  | { kind: 'wind' | 'align' | 'photo' | 'entity-photo' | 'throw' | 'coaster' }
  | { kind: 'haul'; destination: string; delivery: string };

export type ChallengeFrame = {
  dt: number;
  holding: boolean;
  range: number;
  aimed: boolean;
  entityInFrame: boolean;
  dropRange: number;
  moveCargo: () => void;
};
type Active = {
  obj: GameObject;
  spec: Challenge;
  elapsed: number;
  progress: number;
  miss: number;
  released: boolean;
};

const actionLabel = {
  wind: 'VALVE CONTROL',
  align: 'M.E.G. CALIBRATION',
  photo: 'VIEWFINDER / 35 MM',
  'entity-photo': 'VIEWFINDER / TRACKING',
  throw: 'SHOT POWER',
  coaster: 'RIDE CONTROL',
  haul: 'TRANSPORT',
};

export class FieldChallenge {
  private current?: Active;
  private display?: HTMLElement;
  private marker?: HTMLElement;
  private bar?: HTMLElement;
  private text?: HTMLElement;
  private cleanup?: () => void;
  get object() {
    return this.current?.obj;
  }
  get hauling() {
    return this.current?.spec.kind === 'haul';
  }
  start(obj: GameObject, cleanup: () => void) {
    const spec = obj.challenge;
    if (!spec) return;
    this.clear();
    this.current = { obj, spec, elapsed: 0, progress: 0, miss: 0, released: false };
    this.cleanup = cleanup;
    const root = document.createElement('section');
    root.className = 'field-task';
    root.dataset.challenge = spec.kind;
    root.dataset.ready = 'false';
    const heading = document.createElement('span');
    heading.className = 'field-task-label';
    heading.textContent = actionLabel[spec.kind];
    const title = document.createElement('strong');
    title.textContent = obj.name;
    const gauge = document.createElement('div');
    gauge.className = 'field-task-track';
    this.bar = document.createElement('b');
    this.marker = document.createElement('i');
    gauge.append(this.bar, this.marker);
    this.text = document.createElement('span');
    this.text.className = 'field-task-instruction';
    root.append(heading, title, gauge, this.text);
    document.body.append(root);
    this.display = root;
  }
  clear() {
    this.cleanup?.();
    this.cleanup = undefined;
    this.display?.remove();
    this.display = undefined;
    this.current = undefined;
  }
  press() {
    const task = this.current;
    if (!task || !task.released) return false;
    const kind = task.spec.kind;
    if (!['align', 'throw', 'photo', 'entity-photo', 'haul'].includes(kind)) return false;
    if (this.display?.dataset.ready === 'true') return true;
    task.miss = 0.55;
    if (kind === 'align' || kind === 'throw') task.elapsed = 0;
    return false;
  }
  tick(frame: ChallengeFrame): 'done' | 'cancelled' | undefined {
    const task = this.current;
    if (!task || !this.display || !this.text || !this.bar || !this.marker) return;
    const { spec } = task;
    const { dt } = frame;
    if (
      spec.kind !== 'haul' &&
      frame.range > (spec.kind === 'coaster' ? 18 : spec.kind === 'entity-photo' ? 12 : 4.8)
    )
      return 'cancelled';
    task.elapsed += dt;
    task.miss = Math.max(0, task.miss - dt);
    if (!frame.holding) task.released = true;
    let ready = false,
      instruction = '',
      amount = 0,
      indicator = 0;
    if (spec.kind === 'haul') {
      frame.moveCargo();
      ready = frame.dropRange < 3.5;
      instruction = ready
        ? 'Press E to deliver.'
        : 'Take it to ' + spec.delivery + ' • ' + Math.ceil(frame.dropRange) + ' m';
      amount = Math.min(1, 3.5 / Math.max(3.5, frame.dropRange));
    } else if (spec.kind === 'wind') {
      task.progress = Math.max(0, task.progress + (frame.holding && frame.aimed ? dt : -dt * 0.32));
      amount = task.progress / 1.6;
      instruction = 'Hold E and keep the wheel in view.';
      if (amount >= 1) return 'done';
    } else if (spec.kind === 'coaster') {
      amount = task.elapsed / 9;
      instruction =
        'Stand by the control platform. Keep your light on the King.  ' +
        Math.ceil(Math.max(0, 9 - task.elapsed)) +
        ' s';
      if (amount >= 1) return 'done';
    } else if (spec.kind === 'photo' || spec.kind === 'entity-photo') {
      const framed = spec.kind === 'entity-photo' ? frame.entityInFrame : frame.aimed;
      task.progress = Math.max(0, Math.min(0.48, task.progress + (framed ? dt : -dt * 2)));
      amount = task.progress / 0.48;
      ready = framed && amount >= 0.99;
      instruction = ready
        ? 'In focus • press E to release the shutter.'
        : spec.kind === 'entity-photo'
          ? 'Turn to frame the moving entity. Keep it in the viewfinder.'
          : 'Center the subject and hold the camera steady.';
    } else {
      indicator = 0.5 - 0.5 * Math.cos(task.elapsed * (spec.kind === 'throw' ? 2.7 : 3.2));
      ready = indicator >= 0.56 && indicator <= 0.83;
      instruction =
        task.miss > 0
          ? spec.kind === 'throw'
            ? 'The ball rims out. Try again.'
            : 'The relay slipped. Try again.'
          : spec.kind === 'throw'
            ? 'Press E in the marked power band to make the shot.'
            : 'Press E as the needle enters the marked band.';
    }
    this.display.dataset.ready = String(ready);
    this.display.dataset.needle = String(spec.kind === 'throw' || spec.kind === 'align');
    this.bar.style.transform = 'scaleX(' + Math.min(1, amount) + ')';
    this.marker.style.left = indicator * 100 + '%';
    if (this.text.textContent !== instruction) this.text.textContent = instruction;
  }
}
