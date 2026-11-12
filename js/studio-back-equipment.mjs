import {findHumanoidBone} from './humanoid-rig.mjs';
import {savedFit} from './mob-workshop-fit-store.mjs?v=R238C306';
import {normalizeQuiverArrows} from './quiver-arrow-settings.mjs?v=R238C312';

// Extend this catalog for other back-mounted props; fits remain model/item/slot specific.
export const BACK_ITEMS=Object.freeze([
 {id:'empty-quiver',label:'Quiver',file:'assets/models/weapons/low-poly-medieval/quiver.glb',height:.29,holdsArrows:true}
]);
export function backItem(id){return BACK_ITEMS.find(item=>item.id===id)||null;}
export function normalizeBackEquipment(value={}){
 const item=value.item??'none';
 if(!['none','auto'].includes(item)&&!backItem(item))throw Error('Unknown Back item: '+item);
 const sizePercent=value.sizePercent??100,position=value.position??[.14,.1,.16],rotation=value.rotation??[0,0,-15];
 if(!Number.isFinite(sizePercent)||sizePercent<25||sizePercent>200||
  ![position,rotation].every(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite)))throw Error('Invalid Back attachment fit.');
 return {item,sizePercent,position:[...position],rotation:[...rotation],arrows:normalizeQuiverArrows(value.arrows)};
}
export function createBackAttachment(THREE,rig,model,settings){
 const value=normalizeBackEquipment(settings),item=backItem(value.item);
 if(!item)throw Error('Choose a Back item first.');
 const torso=findHumanoidBone(rig,'upperChest')||findHumanoidBone(rig,'chest')||findHumanoidBone(rig,'spine');
 const neck=findHumanoidBone(rig,'neck'),shoulder=findHumanoidBone(rig,'rightShoulder');
 if(!torso||!neck||!shoulder)throw Error('Back equipment needs chest, neck and right-shoulder bones.');
 rig.updateWorldMatrix(true,true);
 const up=torso.worldToLocal(neck.getWorldPosition(new THREE.Vector3())).normalize();
 const right=torso.worldToLocal(shoulder.getWorldPosition(new THREE.Vector3()));right.addScaledVector(up,-right.dot(up)).normalize();
 const back=new THREE.Vector3().crossVectors(right,up).normalize();right.crossVectors(up,back).normalize();
 const anchor=new THREE.Group();anchor.name='BackAttachmentFrame';torso.add(anchor);
 anchor.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,back));
 const inherited=torso.getWorldScale(new THREE.Vector3());anchor.scale.set(1/Math.abs(inherited.x),1/Math.abs(inherited.y),1/Math.abs(inherited.z));
 const socket=new THREE.Group();socket.name='StudioBackEquipment';socket.userData.studioEquipment=true;anchor.add(socket);
 model.scale.setScalar(item.height);model.position.set(0,-item.height,0);socket.add(model);
 const arrowSocket=item.holdsArrows?new THREE.Group():null;
 if(arrowSocket){arrowSocket.name='BackQuiverArrowSocket';arrowSocket.position.y=.125;socket.add(arrowSocket);}
 function update(next){const s=normalizeBackEquipment(next);socket.position.fromArray(s.position);socket.rotation.set(...s.rotation.map(THREE.MathUtils.degToRad),'XYZ');socket.scale.setScalar(s.sizePercent/100);anchor.updateWorldMatrix(true,true);}
 update(value);
 return {model,socket,anchor,arrowSocket,update,detach(){anchor.removeFromParent();}};
}
export function createStudioBackEquipment({THREE,loadAsset,disposeObject=()=>{}}){
 let rig=null,attachment=null,settings=normalizeBackEquipment(),error=null,loading=false,generation=0;
 function clear(){if(attachment){attachment.detach();disposeObject(attachment.model);attachment=null;}}
 async function select(next){
  const value=normalizeBackEquipment(next),id=value.item;
  if(attachment&&id===settings.item){attachment.update(value);settings=value;return true;}
  const token=++generation;clear();settings=value;error=null;loading=false;
  const item=backItem(id);if(!rig||!item)return true;
  loading=true;
  try{
   const asset=await loadAsset(item);
   if(token!==generation){disposeObject(asset);return false;}
   try{attachment=createBackAttachment(THREE,rig,asset,value);}catch(e){disposeObject(asset);throw e;}
   return true;
  }catch(e){if(token===generation)error=e.message;throw e;}
  finally{if(token===generation)loading=false;}
 }
 return {select,async setModel(model,next={}){generation++;clear();rig=model;return select(next);},
  snapshot:()=>({settings:structuredClone(settings),loading,error}),getAttachmentSocket:()=>attachment?.socket||null,getArrowSocket:()=>attachment?.arrowSocket||null,
  dispose(){generation++;clear();rig=null;}};
}
export async function loadWorkshopBackAttachment(THREE,model,draft,loadAsset){
 const id=draft.equipment.back??'auto';normalizeBackEquipment({item:id});
 const item=backItem(id);if(!item)return null;
 const asset=await loadAsset(item);
 const settings=normalizeBackEquipment({...savedFit(draft,'back',id),item:id});
 return createBackAttachment(THREE,model,asset,settings);
}
