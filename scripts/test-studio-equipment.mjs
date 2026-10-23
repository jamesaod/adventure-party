import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {
  HELD_WEAPON_AXIS, STUDIO_WEAPONS, normalizeEquipment, findRightHand, findLeftHand as findEquipmentLeftHand,
  findLeftForeArm, findLeftArm, findLeftShoulder, findUpperSpine, findLowerSpine, findHips, solveTwoHandedGrip, createWeaponAttachment, createStudioEquipment
} from '../js/studio-equipment.mjs';
import {
  STUDIO_SHIELDS, SHIELD_MODEL_UNITS_PER_INCH, normalizeShield, findLeftHand, leftForearmAxisLocal,
  createShieldAttachment
} from '../js/studio-shield.mjs';

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
assert.equal(STUDIO_WEAPONS.length, 3, 'Sword, Battle Axe, and Two-Handed Sword are registered');
const heldAxis = new THREE.Vector3(...HELD_WEAPON_AXIS).normalize();
for (const weapon of STUDIO_WEAPONS) {
  const axis = new THREE.Vector3(...weapon.primaryAxis).normalize();
  const rotation = new THREE.Euler(...weapon.rotation.map(value => THREE.MathUtils.degToRad(value)), 'XYZ');
  axis.applyEuler(rotation).normalize();
  assert.ok(axis.angleTo(heldAxis) < THREE.MathUtils.degToRad(1),
    `${weapon.label} longitudinal axis must align to the shared hand-held direction`);
}
assert.equal(STUDIO_WEAPONS[1].defaultSizePercent, 100, 'Battle Axe UI default remains 100%');
assert.deepEqual(STUDIO_WEAPONS[1].primaryAxis, [4, 5, 0], 'Battle Axe longitudinal axis follows the haft, not the cutting edge');
assert.deepEqual(STUDIO_WEAPONS[1].rotation, [-129, -90, 0], 'Battle Axe keeps the shaft axis but rolls the cutting edge 180 degrees');
assert.deepEqual(STUDIO_WEAPONS[1].grip, [-0.36, 0.15, 0], 'Battle Axe grip lands on the lower diagonal wooden haft');
assert.equal(STUDIO_WEAPONS[1].nativeScale, 0.4125, 'Battle Axe 100% UI size is 75% of the original 0.55 base scale');
assert.equal(STUDIO_WEAPONS[2].id,'medieval-two-handed-sword');
assert.equal(STUDIO_WEAPONS[2].poseProfileId,'two-handed-swing');
assert.equal(STUDIO_WEAPONS[2].handsRequired,2);
assert.deepEqual(STUDIO_WEAPONS[2].grip,[0,0.81,0]);
assert.deepEqual(STUDIO_WEAPONS[2].secondaryGrip,[0,0.95,0]);
assert.deepEqual(STUDIO_WEAPONS[2].primaryAxis,[0,-1,0]);
assert.deepEqual(STUDIO_WEAPONS[2].rotation,[90,0,0]);
assert.equal(STUDIO_WEAPONS[2].nativeScale,0.78);

// Focused two-handed pose fixture: the authored pose starts with the arm
// crossing the torso and open fingers. The body-aware pass should involve the
// torso/shoulder, keep the off-hand on the secondary grip, and close the fingers.
{
  const ikModel = new THREE.Group();
  const hips = new THREE.Bone(); hips.name = 'mixamorigHips'; hips.position.set(0,0,0);
  const lowerSpine = new THREE.Bone(); lowerSpine.name = 'mixamorigSpine'; lowerSpine.position.set(0,0.28,0);
  const spine = new THREE.Bone(); spine.name = 'mixamorigSpine2'; spine.position.set(0,0.28,0);
  const shoulder = new THREE.Bone(); shoulder.name = 'mixamorigLeftShoulder'; shoulder.position.set(0.18,0.45,0);
  const upper = new THREE.Bone(); upper.name = 'mixamorigLeftArm'; upper.position.set(0.18,0,0);
  const fore = new THREE.Bone(); fore.name = 'mixamorigLeftForeArm'; fore.position.set(0.75,-0.12,0);
  const offHand = new THREE.Bone(); offHand.name = 'mixamorigLeftHand'; offHand.position.set(0.68,-0.08,0);
  const fingerRoots={Index:[0.13,0.045,0],Middle:[0.14,0.015,0],Ring:[0.135,-0.015,0],Pinky:[0.12,-0.045,0]};
  for(const fingerName of ['Index','Middle','Ring','Pinky']){
    const b1=new THREE.Bone(); b1.name=`mixamorigLeftHand${fingerName}1`; b1.position.set(...fingerRoots[fingerName]);
    const b2=new THREE.Bone(); b2.name=`mixamorigLeftHand${fingerName}2`; b2.position.set(0.10,0,0);
    const b3=new THREE.Bone(); b3.name=`mixamorigLeftHand${fingerName}3`; b3.position.set(0.08,0,0);
    b2.add(b3); b1.add(b2); offHand.add(b1);
  }
  const thumb1=new THREE.Bone(); thumb1.name='mixamorigLeftHandThumb1'; thumb1.position.set(0.08,-0.04,0.02);
  const thumb2=new THREE.Bone(); thumb2.name='mixamorigLeftHandThumb2'; thumb2.position.set(0.08,0,0);
  const thumb3=new THREE.Bone(); thumb3.name='mixamorigLeftHandThumb3'; thumb3.position.set(0.06,0,0);
  thumb2.add(thumb3); thumb1.add(thumb2); offHand.add(thumb1);
  fore.add(offHand); upper.add(fore); shoulder.add(upper); spine.add(shoulder); lowerSpine.add(spine); hips.add(lowerSpine); ikModel.add(hips);

  const weaponModel = new THREE.Group(); weaponModel.position.set(0.95,0.9,0.35);
  const fixtureAttachment = {
    model: weaponModel,
    weapon: { handsRequired: 2, secondaryGrip: [0,0,0] }
  };
  ikModel.updateWorldMatrix(true,true);
  const middle1=offHand.children.find(child=>child.name.endsWith('Middle1'));
  const before = offHand.localToWorld(middle1.position.clone()).distanceTo(weaponModel.getWorldPosition(new THREE.Vector3()));
  const shoulderBefore=shoulder.quaternion.clone(), spineBefore=spine.quaternion.clone(), lowerSpineBefore=lowerSpine.quaternion.clone(), hipsBefore=hips.quaternion.clone();
  const indexBefore=offHand.children.find(child=>child.name.endsWith('Index1')).quaternion.clone();

  const result = solveTwoHandedGrip(THREE,{model:ikModel,attachment:fixtureAttachment,iterations:40,tolerance:0.006,maxStepDegrees:60});
  const after = offHand.localToWorld(middle1.position.clone()).distanceTo(weaponModel.getWorldPosition(new THREE.Vector3()));

  assert.equal(findEquipmentLeftHand(ikModel),offHand);
  assert.equal(findLeftForeArm(ikModel),fore);
  assert.equal(findLeftArm(ikModel),upper);
  assert.equal(findLeftShoulder(ikModel),shoulder);
  assert.equal(findUpperSpine(ikModel),spine);
  assert.equal(findLowerSpine(ikModel),lowerSpine);
  assert.equal(findHips(ikModel),hips);
  assert.ok(after < before * 0.15,`Two-handed pose should close the off-hand gap: ${before} -> ${after}`);
  assert.ok(result.solved,`Two-handed IK should meet grip tolerance; remaining error ${result.error}`);
  assert.equal(result.bodyPose.applied,true,'Body-aware two-handed pose participates before final grip solve');
  assert.ok(shoulder.quaternion.angleTo(shoulderBefore)>1e-4,'Left shoulder participates in the reach');
  assert.ok(spine.quaternion.angleTo(spineBefore)>1e-5,'Upper torso participates subtly in the two-handed pose');
  assert.ok(lowerSpine.quaternion.angleTo(lowerSpineBefore)>1e-6,'Lower spine participates subtly in the two-handed pose');
  assert.ok(hips.quaternion.angleTo(hipsBefore)>1e-7,'Pelvis participates subtly in the two-handed pose');
  assert.equal(result.fingerGrip.wristOrientation.applied,true,'Wrist is oriented to the hilt before finger IK');
  assert.ok(Number.isFinite(result.fingerGrip.wristOrientation.angleDegrees),'Wrist orientation reports a finite correction angle');
  assert.ok(result.fingerBonesCurled>=10,'Finger IK adjusts the hand around the hilt after wrist alignment');
  assert.equal(result.fingerGrip.fingertips.length,5,'Four fingers and thumb report final grip distances');
  assert.ok(result.fingerGrip.fingertips.every(entry=>Number.isFinite(entry.distanceToGrip)),
    'Every left-hand fingertip resolves to a finite hilt distance');
  assert.ok(offHand.children.find(child=>child.name.endsWith('Index1')).quaternion.angleTo(indexBefore)>0.05,
    'Left index finger visibly moves as part of the hilt wrap');
}
// Rev 80 regression: procedural two-handed corrections must be temporary.
// Restoring before the next animation evaluation must return every modified
// bone to the exact authored quaternion, and a second pass must not drift.
{
  const rig = new THREE.Group();
  const hips = new THREE.Bone(); hips.name='mixamorigHips';
  const spine = new THREE.Bone(); spine.name='mixamorigSpine'; spine.position.set(0,0.25,0);
  const spine2 = new THREE.Bone(); spine2.name='mixamorigSpine2'; spine2.position.set(0,0.25,0);
  const shoulder = new THREE.Bone(); shoulder.name='mixamorigLeftShoulder'; shoulder.position.set(0.2,0.35,0);
  const arm = new THREE.Bone(); arm.name='mixamorigLeftArm'; arm.position.set(0.2,0,0);
  const fore = new THREE.Bone(); fore.name='mixamorigLeftForeArm'; fore.position.set(0.65,0,0);
  const hand = new THREE.Bone(); hand.name='mixamorigLeftHand'; hand.position.set(0.6,0,0);
  const middle = new THREE.Bone(); middle.name='mixamorigLeftHandMiddle1'; middle.position.set(0.12,0,0);
  hand.add(middle); fore.add(hand); arm.add(fore); shoulder.add(arm); spine2.add(shoulder); spine.add(spine2); hips.add(spine); rig.add(hips);
  const right = new THREE.Bone(); right.name='mixamorigRightHand'; right.position.set(0.85,0.9,0.2); rig.add(right);

  const manager=createStudioEquipment({
    THREE,
    loadAsset:async()=>new THREE.Group(),
    disposeObject:()=>{}
  });
  await manager.setModel(rig,{rightHand:'medieval-two-handed-sword'});
  const watched=[hips,spine,spine2,shoulder,arm,fore,hand,middle];
  const authored=watched.map(bone=>bone.quaternion.clone());
  manager.applyConstraints();
  const corrected=watched.map(bone=>bone.quaternion.clone());
  assert.ok(corrected.some((q,i)=>q.angleTo(authored[i])>1e-6),'Two-handed pass must actually modify the authored pose');
  assert.equal(manager.restoreConstraints(),true,'A corrected pose reports that it was restored');
  watched.forEach((bone,i)=>assert.ok(bone.quaternion.angleTo(authored[i])<1e-12,'Restore returns exact authored quaternion'));
  manager.applyConstraints();
  manager.restoreConstraints();
  watched.forEach((bone,i)=>assert.ok(bone.quaternion.angleTo(authored[i])<1e-12,'Repeated IK passes do not accumulate drift'));
  manager.dispose();
}

const migratedAxe = normalizeEquipment({
  rightHand:'battle-axe', presetRevision:4, sizePercent:100,
  position:[0.015,0.05,0.005], rotation:[-51,90,0]
});
assert.equal(migratedAxe.sizePercent,100,'Rev 66 saved axe size remains at the approved 100% UI default');
assert.deepEqual(migratedAxe.rotation,[-129,-90,0],'Rev 66 axe migrates to the 180-degree blade roll without changing shaft alignment');
assert.equal(migratedAxe.presetRevision,5);
assert.equal(STUDIO_SHIELDS.length,1);
assert.equal(STUDIO_SHIELDS[0].id,'round-wooden-shield');
assert.equal(STUDIO_SHIELDS[0].sourceSha256,'4a0bad4a77b3e5a086576b00e8890ef5f0c2417ea423559ef7196acd8a488928');
assert.equal(STUDIO_SHIELDS[0].representation,'source-gltf-v1');
assert.equal(STUDIO_SHIELDS[0].assetSha256,'4a0bad4a77b3e5a086576b00e8890ef5f0c2417ea423559ef7196acd8a488928');
assert.deepEqual(STUDIO_SHIELDS[0].position,[0,0,0.04],'Shield remains outside the left arm but is pulled close to the forearm');
assert.deepEqual(STUDIO_SHIELDS[0].rotation,[0,0,0],'Shield keeps the Rev 68 outward-facing orientation');
const migratedShield=normalizeShield({
  leftHandShield:'bronze-round-shield',presetRevision:3,sizePercent:100,
  position:[0,0,0.04],rotation:[0,0,0]
});
assert.equal(migratedShield.leftHandShield,'round-wooden-shield','Legacy bronze QA selection migrates to the wooden shield');
assert.deepEqual(migratedShield.position,[0,0,0.04],'Approved Rev 69 shield base mount is preserved');
assert.deepEqual(migratedShield.rotation,[0,0,0],'Approved shield orientation is preserved');
assert.equal(migratedShield.presetRevision,4);
const tunedShield=normalizeShield({
  leftHandShield:'round-wooden-shield',
  distanceInches:2.25,forearmSlideInches:3.5,forearmRollDegrees:-37
});
assert.equal(tunedShield.distanceInches,2.25);
assert.equal(tunedShield.forearmSlideInches,3.5);
assert.equal(tunedShield.forearmRollDegrees,-37);
assert.equal(normalizeShield({leftHandShield:'round-wooden-shield',distanceInches:99}).distanceInches,6);
assert.equal(normalizeShield({leftHandShield:'round-wooden-shield',forearmSlideInches:-99}).forearmSlideInches,-8);
assert.equal(normalizeShield({leftHandShield:'round-wooden-shield',forearmRollDegrees:999}).forearmRollDegrees,180);
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
const twoHandedSword=glb(STUDIO_WEAPONS[2].file);
assert.equal(twoHandedSword.bytes.length,646456);
assert.equal(crypto.createHash('sha256').update(twoHandedSword.bytes).digest('hex'),
  '85408b9b17fa38a72816d57ac55e63e6409862b5d5a305beb6cf5eee045c948a');
assert.equal(twoHandedSword.json.meshes.length,1);
assert.equal(twoHandedSword.json.skins?.length||0,0);
assert.equal(twoHandedSword.json.animations?.length||0,0);
assert.equal(twoHandedSword.json.accessors[twoHandedSword.json.meshes[0].primitives[0].indices].count/3,8333);
assert.equal(twoHandedSword.json.accessors[twoHandedSword.json.meshes[0].primitives[0].attributes.POSITION].count,6623);
assert.equal(twoHandedSword.json.images.length,3);
const shieldAsset=glb(STUDIO_SHIELDS[0].file);
assert.equal(shieldAsset.bytes.length,781832);
assert.equal(crypto.createHash('sha256').update(shieldAsset.bytes).digest('hex'),STUDIO_SHIELDS[0].assetSha256);
assert.equal(shieldAsset.json.meshes.length,1);
assert.equal(shieldAsset.json.skins?.length||0,0);
assert.equal(shieldAsset.json.animations?.length||0,0);
assert.equal(shieldAsset.json.accessors[shieldAsset.json.meshes[0].primitives[0].indices].count/3,8478);
assert.equal(shieldAsset.json.accessors[shieldAsset.json.meshes[0].primitives[0].attributes.POSITION].count,5648);
assert.equal(shieldAsset.json.images.length,3);
assert.ok(shieldAsset.json.images.every(image=>Number.isInteger(image.bufferView)),'Wooden shield texture is embedded');
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
const leftHand = findLeftHand(character);
assert.equal(hand?.name, 'mixamorigRightHand');
assert.equal(leftHand?.name, 'mixamorigLeftHand');
hand.name = 'mixamorig:RightHand';
assert.equal(findRightHand(character), hand, 'Colon spelling is accepted');
hand.name = 'mixamorigRightHand';
const twoHandCalibration=normalizeEquipment({
  rightHand:'medieval-two-handed-sword',
  secondaryGripOffsetInches:[1.25,-2.5,0.75]
});
assert.deepEqual(twoHandCalibration.secondaryGripOffsetInches,[1.25,-2.5,0.75],
  '2H off-hand calibration survives normalization in inches');
const calibrationAsset=new THREE.Group();
const calibrationAttachment=createWeaponAttachment(THREE,hand,calibrationAsset,twoHandCalibration);
assert.deepEqual(calibrationAttachment.secondaryGripOffsetInches,[1.25,-2.5,0.75],
  'Weapon attachment carries live off-hand calibration offsets');
calibrationAttachment.update({...twoHandCalibration,secondaryGripOffsetInches:[-1,2,0.5]});
assert.deepEqual(calibrationAttachment.secondaryGripOffsetInches,[-1,2,0.5],
  'Off-hand calibration updates without moving the primary attachment');
calibrationAttachment.detach();

const settings = normalizeEquipment({ rightHand: 'medieval-sword' });
const attached = createWeaponAttachment(THREE, hand, swordModel, settings);
const gripPoint = new THREE.Vector3(...STUDIO_WEAPONS[0].grip);
const shieldSettings=normalizeShield({leftHandShield:'round-wooden-shield'});
const shieldForearmAxis=leftForearmAxisLocal(THREE,leftHand);
const shieldGeometry=new THREE.BufferGeometry();
shieldGeometry.setAttribute('position',new THREE.BufferAttribute(shieldAsset.accessor(
  shieldAsset.json.meshes[0].primitives[0].attributes.POSITION),3));
const shieldModel=new THREE.Group();
shieldModel.add(new THREE.Mesh(shieldGeometry));
const shieldCenter=new THREE.Vector3(...STUDIO_SHIELDS[0].modelOrigin);
const shieldAttached=createShieldAttachment(THREE,leftHand,shieldModel,shieldSettings);
const mixer = new THREE.AnimationMixer(character);
const visited = new Set(), shieldVisited = new Set();
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
      const expectedShield=leftHand.localToWorld(new THREE.Vector3(...shieldSettings.position));
      const actualShield=shieldModel.localToWorld(shieldCenter.clone());
      close(actualShield,expectedShield,`${animation.name}/${fraction}/facing${facing}: shield remains centered on left-hand mount`);
      shieldVisited.add(actualShield.toArray().map(value=>value.toFixed(3)).join(','));
    }
  }
  mixer.stopAllAction();
}
assert.ok(visited.size > 30, 'The weapon really moves through the authored animations and six views');
assert.ok(shieldVisited.size > 30, 'The shield follows the animated left hand through the same poses and facings');

display.rotation.y=0;
display.updateMatrixWorld(true);
const forearmAxis=shieldForearmAxis.clone();
const outwardAxis=new THREE.Vector3(0,0,1)
  .addScaledVector(forearmAxis,-new THREE.Vector3(0,0,1).dot(forearmAxis));
if(outwardAxis.lengthSq()<1e-10)outwardAxis.set(0,1,0);
outwardAxis.normalize();
const interactiveShield=normalizeShield({
  ...shieldSettings,sizePercent:125,distanceInches:2,forearmSlideInches:3,forearmRollDegrees:45
});
shieldAttached.update(interactiveShield);
display.updateMatrixWorld(true);
const expectedInteractiveCenter=leftHand.localToWorld(new THREE.Vector3(...shieldSettings.position)
  .addScaledVector(outwardAxis,2*SHIELD_MODEL_UNITS_PER_INCH)
  .addScaledVector(forearmAxis,3*SHIELD_MODEL_UNITS_PER_INCH));
close(shieldModel.localToWorld(shieldCenter.clone()),expectedInteractiveCenter,
  'Shield sliders move relative to the approved base mount along arm-normal and forearm axes');
assert.equal(shieldAttached.socket.scale.x,STUDIO_SHIELDS[0].nativeScale*1.25,
  'Shield scale is a live percentage around the calibrated wooden-shield base');
const baseShieldRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,0,'XYZ'));
const expectedRoll=new THREE.Quaternion().setFromAxisAngle(forearmAxis,THREE.MathUtils.degToRad(45))
  .multiply(baseShieldRotation);
assert.ok(shieldAttached.socket.quaternion.angleTo(expectedRoll)<1e-6,
  'Shield roll rotates around the actual forearm axis');
shieldAttached.update(shieldSettings);
attached.detach();
shieldAttached.detach();
assert.equal(attached.socket.parent, null);
assert.equal(shieldAttached.socket.parent, null);

const weird = normalizeEquipment({ rightHand: 'unknown', sizePercent: Infinity, position: [NaN, 7, -4], rotation: [999] });
assert.equal(weird.rightHand, 'none');
assert.equal(weird.sizePercent, 100);
assert.deepEqual(weird.position, [0.015, 1, -1]);
assert.deepEqual(weird.rotation, [180, -90, 0]);
assert.deepEqual(weird.secondaryGripOffsetInches,[0,0,0]);

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
const restoredSettings = JSON.parse(JSON.stringify({ ...settings, sizePercent: 145, position: [0.02, 0.06, 0.01], rotation: [10, -80, 7], secondaryGripOffsetInches:[0.5,-0.75,1.25] }));
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
const posePanel=fs.readFileSync(new URL('../js/studio-weapon-pose-panel.mjs',import.meta.url),'utf8');
assert.ok(posePanel.includes("'medieval-two-handed-sword'"));
assert.ok(posePanel.includes("poseProfileId: 'two-handed-swing'"));
assert.ok(posePanel.includes("heightInches: snap.mobType === 'fighter' ? 76 : null"));
assert.ok(posePanel.includes("bodyReferenceHeightInches: snap.mobType === 'fighter' ? 76 : null"));
const studio = fs.readFileSync(new URL('../js/3d-studio.mjs', import.meta.url), 'utf8');
assert.equal((studio.match(/state\.mixer\.update\(/g)||[]).length,(studio.match(/equipment\.restoreConstraints\(\); state\.mixer\.update\(/g)||[]).length,
  'Every Studio mixer evaluation restores the pre-IK skeleton first');

assert.ok(studio.includes("selectedWeapon?.handsRequired === 2")&&studio.includes("shieldEquipment.select('none')"),
  'Selecting a two-handed weapon actively unequips the shield');
assert.ok(studio.includes("value!=='none'&&studioWeapon(equipment.snapshot().settings.rightHand)?.handsRequired===2")&&studio.includes("await equipment.select('none')"),
  'Equipping a shield actively removes an equipped two-handed weapon');
assert.ok(studio.includes("requestedWeapon?.handsRequired===2")&&studio.includes("leftHandShield:'none'"),
  'Workspace/model restore normalizes illegal two-handed weapon plus shield states');
assert.ok(studio.includes("Two-handed weapons and shields are mutually exclusive"),
  'Capture rejects an impossible two-handed weapon plus shield state');
const extract = (start, end) => studio.slice(studio.indexOf(start), studio.indexOf(end, studio.indexOf(start)));
const locked = vm.createContext({
  state: { modelReady: true }, poseCapture: { snapshot: () => ({ captureCount: 6 }) },
  equipment: { select: () => { throw new Error('Equipment must remain locked'); } }, updateEquipmentControls() {}
});
vm.runInContext(extract('async function changeEquipment(', '\nfunction setModelReady('), locked);
await vm.runInContext('changeEquipment({ rightHand: "medieval-sword" })', locked);
for (const gear of [{ loading: true, settings }, { loading: false, attached: false, settings, error: 'Sword unavailable' }]) {
  const capture = vm.createContext({
    state: { modelReady: true, model: {} },
    equipment: { snapshot: () => gear },
    shieldEquipment: { snapshot: () => ({ settings: { leftHandShield: 'none' }, attached: false, error: '' }) }
  });
  vm.runInContext(extract('function readCapturePose(', '\nfunction renderPreviews('), capture);
  assert.throws(() => vm.runInContext('readCapturePose()', capture), /finish loading|Sword unavailable/);
}

console.log('Studio weapon integrity, animated sword grip (4 clips × 6 facings), workspace settings, capture locks and loading/disposal races passed.');
