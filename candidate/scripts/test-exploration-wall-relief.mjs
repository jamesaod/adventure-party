import assert from 'node:assert/strict';
import {readCombatFixture as readFileSync} from './combat-test-source.mjs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {createStoneReliefMaterial,stoneReliefSwitch} from '../js/exploration-wall-relief.mjs';
import {installPaintedAmbient} from '../js/exploration-painted-ambient.mjs';
const texture=new THREE.Texture();texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(2,1);texture.offset.set(.25,.5);texture.anisotropy=4;
const normal=new THREE.Texture(),original=new THREE.MeshLambertMaterial({map:texture}),enhanced=createStoneReliefMaterial(texture,normal),wood=new THREE.MeshLambertMaterial(),floor=new THREE.MeshLambertMaterial();
assert(enhanced.isMeshPhongMaterial);assert.equal(enhanced.map,texture);assert.equal(enhanced.normalMap,normal);assert.equal(normal.colorSpace,THREE.NoColorSpace);assert.deepEqual(normal.repeat.toArray(),texture.repeat.toArray());assert.deepEqual(normal.offset.toArray(),texture.offset.toArray());assert.equal(normal.wrapS,THREE.RepeatWrapping);assert.equal(enhanced.shininess,6);
const scene=new THREE.Scene(),wall=new THREE.Mesh(new THREE.BoxGeometry(),[wood,original,wood,original,wood,original]),ground=new THREE.Mesh(new THREE.PlaneGeometry(),floor),light=new THREE.PointLight();scene.add(wall,ground,light);
const swap=stoneReliefSwitch(scene,original,enhanced),count=scene.children.length;
assert.equal(swap.setEnhanced(true),true);assert.equal(wall.material[1],enhanced);assert.equal(wall.material[0],wood);assert.equal(ground.material,floor);assert.equal(scene.children.length,count);
assert.equal(swap.setEnhanced(false),false);assert.equal(wall.material[1],original);assert.equal(light.castShadow,false,'Toggle never introduces shadow lights');
const map={width:1,height:1,environment:['i'],ambientLight:[[150]]};installPaintedAmbient(THREE,scene,map,3,[enhanced]);
for(const [material,lib] of [[original,THREE.ShaderLib.lambert],[enhanced,THREE.ShaderLib.phong]]){const shader={uniforms:{},vertexShader:lib.vertexShader,fragmentShader:lib.fragmentShader};material.onBeforeCompile(shader,{});assert(shader.uniforms.paintedAmbient);assert(shader.fragmentShader.includes('reflectedLight.indirectDiffuse*='),'Both comparison modes retain painted ambient');}
const bytes=readFileSync(new URL('../assets/textures/exploration/wall-normal.png',import.meta.url));assert.equal(bytes.readUInt32BE(16),512);assert.equal(bytes.readUInt32BE(20),512);assert.equal(bytes[25],2,'Normal data is RGB, no transparency');
const source=readFileSync(new URL('../js/exploration-materials.mjs',import.meta.url),'utf8');assert(source.includes('wallRelief=false'),'Other material consumers do not load the experiment by default');
console.log('PASS stone normal-map data/UVs, matte Phong, live original/enhanced swap, independent wall faces, unchanged scene/light count and painted ambient in both modes');
