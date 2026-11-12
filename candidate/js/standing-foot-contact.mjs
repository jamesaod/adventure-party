import * as THREE from '../assets/vendor/three/three.module.min.js';
import {semanticBoneMap} from './humanoid-rig.mjs';

// Pose correction, not a model translation: preserve limb lengths and foot
// orientation. Call only for standing/ready poses, then restore before sampling
// another clip. Both visible geometry and shadow capture use the corrected rig.
export function plantStandingFeet(model){
  const bones=semanticBoneMap(model),legs=['left','right'].map(side=>({
    hip:bones.get(side+'UpperLeg'),knee:bones.get(side+'LowerLeg'),
    foot:bones.get(side+'Foot'),toe:bones.get(side+'Toe')}));
  if(legs.some(l=>!l.hip||!l.knee||!l.foot))return ()=>{};
  const saved=[...new Set(legs.flatMap(l=>[l.hip,l.knee,l.foot]))].map(b=>[b,b.quaternion.clone()]);
  const update=()=>{model.updateWorldMatrix(true,true);model.traverse(o=>o.skeleton?.update());};
  update();
  for(const leg of legs){
    leg.samples=[];
    model.traverse(mesh=>{
      if(!mesh.isSkinnedMesh)return;
      const ids=mesh.skeleton.bones.map((b,i)=>b===leg.foot||b===leg.toe?i:-1).filter(i=>i>=0);
      const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
      if(!indices||!weights||!ids.length)return;
      for(let i=0;i<indices.count;i++){
        let weight=0;for(let c=0;c<4;c++)if(ids.includes(indices.getComponent(i,c)))weight+=weights.getComponent(i,c);
        if(weight<.5)continue;
        leg.samples.push([mesh,i]);
      }
    });
  }
  const point=new THREE.Vector3();
  const sole=leg=>{
    let low=Infinity;
    for(const [mesh,i] of leg.samples){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);low=Math.min(low,point.y);}
    return low;
  };
  const lows=legs.map(sole),ground=Math.min(...lows);
  if(!lows.every(Number.isFinite))return ()=>{};
  const rotateToward=(bone,from,to)=>{
    const q=bone.getWorldQuaternion(new THREE.Quaternion());
    q.premultiply(new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize()));
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
    update();
  };
  for(let pass=0;pass<16;pass++)legs.forEach((leg,index)=>{
    const gap=sole(leg)-ground;if(Math.abs(gap)<1e-6)return;
    const a=leg.hip.getWorldPosition(new THREE.Vector3()),b=leg.knee.getWorldPosition(new THREE.Vector3()),c=leg.foot.getWorldPosition(new THREE.Vector3());
    const orientation=leg.foot.getWorldQuaternion(new THREE.Quaternion());
    const target=c.clone();target.y-=gap;
    const upper=a.distanceTo(b),lower=b.distanceTo(c),axis=target.clone().sub(a);
    const distance=Math.min(axis.length(),(upper+lower)*.999999);axis.normalize();
    let bend=b.clone().sub(a);bend.addScaledVector(axis,-bend.dot(axis));
    if(bend.lengthSq()<1e-10)bend.set(0,0,1).addScaledVector(axis,-axis.z);
    bend.normalize();
    const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
    const knee=a.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,upper*upper-along*along)));
    rotateToward(leg.hip,b.clone().sub(a),knee.clone().sub(a));
    const actualKnee=leg.knee.getWorldPosition(new THREE.Vector3());
    rotateToward(leg.knee,leg.foot.getWorldPosition(new THREE.Vector3()).sub(actualKnee),target.clone().sub(actualKnee));
    leg.foot.quaternion.copy(leg.foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));update();
  });
  return ()=>{for(const [bone,q] of saved)bone.quaternion.copy(q);update();};
}


