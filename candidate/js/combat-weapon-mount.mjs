/**
 * Resolve combat equipment against the exact Studio pose used for capture.
 * A saved grip applies only to the same weapon ID. Otherwise a model-scoped
 * catalog grip may apply; unrelated weapons use their own normal preset.
 */
const triple = value => Array.isArray(value) && value.length === 3 &&
  value.every(Number.isFinite);
export function resolveCombatWeaponMount(equipped, renderSettings = {}, preset = {}) {
  const id = equipped?.studioId || equipped?.appearanceId;
  const saved = renderSettings?.equipment;
  const profile = renderSettings?.weaponAttachmentProfile;
  const source = saved?.rightHand === id && triple(saved.position) && triple(saved.rotation)
    ? saved
    : profile?.weaponId === id && triple(profile.position) && triple(profile.rotation)
      ? profile : null;
  return {
    position: [...(source?.position || (triple(equipped?.grip?.position) ? equipped.grip.position : preset.position))],
    rotation: [...(source?.rotation || (triple(equipped?.grip?.rotationDegrees) ? equipped.grip.rotationDegrees : preset.rotation))],
    sizePercent: Number.isFinite(source?.sizePercent) ? source.sizePercent
      : Number.isFinite(equipped?.grip?.sizePercent) ? equipped.grip.sizePercent
      : preset.defaultSizePercent || 100
  };
}
