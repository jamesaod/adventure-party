// Palm frames measured from the uniformed orc's index/pinky knuckles.
// These are model-local mounts, not changes to the weapons' import axes.
// +Y runs from the little finger toward the thumb/blade; +X spans the grip.
export function orcWeaponFit(modelId, weapon, slot = 'main') {
  if (modelId !== 'male-orc' || weapon?.presetRevision !== 100 || slot === 'shield') return null;
  const left = slot === 'off' || weapon.attachmentHand === 'left';
  // Crossbows use a transverse trigger grip rather than the long weapon axis.
  const rotation = weapon.visualClass === 'crossbow'
    ? (left ? [115.068062, 71.943847, -26.196415] : [8.964754, -40.216029, 95.815928])
    : (left ? [-180, -7.864272, -73.694829] : [0, 49.436416, 96.833919]);
  return {
    rightHand: weapon.id,
    presetRevision: weapon.presetRevision,
    sizePercent: 100,
    position: left ? [0.005, 0.065, -0.012] : [0, 0.05, 0],
    rotation,
    shaftRollDegrees: 0,
    secondaryGripOffsetInches: [0, 0, 0]
  };
}
