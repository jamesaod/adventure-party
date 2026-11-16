import assert from 'node:assert/strict';
import {newDraft,assignClip} from '../js/mob-workshop-core.mjs';
import {createWorkshopAnimationSelector} from '../js/workshop-animation-runtime.mjs';
const draft=newDraft();
draft.clips=[{id:'fall',duration:2}];
assignClip(draft,'death',{clipId:'fall',start:0,end:2,speed:1,loop:false});
const select=createWorkshopAnimationSelector(draft,{random:()=>0});
const sleepers=Array.from({length:5},(_,id)=>({id,alive:true,poseStartedAt:0,fallingPoseStartedAt:1000}));
for(const unit of sleepers){
 assert.equal(select(unit,'death',99,1500).time,.5,'Sleep overrides stale movement time');
 assert.equal(select(unit,'death',undefined,3500).time,2,'Every sleeper reaches prone');
 assert.equal(select(unit,'death',undefined,3500).animating,false);
 assert.equal(unit.deathAnimationDurationMs,undefined,'Sleep does not mutate death timing');
 unit.fallingPoseStartedAt=5000;
 assert.equal(select(unit,'death',undefined,5250).time,.25,'New sleep restarts fall');
 unit.alive=false;unit.deathPresentationStartedAt=6000;
 assert.equal(select(unit,'death',99,6500).time,.5,'Actual death has its own clock');
}
console.log('Multiple sleepers, stale movement, repeated sleep and actual death timing passed.');
