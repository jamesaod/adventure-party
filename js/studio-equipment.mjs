import { itemCatalogEntry } from './item-catalog.mjs?v=R238C75';

// Rigid visible equipment stays beneath the animated right hand. Weapon-specific grip presets remain independently tunable.
// All one-handed weapon assets expose a local longitudinal axis that must resolve
// to this hand-local direction. For a sword it is the blade; for an axe it is
// the shaft. Cutting edges are deliberately not treated as the weapon axis.
export const HELD_WEAPON_AXIS = Object.freeze([0, 0, -1]);
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
    presetRevision:1
  })
]);

export const EQUIPMENT_LIMITS = Object.freeze({
  sizePercent: Object.freeze({ min: 25, max: 200, step: 5 }),
  position: Object.freeze({ min: -1, max: 1, step: 0.005 }),
  rotation: Object.freeze({ min: -180, max: 180, step: 1 })
});
const bounded = (value, fallback, range) => Number.isFinite(value) ? Math.min(range.max, Math.max(range.min, value)) : fallback;
export function studioWeapon(id) { return STUDIO_WEAPONS.find(weapon => weapon.id === id) || null; }
export function normalizeEquipment(value = {}) {
  const weapon = studioWeapon(value?.rightHand), preset = weapon || STUDIO_WEAPONS[0];
  const presetRevision = Number.isFinite(weapon?.presetRevision) ? weapon.presetRevision : 0;
  const storedRevision = Number.isFinite(value?.presetRevision) ? value.presetRevision : 0;
  const migratePreset = !!weapon && presetRevision > storedRevision;
  const vector = key => preset[key].map((fallback, axis) =>
    migratePreset ? fallback : bounded(value?.[key]?.[axis], fallback, EQUIPMENT_LIMITS[key]));
  return {
    version: 2,
    presetRevision,
    rightHand: weapon?.id || 'none',
    sizePercent: migratePreset ? (weapon?.defaultSizePercent ?? 100)
      : bounded(value?.sizePercent, weapon?.defaultSizePercent ?? 100, EQUIPMENT_LIMITS.sizePercent),
    position: vector('position'),
    rotation: vector('rotation')
  };
}
const normalizedBoneName = object => String(object?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function findBone(model, aliases) {
  let found = null;
  model?.traverse(object => {
    if (!object.isBone || found) return;
    const name = normalizedBoneName(object);
    if (aliases.some(alias => name === alias || name.endsWith(alias))) found = object;
  });
  return found;
}
export function findRightHand(model) { return findBone(model, ['righthand', 'mixamorigrighthand']); }
export function findLeftHand(model) { return findBone(model, ['lefthand', 'mixamoriglefthand']); }
export function findLeftForeArm(model) { return findBone(model, ['leftforearm', 'mixamorigleftforearm']); }
export function findLeftArm(model) { return findBone(model, ['leftarm', 'mixamorigleftarm']); }
export function findLeftShoulder(model) { return findBone(model, ['leftshoulder', 'mixamorigleftshoulder']); }
export function findUpperSpine(model) {
  return findBone(model, ['spine2', 'mixamorigspine2'])
    || findBone(model, ['spine1', 'mixamorigspine1'])
    || findBone(model, ['spine', 'mixamorigspine']);
}
export function findLowerSpine(model) {
  return findBone(model, ['spine', 'mixamorigspine'])
    || findBone(model, ['spine1', 'mixamorigspine1']);
}
export function findHips(model) { return findBone(model, ['hips', 'mixamorighips']); }

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
  return attachment.model.localToWorld(new THREE.Vector3(...attachment.weapon.secondaryGrip));
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
  const desiredElbow = newShoulderWorld.clone().lerp(target, 0.46)
    .addScaledVector(outward, Math.max(upperLength + foreLength, 0.01) * 0.22);
  const armPivot = arm.getWorldPosition(new THREE.Vector3());
  const elbowDegrees = rotateJointToward(
    THREE, arm,
    elbowWorld.clone().sub(armPivot),
    desiredElbow.clone().sub(armPivot),
    32, 1
  );
  model.updateWorldMatrix(true, true);
  return { applied: true, hipsDegrees, lowerSpineDegrees, spineDegrees, shoulderDegrees, elbowDegrees };
}

function leftFingerBones(model) {
  const result = [];
  model?.traverse(object => {
    if (!object.isBone) return;
    const name = normalizedBoneName(object);
    if (/left(hand)?(thumb|index|middle|ring|pinky)[123]$/.test(name) ||
        /mixamoriglefthand(thumb|index|middle|ring|pinky)[123]$/.test(name)) result.push(object);
  });
  return result;
}

function applyTwoHandedFingerWrap(THREE, model, attachment) {
  const fingers = leftFingerBones(model);
  if (!fingers.length) return 0;
  const target = twoHandedTargetWorld(THREE, attachment);
  let curled = 0;
  for (const bone of fingers) {
    const name = normalizedBoneName(bone);
    const segment = Number(name.match(/([123])$/)?.[1] || 1);
    const thumb = name.includes('thumb');
    const degrees = thumb
      ? [0, 24, 34, 24][segment]
      : [0, 42, 56, 40][segment];
    const axis = thumb ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    const base = bone.quaternion.clone();
    const probeDegrees = 8;
    let bestSign = -1, bestDistance = Infinity;
    for (const sign of [-1, 1]) {
      bone.quaternion.copy(base).multiply(
        new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(probeDegrees * sign))
      ).normalize();
      bone.updateWorldMatrix(true, true);
      const endpoint = bone.children.find(child => child.isBone)?.getWorldPosition(new THREE.Vector3())
        || bone.getWorldPosition(new THREE.Vector3());
      const distance = endpoint.distanceTo(target);
      if (distance < bestDistance) { bestDistance = distance; bestSign = sign; }
    }
    bone.quaternion.copy(base).multiply(
      new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(degrees * bestSign))
    ).normalize();
    bone.updateWorldMatrix(true, true);
    curled++;
  }
  model?.updateWorldMatrix(true, true);
  return curled;
}

function inferHandGripLocal(THREE, hand) {
  const fingerBases = hand?.children?.filter(child => child.isBone && /(index|middle|ring|pinky)1$/.test(normalizedBoneName(child))) || [];
  if (!fingerBases.length) return new THREE.Vector3();
  // Finger roots sit at the knuckles, not the center of the palm. Pull the
  // anchor back toward the wrist so the actual palm/hilt contact is solved,
  // rather than parking the knuckles on the weapon.
  const knuckles = new THREE.Vector3();
  for (const finger of fingerBases) knuckles.add(finger.position);
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
  const handGripLocal = inferHandGripLocal(THREE, hand);
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
  const fingerBonesCurled = applyTwoHandedFingerWrap(THREE, model, attachment);
  return {
    active: true, solved: error <= tolerance, error,
    targetWorldPosition: liveTarget.toArray(),
    offHandWorldPosition: offHand.toArray(),
    handBone: hand.name, forearmBone: forearm.name, armBone: arm.name,
    shoulderBone: findLeftShoulder(model)?.name || null,
    spineBone: findUpperSpine(model)?.name || null,
    bodyPose, fingerBonesCurled
  };
}
export function createWeaponAttachment(THREE, hand, model, settings) {
  const value = normalizeEquipment(settings), weapon = studioWeapon(value.rightHand);
  if (!hand?.isBone || !weapon || !model?.isObject3D) throw new Error('A weapon and a right-hand bone are required.');
  const socket = new THREE.Group(); socket.name = 'StudioRightHandEquipment'; socket.userData.studioEquipment = true;
  const grip = new THREE.Group(); grip.name = 'WeaponGripOrigin'; grip.position.fromArray(weapon.grip).multiplyScalar(-1); grip.add(model); socket.add(grip); hand.add(socket);
  function update(next) {
    const normalized = normalizeEquipment(next);
    socket.position.fromArray(normalized.position);
    socket.rotation.set(...normalized.rotation.map(degrees => degrees * Math.PI / 180), 'XYZ');
    socket.scale.setScalar(weapon.nativeScale * normalized.sizePercent / 100);
    socket.updateWorldMatrix(true, true);
  }
  update(value);
  return { socket, model, weapon, update, detach: () => socket.removeFromParent() };
}
export function createStudioEquipment({ THREE, loadAsset, disposeObject, onChange = () => {} }) {
  let model = null, settings = normalizeEquipment(), attachment = null, loading = false, error = '', request = 0, disposed = false;
  let constraint = { active: false, solved: false, error: null };
  const snapshot = () => ({
    settings: normalizeEquipment(settings), attached: !!attachment, rightHandBone: findRightHand(model)?.name || null,
    leftHandBone: findLeftHand(model)?.name || null, loading, error,
    socketWorldPosition: attachment?.socket.getWorldPosition(new THREE.Vector3()).toArray() || null,
    twoHandedConstraint: constraint ? structuredClone(constraint) : null
  });
  const notify = () => { if (!disposed) onChange(snapshot()); };
  function detach() { if (!attachment) return; attachment.detach(); disposeObject(attachment.model); attachment = null; constraint = { active: false, solved: false, error: null }; }
  async function select(value) {
    if (disposed) return false;
    const next = normalizeEquipment(value), sameWeapon = next.rightHand === settings.rightHand; settings = next;
    if (sameWeapon && attachment && !loading) { attachment.update(settings); error=''; notify(); return true; }
    const version = ++request; detach(); loading=false; error=''; const weapon = studioWeapon(settings.rightHand);
    if (!weapon) { notify(); return true; }
    const hand = findRightHand(model);
    if (!hand) { error='This model has no supported right-hand bone. Load a compatible rigged MOB model to test this weapon.'; notify(); return false; }
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
  function applyConstraints() {
    if (disposed) return constraint;
    constraint = solveTwoHandedGrip(THREE, { model, attachment });
    return constraint;
  }
  function setModel(next, value = {}) { ++request; detach(); model=next; settings=normalizeEquipment(); loading=false; error=''; constraint={active:false,solved:false,error:null}; return select(value); }
  function dispose() { disposed=true; ++request; detach(); model=null; loading=false; }
  return { snapshot, select, setModel, applyConstraints, dispose };
}