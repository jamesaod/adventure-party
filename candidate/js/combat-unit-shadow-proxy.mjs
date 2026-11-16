import * as THREE from '../assets/vendor/three/three.module.min.js';

// Invisible, low-polygon humanoid volume used only by the projected-shadow pass.
// Normalized to a 1.8 m adult. Visible sprite assets and gameplay footprints are untouched.
const cache=new Map();
export function humanoidShadowProxy({pose='stand',shield=false,weapon='sword',ranged=false,feet=null}={}){
 const stance=['attack','windup','prone','falling','cast','casting-windup'].includes(pose)?pose:'stand';
 const id=[stance,shield,weapon,ranged,feet?.map(p=>p.map(v=>v.toFixed(3)).join(',')).join(';')||'default'].join(':');if(cache.has(id))return cache.get(id);
 const points=[],indices=[],uv=[];
 function append(geometry,matrix){const pos=geometry.attributes.position,offset=points.length;
  for(let i=0;i<pos.count;i++){const p=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(matrix);points.push([p.x,p.y,p.z]);uv.push([.5,.5]);}
  for(const i of geometry.index?.array||Array.from({length:pos.count},(_,i)=>i))indices.push(offset+i);
  geometry.dispose();
 }
 function ellipsoid(center,size){const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...center),new THREE.Quaternion(),new THREE.Vector3(...size));append(new THREE.SphereGeometry(1,6,4),matrix);}
 function limb(a,b,r1,r2=r1){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start),rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());
  append(new THREE.CylinderGeometry(r2,r1,delta.length(),6,1),new THREE.Matrix4().compose(start.add(end).multiplyScalar(.5),rotation,new THREE.Vector3(1,1,1)));
 }
 const attacking=stance==='attack',winding=stance==='windup',casting=stance==='cast'||stance==='casting-windup';
 ellipsoid([0,1.14,0],[.25,.36,.16]);ellipsoid([0,.84,0],[.23,.18,.16]);ellipsoid([0,1.62,.015],[.16,.18,.15]);
 const leftHip=[-.13,.82,0],rightHip=[.13,.82,0];
 const fitted=feet?.length===2&&!['prone','falling'].includes(stance);
 const leftFoot=fitted?[feet[0][0],.08,feet[0][1]-.06]:[-.2,.08,attacking?.29:.12];
 const rightFoot=fitted?[feet[1][0],.08,feet[1][1]-.06]:[.2,.08,attacking?-.22:-.08];
 const leftKnee=fitted?[(leftHip[0]+leftFoot[0])*.5,.46,leftFoot[2]*.5]:[-.18,.46,attacking?.18:.04];
 const rightKnee=fitted?[(rightHip[0]+rightFoot[0])*.5,.46,rightFoot[2]*.5]:[.19,.46,attacking?-.16:-.03];
 for(const [hip,knee,foot] of [[leftHip,leftKnee,leftFoot],[rightHip,rightKnee,rightFoot]]){limb(hip,knee,.105,.085);limb(knee,foot,.085,.065);ellipsoid([foot[0],.065,foot[2]+.06],[.09,.065,.16]);}
 let leftElbow=[-.36,1.12,.09],rightElbow=[.35,1.15,.08],leftHand=[-.35,1.02,.25],rightHand=[.4,1.06,.23];
 if(ranged){leftElbow=[-.3,1.24,.28];leftHand=[-.2,1.29,.65];rightElbow=[.35,1.34,.05];rightHand=[.13,1.34,attacking?.48:.2];}
 else if(attacking){rightElbow=[.31,1.23,.36];rightHand=[.35,1.14,.7];}
 else if(winding){rightElbow=[.39,1.35,-.12];rightHand=[.4,1.57,-.12];}
 if(casting){leftElbow=[-.33,1.4,.17];rightElbow=[.33,1.4,.17];leftHand=[-.34,1.57,.42];rightHand=[.34,1.57,.42];}
 for(const [shoulder,elbow,hand] of [[[-.23,1.4,0],leftElbow,leftHand],[[.23,1.4,0],rightElbow,rightHand]]){limb(shoulder,elbow,.085,.07);limb(elbow,hand,.07,.055);ellipsoid(hand,[.065,.075,.065]);}
 if(shield&&!ranged)ellipsoid([leftHand[0],leftHand[1]+.08,leftHand[2]+.05],[.27,.32,.045]);
 if(ranged&&weapon!=='sling'){
  const grip=leftHand,half=weapon==='crossbow'?.3:.48;
  if(weapon==='crossbow'){limb([grip[0]-.32,grip[1],grip[2]],[grip[0]+.32,grip[1],grip[2]],.025);limb([grip[0],grip[1],grip[2]-.26],[grip[0],grip[1],grip[2]+.25],.035);}
  else for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI/5,b=-Math.PI/2+(i+1)*Math.PI/5;limb([grip[0],grip[1]+Math.sin(a)*half,grip[2]+Math.cos(a)*.18],[grip[0],grip[1]+Math.sin(b)*half,grip[2]+Math.cos(b)*.18],.018);}
 }else if(!casting&&!['unarmed','sling'].includes(weapon)){
  const length=weapon==='spear'?1.2:.65,tip=attacking?[rightHand[0],rightHand[1]-.1,rightHand[2]+length]:[rightHand[0],rightHand[1]+length,rightHand[2]+.05];
  limb(rightHand,tip,weapon==='sword'?.022:.035);
  if(weapon==='axe')ellipsoid(tip,[.2,.12,.04]);else if(weapon==='mace')ellipsoid(tip,[.1,.12,.1]);
 }
 if(stance==='prone'||stance==='falling'){
  for(const p of points){const y=p[1];p[1]=p[2]+.34;p[2]=.8-y;}
  const bottom=Math.min(...points.map(p=>p[1]));for(const p of points)p[1]-=bottom;
 }
 const result={points,indices,uv,triangles:indices.length/3,feet:[[leftFoot[0],0,leftFoot[2]+.06],[rightFoot[0],0,rightFoot[2]+.06]]};if(cache.size>=128)cache.delete(cache.keys().next().value);cache.set(id,result);return result;
}
export function placeHumanoidShadow(proxy,{origin=[0,0,0],height=1.8,yaw=0}={}){
 const scale=height/1.8,c=Math.cos(yaw),s=Math.sin(yaw);
 return {points:proxy.points.map(([x,y,z])=>[origin[0]+(x*c+z*s)*scale,origin[1]+y*scale,origin[2]+(-x*s+z*c)*scale]),indices:proxy.indices,uv:proxy.uv,feet:proxy.feet.map(([x,y,z])=>[origin[0]+(x*c+z*s)*scale,origin[1]+y*scale,origin[2]+(-x*s+z*c)*scale])};
}
