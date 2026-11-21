import { crossesPartition } from './level-zero-rooms.ts';
import type { Stage } from './campaign-format';

export interface DetailAnchor { x: number; z: number; dx: number; dz: number }
const directions = [[0,-1], [1,0], [0,1], [-1,0]] as const;

// Only reachable, empty wall faces. A solid furniture cell is drawn as a room by buildWorld.
export function stageDetailAnchors(stage: Stage): DetailAnchor[] {
  const width = stage.map[0]?.length ?? 0;
  const [sx, sz] = stage.spawn;
  const occupied = new Set([...stage.props, ...stage.objects].map(p => p.z * width + p.x));
  const isFloor = (x:number,z:number) => '.=!|'.includes(stage.map[z]?.[x] ?? '#');
  const frontX = Math.sin(stage.facing ?? 0), frontZ = -Math.cos(stage.facing ?? 0);
  const candidates: (DetailAnchor & { distance:number; entryScore:number })[] = [];
  const queue = [sz * width + sx], seen = new Set(queue);
  const steps = new Map([[queue[0], 0]]);
  function entryScore(x:number, z:number, dx:number, dz:number) {
    const vx = x + dx * .45 - sx, vz = z + dz * .45 - sz;
    const distance = Math.hypot(vx, vz);
    const samples = Math.ceil(distance * 3);
    let occluded = crossesPartition(stage.id,sx,sz,sx+vx,sz+vz,.12);
    for (let i=1; i<samples; i++) {
      const tx=Math.round(sx+vx*i/samples), tz=Math.round(sz+vz*i/samples);
      if (!isFloor(tx,tz) || (i > 1 && (tx !== x || tz !== z) && occupied.has(tz*width+tx))) { occluded=true; break; }
    }
    const facing = (vx * frontX + vz * frontZ) / (distance || 1);
    const incidence = (vx * dx + vz * dz) / (distance || 1);
    return Math.abs(distance - 2.4) + (1-facing)*6 + (1-incidence)*3 + (occluded ? 25 : 0);
  }
  for (let cursor=0; cursor<queue.length; cursor++) {
    const cell=queue[cursor], x=cell%width, z=Math.floor(cell/width), distance=steps.get(cell)!;
    for (const [dx,dz] of directions) {
      const nx=x+dx, nz=z+dz, next=nz*width+nx;
      if (isFloor(nx,nz)) {
        if (crossesPartition(stage.id,x,z,nx,nz,.12)) continue;
        if (!seen.has(next)) { seen.add(next); queue.push(next); steps.set(next,distance+1); }
      } else if (stage.map[z]?.[x] === '.' && stage.map[nz]?.[nx] === '#' && !occupied.has(cell) && !occupied.has(next)) {
        if (crossesPartition(stage.id,x,z,x+dx*.45,z+dz*.45,.16)) continue;
        candidates.push({x,z,dx,dz,distance,entryScore:distance<13 ? entryScore(x,z,dx,dz) : distance+28});
      }
    }
  }
  if (!candidates.length) return [];
  candidates.sort((a,b)=>a.entryScore-b.entryScore);
  const chosen = [candidates[0]];
  const exits = stage.objects.filter(p=>p.kind === 'exit' || p.kind === 'ending');
  for (const dest of [exits[0], exits[exits.length-1] ?? stage.objects[0]]) {
    if (!dest) continue;
    const available = candidates.filter(p=>chosen.every(q=>Math.abs(p.x-q.x)+Math.abs(p.z-q.z)>=6));
    const best = available.sort((a,b)=>Math.hypot(a.x-dest.x,a.z-dest.z)-Math.hypot(b.x-dest.x,b.z-dest.z))[0];
    if (best) chosen.push(best);
  }
  return chosen.map(({x,z,dx,dz})=>({x,z,dx,dz}));
}
