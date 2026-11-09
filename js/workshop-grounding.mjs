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
 return {
  reset(){model.position.copy(base);},
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
