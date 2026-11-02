import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeStudioWorkspace,decodeStudioWorkspace} from '../js/studio-workspace-codec.mjs';
globalThis.location={href:'https://example.test/candidate/3d-studio.html',search:''};
const {validateStudioWorkspace,saveStudioWorkspace,loadStudioWorkspace}=await import('../js/sprite-set-store.mjs');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const makeCapture=(width=2,height=2)=>({width,height,anchorX:width/2,anchorY:height/2,clip:'Test clip',clipSourceId:'uploaded:test:0',time:.25,raw:new Uint8Array(width*height*6*4),render:{equipment:{rightHand:'medieval-sword',rotation:[-59,-180,18]}}});
const small=makeCapture();small.raw[7]=129;small.battlefieldWidth=2;small.battlefieldHeight=2;small.groundShadowRgba=new Uint8Array(96).fill(45);small.battlefieldRaw=new Uint8Array(96).fill(34);
const workspace={version:1,name:'Lossless storage',style:{brightness:1,contrast:1,hue:0,saturation:1,outline:0},settings:{},captures:{ready:small},actionProfiles:{bow:{ready:small}},sharedActionGroups:{magic:{cast:small}},legacySharedCaptures:{bow:{cast:small}}};
const encoded=await encodeStudioWorkspace(workspace);
assert.ok(encoded.captures.ready.raw instanceof Blob);
assert.deepEqual(await decodeStudioWorkspace(structuredClone(encoded)),workspace);
assert.equal((await encodeStudioWorkspace(workspace)).captures.ready.raw,encoded.captures.ready.raw,'Unchanged pixels reuse compression');
assert.equal(await decodeStudioWorkspace(workspace),workspace,'Legacy raw workspaces still load');
assert.equal(await decodeStudioWorkspace(null),null);
await assert.rejects(()=>decodeStudioWorkspace({...encoded,pixelEncoding:'unknown'}),/Unsupported/);
await assert.rejects(()=>decodeStudioWorkspace({...encoded,captures:{ready:{...encoded.captures.ready,width:1,height:1}}}),/exceed/);
await assert.rejects(()=>decodeStudioWorkspace({...encoded,captures:{ready:{...encoded.captures.ready,width:3,height:3}}}),/incomplete/);
await assert.rejects(()=>decodeStudioWorkspace({...encoded,captures:{ready:{...encoded.captures.ready,raw:new Blob(['broken'])}}}));
// Exercise real save/load boundaries, including the user's 500% / 31-pose case.
const saved=new Map();let abortWrite=false;
globalThis.indexedDB={open(){const request={};queueMicrotask(()=>{request.result={close(){},transaction(){const tx={objectStore(){return {put(record,key){queueMicrotask(()=>{if(abortWrite){tx.onabort();return;}saved.set(key,structuredClone(record));tx.oncomplete();});},get(key){const r={};queueMicrotask(()=>{r.result=saved.get(key);r.onsuccess();});return r;}};}};return tx;}};request.onsuccess();});return request;}};
await saveStudioWorkspace(workspace);assert.equal(saved.get('workspace').pixelEncoding,'gzip-v1');
assert.deepEqual((await loadStudioWorkspace()).captures.ready.raw,small.raw);
const before=saved.get('workspace');abortWrite=true;
await assert.rejects(()=>saveStudioWorkspace({...workspace,name:'Failed save'}),/could not save/);
assert.equal(saved.get('workspace'),before,'Failed atomic writes retain the previous saved copy');abortWrite=false;
let large={...workspace,captures:{},actionProfiles:{},sharedActionGroups:{},legacySharedCaptures:{}};
const expected=new Map(),ids=['one-handed-swing','two-handed-swing','two-handed-thrust','dual-wield','unarmed','bow','direct-fire','sling','throw'];
let ordinal=0;
for(const id of [...ids,'magic','death-prone']){
 const poses=id==='magic'?['casting-windup','cast']:id==='death-prone'?['falling','prone']:['ready','windup','attack'];
 const group={};
 for(const pose of poses){const cap=makeCapture(800,1000);cap.raw.fill(++ordinal,800000,840000);cap.time=ordinal/10;cap.stale=ordinal%3===0;group[pose]=cap;expected.set(id+'/'+pose,hash(cap.raw));}
 (ids.includes(id)?large.actionProfiles:large.sharedActionGroups)[id]=group;
}
large.captures=large.actionProfiles['one-handed-swing'];validateStudioWorkspace(large);
await saveStudioWorkspace(large);large=null;
const stored=saved.get('workspace');let compressedBytes=0;
for(const group of Object.values({...stored.actionProfiles,...stored.sharedActionGroups}))for(const cap of Object.values(group))compressedBytes+=cap.raw.size;
assert.ok(31*800*1000*24>512*1024*1024);
assert.ok(compressedBytes<512*1024*1024);
const restored=await loadStudioWorkspace();validateStudioWorkspace(restored);let count=0;
for(const [id,group] of Object.entries({...restored.actionProfiles,...restored.sharedActionGroups}))for(const [pose,cap] of Object.entries(group)){assert.equal(hash(cap.raw),expected.get(id+'/'+pose));assert.deepEqual(cap.render.equipment.rotation,[-59,-180,18]);count++;}
assert.equal(count,31);
console.log(`PASS lossless autosave: 31 x 800x1000 six-facing captures (595200000 raw bytes) saved as ${compressedBytes} compressed pixel bytes; exact round-trip, shared/death/archive slots, cached compression, legacy reads, corruption bounds and failed-write preservation`);
