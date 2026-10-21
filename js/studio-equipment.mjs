// Rigid equipment stays a separate asset beneath the animated hand. The grip
// offset belongs to the weapon; socket position/rotation belong to the wearer.
export const STUDIO_WEAPONS = Object.freeze([
  Object.freeze({
    id: 'medieval-sword', label: 'Medieval Sword',
    file: 'assets/models/weapons/swords/medieval-sword.glb',
    grip: Object.freeze([0.34, 0.109, 0]), nativeScale: 0.55,
    // Carl's hand points along +Y; the thumb/index side is -Z. The source
    // sword points along -X, so this turn puts the blade on the thumb side.
    position: Object.freeze([0.015, 0.05, 0.005]),
    rotation: Object.freeze([0, -90, 0])
  })
]);

export const EQUIPMENT_LIMITS = Object.freeze({
  sizePercent: Object.freeze({ min: 25, max: 200, step: 5 }),
  position: Object.freeze({ min: -1, max: 1, step: 0.005 }),
  rotation: Object.freeze({ min: -180, max: 180, step: 1 })
});

const bounded = (value, fallback, range) => Number.isFinite(value)
  ? Math.min(range.max, Math.max(range.min, value)) : fallback;

export function studioWeapon(id) {
  return STUDIO_WEAPONS.find(weapon => weapon.id === id) || null;
}

export function normalizeEquipment(value = {}) {
  const weapon = studioWeapon(value?.rightHand);
  const preset = weapon || STUDIO_WEAPONS[0];
  const vector = (key) => preset[key].map((fallback, axis) =>
    bounded(value?.[key]?.[axis], fallback, EQUIPMENT_LIMITS[key]));
  return {
    version: 1, rightHand: weapon?.id || 'none',
    sizePercent: bounded(value?.sizePercent, 100, EQUIPMENT_LIMITS.sizePercent),
    position: vector('position'), rotation: vector('rotation')
  };
}

export function findRightHand(model) {
  let hand = null;
  model?.traverse(object => {
    if (!object.isBone) return;
    // GLTFLoader strips ':' from animated node names. FBX and older imported
    // models can retain it; neither spelling should silently lose equipment.
    const name = String(object.name).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (name === 'righthand' || name.endsWith('mixamorigrighthand')) hand ||= object;
  });
  return hand;
}

export function createWeaponAttachment(THREE, hand, model, settings) {
  const value = normalizeEquipment(settings), weapon = studioWeapon(value.rightHand);
  if (!hand?.isBone || !weapon || !model?.isObject3D) throw new Error('A weapon and a right-hand bone are required.');
  const socket = new THREE.Group();
  socket.name = 'StudioRightHandEquipment';
  socket.userData.studioEquipment = true;
  const grip = new THREE.Group();
  grip.name = 'WeaponGripOrigin';
  grip.position.fromArray(weapon.grip).multiplyScalar(-1);
  grip.add(model);
  socket.add(grip);
  hand.add(socket);
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

// Each request owns its loaded resources. A late response can never attach to a
// replacement character, and unequipping releases its GPU objects immediately.
export function createStudioEquipment({ THREE, loadAsset, disposeObject, onChange = () => {} }) {
  let model = null, settings = normalizeEquipment(), attachment = null;
  let loading = false, error = '', request = 0, disposed = false;
  const snapshot = () => ({
    settings: normalizeEquipment(settings), attached: !!attachment,
    rightHandBone: findRightHand(model)?.name || null, loading, error,
    socketWorldPosition: attachment?.socket.getWorldPosition(new THREE.Vector3()).toArray() || null
  });
  const notify = () => { if (!disposed) onChange(snapshot()); };
  function detach() {
    if (!attachment) return;
    attachment.detach();
    disposeObject(attachment.model);
    attachment = null;
  }
  async function select(value) {
    if (disposed) return false;
    const next = normalizeEquipment(value);
    const sameWeapon = next.rightHand === settings.rightHand;
    settings = next;
    if (sameWeapon && attachment && !loading) {
      attachment.update(settings);
      error = '';
      notify();
      return true;
    }
    const version = ++request;
    detach();
    loading = false;
    error = '';
    const weapon = studioWeapon(settings.rightHand);
    if (!weapon) { notify(); return true; }
    const hand = findRightHand(model);
    if (!hand) {
      error = 'This model has no supported right-hand bone. Load Dungeon Crawler Carl Ver 2 to test this sword.';
      notify();
      return false;
    }
    loading = true;
    notify();
    let asset;
    try {
      asset = await loadAsset(weapon);
      if (disposed || request !== version) { disposeObject(asset); return false; }
      attachment = createWeaponAttachment(THREE, hand, asset, settings);
      loading = false;
      notify();
      return true;
    } catch (cause) {
      if (asset) disposeObject(asset);
      if (disposed || request !== version) return false;
      loading = false;
      error = `The sword could not be loaded. ${cause?.message || cause} Use Reset grip to retry, or choose None.`;
      notify();
      return false;
    }
  }
  function setModel(next, value = {}) {
    ++request;
    detach();
    model = next;
    settings = normalizeEquipment();
    loading = false;
    error = '';
    return select(value);
  }
  function dispose() {
    disposed = true;
    ++request;
    detach();
    model = null;
    loading = false;
  }
  return { snapshot, select, setModel, dispose };
}
