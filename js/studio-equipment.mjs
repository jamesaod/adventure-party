// Rigid visible equipment stays beneath the animated right hand. Weapon-specific grip presets remain independently tunable.
export const STUDIO_WEAPONS = Object.freeze([
  Object.freeze({
    id: 'medieval-sword', label: 'Medieval Sword', visualClass: 'sword', poseProfileId: 'one-handed-swing-v1',
    file: 'assets/models/weapons/swords/medieval-sword.glb',
    grip: Object.freeze([0.34, 0.109, 0]), nativeScale: 0.55,
    position: Object.freeze([0.015, 0.05, 0.005]), rotation: Object.freeze([0, -90, 0])
  }),
  Object.freeze({
    id: 'battle-axe', label: 'Battle Axe', visualClass: 'battle-axe', poseProfileId: 'one-handed-swing-v1',
    file: 'assets/models/weapons/battle-axes/battle-axe.glb',
    // Rev 63: source geometry is diagonal in XY. This point sits on the wooden
    // haft about one hand-length above the butt, matching the user's QA marker.
    grip: Object.freeze([-0.32, 0.20, 0]), nativeScale: 0.4125,
    position: Object.freeze([0.015, 0.05, 0.005]), rotation: Object.freeze([0, 90, 180]),
    defaultSizePercent: 100, presetRevision: 2
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
export function findRightHand(model) {
  let hand = null;
  model?.traverse(object => {
    if (!object.isBone) return;
    const name = String(object.name).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (name === 'righthand' || name.endsWith('mixamorigrighthand')) hand ||= object;
  });
  return hand;
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
  return { socket, model, update, detach: () => socket.removeFromParent() };
}
export function createStudioEquipment({ THREE, loadAsset, disposeObject, onChange = () => {} }) {
  let model = null, settings = normalizeEquipment(), attachment = null, loading = false, error = '', request = 0, disposed = false;
  const snapshot = () => ({ settings: normalizeEquipment(settings), attached: !!attachment, rightHandBone: findRightHand(model)?.name || null, loading, error, socketWorldPosition: attachment?.socket.getWorldPosition(new THREE.Vector3()).toArray() || null });
  const notify = () => { if (!disposed) onChange(snapshot()); };
  function detach() { if (!attachment) return; attachment.detach(); disposeObject(attachment.model); attachment = null; }
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
  function setModel(next, value = {}) { ++request; detach(); model=next; settings=normalizeEquipment(); loading=false; error=''; return select(value); }
  function dispose() { disposed=true; ++request; detach(); model=null; loading=false; }
  return { snapshot, select, setModel, dispose };
}