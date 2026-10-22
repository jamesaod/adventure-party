import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {
  STUDIO_WEAPONS, normalizeEquipment, findRightHand, createWeaponAttachment, createStudioEquipment
} from '../js/studio-equipment.mjs';

const source = fs.readFileSync(new URL('../assets/vendor/three/three.core.min.js', import.meta.url));
const THREE = await import(`data:text/javascript;base64,${source.toString('base64')}`);
const close = (actual, expected, label) => assert.ok(actual.distanceTo(expected) < 1e-6,
  `${label}: ${actual.toArray()} vs ${expected.toArray()}`);

function glb(path) {
  const bytes = fs.readFileSync(new URL(`../${path}`, import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  let json, binary;
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    assert.equal(chunk.length, length);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    if (type === 0x004e4942) binary = chunk;
    offset += 8 + length;
  }
  function accessor(index) {
    const value = json.accessors[index], view = json.bufferViews[value.bufferView];
    const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[value.type];
    assert.equal(value.componentType, 5126);
    const length = value.count * components * 4;
    const offset = (view.byteOffset || 0) + (value.byteOffset || 0);
    const data = binary.subarray(offset, offset + length);
    return Float32Array.from({ length: length / 4 }, (_, i) => data.readFloatLE(i * 4));
  }
  return { bytes, json, accessor };
}

// Use the actual preserved assets so bone aliases, source pivot and authored
// animation transforms are exercised, not only an idealized arm fixture.
assert.equal(STUDIO_WEAPONS.length, 2, 'Sword and Battle Axe are registered');
assert.equal(STUDIO_WEAPONS[1].defaultSizePercent, 75, 'Battle Axe defaults to QA-approved 75% scale');
assert.deepEqual(STUDIO_WEAPONS[1].rotation, [0, 90, 0], 'Battle Axe head stays up while blade turns forward');
assert.deepEqual(STUDIO_WEAPONS[1].grip, [0, 0.12, 0], 'Battle Axe grip is one hand-length above the butt');
const sword = glb(STUDIO_WEAPONS[0].file);
assert.equal(crypto.createHash('sha256').update(sword.bytes).digest('hex'),
  '1f4a381aae5aa3779f5b1d03cca706ed7273972e4e31a03f622ea923c3d1edb6');
assert.equal(sword.json.meshes.length, 1);
assert.equal(sword.json.skins?.length || 0, 0);
assert.equal(sword.json.animations?.length || 0, 0);
assert.ok(sword.json.images.every(image => Number.isInteger(image.bufferView)), 'Textures are embedded');
const axe = glb(STUDIO_WEAPONS[1].file);
assert.equal(crypto.createHash('sha256').update(axe.bytes).digest('hex'),
  'd7ba2e5d2cdc15e782d05f13d4d31d6e63a2142bd336a22248b2560323938b76');
assert.equal(axe.json.meshes.length, 1);
assert.equal(axe.json.skins?.length || 0, 0);
assert.equal(axe.json.animations?.length || 0, 0);
const axePrimitive=axe.json.meshes[0].primitives[0];
assert.equal(axe.json.accessors[axePrimitive.indices].count / 3, 54706, 'Battle Axe triangle benchmark');
const swordModel = new THREE.Group();
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(sword.accessor(
  sword.json.meshes[0].primitives[0].attributes.POSITION), 3));
swordModel.add(new THREE.Mesh(geometry));

const carl = glb('assets/models/dungeon-crawler-carl/v2/dungeon-crawler-carl-v2.glb');
const joints = new Set(carl.json.skins[0].joints);
const nodes = carl.json.nodes.map((node, index) => {
  const object = joints.has(index) ? new THREE.Bone() : new THREE.Group();
  object.name = node.name.replace(/:/g, '');
  if (node.translation) object.position.fromArray(node.translation);
  if (node.rotation) object.quaternion.fromArray(node.rotation);
  if (node.scale) object.scale.fromArray(node.scale);
  return object;
});
carl.json.nodes.forEach((node, index) => (node.children || []).forEach(child => nodes[index].add(nodes[child])));
const character = new THREE.Group();
carl.json.scenes[carl.json.scene || 0].nodes.forEach(index => character.add(nodes[index]));
const display = new THREE.Group();
display.position.set(0.2, -0.3, 0.4);
display.scale.setScalar(2.35);
display.add(character);
const hand = findRightHand(character);
assert.equal(hand?.name, 'mixamorigRightHand');
hand.name = 'mixamorig:RightHand';
assert.equal(findRightHand(character), hand, 'Colon spelling is accepted');
hand.name = 'mixamorigRightHand';
const settings = normalizeEquipment({ rightHand: 'medieval-sword' });
const attached = createWeaponAttachment(THREE, hand, swordModel, settings);
const gripPoint = new THREE.Vector3(...STUDIO_WEAPONS[0].grip);
const mixer = new THREE.AnimationMixer(character);
const visited = new Set();
for (const animation of carl.json.animations) {
  const tracks = animation.channels.map(channel => {
    const sampler = animation.samplers[channel.sampler];
    const target = nodes[channel.target.node];
    const property = { translation: 'position', rotation: 'quaternion', scale: 'scale' }[channel.target.path];
    const Track = channel.target.path === 'rotation' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
    assert.ok(['LINEAR', 'STEP'].includes(sampler.interpolation || 'LINEAR'));
    return new Track(`${target.name}.${property}`, carl.accessor(sampler.input), carl.accessor(sampler.output),
      sampler.interpolation === 'STEP' ? THREE.InterpolateDiscrete : THREE.InterpolateLinear);
  });
  const clip = new THREE.AnimationClip(animation.name, -1, tracks);
  const action = mixer.clipAction(clip).play();
  action.paused = true;
  for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
    action.time = clip.duration * fraction;
    mixer.update(0);
    for (let facing = 0; facing < 6; facing++) {
      display.rotation.y = facing * Math.PI / 3;
      display.updateMatrixWorld(true);
      const expectedGrip = hand.localToWorld(new THREE.Vector3(...settings.position));
      const actualGrip = swordModel.localToWorld(gripPoint.clone());
      close(actualGrip, expectedGrip, `${animation.name}/${fraction}/facing${facing}: grip remains in hand`);
      visited.add(actualGrip.toArray().map(value => value.toFixed(3)).join(','));
      // Native sword -X becomes hand-local -Z at the preset rotation.
      const expectedTip = hand.localToWorld(new THREE.Vector3(...settings.position).add(new THREE.Vector3(0, 0, -0.55)));
      const actualTip = swordModel.localToWorld(gripPoint.clone().add(new THREE.Vector3(-1, 0, 0)));
      close(actualTip, expectedTip, 'Sword orientation and inherited scale');
    }
  }
  mixer.stopAllAction();
}
assert.ok(visited.size > 30, 'The weapon really moves through the authored animations and six views');
attached.detach();
assert.equal(attached.socket.parent, null);

const weird = normalizeEquipment({ rightHand: 'unknown', sizePercent: Infinity, position: [NaN, 7, -4], rotation: [999] });
assert.equal(weird.rightHand, 'none');
assert.equal(weird.sizePercent, 100);
assert.deepEqual(weird.position, [0.015, 1, -1]);
assert.deepEqual(weird.rotation, [180, -90, 0]);

// Late network responses, retries, model replacement and page teardown must
// never attach old equipment to a new model or leak loaded resources.
const disposed = [], pending = [];
let changes = 0;
const equipment = createStudioEquipment({
  THREE, disposeObject: object => disposed.push(object), onChange: () => changes++,
  loadAsset: () => new Promise((resolve, reject) => pending.push({ resolve, reject }))
});
await equipment.setModel(character);
const stale = equipment.select(settings);
assert.equal(equipment.snapshot().loading, true);
await equipment.setModel(new THREE.Group());
const staleAsset = new THREE.Group();
pending.shift().resolve(staleAsset);
assert.equal(await stale, false);
assert.equal(equipment.snapshot().attached, false);
assert.equal(staleAsset.parent, null);
assert.equal(disposed.filter(object => object === staleAsset).length, 1);
assert.equal(await equipment.select(settings), false);
assert.match(equipment.snapshot().error, /right-hand bone/);

await equipment.setModel(character);
const failed = equipment.select(settings);
pending.shift().reject(new Error('fixture missing asset'));
assert.equal(await failed, false);
assert.match(equipment.snapshot().error, /Reset grip/);
assert.equal(equipment.snapshot().loading, false);
const loadedAsset = new THREE.Group();
const restoredSettings = JSON.parse(JSON.stringify({ ...settings, sizePercent: 145, position: [0.02, 0.06, 0.01], rotation: [10, -80, 7] }));
const retry = equipment.select(restoredSettings);
pending.shift().resolve(loadedAsset);
assert.equal(await retry, true);
assert.equal(equipment.snapshot().attached, true);
assert.deepEqual(equipment.snapshot().settings, restoredSettings, 'Workspace values survive a save/restore round trip');
const outside = equipment.snapshot();
outside.settings.position[0] = 9;
assert.equal(equipment.snapshot().settings.position[0], 0.02, 'Diagnostics do not expose mutable transforms');
await equipment.select({ rightHand: 'none' });
assert.equal(equipment.snapshot().attached, false);
assert.equal(disposed.filter(object => object === loadedAsset).length, 1);
const late = equipment.select(settings);
equipment.dispose();
const changesBefore = changes;
const lateAsset = new THREE.Group();
pending.shift().resolve(lateAsset);
assert.equal(await late, false);
assert.equal(changes, changesBefore);
assert.equal(lateAsset.parent, null);
assert.equal(disposed.filter(object => object === lateAsset).length, 1);

// Exercise the production boundary, including a synthetic change event on a
// disabled control, so a partial sheet cannot silently mix equipment states.
const studio = fs.readFileSync(new URL('../js/3d-studio.mjs', import.meta.url), 'utf8');
const extract = (start, end) => studio.slice(studio.indexOf(start), studio.indexOf(end, studio.indexOf(start)));
const locked = vm.createContext({
  state: { modelReady: true }, poseCapture: { snapshot: () => ({ captureCount: 6 }) },
  equipment: { select: () => { throw new Error('Equipment must remain locked'); } }, updateEquipmentControls() {}
});
vm.runInContext(extract('async function changeEquipment(', '\nfunction setModelReady('), locked);
await vm.runInContext('changeEquipment({ rightHand: "medieval-sword" })', locked);
for (const gear of [{ loading: true, settings }, { loading: false, attached: false, settings, error: 'Sword unavailable' }]) {
  const capture = vm.createContext({ state: { modelReady: true, model: {} }, equipment: { snapshot: () => gear } });
  vm.runInContext(extract('function readCapturePose(', '\nfunction renderPreviews('), capture);
  assert.throws(() => vm.runInContext('readCapturePose()', capture), /finish loading|Sword unavailable/);
}

console.log('Studio weapon integrity, animated sword grip (4 clips × 6 facings), workspace settings, capture locks and loading/disposal races passed.');
