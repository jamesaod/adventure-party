/** Build a portable, human-readable Studio weapon-pose profile package manifest. */
export const WEAPON_POSE_PACKAGE_FORMAT = 'adventure-party-weapon-pose-profile';
export const WEAPON_POSE_PACKAGE_VERSION = 1;

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a finite number.`);
  return number;
}

export function createWeaponPoseProfilePackage({
  profile, mob, model, equipment, poses, combatMappings, studio, notes = ''
}) {
  if (!profile?.id || !profile?.name) throw new Error('Profile ID and name are required.');
  if (!mob?.type) throw new Error('MOB type is required.');
  if (!model?.id) throw new Error('Model ID is required.');
  if (!equipment?.appearanceId) throw new Error('Equipment appearance ID is required.');
  const normalizedPoses = {};
  for (const [name, pose] of Object.entries(poses || {})) {
    if (!pose?.animation || !pose?.sourceId) throw new Error(`Pose ${name} needs an animation and source ID.`);
    normalizedPoses[name] = {
      animation: pose.animation,
      sourceId: pose.sourceId,
      timeSeconds: finiteNumber(pose.timeSeconds, `${name} time`),
      frameNumber: Number.isFinite(pose.frameNumber) ? Math.round(pose.frameNumber) : null,
      sampleRate: Number.isFinite(pose.sampleRate) ? pose.sampleRate : null,
      gripCorrection: pose.gripCorrection || null,
      note: String(pose.note || '')
    };
  }
  return {
    format: WEAPON_POSE_PACKAGE_FORMAT,
    version: WEAPON_POSE_PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    profile: { id: profile.id, name: profile.name, revision: Math.max(1, Math.floor(profile.revision || 1)), visualClass: profile.visualClass || null },
    mob: { type: mob.type, name: mob.name || null, heightInches: mob.heightInches ?? null },
    model: { id: model.id, asset: model.asset || null, sha256: model.sha256 || null, skeletonProfile: model.skeletonProfile || null, bodyReferenceHeightInches: model.bodyReferenceHeightInches ?? null },
    equipment: structuredClone(equipment),
    poses: normalizedPoses,
    combatMappings: { ready: combatMappings?.ready || 'ready', attack: combatMappings?.attack || 'attack', prone: combatMappings?.prone || 'prone' },
    studio: structuredClone(studio || {}),
    notes: String(notes || '')
  };
}

export function profileJsonBlob(packageData) {
  return new Blob([`${JSON.stringify(packageData, null, 2)}\n`], { type: 'application/json' });
}