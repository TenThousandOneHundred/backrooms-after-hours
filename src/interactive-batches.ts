import { Box3, Group, InstancedMesh, Matrix4, Mesh, MeshLambertMaterial, Vector3, type BufferGeometry } from 'three';

// Interactive items can move or disappear as a unit. Batch their rigid painted parts
// inside the item's own coordinate system so a carried trolley or a collected key
// still responds to exactly the same gameplay transform.
export function batchItemPaint(item: Group, paint: MeshLambertMaterial, batches: InstancedMesh[]) {
  const byGeometry = new Map<BufferGeometry, Mesh<BufferGeometry, MeshLambertMaterial>[]>();
  item.traverse(part => {
    if (!(part instanceof Mesh) || part instanceof InstancedMesh || !part.visible || part.name) return;
    const m = part.material;
    if (!(m instanceof MeshLambertMaterial) || m.transparent || m.map || m.vertexColors || m.side !== paint.side) return;
    const parts = byGeometry.get(part.geometry);
    if (parts) parts.push(part);
    else byGeometry.set(part.geometry, [part]);
  });
  if (![...byGeometry.values()].some(parts => parts.length >= 3)) return;
  // Keep the original world bounds for interaction targeting. A combined local AABB
  // can be larger than the component bounds when a locker is placed diagonally.
  const bounds = new Box3().setFromObject(item);
  if (!bounds.isEmpty()) item.userData.aimCenter = bounds.getCenter(new Vector3());
  const inverse = item.matrixWorld.clone().invert(), local = new Matrix4();
  for (const [geometry, parts] of byGeometry) {
    if (parts.length < 3) continue;
    const mesh = new InstancedMesh(geometry, paint, parts.length);
    mesh.castShadow = mesh.receiveShadow = true;
    parts.forEach((part, i) => {
      mesh.setMatrixAt(i, local.multiplyMatrices(inverse, part.matrixWorld));
      mesh.setColorAt(i, part.material.color);
      part.removeFromParent();
    });
    mesh.computeBoundingSphere();
    item.add(mesh);
    batches.push(mesh);
  }
}
