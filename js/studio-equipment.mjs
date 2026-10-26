import { itemCatalogEntry } from './item-catalog.mjs?v=R238C143';
import {
  findHumanoidBone, humanoidFingerChains, normalizeHumanoidBoneName, analyzeHumanoidRig
} from './humanoid-rig.mjs?v=R238C101';

// Rigid visible equipment stays beneath its catalog-selected animated hand. Weapon-specific grip presets remain independently tunable.
// All one-handed weapon assets expose a local longitudinal axis that must resolve
// to this hand-local direction. For a sword it is the blade; for an axe it is
// the shaft. Cutting edges are deliberately not treated as the weapon axis.
export const HELD_WEAPON_AXIS = Object.freeze([0, 0, -1]);
const CROSSBOW_ITEM=itemCatalogEntry('crossbow');
const BOW_ITEM=itemCatalogEntry('recurve-bow');
const SPEAR_ITEM=itemCatalogEntry('spear');
const TWO_HANDED_SWORD_ITEM=itemCatalogEntry('two-handed-sword');
if(!TWO_HANDED_SWORD_ITEM?.appearance)throw new Error('Two-Handed Sword catalog appearance is required.');
export const STUDIO_WEAPONS = Object.freeze([
  Object.freeze({
    id: 'medieval-sword', label: 'Medieval Sword', visualClass: 'sword', poseProfileId: 'one-handed-swing',
    file: 'assets/models/weapons/swords/medieval-sword.glb',
    grip: Object.freeze([0.34, 0.109, 0]), nativeScale: 0.55,
    primaryAxis: Object.freeze([-1, 0, 0]),
    position: Object.freeze([0.015, 0.05, 0.005]), rotation: Object.freeze([0, -90, 0])
  }),
  Object.freeze({
    id: 'battle-axe', label: 'Battle Axe', visualClass: 'battle-axe', poseProfileId: 'one-handed-swing',
    file: 'assets/models/weapons/battle-axes/battle-axe.glb',
    // Rev 67: keep the Rev 66 shaft axis, then roll the axe 180 degrees
    // around that shaft so the cutting edge faces the opposite direction.
    grip: Object.freeze([-0.36, 0.15, 0]), nativeScale: 0.4125,
    primaryAxis: Object.freeze([4, 5, 0]),
    position: Object.freeze([0.015, 0.05, 0.005]), rotation: Object.freeze([-129, -90, 0]),
    defaultSizePercent: 100, presetRevision: 5
  }),
  Object.freeze({
    id:TWO_HANDED_SWORD_ITEM.appearance.studioId,
    label:TWO_HANDED_SWORD_ITEM.name,
    visualClass:TWO_HANDED_SWORD_ITEM.appearance.visualClass,
    poseProfileId:TWO_HANDED_SWORD_ITEM.appearance.poseProfileId,
    file:TWO_HANDED_SWORD_ITEM.appearance.asset,
    grip:Object.freeze([...TWO_HANDED_SWORD_ITEM.appearance.grip]),
    secondaryGrip:Object.freeze([...TWO_HANDED_SWORD_ITEM.appearance.secondaryGrip]),
    handsRequired:TWO_HANDED_SWORD_ITEM.appearance.handsRequired,
    nativeScale:TWO_HANDED_SWORD_ITEM.appearance.nativeScale,
    primaryAxis:Object.freeze([...TWO_HANDED_SWORD_ITEM.appearance.primaryAxis]),
    position:Object.freeze([...TWO_HANDED_SWORD_ITEM.appearance.position]),
    rotation:Object.freeze([...TWO_HANDED_SWORD_ITEM.appearance.rotationDegrees]),
    defaultSizePercent:TWO_HANDED_SWORD_ITEM.appearance.defaultSizePercent,
    calibratedLengthInches:TWO_HANDED_SWORD_ITEM.physical?.calibratedLengthInches || 60.6,
    presetRevision:1
  }),
  Object.freeze({
    id:SPEAR_ITEM.appearance.studioId,label:SPEAR_ITEM.name,
    visualClass:SPEAR_ITEM.appearance.visualClass,poseProfileId:SPEAR_ITEM.appearance.poseProfileId,
    file:SPEAR_ITEM.appearance.asset,assetSha256:SPEAR_ITEM.appearance.runtimeAsset.sha256,handsRequired:SPEAR_ITEM.appearance.handsRequired,
    grip:Object.freeze([...SPEAR_ITEM.appearance.grip]),
    secondaryGrip:Object.freeze([...SPEAR_ITEM.appearance.secondaryGrip]),
    primaryAxis:Object.freeze([...SPEAR_ITEM.appearance.primaryAxis]),
    nativeScale:SPEAR_ITEM.appearance.nativeScale,
    position:Object.freeze([...SPEAR_ITEM.appearance.position]),
    rotation:Object.freeze([...SPEAR_ITEM.appearance.rotationDegrees]),
    defaultSizePercent:SPEAR_ITEM.appearance.defaultSizePercent,
    calibratedLengthInches:SPEAR_ITEM.physical.calibratedLengthInches,presetRevision:1
  }),
  Object.freeze({
    id:CROSSBOW_ITEM.appearance.studioId,label:CROSSBOW_ITEM.name,visualClass:'crossbow',
    poseProfileId:CROSSBOW_ITEM.appearance.poseProfileId,
    file:CROSSBOW_ITEM.appearance.asset,assetSha256:CROSSBOW_ITEM.appearance.runtimeAsset.sha256,
    handsRequired:2,grip:Object.freeze([...CROSSBOW_ITEM.appearance.grip]),
    primaryAxis:Object.freeze([...CROSSBOW_ITEM.appearance.primaryAxis]),
    nativeScale:CROSSBOW_ITEM.appearance.nativeScale,
    position:Object.freeze([...CROSSBOW_ITEM.appearance.position]),
    rotation:Object.freeze([...CROSSBOW_ITEM.appearance.rotationDegrees]),
    defaultSizePercent:CROSSBOW_ITEM.appearance.defaultSizePercent,
    calibratedLengthInches:CROSSBOW_ITEM.physical.calibratedLengthInches,presetRevision:1
  }),
  Object.freeze({
    id:BOW_ITEM.appearance.studioId,label:BOW_ITEM.name,visualClass:'bow',
    poseProfileId:BOW_ITEM.appearance.poseProfileId,attachmentHand:'left',
    materialOverrides:BOW_ITEM.appearance.materialOverrides,
    file:BOW_ITEM.appearance.asset,assetSha256:BOW_ITEM.appearance.runtimeAsset.sha256,
    handsRequired:2,grip:Object.freeze([...BOW_ITEM.appearance.grip]),
    primaryAxis:Object.freeze([...BOW_ITEM.appearance.primaryAxis]),
    nativeScale:BOW_ITEM.appearance.nativeScale,
    position:Object.freeze([...BOW_ITEM.appearance.position]),
    rotation:Object.freeze([...BOW_ITEM.appearance.rotationDegrees]),
    defaultSizePercent:BOW_ITEM.appearance.defaultSizePercent,
    calibratedLengthInches:BOW_ITEM.physical.calibratedLengthInches,presetRevision:1
  })
]);

export const EQUIPMENT_LIMITS = Object.freeze({
  sizePercent: Object.freeze({ min: 25, max: 200, step: 5 }),
  position: Object.freeze({ min: -1, max: 1, step: 0.005 }),
  rotation: Object.freeze({ min: -180, max: 180, step: 1 }),
  secondaryGripOffsetInches: Object.freeze({ min: -5, max: 5, step: 0.25 })
});
const bounded = (value, fallback, range) => Number.isFinite(value) ? Math.min(range.max, Math.max(range.min, value)) : fallback;
export function studioWeapon(id) { return STUDIO_WEAPONS.find(weapon => weapon.id === id) || null; }
// Content-versioned requests refresh corrected assets without migrating saved grips.
export function weaponAssetUrl(weapon, baseUrl) {
  const url = new URL(weapon.file, baseUrl);
  if (weapon.assetSha256) url.searchParams.set('v', weapon.assetSha256);
  return url;
}
export function normalizeEquipment(value = {}) {
  const weapon = studioWeapon(value?.rightHand), preset = weapon || STUDIO_WEAPONS[0];
  const presetRevision = Number.isFinite(weapon?.presetRevision) ? weapon.presetRevision : 0;
  const storedRevision = Number.isFinite(value?.presetRevision) ? value.presetRevision : 0;
  const migratePreset = !!weapon && presetRevision > storedRevision;
  const vector = key => preset[key].map((fallback, axis) =>
    migratePreset ? fallback : bounded(value?.[key]?.[axis], fallback, EQUIPMENT_LIMITS[key]));
  const secondaryGripOffsetInches = [0,1,2].map(axis =>
    bounded(value?.secondaryGripOffsetInches?.[axis], 0, EQUIPMENT_LIMITS.secondaryGripOffsetInches));
  return {
    version: 3,
    presetRevision,
    rightHand: weapon?.id || 'none',
    sizePercent: migratePreset ? (weapon?.defaultSizePercent ?? 100)
      : bounded(value?.sizePercent, weapon?.defaultSizePercent ?? 100, EQUIPMENT_LIMITS.sizePercent),
    position: vector('position'),
    rotation: vector('rotation'),
    secondaryGripOffsetInches
  };
}
const normalizedBoneName = object => normalizeHumanoidBoneName(object?.name);
export function findRightHand(model) { return findHumanoidBone(model, 'rightHand'); }
export function findLeftHand(model) { return findHumanoidBone(model, 'leftHand'); }
export function findWeaponHand(model, weapon) {
  return weapon?.attachmentHand === 'left' ? findLeftHand(model) : findRightHand(model);
}
export function findLeftForeArm(model) { return findHumanoidBone(model, 'leftForeArm'); }
export function findLeftArm(model) { return findHumanoidBone(model, 'leftUpperArm'); }
export function findLeftShoulder(model) { return findHumanoidBone(model, 'leftShoulder'); }
export function findUpperSpine(model) {
  return findHumanoidBone(model, 'upperChest')
    || findHumanoidBone(model, 'chest')
    || findHumanoidBone(model, 'spine');
}
export function findLowerSpine(model) {
  return findHumanoidBone(model, 'spine')
    || findHumanoidBone(model, 'chest');
}
export function findHips(model) { return findHumanoidBone(model, 'hips'); }

function rotateJointToward(THREE, joint, fromWorld, toWorld, maxDegrees, weight = 1) {
  if (!joint?.isBone || fromWorld.lengthSq() < 1e-10 || toWorld.lengthSq() < 1e-10) return 0;
  fromWorld.normalize(); toWorld.normalize();
  const deltaWorld = new THREE.Quaternion().setFromUnitVectors(fromWorld, toWorld);
  let angle = 2 * Math.acos(THREE.MathUtils.clamp(deltaWorld.w, -1, 1));
  if (!Number.isFinite(angle) || angle < 1e-8) return 0;
  angle = Math.min(angle * weight, THREE.MathUtils.degToRad(maxDegrees));
  const axis = new THREE.Vector3(deltaWorld.x, deltaWorld.y, deltaWorld.z);
  if (axis.lengthSq() < 1e-10) return 0;
  deltaWorld.setFromAxisAngle(axis.normalize(), angle);
  const parentWorld = joint.parent?.getWorldQuaternion(new THREE.Quaternion()) || new THREE.Quaternion();
  const deltaLocal = parentWorld.clone().invert().multiply(deltaWorld).multiply(parentWorld);
  joint.quaternion.premultiply(deltaLocal).normalize();
  joint.updateWorldMatrix(true, true);
  return THREE.MathUtils.radToDeg(angle);
}

function twoHandedTargetWorld(THREE, attachment) {
  attachment.model.updateWorldMatrix(true, true);
  const target = new THREE.Vector3(...attachment.weapon.secondaryGrip);
  const inchesPerLocalUnit = Number(attachment.weapon.calibratedLengthInches) || 60.6;
  const offset = attachment.secondaryGripOffsetInches || [0,0,0];
  target.x += offset[0] / inchesPerLocalUnit;
  target.y += offset[1] / inchesPerLocalUnit;
  target.z += offset[2] / inchesPerLocalUnit;
  return attachment.model.localToWorld(target);
}

function applyTwoHandedBodyPose(THREE, model, attachment) {
  const shoulder = findLeftShoulder(model), arm = findLeftArm(model), forearm = findLeftForeArm(model), spine = findUpperSpine(model);
  const lowerSpine = findLowerSpine(model), hips = findHips(model);
  if (!shoulder || !arm || !forearm) return { applied: false, reason: 'left-body-chain-missing' };
  model.updateWorldMatrix(true, true);

  // Start the turn lower in the body. Small pelvis/lower-spine participation
  // prevents the upper torso from looking corkscrewed while the legs remain
  // completely disconnected from the sword action.
  let hipsDegrees = 0, lowerSpineDegrees = 0, spineDegrees = 0;
  const targetAtWaist = twoHandedTargetWorld(THREE, attachment);
  if (hips) {
    const hipsWorld = hips.getWorldPosition(new THREE.Vector3());
    const shoulderWorld = shoulder.getWorldPosition(new THREE.Vector3());
    hipsDegrees = rotateJointToward(
      THREE, hips,
      shoulderWorld.clone().sub(hipsWorld),
      targetAtWaist.clone().sub(hipsWorld),
      4, 0.08
    );
    model.updateWorldMatrix(true, true);
  }
  if (lowerSpine && lowerSpine !== spine) {
    const lowWorld = lowerSpine.getWorldPosition(new THREE.Vector3());
    const shoulderWorld = shoulder.getWorldPosition(new THREE.Vector3());
    const target = twoHandedTargetWorld(THREE, attachment);
    lowerSpineDegrees = rotateJointToward(
      THREE, lowerSpine,
      shoulderWorld.clone().sub(lowWorld),
      target.clone().sub(lowWorld),
      6, 0.10
    );
    model.updateWorldMatrix(true, true);
  }

  // Let the upper torso share a small amount of the reach instead of forcing
  // the entire correction through the arm. This is intentionally subtle.
  if (spine) {
    const spineWorld = spine.getWorldPosition(new THREE.Vector3());
    const shoulderWorld = shoulder.getWorldPosition(new THREE.Vector3());
    const target = twoHandedTargetWorld(THREE, attachment);
    spineDegrees = rotateJointToward(
      THREE, spine,
      shoulderWorld.clone().sub(spineWorld),
      target.clone().sub(spineWorld),
      7, 0.12
    );
    model.updateWorldMatrix(true, true);
  }

  // Open the clavicle/shoulder toward the secondary grip before solving the
  // arm. This moves the arm around the chest rather than dragging it through it.
  const shoulderWorld = shoulder.getWorldPosition(new THREE.Vector3());
  const armWorld = arm.getWorldPosition(new THREE.Vector3());
  let target = twoHandedTargetWorld(THREE, attachment);
  const shoulderDegrees = rotateJointToward(
    THREE, shoulder,
    armWorld.clone().sub(shoulderWorld),
    target.clone().sub(shoulderWorld),
    18, 0.55
  );
  model.updateWorldMatrix(true, true);

  // Pole-style elbow bias: keep the elbow on the body's outside. The desired
  // elbow is the natural shoulder/weapon midpoint pushed laterally away from
  // the chest by a fraction of total arm length.
  target = twoHandedTargetWorld(THREE, attachment);
  const chestWorld = (spine || shoulder.parent || shoulder).getWorldPosition(new THREE.Vector3());
  const newShoulderWorld = shoulder.getWorldPosition(new THREE.Vector3());
  const elbowWorld = forearm.getWorldPosition(new THREE.Vector3());
  const handWorld = findLeftHand(model)?.getWorldPosition(new THREE.Vector3()) || elbowWorld.clone();
  const upperLength = newShoulderWorld.distanceTo(elbowWorld);
  const foreLength = elbowWorld.distanceTo(handWorld);
  const outward = newShoulderWorld.clone().sub(chestWorld);
  if (outward.lengthSq() < 1e-10) outward.set(1, 0, 0);
  outward.normalize();
  const desiredElbow = newShoulderWorld.clone().lerp(target, 0.44)
    .addScaledVector(outward, Math.max(upperLength + foreLength, 0.01) * 0.36);
  const armPivot = arm.getWorldPosition(new THREE.Vector3());
  const elbowDegrees = rotateJointToward(
    THREE, arm,
    elbowWorld.clone().sub(armPivot),
    desiredElbow.clone().sub(armPivot),
    38, 1
  );
  model.updateWorldMatrix(true, true);
  return { applied: true, hipsDegrees, lowerSpineDegrees, spineDegrees, shoulderDegrees, elbowDegrees };
}

function leftFingerChains(model) {
  return humanoidFingerChains(model, 'left');
}

function fingerTipWorld(THREE, chain) {
  const last = chain.bones[2];
  const child = last.children.find(object => object.isBone);
  if (child) return child.getWorldPosition(new THREE.Vector3());
  const direction = last.position.lengthSq() > 1e-10
    ? last.position.clone().normalize()
    : new THREE.Vector3(1,0,0);
  return last.localToWorld(direction.multiplyScalar(0.04));
}

function rotateFingerJointToward(THREE, joint, tipWorld, targetWorld, maxDegrees) {
  const jointWorld = joint.getWorldPosition(new THREE.Vector3());
  const from = tipWorld.clone().sub(jointWorld);
  const to = targetWorld.clone().sub(jointWorld);
  if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return 0;
  from.normalize();
  to.normalize();
  const deltaWorld = new THREE.Quaternion().setFromUnitVectors(from, to);
  let angle = 2 * Math.acos(THREE.MathUtils.clamp(deltaWorld.w, -1, 1));
  if (!Number.isFinite(angle) || angle < 1e-8) return 0;
  angle = Math.min(angle, THREE.MathUtils.degToRad(maxDegrees));
  const axis = new THREE.Vector3(deltaWorld.x, deltaWorld.y, deltaWorld.z);
  if (axis.lengthSq() < 1e-10) return 0;
  deltaWorld.setFromAxisAngle(axis.normalize(), angle);

  const parentWorld = joint.parent?.getWorldQuaternion(new THREE.Quaternion()) || new THREE.Quaternion();
  const deltaLocal = parentWorld.clone().invert().multiply(deltaWorld).multiply(parentWorld);
  joint.quaternion.premultiply(deltaLocal).normalize();
  joint.updateWorldMatrix(true, true);
  return THREE.MathUtils.radToDeg(angle);
}

function orientLeftHandToHilt(THREE, model, attachment) {
  const hand = findLeftHand(model);
  const chains = leftFingerChains(model);
  if (!hand || chains.length < 4) return { applied:false, angleDegrees:0 };

  const byName = Object.fromEntries(chains.map(chain => [chain.fingerName, chain]));
  const indexRoot = byName.index?.bones[0], pinkyRoot = byName.pinky?.bones[0];
  const middleRoot = byName.middle?.bones[0], ringRoot = byName.ring?.bones[0];
  if (!indexRoot || !pinkyRoot || !middleRoot || !ringRoot) return { applied:false, angleDegrees:0 };

  // Build a hand-local anatomical frame from the actual Carl rig:
  // X = across the knuckles, Y = wrist toward knuckles.
  const localKnuckle = pinkyRoot.position.clone().sub(indexRoot.position);
  const localForward = indexRoot.position.clone().add(middleRoot.position)
    .add(ringRoot.position).add(pinkyRoot.position).multiplyScalar(0.25);
  if (localKnuckle.lengthSq()<1e-10 || localForward.lengthSq()<1e-10) return { applied:false, angleDegrees:0 };
  localKnuckle.normalize();
  localForward.addScaledVector(localKnuckle,-localForward.dot(localKnuckle)).normalize();
  const localNormal = localKnuckle.clone().cross(localForward).normalize();

  model.updateWorldMatrix(true,true);
  attachment.model.updateWorldMatrix(true,true);
  const hiltCenter = twoHandedTargetWorld(THREE,attachment);
  const handWorld = hand.getWorldPosition(new THREE.Vector3());

  const weaponAxis = new THREE.Vector3(...(attachment.weapon.primaryAxis || HELD_WEAPON_AXIS)).normalize()
    .applyQuaternion(attachment.model.getWorldQuaternion(new THREE.Quaternion())).normalize();
  const towardHilt = hiltCenter.clone().sub(handWorld);
  towardHilt.addScaledVector(weaponAxis,-towardHilt.dot(weaponAxis));
  if (towardHilt.lengthSq()<1e-10) return { applied:false, angleDegrees:0 };
  towardHilt.normalize();

  const localBasis = new THREE.Matrix4().makeBasis(localKnuckle,localForward,localNormal);
  const localBasisInverse = localBasis.clone().invert();
  const currentWorld = hand.getWorldQuaternion(new THREE.Quaternion());

  let best = null;
  for (const sign of [-1,1]) {
    const desiredKnuckle = weaponAxis.clone().multiplyScalar(sign);
    const desiredForward = towardHilt.clone();
    const desiredNormal = desiredKnuckle.clone().cross(desiredForward).normalize();
    const desiredBasis = new THREE.Matrix4().makeBasis(desiredKnuckle,desiredForward,desiredNormal);
    const desiredWorld = new THREE.Quaternion().setFromRotationMatrix(
      desiredBasis.multiply(localBasisInverse)
    ).normalize();
    const angle = currentWorld.angleTo(desiredWorld);
    if (!best || angle < best.angle) best = { desiredWorld, angle };
  }
  if (!best) return { applied:false, angleDegrees:0 };

  const parentWorld = hand.parent?.getWorldQuaternion(new THREE.Quaternion()) || new THREE.Quaternion();
  hand.quaternion.copy(parentWorld.clone().invert().multiply(best.desiredWorld)).normalize();
  hand.updateWorldMatrix(true,true);
  return { applied:true, angleDegrees:THREE.MathUtils.radToDeg(best.angle) };
}

function applyTwoHandedFingerWrap(THREE, model, attachment) {
  const hand = findLeftHand(model);
  const chains = leftFingerChains(model);
  if (!hand || !chains.length) return { bonesAdjusted: 0, fingertips: [] };

  const wristOrientation = orientLeftHandToHilt(THREE, model, attachment);
  model.updateWorldMatrix(true, true);
  const hiltCenter = twoHandedTargetWorld(THREE, attachment);

  // The weapon's primary axis gives us the hilt direction in world space.
  // Keep each fingertip near its original longitudinal position so all four
  // fingers do not collapse onto one identical point along the grip.
  const weaponAxis = new THREE.Vector3(...(attachment.weapon.primaryAxis || HELD_WEAPON_AXIS)).normalize();
  attachment.model.getWorldQuaternion(new THREE.Quaternion());
  weaponAxis.applyQuaternion(attachment.model.getWorldQuaternion(new THREE.Quaternion())).normalize();

  const palmWorld = hand.getWorldPosition(new THREE.Vector3());
  const palmToHilt = hiltCenter.clone().sub(palmWorld);
  const radial = palmToHilt.clone().addScaledVector(
    weaponAxis, -palmToHilt.dot(weaponAxis)
  );
  if (radial.lengthSq() < 1e-10) radial.set(0,0,1);
  radial.normalize();

  let bonesAdjusted = 0;
  const fingertips = [];

  for (const chain of chains) {
    const rootWorld = chain.bones[0].getWorldPosition(new THREE.Vector3());
    const along = rootWorld.clone().sub(hiltCenter).dot(weaponAxis);
    // Aim just beyond the hilt center from the palm so fingers visibly wrap
    // around the grip rather than merely touching the near side.
    const wrapDepth = chain.fingerName === 'thumb' ? -0.006 : 0.008;
    const target = hiltCenter.clone()
      .addScaledVector(weaponAxis, along * 0.55)
      .addScaledVector(radial, wrapDepth);

    // Distal-to-proximal CCD gives natural closure while preserving the
    // authored hand/wrist pose from Mixamo.
    const limits = chain.fingerName === 'thumb' ? [18,26,22] : [24,32,28];
    for (let pass = 0; pass < 2; pass++) {
      for (let index = 2; index >= 0; index--) {
        const tip = fingerTipWorld(THREE, chain);
        const changed = rotateFingerJointToward(THREE, chain.bones[index], tip, target, limits[index]);
        if (changed > 1e-6) bonesAdjusted++;
      }
    }
    const finalTip = fingerTipWorld(THREE, chain);
    fingertips.push({
      finger: chain.fingerName,
      distanceToGrip: finalTip.distanceTo(target)
    });
  }

  model.updateWorldMatrix(true, true);
  return { bonesAdjusted, fingertips, wristOrientation };
}

function inferHandGripLocal(THREE, hand, model) {
  const chains = humanoidFingerChains(model, 'left').filter(chain => chain.fingerName !== 'thumb');
  const fingerBases = chains.map(chain => chain.bones[0]).filter(Boolean);
  if (!hand || !fingerBases.length) return new THREE.Vector3();
  // Work in hand-local space even when a rig inserts palm/metacarpal helpers
  // between the hand and finger roots.
  model?.updateWorldMatrix(true, true);
  const knuckles = new THREE.Vector3();
  for (const finger of fingerBases) {
    knuckles.add(hand.worldToLocal(finger.getWorldPosition(new THREE.Vector3())));
  }
  knuckles.multiplyScalar(1 / fingerBases.length);
  return knuckles.multiplyScalar(0.52);
}

export function solveTwoHandedGrip(THREE, {
  model, attachment, iterations = 16, tolerance = 0.003, maxStepDegrees = 45
} = {}) {
  const weapon = attachment?.weapon;
  if (!model || !attachment || weapon?.handsRequired !== 2 || !weapon.secondaryGrip) {
    return { active: false, solved: false, error: null };
  }
  const hand = findLeftHand(model), forearm = findLeftForeArm(model), arm = findLeftArm(model);
  if (!hand || !forearm || !arm) return { active: true, solved: false, error: null, reason: 'left-arm-chain-missing' };

  const bodyPose = applyTwoHandedBodyPose(THREE, model, attachment);
  model.updateWorldMatrix(true, true);
  const target = twoHandedTargetWorld(THREE, attachment);
  const handGripLocal = inferHandGripLocal(THREE, hand, model);
  const effectorWorld = () => hand.localToWorld(handGripLocal.clone());
  const joints = [forearm, arm];
  const maxStep = THREE.MathUtils.degToRad(maxStepDegrees);

  let error = effectorWorld().distanceTo(target);
  for (let pass = 0; pass < iterations && error > tolerance; pass++) {
    for (const joint of joints) {
      joint.parent?.updateWorldMatrix(true, false);
      joint.updateWorldMatrix(true, true);
      const jointWorld = joint.getWorldPosition(new THREE.Vector3());
      const effector = effectorWorld();
      const toEffector = effector.sub(jointWorld);
      const toTarget = target.clone().sub(jointWorld);
      if (toEffector.lengthSq() < 1e-10 || toTarget.lengthSq() < 1e-10) continue;
      toEffector.normalize(); toTarget.normalize();
      const deltaWorld = new THREE.Quaternion().setFromUnitVectors(toEffector, toTarget);
      const angle = 2 * Math.acos(THREE.MathUtils.clamp(deltaWorld.w, -1, 1));
      if (angle > maxStep && angle > 1e-8) {
        const axis = new THREE.Vector3(deltaWorld.x, deltaWorld.y, deltaWorld.z);
        if (axis.lengthSq() > 1e-10) deltaWorld.setFromAxisAngle(axis.normalize(), maxStep);
      }
      const parentWorld = joint.parent?.getWorldQuaternion(new THREE.Quaternion()) || new THREE.Quaternion();
      const deltaLocal = parentWorld.clone().invert().multiply(deltaWorld).multiply(parentWorld);
      joint.quaternion.premultiply(deltaLocal).normalize();
      joint.updateWorldMatrix(true, true);
      error = effectorWorld().distanceTo(target);
      if (error <= tolerance) break;
    }
  }
  model.updateWorldMatrix(true, true);
  const liveTarget = twoHandedTargetWorld(THREE, attachment);
  const offHand = effectorWorld();
  error = offHand.distanceTo(liveTarget);
  const fingerGrip = applyTwoHandedFingerWrap(THREE, model, attachment);
  return {
    active: true, solved: error <= tolerance, error,
    targetWorldPosition: liveTarget.toArray(),
    offHandWorldPosition: offHand.toArray(),
    handBone: hand.name, forearmBone: forearm.name, armBone: arm.name,
    shoulderBone: findLeftShoulder(model)?.name || null,
    spineBone: findUpperSpine(model)?.name || null,
    bodyPose, fingerBonesCurled: fingerGrip.bonesAdjusted, fingerGrip
  };
}
export function createWeaponAttachment(THREE, hand, model, settings) {
  const value = normalizeEquipment(settings), weapon = studioWeapon(value.rightHand);
  if (!hand?.isBone || !weapon || !model?.isObject3D) throw new Error('A weapon and its attachment hand bone are required.');
  // The bow's source riser has slight transmission. Its extra render pass
  // corrupts scissored six-facing atlas tiles; use the authored opaque override
  // for both Studio and combat without changing source textures or the GLB.
  if (Number.isFinite(weapon.materialOverrides?.transmission)) model.traverse(object => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material && 'transmission' in material) {
        material.transmission = weapon.materialOverrides.transmission;
        material.needsUpdate = true;
      }
    }
  });
  const socket = new THREE.Group(); socket.name = weapon.attachmentHand === 'left' ? 'StudioLeftHandEquipment' : 'StudioRightHandEquipment'; socket.userData.studioEquipment = true;
  const grip = new THREE.Group(); grip.name = 'WeaponGripOrigin'; grip.position.fromArray(weapon.grip).multiplyScalar(-1); grip.add(model); socket.add(grip); hand.add(socket);
  const attachment = { socket, model, weapon, secondaryGripOffsetInches:[0,0,0], update:null, detach: () => socket.removeFromParent() };
  function update(next) {
    const normalized = normalizeEquipment(next);
    socket.position.fromArray(normalized.position);
    socket.rotation.set(...normalized.rotation.map(degrees => degrees * Math.PI / 180), 'XYZ');
    socket.scale.setScalar(weapon.nativeScale * normalized.sizePercent / 100);
    attachment.secondaryGripOffsetInches = [...normalized.secondaryGripOffsetInches];
    socket.updateWorldMatrix(true, true);
  }
  attachment.update = update;
  update(value);
  return attachment;
}
function captureBonePose(model) {
  const pose = [];
  model?.traverse(object => {
    if (!object.isBone) return;
    pose.push([object, object.quaternion.clone()]);
  });
  return pose;
}
function restoreBonePose(pose) {
  if (!pose) return;
  for (const [bone, quaternion] of pose) bone.quaternion.copy(quaternion);
}

export function createStudioEquipment({ THREE, loadAsset, disposeObject, onChange = () => {} }) {
  let model = null, settings = normalizeEquipment(), attachment = null, loading = false, error = '', request = 0, disposed = false;
  let constraint = { active: false, solved: false, error: null }, preConstraintPose = null;
  const snapshot = () => ({
    settings: normalizeEquipment(settings), attached: !!attachment, rightHandBone: findRightHand(model)?.name || null,
    leftHandBone: findLeftHand(model)?.name || null,
    attachmentHand: studioWeapon(settings.rightHand)?.attachmentHand || 'right',
    attachmentHandBone: findWeaponHand(model,studioWeapon(settings.rightHand))?.name || null, loading, error,
    rig: model ? analyzeHumanoidRig(model) : null,
    socketWorldPosition: attachment?.socket.getWorldPosition(new THREE.Vector3()).toArray() || null,
    twoHandedConstraint: constraint ? structuredClone(constraint) : null
  });
  const notify = () => { if (!disposed) onChange(snapshot()); };
  function detach() { restoreBonePose(preConstraintPose); preConstraintPose=null; if (!attachment) return; attachment.detach(); disposeObject(attachment.model); attachment = null; constraint = { active: false, solved: false, error: null }; }
  async function select(value) {
    if (disposed) return false;
    const next = normalizeEquipment(value), sameWeapon = next.rightHand === settings.rightHand; settings = next;
    if (sameWeapon && attachment && !loading) { attachment.update(settings); error=''; notify(); return true; }
    const version = ++request; detach(); loading=false; error=''; const weapon = studioWeapon(settings.rightHand);
    if (!weapon) { notify(); return true; }
    const hand = findWeaponHand(model,weapon);
    if (!hand) { error=`This model has no supported ${weapon.attachmentHand || 'right'}-hand bone. Load a compatible rigged MOB model to test this weapon.`; notify(); return false; }
    loading=true; notify(); let asset;
    try {
      asset = await loadAsset(weapon);
      if (disposed || request !== version) { disposeObject(asset); return false; }
      attachment = createWeaponAttachment(THREE, hand, asset, settings); loading=false; notify(); return true;
    } catch (cause) {
      if (asset) disposeObject(asset);
      if (disposed || request !== version) return false;
      loading=false; error=`The weapon could not be loaded. ${cause?.message || cause} Use Reset grip to retry, or choose None.`; notify(); return false;
    }
  }
  function restoreConstraints() {
    if (disposed || !preConstraintPose) return false;
    restoreBonePose(preConstraintPose);
    preConstraintPose = null;
    model?.updateWorldMatrix(true, true);
    return true;
  }
  function applyConstraints() {
    if (disposed) return constraint;
    // Save the clean authored animation pose. It is restored before the next
    // mixer evaluation so IK/body/finger corrections never accumulate.
    preConstraintPose = captureBonePose(model);
    constraint = solveTwoHandedGrip(THREE, { model, attachment });
    return constraint;
  }
  function setModel(next, value = {}) { ++request; detach(); model=next; settings=normalizeEquipment(); loading=false; error=''; constraint={active:false,solved:false,error:null}; preConstraintPose=null; return select(value); }
  function dispose() { restoreBonePose(preConstraintPose); preConstraintPose=null; disposed=true; ++request; detach(); model=null; loading=false; }
  return { snapshot, select, setModel, restoreConstraints, applyConstraints, dispose };
}