// Base XYZ and shaft roll are independent saved values. Legacy grips imply zero roll.
export const normalizeShaftRoll = value => Number.isFinite(value) ? Math.max(-180, Math.min(180, value)) : 0;
export function weaponGripQuaternion(THREE, rotation, axis, roll = 0) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation.map(THREE.MathUtils.degToRad), 'XYZ'))
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis).normalize(), THREE.MathUtils.degToRad(normalizeShaftRoll(roll))));
}
export function gripSettingsReport(model, weapon, settings) {
  return {format:'adventure-party-grip-settings',version:1,modelId:model.id,modelName:model.label,
    weaponId:weapon.id,weaponName:weapon.label,attachmentHand:weapon.attachmentHand || 'right',
    positionSpace:'hand-local',rotationOrder:'XYZ',angleUnit:'degrees',shaftAxis:[...weapon.primaryAxis],
    settings:JSON.parse(JSON.stringify(settings))};
}
