import * as THREE from '../assets/vendor/three/three.module.min.js';

// Store the blade's longitudinal coordinate on its real vertices. The attribute
// survives posed geometry captures and follows the rig and view transforms.
export const BLADE_ATTRIBUTE='flameBlade';
export function markFlamingBlade(root,span){
 if(!span)return 0;
 root.updateWorldMatrix(true,true);
 const inverse=root.matrixWorld.clone().invert(),base=new THREE.Vector3().fromArray(span.base),axis=new THREE.Vector3().fromArray(span.tip).sub(base),length2=axis.lengthSq(),p=new THREE.Vector3();
 if(length2<1e-10)return 0;let count=0;
 root.traverse(mesh=>{if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;
  const transform=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),position=mesh.geometry.attributes.position,values=new Float32Array(position.count);
  for(let i=0;i<position.count;i++){p.fromBufferAttribute(position,i).applyMatrix4(transform);values[i]=p.sub(base).dot(axis)/length2;}
  mesh.geometry.setAttribute(BLADE_ATTRIBUTE,new THREE.BufferAttribute(values,1));count++;
 });return count;
}

// Posed meshes preserve their source UV/index ordering. Match those immutable
// streams when opening older prepared assets, without guessing screen anchors
// or rebaking the character. Confirm full streams after the inexpensive key.
function streams(geometry){return [geometry.attributes.uv?.array,geometry.index?.array];}
function signature(geometry){
 let hash=2166136261;for(const stream of streams(geometry))if(stream){const bytes=new Uint8Array(stream.buffer,stream.byteOffset,stream.byteLength);for(const byte of bytes)hash=Math.imul(hash^byte,16777619);}
 return geometry.attributes.position.count+':'+(hash>>>0);
}
function sameTopology(a,b){return a.attributes.position.count===b.attributes.position.count&&streams(a).every((stream,k)=>{const other=streams(b)[k];return (!stream&&!other)||!!stream&&!!other&&stream.length===other.length&&stream.every((v,i)=>v===other[i]);});}
export function preparedBladeTemplates(root){
 const templates=[];root.traverse(mesh=>{const g=mesh.geometry;if(mesh.isMesh&&g?.getAttribute(BLADE_ATTRIBUTE))templates.push({key:signature(g),geometry:g,attribute:g.getAttribute(BLADE_ATTRIBUTE)});});return templates;
}
export function restorePreparedBlade(root,templates){
 let count=0;root.traverse(mesh=>{if(!mesh.isMesh)return;const g=mesh.geometry;if(g.getAttribute(BLADE_ATTRIBUTE)){count++;return;}const key=signature(g),source=templates.find(t=>t.key===key&&sameTopology(g,t.geometry));if(source){g.setAttribute(BLADE_ATTRIBUTE,source.attribute.clone());count++;}});return count;
}
export function hasFlamingSword(entity){
 return !!entity?.alive&&(entity.inventory||[]).some(item=>item.equipped&&item.startingLocation!=='off-hand'&&(item.catalogItemId||item.appearanceId)==='flaming-sword-5'&&item.lightEnabled!==false&&item.lit!==false&&Number(item.qty??1)>0);
}

// Black, opaque writes have zero alpha but still occlude the blade in depth.
// A single pass produces the visible blade silhouette, including body/shield
// occlusion, from exactly the pose and crop camera used for the model draw.
export function createWeaponFlameMask(){
 const scene=new THREE.Scene(),cache=new WeakMap(),materials=new Set();
 function maskMaterial(source,blade){
  let variants=cache.get(source);if(!variants)cache.set(source,variants=[]);const index=blade?1:0;if(variants[index])return variants[index];
  const m=new THREE.MeshBasicMaterial({map:source.map,alphaMap:source.alphaMap,alphaTest:source.alphaTest||0,side:source.side,depthTest:true,depthWrite:true,transparent:false,blending:THREE.NoBlending,toneMapped:false});
  m.visible=source.visible;
  m.onBeforeCompile=shader=>{
   if(blade){shader.vertexShader='attribute float flameBlade;varying float vFlameBlade;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFlameBlade=flameBlade;');shader.fragmentShader='varying float vFlameBlade;\n'+shader.fragmentShader;}
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',blade?'float blade=step(0.,vFlameBlade)*step(vFlameBlade,1.04);gl_FragColor=vec4(vec3(blade),blade);':'gl_FragColor=vec4(0.);');
  };
  m.customProgramCacheKey=()=>blade?'weapon-flame-blade-1':'weapon-flame-occluder-1';variants[index]=m;materials.add(m);return m;
 }
 return {
  draw(renderer,root,camera){
   const changed=[];let blades=0;const parent=root.parent;
   root.traverseVisible(mesh=>{if(!mesh.isMesh)return;const blade=!!mesh.geometry?.getAttribute(BLADE_ATTRIBUTE);blades+=blade?1:0;const original=mesh.material;changed.push([mesh,original]);mesh.material=Array.isArray(original)?original.map(m=>maskMaterial(m,blade)):maskMaterial(original,blade);});
   try{if(!blades)return false;scene.add(root);renderer.render(scene,camera);return true;}
   finally{scene.remove(root);if(parent)parent.add(root);for(const [mesh,original] of changed)mesh.material=original;}
  },
  dispose(){for(const m of materials)m.dispose();materials.clear();}
 };
}
