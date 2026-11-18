import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/three.module.min.js';
import {lightingProfile,compressDiffuse,composeSnowDisplay,bindLightingProfile} from '../js/combat-lighting-profile.mjs';
import {restoreDirectMaterials} from '../js/combat-direct-units.mjs?v=outline-reuse2';
assert.deepEqual(compressDiffuse([0,0,0]),[0,0,0],'Unlit surfaces do not glow');
for(const rgb of [[.02,.01,.005],[.6,.3,.1]])assert.deepEqual(compressDiffuse(rgb),rgb,'Ordinary diffuse light is unchanged');
let previous=0;
for(const peak of [.6,.7,1,2,10,100]){
 const rgb=[peak,peak*.5,peak*.2],out=compressDiffuse(rgb);
 assert(out[0]>=previous&&out[0]<1.2,'Bright reflection stays monotonic and bounded');previous=out[0];
 assert(Math.abs(out[1]/out[0]-.5)<1e-12&&Math.abs(out[2]/out[0]-.2)<1e-12,'Highlight color is preserved');
 assert.deepEqual(compressDiffuse(rgb,0),rgb,'Before comparison bypasses correction');
}
const material=new T.MeshStandardMaterial({roughness:.2,metalness:.8});bindLightingProfile(material);
assert.equal(material.roughness,.92);assert.equal(material.metalness,.1);
bindLightingProfile(material,lightingProfile({roughness:.4,metalness:.5}));assert.equal(material.roughness,.4);assert.equal(material.metalness,.5);
const shield=new T.Mesh(new T.BoxGeometry(),material);shield.userData.studioShield=true;restoreDirectMaterials(shield);
const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:T.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);
assert.equal(shader.uniforms.apMaterial.value.z,0);assert.equal(shader.uniforms.apMaterial.value.w,1);
assert(shader.fragmentShader.includes('apDiffuse(apTotalDiffuse*apLight.x)-apTotalDiffuse'));
assert(shader.fragmentShader.includes('totalEmissiveRadiance'),'Emissive effects remain separate');
const warm=new T.Color().setRGB(1,192/255,110/255,T.SRGBColorSpace);
assert(warm.g<192/255&&warm.b<110/255,'sRGB warm colors must be decoded before linear light accumulation');
assert.equal(lightingProfile({compression:-2,local:Infinity}).compression,0);
assert.equal(lightingProfile({local:Infinity}).local,1);
for(const ambient of [[0,0,0],[.08,.1,.15],[.7,.8,.97],[.9,1,1],[1,1,1]]){
 assert.deepEqual(composeSnowDisplay(ambient,[0,0,0]),ambient,'No lamp: retain ambient snow exactly at every brightness');
 let previous=ambient;
 for(const power of [0,.01,.1,1,10,100,1e6]){
  const lit=composeSnowDisplay(ambient,[power,power*.4,power*.08]);
  lit.forEach((v,i)=>{assert(v>=ambient[i]&&v>=previous[i],'Lamp cannot dim ambient snow or reverse with power');assert(v<=ambient[i]+(1-ambient[i])*.35+1e-12,'Only lamp lift is bounded, independently of ambient brightness');});
  previous=lit;
 }
}
const warmSnow=composeSnowDisplay([.08,.1,.15],[10,4,.8]);assert(warmSnow[0]>warmSnow[1]&&warmSnow[1]>warmSnow[2],'Bright warm light remains colored on night snow');
assert(composeSnowDisplay([.1,.1,.1],[100,100,100],0)[0]>.99,'Highlight-limit comparison bypass works');
console.log('PASS bounded color-preserving highlights, unchanged low light, material controls, emissive separation and warm-light color space');

// The real bow rig includes unlit helpers; other live models retain lit
// materials whose shader does not declare Standard's totalDiffuse local.
for(const [kind,Material] of [['standard',T.MeshStandardMaterial],['physical',T.MeshPhysicalMaterial],['lambert',T.MeshLambertMaterial],['phong',T.MeshPhongMaterial],['toon',T.MeshToonMaterial],['basic',T.MeshBasicMaterial]]){
 const m=new Material(),mesh=new T.Mesh(new T.BoxGeometry(),m);restoreDirectMaterials(mesh);
 const shader={uniforms:{},vertexShader:T.ShaderLib[kind].vertexShader,fragmentShader:T.ShaderLib[kind].fragmentShader};m.onBeforeCompile(shader);
 const correction=shader.fragmentShader.includes('vec3 apTotalDiffuse=reflectedLight.directDiffuse+reflectedLight.indirectDiffuse;');
 assert.equal(correction,kind!=='basic',kind+' lit/unlit treatment');
 assert(!shader.fragmentShader.includes('apDiffuse(totalDiffuse'),kind+' must not require Standard-only locals');
 if(correction)assert(shader.fragmentShader.indexOf('ReflectedLight reflectedLight')<shader.fragmentShader.indexOf('vec3 apTotalDiffuse='));
 mesh.geometry.dispose();m.dispose();
}
console.log('PASS Standard, Physical, Lambert, Phong, Toon and unlit Basic shader contracts');
