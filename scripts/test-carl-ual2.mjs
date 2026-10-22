import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { STUDIO_WEAPONS, normalizeEquipment, findRightHand, createWeaponAttachment } from '../js/studio-equipment.mjs';

// Validate the shipped proof against the actual original Carl, independently of
// the optional offline retargeter and without requiring the uploaded library.
const core = fs.readFileSync(new URL('../assets/vendor/three/three.core.min.js', import.meta.url));
const THREE = await import(`data:text/javascript;base64,${core.toString('base64')}`);
const root = new URL('../', import.meta.url);
const originalPath = 'assets/models/dungeon-crawler-carl/v2/dungeon-crawler-carl-v2.glb';
const proofPath = 'assets/models/dungeon-crawler-carl/v2-ual2-sword-test/dungeon-crawler-carl-v2-ual2-sword-test.glb';

function readGlb(path) {
  const bytes = fs.readFileSync(new URL(path, root));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'GLB magic');
  assert.equal(bytes.readUInt32LE(4), 2, 'glTF 2');
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'Complete file');
  let json, binary;
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    assert.equal(length % 4, 0, 'Aligned chunks');
    assert.ok(offset + 8 + length <= bytes.length, 'Complete chunk');
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    else if (type === 0x004e4942) binary = chunk;
    else assert.fail('Unexpected GLB chunk');
    offset += 8 + length;
  }
  assert.ok(json && binary, 'Embedded JSON and BIN');
  assert.equal(json.buffers.length, 1);
  assert.equal(json.buffers[0].uri, undefined, 'Self-contained model');
  assert.ok(binary.length >= json.buffers[0].byteLength);
  function accessor(index) {
    const a = json.accessors[index], view = json.bufferViews[a.bufferView];
    assert.equal(a.componentType, 5126, 'Animation uses float data');
    assert.equal(a.sparse, undefined);
    assert.equal(view.buffer, 0, 'Animation data is in the embedded buffer');
    const components = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
    assert.ok(components, 'Supported animation accessor');
    const stride = view.byteStride || components * 4;
    const start = (view.byteOffset || 0) + (a.byteOffset || 0);
    const end = start + (a.count - 1) * stride + components * 4;
    assert.ok(end <= (view.byteOffset || 0) + view.byteLength && end <= json.buffers[0].byteLength);
    return Float32Array.from({ length: a.count * components }, (_, i) =>
      binary.readFloatLE(start + Math.floor(i / components) * stride + (i % components) * 4));
  }
  return { bytes, json, binary, accessor };
}

const original = readGlb(originalPath), proof = readGlb(proofPath);
const provenance = JSON.parse(fs.readFileSync(new URL(
  'assets/models/dungeon-crawler-carl/v2-ual2-sword-test/provenance.json', root)));
assert.equal(crypto.createHash('sha256').update(proof.bytes).digest('hex'), provenance.output.sha256,
  'The shipped model matches its recorded generation result');
assert.equal(provenance.output.bytes, proof.bytes.length);
assert.equal(crypto.createHash('sha256').update(original.bytes).digest('hex'),
  '5284bd3cd0b9fe6665c5d94ec0fc7fae8ec4a5856f0628f3084ae1190b044693', 'Original source identity');
for (const key of ['scene', 'scenes', 'nodes', 'meshes', 'skins', 'materials', 'textures', 'images', 'samplers']) {
  assert.deepEqual(proof.json[key], original.json[key], `Preserved ${key}`);
}
assert.deepEqual(proof.json.accessors.slice(0, original.json.accessors.length), original.json.accessors);
assert.deepEqual(proof.json.bufferViews.slice(0, original.json.bufferViews.length), original.json.bufferViews);
assert.ok(proof.binary.subarray(0, original.json.buffers[0].byteLength)
  .equals(original.binary.subarray(0, original.json.buffers[0].byteLength)),
  'Original mesh, skin weights, textures and animation bytes are preserved');
assert.deepEqual(proof.json.animations.slice(2), original.json.animations, 'All original takes retained verbatim');
assert.deepEqual(proof.json.animations.slice(0, 2).map(a => a.name), ['UAL2_Sword_Ready', 'UAL2_Sword_Regular_A']);

const catalog = JSON.parse(fs.readFileSync(new URL('data/studio-models.json', root)));
const entries = catalog.models.filter(m => m.id === 'dungeon-crawler-carl-v2-ual2-sword-test');
assert.equal(entries.length, 1);
assert.equal(entries[0].file, proofPath);
assert.equal(entries[0].upAxis, 'Y');
assert.equal(entries[0].mobType, 'fighter');
assert.equal(catalog.models.find(m => m.id === 'dungeon-crawler-carl-v2')?.file, originalPath);
const binding = JSON.parse(fs.readFileSync(new URL('data/sprite-sets.json', root)));
const defaults = binding.sets.filter(s => s.defaultFor === 'fighter');
assert.equal(defaults.length, 1);
assert.equal(defaults[0].id, 'dungeon-crawler-carl',
  'A studio proof must not replace the published fighter sprite assignment');

const joints = new Set(proof.json.skins[0].joints);
const objects = proof.json.nodes.map((node, index) => {
  const object = joints.has(index) ? new THREE.Bone() : new THREE.Group();
  object.name = node.name.replace(/:/g, '');
  if (node.matrix) new THREE.Matrix4().fromArray(node.matrix).decompose(object.position, object.quaternion, object.scale);
  else {
    object.position.fromArray(node.translation || [0, 0, 0]);
    object.quaternion.fromArray(node.rotation || [0, 0, 0, 1]);
    object.scale.fromArray(node.scale || [1, 1, 1]);
  }
  return object;
});
proof.json.nodes.forEach((node, index) => (node.children || []).forEach(child => objects[index].add(objects[child])));
const character = new THREE.Group();
proof.json.scenes[proof.json.scene || 0].nodes.forEach(i => character.add(objects[i]));
const display = new THREE.Group();
display.add(character);
display.updateMatrixWorld(true);
const bones = objects.filter(o => o.isBone);
const segments = bones.filter(b => b.parent.isBone).map(b => ({ bone: b,
  length: b.getWorldPosition(new THREE.Vector3()).distanceTo(b.parent.getWorldPosition(new THREE.Vector3())) }));
const hand = findRightHand(character);
assert.equal(hand.name, 'mixamorigRightHand', 'Existing equipment finds the original hand');
const sword = new THREE.Group(), settings = normalizeEquipment({ rightHand: 'medieval-sword' });
const attached = createWeaponAttachment(THREE, hand, sword, settings);
const mixer = new THREE.AnimationMixer(character);
let sampledFacings = 0;
for (const [index, animation] of proof.json.animations.slice(0, 2).entries()) {
  assert.equal(animation.channels.length, 65, '64 mapped rotations and hips translation');
  const seen = new Set();
  const tracks = animation.channels.map(channel => {
    const node = proof.json.nodes[channel.target.node], path = channel.target.path;
    const key = `${channel.target.node}/${path}`;
    assert.ok(!seen.has(key), 'One track per property');
    seen.add(key);
    assert.ok(joints.has(channel.target.node), 'Only Carl joints are animated');
    const sampler = animation.samplers[channel.sampler];
    assert.equal(sampler.interpolation || 'LINEAR', 'LINEAR');
    assert.equal(proof.json.accessors[sampler.input].type, 'SCALAR', 'Scalar timeline');
    assert.equal(proof.json.accessors[sampler.output].type, path === 'rotation' ? 'VEC4' : 'VEC3');
    const times = proof.accessor(sampler.input), values = proof.accessor(sampler.output);
    assert.equal(times[0], 0);
    assert.ok(times.every((time, i) => Number.isFinite(time) && (i === 0 || time > times[i - 1])));
    assert.ok(values.every(Number.isFinite));
    const components = path === 'rotation' ? 4 : 3;
    assert.equal(values.length, times.length * components);
    for (let i = 0; i < values.length; i += components) {
      const value = values.slice(i, i + components);
      if (path === 'rotation') assert.ok(Math.abs(Math.hypot(...value) - 1) < 2e-5, 'Normalized rotation');
      else if (path === 'scale' || node.name !== 'mixamorig:Hips') {
        const expected = node[path] || (path === 'scale' ? [1, 1, 1] : [0, 0, 0]);
        assert.ok(value.every((v, axis) => Math.abs(v - expected[axis]) < 2e-6), 'Preserved bone offsets and scale');
      }
    }
    if (index === 0) {
      for (let i = components; i < values.length; i++) assert.equal(values[i], values[i % components], 'Ready is a held pose');
    } else {
      const ready = proof.json.animations[0];
      const readyChannel = ready.channels.find(c => c.target.node === channel.target.node && c.target.path === path);
      assert.ok(readyChannel, 'Ready and attack animate the same joints');
      const readyValues = proof.accessor(ready.samplers[readyChannel.sampler].output);
      assert.deepEqual(values.slice(0, components), readyValues.slice(0, components), 'Ready matches attack start');
    }
    const property = { translation: 'position', rotation: 'quaternion', scale: 'scale' }[path];
    assert.ok(property, 'Only TRS channels');
    const Track = path === 'rotation' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
    return new Track(`${objects[channel.target.node].name}.${property}`, times, values);
  });
  for (const joint of joints) {
    if (proof.json.nodes[joint].name !== 'mixamorig:HeadTop_End') {
      assert.ok(seen.has(`${joint}/rotation`), `Mapped rotation for ${proof.json.nodes[joint].name}`);
    }
  }
  const hipsIndex = proof.json.nodes.findIndex(n => n.name === 'mixamorig:Hips');
  assert.ok(seen.has(`${hipsIndex}/translation`), 'Scaled pelvis movement is included');
  const clip = new THREE.AnimationClip(animation.name, -1, tracks);
  assert.ok(Math.abs(clip.duration - [1, 1.4][index]) < 1e-6, 'Complete ready or attack/recovery duration');
  const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1).play();
  action.paused = true;
  action.clampWhenFinished = true;
  for (let sample = 0; sample <= 48; sample++) {
    action.time = clip.duration * sample / 48;
    mixer.update(0);
    for (let facing = 0; facing < 6; facing++) {
      display.rotation.y = facing * Math.PI / 3;
      display.updateMatrixWorld(true);
      for (const b of bones) {
        assert.ok([...b.position, ...b.quaternion, ...b.scale, ...b.matrixWorld.elements].every(Number.isFinite));
      }
      for (const s of segments) {
        const length = s.bone.getWorldPosition(new THREE.Vector3()).distanceTo(s.bone.parent.getWorldPosition(new THREE.Vector3()));
        assert.ok(Math.abs(length - s.length) < 2e-6, 'Retargeting must not stretch a limb');
      }
      const grip = sword.localToWorld(new THREE.Vector3(...STUDIO_WEAPONS[0].grip));
      const expected = hand.localToWorld(new THREE.Vector3(...settings.position));
      assert.ok(grip.distanceTo(expected) < 1e-6, 'Sword grip follows the animated hand in every facing');
      sampledFacings++;
    }
  }
  mixer.stopAllAction();
}
attached.detach();
console.log(`Carl UAL2 proof passed: original assets/clips preserved, two valid takes, ${sampledFacings} posed facings with fixed limb lengths and attached sword grip.`);
