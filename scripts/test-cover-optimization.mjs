import assert from 'node:assert/strict';
import {createCoverDepthSorter} from '../js/cover-depth-sort.mjs';
import {indexCoverGeometry} from '../js/cover-geometry.mjs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {createGroundCover} from '../js/combat-ground-cover.mjs?v=tree-snow-grains1';
const sort=createCoverDepthSorter();
for(const n of [0,30,512,10000,1024,60000]){
 const items=Array.from({length:n},(_,i)=>({sortY:i%13===0?(i%2?0:-0):i%7===0?100+1e-10*(i%5):Math.sin(i)*1000,x:Math.cos(i%67)}));
 const expected=items.slice().sort((a,b)=>a.sortY-b.sortY||a.x-b.x);sort(items);for(let i=0;i<n;i++)assert.equal(items[i],expected[i]);sort(items);assert.deepEqual(items,expected);
}
const original=new THREE.BufferGeometry();original.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,0,0,0,0,1,0,1,1,0],3));original.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,0,1,1,1],2));
const indexed=indexCoverGeometry(original.clone(),THREE);assert.equal(indexed.index.count,6);assert.equal(indexed.attributes.position.count,4);const expanded=indexed.toNonIndexed();for(const name of Object.keys(original.attributes))assert.deepEqual(expanded.attributes[name].array,original.attributes[name].array);
// Different UVs at the same position must remain separate vertices.
const seam=original.clone();seam.attributes.uv.array[6]=.5;indexCoverGeometry(seam,THREE);assert.equal(seam.attributes.position.count,5);
globalThis.matchMedia=()=>({matches:true});THREE.TextureLoader.prototype.load=()=>new THREE.Texture();let canopy;
const cover=createGroundCover({snow:{texture:null,footprintTexture:null,bounds:new THREE.Vector4()},texture:t=>t,flush(){},markBackdrop(){},paint(mesh){if(mesh.material.uniforms.canopyBlade.value)canopy=mesh.geometry;}});
cover.begin({width:1000,height:1000,anchor:{x:0,y:0},zoom:1,matrix:[1,0,0,1,0,0]});cover.collect([{grass:true,snowEligible:1,grassUnit:10,grassSquash:1,points:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}]}],{});cover.prepare();cover.drawUntil();assert(canopy?.index);assert.equal(canopy.index.count,60);assert(canopy.attributes.position.count<60);console.log('Canopy unique vertices:',canopy.attributes.position.count,'from',canopy.index.count);cover.dispose();console.log('PASS exact stable depth ordering, growth/reuse, signed zero, precision collisions, indexed triangles and UV seams');
