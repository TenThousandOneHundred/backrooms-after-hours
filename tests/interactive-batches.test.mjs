import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BoxGeometry, Group, Matrix4, Mesh, MeshLambertMaterial } from 'three';
import { batchItemPaint } from '../src/interactive-batches.ts';

test('rigid batching preserves targeting, hinge transforms and per-part paint', () => {
  const item = new Group(), hinge = new Group(), geo = new BoxGeometry();
  item.add(hinge);
  item.rotation.y = .6;
  hinge.position.set(.3, 0, .4);
  hinge.rotation.y = -.18;
  const parts = [0x766655, 0xacbbcc, 0xdefad4].map((color,i) => {
    const mesh = new Mesh(geo, new MeshLambertMaterial({color}));
    mesh.position.set(.06*i,.4*i,-.2*i);
    mesh.scale.set(.3,.42,.12);
    hinge.add(mesh);
    return mesh;
  });
  const bounds = new Box3().setFromObject(item), batches = [];
  batchItemPaint(item, new MeshLambertMaterial(), batches);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].parent, hinge);
  assert.ok(bounds.equals(item.userData.aimBounds));
  const restored = new Matrix4();
  for(let i=0;i<parts.length;i++){
    batches[0].getMatrixAt(i,restored);
    assert.ok(restored.elements.every((v,j) => Math.abs(parts[i].matrix.elements[j]-v)<.000001));
    const color = parts[i].material.color.clone();
    batches[0].getColorAt(i,color);
    assert.ok(color.toArray().every((v,j)=>Math.abs(v-parts[i].material.color.toArray()[j])<.000001));
  }
});
