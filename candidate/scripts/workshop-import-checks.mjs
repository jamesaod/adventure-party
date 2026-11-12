import assert from 'node:assert/strict';
import {createWorkshopRepositoryMob} from '../js/workshop-repository-mob.mjs';
import {workshopAttackTiming,createWorkshopAnimationSelector} from '../js/workshop-animation-runtime.mjs';
import {hitPointSummary} from '../js/workshop-hit-points.mjs';
import {savedFit} from '../js/mob-workshop-fit-store.mjs';

// Keep field-specific checks here when new authored features reach combat.
// Archive/project/runtime support validation is shared with the actual publisher.
export function quickCheckWorkshopUnit(pack){
 const adapter=createWorkshopRepositoryMob(pack),d=adapter.template.draft;
 const low=adapter.apply({id:'import-check-low'},()=>0),high=adapter.apply({id:'import-check-high'},()=>.999999999);
 for(const unit of [low,high]){
  assert(Number.isInteger(unit.hp)&&unit.hp>=1&&unit.maxHp===unit.hp,'Invalid generated HP');
  for(const key of ['ac','thaco','move','morale','hitDiceValue'])assert(Number.isFinite(unit[key]),'Invalid combat '+key);
  assert.equal(unit.raceId,d.raceId,'Race was lost');assert.equal(unit.gender,d.gender,'Gender was lost');
  assert.equal(unit.morale,d.stats.morale,'Morale was lost');
  assert.equal(unit.lessThanOneHitDie,d.creature.combat.lessThanOneHitDie,'Sweep classification was lost');
  if(unit.lessThanOneHitDie)assert(unit.hitDiceValue<1,'Sweep classification did not reach combat');
 }
 assert(low.hp<=high.hp,'HP endpoints are reversed');
 const recipe=adapter.recipe(low);
 assert.deepEqual(recipe.renderSettings.workshopUnit.draft.equipment,d.equipment,'Equipment fits were lost');
 const select=createWorkshopAnimationSelector(d,{random:()=>0});
 for(const slot of Object.keys(d.assignments).filter(slot=>d.assignments[slot]?.length)){
  const pose=select({alive:true,poseStartedAt:0},slot,undefined,500),timing=workshopAttackTiming(d,slot);
  assert(pose.assignment&&Number.isFinite(pose.time),'Animation cannot be selected: '+slot);
  assert(Object.values(timing).every(n=>Number.isFinite(n)&&n>=0),'Invalid combat animation timing: '+slot);
 }
 return {hp:hitPointSummary(d.stats,d.creature.combat),sampleHp:[low.hp,high.hp],race:d.raceId,gender:d.gender,morale:low.morale,
  lessThanOneHitDie:low.lessThanOneHitDie,back:d.equipment.back,quiverArrows:savedFit(d,'back')?.arrows??null,
  bowTiming:d.assignments.bow?.[0]?.bowTiming??null,clips:d.clips.length};
}
