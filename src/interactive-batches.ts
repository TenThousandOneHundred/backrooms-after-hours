import { Box3, Group, InstancedMesh, Mesh, MeshLambertMaterial, type Object3D } from 'three';

// Interactive items can move or disappear as a unit. Batch their rigid painted parts
// inside the item's own coordinate system so a carried trolley or a collected key
// still responds to exactly the same gameplay transform.
export function batchItemPaint(item: Group, paint: MeshLambertMaterial, batches: InstancedMesh[]) {
  const groups = new Map<string, { parent: Object3D; parts: Mesh[] }>();
  item.traverse(part => {
    if (!(part instanceof Mesh) || part instanceof InstancedMesh || !part.visible || part.name || !part.parent || part.children.length) return;
    const m = part.material;
    if (!(m instanceof MeshLambertMaterial) || m.transparent || m.map || m.vertexColors || m.side !== paint.side) return;
    const key = part.parent.uuid + '/' + part.geometry.uuid;
    const existing = groups.get(key);
    if (existing) existing.parts.push(part);
    else groups.set(key, { parent: part.parent, parts: [part] });
  });
  if (![...groups.values()].some(({parts}) => parts.length >= 3)) return;
  // A combined local AABB may be larger when a locker is placed diagonally.
  item.userData.aimBounds = new Box3().setFromObject(item);
  for (const {parent, parts} of groups.values()) {
    if (parts.length < 3) continue;
    const mesh = new InstancedMesh(parts[0].geometry, paint, parts.length);
    mesh.castShadow = mesh.receiveShadow = true;
    parts.forEach((part, i) => {
      mesh.setMatrixAt(i, part.matrix);
      mesh.setColorAt(i, part.material.color);
      part.removeFromParent();
    });
    mesh.computeBoundingSphere();
    parent.add(mesh);
    batches.push(mesh);
  }
}
