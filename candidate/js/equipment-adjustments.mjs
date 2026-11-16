// Edit fixed world-axis offsets, then store the existing hand-local mount.
// Equipment still follows its animated bone; historical saved grips are unchanged.
export function worldGripPosition(THREE,hand,position){
  if(!hand)return [...position];
  hand.updateWorldMatrix(true,false);
  return new THREE.Vector3(...position).applyMatrix4(hand.matrixWorld)
    .sub(hand.getWorldPosition(new THREE.Vector3())).toArray();
}
export function setWorldGripAxis(THREE,hand,position,axis,value){
  if(!Number.isFinite(value))throw Error('Grip position must be finite.');
  if(!hand){const next=[...position];next[axis]=value;return next;}
  const offset=worldGripPosition(THREE,hand,position);offset[axis]=value;
  return hand.worldToLocal(new THREE.Vector3(...offset).add(hand.getWorldPosition(new THREE.Vector3()))).toArray();
}
export function applyEquipmentMaterialOverrides(model,overrides){
  if(!overrides)return;
  model.traverse(object=>{
    if(!object.isMesh)return;
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      if(!material)continue;
      for(const key of ['metalness','roughness','transmission'])if(Number.isFinite(overrides[key])&&key in material)material[key]=overrides[key];
      if(Number.isFinite(overrides.colorGain)&&material.color){
        material.userData=material.userData||{};
        material.userData.equipmentBaseColor??=material.color.clone();
        material.color.copy(material.userData.equipmentBaseColor).multiplyScalar(overrides.colorGain);
      }
      material.needsUpdate=true;
    }
  });
}
