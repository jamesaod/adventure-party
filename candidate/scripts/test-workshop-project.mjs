import assert from 'node:assert/strict';
import {newDraft,assignClip} from '../js/mob-workshop-core.mjs';
import {validateWorkshopProject} from '../js/mob-workshop-project.mjs';
const d=newDraft();d.model={id:'test',file:'test.glb'};
d.clips=[{id:'idle',name:'Idle',duration:1,data:{duration:1,tracks:[{name:'hips.quaternion',type:'quaternion',times:[0,1],values:[0,0,0,1,0,0,0,1]}]}}];
assignClip(d,'idle',{clipId:'idle',start:0,end:0,speed:1});
const value={draft:d,files:{'model.bin':new ArrayBuffer(4)}};
const checked=validateWorkshopProject(value);
assert.notEqual(checked.draft,d);
assert.equal(d.equipment.fitStoreVersion,undefined,'validation must not mutate source project');
assert.throws(()=>validateWorkshopProject({...value,files:{}}),/model file/);
assert.throws(()=>validateWorkshopProject({...value,files:{'model.bin':new ArrayBuffer(0)}}),/model file/);
for(const mutate of [
 x=>x.clips.push(structuredClone(x.clips[0])),
 x=>delete x.clips[0].data,
 x=>x.clips[0].data.duration=99,
 x=>x.clips[0].data.tracks.push(structuredClone(x.clips[0].data.tracks[0])),
 x=>x.clips[0].data.tracks[0].times=[1,0],
 x=>x.clips[0].data.tracks[0].values=[0,1],
 x=>x.clips[0].data.tracks[0].values[0]=NaN,
 x=>x.equipment.fitsByItem={bad:{position:[0,0,NaN],rotation:[0,0,0],sizePercent:100}}
]){const bad=structuredClone(d);mutate(bad);assert.throws(()=>validateWorkshopProject({...value,draft:bad}));}
assert.deepEqual(validateWorkshopProject({draft:JSON.parse(JSON.stringify(d)),files:value.files}).draft.assignments,d.assignments);
console.log('Workshop portable dependencies and non-mutating validation: passed');
