import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {zipSync,strToU8} from '../assets/vendor/three/addons/libs/fflate.module.js';
import {newDraft,assignClip} from '../js/mob-workshop-core.mjs';
import {publishWorkshopUnit} from './publish-workshop-unit.mjs';
import {validateWorkshopUnit} from '../js/workshop-unit-package.mjs';
import {createWorkshopRepositoryMob} from '../js/workshop-repository-mob.mjs';
import {createWorkshopAnimationSelector,workshopAttackTiming,workshopPoseStart} from '../js/workshop-animation-runtime.mjs';
import {validateWorkshopGlb} from '../js/workshop-glb.mjs';
const d=newDraft();d.model={id:'fixture',file:'fixture.glb'};d.name='Publication fixture';d.checks={ground:true,equipment:true};
d.clips=[{id:'clip',name:'Fixture',duration:2,data:{duration:2,tracks:[{name:'hips.quaternion',type:'quaternion',times:[0,2],values:[0,0,0,1,0,0,0,1]}]}}];
for(const slot of ['idle','move','one-handed-swing','death'])assignClip(d,slot,{clipId:'clip',start:0,end:2,speed:1,loop:false});
function glb(doc){let json=JSON.stringify(doc);json+=' '.repeat((4-json.length%4)%4);const b=new Uint8Array(20+json.length),v=new DataView(b.buffer);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,b.length,true);v.setUint32(12,json.length,true);v.setUint32(16,0x4e4f534a,true);b.set(strToU8(json),20);return b;}
const bytes=glb({asset:{version:'2.0'},nodes:[{name:'hips'}]});
assert.throws(()=>validateWorkshopGlb(glb({asset:{version:'2.0'},images:[{uri:'outside.png'}]})),/embed/);
assert.throws(()=>validateWorkshopGlb(bytes.subarray(0,15)),/complete/);
const root=await mkdtemp(join(tmpdir(),'workshop-publish-'));
try{
 await mkdir(join(root,'data'));await writeFile(join(root,'data/mob-library.json'),JSON.stringify({mobs:[]}));
 const zip=join(root,'fixture.zip');await writeFile(zip,zipSync({'workshop.json':strToU8(JSON.stringify(d)),'model.bin':bytes}));
 const pack=await publishWorkshopUnit(zip,'fixture-unit',{root});
 assert.equal(validateWorkshopUnit(pack).id,'fixture-unit');
 assert.throws(()=>validateWorkshopUnit({...pack,id:'other-unit'}),/reference/);
 const saved=JSON.parse(await readFile(join(root,'data/mobs/fixture-unit.workshop-unit.json'),'utf8'));
 const api=createWorkshopRepositoryMob(saved),unit=api.apply({id:'u',faction:'friendly',alive:true,x:3,y:4});
 assert.equal(unit.faction,'friendly');assert.equal(unit.x,3);assert.equal(unit.hp,8);assert.equal(api.recipe(unit).renderSettings.workshopUnit.draft.clips.length,1);
 await publishWorkshopUnit(zip,'fixture-unit',{root});assert.equal(JSON.parse(await readFile(join(root,'data/mob-library.json'),'utf8')).mobs.length,1);
 assert.deepEqual(workshopAttackTiming(d,'one-handed-swing'),{windupDurationMs:250,actionDurationMs:1750});
 assert.equal(workshopPoseStart(unit,'windup',1000),1000);
 assert.equal(workshopPoseStart(unit,'attack',1250),1000);
 assert.equal(workshopPoseStart(unit,'attack',4000),4000);
 const unsupported=structuredClone(pack.draft);unsupported.creature.combat.magicResistance=25;
 const badZip=join(root,'unsupported.zip');await writeFile(badZip,zipSync({'workshop.json':strToU8(JSON.stringify(unsupported)),'model.bin':bytes}));
 await assert.rejects(publishWorkshopUnit(badZip,'unsupported-unit',{root}),/Magic resistance/);
 assert.equal(JSON.parse(await readFile(join(root,'data/mob-library.json'),'utf8')).mobs.length,1);
 const select=createWorkshopAnimationSelector(d,{random:()=>0});
 assert.equal(select(unit,'idle',undefined,1000).time,0);
 assert.equal(select(unit,'idle',2.5,1000).time,.5);
 unit.poseStartedAt=1000;assert.equal(select(unit,'one-handed-swing',undefined,1500).time,.5);
 unit.alive=false;unit.deathPresentationStartedAt=1000;assert.equal(select(unit,'idle',undefined,5000).time,2);
 assert.equal(select(unit,'idle',undefined,5000).animating,false);
 console.log('Workshop publication, portable references, repository adapter and animation selection passed.');
}finally{await rm(root,{recursive:true,force:true});}

