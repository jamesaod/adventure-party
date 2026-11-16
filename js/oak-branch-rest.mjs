import * as THREE from '../assets/vendor/three/three.module.min.js';
// Once at load: find a shallow rigid orientation from real vertices, not box corners.
// During the fall only quaternion/position interpolation runs; meshes stay on GPU.
export function branchRestPose(geometry,index){
 const p=geometry.attributes.position,start=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,(index-3.5)*.16));
 const normal=new THREE.Vector3(0,1,0).applyQuaternion(start.clone().invert());
 function span(n){let min=Infinity,max=-Infinity;for(let i=0;i<p.count;i++){const h=p.getX(i)*n.x+p.getY(i)*n.y+p.getZ(i)*n.z;min=Math.min(min,h);max=Math.max(max,h);}return {min,max,height:max-min};}
 const before=span(normal);let best=before,bestNormal=normal.clone();
 for(let i=0;i<192;i++){const y=(i+.5)/192,r=Math.sqrt(1-y*y),a=i*2.399963229728653,n=new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r),candidate=span(n);if(candidate.height<best.height){best=candidate;bestNormal=n;}}
 const end=new THREE.Quaternion().setFromUnitVectors(bestNormal,new THREE.Vector3(0,1,0));
 const originalHeading=new THREE.Vector3(0,1,0).applyQuaternion(start),heading=new THREE.Vector3(0,1,0).applyQuaternion(end);
 end.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(originalHeading.x,originalHeading.z)-Math.atan2(heading.x,heading.z)));
 const floors=[];for(let i=0;i<=32;i++){const q=start.clone().slerp(end,i/32),up=new THREE.Vector3(0,1,0).applyQuaternion(q.invert());floors.push(-span(up).min*.18+.15);}
 return {start,end,before:before.height*.18,after:best.height*.18,floorAt(t){const k=Math.min(31,Math.floor(t*32));return t>=1?floors[32]:Math.max(floors[k],floors[k+1]);}};
}
