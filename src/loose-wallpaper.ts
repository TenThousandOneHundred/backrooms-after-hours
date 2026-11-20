import * as T from 'three';
import { hash } from './world-materials';

// One mesh per room for the bare plaster, torn fibers and the back of the folded
// paper. Each column follows a different tear line along the same piece of paper.
export class LooseWallpaper {
  private positions: number[] = [];
  private shades: number[] = [];
  private uvs: number[] = [];
  private indices: number[] = [];

  add(x: number, z: number, dx: number, dz: number, tx: number, tz: number, height: number, light: number) {
    const sample = (n: number) => hash(tx + dx * 41, tz + dz * 37, n);
    if (sample(117) > .23) return;
    const along = (sample(122) - .5) * 2.05;
    const width = .18 + .59 * sample(125);
    const length = .28 + .88 * sample(129);
    const top = .47 + length + sample(131) * Math.max(.1, height - length - .76);
    const start = this.positions.length / 3;
    const columns = 20;
    const phase = sample(133) * 6.28;
    for (let i = 0; i <= columns; i++) {
      const u = i / columns;
      const taper = Math.pow(Math.max(0, Math.sin(u * Math.PI)), .60);
      const torn = length * taper * (.68 + .19 * Math.sin(phase + u * 7.) + sample(143 + i) * .13);
      const hinge = top - torn;
      const offset = along + (u - .5) * width;
      const curl = (.035 + .125 * sample(137)) * taper;
      const emit = (y: number, depth: number, r: number, g: number, b: number) => {
        const px = x + dz * offset - dx * depth, pz = z - dx * offset - dz * depth;
        this.positions.push(px, y, pz);
        this.uvs.push(offset * 2., y * 2.);
        this.shades.push(light * r, light * g, light * b);
      };
      const paperEdge = top + .016 * Math.sin(11. * u + phase) + sample(165 + i) * .014;
      emit(paperEdge, .005, .72, .62, .43);
      emit(paperEdge - .012 * taper, .006, .65, .54, .37);
      emit(hinge, .008, .55, .46, .32);
      emit(hinge - .022 * taper, .017, .46, .38, .24);
      emit(hinge - torn * .17, curl * .52 + .01, .69, .58, .40);
      emit(hinge - torn * .29, curl + .01, .89, .78, .57);
      emit(hinge - torn * .27 + sample(199 + i) * .014 * taper, curl * 1.1 + .014, .77, .68, .49);
      if (i === 0) continue;
      for (let j = 0; j < 6; j++) {
        const prev = start + (i - 1) * 7 + j, next = prev + 7;
        this.indices.push(prev, next, prev + 1, next, next + 1, prev + 1);
      }
    }
  }
  geometry() {
    if (!this.indices.length) return;
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(this.shades, 3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute(this.uvs, 2));
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals();
    return geometry;
  }
}
