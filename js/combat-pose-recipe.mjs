import { loadStudioWorkspace, loadStudioDraft, upgradeStudioWorkspaceHexScale } from './sprite-set-store.mjs?v=R238C57';
import { poseProfileForHumanoid } from './humanoid-animation-catalog.mjs?v=R238C72';

const REQUIRED_POSES = Object.freeze(['ready','attack','prone']);
const WINDUP_POSES = Object.freeze(['ready','windup','attack','prone']);

function finite(value, fallback = null) {
  return Number.isFinite(value) ? value : fallback;
}
function vec3(value, fallback = [0,0,0]) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)
    ? value.slice() : fallback.slice();
}
function completeCaptureWorkspace(workspace) {
  if (!workspace?.settings || !workspace?.captures) return false;
  // Incomplete capture sets are valid; absent poses are intentionally fallback sprites.
  const identity = `${workspace.settings.libraryModelId || ''} ${workspace.settings.modelName || ''} ${workspace.name || ''}`.toLowerCase();
  return workspace.settings.mobType === 'fighter' || identity.includes('carl');
}
/** Resolve saved Studio captures to the *same* baked model for combat.
 * Paths are restricted to versioned assets from the repository model catalog.
 * A raw source model may identify its animation-baked combat counterpart.
 */
export function compatibleStudioCombatModel(settings, catalog, mobType = 'fighter') {
  const id = settings?.libraryModelId || settings?.unitCalibration?.modelId;
  if (!id || !Array.isArray(catalog?.models)) return null;
  const original = catalog.models.find(entry => entry?.id === id && entry.mobType === mobType);
  if (!original) return null;
  const resolved = catalog.models.find(entry =>
    entry?.id === (original.combatModelId || original.id) && entry.mobType === mobType);
  if (!resolved || typeof resolved.file !== 'string' ||
      !/^assets\/models\/(?:[a-zA-Z0-9_-]+\/)+[a-zA-Z0-9_.-]+\.glb$/.test(resolved.file)) return null;
  const attachmentProfile = resolved.weaponAttachmentProfileId
    ? catalog.weaponAttachmentProfiles?.[resolved.weaponAttachmentProfileId] : null;
  const validTriple = value => Array.isArray(value) && value.length === 3 &&
    value.every(Number.isFinite);
  return {
    modelId: resolved.id,
    modelHash: `catalog:${resolved.id}:${resolved.file}`,
    modelUrl: `../${resolved.file}`,
    bodyReferenceHeightInches: Number.isFinite(settings?.unitCalibration?.measuredHeightInches)
      ? settings.unitCalibration.measuredHeightInches : 76,
    weaponAttachmentProfile: attachmentProfile?.weaponId &&
      validTriple(attachmentProfile.position) && validTriple(attachmentProfile.rotation)
      ? {
          weaponId: attachmentProfile.weaponId,
          position: [...attachmentProfile.position],
          rotation: [...attachmentProfile.rotation]
        } : null
  };
}

function fallbackRecipe(reason = 'No complete Carl capture workspace was found.') {
  return {
    source: 'built-in-profile',
    reason,
    poseProfile: structuredClone(poseProfileForHumanoid('one-handed-swing')),
    renderSettings: {
      source: 'built-in-profile',
      renderer: 'combat-offscreen-v2',
      poses: REQUIRED_POSES,
      facings: ['E','NE','NW','W','SW','SE']
    }
  };
}

/**
 * The Studio's saved capture workspace is the authoritative pose recipe.
 * Captured PNG pixels are deliberately ignored here: combat re-evaluates the
 * model at the recorded animation/time and renders current equipment on demand.
 */
export async function loadCombatPoseRecipe({ mobType = 'fighter', fromCombat = false } = {}) {
  let workspace;
  try {
    // "Test in combat" atomically saves its exact frames and settings together.
    // The ordinary Studio workspace may have changed since that snapshot.
    workspace = await loadStudioWorkspace({ fromCombat });
  } catch (error) {
    if (fromCombat) throw new Error(`Combat capture workspace could not be read: ${error?.message || error}`);
    return fallbackRecipe(`Studio capture workspace could not be read: ${error?.message || error}`);
  }
  if (!workspace) {
    if (fromCombat) throw new Error('Combat test capture is missing; keep its existing sprites instead of replacing them with generic Carl art.');
    return fallbackRecipe();
  }
  try { workspace = upgradeStudioWorkspaceHexScale(workspace); }
  catch (error) {
    if (fromCombat) throw error;
    return fallbackRecipe(`Studio capture workspace needs repair: ${error?.message || error}`);
  }
  if (!completeCaptureWorkspace(workspace)) {
    if (fromCombat) throw new Error('Combat test workspace metadata is incomplete; keeping saved sprites.');
    return fallbackRecipe('The saved Studio workspace does not contain Ready, Attack and Prone captures for Carl.');
  }

  const settings = workspace.settings;
  const captures = workspace.captures;
  if (Object.values(captures).some(pose => pose?.stale)) {
    if (fromCombat) throw new Error('Combat test captures are outdated; keeping the last valid sprites.');
    return fallbackRecipe('Studio captures were changed after saving. Recapture the three poses to use them in combat.');
  }
  // Saved Mixamo pose names are model-specific. Never apply one character's
  // capture timestamps to the fixed legacy Carl GLB by accident.
  let combatModel = null;
  try {
    const response = await fetch(new URL('../data/studio-models.json', import.meta.url), { cache: 'no-cache' });
    if (response.ok) combatModel = compatibleStudioCombatModel(settings, await response.json(), mobType);
  } catch { /* The built-in profile remains usable when the library is unavailable. */ }
  if (!combatModel) {
    if (fromCombat) throw new Error('The saved combat capture model is unavailable; keeping its existing sprites.');
    return fallbackRecipe('The saved Studio capture has no matching repository combat model.');
  }
  const first = Object.values(captures).find(capture=>capture&&!capture.stale) || null;
  if (fromCombat) {
    // Reject a stale or unrelated workspace instead of silently shrinking a
    // validated battlefield sprite set after an equipment swap.
    const draft = await loadStudioDraft();
    const declared = draft?.manifest?.frame;
    const keys = ['width','height','renderWidth','renderHeight'];
    if (!declared || (first && keys.some(key => Math.abs((first[key] ?? NaN) - declared[key]) > 0.01 ||
        !Number.isFinite(first[key]) || !Number.isFinite(declared[key])))) {
      throw new Error('Saved combat frame dimensions differ from the Studio draft; keeping its original native-resolution sprites.');
    }
  }
  const profile = structuredClone(poseProfileForHumanoid('one-handed-swing'));
  profile.id = 'studio-captured-one-handed-swing-v1';
  profile.version = Math.max(2, Number(workspace.savedAt || 0));
  profile.label = 'Studio-captured one-handed swinging weapon';
  const capturePoses=Object.keys(captures).filter(name=>WINDUP_POSES.includes(name)&&!captures[name]?.stale);
  profile.poses = Object.fromEntries(capturePoses.map(name => {
    const capture = captures[name];
    return [name, {
      animation: capture.clip,
      sourceId: capture.clipSourceId || capture.clip,
      timeSeconds: capture.time,
      gripCorrection: null
    }];
  }));

  const draft=await loadStudioDraft();
  const frame = first ? {
    width:first.width,height:first.height,
    renderWidth:finite(first?.renderWidth,48),
    renderHeight:finite(first?.renderHeight,48*first.height/first.width),
    anchorX:first.anchorX,anchorY:first.anchorY
  } : draft?.manifest?.frame;
  if(!frame){if(fromCombat)throw new Error('Combat sprite frame metadata is unavailable.');return fallbackRecipe();}
  const factor = (finite(first?.modelScalePercent, finite(settings.modelScalePercent, 100)) / 100) *
    (finite(first?.hexScalePercent, finite(settings.hexScalePercent, 100)) / 100);

  return {
    source: 'studio-capture-workspace',
    reason: null,
    poseProfile: profile,
    model: combatModel,
    renderSettings: {
      source: 'studio-capture-workspace',
      renderer: 'combat-offscreen-v2',
      workspaceSavedAt: workspace.savedAt || null,
      frame,
      layoutId: first?.layout?.id || settings.layout?.id || settings.layoutId || 'single',
      resolutionPercent: first?.layout?.resolutionPercent || settings.layout?.resolutionPercent || settings.resolutionPercent || 100,
      modelScalePercent: finite(first.modelScalePercent, finite(settings.modelScalePercent, 100)),
      hexScalePercent: finite(first.hexScalePercent, finite(settings.hexScalePercent, 100)),
      transform: {
        heading: finite(settings.heading, 0),
        upAxis: settings.upAxis === 'Z' ? 'Z' : 'Y',
        frameHeight: finite(settings.frameHeight, finite(first?.render?.frameHeight, 10.58668090609295) / Math.max(factor, 0.0001)),
        center: vec3(settings.center, [0, 2.0595906310059133 / Math.max(factor, 0.0001), 0]),
        placement: {
          position: vec3(settings.placement?.position, [0,0,0]),
          scale: finite(settings.placement?.scale, 1)
        }
      },
      lighting: structuredClone(settings.lighting || first.render?.lighting || {}),
      shield: structuredClone(settings.shield || first.render?.shield || null),
      // Transfer the calibrated right-hand sword grip, not just the animation.
      equipment: structuredClone(settings.equipment || first.render?.equipment || null),
      appearanceRecolor: structuredClone(settings.appearanceRecolor || {hair:'default',metal:'default'}),
      weaponAttachmentProfile: structuredClone(combatModel.weaponAttachmentProfile || null),
      style: structuredClone(workspace.style || {}),
      poses: REQUIRED_POSES,
      facings: ['E','NE','NW','W','SW','SE']
    }
  };
}
