import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('shipping Bacteria mesh has skin weights, an embedded hide texture and the six gameplay clips', () => {
  const bytes = readFileSync(new URL('../public/models/bacteria.glb', import.meta.url));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  const model = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  const body = model.meshes.flatMap(mesh => mesh.primitives).find(p => p.attributes.COLOR_0 !== undefined);
  assert.ok(body);
  for (const attribute of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']) {
    assert.ok(model.accessors[body.attributes[attribute]]);
  }
  const material = model.materials[body.material];
  const image = model.images[model.textures[material.normalTexture.index].source];
  assert.ok(model.bufferViews[image.bufferView]);
  assert.ok(model.skins.some(skin => skin.joints.some(index => model.nodes[index].name === 'Skull')));
  assert.deepEqual(model.animations.map(clip => clip.name).sort(), ['Chase', 'Listen', 'Recover', 'Stalk', 'Strike', 'Windup']);
  assert.ok(model.animations.every(clip => clip.channels.some(channel => channel.target.path === 'rotation')));
});
