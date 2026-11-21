import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AnimationMixer, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { shareActorPalettes } from '../src/actor-rig.ts';

for (const name of ['bacteria', 'bestiary', 'level-creatures', 'residents', 'explorer']) {
  test(name + ' can share bone updates without changing animated vertices', async () => {
    const file = await readFile(new URL('../public/models/' + name + '.glb', import.meta.url));
    const length = file.readUInt32LE(12);
    const gltf = JSON.parse(file.toString('utf8', 20, 20 + length));
    // Material images are irrelevant to vertex skinning and need a browser to decode.
    gltf.materials = gltf.materials.map(() => ({}));
    file.fill(32, 20, 20 + length);
    file.write(JSON.stringify(gltf), 20, length);
    const asset = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
    const reference = clone(asset.scene), shared = clone(asset.scene);
    const palettes = shareActorPalettes(shared);
    assert.equal(palettes.length, gltf.skins.length);

    const meshes = root => {
      const parts = [];
      root.traverse(o => { if (o instanceof SkinnedMesh) parts.push(o); });
      return parts;
    };
    const left = meshes(reference), right = meshes(shared);
    assert.ok(left.length > palettes.length);
    const mixers = [reference, shared].map(root => {
      const mixer = new AnimationMixer(root);
      for (const clip of asset.animations) mixer.clipAction(clip).play();
      return mixer;
    });
    for (const time of [.13, .47]) {
      for (const mixer of mixers) mixer.setTime(time);
      reference.updateMatrixWorld(true);
      shared.updateMatrixWorld(true);
      const a = new Vector3(), b = new Vector3();
      for (let i = 0; i < left.length; i++) {
        const count = left[i].geometry.attributes.position.count;
        for (const vertex of [0, Math.floor(count / 2), count - 1]) {
          left[i].getVertexPosition(vertex, a);
          right[i].getVertexPosition(vertex, b);
          assert.ok(a.distanceTo(b) < 1e-7, name + ' animated vertex in mesh ' + i);
        }
      }
    }
  });
}
