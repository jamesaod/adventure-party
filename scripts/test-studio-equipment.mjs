import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {
  HELD_WEAPON_AXIS, STUDIO_WEAPONS, weaponAssetUrl, findWeaponHand, normalizeEquipment, findRightHand, findLeftHand as findEquipmentLeftHand,
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
assert.equal(STUDIO_WEAPONS.length, 11, 'Existing equipment plus Sling are registered');
const heldAxis = new THREE.Vector3(...HELD_WEAPON_AXIS).normalize();
for (const weapon of STUDIO_WEAPONS.filter(weapon=>!['bow','crossbow','wizard-staff','sling'].includes(weapon.visualClass))) {
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
const mixerEvaluationCount=(studio.match(/state\.mixer\.update\(/g)||[]).length;
const inlineRestoreCount=(studio.match(/equipment\.restoreConstraints\(\); state\.mixer\.update\(/g)||[]).length;
assert.equal(mixerEvaluationCount-inlineRestoreCount,1,
  'Only setClip uses a function-level restore instead of the inline restore form');
const setClipStart=studio.indexOf('function setClip(index) {');
const setClipEnd=studio.indexOf('function updateAnimationControls()',setClipStart);
const setClipSource=studio.slice(setClipStart,setClipEnd);
assert.ok(setClipSource.indexOf('equipment.restoreConstraints();')>=0 &&
  setClipSource.indexOf('equipment.restoreConstraints();')<setClipSource.indexOf('state.mixer.update(0);'),
  'setClip restores the pre-IK skeleton before evaluating an authored animation');

assert.ok(studio.includes("selectedWeapon?.handsRequired === 2")&&studio.includes("shieldEquipment.select('none')"),
  'Selecting a two-handed weapon actively unequips the shield');
assert.ok(studio.includes("normalizeShield(value).leftHandShield!=='none'&&studioWeapon(equipment.snapshot().settings.rightHand)?.handsRequired===2")&&studio.includes("await equipment.select('none')"),
  'Equipping a shield actively removes an equipped two-handed weapon');
assert.ok(studio.includes("requestedWeapon?.handsRequired===2")&&studio.includes("leftHandShield:'none'"),
  'Workspace/model restore normalizes illegal two-handed weapon plus shield states');
assert.ok(studio.includes("Two-handed weapons and shields are mutually exclusive"),
  'Capture rejects an impossible two-handed weapon plus shield state');
const extract = (start, end) => studio.slice(studio.indexOf(start), studio.indexOf(end, studio.indexOf(start)));
// Changing equipment affects the next capture; prior frames retain their own
// captured loadout and remain available for export/combat.
let invalidations=0, selectionCount=0;
const editable = vm.createContext({
  state: { modelReady: true, modelLoading: false, disposed: false, model: {} },
  poseCapture: {
    snapshot: () => ({ captureCount: 6 }),
    invalidateCaptures: () => { invalidations++; },
    saveWorkspace() {}
  },
  equipment: { select: async () => { selectionCount++; return true; } },
  shieldEquipment: { snapshot: () => ({settings:{leftHandShield:'none'}}) },
  studioWeapon: () => ({handsRequired:1}),
  resetPreviewReferenceToReady() {},
  updateEquipmentControls() {}
});
vm.runInContext(extract('async function changeEquipment(', '\nfunction setModelReady('), editable);
await vm.runInContext('changeEquipment({rightHand:"medieval-sword"})', editable);
assert.equal(selectionCount,1,'Captured poses do not block equipment changes');
assert.equal(invalidations,0,'Equipment edits preserve earlier captured loadouts');
for (const gear of [{ loading: true, settings }, { loading: false, attached: false, settings, error: 'Sword unavailable' }]) {
  const capture = vm.createContext({
    state: { modelReady: true, model: {}, action: {} },
    equipment: { snapshot: () => gear },
    offHandEquipment: { snapshot: () => ({settings:{rightHand:'none'}}) },
    shieldEquipment: { snapshot: () => ({ settings: { leftHandShield: 'none' }, attached: false, error: '' }) }
  });
  vm.runInContext(extract('function readCapturePose(', '\nfunction renderPreviews('), capture);
  assert.throws(() => vm.runInContext('readCapturePose()', capture), /finish loading|Sword unavailable/);
}

console.log('Studio weapon integrity, animated sword grip (4 clips × 6 facings), workspace settings, capture locks and loading/disposal races passed.');

// Spear integration: real binary, packed 512px PBR maps and shared mount controls.
const spear = STUDIO_WEAPONS.find(weapon => weapon.id === 'spear');
assert.equal(spear.handsRequired, 2);
assert.equal(spear.poseProfileId, 'two-handed-thrust');
const spearAsset = glb(spear.file);
const spearMetadata = JSON.parse(fs.readFileSync(new URL('../assets/models/weapons/spears/spear.json', import.meta.url)));
assert.equal(spearAsset.bytes.length, spearMetadata.bytes);
assert.equal(crypto.createHash('sha256').update(spearAsset.bytes).digest('hex'), spearMetadata.sha256);
assert.equal(spearAsset.json.skins?.length || 0, 0);
assert.equal(spearAsset.json.animations?.length || 0, 0);
const spearTriangles = spearAsset.json.meshes.flatMap(mesh => mesh.primitives)
  .reduce((sum, primitive) => sum + spearAsset.json.accessors[primitive.indices].count / 3, 0);
assert.equal(spearTriangles, 512);
assert.ok(spearTriangles < spearMetadata.sourceTriangles);
const spearBinOffset = 28 + spearAsset.bytes.readUInt32LE(12);
assert.equal(spearAsset.json.images.length, 3);
for (const image of spearAsset.json.images) {
  assert.equal(image.mimeType, 'image/jpeg');
  const view = spearAsset.json.bufferViews[image.bufferView];
  const jpeg = spearAsset.bytes.subarray(spearBinOffset + (view.byteOffset || 0), spearBinOffset + (view.byteOffset || 0) + view.byteLength);
  assert.equal(jpeg.readUInt16BE(0), 0xffd8);
  let dimensions = null;
  for (let offset = 2; offset < jpeg.length;) {
    assert.equal(jpeg[offset], 0xff);
    const marker = jpeg[offset + 1], length = jpeg.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) { dimensions = [jpeg.readUInt16BE(offset + 7), jpeg.readUInt16BE(offset + 5)]; break; }
    offset += 2 + length;
  }
  assert.deepEqual(dimensions, [512, 512]);
}
const spearMaterial = spearAsset.json.materials[0];
assert.ok(spearMaterial.normalTexture && spearMaterial.occlusionTexture);
assert.ok(spearMaterial.pbrMetallicRoughness.baseColorTexture && spearMaterial.pbrMetallicRoughness.metallicRoughnessTexture);
const spearHand = new THREE.Bone(), spearModel = new THREE.Group();
const spearSettings = normalizeEquipment({rightHand:'spear'});
const spearMount = createWeaponAttachment(THREE, spearHand, spearModel, spearSettings);
close(spearModel.localToWorld(new THREE.Vector3(...spear.grip)), spearHand.localToWorld(new THREE.Vector3(...spear.position)), 'Spear grip pivot stays in the fist');
spearMount.update({...spearSettings, sizePercent:125, position:[0.02,0.03,0.04], rotation:[-75,10,5], secondaryGripOffsetInches:[1,-2,0.5]});
assert.ok(Math.abs(spearMount.socket.scale.x - spear.nativeScale * 1.25) < 1e-10);
assert.deepEqual(spearMount.secondaryGripOffsetInches, [1,-2,0.5]);
assert.deepEqual(spearMount.socket.position.toArray(), [0.02,0.03,0.04]);
assert.equal(normalizeEquipment({...spearSettings,sizePercent:125}).sizePercent,125);
spearMount.detach();
console.log('PASS spear: reduced binary, 512px PBR maps, 2H Stab mapping and adjustable shared mount');

let spearShieldRemovals = 0;
const spearSelection = vm.createContext({
  state:{modelReady:true,modelLoading:false,disposed:false,model:{}},
  studioWeapon: id => STUDIO_WEAPONS.find(weapon => weapon.id === id),
  equipment:{select:async () => true},
  offHandEquipment:{select:async()=>true},
  shieldEquipment:{snapshot:() => ({settings:{leftHandShield:'round-wooden-shield'}}),
    select:async value => {assert.equal(value,'none');spearShieldRemovals++;}},
  poseCapture:{invalidateCaptures(){},saveWorkspace(){}},
  resetPreviewReferenceToReady(){},updateEquipmentControls(){}
});
vm.runInContext(extract('async function changeEquipment(', '\nfunction setModelReady('), spearSelection);
await vm.runInContext('changeEquipment({rightHand:"spear"})', spearSelection);
assert.equal(spearShieldRemovals,1,'Normalized spear settings clear the shield through the shared selection path');

// Color-only updates refresh the HTTP cache without resetting approved grips.
assert.equal(spear.assetSha256, spearMetadata.sha256);
assert.equal(weaponAssetUrl(spear, 'https://example.test/candidate/').searchParams.get('v'), spearMetadata.sha256);
assert.equal(weaponAssetUrl(STUDIO_WEAPONS[0], 'https://example.test/candidate/').search, '');
const savedSpearGrip = {rightHand:'spear',presetRevision:1,sizePercent:125,position:[0.02,0.03,0.04],rotation:[-75,10,5],secondaryGripOffsetInches:[1,-2,0.5]};
assert.deepEqual(normalizeEquipment(savedSpearGrip), {version:3,...savedSpearGrip,shaftRollDegrees:0});

// Bow selection uses the same manager with a left-hand mount, without applying
// the melee secondary-grip solver to the archer's draw hand.
const bow = STUDIO_WEAPONS.find(weapon => weapon.id === 'recurve-bow');
assert.equal(bow.attachmentHand,'left');
assert.equal(bow.poseProfileId,'bow');
assert.equal(bow.handsRequired,2);
assert.equal(bow.secondaryGrip,undefined);
const bowRig = new THREE.Group(), bowLeft = new THREE.Bone(), bowRight = new THREE.Bone();
bowLeft.name='mixamorigLeftHand'; bowRight.name='mixamorigRightHand';
bowLeft.position.set(0.2,0.7,0.3);bowRight.position.set(-0.2,0.7,0.3);bowRig.add(bowLeft,bowRight);
assert.equal(findWeaponHand(bowRig,bow),bowLeft);
assert.equal(findWeaponHand(bowRig,STUDIO_WEAPONS[0]),bowRight);
const material = new THREE.MeshPhysicalMaterial({transmission:0.0869565,metalness:0.4782609,roughness:1});
const colorMap = new THREE.Texture();material.map=colorMap;
const bowModel = new THREE.Group();bowModel.add(new THREE.Mesh(new THREE.BoxGeometry(),material));
const bowManager=createStudioEquipment({THREE,loadAsset:async()=>bowModel,disposeObject:()=>{}});
assert.equal(await bowManager.setModel(bowRig,{rightHand:'recurve-bow'}),true);
assert.equal(bowManager.snapshot().attachmentHandBone,bowLeft.name);
assert.ok(bowLeft.children.some(object=>object.name==='StudioLeftHandEquipment'));
assert.equal(bowRight.children.length,0);
assert.equal(material.transmission,0,'Bow transmission must not corrupt scissored pixel atlas tiles');
assert.equal(material.map,colorMap,'Opaque compatibility override preserves texture identity');
assert.equal(material.metalness,0.4782609);
assert.equal(bowManager.applyConstraints().active,false,'Bow does not apply the melee off-hand IK');
const bowSettings=bowManager.snapshot().settings;
await bowManager.select({...bowSettings,sizePercent:125,position:[0.03,0.04,0.05],rotation:[170,15,-90]});
bowRig.updateWorldMatrix(true,true);
close(bowModel.localToWorld(new THREE.Vector3(...bow.grip)),bowLeft.localToWorld(new THREE.Vector3(0.03,0.04,0.05)),'Adjusted bow grip stays in the left palm');
assert.equal(bowManager.snapshot().settings.sizePercent,125);
bowManager.dispose();assert.equal(bowLeft.children.length,0);
const bowOnlyLeftRig=new THREE.Group(),onlyLeft=new THREE.Bone();onlyLeft.name='mixamorigLeftHand';bowOnlyLeftRig.add(onlyLeft);
const leftOnlyManager=createStudioEquipment({THREE,loadAsset:async()=>new THREE.Group(),disposeObject:()=>{}});
assert.equal(await leftOnlyManager.setModel(bowOnlyLeftRig,{rightHand:'recurve-bow'}),true,'Bow requires the left hand, not an unrelated right-hand bone');
assert.equal(await leftOnlyManager.select({rightHand:'medieval-sword'}),false);
assert.match(leftOnlyManager.snapshot().error,/right-hand bone/);leftOnlyManager.dispose();
const bowReference=JSON.parse(fs.readFileSync(new URL('./fixtures/carl-uploaded-animation-reference.json',import.meta.url)));
const bowHandQuaternion=bowReference.clips.find(clip=>clip.id==='standing-aim-recoil').frames[0].worldQuaternions.LeftHand;
const bowAxis=new THREE.Vector3(...bow.primaryAxis).applyEuler(new THREE.Euler(...bow.rotation.map(THREE.MathUtils.degToRad),'XYZ')).applyQuaternion(new THREE.Quaternion(...bowHandQuaternion).normalize());
assert.ok(bowAxis.angleTo(new THREE.Vector3(0,1,0))<THREE.MathUtils.degToRad(1),'Bow stands upright in the independently recovered aim pose');
console.log('PASS bow: left-hand mount, adjustable grip, retained textures, opaque atlas compatibility and authored draw-arm pose');

let selectedBowClip=-1,bowShieldRemovals=0;
const bowSelection=vm.createContext({
  state:{modelReady:true,modelLoading:false,disposed:false,model:{},clips:[{userData:{}},{userData:{actionProfiles:['bow']}}]},
  studioWeapon:id=>STUDIO_WEAPONS.find(weapon=>weapon.id===id),
  equipment:{select:async()=>true},
  offHandEquipment:{select:async()=>true},
  shieldEquipment:{snapshot:()=>({settings:{leftHandShield:'round-wooden-shield'}}),select:async value=>{assert.equal(value,'none');bowShieldRemovals++;}},
  poseCapture:{invalidateCaptures(){},saveWorkspace(){}},
  resetPreviewReferenceToReady(){},updateEquipmentControls(){},setClip:index=>{selectedBowClip=index;}
});
vm.runInContext(extract('async function changeEquipment(', '\nfunction setModelReady('),bowSelection);
await vm.runInContext('changeEquipment({rightHand:"recurve-bow"})',bowSelection);
assert.equal(selectedBowClip,1,'Selecting bow chooses the uploaded bow animation by its existing action-profile association');
assert.equal(bowShieldRemovals,1);

// The crossbow shares the right-hand attachment while retaining the authored support-hand pose.
const crossbow=STUDIO_WEAPONS.find(weapon=>weapon.id==='crossbow');
assert.equal(crossbow.poseProfileId,'direct-fire');assert.equal(crossbow.handsRequired,2);
assert.equal(findWeaponHand(bowRig,crossbow),bowRight);
assert.equal(crossbow.secondaryGrip,undefined,'Ranged aim retains the authored support hand instead of melee body/hand IK');
const crossbowSettings=normalizeEquipment({rightHand:'crossbow'}),crossbowModel=new THREE.Group();
const crossbowAttachment=createWeaponAttachment(THREE,bowRight,crossbowModel,crossbowSettings);
crossbowAttachment.update({...crossbowSettings,sizePercent:120,position:[.03,.04,.05],rotation:[-82,32,4],secondaryGripOffsetInches:[1,-.5,.25]});
bowRig.updateMatrixWorld(true);
close(crossbowModel.localToWorld(new THREE.Vector3(...crossbow.grip)),bowRight.localToWorld(new THREE.Vector3(.03,.04,.05)),'Crossbow adjustable pivot stays at the right hand');
assert.deepEqual(crossbowAttachment.secondaryGripOffsetInches,[1,-.5,.25]);
assert.equal(solveTwoHandedGrip(THREE,{model:bowRig,attachment:crossbowAttachment}).active,false);
crossbowAttachment.detach();assert.equal(bowRight.children.length,0);
selectedBowClip=-1;bowShieldRemovals=0;
vm.runInContext("state.clips=[{userData:{actionProfiles:['bow']}},{userData:{actionProfiles:['direct-fire']}}]",bowSelection);
await vm.runInContext('changeEquipment({rightHand:"crossbow"})',bowSelection);
assert.equal(selectedBowClip,1,'Crossbow selects the uploaded direct-fire clip, not the bow clip');
assert.equal(bowShieldRemovals,1);
const crossbowHandQuaternion=bowReference.clips.find(clip=>clip.id==='rifle-aim-to-down').frames[0].worldQuaternions.RightHand;
const crossbowUp=new THREE.Vector3(0,1,0).applyEuler(new THREE.Euler(...crossbow.rotation.map(THREE.MathUtils.degToRad),'XYZ')).applyQuaternion(new THREE.Quaternion(...crossbowHandQuaternion).normalize());
assert.ok(crossbowUp.angleTo(new THREE.Vector3(0,1,0))<THREE.MathUtils.degToRad(1),'Crossbow limbs stay level in the recovered rifle aim pose');
assert.equal(crypto.createHash('sha256').update(glb(crossbow.file).bytes).digest('hex'),crossbow.assetSha256);
console.log('PASS crossbow: right-hand mounting, tunable scale/grip, level aim, shield clearing and direct-fire animation selection');

// The batch uses the same right-hand mount, pose selection and cache identity.
for (const [id,profile,hands] of [['wooden-staff','two-handed-swing',2],['short-sword','one-handed-thrust',1],['dagger','one-handed-thrust',1]]) {
  const weapon=STUDIO_WEAPONS.find(entry=>entry.id===id);
  assert.equal(weapon.poseProfileId,profile);assert.equal(weapon.handsRequired,hands);
  assert.equal(findWeaponHand(bowRig,weapon),bowRight);
  assert.equal(Boolean(weapon.secondaryGrip),hands===2);
  const settings=normalizeEquipment({rightHand:id}),model=new THREE.Group();
  const mount=createWeaponAttachment(THREE,bowRight,model,settings);
  mount.update({...settings,sizePercent:115,position:[.02,.06,-.01],rotation:[-75,8,6],secondaryGripOffsetInches:[1,-.5,.25]});
  bowRig.updateMatrixWorld(true);
  close(model.localToWorld(new THREE.Vector3(...weapon.grip)),bowRight.localToWorld(new THREE.Vector3(.02,.06,-.01)),id+' adjusted grip stays in palm');
  assert.ok(Math.abs(mount.socket.scale.x-weapon.nativeScale*1.15)<1e-10);
  assert.deepEqual(mount.secondaryGripOffsetInches,[1,-.5,.25]);
  mount.detach();assert.equal(bowRight.children.length,0);
  selectedBowClip=-1;bowShieldRemovals=0;
  vm.runInContext(`state.clips=[{userData:{actionProfiles:['bow']}},{userData:{actionProfiles:['${profile}']}}]`,bowSelection);
  await vm.runInContext(`changeEquipment({rightHand:'${id}'})`,bowSelection);
  assert.equal(selectedBowClip,1,id+' selects its uploaded animation profile');
  assert.equal(bowShieldRemovals,hands===2?1:0,id+' handles shields by hand requirement');
  assert.equal(crypto.createHash('sha256').update(glb(weapon.file).bytes).digest('hex'),weapon.assetSha256);
  assert.equal(weaponAssetUrl(weapon,'https://example.test/candidate/').searchParams.get('v'),weapon.assetSha256);
}
console.log('PASS equipment batch: shared adjustable mounts, animation selection, shield compatibility and cache hashes');

// Wizard staff is a separate one-handed grip/profile over the exact staff GLB.
const wizardStaff=STUDIO_WEAPONS.find(weapon=>weapon.id==='wizard-staff-grip');
const woodenStaff=STUDIO_WEAPONS.find(weapon=>weapon.id==='wooden-staff');
assert.equal(wizardStaff.file,woodenStaff.file);assert.equal(wizardStaff.assetSha256,woodenStaff.assetSha256);
assert.equal(wizardStaff.handsRequired,1);assert.equal(wizardStaff.secondaryGrip,undefined);
assert.equal(wizardStaff.poseProfileId,'wizard-staff-grip');
const wizardRig=new THREE.Group(),wizardRight=new THREE.Bone(),wizardLeft=new THREE.Bone(),wizardSpine=new THREE.Bone();
wizardRight.name='mixamorigRightHand';wizardLeft.name='mixamorigLeftHand';wizardSpine.name='mixamorigSpine';
wizardLeft.rotation.set(.3,.4,.5);wizardSpine.rotation.set(.1,.2,.3);wizardRig.add(wizardRight,wizardLeft,wizardSpine);
const wizardPoses=[wizardLeft.quaternion.clone(),wizardSpine.quaternion.clone()];
const wizardModel=new THREE.Group(),wizardManager=createStudioEquipment({THREE,loadAsset:async()=>wizardModel,disposeObject:()=>{}});
assert.equal(await wizardManager.setModel(wizardRig,{rightHand:'wizard-staff-grip'}),true);
assert.equal(wizardManager.snapshot().attachmentHandBone,wizardRight.name);
assert.equal(wizardManager.applyConstraints().active,false,'Wizard grip leaves the off hand and body pose untouched');
assert.ok(wizardLeft.quaternion.equals(wizardPoses[0])&&wizardSpine.quaternion.equals(wizardPoses[1]));
const wizardSettings={...wizardManager.snapshot().settings,sizePercent:115,position:[.02,.06,-.01],rotation:[-70,-30,45]};
await wizardManager.select(wizardSettings);wizardRig.updateWorldMatrix(true,true);
close(wizardModel.localToWorld(new THREE.Vector3(...wizardStaff.grip)),wizardRight.localToWorld(new THREE.Vector3(.02,.06,-.01)),'Wizard staff keeps its adjustable pivot in the right palm');
assert.deepEqual(normalizeEquipment(wizardSettings),wizardManager.snapshot().settings);
wizardManager.dispose();assert.equal(wizardRight.children.length,0);
selectedBowClip=-1;bowShieldRemovals=0;
vm.runInContext("state.clips=[{userData:{actionProfiles:['two-handed-swing']}},{userData:{actionProfiles:['one-handed-swing','wizard-staff-grip']}}]",bowSelection);
await vm.runInContext('changeEquipment({rightHand:"wizard-staff-grip"})',bowSelection);
assert.equal(selectedBowClip,1);assert.equal(bowShieldRemovals,0,'One-handed wizard grip permits a shield');
const wizardHandQuaternion=bowReference.clips.find(clip=>clip.id==='sword-and-shield-idle').frames[0].worldQuaternions.RightHand;
const wizardAxis=new THREE.Vector3(...wizardStaff.primaryAxis).applyEuler(new THREE.Euler(...wizardStaff.rotation.map(THREE.MathUtils.degToRad),'XYZ')).applyQuaternion(new THREE.Quaternion(...wizardHandQuaternion).normalize());
assert.ok(wizardAxis.angleTo(new THREE.Vector3(0,1,0))<THREE.MathUtils.degToRad(.01),'Wizard staff starts upright in the independently recovered uploaded idle pose');
for(const id of ['short-sword','dagger']){
 const weapon=STUDIO_WEAPONS.find(entry=>entry.id===id);
 assert.equal(glb(weapon.file).json.materials[0].pbrMetallicRoughness.metallicFactor,.25);
 const preserved={...normalizeEquipment({rightHand:id}),sizePercent:120,position:[.01,.02,.03],rotation:[-75,10,5]};
 assert.deepEqual(normalizeEquipment(preserved),preserved,'Material refresh preserves saved grips');
}
console.log('PASS wizard staff: shared GLB, one-handed independent profile, upright idle, free off hand, shield compatibility and adjustable grip');

// Sling retains the shared adjustable mount and leaves both arm poses authored.
const sling=STUDIO_WEAPONS.find(w=>w.id==='sling');
assert.equal(sling.handsRequired,1);assert.equal(sling.poseProfileId,'sling');assert.equal(sling.secondaryGrip,undefined);
const slingAsset=glb(sling.file);assert.equal(crypto.createHash('sha256').update(slingAsset.bytes).digest('hex'),sling.assetSha256);
const slingReference=JSON.parse(fs.readFileSync(new URL('./fixtures/sling-over-shoulder-reference.json',import.meta.url)));
const slingFrame=slingReference.clips[0].frames[0];assert.equal(sling.previewPose.timeSeconds,slingFrame.timeSeconds);
const slingDown=new THREE.Vector3(0,-1,0).applyEuler(new THREE.Euler(...sling.rotation.map(THREE.MathUtils.degToRad),'XYZ')).applyQuaternion(new THREE.Quaternion(...slingFrame.worldQuaternions.RightHand).normalize());
assert.ok(slingDown.angleTo(new THREE.Vector3(0,-1,0))<THREE.MathUtils.degToRad(.01),'Pouch hangs vertically in the independently recovered over-shoulder pose');
const slingRig=wizardRig.clone(),slingModel=new THREE.Group(),slingManager=createStudioEquipment({THREE,loadAsset:async()=>slingModel,disposeObject:()=>{}});
const armBefore=slingRig.children.map(o=>o.quaternion.clone());
assert.equal(await slingManager.setModel(slingRig,{rightHand:'sling'}),true);
assert.equal(slingManager.applyConstraints().active,false);
assert.ok(slingRig.children.every((o,i)=>o.quaternion.equals(armBefore[i])));
const slingCustom={...slingManager.snapshot().settings,sizePercent:120,position:[.02,.03,.04],rotation:[95,70,-120]};
await slingManager.select(slingCustom);slingRig.updateWorldMatrix(true,true);
close(slingModel.localToWorld(new THREE.Vector3(...sling.grip)),slingRig.children[0].localToWorld(new THREE.Vector3(.02,.03,.04)),'Sling grip remains in palm under custom scale/rotation/offset');
assert.deepEqual(normalizeEquipment(slingCustom),slingManager.snapshot().settings);slingManager.dispose();
// Verify catalog preview seeking only runs for the specified model and clip.
Object.assign(bowSelection,{updateAnimationControls(){},invalidate(){}});
vm.runInContext(`state.libraryModelId='dungeon-crawler-carl-v3';state.clips=[{userData:{actionProfiles:['sling'],studioAnimationId:'uploaded:goalie-throw:0'}}];state.action={time:0,paused:false,getClip:()=>({duration:3.833333333})};state.mixer={update(){}};equipment.restoreConstraints=()=>{};equipment.applyConstraints=()=>{};`,bowSelection);
bowShieldRemovals=0;await vm.runInContext("changeEquipment({rightHand:'sling'})",bowSelection);
assert.equal(selectedBowClip,0);assert.equal(bowShieldRemovals,0);assert.equal(bowSelection.state.action.time,47/30);assert.equal(bowSelection.state.action.paused,true);
vm.runInContext("state.libraryModelId='other-rig';state.action.time=.4",bowSelection);
await vm.runInContext("changeEquipment({rightHand:'sling'})",bowSelection);assert.equal(bowSelection.state.action.time,.4);
console.log('PASS sling: vertical hanging pose, adjustable hand mount, no body IK, correct profile/animation and model-specific preview frame');
