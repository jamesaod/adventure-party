import {semanticBoneMap} from './humanoid-rig.mjs';

// Root travel belongs to combat movement. Preserve authored limb translations.
export function removeWorkshopRootTravel(clip, model) {
 const roots=new Set([model.uuid]);
 model.traverse(node=>{if(node.isBone&&!node.parent?.isBone)roots.add(node.uuid);});
 for(const track of clip.tracks){
  if(!track.name.endsWith('.position')||!roots.has(track.name.slice(0,-9)))continue;
  for(let i=0;i<track.values.length;i+=3){track.values[i]=track.values[0];track.values[i+2]=track.values[2];}
 }
 return clip;
}

export function createWorkshopGrounding(THREE,model,group){
 const bones=semanticBoneMap(model);
 const contacts=['leftFoot','rightFoot','leftToe','rightToe'].map(key=>bones.get(key)).filter(Boolean);
 const base=model.position.clone(),point=new THREE.Vector3();
 group.updateMatrixWorld(true);
 const lowest=()=>Math.min(...contacts.map(bone=>bone.getWorldPosition(point).y));
 const ground=contacts.length>=2?lowest():null;
 // Measure the animated body, not attached weapons, for lying poses.
 const body=[];model.traverse(node=>{if(node.isSkinnedMesh)body.push(node);});
 const bounds=new THREE.Box3();
 function bodyFloor(){
  group.updateMatrixWorld(true);let min=Infinity;
  for(const mesh of body){mesh.skeleton.update();mesh.computeBoundingBox();bounds.copy(mesh.boundingBox).applyMatrix4(mesh.matrixWorld);min=Math.min(min,bounds.min.y);}
  return min;
 }
 const restFloor=bodyFloor();
 const restContact=Number.isFinite(restFloor)?group.worldToLocal(new THREE.Vector3(0,restFloor,0)):null;
 function shift(delta){
  if(!Number.isFinite(delta))return;
  const parent=model.parent,origin=parent.worldToLocal(new THREE.Vector3());
  model.position.add(parent.worldToLocal(new THREE.Vector3(0,delta,0)).sub(origin));
  group.updateMatrixWorld(true);
 }
 return {
  reset(){model.position.copy(base);},
  applyCorpse(){if(restContact){group.updateMatrixWorld(true);shift(group.localToWorld(restContact.clone()).y-bodyFloor());}},
  apply(){
   if(ground===null)return;
   group.updateMatrixWorld(true);
   const delta=ground-lowest(),parent=model.parent;
   const origin=parent.worldToLocal(new THREE.Vector3());
   const offset=parent.worldToLocal(new THREE.Vector3(0,delta,0)).sub(origin);
   model.position.add(offset);group.updateMatrixWorld(true);
  }
 };
}
