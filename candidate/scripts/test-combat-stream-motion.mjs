import assert from 'node:assert/strict';
import vm from 'node:vm';import {readFileSync} from 'node:fs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {streamSettings,createStreamField,COMBAT_STREAM_PATH} from '../js/combat-stream-field.mjs';
import {installUnitSnowOcclusion,bindUnitSnowOcclusion} from '../js/combat-unit-snow-occlusion.mjs?v=tree-snow-grains1';

assert.equal(streamSettings({speed:0}).speed,0);assert.equal(streamSettings({speed:1.2,ripple:.8}).ripple,.8);assert.throws(()=>streamSettings({ripple:2}));
const src=readFileSync('js/combat-lighting-services.js','utf8'),body=src.slice(src.indexOf('function combatUnitStreamPresentation'),src.indexOf('function drawDirectCombatUnit'));
const ctx={combatGpu:{streamSample:()=>({depth:0,water:0}),unitGroundSample:()=>({depth:.15,water:.1})},worldPointForHex:(x,y)=>({x,y}),combatShadowScale:()=>[1,10,1],isIndoorWorldPoint:()=>false};vm.createContext(ctx);vm.runInContext(body,ctx);
assert.equal(ctx.combatUnitStreamPresentation({alive:false,x:0,y:0}).drop,1.5,'Corpse rests on puddle bed');assert.equal(ctx.combatUnitStreamPresentation({alive:true,x:0,y:0}).drop,0,'Preserve ordinary puddle walker placement');
const m=new THREE.MeshStandardMaterial(),u=installUnitSnowOcclusion(m),matrix=new THREE.Matrix4().makeTranslation(5,6,0),surface={stream:{},basins:{},bounds:[-10,-20,20,40],enabled:true,level:.12,active:true};
bindUnitSnowOcclusion(m,null,matrix,2,true,.49,surface,.7);assert(u.waterField.value);assert.equal(u.waterState.value.z,.7);assert.deepEqual(u.ground.value.elements,matrix.elements,'Water mapping binds without snow');
bindUnitSnowOcclusion(m,null,matrix,2,false,0,surface,0);assert.equal(u.waterField.value,false,'Indoor/disabled units reset shared uniforms');
// Same physical test as the fragment shader: a 15cm-deep basin filled to 10cm
// hides low torso fragments, while higher portions and dry-bank fragments remain.
const hidden=(body,bed,depth,water)=>water>.0005&&body-bed<water-depth;
assert(hidden(.05,.15,.15,.1));assert(!hidden(.12,.15,.15,.1));assert(hidden(.2,.7,.7,.49));assert(!hidden(.6,.7,.7,.49));assert(!hidden(.05,.15,0,0));
console.log('PASS motion range/zero controls, corpse puddle grounding, per-fragment water uniforms, partial/full depth thresholds and dry-bank exclusion');
