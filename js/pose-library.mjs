import {ACTION_POSES,ACTION_PROFILE_CATALOG,DEFAULT_ACTION_PROFILE_IDS} from './action-profile-catalog.mjs?v=R238C176';
import {CAPTURE_GROUP_CATALOG,WEAPON_CAPTURE_POSES,SHARED_CAPTURE_GROUPS,captureGroupForPose,isSharedCaptureGroup,splitCaptureGroups} from './action-capture-groups.mjs?v=R238C176';
import {poseWithFallback} from './pose-fallbacks.mjs?v=R238C176';
export const POSE_LIBRARY_SCHEMA='adventure-party.pose-library';
export const POSE_LIBRARY_VERSION=2;
export const HUMANOID_SIZES=Object.freeze(['small','medium','large']);
export const validAuthoringId=id=>typeof id==='string'&&id.length<=100&&/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=(value,label,max=160)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(`Invalid ${label}.`);return value.trim();};
export function normalizePoseSample(value){
  if(value==null)return null;
  if(!object(value)||!Number.isFinite(value.timeSeconds)||value.timeSeconds<0||value.timeSeconds>86400)throw Error('Pose needs a valid animation time.');
  if(Object.keys(value).some(key=>!['animation','sourceId','timeSeconds'].includes(key)))throw Error('Shared poses contain animation references only; keep model, pixels and grip settings with the MOB.');
  return {animation:text(value.animation,'animation name'),sourceId:text(value.sourceId,'animation source ID',250),timeSeconds:value.timeSeconds};
}
export function normalizePoseLibrary(value){
  if(!object(value)||value.schema!==POSE_LIBRARY_SCHEMA||![1,2].includes(value.version))throw Error('Unsupported pose library.');
  if(!validAuthoringId(value.id))throw Error('Pose library ID must use lowercase words separated by hyphens.');
  if(value.bodyFamily!=='humanoid'||!HUMANOID_SIZES.includes(value.size))throw Error('Choose a humanoid Small, Medium or Large pose library.');
  if(!Number.isInteger(value.revision)||value.revision<0)throw Error('Invalid pose library revision.');
  if(!object(value.profiles)||Object.keys(value.profiles).some(id=>!ACTION_PROFILE_CATALOG.has(id)))throw Error('Unknown weapon type in pose library.');
  if(Object.keys(value).some(key=>!['schema','version','id','name','bodyFamily','size','revision','profiles','sharedActionGroups','legacySharedPoses','studioAppearance'].includes(key)))throw Error('Pose libraries must not contain model-specific settings.');
  const appearance=value.studioAppearance;
  if(appearance!==undefined&&(!object(appearance)||appearance.version!==1||!validAuthoringId(appearance.modelId)||!['single','triangle3','triangle3-inverted','hex7'].includes(appearance.footprint)||![appearance.modelScalePercent,appearance.hexScalePercent].every(n=>Number.isFinite(n)&&n>0)))throw Error('Invalid Studio appearance in pose library.');
  const normalizeGroup=(poses,allowed)=>{
    if(!object(poses)||Object.keys(poses).some(pose=>!allowed.includes(pose)))throw Error('Unknown action pose.');
    return Object.fromEntries(allowed.map(pose=>[pose,normalizePoseSample(poses[pose])]));
  };
  const legacy={};
  if(value.legacySharedPoses!==undefined&&!object(value.legacySharedPoses))throw Error('Invalid legacy shared poses.');
  for(const [id,poses] of Object.entries(value.legacySharedPoses||{})){
    if(!ACTION_PROFILE_CATALOG.has(id))throw Error('Unknown legacy weapon type.');
    legacy[id]=normalizeGroup(poses,ACTION_POSES.filter(p=>!WEAPON_CAPTURE_POSES.includes(p)));
  }
  const profiles=Object.fromEntries(DEFAULT_ACTION_PROFILE_IDS.map(id=>[id,normalizeGroup(value.profiles[id]||{},value.version===1?ACTION_POSES:WEAPON_CAPTURE_POSES)]));
  if(value.sharedActionGroups!==undefined&&(!object(value.sharedActionGroups)||Object.keys(value.sharedActionGroups).some(id=>!isSharedCaptureGroup(id))))throw Error('Unknown shared action group.');
  const shared=value.version===2?Object.fromEntries(Object.values(SHARED_CAPTURE_GROUPS).map(group=>[group.id,normalizeGroup(value.sharedActionGroups?.[group.id]||{},group.poses)])):{};
  const split=splitCaptureGroups(profiles,shared,'one-handed-swing',legacy);
  return {schema:POSE_LIBRARY_SCHEMA,version:2,id:value.id,name:text(value.name,'library name'),bodyFamily:'humanoid',size:value.size,revision:value.revision,
    ...(appearance?{studioAppearance:structuredClone(appearance)}:{}),
    profiles:Object.fromEntries(DEFAULT_ACTION_PROFILE_IDS.map(id=>[id,normalizeGroup(split.profiles[id],WEAPON_CAPTURE_POSES)])),
    sharedActionGroups:Object.fromEntries(Object.values(SHARED_CAPTURE_GROUPS).map(group=>[group.id,normalizeGroup(split.sharedActionGroups[group.id],group.poses)])),
    ...(Object.keys(split.legacySharedPoses).length?{legacySharedPoses:Object.fromEntries(Object.entries(split.legacySharedPoses).map(([id,poses])=>[id,normalizeGroup(poses,ACTION_POSES.filter(p=>!WEAPON_CAPTURE_POSES.includes(p)))]))}:{})};
}
export function createPoseLibrary({id,name,size='medium',profiles={},sharedActionGroups={}}){return normalizePoseLibrary({schema:POSE_LIBRARY_SCHEMA,version:2,id,name,bodyFamily:'humanoid',size,revision:0,profiles,sharedActionGroups});}
export function poseLibrarySignature(library){const {revision,legacySharedPoses,...content}=normalizePoseLibrary(library);return JSON.stringify(content);}
export function libraryPoseGroup(library,group){return isSharedCaptureGroup(group)?library.sharedActionGroups[group]:library.profiles[group];}
export function changedLibraryPoses(previous,next){
  const before=normalizePoseLibrary(previous),after=normalizePoseLibrary(next),changes=[];
  for(const [id,group] of CAPTURE_GROUP_CATALOG)for(const pose of group.poses){
    const sample=libraryPoseGroup(after,id)[pose];
    if(JSON.stringify(libraryPoseGroup(before,id)[pose])!==JSON.stringify(sample))changes.push({groupId:id,pose,sample});
  }
  return changes;
}
export function recordLibraryPose(library,profileId,pose,sample){
  const next=normalizePoseLibrary(library),group=captureGroupForPose(profileId,pose);
  libraryPoseGroup(next,group)[pose]=normalizePoseSample(sample);return next;
}
export function addCaptureRecipes(library,groups){
  let next=normalizePoseLibrary(library);
  const split=splitCaptureGroups(groups,{magic:groups?.magic||{},'death-prone':groups?.['death-prone']||{}});
  for(const [profile,poses] of Object.entries({...split.profiles,...split.sharedActionGroups}))for(const [pose,capture] of Object.entries(poses||{})){
    if(!capture?.clipSourceId||capture.clipSourceId==='t-pose')continue;
    next=recordLibraryPose(next,profile,pose,{animation:capture.clip,sourceId:capture.clipSourceId,timeSeconds:capture.time});
  }
  return next;
}
export function resolveLibraryPose(library,profile,pose,clips){
  const normalized=normalizePoseLibrary(library);
  captureGroupForPose(profile,pose);
  const resolved=poseWithFallback(normalized.profiles,normalized.sharedActionGroups,profile,pose),sample=resolved?.sample;
  if(!sample)throw Error('This action group has no assigned '+pose+' pose.');
  const index=clips.findIndex(clip=>(clip.sourceId||clip.userData?.studioAnimationId)===sample.sourceId);
  if(index<0)throw Error(`Animation unavailable on this model: ${sample.animation}. Load its source animation first.`);
  if(sample.timeSeconds>clips[index].duration+0.0001)throw Error(`Pose time exceeds ${sample.animation}'s duration.`);
  return {index,sample,...(resolved.fallback?{fallback:true,profileId:resolved.groupId,pose:resolved.pose}:{})};
}
export function poseLibraryCoverage(library,profileIds,{casting=false}={}){
  const normalized=normalizePoseLibrary(library),ids=[...new Set(profileIds)];
  if(ids.some(id=>!ACTION_PROFILE_CATALOG.has(id)))throw Error('Unknown weapon type.');
  const groups=[...ids,...(ids.length?['death-prone']:[]),...(casting?['magic']:[])];
  const missing=[];let present=0,total=0;
  for(const id of groups)for(const pose of (CAPTURE_GROUP_CATALOG.get(id)?.poses||WEAPON_CAPTURE_POSES)){total++;if(poseWithFallback(normalized.profiles,normalized.sharedActionGroups,id,pose))present++;else missing.push({profileId:id,pose});}
  return {present,total,missing};
}
// Scope each MOB/model workspace separately. Plain Studio keeps its original key.
export function authoringWorkspaceSuffix(search=''){
  const query=new URLSearchParams(search),mob=query.get('mob'),model=query.get('model'),library=query.get('poseLibrary');
  if(!validAuthoringId(model))return '';
  const prefix=query.get('preview')==='1'?'preview:':'';
  if(validAuthoringId(mob))return `:${prefix}mob:${mob}:${model}`;
  if(validAuthoringId(library))return `:${prefix}pose-library:${library}:${model}`;
  return '';
}

// Flatten local slices/frozen clips back onto their portable source timeline.
export function portablePoseSample(clip,timeSeconds,sources,ranges=[]){
  if(!clip||!Number.isFinite(timeSeconds)||timeSeconds<0||timeSeconds>clip.duration+0.0001)throw Error('Select a valid animation frame.');
  const sourceId=clip.userData?.studioAnimationId;
  const frozen=clip.userData?.frozenPose,range=ranges.find(item=>item.id===sourceId);
  if(frozen||range){
    const id=frozen?.sourceId||range.sourceId,source=sources.find(item=>item.userData?.studioAnimationId===id);
    if(!source||source===clip)throw Error('The original source animation is missing.');
    return portablePoseSample(source,frozen?frozen.timeSeconds:range.start+timeSeconds,sources,ranges.filter(item=>item.id!==sourceId));
  }
  if(!sourceId||sourceId.startsWith('source:'))throw Error('Choose a shared animation with a stable source ID before recording a reusable pose.');
  return normalizePoseSample({animation:clip.name,sourceId,timeSeconds});
}
