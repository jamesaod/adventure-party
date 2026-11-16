import assert from 'node:assert/strict';
import {newDraft,assignClip,readiness,validateDraft,resolveAssignment,ACTION_SLOTS} from '../js/mob-workshop-core.mjs';
const d=newDraft();d.clips=[{id:'a',duration:3}];const a={clipId:'a',start:0,end:2,speed:1,loop:true};
assert.throws(()=>assignClip(d,'idle',{...a,start:4,end:4}));
assignClip(d,'idle',a);assignClip(d,'idle',{...a,start:.5});assert.equal(d.assignments.idle.length,1);
assignClip(d,'death',a);assignClip(d,'death',{...a,start:1});assert.equal(d.assignments.death.length,2);
assert.equal(readiness(d).every(c=>c.ok),false);
d.model={file:'test.glb'};d.checks={ground:true,equipment:true};for(const slot of ['move','melee','hit'])assignClip(d,slot,a);
assert.ok(readiness(d).every(c=>c.ok));assert.equal(validateDraft(d),d);
d.capabilities.cast=true;assert.ok(readiness(d).every(c=>c.ok));
for(const [slot] of ACTION_SLOTS){if(!['idle','move','hit','death'].includes(slot))assert.equal(resolveAssignment(d,slot).source,'one-handed-swing');}
assignClip(d,'cast',{...a,start:.2});assignClip(d,'aim-fire-spell',{...a,start:.4});
assert.equal(resolveAssignment(d,'cast').assignments[0].start,.2);
assert.equal(resolveAssignment(d,'aim-fire-spell').assignments[0].start,.4);
delete d.assignments['one-handed-swing'];assert.equal(resolveAssignment(d,'bow').source,'t-pose');
assert.equal(readiness(d).find(c=>c.label.startsWith('1H Swing')).ok,false);
assignClip(d,'one-handed-swing',a);delete d.assignments.move;assert.equal(resolveAssignment(d,'move').source,'t-pose');
const old=structuredClone(d);old.assignments.melee=[a];delete old.assignments['one-handed-swing'];validateDraft(old);assert.ok(old.assignments['one-handed-swing']);assert.equal(old.assignments.melee,undefined);
d.stats.hp=0;assert.equal(readiness(d).every(c=>c.ok),false);
assert.throws(()=>validateDraft({...d,schema:'wrong'}));
console.log('Workshop assignment, variant, range and readiness tests passed.');

assert.equal(d.assignments.idle[0].mode,'pose');assert.equal(d.assignments.idle[0].start,d.assignments.idle[0].end);assert.equal(d.assignments.idle[0].loop,false);
