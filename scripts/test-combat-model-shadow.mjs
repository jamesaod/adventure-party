import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {captureModelShadow,setModelShadow,getModelShadow,prepareModelShadow} from '../js/combat-model-shadow.mjs';
const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(.6,1.8,.3),new THREE.MeshBasicMaterial());
mesh.position.y=.9;root.add(mesh);
const camera=new THREE.OrthographicCamera(-2,2,2,-2,.01,30);camera.position.set(3,3,5);camera.lookAt(0,1,0);camera.updateProjectionMatrix();
const capture=captureModelShadow(root,camera);
assert.equal(capture.positions.length,mesh.geometry.attributes.position.count*3);
assert.equal(capture.indices.length,mesh.geometry.index.count);
for(let i=0;i<mesh.geometry.attributes.position.count;i++){
 const p=mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).project(camera);
 const u=capture.positions[i*3],v=capture.positions[i*3+1],rise=capture.positions[i*3+2];
 assert.ok(Math.abs(u-(p.x+1)/2)<1e-6);
 assert.ok(Math.abs(v-rise-(1-p.y)/2)<1e-6,'Ground plus elevation reconstructs the exact sprite vertex');
}
root.rotation.y=.8;const turned=captureModelShadow(root,camera);assert.notDeepEqual(turned.positions,capture.positions);
mesh.visible=false;assert.equal(captureModelShadow(root,camera).positions.length,0);mesh.visible=true;
// Skinning is evaluated, rather than reading the undeformed bind-pose array.
const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(Array(12).fill(0),4));
geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
const skin=new THREE.SkinnedMesh(geo,new THREE.MeshBasicMaterial()),bone=new THREE.Bone();skin.add(bone);skin.bind(new THREE.Skeleton([bone]));
const before=captureModelShadow(skin,camera);bone.position.x=.4;const after=captureModelShadow(skin,camera);assert.notDeepEqual(after.positions,before.positions);
const image={};setModelShadow(image,capture);assert.equal(getModelShadow(image),capture);
// Simplify actual evaluated geometry once, then reuse it across facing captures.
const denseRoot=new THREE.Group(),dense=new THREE.Mesh(new THREE.SphereGeometry(1,48,32),new THREE.MeshBasicMaterial());dense.position.y=1;denseRoot.add(dense);
const blade=new THREE.Mesh(new THREE.BoxGeometry(.04,.7,.03),new THREE.MeshBasicMaterial());blade.position.set(1.3,1,0);denseRoot.add(blade);
const prepared=prepareModelShadow(denseRoot,{targetTriangles:500});
assert.ok(prepared.stats.originalTriangles>2500);assert.ok(prepared.stats.triangles<=550&&prepared.stats.triangles>100);
assert.ok(prepared.stats.preparationMs>=0);
assert.ok(Math.max(...Array.from(prepared.positions).filter((_,i)=>i%3===0))>1.3,'Thin weapon is retained as its own mesh');
const reducedCapture=captureModelShadow(denseRoot,camera,prepared);assert.equal(reducedCapture.indices,prepared.indices,'Facing captures reuse simplified topology');
denseRoot.rotation.y=.7;assert.notDeepEqual(captureModelShadow(denseRoot,camera,prepared).positions,reducedCapture.positions);
const skinPrepared=prepareModelShadow(skin,{targetTriangles:500});assert.equal(skinPrepared.stats.triangles,1,'Small posed meshes are retained');
console.log('PASS actual model mesh, exact captured projection, facing, visibility, evaluated skinning and image association');
console.log('PASS approximately 500 triangles, protected attachment, once-per-pose topology reuse and preparation timing');
