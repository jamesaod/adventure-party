/**
 * Adventure Party action profiles v2.
 * Extensible data definitions: add profiles without modifying the renderer.
 * A missing pose is deliberately null. It must be rendered with the unit's
 * fallback sprite, not by substituting another animation/pose.
 */
export const ACTION_POSES=Object.freeze(['ready','windup','attack','falling','prone']);
export const DEFAULT_ACTION_PROFILE_IDS=Object.freeze([
  'one-handed-swing','two-handed-swing','one-handed-thrust','two-handed-thrust',
  'dual-wield','unarmed','spell-casting','bow','direct-fire','sling','throw'
]);
const DEFINITIONS=Object.freeze([
  ['one-handed-swing','1H Swing (Slash / Bludgeon)','melee'],
  ['two-handed-swing','2H Swing (Slash / Bludgeon)','melee'],
  ['one-handed-thrust','1H Stab (Pierce)','melee'],
  ['two-handed-thrust','2H Stab (Pierce)','melee'],
  ['dual-wield','Dual Weapons','melee'],
  ['unarmed','Bare Handed','melee'],
  ['spell-casting','Spell Casting','casting'],
  ['bow','Bow Weapons','ranged'],
  ['direct-fire','Direct Fire Weapons (Crossbow)','ranged'],
  ['sling','Slings','ranged'],
  ['throw','Throw','ranged']
]);
const validId=id=>typeof id==='string'&&/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id);
function normalizePose(pose){
  if(pose==null)return null;
  if(typeof pose!=='object'||typeof pose.animation!=='string'||!pose.animation.trim()||
    !Number.isFinite(pose.timeSeconds)||pose.timeSeconds<0)
    throw new Error('Each assigned pose needs an animation name and nonnegative frame time.');
  return Object.freeze({animation:pose.animation,sourceId:pose.sourceId||pose.animation,
    timeSeconds:pose.timeSeconds,gripCorrection:pose.gripCorrection??null});
}
export function defineActionProfile({id,label,category='custom',poses={},sharedProne=true}){
  if(!validId(id)||typeof label!=='string'||!label.trim())throw new Error('Invalid action profile ID or label.');
  if(!poses||typeof poses!=='object'||Object.keys(poses).some(key=>!ACTION_POSES.includes(key)))
    throw new Error('Unknown action-profile pose name.');
  return Object.freeze({id,label,category,sharedProne,
    poses:Object.freeze(Object.fromEntries(ACTION_POSES.map(pose=>[pose,normalizePose(poses[pose])])))});
}
export function createActionProfileCatalog(extraProfiles=[]){
  const catalog=new Map(DEFINITIONS.map(([id,label,category])=>[id,defineActionProfile({id,label,category})]));
  for(const profile of extraProfiles){
    const normalized=defineActionProfile(profile);
    if(catalog.has(normalized.id))throw new Error('Duplicate action profile: '+normalized.id);
    catalog.set(normalized.id,normalized);
  }
  return catalog;
}
export function resolveActionPose(profile,poseName,sharedProne=null){
  if(!ACTION_POSES.includes(poseName))throw new Error('Unknown pose: '+poseName);
  const defined=profile?.poses?.[poseName]??null;
  if(defined)return {source:'profile',pose:defined};
  if(poseName==='prone'&&profile?.sharedProne&&sharedProne)
    return {source:'shared-prone',pose:normalizePose(sharedProne)};
  return {source:'fallback-sprite',pose:null};
}
export const ACTION_PROFILE_CATALOG=createActionProfileCatalog();
