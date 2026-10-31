import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {poseWithFallback} from '../js/pose-fallbacks.mjs';
import {createPoseLibrary,recordLibraryPose,resolveLibraryPose} from '../js/pose-library.mjs';
import {combinedCaptureGroup,CAPTURE_GROUP_CATALOG,isSharedCaptureGroup} from '../js/action-capture-groups.mjs';
import {createStudioEquipment} from '../js/studio-equipment.mjs';
import {createStudioShield} from '../js/studio-shield.mjs';
import {createAuthoringStore} from '../js/authoring-store.mjs';
const sample=timeSeconds=>({animation:'Stabbing',sourceId:'uploaded:stabbing:0',timeSeconds});
let library=createPoseLibrary({id:'test',name:'Test'});
for(const [pose,time] of [['ready',.1],['windup',.2],['attack',.3]])library=recordLibraryPose(library,'one-handed-swing',pose,sample(time));
for(const profile of ['bow','two-handed-thrust','sling','dual-wield'])for(const pose of ['ready','windup','attack','falling','prone']){
 const result=resolveLibraryPose(library,profile,pose,[{sourceId:'uploaded:stabbing:0',duration:2}]);
 assert.equal(result.fallback,true);assert.equal(result.sample.timeSeconds,pose==='windup'?.2:pose==='attack'?.3:.1);
}
library=recordLibraryPose(library,'bow','attack',sample(.9));
library=recordLibraryPose(library,'death-prone','prone',sample(1));
assert.equal(resolveLibraryPose(library,'bow','attack',[{sourceId:'uploaded:stabbing:0',duration:2}]).sample.timeSeconds,.9);
assert.equal(poseWithFallback(library.profiles,library.sharedActionGroups,'bow','prone').sample.timeSeconds,1);
assert.equal(poseWithFallback(library.profiles,library.sharedActionGroups,'bow','cast'),null);
const capture={clip:'Stabbing',clipSourceId:'uploaded:stabbing:0',time:.1,render:{equipment:{position:[.1,.2,.3]}}};
const workspace={captureFormatVersion:2,settings:{weaponActionProfileId:'bow'},actionProfiles:{'one-handed-swing':{ready:capture,attack:{...capture,time:.3}}},sharedActionGroups:{}};
const combined=combinedCaptureGroup(workspace);
assert.equal(combined.ready,capture);assert.equal(combined.prone,capture);assert.equal(combined.falling,capture);
assert.equal(workspace.actionProfiles.bow,undefined);
const source=fs.readFileSync(new URL('../js/studio-capture.mjs',import.meta.url),'utf8');
const block=source.slice(source.indexOf('    if(ui.ActionProfile){\n      ui.ActionProfile.disabled'),source.indexOf('    if(ui.CaptureProfileSummary){'));
const ui={ActionProfile:{options:[...CAPTURE_GROUP_CATALOG.values()].filter(g=>g.id!=='spell-casting').map(g=>({value:g.id}))}};
vm.runInNewContext(block,{ui,busy:false,equipmentBusy:false,CAPTURE_GROUP_CATALOG,isSharedCaptureGroup,capturesByProfile:new Map([['one-handed-swing',{ready:{stale:true}}]]),getWorkspaceSettings:()=>({poseLibrary:library})});
assert.match(ui.ActionProfile.options.find(o=>o.value==='one-handed-swing').textContent,/^✅/);
assert.doesNotMatch(ui.ActionProfile.options.find(o=>o.value==='bow').textContent,/^✅/);
const threeSource=fs.readFileSync(new URL('../assets/vendor/three/three.core.min.js',import.meta.url));
const THREE=await import(`data:text/javascript;base64,${threeSource.toString('base64')}`);
const rig=new THREE.Group(),right=new THREE.Bone(),left=new THREE.Bone();
right.name='mixamorigRightHand';left.name='mixamorigLeftHand';rig.add(right,left);
rig.scale.set(2,3,4);rig.rotation.set(.2,.4,.7);right.rotation.set(.9,-.6,.3);left.rotation.set(-.4,.8,1);
const materials=[];
const loadAsset=async()=>{const material=new THREE.MeshStandardMaterial({color:0x808080,metalness:1});materials.push(material);return new THREE.Mesh(new THREE.BoxGeometry(),material);};
const managers=[createStudioEquipment({THREE,loadAsset,disposeObject(){}}),createStudioEquipment({THREE,offHand:true,loadAsset,disposeObject(){}}),createStudioShield({THREE,loadAsset,disposeObject(){}})];
for(const [i,manager] of managers.entries()){
 await manager.setModel(rig,i===2?{leftHandShield:'round-wooden-shield'}:{rightHand:i===0?'medieval-two-handed-sword':'dagger'});
 for(let axis=0;axis<3;axis++){
  const before=manager.snapshot().socketWorldPosition,current=manager.worldPosition();
  await manager.select(manager.withWorldPosition(axis,current[axis]+.025));
  const after=manager.snapshot().socketWorldPosition;
  for(let j=0;j<3;j++)assert.ok(Math.abs(after[j]-before[j]-(j===axis?.025:0))<1e-8,'Slider changes only its absolute world axis');
 }
 const settings=manager.snapshot().settings;
 await manager.setModel(rig,JSON.parse(JSON.stringify(settings)));
 assert.deepEqual(manager.snapshot().settings,settings,'Saved grips survive reload');
}
assert.equal(materials[0].metalness,.15);assert.equal(materials[4].metalness,.15);
assert.ok(materials[0].color.r>new THREE.Color(0x808080).r);
managers.forEach(m=>m.dispose());
const memory=new Map(),store=createAuthoringStore({getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},'/test/');
assert.equal(store.library('humanoid-medium').profiles.bow.ready,null);
const supplied=store.library('humanoid-medium-user-r16');
assert.equal(Object.values({...supplied.profiles,...supplied.sharedActionGroups}).flatMap(Object.values).filter(Boolean).length,25);
assert.equal(supplied.sharedActionGroups.magic.cast.timeSeconds,2.776666666666667);
console.log('PASS batch: explicit-first fallbacks, assignment checkmarks, world XYZ for primary/off-hand/shield, brighter materials, supplied 25-frame preset');
// The fallback render uses the existing capture path and restores the user's frame.
const studio=fs.readFileSync(new URL('../js/3d-studio.mjs',import.meta.url),'utf8');
const fallbackFn=studio.slice(studio.indexOf('function renderFallbackCapture('),studio.indexOf('function readCapturePose('));
let renderedAt;
const state={clips:[{id:'old'},{id:'fallback'}],action:{time:1.2},playing:true,mixer:{update(){}}};
const uiState={Clip:{value:'0'}};
const scope={state,ui:uiState,animationSourceId:clip=>clip.id,equipment:{restoreConstraints(){},applyConstraints(){}},setClip(index){uiState.Clip.value=String(index);state.action={time:0};},readCapturePose(){renderedAt={clip:uiState.Clip.value,time:state.action.time};return {equipment:'current-loadout'};},updateAnimationControls(){},invalidate(){}};
vm.runInNewContext(fallbackFn,scope);
assert.equal(scope.renderFallbackCapture({clipSourceId:'fallback',time:.7}).equipment,'current-loadout');
assert.deepEqual(renderedAt,{clip:'1',time:.7});assert.equal(uiState.Clip.value,'0');assert.equal(state.action.time,1.2);assert.equal(state.playing,true);
