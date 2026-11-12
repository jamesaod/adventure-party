import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,stat,readdir,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,basename,sep} from 'node:path';
import {zipSync,strToU8} from '../assets/vendor/three/addons/libs/fflate.module.js';
import {newDraft,assignClip} from '../js/mob-workshop-core.mjs';
import {saveFit} from '../js/mob-workshop-fit-store.mjs';
import {importWorkshopMob,verifyLiveWorkshopImport} from './import-workshop-mob.mjs';
const root=await mkdtemp(join(tmpdir(),'workshop-import-'));
const read=async p=>JSON.parse(await readFile(join(root,p),'utf8'));
const exists=async p=>access(join(root,p)).then(()=>true,()=>false);
const draft=newDraft();draft.name='Import fixture';draft.model={id:'fixture-model',file:'fixture.glb'};draft.checks={ground:true,equipment:true};
draft.clips=[{id:'clip',name:'Fixture',duration:2,data:{duration:2,tracks:[{name:'hips.quaternion',type:'quaternion',times:[0,2],values:[0,0,0,1,0,0,0,1]}]}}];
for(const slot of ['idle','move','one-handed-swing','death','bow'])assignClip(draft,slot,{clipId:'clip',start:0,end:2,speed:1,loop:false,...(slot==='bow'?{bowTiming:{draw:.5,release:1.5}}:{})});
function glb(){let s=JSON.stringify({asset:{version:'2.0'},nodes:[{name:'hips'}]});s+=' '.repeat((4-s.length%4)%4);const b=new Uint8Array(20+s.length),v=new DataView(b.buffer);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,b.length,true);v.setUint32(12,s.length,true);v.setUint32(16,0x4e4f534a,true);b.set(strToU8(s),20);return b;}
const bytes=glb(),zip=join(root,'fixture.zip'),packagePath='data/mobs/import-fixture.workshop-unit.json',sourcePath='assets/workshop-units/import-fixture/source-workshop.zip';
const archive=async (d=draft,model=bytes)=>writeFile(zip,zipSync({'workshop.json':strToU8(JSON.stringify(d)),'model.bin':model},{mtime:new Date('2020-01-01T00:00:00Z')}));
try{
 await mkdir(join(root,'data'));await writeFile(join(root,'data/mob-library.json'),JSON.stringify({version:1,mobs:[]}));await archive();
 const checked=await importWorkshopMob(zip,{root,newId:'import-fixture',check:true});assert.equal(checked.status,'checked');assert(!(await exists('.local')));assert(!(await exists(packagePath)),'Check-only cannot write a package');
 await assert.rejects(importWorkshopMob(zip,{root}),/No existing MOB/);await assert.rejects(importWorkshopMob(zip,{root,id:'missing-mob'}),/does not exist/);
 let newWrites=0;await assert.rejects(importWorkshopMob(zip,{root,newId:'import-fixture',writer:async(path,data)=>{await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,data);if(++newWrites===2)throw Error('Simulated new-import failure');}}),/Previous repository state restored/);
 assert(!(await exists(checked.files[0])),'Rollback removes the newly written model');assert(!(await exists(sourcePath)));assert.equal((await read('data/mob-library.json')).mobs.length,0);
 const first=await importWorkshopMob(zip,{root,newId:'import-fixture'});assert.equal(first.status,'created');assert.equal((await read('data/mob-library.json')).mobs.length,1);
 const pack=await read(packagePath),modelPath=join(root,pack.model.file),modelTime=(await stat(modelPath)).mtimeMs;
 const repeat=await importWorkshopMob(zip,{root});assert.equal(repeat.status,'unchanged');assert.equal(repeat.backup,null);assert.equal(repeat.modelReused,true);assert.equal((await stat(modelPath)).mtimeMs,modelTime);
 await assert.rejects(importWorkshopMob(zip,{root,newId:'import-fixture'}),/already exists/);
 // New fields travel through the real validators and combat adapter, without broad test-suite runs.
 const tuned=structuredClone(pack.draft);tuned.publishedSource={id:'import-fixture'};tuned.raceId='elf';tuned.gender='female';
 Object.assign(tuned.creature.combat,{hpMode:'range',hpRangeMin:1,hpRangeMax:4,hpRangeModifier:1,lessThanOneHitDie:true});
 tuned.equipment.back='auto';saveFit(tuned,'back',{item:'auto',sizePercent:100,position:[0,0,0],rotation:[0,0,0],arrows:{count:9,widthPercent:35,spacingPercent:50,position:[0,.05,0],rotation:[0,0,0]}});
 const oldPackage=await readFile(join(root,packagePath)),oldSource=await readFile(join(root,sourcePath)),oldManifest=await readFile(join(root,'data/mob-library.json'));
 await archive(tuned);const updated=await importWorkshopMob(zip,{root});
 assert.equal(updated.status,'replaced');assert.equal(updated.id,'import-fixture');assert(updated.modelReused);assert.equal(updated.checks.morale,13);assert.deepEqual(updated.checks.sampleHp,[2,5]);assert(updated.checks.lessThanOneHitDie);assert.equal(updated.checks.quiverArrows.count,9);
 assert.equal((await stat(modelPath)).mtimeMs,modelTime,'Replacement skips unchanged model writes');assert.deepEqual(await readFile(join(root,'data/mob-library.json')),oldManifest,'Replacement preserves the exact manifest');
 assert.deepEqual(await readFile(join(root,updated.backup,packagePath)),oldPackage);assert.deepEqual(await readFile(join(root,updated.backup,sourcePath)),oldSource);
 const currentPackage=await readFile(join(root,packagePath)),currentSource=await readFile(join(root,sourcePath));
 // Bad content and failed writes leave the currently playable unit intact.
 const invalid=structuredClone(tuned);invalid.creature.combat.hpRangeMin=10;await archive(invalid);await assert.rejects(importWorkshopMob(zip,{root}),/HP range/);assert.deepEqual(await readFile(join(root,packagePath)),currentPackage);
 await archive(tuned,new Uint8Array([1,2,3]));await assert.rejects(importWorkshopMob(zip,{root}),/GLB/);
 const later=structuredClone(tuned);later.stats.xp=999;await archive(later);
 let writes=0;await assert.rejects(importWorkshopMob(zip,{root,writer:async(path,data)=>{await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,data);if(++writes===2)throw Error('Simulated write failure');}}),/Previous repository state restored/);
 assert.deepEqual(await readFile(join(root,packagePath)),currentPackage);assert.deepEqual(await readFile(join(root,sourcePath)),currentSource);assert.deepEqual(await readFile(join(root,'data/mob-library.json')),oldManifest);assert(!(await exists('.local/workshop-imports/active.lock')));
 // An active importer is not overridden.
 await writeFile(join(root,'.local/workshop-imports/active.lock'),'busy');await assert.rejects(importWorkshopMob(zip,{root}),/Another Workshop import/);await rm(join(root,'.local/workshop-imports/active.lock'));
 // Optional live verification checks exactly what the game receives; failure reports an applied local import.
 await archive(tuned);const served=await read(packagePath),manifest=await read('data/mob-library.json');
 const fetcher=async url=>({ok:true,json:async()=>url.pathname.endsWith('mob-library.json')?structuredClone(manifest):structuredClone(served)});
 assert.equal(await verifyLiveWorkshopImport('http://game.test/game/',served,{fetcher}),'passed');
 const live=await importWorkshopMob(zip,{root,baseUrl:'http://game.test/game/',fetcher});assert.equal(live.status,'unchanged');assert.equal(live.live,'passed');
 const failedLive=await importWorkshopMob(zip,{root,baseUrl:'http://game.test/',fetcher:async()=>{throw Error('offline');}});assert.equal(failedLive.status,'unchanged');assert.match(failedLive.live,/failed: offline/);
 // Duplicate names require an explicit replacement ID; duplicate IDs are never accepted.
 await importWorkshopMob(zip,{root,newId:'import-fixture-copy'});const noSource=structuredClone(tuned);delete noSource.publishedSource;await archive(noSource);
 await assert.rejects(importWorkshopMob(zip,{root}),/Multiple MOBs/);
 const explicit=await importWorkshopMob(zip,{root,id:'import-fixture',check:true});assert.equal(explicit.id,'import-fixture');
 const duplicate=await read('data/mob-library.json');duplicate.mobs.push(duplicate.mobs[0]);await writeFile(join(root,'data/mob-library.json'),JSON.stringify(duplicate));await assert.rejects(importWorkshopMob(zip,{root,id:'import-fixture'}),/Duplicate MOB IDs/);
 assert((await readdir(join(root,'.local/workshop-imports'))).length>0);
 console.log('PASS quick import: check-only, explicit creation, identity/name replacement, no-op/model reuse, HP/race/quiver/timing checks, backups, rollback, lock, ambiguity/duplicate rejection and live verification.');
}finally{
 assert(root.startsWith(resolve(tmpdir())+sep)&&basename(root).startsWith('workshop-import-'));
 await rm(root,{recursive:true,force:true});
}
