import {tearTrunkSplit} from './tree-torn-break.mjs';
import {splitTrunk} from './oak-trunk-cut.mjs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
// Isolate the original connected trunk once, retaining its material and vertex data.
export function continuousTrunk(source,{breakType='cut',seed=0}={}){
 const split=(mesh,cut)=>{const pieces=splitTrunk(mesh,cut);return breakType==='torn'?tearTrunkSplit(pieces,cut,seed):pieces;};
 const moving=source.clone(true);moving.name='oak-moving-crown';const movingMeshes=[];moving.traverse(m=>{if(m.isMesh)movingMeshes.push(m);});let meshIndex=0;
 const result=new THREE.Group(),stump=new THREE.Group(),cut=43.38933076913966;result.scale.copy(source.scale);stump.scale.copy(source.scale);
 source.traverse(mesh=>{
  if(!mesh.isMesh)return;const movingMesh=movingMeshes[meshIndex++];if(!mesh.material.name.includes('Bark')){
   // SpeedTree's baked atlas can also contain the old root/base cap. It must
   // not follow the crown out of the ground merely because it is not bark.
   const position=mesh.geometry.attributes.position;let below=false;for(let i=0;i<position.count;i++)if(position.getY(i)<cut){below=true;break;}
   if(below){const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,copy=mesh.clone();copy.geometry=g;const clipped=splitTrunk(copy,cut);movingMesh.geometry=clipped.upper.geometry;movingMesh.visible=movingMesh.visible&&clipped.upper.geometry.attributes.position.count>0;clipped.lower.geometry.dispose();clipped.cap.geometry.dispose();clipped.cap.material.dispose();if(g!==mesh.geometry)g.dispose();}
   return;
  }
  const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,p=g.attributes.position,parents=[],ids=[],lookup=new Map();
  function root(i){return parents[i]===i?i:parents[i]=root(parents[i]);}
  for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(4)).join(',');if(!lookup.has(key)){lookup.set(key,parents.length);parents.push(parents.length);}ids.push(lookup.get(key));}
  for(let i=0;i<p.count;i+=3){parents[root(ids[i+1])]=root(ids[i]);parents[root(ids[i+2])]=root(ids[i]);}
  const groups=new Map();for(let i=0;i<p.count;i++){const r=root(ids[i]);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);}
  const components=[...groups.values()].filter(a=>Math.min(...a.map(i=>p.getY(i)))<10).sort((a,b)=>b.length-a.length);
  if(!components.length)return;const selected=components[0],geometry=new THREE.BufferGeometry();
  for(const [name,attr] of Object.entries(g.attributes)){const data=new Float32Array(selected.length*attr.itemSize);selected.forEach((index,k)=>{for(let j=0;j<attr.itemSize;j++)data[k*attr.itemSize+j]=attr[['getX','getY','getZ','getW'][j]](index);});geometry.setAttribute(name,new THREE.BufferAttribute(data,attr.itemSize));}
  const trunk=mesh.clone();trunk.geometry=geometry;trunk.name='continuous-oak-trunk';const pieces=split(trunk,cut);result.add(pieces.upper,pieces.cap);stump.add(pieces.lower,pieces.cap.clone());
  // The moving crown starts above the same break as the permanent stump.
  // Keep every upper branch/leaf; only the connected trunk survives impact.
  const fullWood=mesh.clone();fullWood.geometry=g;const clipped=split(fullWood,cut);
  movingMesh.geometry=clipped.upper.geometry;movingMesh.add(pieces.cap.clone());
  clipped.lower.geometry.dispose();clipped.cap.geometry.dispose();clipped.cap.material.dispose();
  if(g!==mesh.geometry)g.dispose();
 });
 result.rotation.x=Math.PI/2;result.updateMatrixWorld(true);const lift=0,cutHeight=cut*source.scale.y;stump.updateMatrixWorld(true);const separation=new THREE.Box3().setFromObject(stump).max.z+1;result.position.set(0,cutHeight,-cutHeight+separation);
 return {model:result,moving,lift,stump,cutHeight,separation};
}

