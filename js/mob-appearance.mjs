/** Adventure Party pending first pass: MOB height + equipment appearance recipes. */
export const MOB_HEIGHT_VERSION = 1;
export const POSE_PROFILE_VERSION = 1;

export function inches(feet, extraInches = 0) {
  const total = Number(feet) * 12 + Number(extraInches);
  if (!Number.isFinite(total) || total <= 0) throw new Error('MOB height must be positive.');
  return Math.round(total);
}

export function formatHeight(totalInches) {
  if (!Number.isFinite(totalInches) || totalInches <= 0) return 'Uncalibrated';
  const rounded = Math.round(totalInches);
  return `${Math.floor(rounded / 12)}′${rounded % 12}″`;
}

/**
 * Height is body height, not the current pose/equipment bounds.
 * null keeps a legacy MOB at its existing render scale until an authored height is assigned.
 */
export const MOB_HEIGHTS = Object.freeze({
  fighter: Object.freeze({ heightInches: inches(6, 3), authored: true, label: 'Dungeon Crawler Carl' }),
  ranger: Object.freeze({ heightInches: null, authored: false, label: 'Elven Ranger' }),
  mage: Object.freeze({ heightInches: null, authored: false, label: 'Baub' }),
  kobold: Object.freeze({ heightInches: null, authored: false, label: 'Kobold' }),
  'kobold-bodyguard': Object.freeze({ heightInches: null, authored: false, label: 'Kobold Body Guard' }),
  'kobold-slinger': Object.freeze({ heightInches: null, authored: false, label: 'Kobold Slinger' }),
  orc: Object.freeze({ heightInches: null, authored: false, label: 'Orc' }),
  'orc-leader': Object.freeze({ heightInches: null, authored: false, label: 'Orc Leader' }),
  'orc-shaman': Object.freeze({ heightInches: null, authored: false, label: 'Orc Shaman' }),
  'juvenile-red-dragon': Object.freeze({ heightInches: null, authored: false, label: 'Juvenile Red Dragon' })
});

export function applyMobHeight(unit) {
  if (!unit || typeof unit !== 'object') return unit;
  const definition = MOB_HEIGHTS[unit.type];
  if (!Object.prototype.hasOwnProperty.call(unit, 'heightInches')) {
    unit.heightInches = definition?.heightInches ?? null;
  }
  unit.heightAuthored = unit.heightInches != null ? true : !!definition?.authored;
  return unit;
}

export function bodyScaleForHeight({ targetHeightInches, referenceHeightInches }) {
  if (!Number.isFinite(targetHeightInches) || targetHeightInches <= 0) return 1;
  if (!Number.isFinite(referenceHeightInches) || referenceHeightInches <= 0) {
    throw new Error('A model body reference height is required before Height can drive scale.');
  }
  return targetHeightInches / referenceHeightInches;
}

function freezePose(pose) {
  return Object.freeze({
    animation: String(pose.animation || ''),
    sourceId: String(pose.sourceId || ''),
    timeSeconds: Number(pose.timeSeconds || 0),
    gripCorrection: pose.gripCorrection ? structuredClone(pose.gripCorrection) : null
  });
}

export const WEAPON_POSE_PROFILES = Object.freeze({
  'one-handed-swing-v1': Object.freeze({
    id: 'one-handed-swing-v1',
    version: POSE_PROFILE_VERSION,
    label: 'One-handed swinging weapon',
    handedness: 'one-handed',
    attackStyle: 'swing',
    compatibleVisualClasses: Object.freeze(['sword', 'battle-axe']),
    poses: Object.freeze({
      ready: freezePose({ animation: 'UAL2_Sword_Ready', sourceId: 'UAL2_Sword_Ready', timeSeconds: 0 }),
      attack: freezePose({ animation: 'UAL2_Sword_Regular_A', sourceId: 'UAL2_Sword_Regular_A', timeSeconds: 0.30 }),
      prone: freezePose({ animation: 'fall', sourceId: 'fall', timeSeconds: 1.20 })
    })
  })
});

export const VISIBLE_WEAPON_ASSETS = Object.freeze({
  'flaming-sword-5': Object.freeze({
    id: 'flaming-sword-5',
    itemName: 'Flaming Sword +5',
    visualClass: 'sword',
    poseProfileId: 'one-handed-swing-v1',
    asset: 'assets/models/weapons/swords/medieval-sword.glb',
    attachmentBone: 'mixamorig:RightHand',
    grip: Object.freeze({ position: [0.015, 0.05, 0.005], rotationDegrees: [0, -90, 0], sizePercent: 100 })
  }),
  'battle-axe': Object.freeze({
    id: 'battle-axe',
    itemName: 'Battle Axe',
    visualClass: 'battle-axe',
    poseProfileId: 'one-handed-swing-v1',
    asset: 'assets/models/weapons/battle-axes/battle-axe.glb',
    attachmentBone: 'mixamorig:RightHand',
    grip: Object.freeze({ position: [0.015, 0.05, 0.005], rotationDegrees: [0, 90, 0], sizePercent: 75 })
  })
});

export function appearanceRecipeForMob(unit, { modelId, modelHash, bodyReferenceHeightInches, renderSettings = {} } = {}) {
  if (!unit) throw new Error('A MOB is required.');
  applyMobHeight(unit);
  const inventory = Array.isArray(unit.inventory) ? unit.inventory : [];
  const equipped = inventory.find(item => item?.slot === 'weapon' && item?.equipped) || null;
  const visual = equipped?.appearanceId ? VISIBLE_WEAPON_ASSETS[equipped.appearanceId] : null;
  const profile = visual ? WEAPON_POSE_PROFILES[visual.poseProfileId] : null;
  return {
    format: 'adventure-party-mob-appearance-recipe',
    version: 1,
    mob: { id: unit.id || null, type: unit.type || null, name: unit.name || null, heightInches: unit.heightInches },
    model: { id: modelId || null, hash: modelHash || null, bodyReferenceHeightInches: bodyReferenceHeightInches ?? null },
    equipment: visual ? { itemName: equipped.name, appearanceId: equipped.appearanceId, ...visual } : null,
    poseProfile: profile || null,
    renderSettings: structuredClone(renderSettings)
  };
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function appearanceCacheKey(recipe) {
  // Deterministic non-cryptographic key suitable for an in-memory/browser cache namespace.
  const text = canonical(recipe);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `mob-appearance-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export class MobAppearanceCache {
  constructor(limit = 24) { this.limit = Math.max(1, Math.floor(limit)); this.entries = new Map(); }
  get(key) {
    const hit = this.entries.get(key);
    if (!hit) return null;
    this.entries.delete(key); this.entries.set(key, hit);
    return hit;
  }
  set(key, spriteSet) {
    this.entries.delete(key); this.entries.set(key, spriteSet);
    while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value);
    return spriteSet;
  }
}