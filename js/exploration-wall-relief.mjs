import * as THREE from '../assets/vendor/three/three.module.min.js';
export function createStoneReliefMaterial(colorMap,normalMap){
 normalMap.colorSpace=THREE.NoColorSpace;
 normalMap.wrapS=colorMap.wrapS;normalMap.wrapT=colorMap.wrapT;
 normalMap.repeat.copy(colorMap.repeat);normalMap.offset.copy(colorMap.offset);
 normalMap.center.copy(colorMap.center);normalMap.rotation=colorMap.rotation;
 normalMap.anisotropy=colorMap.anisotropy;
 return new THREE.MeshPhongMaterial({map:colorMap,normalMap,normalScale:new THREE.Vector2(.65,.65),specular:0x111111,shininess:6});
}
// Swap only references to this stone-wall pair. Array face assignments retain
// independent timber faces; floors, ceilings, door leaves and lights stay put.
export function stoneReliefSwitch(scene,original,enhanced){
 let active=false;
 return {get enhanced(){return active;},setEnhanced(value){
  active=!!value&&!!enhanced;const next=active?enhanced:original;
  scene.traverse(object=>{
   const replace=material=>material===original||material===enhanced?next:material;
   if(Array.isArray(object.material))object.material=object.material.map(replace);
   else if(object.material)object.material=replace(object.material);
  });return active;
 }};
}
