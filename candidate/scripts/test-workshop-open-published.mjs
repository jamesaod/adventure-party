import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {listPublishedWorkshopMobs,openPublishedWorkshopMob} from '../js/workshop-published-mobs.mjs';
import {validateWorkshopProject} from '../js/mob-workshop-project.mjs';
import {saveFit} from '../js/mob-workshop-fit-store.mjs';
import {zipSync,unzipSync,strToU8,strFromU8} from '../assets/vendor/three/addons/libs/fflate.module.js';
import {extractCombatFunction} from './combat-test-source.mjs';
const root=new URL('https://game.test/game/'),requests=[];
const manifest=JSON.parse(readFileSync('data/mob-library.json','utf8'));
const entry=manifest.mobs.find(m=>m.id==='wood-elf-archer');assert(entry);
const original=JSON.parse(readFileSync(entry.file,'utf8')),model=readFileSync(original.model.file);
let pack=structuredClone(original),badHash=false,fail=null;
const buffer=bytes=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
async function fetcher(url,options){
 const path=new URL(url).pathname.slice('/game/'.length);requests.push({path,options});
 if(path===fail)return {ok:false,status:404};
 if(path==='data/mob-library.json')return {ok:true,json:async()=>structuredClone(manifest)};
 if(path===entry.file)return {ok:true,json:async()=>structuredClone(pack)};
 if(path===pack.model.file)return {ok:true,arrayBuffer:async()=>badHash?new ArrayBuffer(10):buffer(model)};
 throw Error('Unexpected request '+path);
}
const list=await listPublishedWorkshopMobs({root,fetcher});assert(list.some(m=>m.id===entry.id));assert(!list.some(m=>m.id==='orc-archer'),'Older non-Workshop MOBs are outside this selector');
assert.equal(requests.length,1,'Listing MOBs does not download every model or animation package');
assert.equal(requests[0].options.cache,'no-cache');
const project=await openPublishedWorkshopMob(entry,{root,fetcher});
assert.deepEqual(project.draft.clips,original.draft.clips);assert.deepEqual(project.draft.assignments,validateWorkshopProject({draft:original.draft,files:{'model.bin':buffer(model)}}).draft.assignments);
assert.deepEqual(project.draft.stats,{...original.draft.stats,morale:13});assert.equal(project.draft.raceId,'elf');assert.equal(project.draft.moraleOverride,original.draft.moraleOverride??null,'Preserve the published morale override');assert.deepEqual(project.draft.model,original.draft.model);assert.deepEqual(project.draft.inventoryItems,original.draft.inventoryItems);
assert.equal(project.draft.publishedSource.id,entry.id);assert.equal(Buffer.compare(Buffer.from(project.files['model.bin']),model),0);
project.draft.name='Edited name';assert.equal(pack.draft.name,original.draft.name,'Editing cannot mutate the published source');
// Back and hand fits survive subsequent publication/reopen, not just first load.
pack.draft.equipment.back='empty-quiver';const fit={item:'empty-quiver',position:[.2,.1,.12],rotation:[10,15,-20],sizePercent:75};saveFit(pack.draft,'back',fit);
const fitted=await openPublishedWorkshopMob(entry,{root,fetcher});assert.deepEqual(fitted.draft.equipment.fitsByItem,pack.draft.equipment.fitsByItem);
const zip=zipSync({'workshop.json':strToU8(JSON.stringify(fitted.draft)),'model.bin':new Uint8Array(fitted.files['model.bin'])});
const contents=unzipSync(zip),restored=validateWorkshopProject({draft:JSON.parse(strFromU8(contents['workshop.json'])),files:{'model.bin':contents['model.bin']}});
assert.deepEqual(restored.draft.equipment.fitsByItem,fitted.draft.equipment.fitsByItem);assert.equal(restored.draft.publishedSource.id,entry.id);
badHash=true;await assert.rejects(openPublishedWorkshopMob(entry,{root,fetcher}),/checksum/);badHash=false;
fail=pack.model.file;await assert.rejects(openPublishedWorkshopMob(entry,{root,fetcher}),/model could not load/);fail=null;
pack={...pack,id:'different-mob'};await assert.rejects(openPublishedWorkshopMob(entry,{root,fetcher}));pack=structuredClone(original);
await assert.rejects(openPublishedWorkshopMob({...entry,file:'https://outside.test/mob.json'},{root,fetcher}),/Invalid/);
// Drive the actual UI handler: loading errors must not replace the open draft.
const code=readFileSync('js/mob-workshop.mjs','utf8'),trace=[];
const ui=vm.createContext({publishedMobs:[{...entry,label:'Wood Elf Archer'}],draft:{model:null},root,
 $:()=>({value:entry.id}),confirm:()=>true,status:()=>{},openPublishedWorkshopMob:async()=>{throw Error('download failed');},
 restore:async()=>trace.push('restore'),choose:()=>trace.push('idle'),step:()=>trace.push('model-tab')});
vm.runInContext(extractCombatFunction(code,'openSelectedPublishedMob'),ui);
await assert.rejects(ui.openSelectedPublishedMob(),/download failed/);assert.deepEqual(trace,[]);
ui.openPublishedWorkshopMob=async()=>fitted;ui.restore=async value=>{trace.push('restore');ui.draft=value.draft;};await ui.openSelectedPublishedMob();assert.deepEqual(trace,['restore','idle','model-tab']);
const html=readFileSync('mob-workshop.html','utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);assert(ids.includes('publishedMob')&&ids.includes('openPublishedMob'));
console.log('PASS published MOB editing: real Wood Elf model/checksum, full animation/stat/loadout preservation, Back-fit ZIP round-trip, source isolation, failure before replacement, idle preview and distinct controls.');
