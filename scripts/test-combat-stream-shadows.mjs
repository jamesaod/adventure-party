import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {streamShadowUniforms,updateStreamShadowUniforms,STREAM_SHADOW_GLSL} from '../js/combat-stream-shadows.mjs';
const u=streamShadowUniforms(THREE),view={matrix:[.8,.6,-.6,.8,120,-30]},field={enabled:true,map:{},bounds:[-64,-64,128,128]};
updateStreamShadowUniforms(u,field,view,[1,2,3,0],[40,10,24]);assert.equal(u.bedShadowEnabled.value,true);assert.equal(u.bedShadowMap.value,field.map);const p=new THREE.Vector3(7,11,1),q=p.clone().applyMatrix3(u.bedShadowView.value).applyMatrix3(u.bedShadowInverse.value);assert.ok(q.distanceTo(p)<1e-10);assert.deepEqual(u.bedShadowScale.value.toArray(),[40,24]);updateStreamShadowUniforms(u,null,view,[0,1,0,0]);assert.equal(u.bedShadowEnabled.value,false);assert.match(STREAM_SHADOW_GLSL,/exp\(-2\.6\*channel.y\)/);console.log('PASS stream receiver binding, camera inverse and dry-scene fallback');
