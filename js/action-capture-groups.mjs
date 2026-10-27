import {ACTION_PROFILE_CATALOG, ACTION_POSES} from './action-profile-catalog.mjs?v=R238C172';

export const CAPTURE_FORMAT_VERSION=2;
export const WEAPON_CAPTURE_POSES=Object.freeze(['ready','windup','attack']);
export const SHARED_CAPTURE_GROUPS=Object.freeze({
  magic:Object.freeze({id:'magic',label:'Magic',poses:Object.freeze(['casting-windup','cast'])}),
  'death-prone':Object.freeze({id:'death-prone',label:'Death/Prone animation',poses:Object.freeze(['falling','prone'])})
});
export const CAPTURE_GROUP_CATALOG=new Map([
  ...[...ACTION_PROFILE_CATALOG.values()].map(profile=>[profile.id,{...profile,poses:WEAPON_CAPTURE_POSES}]),
  ...Object.entries(SHARED_CAPTURE_GROUPS)
]);
export const isSharedCaptureGroup=id=>Object.hasOwn(SHARED_CAPTURE_GROUPS,id);
export const capturePosesForGroup=id=>CAPTURE_GROUP_CATALOG.get(id)?.poses||[];
export function captureGroupForPose(profileId,pose){
  if(!CAPTURE_GROUP_CATALOG.has(profileId)||!ACTION_POSES.includes(pose))throw Error('Choose a weapon type or shared action group and action pose.');
  const shared=Object.values(SHARED_CAPTURE_GROUPS).find(group=>group.poses.includes(pose));
  if(shared)return shared.id;
  if(isSharedCaptureGroup(profileId))throw Error('This pose belongs to a weapon type.');
  return profileId;
}
export const captureGroupPath=id=>`${isSharedCaptureGroup(id)?'shared':'profiles'}/${id}`;

// Migration selects the active weapon's fresh frame first, then the catalog's
// stable order. Keep all old shared captures separately for explicit recovery.
export function splitCaptureGroups(profiles={},shared={},preferred='one-handed-swing',legacy={}){
  const result={profiles:{},sharedActionGroups:{magic:{},'death-prone':{}},legacySharedPoses:{...legacy}};
  for(const [id,poses] of Object.entries(profiles)){
    if(!ACTION_PROFILE_CATALOG.has(id))continue;
    result.profiles[id]=Object.fromEntries(WEAPON_CAPTURE_POSES.filter(p=>poses[p]!=null).map(p=>[p,poses[p]]));
    const archived=Object.fromEntries(ACTION_POSES.filter(p=>!WEAPON_CAPTURE_POSES.includes(p)&&poses[p]!=null).map(p=>[p,poses[p]]));
    if(Object.keys(archived).length)result.legacySharedPoses[id]={...result.legacySharedPoses[id],...archived};
  }
  const order=[...new Set([preferred,...ACTION_PROFILE_CATALOG.keys()])];
  for(const group of Object.values(SHARED_CAPTURE_GROUPS))for(const pose of group.poses){
    // Explicit null means deliberately cleared; never resurrect archived frames.
    if(Object.hasOwn(shared[group.id]||{},pose))result.sharedActionGroups[group.id][pose]=shared[group.id][pose];
    else {
      const candidates=order.map(id=>profiles[id]?.[pose]).filter(Boolean);
      const selected=candidates.find(value=>!value.stale)||candidates[0];
      if(selected)result.sharedActionGroups[group.id][pose]=selected;
    }
  }
  return result;
}
export function upgradeCaptureWorkspace(workspace){
  if(workspace.captureFormatVersion===CAPTURE_FORMAT_VERSION)return workspace;
  if(workspace.captureFormatVersion!==undefined)throw Error('Unsupported capture format version.');
  const selected=workspace.settings.actionProfileId||'one-handed-swing';
  const input={...workspace.actionProfiles,[selected]:workspace.captures};
  const split=splitCaptureGroups(input,workspace.sharedActionGroups,selected,workspace.legacySharedCaptures);
  return {...workspace,captureFormatVersion:CAPTURE_FORMAT_VERSION,actionProfiles:split.profiles,
    sharedActionGroups:split.sharedActionGroups,legacySharedCaptures:split.legacySharedPoses,
    captures:split.profiles[selected]||{},settings:{...workspace.settings,weaponActionProfileId:selected}};
}
export function combinedCaptureGroup(workspace,profileId=workspace.settings.weaponActionProfileId||workspace.settings.actionProfileId){
  const next=upgradeCaptureWorkspace(workspace);
  const id=ACTION_PROFILE_CATALOG.has(profileId)?profileId:'one-handed-swing';
  return {...next.actionProfiles?.[id],...next.sharedActionGroups?.magic,...next.sharedActionGroups?.['death-prone']};
}
export function assertCompatibleCaptureFrames(captures){
  const rows=Object.values(captures).filter(value=>value&&!value.stale),first=rows[0];
  for(const row of rows.slice(1))for(const key of ['width','height','anchorX','anchorY','renderWidth','renderHeight','modelScalePercent','hexScalePercent','battlefieldWidth','battlefieldHeight']){
    if(row[key]!==first[key])throw Error('Shared and weapon captures use different framing. Recapture the affected group at the same model size and resolution before testing in combat.');
  }
  return captures;
}
