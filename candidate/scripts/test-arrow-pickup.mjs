import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {registerHooks} from 'node:module';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {createBowString} from '../js/procedural-bow-string.mjs';
import {bowPickupTime,bowArrowStateAt,validateBowTiming} from '../js/equipment-visual-states.mjs';
import {findHumanoidBone} from '../js/humanoid-rig.mjs';
import {ARROW_VISUAL,arrowScaleForFrame} from '../js/arrow-visual-profile.mjs';
registerHooks({resolve(s,c,n){return s==='three'?{url:new URL('../assets/vendor/three/three.module.min.js',import.meta.url).href,shortCircuit:true}:n(s,c);}});
const {GLTFLoader}=await import('../assets/vendor/three/addons/loaders/GLTFLoader.js');
async function load(file){const b=readFileSync(file);return new GLTFLoader().register(()=>({name:'headless-material',loadMaterial:()=>Promise.resolve(new THREE.MeshStandardMaterial())})).parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const assignment={start:0,end:2.5,speed:1,bowTiming:{draw:.625,release:1.625}};
validateBowTiming(assignment);assert.equal(bowPickupTime(assignment),.21875);
assert.equal(bowArrowStateAt(assignment,.1).phase,'quiver');assert.equal(bowArrowStateAt(assignment,.3).phase,'carry');assert.equal(bowArrowStateAt(assignment,.625).phase,'nocked');assert.equal(bowArrowStateAt(assignment,1.625).phase,'released');
assert.equal(bowPickupTime({start:1,bowTiming:{draw:1}}),null,'No invented pickup when a saved clip has no lead-in');
assert.equal(bowPickupTime({...assignment,bowTiming:{...assignment.bowTiming,pickup:.2}}),.2);
assert.throws(()=>validateBowTiming({...assignment,bowTiming:{...assignment.bowTiming,pickup:.8}}),/pickup/);
const rig=await load('assets/animations/ual2/ual2-bow-notch.glb');
const left=findHumanoidBone(rig.scene,'leftHand'),nock=findHumanoidBone(rig.scene,'rightIndex1')||findHumanoidBone(rig.scene,'rightHand');assert(left&&nock);
const bow=await load('assets/models/weapons/low-poly-medieval/bow_1-morph.glb');left.add(bow.scene);
let body;bow.scene.traverse(o=>{if(o.userData.bowStringAnchors)body=o;});
const controller=createBowString(THREE,bow.scene,left),arrow=body.getObjectByName('DrawnBowArrow');
const mixer=new THREE.AnimationMixer(rig.scene),action=mixer.clipAction(rig.animations[0]).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
const pose=t=>{mixer.setTime(t);rig.scene.updateMatrixWorld(true);};
pose(bowPickupTime(assignment));const quiver=await load('assets/models/weapons/low-poly-medieval/quiver.glb');controller.calibratePickup(quiver.scene);
const holder=rig.scene.getObjectByName('BowBackQuiver');assert(holder?.parent===findHumanoidBone(rig.scene,'upperChest'));
const near=(a,b,label)=>assert(a.distanceTo(b)<1e-5,label+': '+a.distanceTo(b));
const point=(node,v=new THREE.Vector3())=>node.localToWorld(v);
controller.update(false,bowArrowStateAt(assignment,.1,4));near(point(arrow),nock.getWorldPosition(new THREE.Vector3()),'stored nock meets fingers at pickup pose');
assert.equal(arrow.userData.drawnArrow,false,'Stored arrow must not supply a projectile launch point');
for(const yaw of [0,Math.PI/3,Math.PI,Math.PI*5/3]){
 rig.scene.rotation.y=yaw;
 for(const t of [.22,.3,.45,.6,.625,.9,1.4]){
  pose(t);const state=bowArrowStateAt(assignment,t,4);controller.update(state.phase==='nocked',state);
  assert(arrow.visible);near(point(arrow),nock.getWorldPosition(new THREE.Vector3()),'carried/nocked arrow follows hand in every facing');
  assert(point(arrow,new THREE.Vector3(0,1,0)).distanceTo(point(arrow))>=ARROW_VISUAL.lengthMetres-1e-5);
  assert.equal(arrow.userData.drawnArrow,state.phase==='nocked');
  if(state.phase==='carry')assert.equal(body.morphTargetInfluences[0],0,'Pickup cannot stretch the bowstring');
 }
}
pose(1.625);controller.update(false,bowArrowStateAt(assignment,1.625,3));assert.equal(arrow.visible,false);assert.equal(body.morphTargetInfluences[0],0);assert.equal(controller.getPickup().bundle.children.filter(n=>n.name==='QuiverSpareArrow'&&n.visible).length,3);
pose(0);controller.update(false,{phase:'idle',remaining:4});near(point(arrow),holder.getWorldPosition(new THREE.Vector3()),'next arrow remains in quiver during idle');
controller.update(false,{phase:'idle',remaining:0});assert(!arrow.visible);assert(!controller.getPickup().bundle.children.some(n=>n.name==='QuiverSpareArrow'&&n.visible));
controller.update(true,{phase:'nocked',remaining:4});
const shaft=arrow.children.find(n=>n.geometry?.type==='CylinderGeometry');assert(Math.abs(shaft.geometry.parameters.radiusTop*2*ARROW_VISUAL.pixelsPerMetre-ARROW_VISUAL.shaftWidth)<1e-9);
const feather=arrow.children.find(n=>n.geometry?.type==='PlaneGeometry');assert.equal(feather.geometry.parameters.width*ARROW_VISUAL.pixelsPerMetre,ARROW_VISUAL.featherWidth);
// The actual flying/lodged renderer consumes those same visual dimensions.
const source=readFileSync('js/combat-effect-animation.js','utf8'),start=source.indexOf('function drawCombatArrowSilhouette('),end=source.indexOf('async function animateArrowProjectile(',start);
const strokes=[],fills=[],ctx={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},stroke(){strokes.push({width:this.lineWidth,color:this.strokeStyle});},fill(){fills.push(this.fillStyle);}};
const sandbox=vm.createContext({ctx,AdventurePartyArrowVisual:ARROW_VISUAL,combatArrowShadowPoint:()=>null});vm.runInContext(source.slice(start,end),sandbox);
sandbox.drawCombatArrowSilhouette({x:0,y:0},{x:16,y:0});assert(Math.abs(strokes[0].width-shaft.geometry.parameters.radiusTop*2*ARROW_VISUAL.pixelsPerMetre)<1e-9);assert.equal(strokes[0].color,ARROW_VISUAL.wood);assert.equal(fills[0],ARROW_VISUAL.head);
// Match the map arrow at different real model-frame sizes, including close-up
// models. The shaft must never lengthen to span the draw-hand/bow-hand distance.
const camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,100);camera.position.set(0,0,10);camera.updateMatrixWorld(true);
for(const width of [64,160,320]){
 const factor=arrowScaleForFrame(camera,width),pixelsPerUnit=width/4;
 for(const t of [.3,.625,1.4]){
  pose(t);const state=bowArrowStateAt(assignment,t,4);controller.update(state.phase==='nocked',state,factor);
  const tail=point(arrow),tip=point(arrow,new THREE.Vector3(0,1,0));
  assert(Math.abs(tail.distanceTo(tip)*pixelsPerUnit-16)<1e-5,'Held shaft has the map arrow\'s 16px length before foreshortening');
  const radius=shaft.geometry.parameters.radiusTop;
  assert(Math.abs(point(arrow,new THREE.Vector3(radius,0,0)).distanceTo(tail)*2*pixelsPerUnit-ARROW_VISUAL.shaftWidth)<1e-5,'Held shaft matches map stroke width');
  const a=tail.clone().project(camera),b=tip.clone().project(camera);
  assert(Math.hypot(a.x-b.x,a.y-b.y)*width/2<=16.00001,'No oversized projected shaft');
 }
 controller.update(false,{phase:'idle',remaining:4},factor);
 const spare=controller.getPickup().bundle.children.find(n=>n.name==='QuiverSpareArrow');
 assert(Math.abs(point(spare).distanceTo(point(spare,new THREE.Vector3(0,1,0)))*pixelsPerUnit-16)<1e-5,'Quiver arrows match map scale too');
}
assert(Math.abs(quiver.scene.getWorldScale(new THREE.Vector3()).x-.29)<1e-6,'Quiver width is 50% of its former .58 scale');
assert(Math.abs(quiver.scene.getWorldScale(new THREE.Vector3()).y-.29)<1e-6,'Quiver height is 50% of its former .58 scale');
console.log('PASS map-scale held/carried/spare arrows across frame sizes, fixed shaft length and 50% quiver dimensions.');
controller.dispose();assert.equal(holder.parent,null,'Unequipping removes the back attachment');
const audio=readFileSync('js/bow-audio.js','utf8');assert(audio.includes("draw:{file:'draw.wav',gain:.425}"),'Keep the requested half-volume draw');
console.log('PASS actual Notch clip: quiver pickup, continuous hand attachment, all facings, resting string before nock, release, ammo visibility, detach, and shared held/flying/lodged arrow dimensions.');
