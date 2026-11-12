import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {sampleDirectPose,MODEL_ANIMATION_FPS} from '../js/combat-direct-units.mjs';
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
assert.equal(MODEL_ANIMATION_FPS,30);
console.log('PASS half-radius corpse bounds, gradual displacement/rotation, stable final pose and 30 FPS');
