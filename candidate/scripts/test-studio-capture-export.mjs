import assert from 'node:assert/strict';
import {planCaptureExport,recoveryPoseReference} from '../js/studio-capture-export.mjs';
import {buildStudioUnitExport} from '../js/studio-unit-export.mjs';
const capture=(pose,stale=false,width=800)=>({clip:'Sword And Shield Slash',clipSourceId:'uploaded:sword-and-shield-slash:0',time:{ready:0,windup:.3,attack:.6765}[pose]??1,stale,width,height:width*1.25,anchorX:width/2,anchorY:width*.834,frames:{E:new Uint8Array([1,2,3,255])},render:{equipment:{rightHand:'medieval-sword',position:[.015,.05,.005],rotation:[-59,-180,18]},shield:{leftHandShield:'round-wooden-shield'}}});
const manifest=(pose,c)=>({frame:{width:c.width,height:c.height,anchorX:c.anchorX,anchorY:c.anchorY},poses:{[pose]:{clip:c.clip,clipSourceId:c.clipSourceId,time:c.time,render:c.render,outdated:true,outdatedReason:c.staleReason}}});
// Reproduce the reported handoff shape: 9 physical profiles with 31 intended
// total poses including shared actions; four profiles each lost two snapshots.
const profiles=['one-handed-swing','two-handed-swing','two-handed-thrust','dual-wield','unarmed','bow','direct-fire','sling','throw'];
const groups=Object.fromEntries(profiles.map((id,index)=>[id,Object.fromEntries(['ready','windup','attack'].map(pose=>[pose,capture(pose,index<4 && pose!==(index===1?'ready':'attack'))]))]));
groups.magic={'casting-windup':capture('casting-windup'),cast:capture('cast')};
groups['death-prone']={falling:capture('falling'),prone:capture('prone')};
const before=structuredClone(groups),plan=planCaptureExport(groups);
assert.equal(plan.poseCount,31);
assert.equal(plan.current.reduce((n,g)=>n+Object.keys(g.captures).length,0),23);
assert.equal(plan.recovery.length,8,'Every previously omitted slot has an explicit recovery record');
assert.deepEqual(groups,before,'Export cannot rewrite captured flags, transforms or pixels');
assert.deepEqual(plan.recovery.map(r=>r.id+'/'+r.pose),['one-handed-swing/ready','one-handed-swing/windup','two-handed-swing/windup','two-handed-swing/attack','two-handed-thrust/ready','two-handed-thrust/windup','dual-wield/ready','dual-wield/windup']);
for(const row of plan.recovery){
 const ref=recoveryPoseReference({...row,manifest:manifest(row.pose,row.capture)});
 assert.equal(ref.sourceId,row.capture.clipSourceId);
 assert.equal(ref.timeSeconds,row.capture.time);
 assert.equal(ref.manifest,`recovery/${row.id}/${row.pose}/manifest.json`);
 assert.equal(ref.status,'outdated');
 assert.deepEqual(ref.render,row.capture.render);
 ref.render.equipment.rotation[0]=999;assert.equal(row.capture.render.equipment.rotation[0],-59);
}
// Historical settings can differ: do not squeeze old pixels into today's frame.
const mixed=planCaptureExport({bow:{ready:capture('ready',true,160),attack:capture('attack',false,800)},magic:{cast:{...capture('cast',true),staleReason:'Lighting changed'}}});
assert.equal(mixed.recovery[0].capture.width,160);
assert.equal(mixed.current[0].captures.attack.width,800);
const recovered=mixed.recovery.map(row=>({...row,manifest:manifest(row.pose,row.capture)}));
const unit=buildStudioUnitExport({name:'Recovery test',settings:{libraryModelId:'blond-scale-mail-woman'},profiles:[],recovery:recovered});
assert.deepEqual(unit.actionProfiles,['bow'],'Recovery-only weapon groups survive; Magic is not a weapon');
assert.deepEqual(unit.references.spriteSets,{});
assert.equal(unit.references.captureRecovery.length,2);
assert.equal(unit.references.captureRecovery[0].frame.width,160);
assert.equal(unit.references.captureRecovery[1].reason,'Lighting changed');
assert.ok(unit.equipment.some(item=>item.slot==='shield'));
assert.equal(planCaptureExport({bow:{ready:capture('ready',true)}}).poseCount,1,'All-outdated workspaces still export');
assert.equal(planCaptureExport({bow:{ready:capture('ready')}}).recovery.length,0);
assert.throws(()=>planCaptureExport({magic:{attack:capture('attack')}}),/Unknown capture slot/);
console.log('PASS export recovery: all 31 captured slots survive, including eight previously filtered poses, source/time/grips, differing frames, and recovery-only groups');
