import assert from 'node:assert/strict';
import {newDraft,assignClip,validateDraft,resolveAssignment} from '../js/mob-workshop-core.mjs';
import {createWorkshopAnimationSelector} from '../js/workshop-animation-runtime.mjs';
const d=newDraft();d.clips=['normal','armed'].map(id=>({id,duration:2}));
for(const slot of ['idle','move'])assignClip(d,slot,{clipId:'normal',start:0,end:2,speed:1,mode:'animation',loop:true});
assert.equal(resolveAssignment(d,'armed-idle').source,'idle');assert.equal(resolveAssignment(d,'armed-move').source,'move');
for(const slot of ['armed-idle','armed-move'])assignClip(d,slot,{clipId:'armed',start:0,end:2,speed:1,mode:'animation',loop:true});
validateDraft(d);const select=createWorkshopAnimationSelector(d);const giant={alive:true,treeHauler:{stage:'seek'},inventory:[{slot:'weapon',equipped:true}]};
assert.equal(select(giant,'idle',undefined,500).assignment.clipId,'normal');assert.equal(select(giant,'idle',.5,500).assignment.clipId,'normal');
giant.carriedTreeLog={};assert.equal(select(giant,'idle',undefined,500).assignment.clipId,'armed');assert.equal(select(giant,'idle',undefined,500).time,0);assert.equal(select(giant,'idle',2.5,500).time,.5);
delete giant.carriedTreeLog;assert.equal(select(giant,'idle',undefined,500).assignment.clipId,'normal');
assert.equal(select({alive:true,inventory:[{slot:'weapon',equipped:true}]},'idle',undefined,500).assignment.clipId,'armed');
assert.equal(select({alive:true,inventory:[{slot:'weapon',equipped:false}]},'idle',undefined,500).assignment.clipId,'normal');
assignClip(d,'armed-idle',{clipId:'armed',start:.3,end:.3,speed:1,mode:'pose'});assert.equal(select({alive:true,carriedTreeLog:{}},'idle',undefined,500).time,.3);
delete d.assignments['armed-move'];assert.equal(select({alive:true,carriedTreeLog:{}},'idle',.5,500).assignment.clipId,'normal');
console.log('PASS armed slots, fallback, pickup/disarm, equipment state, looping walk and frozen combat idle');

for(const entity of [{alive:true},{alive:true,carriedTreeLog:{}}]){const a=select(entity,'idle',undefined,500),b=select(entity,'idle',undefined,9500);assert.equal(a.animating,false);assert.equal(b.key,a.key,'Idle cache key remains stable over time');assert.equal(b.time,a.time);}
