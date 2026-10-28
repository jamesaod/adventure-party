import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createAuthoringStore,SHARED_POSE_LIBRARY_ID} from '../js/authoring-store.mjs';
import {createPoseLibrary,recordLibraryPose} from '../js/pose-library.mjs';
import {poseChecklist} from '../js/pose-checklist.mjs';
import {encodeStudioWorkspace,decodeStudioWorkspace} from '../js/studio-workspace-codec.mjs';
const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
const store=createAuthoringStore(storage,'/qa/');
assert.throws(()=>store.deleteLibrary(SHARED_POSE_LIBRARY_ID,0),/cannot be deleted/);
const sample={animation:'Idle',sourceId:'uploaded:idle:0',timeSeconds:.25};
let lib=recordLibraryPose(createPoseLibrary({id:'custom',name:'Custom'}),'one-handed-swing','ready',sample);
lib=store.saveLibrary(lib);assert.throws(()=>store.deleteLibrary(lib.id,0),/changed/);
store.deleteLibrary(lib.id,lib.revision);assert.equal(store.library(lib.id),null);
store.deleteLibrary('humanoid-small',0);assert.equal(createAuthoringStore(storage,'/qa/').library('humanoid-small'),null,'Deleted starter does not reappear');
assert.ok(store.library(SHARED_POSE_LIBRARY_ID));
const rows=poseChecklist(lib);assert.equal(rows.length,5);assert.equal(rows[0].state,'missing');assert.equal(rows[0].assigned,true);
const captured={clipSourceId:sample.sourceId,time:.25,raw:new Uint8Array(24),width:1,height:1,stale:false};
assert.equal(poseChecklist(lib,{'one-handed-swing':{ready:captured}})[0].state,'captured');
assert.equal(poseChecklist(lib,{'one-handed-swing':{ready:{...captured,stale:true}}})[0].state,'outdated');
assert.equal(poseChecklist(lib,{'one-handed-swing':{ready:{...captured,time:.5}}})[0].state,'outdated');
// Exercise actual capture-bank switching and clearing, retaining original pixel data.
const source=readFileSync(new URL('../js/studio-capture.mjs',import.meta.url),'utf8');
const code=source.slice(source.indexOf('  let captureLibraryId='),source.indexOf('  let windupDurationMs='));
const ctx={ui:{SheetStatus:{}},capturesByProfile:new Map([['one-handed-swing',{ready:captured}]]),equipmentByProfile:new Map(),busy:false,equipmentBusy:false,captures:{ready:captured},legacySharedCaptures:{},selectedProfileId:'one-handed-swing',style:{brightness:1},quantizeCapture(){},refresh(){},saveWorkspace(){},document:{dispatchEvent(){}},CustomEvent:class{}};
vm.createContext(ctx);vm.runInContext(code,ctx);
ctx.selectCaptureLibrary('first');ctx.selectCaptureLibrary('second');assert.equal(Object.keys(ctx.captures).length,0);
ctx.captures.attack={...captured,time:.75};ctx.selectCaptureLibrary('first');assert.equal(ctx.captures.ready.raw,captured.raw);assert.equal(ctx.captures.attack,undefined);
ctx.clearLibraryCaptures();assert.equal(Object.keys(ctx.captures).length,0);ctx.selectCaptureLibrary('second');assert.equal(ctx.captures.attack.time,.75,'Clearing one library preserves another');
const workspace={captures:{},libraryCaptures:{first:{groups:{'one-handed-swing':{ready:captured}},legacySharedCaptures:{}}}};
const encoded=await encodeStudioWorkspace(workspace);assert.ok(encoded.libraryCaptures.first.groups['one-handed-swing'].ready.raw instanceof Blob);
const decoded=await decodeStudioWorkspace(encoded);assert.deepEqual(decoded.libraryCaptures.first.groups['one-handed-swing'].ready.raw,captured.raw);
console.log('PASS protected Shared library, durable deletion, revision conflicts, five baseline checklist slots, assigned/current/outdated distinction, capture isolation/clear and bank compression round-trip');
// The existing DOM harness runs the real panel handlers for reviewed import.
await import('./test-studio-unified-capture.mjs');
const {createStudioPoseLibrary}=await import('../js/studio-pose-library.mjs');
const el=id=>document.getElementById('studio'+id);
let cleared=0,current=null;
const panel=createStudioPoseLibrary({getSample:()=>sample,getClips:()=>[],preview:async()=>{},selectProfile:async()=>{},getCaptureRecipes:()=>({}),invalidateCaptures(){},getSignature:()=>null,getLinkedLibrary:()=>null,setLink:value=>current=value,clearCaptures:()=>cleared++});
await el('NewPoseLibrary').listeners.click();const target=panel.library().id;
const incoming=recordLibraryPose(createPoseLibrary({id:'incoming',name:'Incoming'}),'one-handed-swing','attack',sample);
el('PoseLibraryFile').files=[{size:500,text:async()=>JSON.stringify(incoming)}];
await el('PoseLibraryFile').listeners.change();assert.equal(panel.library().id,target,'Choosing a file only reviews it');
el('LibraryImportMode').value='replace';
let pending=el('ApplyLibraryImport').listeners.click();el('LibraryConfirmNo').listeners.click();await pending;assert.equal(cleared,0);
pending=el('ApplyLibraryImport').listeners.click();el('LibraryConfirmYes').listeners.click();await pending;
assert.equal(panel.library().id,target);assert.equal(panel.library().profiles['one-handed-swing'].attack.sourceId,sample.sourceId);assert.equal(cleared,1);
await el('PoseLibraryFile').listeners.change();el('LibraryImportMode').value='new';await el('ApplyLibraryImport').listeners.click();assert.notEqual(panel.library().id,target);assert.equal(cleared,1,'Import as new does not clear the previous library');
console.log('PASS JSON review before mutation, replacement cancellation/confirmation and import-as-new isolation');

// A new ID copies assignments without overwriting the old library.
const oldId=panel.library().id;el('PoseLibraryId').value='orc-custom-poses';await el('SaveLibraryId').listeners.click();
assert.equal(panel.library().id,'orc-custom-poses');assert.ok(panel.library().profiles['one-handed-swing'].attack);
el('PoseLibraryId').value=SHARED_POSE_LIBRARY_ID;await el('SaveLibraryId').listeners.click();assert.equal(panel.library().id,'orc-custom-poses','Duplicate IDs never overwrite Shared');
el('PoseLibraryId').value='Invalid ID';await el('SaveLibraryId').listeners.click();assert.equal(panel.library().id,'orc-custom-poses','Invalid ID does not change the selection');
// Capture-bank copies own their pixels; later edits cannot affect the source.
ctx.structuredClone=structuredClone;ctx.selectCaptureLibrary('copied',{copyCurrent:true});assert.equal(ctx.captures.attack.time,.75);ctx.captures.attack.time=1;ctx.selectCaptureLibrary('second');assert.equal(ctx.captures.attack.time,.75);
console.log('PASS editable ID copy, duplicate/invalid guards and independent capture banks');
// The supplied Orc library is exact and appears once even with a browser copy.
const {ORC_FIGHTER_POSE_LIBRARY}=await import('../js/orc-fighter-pose-library.mjs');
assert.deepEqual(ORC_FIGHTER_POSE_LIBRARY,JSON.parse(readFileSync(new URL('../data/pose-libraries/orc-fighter.json',import.meta.url),'utf8')));
assert.equal(store.libraries().filter(l=>l.id==='orc-fighter').length,1);
const orcSaved=store.saveLibrary({...store.library('orc-fighter'),name:'My edited Orc'});
assert.equal(store.libraries().filter(l=>l.id==='orc-fighter').length,1);
assert.equal(store.library('orc-fighter').name,'My edited Orc');
store.deleteLibrary('orc-fighter',orcSaved.revision);assert.equal(store.library('orc-fighter'),null);
console.log('PASS exact Orc Fighter preset, duplicate prevention, saved precedence and deletion');
