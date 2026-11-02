import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createStudioPoseLibrary} from '../js/studio-pose-library.mjs';
import {createPoseLibrary} from '../js/pose-library.mjs';
const elements=new Map(),events=new Map();
class Element{
 constructor(){this.value='';this.options=[];this.listeners={};this.classList={toggle(){}};}
 set id(id){this._id=id;elements.set(id,this);}get id(){return this._id;}
 set innerHTML(html){for(const [,id] of html.matchAll(/id="([^"]+)"/g)){const el=new Element();el.id=id;}}
 append(){} after(){} replaceChildren(...options){this.options=options;if(!options.some(x=>x.value===this.value))this.value=options[0]?.value||'';}add(option){this.options.push(option);}
 addEventListener(type,fn){this.listeners[type]=fn;}
}
for(const id of ['PoseLibraryMount','ActionProfile','ActionPose','CaptureSelectedPoseButton','CaptureProfileSummary']){const el=new Element();el.id='studio'+id;}
elements.get('studioActionProfile').value='one-handed-swing';elements.get('studioActionPose').value='ready';
globalThis.document={createElement:()=>new Element(),getElementById:id=>elements.get(id),addEventListener:(type,fn)=>events.set(type,fn)};
globalThis.window={addEventListener(){}};globalThis.Option=class{constructor(text,value){this.text=text;this.value=value;}};
globalThis.location={href:'https://example.test/candidate/3d-studio.html'};
let stored=new Map(),fail=false;
globalThis.localStorage={getItem:key=>stored.get(key)||null,setItem:(key,value)=>{if(fail)throw Error('quota');stored.set(key,value);}};
let linked=null,signature=null,sample={animation:'Test',sourceId:'uploaded:test:0',timeSeconds:.125};
const options={getSample:()=>sample,getClips:()=>[{sourceId:sample.sourceId,duration:5}],preview:async()=>{},selectProfile:async()=>{},getCaptureRecipes:()=>({}),invalidateCaptures(){},getSignature:()=>signature,getLinkedLibrary:()=>linked,setLink:(value,sig)=>{linked=value;signature=sig;}};
const panel=createStudioPoseLibrary(options);
for(const [pose,time] of [['ready',.125],['windup',.5],['attack',1.25]]){sample={...sample,timeSeconds:time};panel.recordCapture('one-handed-swing',pose);}
assert.equal(linked.profiles['one-handed-swing'].ready.timeSeconds,.125);
assert.equal(linked.profiles['one-handed-swing'].windup.timeSeconds,.5);
assert.equal(linked.profiles['one-handed-swing'].attack.timeSeconds,1.25);
assert.equal(JSON.parse([...stored.values()][0]).libraries[0].revision,3,'Each Capture saves its library without a second button');
sample={...sample,timeSeconds:2};panel.recordCapture('magic','cast');panel.recordCapture('death-prone','prone');
assert.equal(linked.sharedActionGroups.magic.cast.timeSeconds,2);assert.equal(linked.profiles['one-handed-swing'].cast,undefined);
const restored=createStudioPoseLibrary({...options,initialLibrary:structuredClone(linked)});assert.deepEqual(restored.library(),linked);
fail=true;sample={...sample,timeSeconds:3};restored.recordCapture('magic','casting-windup');
assert.match(elements.get('studioPoseLibraryStatus').textContent,/unsaved/);
assert.equal(linked.sharedActionGroups.magic['casting-windup'].timeSeconds,3,'Failed library persistence still retains open references for workspace/ZIP');
fail=false;
const before=[...stored];createStudioPoseLibrary({...options,readOnly:true,initialLibrary:createPoseLibrary({id:'readonly',name:'Preview'}),getCaptureRecipes:()=>({'bow':{ready:{clip:'T',clipSourceId:'uploaded:t:0',time:0}}})});assert.deepEqual([...stored],before,'Embedded previews never seed/write global libraries');
// Execute the real capture handler: it must record the frame before saving the
// same workspace snapshot, not depend on a disconnected library button.
const source=readFileSync(new URL('../js/studio-capture.mjs',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('  function capture(pose) {'),source.indexOf('  function snapshot()',source.indexOf('  function capture(pose) {')));
const order=[],capture={width:1,height:1,raw:new Uint8Array(24),time:.25};
const sandbox={busy:false,modelReady:true,selectedProfileId:'bow',groupPoses:()=>['ready'],captures:{},readPose:()=>capture,getStyle:()=>({}),frameEdgeDirections:()=>[],quantizeCapture(){},onCapture:(group,pose,value)=>{assert.equal(group,'bow');assert.equal(pose,'ready');assert.equal(value,capture);order.push('reference');},refresh(){},queueSave(){order.push('workspace');},freshCount:()=>6,poseLabel:()=> 'Ready',ui:{SheetStatus:{}},onStatus(){},onError:error=>{throw error;},document:{dispatchEvent(){}},CustomEvent:class{}};
vm.runInNewContext(fn,sandbox);sandbox.capture('ready');assert.deepEqual(order,['reference','workspace']);assert.equal(sandbox.captures.ready,capture);
const html=readFileSync(new URL('../3d-studio.html',import.meta.url),'utf8'),studio=readFileSync(new URL('../js/3d-studio.mjs',import.meta.url),'utf8');
assert.match(studio,/onCapture:\(profile,pose\)=>.*poseLibraryPanel.recordCapture\(profile,pose\)/);
const panelHtml=html.slice(html.indexOf('<section class="studio-animation'),html.indexOf('<aside class="studio-preview-column'));
for(const id of ['studioPoseLibraryMount','studioActionProfile','studioActionPose','studioCaptureSelectedPoseButton','studioWorkspaceStatus','studioExportPackageButton'])assert.ok(panelHtml.includes('id="'+id+'"'),id+' belongs to the one capture panel');
for(const id of ['studioCaptureReadyButton','studioRecordRecipe','studioSeedPoseLibrary','studioExportPoseLibrary'])assert.ok(!html.includes('id="'+id+'"'));
assert.ok(source.includes("entries.push(['pose-library.json'"),'The one ZIP includes reusable frame references');
console.log('PASS unified capture: one panel, capture-to-library-to-workspace wiring, exact frames, shared poses, autosave/reload, failure retention, read-only previews and combined ZIP');

assert.ok(studio.includes("initialLibrary:query.get('preview')==='1'?(linkedLibrary||state.poseLibrary):(state.poseLibrary||linkedLibrary)"),'Editable workspace retains new frames while embedded previews honor the pinned MOB library');
