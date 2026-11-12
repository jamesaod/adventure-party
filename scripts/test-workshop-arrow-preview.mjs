import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import vm from 'node:vm';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {createWorkshopArrowPreview} from '../js/workshop-arrow-preview.mjs';
import {createStudioEquipment} from '../js/studio-equipment.mjs';
import {createStudioBackEquipment} from '../js/studio-back-equipment.mjs';
import {createHandPose} from '../js/mob-workshop-hand-pose.mjs';
import {bowPickupTime} from '../js/equipment-visual-states.mjs';
import {findHumanoidBone} from '../js/humanoid-rig.mjs';
import {extractCombatFunction} from './combat-test-source.mjs';
registerHooks({resolve(s,c,n){return s==='three'?{url:new URL('../assets/vendor/three/three.module.min.js',import.meta.url).href,shortCircuit:true}:n(s,c);}});
const {GLTFLoader}=await import('../assets/vendor/three/addons/loaders/GLTFLoader.js');
async function load(file){const b=readFileSync(file);return new GLTFLoader().register(()=>({name:'headless',loadMaterial:()=>Promise.resolve(new THREE.MeshStandardMaterial())})).parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const {scene:model,animations}=await load('assets/animations/ual2/ual2-bow-notch.glb');
model.userData.workshopPhysicalEquipment=true;
const main=createStudioEquipment({THREE,loadAsset:()=>load('assets/models/weapons/low-poly-medieval/bow_1-morph.glb').then(g=>g.scene),disposeObject:()=>{}});
const back=createStudioBackEquipment({THREE,loadAsset:item=>load(item.file).then(g=>g.scene)});
await main.setModel(model,{rightHand:'longbow'});await back.setModel(model,{item:'auto'});
const handPose=createHandPose(THREE);handPose.bind(model);
const mixer=new THREE.AnimationMixer(model),action=mixer.clipAction(animations[0]);action.play();mixer.setTime(.9);
const handSettings={wrist:[4,0,0],curl:[5,0,0,0,0]};handPose.apply(handSettings);model.updateMatrixWorld(true);
const nock=findHumanoidBone(model,'rightIndex1')||findHumanoidBone(model,'rightHand'),world=node=>node.getWorldPosition(new THREE.Vector3());
const near=(a,b,label)=>assert(a.distanceTo(b)<1e-5,label+': '+a.distanceTo(b));
let loads=0,disposals=0,releaseLoad;
const preview=createWorkshopArrowPreview({THREE,main,back,loadQuiver:async()=>{loads++;const {scene}=await load('assets/models/weapons/low-poly-medieval/quiver.glb');if(releaseLoad)await new Promise(resolve=>releaseLoad=resolve);return scene;},disposeObject:()=>disposals++});
const assignment={clipId:'bow',start:0,end:2.5,speed:1,loop:false,bowTiming:{pickup:.25,draw:.625,release:1.625}},source={data:animations[0]};
const args={model,source,assignment,clip:()=>animations[0].clone(),handPose,handSettings,backId:'auto',fitKey:null};
const boneState=[];model.traverse(o=>{if(o.isBone)boneState.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]);});
const shown=world(nock),clock=action.time;
await preview.prepare(args);
assert.equal(action.time,clock);assert.equal(action.isRunning(),true);
near(shown,world(nock),'Calibration restores currently displayed hand pose');
for(const [bone,p,q,s] of boneState){near(bone.position,p,'Bone position restored');near(bone.scale,s,'Bone scale restored');assert(bone.quaternion.toArray().every((value,i)=>Math.abs(value-q.toArray()[i])<1e-8),'Bone rotation restored: '+bone.name);}
assert.equal(loads,1);await preview.prepare({...args});assert.equal(loads,1,'Unchanged calibration is cached');
const originalBundle=preview.bundle(),tuned={widthPercent:20,count:8,spacingPercent:50,position:[.02,.01,0],rotation:[10,0,20]};
await preview.prepare({...args,arrows:tuned});assert.equal(preview.bundle(),originalBundle,'Bundle edits retain the gizmo target');assert.equal(loads,1,'Bundle edits must not reload the quiver');
near(originalBundle.position,new THREE.Vector3(...tuned.position),'Saved bundle offsets reach the live preview');
preview.sample(assignment,0,true);near(world(preview.marker),world(originalBundle),'Marker follows the edited bundle');
assert.equal(originalBundle.children.filter(o=>o.name==='QuiverSpareArrow'&&o.visible).length,7);
await preview.prepare(args);
const pose=t=>{handPose.restore();mixer.setTime(t);handPose.apply(handSettings);model.updateMatrixWorld(true);};
pose(.25);preview.sample(assignment,.25,true);
near(world(preview.marker),world(nock),'Automatic marker meets drawing fingers at exact pickup');
const arrow=model.getObjectByName('DrawnBowArrow');near(world(arrow),world(preview.marker),'Live arrow starts at the marker');
for(const yaw of [0,Math.PI/3,Math.PI]){
 model.rotation.y=yaw;
 for(const t of [0,.25,.4,.625,1.7]){
  pose(t);preview.sample(assignment,t,true);
  near(world(preview.marker),world(preview.origin()),'Marker stays attached in every pose/facing');
  assert(preview.marker.visible);
  if(t===0)near(world(arrow),world(preview.marker),'Stored arrow nock is marked');
  if(t>=.25&&t<1.625)near(world(arrow),world(nock),'Carry and draw use runtime hand attachment');
  if(t===1.7)assert(!arrow.visible,'Arrow disappears at release');
 }
}
preview.sample(assignment,.4,false);assert(!preview.marker.visible,'Checkbox hides only marker');assert(arrow.visible);
preview.reset();assert.equal(main.getArrowPickup().root,null);assert.equal(preview.marker.parent,null);assert.equal(disposals,1);
await back.select({item:'empty-quiver',position:[.14,.1,.16],rotation:[0,0,-15],sizePercent:100});
await preview.prepare({...args,backId:'empty-quiver'});assert.equal(loads,1,'Manual quiver is reused');
assert.equal(preview.origin().parent,back.getArrowSocket());assert(!model.getObjectByName('BowBackQuiver'),'No duplicate auto quiver');
preview.sample(assignment,0,true);const old=world(preview.marker);
await back.select({item:'empty-quiver',position:[.3,.1,.16],rotation:[12,15,-30],sizePercent:50});
preview.sample(assignment,0,true);near(world(preview.marker),world(back.getArrowSocket()),'Marker follows Back fit edits');assert(world(preview.marker).distanceTo(old)>.05);
near(preview.marker.getWorldScale(new THREE.Vector3()),new THREE.Vector3(1,1,1),'Marker size is independent of quiver scale');
preview.reset();assert.equal(back.getArrowSocket().children.filter(o=>o.name==='QuiverSpareArrow').length,0,'Reset removes borrowed spare arrows');
await main.select({rightHand:'none'});preview.sample(null,0,true);assert(preview.marker.visible,'Manual origin can be fitted without holding a bow');
await back.select({item:'none'});preview.sample(null,0,true);assert(!preview.marker.visible);assert.equal(preview.marker.parent,null);
// Async asset completion after clearing the model must not resurrect a quiver.
await main.select({rightHand:'longbow'});releaseLoad=true;
const pending=preview.prepare(args);
while(typeof releaseLoad!=='function')await new Promise(resolve=>setImmediate(resolve));
preview.reset();releaseLoad();await pending;assert.equal(preview.origin(),null);assert.equal(disposals,2);
// Exercise the real button handler: source time is converted to the trimmed clock.
const code=readFileSync('js/mob-workshop.mjs','utf8'),uiAssignment={...assignment,start:.1,speed:2},elements={time:{},clock:{}};
const ui=vm.createContext({pickupAssignment:()=>uiAssignment,bowPickupTime,choose:()=>{},playing:true,current:{time:1,paused:true,enabled:false},
 managers:{main:{restoreConstraints(){}}},handPose:{restore(){}},mixer:{update(){}},$:id=>elements[id],prepareArrowPreview:async()=>{},status(){}});
vm.runInContext(extractCombatFunction(code,'goToArrowPickup'),ui);await ui.goToArrowPickup();
assert.equal(ui.playing,false);assert.equal(ui.current.paused,false);assert.equal(ui.current.enabled,true);assert.equal(ui.current.time,.15);assert.equal(elements.time.value,.15);
// Switching from main-hand fitting to bundle fitting must not detach the first drag.
let refreshes=0,selectedSlot='main';
const fitUi=vm.createContext({pickupAssignment:()=>assignment,draft:{clips:[{clipId:'bow',id:'bow'}],equipment:{back:'auto'},height:1.85},model,
 arrowPreview:{prepare:async()=>{},bundle:()=>originalBundle},managers:{back:{snapshot:()=>({settings:{}})}},
 handPose,handValue:()=>({}),bound:()=>null,syncArrowPickupControls(){},lastBundleSocket:null,
 $:()=>({value:selectedSlot}),fitTool:{refresh(){refreshes++;}}});
vm.runInContext(extractCombatFunction(code,'prepareArrowPreview'),fitUi);
await fitUi.prepareArrowPreview();selectedSlot='quiverArrows';await fitUi.prepareArrowPreview();assert.equal(refreshes,0,'Unchanged bundle keeps its active drag');
main.dispose();back.dispose();preview.reset();
console.log('PASS Workshop arrow preview: exact auto/manual origin, pose and clock preservation, pickup/carry/draw/release, rotation, fit scale, visibility, async cancellation and trimmed pickup seek.');
