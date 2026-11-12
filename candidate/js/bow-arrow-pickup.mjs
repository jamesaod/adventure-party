import {findHumanoidBone} from './humanoid-rig.mjs';
import {ARROW_VISUAL} from './arrow-visual-profile.mjs?v=R238C305';
import {normalizeQuiverArrows,quiverArrowOffset} from './quiver-arrow-settings.mjs?v=R238C312';

// A rig attachment, sampled by the existing pose renderer. No independent clock.
export function createBowArrowPickup(THREE,rig,nockBone,arrow){
 const torso=findHumanoidBone(rig,'upperChest')||findHumanoidBone(rig,'chest');
 const neck=findHumanoidBone(rig,'neck'),shoulder=findHumanoidBone(rig,'rightShoulder');
 if(!torso||!neck||!nockBone)return null;
 let quiver=null,quiverBody=null,bundle=null,ownsQuiver=true,settings=normalizeQuiverArrows();
 const up=new THREE.Vector3(0,1,0),point=new THREE.Vector3(),axis=new THREE.Vector3(),forward=new THREE.Vector3();
 const scale=new THREE.Vector3(),handRotation=new THREE.Quaternion(),heldAxis=new THREE.Vector3();
 const pickupFrame=new THREE.Quaternion(),pickupHandInverse=new THREE.Quaternion();
 const stored=new THREE.Vector3(),held=new THREE.Vector3(),towardBow=new THREE.Vector3();
 const spares=[];
 function clear(){bundle?.removeFromParent();if(ownsQuiver)quiver?.removeFromParent();spares.length=0;quiver=null;quiverBody=null;bundle=null;}
 function setBundleSettings(value){
  settings=normalizeQuiverArrows(value);
  if(!bundle)return;
  bundle.position.fromArray(settings.position);bundle.rotation.set(...settings.rotation.map(THREE.MathUtils.degToRad),'XYZ');
  while(spares.length>settings.count)spares.pop().removeFromParent();
  while(spares.length<settings.count){
   const spare=arrow.clone(true);spare.name='QuiverSpareArrow';spare.userData.drawnArrow=false;
   spare.rotation.set(Math.PI,0,0);bundle.add(spare);spares.push(spare);
  }
  spares.forEach((spare,i)=>spare.position.fromArray(quiverArrowOffset(i+1,settings.spacingPercent)));
  bundle.updateWorldMatrix(true,true);
  handRotation.copy(pickupFrame).multiply(bundle.quaternion);
  heldAxis.set(0,-1,0).applyQuaternion(handRotation).applyQuaternion(pickupHandInverse);
 }
 function widthScale(state){
  if(state?.phase==='carry')return settings.widthPercent/100+(1-settings.widthPercent/100)*Math.min(1,Math.max(0,state.progress||0)/.2);
  return ['nocked','released'].includes(state?.phase)?1:settings.widthPercent/100;
 }
 function calibrate(model,{arrowSocket=null,bundleSettings}={}){
  clear();ownsQuiver=!arrowSocket;quiverBody=arrowSocket?null:model;
  if(arrowSocket)quiver=arrowSocket;
  else{
  // Called once at the authored pickup pose. The mouth follows the chest;
  // the selected arrow's nock meets the grasping fingers exactly at pickup.
  quiver=new THREE.Group();quiver.name='BowBackQuiver';torso.add(quiver);
  nockBone.getWorldPosition(point);torso.worldToLocal(point);quiver.position.copy(point);
  neck.getWorldPosition(axis);torso.worldToLocal(axis);axis.normalize();
  if(shoulder){shoulder.getWorldPosition(point);torso.worldToLocal(point);point.addScaledVector(axis,-point.dot(axis)).normalize();forward.crossVectors(axis,point).normalize();axis.addScaledVector(point,.22).addScaledVector(forward,.22).normalize();}
  quiver.quaternion.setFromUnitVectors(up,axis);
  torso.getWorldScale(scale);quiver.scale.set(1/Math.abs(scale.x),1/Math.abs(scale.y),1/Math.abs(scale.z));
  // Source quiver bounds are Y=0..1; keep arrow tips inside its closed bottom.
  model.scale.setScalar(.29);model.position.set(0,-.415,0);quiver.add(model);
  }
  bundle=new THREE.Group();bundle.name='QuiverArrowBundle';quiver.add(bundle);
  quiver.getWorldQuaternion(pickupFrame);nockBone.getWorldQuaternion(pickupHandInverse);pickupHandInverse.invert();
  setBundleSettings(bundleSettings);
 }
 function sample(state,tail,tip,bowHand,sizeScale=1){
  if(!quiver)return false;
  // Keep short map-scale arrows inserted into the mouth, with the nock in reach.
  if(quiverBody)quiverBody.position.y=-.29-Math.min(.125,ARROW_VISUAL.lengthMetres*sizeScale*.3);
  const remaining=Number.isFinite(state?.remaining)?state.remaining:Math.max(1,settings.count);
  bundle.getWorldScale(scale);
  const reserve=state?.phase==='released'?0:1,visible=Math.max(0,Math.min(settings.count-reserve,remaining-reserve));
  spares.forEach((spare,i)=>{spare.visible=i<visible;spare.scale.set(sizeScale*settings.widthPercent/100/Math.abs(scale.x),ARROW_VISUAL.lengthMetres*sizeScale/Math.abs(scale.y),sizeScale*settings.widthPercent/100/Math.abs(scale.z));});
  if(state?.phase==='released'||remaining<=0)return false;
  if(state?.phase==='nocked')return false;
  if(settings.count===0&&state?.phase!=='carry')return false;
  bundle.updateWorldMatrix(true,false);bundle.getWorldPosition(stored);
  bundle.getWorldQuaternion(handRotation);axis.set(0,-1,0).applyQuaternion(handRotation);
  if(state?.phase==='carry'){
   nockBone.getWorldPosition(tail);nockBone.getWorldQuaternion(handRotation);
   held.copy(heldAxis).applyQuaternion(handRotation);
   bowHand.getWorldPosition(towardBow);towardBow.sub(tail).normalize();
   const t=Math.max(0,Math.min(1,(state.progress-.45)/.55)),blend=t*t*(3-2*t);
   axis.copy(held).lerp(towardBow,blend).normalize();
  }else tail.copy(stored);
  tip.copy(tail).addScaledVector(axis,ARROW_VISUAL.lengthMetres*sizeScale);
  return true;
 }
 return {calibrate,sample,setBundleSettings,widthScale,dispose:clear,get root(){return quiver;},get bundle(){return bundle;}};
}
