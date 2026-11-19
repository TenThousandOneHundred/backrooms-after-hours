import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('shipping Bacteria mesh has skin weights, an embedded hide texture and the locomotion, attack and sound-reaction clips', () => {
  const bytes = readFileSync(new URL('../public/models/bacteria.glb', import.meta.url));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  const model = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  const dermis = model.nodes.find(node => node.name === 'Dermis');
  const body = model.meshes[dermis.mesh].primitives[0];
  assert.ok(body);
  for (const attribute of ['POSITION', 'NORMAL', 'COLOR_0', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']) {
    assert.ok(model.accessors[body.attributes[attribute]]);
  }
  const hood = model.nodes.find(node => node.name === 'Cleft hood, pharyngeal teeth and mantle');
  assert.equal(hood.skin, dermis.skin);
  const enamel = model.materials.find(material => material.name === 'Delaminated enamel');
  for (const texture of [enamel.normalTexture, enamel.pbrMetallicRoughness.baseColorTexture])
    assert.ok(model.bufferViews[model.images[model.textures[texture.index].source].bufferView]);
  for (const primitive of model.meshes[hood.mesh].primitives) {
    for (const attribute of ['NORMAL', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0'])
      assert.ok(model.accessors[primitive.attributes[attribute]]);
  }
  const material = model.materials[body.material];
  const image = model.images[model.textures[material.normalTexture.index].source];
  assert.ok(model.bufferViews[image.bufferView]);
  assert.ok(model.skins.some(skin => skin.joints.some(index => model.nodes[index].name === 'Skull')));
  assert.deepEqual(model.animations.map(clip => clip.name).sort(), ['Chase', 'Listen', 'Recover', 'SoundTurn', 'Stalk', 'Strike', 'Windup']);
  assert.ok(model.animations.every(clip => clip.channels.some(channel => channel.target.path === 'rotation')));
});
