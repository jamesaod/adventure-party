import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {captureDirectUnit,setDirectUnit,directUnitFrame} from '../js/combat-direct-units.mjs';

const root=new THREE.Group(),placement=new THREE.Group();root.add(placement);placement.position.set(2,3,4);
const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial({color:0x884422}));placement.add(mesh);
mesh.material.metalness=1;
mesh.material.metalnessMap=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);
const camera=new THREE.OrthographicCamera(-5,5,5,-5,.1,100);camera.position.set(0,6,10);camera.lookAt(0,2,0);camera.updateMatrixWorld();
root.rotation.y=1.2;root.updateMatrixWorld(true);
const captured=captureDirectUnit(root,camera),box=new THREE.Box3().setFromObject(captured.group);
assert(Math.abs(box.min.x-1.5)<1e-5);assert(Math.abs(box.min.y-2)<1e-5);assert(Math.abs(box.max.z-4.5)<1e-5);
assert.equal(captured.triangles,12);assert.notEqual(captured.group.children[0].geometry,mesh.geometry);
assert.notEqual(captured.group.children[0].material,mesh.material);
assert(captured.group.children[0].material.metalnessMap,'Preserve the map that makes skin and cloth nonmetallic');
assert.notEqual(captured.group.children[0].material.metalnessMap,mesh.material.metalnessMap);
const a={},b={};setDirectUnit(a,captured,0);setDirectUnit(b,captured,Math.PI);
assert.equal(directUnitFrame(a).asset,directUnitFrame(b).asset);assert.equal(directUnitFrame(b).yaw,Math.PI);
assert.equal(directUnitFrame({}),undefined);
// Skin deformation must be evaluated before removing skin attributes.
const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Array(12).fill(0),4));
g.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
const skin=new THREE.SkinnedMesh(g,new THREE.MeshStandardMaterial()),bone=new THREE.Bone();skin.add(bone);skin.bind(new THREE.Skeleton([bone]));bone.position.y=2;
const rig=new THREE.Group();rig.add(skin);const pose=captureDirectUnit(rig,camera);
assert.equal(pose.group.children[0].geometry.attributes.position.getY(0),2);
assert.equal(pose.group.children[0].geometry.attributes.skinWeight,undefined);
assert.equal(skin.geometry.attributes.position.getY(0),0,'Source model must remain untouched');
console.log('PASS direct-model pose deformation, placement, shared facings, original assets and sprite fallback');
