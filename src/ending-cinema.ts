import * as T from 'three';
import { makeModel, ModelKit } from './world-models';

type Point = [number, number, number];
const smooth = (n: number) => {
  n = Math.max(0, Math.min(1, n));
  return n * n * (3 - 2 * n);
};
const palettes = {
  wrong: ['#293a37', '#8b8266'],
  suburbs: ['#212d49', '#bc8879'],
  city: ['#364852', '#bebca9'],
  pink: ['#302439', '#9e647c'],
  final: ['#292f43', '#887482'],
} as const;

/** Small, original epilogues. Each owns its geometry and never mutates campaign state. */
export class EndingCinema {
  readonly scene = new T.Scene();
  readonly camera = new T.PerspectiveCamera(54, 1, 0.05, 230);
  private kit = new ModelKit();
  private architecture = new T.Group();
  private movable = new T.Group();
  private start: Point = [0, 1.65, 5];
  private finish: Point = [0, 1.65, 2];
  private look: Point = [0, 1.65, -6];
  private animateSet: (time: number) => void = () => {};
  private time = 0;
  private fixed = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private assets: (T.Texture | T.Material | T.BufferGeometry | T.InstancedMesh)[] = [];
  constructor(private id: string) {
    this.scene.add(this.architecture, this.movable);
    const [top, horizon] = palettes[id as keyof typeof palettes] ?? palettes.wrong;
    this.sky(top, horizon);
    this.scene.fog = new T.FogExp2(horizon, id === 'city' ? 0.015 : id === 'suburbs' ? 0.025 : 0.038);
    this.scene.add(new T.HemisphereLight(id === 'pink' ? '#ffd7df' : '#e3e5df', '#50463d', 1.6));
    const key = new T.DirectionalLight(id === 'city' ? '#ffe9b0' : '#ffd5a0', 1.6);
    key.position.set(-9, 13, -10);
    this.scene.add(key);
    if (id === 'suburbs') this.suburbs();
    else if (id === 'city') this.city();
    else if (id === 'pink') this.pinkHouse();
    else if (id === 'final') this.arcade();
    else this.wrongDoor();
    this.batch();
    this.update(0);
  }
  private box(
    c: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    group: T.Object3D = this.architecture,
    glow = false,
  ) {
    return this.kit.cube(group, c, x, y, z, w, h, d, !glow);
  }
  private rod(c: string, a: Point, b: Point, r: number, group: T.Object3D = this.architecture) {
    return this.kit.rod(group, c, a, b, r);
  }
  private orb(
    c: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    group: T.Object3D = this.architecture,
    glow = false,
  ) {
    return this.kit.ball(group, c, x, y, z, w, h, d, !glow);
  }
  private model(kind: string, x: number, z: number, angle = 0, scale = 1, label?: string) {
    const m = makeModel(this.kit, { model: kind, label });
    m.position.set(x, 0, z);
    m.rotation.y = angle;
    m.scale.setScalar(scale);
    this.architecture.add(m);
    return m;
  }
  private sign(text: string, x: number, y: number, z: number, w: number, h: number, bg: string, fg: string) {
    this.kit.label(this.architecture, text, x, y, z, w, h, bg, fg);
  }
  private sky(top: string, horizon: string) {
    const g = new T.SphereGeometry(195, 32, 18);
    const m = new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: { top: { value: new T.Color(top) }, horizon: { value: new T.Color(horizon) } },
      vertexShader:
        'varying float altitude;void main(){altitude=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'uniform vec3 top;uniform vec3 horizon;varying float altitude;void main(){gl_FragColor=vec4(mix(horizon,top,smoothstep(-0.035,.66,altitude)),1.);\n#include <colorspace_fragment>\n}',
    });
    const dome = new T.Mesh(g, m);
    dome.renderOrder = -1;
    this.scene.add(dome);
    this.assets.push(g, m);
  }
  private road(width = 9, length = 148) {
    this.box('#44484a', 0, -0.09, -42, width, 0.18, length);
    for (const side of [-1, 1]) {
      this.box('#9d9c90', side * (width / 2 + 0.72), 0.02, -42, 1.48, 0.17, length);
      this.box('#c0b8a3', side * (width / 2 + 0.06), 0.09, -42, 0.14, 0.16, length);
    }
    for (let z = 14; z > -112; z -= 5.5) this.box('#bbaa74', 0, 0.017, z, 0.1, 0.014, 2.8);
  }
  private roof(x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
    const group = new T.Group();
    group.position.set(x, y, z);
    this.architecture.add(group);
    const half = w / 2,
      shape = new T.Shape();
    shape.moveTo(-half, 0);
    shape.lineTo(half, 0);
    shape.lineTo(0, h);
    shape.closePath();
    const g = new T.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    this.assets.push(g);
    const m = new T.Mesh(g, this.kit.get(color));
    m.position.z = -d / 2;
    group.add(m);
  }
  private cottage(x: number, z: number, width: number, color: string, index: number) {
    const depth = 4.4,
      height = 2.8;
    this.box(color, x, height / 2, z, width, height, depth);
    this.roof(x, height, z, width + 0.55, 1.43, depth + 0.55, '#484c4c');
    this.box('#756853', x + width * 0.27, 3.15, z - 0.65, 0.38, 1.25, 0.48);
    for (let y = 0.22; y < 2.75; y += 0.26)
      this.box('#999588', x, y, z + depth / 2 + 0.006, width, 0.022, 0.023);
    const doorX = x + (index % 2 ? -0.37 : 0.37);
    this.box('#d2c4aa', doorX, 1.0, z + 2.22, 0.97, 2.0, 0.08);
    this.box('#5a5c57', doorX, 0.98, z + 2.27, 0.81, 1.91, 0.04);
    this.box('#cfb186', doorX, 1.41, z + 2.3, 0.45, 0.51, 0.019);
    this.box('#a49c8d', doorX, 0.11, z + 2.48, 1.58, 0.2, 0.72);
    for (const dx of [-width * 0.33, width * 0.33]) {
      const light = index % 3 === 1 ? '#c7bb94' : '#f7c97b';
      this.box('#d7cdb6', x + dx, 1.69, z + 2.23, 1.02, 0.88, 0.09);
      this.box(light, x + dx, 1.69, z + 2.29, 0.84, 0.71, 0.024, this.architecture, true);
      this.box('#7b796a', x + dx, 1.69, z + 2.31, 0.056, 0.72, 0.025);
      this.box('#7b796a', x + dx, 1.69, z + 2.31, 0.85, 0.045, 0.025);
    }
    this.orb('#ffe7ac', doorX + 0.62, 2.14, z + 2.32, 0.14, 0.21, 0.12, this.architecture, true);
  }
  private pole(x: number, z: number) {
    this.rod('#63584d', [x, 0, z], [x, 6.2, z], 0.092);
    this.box('#756652', x, 5.76, z, 1.28, 0.1, 0.1);
    for (const dx of [-0.46, 0.46]) {
      this.orb('#9aab9d', x + dx, 5.86, z, 0.12, 0.14, 0.12);
      this.rod('#525754', [x + dx, 5.87, z], [x + dx, 5.13, z - 5], 0.018);
      this.rod('#525754', [x + dx, 5.13, z - 5], [x + dx, 5.87, z - 10], 0.018);
    }
  }
  private suburbs() {
    this.road(7.5);
    this.box('#626e5c', 0, -0.2, -38, 150, 0.18, 155);
    const colors = ['#a0a394', '#a9a092', '#919d9b', '#a39885'];
    for (let i = 0; i < 9; i++)
      for (const side of [-1, 1]) {
        const z = 4 - 9 * i + (side < 0 ? 3 : 0);
        this.cottage(
          side * (10 + (i % 2) * 0.7),
          z,
          4.8 + (i % 3) * 0.3,
          colors[(i + (side > 0 ? 1 : 0)) % 4],
          i,
        );
        const treeX = side * 16,
          treeZ = z - 2;
        this.rod('#514f43', [treeX, 0, treeZ], [treeX, 3.7, treeZ], 0.16);
        this.orb('#4b6255', treeX, 4.2, treeZ, 3.9, 4.4, 3.4);
        this.box('#565b58', side * 4.9, 0.97, z + 2, 0.4, 0.27, 0.35);
        this.box('#5e584d', side * 4.9, 0.46, z + 2, 0.07, 0.82, 0.07);
        if (side > 0) this.pole(5.63, 8 - i * 10);
      }
    this.orb('#e1caad', -26, 17, -102, 6, 6, 6, this.architecture, true);
    this.start = [-1.4, 1.47, 10.5];
    this.finish = [-0.3, 1.74, 6.1];
    this.look = [1.6, 2.6, -19];
  }
  private facade(x: number, z: number, w: number, h: number, d: number, seed: number) {
    const stone = ['#989787', '#888f8f', '#9e998b', '#7c8583'][seed % 4];
    this.box(stone, x, h / 2, z, w, h, d);
    this.box('#707a7b', x, h + 0.14, z, w + 0.32, 0.29, d + 0.32);
    const rows = Math.floor(h / 1.67),
      cols = Math.max(2, Math.floor(w / 0.95)),
      face = z + d / 2 + 0.016;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const xx = x - w * 0.45 + ((i + 0.5) * w * 0.9) / cols,
          yy = 1.1 + j * 1.67,
          lamp = (i * 11 + j * 3 + seed) % 19 === 3;
        this.box(
          lamp ? '#cabb8b' : '#5e7377',
          xx,
          yy,
          face,
          (w * 0.62) / cols,
          0.85,
          0.045,
          this.architecture,
          lamp,
        );
      }
    for (let j = 1; j < rows; j += 3) this.box('#7e8581', x, j * 1.67 + 0.16, face, w, 0.14, 0.12);
  }
  private elevatorFrame() {
    for (const x of [-1.87, 1.87]) {
      this.box('#5d6766', x, 1.54, 0.56, 0.49, 3.08, 0.78);
      this.box('#b2b5a4', x * 0.9, 1.52, 0.95, 0.1, 3, 0.08);
    }
    this.box('#5e6967', 0, 3.12, 0.55, 4.12, 0.3, 0.82);
    this.box('#a7a996', 0, 0.025, 1.95, 4, 0.05, 3.7);
    this.box('#525b59', 0, 0.07, 0.5, 3.8, 0.09, 0.25);
    this.box('#353e3d', 1.75, 1.48, 1.02, 0.23, 0.54, 0.06);
    this.orb('#e8ca7e', 1.75, 1.54, 1.07, 0.1, 0.09, 0.035, this.architecture, true);
    this.sign('11', 0, 2.9, 1.01, 0.45, 0.2, '#303d37', '#eae0a2');
  }
  private city() {
    this.road(10);
    this.box('#9a9988', 0, -0.19, -45, 175, 0.18, 185);
    for (let i = 0; i < 7; i++)
      for (const side of [-1, 1]) {
        const h = 8 + ((i * 7 + (side > 0 ? 9 : 2)) % 14);
        this.facade(side * (12.6 + (i % 2)), -9 - i * 7.0, 8.7, h, 6.1, i + (side > 0 ? 1 : 0));
        this.facade(side * (24 + i * 0.7), -22 - i * 8, 9.5, h + 9, 6.8, i + 3);
      }
    for (let i = 0; i < 8; i++) this.box('#d7d2b7', -4.1 + i * 1.16, 0.027, -10, 0.57, 0.018, 2.4);
    for (const side of [-1, 1]) {
      this.rod('#5b6561', [side * 5.85, 0, -13], [side * 5.85, 5.35, -13], 0.085);
      this.rod('#72796d', [side * 5.85, 5.3, -13], [side * 1.72, 5.3, -13], 0.072);
      this.box('#3f4940', side * 1.85, 4.85, -13, 0.36, 0.86, 0.36);
      for (let j = 0; j < 3; j++)
        this.orb(
          j === 0 ? '#6be792' : '#4c5146',
          side * 1.85,
          4.59 + j * 0.27,
          -12.8,
          0.2,
          0.2,
          0.045,
          this.architecture,
          j === 0,
        );
    }
    this.elevatorFrame();
    this.start = [0.0, 1.6, 3.8];
    this.finish = [0.15, 1.65, 1.62];
    this.look = [1.1, 2.95, -18];
  }
  private room(w: number, d: number, h: number, wall: string, floor: string, ceiling: string) {
    this.box(floor, 0, -0.1, -d * 0.32, w, 0.2, d);
    this.box(ceiling, 0, h + 0.08, -d * 0.32, w, 0.16, d);
    for (const s of [-1, 1]) this.box(wall, (s * w) / 2, h / 2, -d * 0.32, 0.18, h, d);
  }
  private lamp(x: number, z: number, length: number, color: string) {
    this.box('#4e504a', x, 3.39, z, 0.34, 0.12, length);
    this.box(color, x, 3.31, z, 0.24, 0.045, length - 0.09, this.architecture, true);
  }
  private swingDoor(x: number, z: number, color: string, glass: boolean) {
    const hinge = new T.Group();
    this.movable.add(hinge);
    hinge.position.set(x, 0, z);
    const height = 2.48,
      width = 1.2;
    if (glass) {
      this.box(color, width / 2, 0.24, 0, width, 0.48, 0.1, hinge);
      this.box(color, width / 2, 2.38, 0, width, 0.19, 0.1, hinge);
      for (const dx of [0.04, width - 0.04]) this.box(color, dx, 1.27, 0, 0.08, 2.35, 0.1, hinge);
      this.box(color, width / 2, 1.03, 0, width, 0.09, 0.11, hinge);
    } else this.box(color, width / 2, height / 2, 0, width, height, 0.1, hinge);
    this.box('#c2bca0', width - 0.18, 1.04, 0.11, 0.25, 0.05, 0.11, hinge);
    return hinge;
  }
  private wrongDoor() {
    this.room(6.0, 19, 3.45, '#788278', '#655e50', '#8e9280');
    this.lamp(0, -3, 1.4, '#d7d7b7');
    for (const side of [-1, 1]) {
      this.box('#545d54', side * 2.93, 0.12, -5, 0.1, 0.24, 16);
      for (let j = 0; j < 3; j++) {
        const z = 1 - j * 4.5;
        this.box('#4c5753', side * 2.88, 1.19, z, 0.12, 2.38, 1.12);
        this.box('#8d8f77', side * 2.77, 1.03, z + 0.4, 0.1, 0.055, 0.19);
      }
    }
    this.box('#949982', -1.49, 1.7, -7, 3.14, 3.4, 0.18);
    this.box('#949982', 2.22, 1.7, -7, 1.61, 3.4, 0.18);
    this.box('#949982', 0.72, 3.0, -7, 1.49, 0.86, 0.18);
    this.sign('STAFF  ONLY', 0.76, 2.71, -6.87, 0.71, 0.17, '#37463d', '#dfd3ad');
    const door = this.swingDoor(0.1, -6.88, '#798673', false);
    this.box('#3d4b46', 0.83, 1.5, -10.45, 4.1, 3, 0.18);
    this.model('bed', 1.22, -9.1, -0.78, 0.85);
    this.box('#cfddaa', 0.93, 2.72, -9.92, 1.3, 0.12, 0.16, this.architecture, true);
    const shadow = new T.Group();
    this.movable.add(shadow);
    shadow.position.set(0.7, 0, -9.23);
    this.orb('#222d2b', 0, 1.64, 0, 0.25, 0.31, 0.24, shadow);
    this.box('#23302d', 0, 1.13, 0, 0.34, 0.76, 0.19, shadow);
    this.animateSet = (t) => {
      door.rotation.y = -1.42 * smooth((t - 1) / 4);
      shadow.visible = t < 8;
    };
    this.start = [-0.72, 1.64, 1.5];
    this.finish = [-0.1, 1.68, -2.45];
    this.look = [0.72, 1.46, -8.3];
  }
  private pinkHouse() {
    this.room(11, 20, 3.45, '#754b61', '#67505b', '#65495c');
    this.box('#422337', 0, 1.63, -7.3, 9.5, 3.26, 0.18);
    this.box('#8d655e', 0, 0.56, -5.12, 6.86, 1.09, 3.91);
    this.box('#b58a7f', 0, 1.12, -5.1, 7, 0.18, 3.94);
    for (let i = -4; i <= 4; i++)
      this.orb('#d3a991', i * 0.75, 1.19, -3.06, 0.09, 0.08, 0.09, this.architecture, true);
    this.box('#b88e97', 0.57, 1.89, -5.14, 1.72, 1.37, 1.18);
    this.roof(0.57, 2.58, -5.14, 1.93, 0.67, 1.36, '#955d75');
    for (const dx of [-0.5, 0.49]) {
      this.box('#685867', 0.57 + dx, 2.09, -4.53, 0.39, 0.39, 0.03);
      this.box('#eac5a2', 0.57 + dx, 2.09, -4.5, 0.28, 0.28, 0.02, this.architecture, true);
    }
    this.box('#866375', 0.57, 1.66, -4.52, 0.3, 0.75, 0.061);
    const bear = this.model('toy', 1.98, -4.37, 0, 0.7);
    bear.position.y = 0.65;
    const figure = new T.Group();
    this.architecture.add(figure);
    figure.position.set(-1.02, 1.21, -5.99);
    this.orb('#2e2432', 0, 1.22, 0, 0.28, 0.37, 0.22, figure);
    this.box('#312632', 0, 0.76, 0, 0.29, 0.67, 0.14, figure);
    for (const side of [-1, 1]) {
      this.rod('#342735', [side * 0.1, 0.5, 0], [side * 0.14, 0, 0], 0.026, figure);
      this.rod('#342735', [side * 0.14, 1.04, 0], [side * 0.33, 0.36, 0.03], 0.021, figure);
    }
    const cloth: T.Group[] = [];
    for (const side of [-1, 1]) {
      const curtain = new T.Group();
      this.movable.add(curtain);
      curtain.position.set(side * 2.2, 0, -4.08);
      for (let j = 0; j < 9; j++)
        this.orb(j % 2 ? '#894b68' : '#a2667d', (j - 4) * 0.2, 2.35 + 0.04 * j, 0, 0.39, 2.25, 0.29, curtain);
      cloth.push(curtain);
    }
    this.animateSet = (t) => {
      const spread = smooth(t / 4) * 0.78;
      cloth[0].position.x = -1.72 - spread;
      cloth[1].position.x = 1.72 + spread;
    };
    this.start = [-0.67, 1.75, 3.33];
    this.finish = [-0.2, 1.94, 1.44];
    this.look = [0.46, 1.89, -5.13];
  }
  private arcade() {
    this.room(11.5, 21.5, 3.45, '#48515b', '#514852', '#60616a');
    for (let i = 0; i < 6; i++)
      for (const side of [-1, 1]) {
        const z = 1.5 - i * 1.63;
        this.model(
          'arcade',
          side * 4.12,
          z,
          -side * 0.92,
          1.05,
          ['NIGHT DRIVE', 'ORBIT', 'HIGH SCORE'][i % 3],
        );
      }
    for (const side of [-1, 1]) {
      this.box('#6fa4a6', side * 5.65, 2.68, -5, 0.07, 0.07, 17, this.architecture, true);
      this.box('#bf839a', side * 5.64, 2.49, -5, 0.06, 0.04, 17, this.architecture, true);
    }
    for (let z = 0; z >= -7; z -= 3.5) this.lamp(0, z, 1.25, '#ddd1b6');
    this.box('#66737a', -2.7, 1.46, -8.8, 5.93, 2.92, 0.19);
    this.box('#66737a', 4.18, 1.46, -8.8, 3.1, 2.92, 0.19);
    this.box('#4f5960', 1.49, 3.04, -8.8, 2.43, 0.4, 0.2);
    this.box('#ad9a80', 0.3, 1.41, -8.8, 0.13, 2.83, 0.22);
    this.box('#ad9a80', 2.72, 1.41, -8.8, 0.13, 2.83, 0.22);
    this.sign('EXIT', 1.51, 2.8, -8.62, 0.66, 0.24, '#4d675a', '#f1e2af');
    this.box('#9a8a7a', 0, -0.025, -13, 24, 0.08, 8);
    this.box('#54595e', 0, -0.04, -19, 24, 0.08, 5);
    this.box('#b3a18a', 0, -0.015, -22, 24, 0.08, 2);
    this.facade(0, -28, 14, 7, 4, 2);
    const door = this.swingDoor(1.48, -8.74, '#858b86', true);
    const staff = new T.Group();
    this.movable.add(staff);
    staff.position.set(2.37, 0, -8.14);
    this.orb('#ac8065', 0, 1.62, 0, 0.24, 0.29, 0.23, staff);
    this.orb('#514742', 0, 1.75, -0.01, 0.27, 0.11, 0.25, staff);
    this.box('#657774', 0, 1.19, 0, 0.38, 0.58, 0.22, staff);
    this.box('#b3b198', -0.072, 1.37, 0.12, 0.096, 0.056, 0.015, staff);
    for (const side of [-1, 1]) {
      this.rod('#414953', [side * 0.107, 0.94, 0], [side * 0.147, 0.13, 0.015], 0.083, staff);
      this.box('#363d40', side * 0.147, 0.075, 0.04, 0.16, 0.14, 0.29, staff);
    }
    this.rod('#61716c', [-0.16, 1.38, 0], [-0.37, 1.18, 0.05], 0.072, staff);
    this.rod('#a78369', [-0.37, 1.18, 0.05], [-0.56, 1.08, 0.12], 0.045, staff);
    this.rod('#61716c', [0.16, 1.38, 0], [0.25, 0.99, 0.04], 0.065, staff);
    const keys = new T.TorusGeometry(0.055, 0.011, 5, 10);
    this.assets.push(keys);
    const ring = new T.Mesh(keys, this.kit.get('#c6b187'));
    ring.position.set(-0.56, 1.04, 0.13);
    staff.add(ring);
    this.animateSet = (t) => {
      const turn = smooth((t - 1.1) / 4.0);
      door.rotation.y = -turn * 1.47;
      staff.rotation.y = -turn * 0.7;
      staff.position.x = 2.25 + turn * 0.34;
    };
    this.start = [-0.82, 1.57, 2.2];
    this.finish = [-0.32, 1.63, -1.4];
    this.look = [1.35, 1.56, -8.5];
  }
  private batch() {
    this.architecture.updateMatrixWorld(true);
    const groups = new Map<
      string,
      { geometry: T.BufferGeometry; material: T.Material; matrices: T.Matrix4[] }
    >();
    this.architecture.traverse((object) => {
      if (!(object instanceof T.Mesh) || Array.isArray(object.material)) return;
      const k = object.geometry.uuid + object.material.uuid;
      const row = groups.get(k) ?? {
        geometry: object.geometry,
        material: object.material,
        matrices: [] as T.Matrix4[],
      };
      row.matrices.push(object.matrixWorld.clone());
      groups.set(k, row);
    });
    this.scene.remove(this.architecture);
    for (const row of groups.values()) {
      const mesh = new T.InstancedMesh(row.geometry, row.material, row.matrices.length);
      row.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.computeBoundingSphere();
      this.scene.add(mesh);
      this.assets.push(mesh);
    }
    this.architecture.clear();
  }
  update(dt: number) {
    this.time += dt;
    const t = this.fixed ? 9 : this.time,
      q = smooth(t / 10);
    const sway = this.fixed ? 0 : Math.sin(t * 0.23) * 0.055;
    this.camera.position.set(
      this.start[0] + (this.finish[0] - this.start[0]) * q + sway,
      this.start[1] + (this.finish[1] - this.start[1]) * q,
      this.start[2] + (this.finish[2] - this.start[2]) * q,
    );
    this.camera.lookAt(this.look[0], this.look[1], this.look[2]);
    this.animateSet(t);
  }
  render(renderer: T.WebGLRenderer, aspect: number, dt: number) {
    if (this.camera.aspect !== aspect) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    this.update(dt);
    renderer.render(this.scene, this.camera);
  }
  dispose() {
    for (const asset of this.assets) asset.dispose();
    this.kit.dispose();
    this.scene.clear();
  }
}
