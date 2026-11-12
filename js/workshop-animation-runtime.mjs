import {resolveAssignment} from './mob-workshop-core.mjs';

// Pure presentation selection. Death choice is retained per death, never rerolled
// independently by the body, shadow and outline render passes.
export function createWorkshopAnimationSelector(draft,{random=Math.random}={}){
 const deaths=new WeakMap();
 return function select(entity,pose,walkSeconds,now){
  let slot=pose,elapsed=0;
  if(entity&&!entity.alive&&Number.isFinite(entity.deathPresentationStartedAt)){
   slot='death';elapsed=Math.max(0,(now-entity.deathPresentationStartedAt)/1000);
  }else if(slot==='death'&&entity?.alive){
   // Sleep/unconsciousness has its own clock; stale walking/attack time must not win.
   elapsed=Math.max(0,(now-(entity.fallingPoseStartedAt??now))/1000);
  }else if(Number.isFinite(walkSeconds)){slot='move';elapsed=Math.max(0,walkSeconds);}
  else if(slot==='idle')elapsed=Math.max(0,now/1000);
  else elapsed=Math.max(0,(now-(entity?.poseStartedAt??now))/1000);
  const choices=resolveAssignment(draft,slot).assignments;
  let index=0;
  if(slot==='death'&&entity){let record=deaths.get(entity);if(!record||record.at!==(entity.alive?entity.fallingPoseStartedAt:entity.deathPresentationStartedAt)){record={at:entity.alive?entity.fallingPoseStartedAt:entity.deathPresentationStartedAt,index:Math.min(choices.length-1,Math.floor(random()*choices.length))};deaths.set(entity,record);}index=record.index;}
  const assignment=choices[index];if(!assignment)return {slot,time:0,animating:false,key:'t-pose'};
  if(slot==='death'&&entity&&!entity.alive)entity.deathAnimationDurationMs=(assignment.end-assignment.start)/assignment.speed*1000;
  const length=assignment.end-assignment.start,loop=slot==='move'||(assignment.loop&&slot!=='death');
  const local=elapsed*assignment.speed;
  const frozen=slot==='idle'||assignment.mode==='pose';
  const time=frozen?assignment.start:assignment.start+(loop&&length>0?local%length:Math.min(length,local));
  return {slot,assignment,time,animating:!frozen&&(loop||local<length),key:slot+':'+assignment.clipId+':'+time};
 };
}


// The legacy resolver has preparation and impact phases. A Workshop attack is
// one continuous clip; preserve its clock across that phase boundary.
export function workshopAttackTiming(draft,slot){
 const a=resolveAssignment(draft,slot).assignments[0];
 const total=a&&a.mode!=='pose'?(a.end-a.start)/a.speed*1000:500;
 const windup=slot==='bow'&&a?.bowTiming?(a.bowTiming.release-a.start)/a.speed*1000:Math.min(250,total/2);
 return {windupDurationMs:windup,actionDurationMs:Math.max(0,total-windup)};
}
export function workshopPoseStart(unit,pose,now){
 if(pose==='windup'){unit.workshopAttackStartedAt=now;return now;}
 if(pose==='attack'&&Number.isFinite(unit.workshopAttackStartedAt)){
  const start=unit.workshopAttackStartedAt;delete unit.workshopAttackStartedAt;
  return start;
 }
 delete unit.workshopAttackStartedAt;return now;
}

globalThis.adventurePartyWorkshopAnimation={poseStart:workshopPoseStart};
