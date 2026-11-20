import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/three.module.min.js';
import {debrisPatchGeometry,DEBRIS_FLATTEN} from '../js/settled-branch-patch.mjs';
const box=new T.Box3(new T.Vector3(-10,-3,-5),new T.Vector3(10,7,5)),data=new Uint8Array(4*4*4).fill(255);
const g=debrisPatchGeometry(box,data,4);g.computeBoundingBox();assert.equal(g.index.count/3,128);assert(Math.abs(g.boundingBox.max.y-10*DEBRIS_FLATTEN)<1e-6);assert.equal(g.boundingBox.min.x,-10);assert.equal(g.boundingBox.max.z,5);g.dispose();
console.log('PASS bounded 128-triangle debris patch, footprint and shallow displacement');

// Raw-pixel debris maps must never enter the foliage drawImage path.
const {createFirSnowCaps}=await import('../js/combat-fir-snow.mjs');
const patch=new T.Mesh(new T.PlaneGeometry(),new T.MeshStandardMaterial({map:new T.DataTexture(new Uint8Array(16),2,2),alphaTest:.15}));patch.userData.debrisPatch=true;
const root=new T.Group();root.add(patch);const caps=createFirSnowCaps(root);caps.dispose();patch.geometry.dispose();patch.material.map.dispose();patch.material.dispose();
console.log('PASS debris data textures excluded from foliage snow canvas processing');
