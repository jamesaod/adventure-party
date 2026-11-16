import * as THREE from '../assets/vendor/three/three.module.min.js';
import {SimplifyModifier} from '../assets/vendor/three/addons/modifiers/SimplifyModifier.js';
import {mergeVertices} from '../assets/vendor/three/addons/utils/BufferGeometryUtils.js';

// Capture the SAME evaluated meshes that produce the sprite. Store normalized
// frame coordinates for ground position and vertical displacement, never a
// replacement humanoid or a separately chosen animation frame.
const captures=new WeakMap();
export function setModelShadow(image,geometry){captures.set(image,geometry);}
export function getModelShadow(image){return captures.get(image);}
export function prepareModelShadow(root,{targetTriangles=500}={}){
 const start=performance.now();root.updateWorldMatrix(true,true);
 const inverse=root.matrixWorld.clone().invert(),parts=[];let originalTriangles=0;
 root.traverseVisible(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(materials.every(m=>m?.visible===false))return;
  if(mesh.isSkinnedMesh)mesh.skeleton.update();
  const vertices=[],indices=[],p=new THREE.Vector3(),count=mesh.geometry.attributes.position.count;
  for(let i=0;i<count;i++){mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);vertices.push(p.x,p.y,p.z);}
  const idx=mesh.geometry.index,groups=mesh.geometry.groups.length?mesh.geometry.groups:[{start:0,count:idx?.count||count,materialIndex:0}],range=mesh.geometry.drawRange;
  for(const group of groups){if(materials[group.materialIndex||0]?.visible===false)continue;
   const end=Math.min(group.start+group.count,range.start+range.count,idx?.count||count);
   for(let i=Math.max(group.start,range.start);i+2<end;i+=3)indices.push(idx?idx.getX(i):i,idx?idx.getX(i+1):i+1,idx?idx.getX(i+2):i+2);
  }
  if(!indices.length)return;
  const input=new THREE.BufferGeometry();input.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));input.setIndex(indices);
  const geometry=mergeVertices(input);input.dispose();originalTriangles+=indices.length/3;parts.push(geometry);
 });
 // Reserve a small budget for each attachment so a sword/shield cannot vanish
 // simply because the body has many more triangles. Never simplify per frame.
 const reserve=parts.reduce((sum,g)=>sum+Math.min(12,g.index.count/3),0),remaining=Math.max(0,targetTriangles-reserve);
 const positions=[],indices=[],modifier=new SimplifyModifier();
 for(const geometry of parts){
  const triangles=geometry.index.count/3,budget=Math.min(triangles,Math.max(4,Math.floor(Math.min(12,triangles)+remaining*triangles/Math.max(1,originalTriangles))));
  const keepVertices=Math.max(4,Math.floor(budget/2)+2),remove=Math.max(0,geometry.attributes.position.count-keepVertices);
  const reduced=remove?modifier.modify(geometry,remove):geometry;
  const offset=positions.length/3,attribute=reduced.attributes.position,index=reduced.index;
  for(let i=0;i<attribute.count;i++)positions.push(attribute.getX(i),attribute.getY(i),attribute.getZ(i));
  for(let i=0;i<(index?.count||attribute.count);i++)indices.push(offset+(index?index.getX(i):i));
  if(reduced!==geometry)reduced.dispose();geometry.dispose();
 }
 return {positions:new Float32Array(positions),indices:new Uint32Array(indices),stats:{originalTriangles,triangles:indices.length/3,targetTriangles,preparationMs:performance.now()-start}};
}
export function captureModelShadow(root,camera,prepared=null){
 root.updateWorldMatrix(true,true);camera.updateMatrixWorld(true);
 const positions=[],indices=[],vertex=new THREE.Vector3(),ground=new THREE.Vector3();
 if(prepared){
  for(let i=0;i<prepared.positions.length;i+=3){vertex.fromArray(prepared.positions,i).applyMatrix4(root.matrixWorld);ground.set(vertex.x,0,vertex.z).project(camera);vertex.project(camera);positions.push((ground.x+1)/2,(1-ground.y)/2,(vertex.y-ground.y)/2);}
  return {positions:new Float32Array(positions),indices:prepared.indices,stats:prepared.stats};
 }
 root.traverseVisible(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(materials.every(m=>m?.visible===false))return;
  if(mesh.isSkinnedMesh)mesh.skeleton.update();
  const offset=positions.length/3,count=mesh.geometry.attributes.position.count;
  for(let i=0;i<count;i++){
   mesh.getVertexPosition(i,vertex);vertex.applyMatrix4(mesh.matrixWorld);
   ground.set(vertex.x,0,vertex.z).project(camera);vertex.project(camera);
   positions.push((ground.x+1)/2,(1-ground.y)/2,(vertex.y-ground.y)/2);
  }
  const index=mesh.geometry.index;
  const groups=mesh.geometry.groups.length?mesh.geometry.groups:[{start:0,count:index?.count||count,materialIndex:0}];
  const range=mesh.geometry.drawRange;
  for(const group of groups){
   if(materials[group.materialIndex||0]?.visible===false)continue;
   const start=Math.max(group.start,range.start),end=Math.min(group.start+group.count,range.start+range.count,index?.count||count);
   for(let i=start;i+2<end;i+=3)indices.push(offset+(index?index.getX(i):i),offset+(index?index.getX(i+1):i+1),offset+(index?index.getX(i+2):i+2));
  }
 });
 return {positions:new Float32Array(positions),indices:new Uint32Array(indices)};
}
