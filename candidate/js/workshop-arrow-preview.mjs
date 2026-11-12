import {bowArrowStateAt,bowPickupTime} from './equipment-visual-states.mjs';
import {normalizeQuiverArrows} from './quiver-arrow-settings.mjs?v=R238C312';

// Sample calibration on a temporary mixer, then restore the displayed pose.
// The Workshop's playing/paused state, action and clock remain untouched.
export function atPickupPose({THREE,model,clip,time,handPose,handSettings,main},calibrate){
 main.restoreConstraints();handPose.restore();
 const sampler=new THREE.AnimationMixer(model);
 try{
  const action=sampler.clipAction(clip).setLoop(THREE.LoopOnce,1);
  action.clampWhenFinished=true;action.play();sampler.setTime(time);
  handPose.apply(handSettings);model.updateWorldMatrix(true,true);
  calibrate();
 }finally{
  handPose.restore();sampler.stopAllAction();sampler.uncacheRoot(model);
  handPose.apply(handSettings);main.applyConstraints();model.updateWorldMatrix(true,true);
 }
}

export function createWorkshopArrowPreview({THREE,main,back,loadQuiver,disposeObject}){
 const material=new THREE.MeshBasicMaterial({color:0x50eeff,depthTest:false,depthWrite:false});
 const marker=new THREE.Group();marker.name='WorkshopArrowPickupMarker';
 marker.add(new THREE.Mesh(new THREE.SphereGeometry(.012,12,8),material));
 const points=[[-.04,0,0],[.04,0,0],[0,-.04,0],[0,.04,0],[0,0,-.04],[0,0,.04]].map(p=>new THREE.Vector3(...p));
 marker.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),
  new THREE.LineBasicMaterial({color:0x50eeff,depthTest:false,depthWrite:false})));
 marker.children.forEach(o=>{o.renderOrder=1001;});marker.visible=false;
 const scale=new THREE.Vector3();
 let active=null,ownedModel=null,last=null,generation=0;
 let bundleSettings=normalizeQuiverArrows();
 function setBundleSettings(value){bundleSettings=normalizeQuiverArrows(value);main.getArrowPickup()?.setBundleSettings(bundleSettings);}
 function reset(){
  generation++;marker.removeFromParent();marker.visible=false;
  active?.dispose();active=null;
  if(ownedModel){disposeObject(ownedModel);ownedModel=null;}last=null;
 }
 async function prepare({model,source,assignment,clip,handPose,handSettings,backId,fitKey,arrows}){
  setBundleSettings(arrows);
  const pickup=main.getArrowPickup(),socket=back.getArrowSocket(),time=bowPickupTime(assignment);
  const key=[model,pickup,socket,source?.data,JSON.stringify([backId,assignment?.start,time,handSettings,fitKey])];
  if(last&&key.every((value,i)=>value===last[i]))return;
  reset();last=key;
  if(!model||!pickup||!source||time==null||(backId!=='auto'&&!socket))return;
  const token=generation;
  let asset=null;
  try{
   if(!socket)asset=await loadQuiver();
   if(token!==generation){if(asset)disposeObject(asset);return;}
   active=pickup;ownedModel=asset;
   atPickupPose({THREE,model,clip:clip(),time,handPose,handSettings,main},()=>pickup.calibrate(asset,{arrowSocket:socket,bundleSettings}));
  }catch(error){
   if(token===generation)reset();
   throw error;
  }
 }
 function origin(){return main.getArrowPickup()?.bundle||back.getArrowSocket();}
 function sample(assignment,time,show){
  const state=bowArrowStateAt(assignment,time);
  main.setBowState(state);
  const socket=origin();
  if(socket){
   if(marker.parent!==socket)socket.add(marker);
   socket.getWorldScale(scale);
   marker.scale.set(1/Math.max(1e-6,Math.abs(scale.x)),1/Math.max(1e-6,Math.abs(scale.y)),1/Math.max(1e-6,Math.abs(scale.z)));
  }else marker.removeFromParent();
  marker.visible=!!socket&&show;
  return state;
 }
 return {prepare,sample,reset,origin,marker,setBundleSettings,bundle:()=>main.getArrowPickup()?.bundle||null};
}
