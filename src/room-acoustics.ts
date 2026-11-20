import type { Stage } from './campaign-format';
import { TILE, clearSight } from './game-entity';
import { styleFor } from './world-materials';

type Source = { x: number; z: number };
export function roomAcoustics(stage: Stage, spills: Source[]) {
  const { open, floor } = styleFor(stage.theme, stage.id);
  const machines: Source[] = [],
    leaks: Source[] = spills.map((p) => ({ x: p.x / TILE, z: p.z / TILE })),
    structure: Source[] = [];
  for (const obj of [...stage.props, ...stage.objects]) {
    const label = (obj.model ?? '') + ' ' + ('name' in obj ? obj.name : (obj.label ?? ''));
    if (/machine|generator|turbine|switchboard|breaker|transformer|service.panel|pump|fusebox/i.test(label))
      machines.push(obj);
    if (/water|drain|pipe|sink|leak/i.test(label)) leaks.push(obj);
    if (/metal|vent|grate|gantry|shutter|duct|pipe/i.test(label)) structure.push(obj);
  }
  // Unmarked corridors can still have a noisy ballast or a leaking joint.
  // Anchor those sounds against the wall so rotating in place moves the source.
  if (!open) {
    for (let z = 1; z < stage.map.length - 1; z += 2)
      for (let x = 1; x < stage.map[z].length - 1; x++) {
        if (stage.map[z][x] !== '#' || stage.map[z][x + 1] !== '.') continue;
        const hash = (x * 59 + z * 97) % 37,
          point = { x: x + 0.55, z };
        if (hash === 0) machines.push(point);
        if (hash === 11) structure.push(point);
        if (hash === 19 || (floor === 'water' && hash % 7 === 0)) leaks.push(point);
      }
  }
  function listen(sources: Source[], x: number, z: number, yaw: number, reach: number) {
    let nearest: Source | undefined,
      distance = reach * reach;
    for (const source of sources) {
      const d = (source.x * TILE - x) ** 2 + (source.z * TILE - z) ** 2;
      if (d < distance) {
        distance = d;
        nearest = source;
      }
    }
    if (!nearest) return { pan: 0, gain: 0 };
    distance = Math.sqrt(distance);
    const dx = nearest.x * TILE - x,
      dz = nearest.z * TILE - z;
    const occlusion = clearSight(stage, x / TILE, z / TILE, nearest.x, nearest.z) ? 1 : 0.36;
    return {
      pan: (dx * Math.cos(yaw) + dz * Math.sin(yaw)) / Math.max(1, distance),
      gain: occlusion * (1 - distance / reach) ** 2,
    };
  }
  return (x: number, z: number, yaw: number) => ({
    machine: listen(machines, x, z, yaw, 44),
    drip: listen(leaks, x, z, yaw, 35),
    steel: listen(structure, x, z, yaw, 64),
  });
}
