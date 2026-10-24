import { studioWeapon } from './studio-equipment.mjs?v=R238C75';
import { studioShield } from './studio-shield.mjs?v=R238C72';
import { WEAPON_POSE_PROFILES, poseProfileForHumanoid, resolveHumanoidAnimationState, humanoidSpriteFamilySignature } from './humanoid-animation-catalog.mjs?v=R238C72';
export { WEAPON_POSE_PROFILES };

/** Adventure Party pending first pass: MOB height + equipment appearance recipes. */
export const MOB_HEIGHT_VERSION = 1;

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
  fighter: Object.freeze({ heightInches: inches(6, 4), authored: true, label: 'Dungeon Crawler Carl' }),
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

function visibleWeapon(id, itemName, studioId) {
  const preset = studioWeapon(studioId);
  if (!preset) throw new Error(`Missing Studio weapon preset: ${studioId}`);
  return Object.freeze({
    id,
    itemName,
    studioId,
    visualClass: preset.visualClass,
    poseProfileId: preset.poseProfileId,
    asset: preset.file,
    attachmentBone: 'mixamorig:RightHand',
    handsRequired: preset.handsRequired ?? 1,
    primaryAxis: Object.freeze([...preset.primaryAxis]),
    secondaryGrip: preset.secondaryGrip ? Object.freeze([...preset.secondaryGrip]) : null,
    grip: Object.freeze({
      position: Object.freeze([...preset.position]),
      rotationDegrees: Object.freeze([...preset.rotation]),
      sizePercent: preset.defaultSizePercent ?? 100
    })
  });
}

export const VISIBLE_WEAPON_ASSETS = Object.freeze({
  'flaming-sword-5': visibleWeapon('flaming-sword-5', 'Flaming Sword +5', 'medieval-sword'),
  'battle-axe': visibleWeapon('battle-axe', 'Battle Axe', 'battle-axe'),
  'two-handed-sword': visibleWeapon('two-handed-sword', 'Two-Handed Sword', 'medieval-two-handed-sword')
});

function visibleShield(id,itemName,studioId){
  const preset=studioShield(studioId);
  if(!preset)throw new Error(`Missing Studio shield preset: ${studioId}`);
  return Object.freeze({
    id,itemName,studioId,
    visualClass:preset.visualClass,
    representation:preset.representation,
    asset:preset.file,
    attachmentBone:'mixamorig:LeftHand',
    sourceSha256:preset.sourceSha256,
    assetSha256:preset.assetSha256,
    mount:Object.freeze({
      position:Object.freeze([...preset.position]),
      rotationDegrees:Object.freeze([...preset.rotation]),
      sizePercent:preset.defaultSizePercent??100
    })
  });
}

export const VISIBLE_SHIELD_ASSETS=Object.freeze({
  'round-wooden-shield':visibleShield('round-wooden-shield','Round Wooden Shield','round-wooden-shield')
});

export function appearanceRecipeForMob(unit, { modelId, modelHash, modelUrl = null, bodyReferenceHeightInches, poseProfile = null, renderSettings = {}, presentationAction = null, presentationConditions = [] } = {}) {
  if (!unit) throw new Error('A MOB is required.');
  applyMobHeight(unit);
  const inventory = Array.isArray(unit.inventory) ? unit.inventory : [];
  const equipped = inventory.find(item => item?.slot === 'weapon' && item?.equipped) || null;
  const visual = equipped?.appearanceId ? VISIBLE_WEAPON_ASSETS[equipped.appearanceId] : null;
  const equippedShield=inventory.find(item=>item?.slot==='shield'&&item?.equipped)||null;
  const shieldVisual=equippedShield?.appearanceId?VISIBLE_SHIELD_ASSETS[equippedShield.appearanceId]:null;
  const animationState=resolveHumanoidAnimationState(unit,{
    action:presentationAction,
    conditions:presentationConditions,
    equipmentAnimationId:visual?.poseProfileId||null
  });
  const profile=poseProfile||poseProfileForHumanoid(animationState.semanticId);
  const spriteFamilySignature=humanoidSpriteFamilySignature(unit,{
    action:presentationAction,
    conditions:presentationConditions,
    equipmentAnimationId:visual?.poseProfileId||null,
    modelId,modelHash,renderVersion:renderSettings?.renderer||null
  });
  return {
    format: 'adventure-party-mob-appearance-recipe',
    version: 1,
    mob: { id: unit.id || null, type: unit.type || null, name: unit.name || null, heightInches: unit.heightInches },
    model: { id: modelId || null, hash: modelHash || null, url: modelUrl || null, bodyReferenceHeightInches: bodyReferenceHeightInches ?? null },
    equipment: visual ? { itemName: equipped.name, appearanceId: equipped.appearanceId, ...visual } : null,
    shield: shieldVisual ? { itemName: equippedShield.name, appearanceId: equippedShield.appearanceId, ...shieldVisual } : null,
    animation: { ...animationState, spriteFamilySignature },
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