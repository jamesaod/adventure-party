import * as THREE from '../assets/vendor/three/three.module.min.js';

// Project eight cached model-box corners, never the tree's individual vertices.
// Coordinates are camera-plane units relative to the tree's ground anchor.
export function treeScreenBounds(box,view,yaw,burning=false){
 const rotation=new THREE.Matrix4().makeRotationY(yaw),p=new THREE.Vector3();
 let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity;
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
  p.set(x,y,z).applyMatrix4(rotation).applyMatrix4(view);
  left=Math.min(left,p.x);right=Math.max(right,p.x);bottom=Math.min(bottom,p.y);top=Math.max(top,p.y);
 }
 // Shader particles can rise 120 units, drift 12/9, and extend 21 units
 // beyond their anchor. A conservative envelope prevents clipping embers.
 const pad=burning?160:8;
 return {x:left-pad,y:-top-pad,width:right-left+2*pad,height:top-bottom+2*pad};
}
