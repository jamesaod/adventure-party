import {semanticBoneMap} from './humanoid-rig.mjs';
// Articulated relaxation: preserve bone lengths and authored yaw. Called only
// after a fresh animation sample, then retained in the settled corpse cache.
export function createGiantCorpseSettler(T,model){
 const bones=semanticBoneMap(model),a=new T.Vector3(),b=new T.Vector3(),flat=new T.Vector3(),worldQ=new T.Quaternion(),parentQ=new T.Quaternion(),delta=new T.Quaternion(),identity=new T.Quaternion(),blended=new T.Quaternion();
 const pairs=[['hips','neck'],['leftUpperLeg','leftLowerLeg'],['rightUpperLeg','rightLowerLeg'],['leftLowerLeg','leftFoot'],['rightLowerLeg','rightFoot'],['leftUpperArm','leftForeArm'],['rightUpperArm','rightForeArm'],['leftForeArm','leftHand'],['rightForeArm','rightHand']];
 return (amount,profile=null)=>{if(!(amount>0))return;model.updateWorldMatrix(true,true);
  for(const [from,to] of pairs){
   if(profile==='back'&&from==='leftUpperLeg'){
    const hips=bones.get('hips'),left=bones.get('leftUpperArm'),right=bones.get('rightUpperArm'),neck=bones.get('neck');
    if(hips&&left&&right&&neck){
     const axis=neck.getWorldPosition(new T.Vector3()).sub(hips.getWorldPosition(new T.Vector3())).normalize();
     const side=right.getWorldPosition(new T.Vector3()).sub(left.getWorldPosition(new T.Vector3()));side.addScaledVector(axis,-side.dot(axis)).normalize();
     const level=new T.Vector3().crossVectors(new T.Vector3(0,1,0),axis).normalize();if(level.dot(side)<0)level.negate();
     const cross=new T.Vector3().crossVectors(side,level),angle=Math.atan2(axis.dot(cross),side.dot(level));
     delta.setFromAxisAngle(axis,angle*Math.min(1,amount));hips.getWorldQuaternion(worldQ);hips.parent.getWorldQuaternion(parentQ);hips.quaternion.copy(parentQ.invert().multiply(delta.multiply(worldQ)));hips.updateWorldMatrix(false,true);
    }
   }
   const bone=bones.get(from),end=bones.get(to);if(!bone||!end||!bone.parent)continue;
   bone.getWorldPosition(a);end.getWorldPosition(b);b.sub(a);if(b.lengthSq()<1e-10)continue;flat.copy(b);flat.y=0;if(flat.lengthSq()<1e-10)continue;
   const backLeg=profile==='back'&&/Leg$/.test(from);if(backLeg&&/UpperLeg$/.test(from))flat.y=-flat.length()*.25;
   b.normalize();flat.normalize();delta.setFromUnitVectors(b,flat);const angle=2*Math.acos(Math.min(1,Math.abs(delta.w))),weight=Math.min(1,(backLeg?Math.PI/2:Math.PI/3)/Math.max(angle,1e-8))*Math.min(1,amount);
   blended.slerpQuaternions(identity,delta,weight);bone.getWorldQuaternion(worldQ);bone.parent.getWorldQuaternion(parentQ);bone.quaternion.copy(parentQ.invert().multiply(blended.multiply(worldQ)));bone.updateWorldMatrix(false,true);
  }
 };
}
export function giantSettleProgress(entity,now){
 if(!entity?.corpseDropInPlace||entity.alive||!Number.isFinite(entity.deathPresentationStartedAt))return 0;
 const duration=Math.max(1,entity.deathAnimationDurationMs||1000),t=Math.max(0,Math.min(1,((now-entity.deathPresentationStartedAt)/duration-.65)/.35));return t*t*(3-2*t);
}
