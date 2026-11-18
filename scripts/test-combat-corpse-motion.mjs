import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {sampleDirectPose,MODEL_ANIMATION_FPS,modelPoseSeconds} from '../js/combat-direct-units.mjs?v=outline-reuse2';
const source=fs.readFileSync('js/combat-environment-state.js','utf8');
const ctx={performance:{now:()=>0},worldPointForHex:()=>({x:0,y:0}),architecturalHexCoreVertices:()=>Array.from({length:6},(_,i)=>({x:10*Math.cos(i*Math.PI/3),y:10*Math.sin(i*Math.PI/3)})),environmentRayHit:()=>null,combatSceneTerrain:null};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function corpseMotionProgress'),source.indexOf('function startArrowBlood')),ctx);
for(let i=0;i<1000;i++){const p=ctx.sampleCorpseOffset({x:0,y:0});assert(Math.hypot(p.x,p.y)<=5);}
const entity={alive:false,deathPresentationStartedAt:0,deathAnimationDurationMs:2000,deathWorldOffset:{x:4,y:2},deathRotationDelta:2};
assert.equal(ctx.corpseMotionProgress(entity,0),0);assert.equal(ctx.corpseMotionProgress(entity,1000),.5);assert.equal(ctx.corpseMotionProgress(entity,2000),1);assert.equal(ctx.corpseMotionProgress(entity,3000),1);
globalThis.adventurePartyCorpseProgress=ctx.corpseMotionProgress;
const asset={group:new THREE.Group(),camera:new THREE.PerspectiveCamera()},frame={asset,yaw:.4};
assert.equal(sampleDirectPose(frame,entity,undefined,0).yaw,.4);
assert.equal(sampleDirectPose(frame,entity,undefined,1000).yaw,1.4);
assert.equal(sampleDirectPose(frame,entity,undefined,2000).yaw,2.4);
assert.equal(MODEL_ANIMATION_FPS,0);
console.log('PASS half-radius corpse bounds, gradual displacement/rotation, stable final pose and uncapped sampling');

assert.equal(modelPoseSeconds(.017),.017,"Model poses preserve sub-30-Hz elapsed time");

// Existing corpses reserve their final world positions, even while falling.
const first={x:0,y:0,alive:false,deathWorldOffset:{x:0,y:0}},second={x:0,y:0,alive:false,giantClubProneDeath:true};
ctx.allUnits=()=>[first,second];
const offset=ctx.sampleCorpseOffset(second);
assert(Math.hypot(offset.x,offset.y/.568329)>=51,'Find a non-overlapping adjacent resting spot');
assert.equal(second.corpsePlacementDurationMs,600);
second.deathPresentationStartedAt=0;assert.equal(ctx.corpseMotionProgress(second,0),0);assert.equal(ctx.corpseMotionProgress(second,300),.5);assert.equal(ctx.corpseMotionProgress(second,600),1);
ctx.environmentRayHit=()=>({t:.2});assert.deepEqual(JSON.parse(JSON.stringify(ctx.sampleCorpseOffset(second))),{x:0,y:0},'Never move through walls when no free site exists');
ctx.environmentRayHit=()=>null;
let probes=0;ctx.combatGpu={unitWaterSurface:{revision:1},unitGroundSample:(x,y)=>{probes++;return {bedDepth:.01*x+.02*y};}};
const plane=ctx.corpseGroundSlope(second);assert(Math.abs(plane.dx-.01)<1e-8);assert(Math.abs(plane.dy-.02)<1e-8);
const count=probes;ctx.corpseGroundSlope(second);assert.equal(probes,count,'Settled slope is cached');
ctx.combatGpu.unitWaterSurface.revision++;ctx.corpseGroundSlope(second);assert(probes>count);
globalThis.adventurePartyCorpseSlope=(e,x,y)=>x*.2;
const tilted={alive:false,deathPresentationStartedAt:0,deathAnimationDurationMs:2000};
const tiltCamera=new THREE.OrthographicCamera(-1,1,1,-1,.1,100);tiltCamera.position.set(0,3,4);tiltCamera.lookAt(0,0,0);tiltCamera.updateMatrixWorld(true);
const tiltFrame={asset:{group:new THREE.Group(),camera:tiltCamera},yaw:0};
const pose=sampleDirectPose(tiltFrame,tilted,undefined,1000,100);assert(Math.abs(pose.asset.group.quaternion.z)>.01,'Slope tilts the dying pose');
const live=sampleDirectPose(tiltFrame,{alive:true},undefined,1000,100);assert(Math.abs(live.asset.group.quaternion.z)<1e-8,'A shared live rig does not inherit corpse tilt');
delete globalThis.adventurePartyCorpseSlope;
console.log('PASS corpse avoidance, immediate-prone relocation easing, wall rejection, cached terrain plane and shared-rig slope isolation');
