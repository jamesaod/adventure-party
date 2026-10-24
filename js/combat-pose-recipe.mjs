import { loadStudioWorkspace, upgradeStudioWorkspaceHexScale } from './sprite-set-store.mjs?v=R238C57';
import { poseProfileForHumanoid } from './humanoid-animation-catalog.mjs?v=R238C72';

const REQUIRED_POSES = Object.freeze(['ready','attack','prone']);

function finite(value, fallback = null) {
  return Number.isFinite(value) ? value : fallback;
}
function vec3(value, fallback = [0,0,0]) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)
    ? value.slice() : fallback.slice();
}
function completeCaptureWorkspace(workspace) {
  if (!workspace?.settings || !workspace?.captures) return false;
  if (!REQUIRED_POSES.every(pose => workspace.captures[pose])) return false;
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
  return {
    modelId: resolved.id,
    modelHash: `catalog:${resolved.id}:${resolved.file}`,
    modelUrl: `../${resolved.file}`,
    bodyReferenceHeightInches: Number.isFinite(settings?.unitCalibration?.measuredHeightInches)
      ? settings.unitCalibration.measuredHeightInches : 76
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
export async function loadCombatPoseRecipe({ mobType = 'fighter' } = {}) {
  let workspace;
  try {
    workspace = await loadStudioWorkspace();
  } catch (error) {
    return fallbackRecipe(`Studio capture workspace could not be read: ${error?.message || error}`);
  }
  if (!workspace) return fallbackRecipe();
  try { workspace = upgradeStudioWorkspaceHexScale(workspace); }
  catch (error) { return fallbackRecipe(`Studio capture workspace needs repair: ${error?.message || error}`); }
  if (!completeCaptureWorkspace(workspace)) {
    return fallbackRecipe('The saved Studio workspace does not contain Ready, Attack and Prone captures for Carl.');
  }

  const settings = workspace.settings;
  const captures = workspace.captures;
  if (REQUIRED_POSES.some(pose => captures[pose]?.stale)) {
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
    return fallbackRecipe('The saved Studio capture has no matching repository combat model.');
  }
  const first = captures.ready;
  const profile = structuredClone(poseProfileForHumanoid('one-handed-swing'));
  profile.id = 'studio-captured-one-handed-swing-v1';
  profile.version = Math.max(2, Number(workspace.savedAt || 0));
  profile.label = 'Studio-captured one-handed swinging weapon';
  profile.poses = Object.fromEntries(REQUIRED_POSES.map(name => {
    const capture = captures[name];
    return [name, {
      animation: capture.clip,
      sourceId: capture.clipSourceId || capture.clip,
      timeSeconds: capture.time,
      gripCorrection: null
    }];
  }));

  const frame = {
    width: first.width,
    height: first.height,
    renderWidth: finite(first.renderWidth, 48),
    renderHeight: finite(first.renderHeight, 48 * first.height / first.width),
    anchorX: first.anchorX,
    anchorY: first.anchorY
  };
  const factor = (finite(first.modelScalePercent, finite(settings.modelScalePercent, 100)) / 100) *
    (finite(first.hexScalePercent, finite(settings.hexScalePercent, 100)) / 100);

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
      layoutId: first.layout?.id || settings.layout?.id || settings.layoutId || 'single',
      resolutionPercent: first.layout?.resolutionPercent || settings.layout?.resolutionPercent || settings.resolutionPercent || 100,
      modelScalePercent: finite(first.modelScalePercent, finite(settings.modelScalePercent, 100)),
      hexScalePercent: finite(first.hexScalePercent, finite(settings.hexScalePercent, 100)),
      transform: {
        heading: finite(settings.heading, 0),
        upAxis: settings.upAxis === 'Z' ? 'Z' : 'Y',
        frameHeight: finite(settings.frameHeight, finite(first.render?.frameHeight, 10.58668090609295) / Math.max(factor, 0.0001)),
        center: vec3(settings.center, [0, 2.0595906310059133 / Math.max(factor, 0.0001), 0]),
        placement: {
          position: vec3(settings.placement?.position, [0,0,0]),
          scale: finite(settings.placement?.scale, 1)
        }
      },
      lighting: structuredClone(settings.lighting || first.render?.lighting || {}),
      shield: structuredClone(settings.shield || first.render?.shield || null),
      style: structuredClone(workspace.style || {}),
      poses: REQUIRED_POSES,
      facings: ['E','NE','NW','W','SW','SE']
    }
  };
}
