import {TransformControls} from '../assets/vendor/three/addons/controls/TransformControls.js';

import {captureFit,readFit} from './mob-workshop-fit-core.mjs';
export function createWorkshopFit({THREE,scene,camera,renderer,controls,managers,$,getSlot,isActive,pause,changed,status}){
 const gizmo=new TransformControls(camera,renderer.domElement);scene.add(gizmo.getHelper());gizmo.setSize(.75);
 let start=null,applying=false;
 const manager=()=>managers[getSlot()];
 function detach(){gizmo.detach();start=null;controls.enabled=true;}
 function refresh(){
  detach();const socket=manager().getAttachmentSocket();
  $('fitBone').textContent=getSlot()==='quiverArrows'?(socket?'Arrow bundle · offsets from the quiver pickup point':'Bundle handles need a bow and a Bow animation with time before String Draw.'):
   socket?'Attached to '+socket.parent.name+' · catalog grip origin':'Choose equipment to fit. For Back, select Quiver to enable its handles.';
  if(socket&&isActive()&&$('fitEnabled').checked)gizmo.attach(socket);
 }
 gizmo.addEventListener('dragging-changed',e=>{controls.enabled=!e.value;if(e.value){pause();start=captureFit(THREE,gizmo.object,manager().snapshot().settings,getSlot()==='shield');}else start=null;});
 gizmo.addEventListener('objectChange',()=>{
  if(!start||applying)return;
  applying=true;
  const current=manager(),settings=readFit(THREE,gizmo.object,start);
  // Selecting the already-loaded asset updates its transform synchronously; no reload.
  Promise.resolve(current.select(settings)).then(()=>changed(current.snapshot().settings)).catch(e=>status(e.message,true)).finally(()=>{applying=false;});
 });
 $('fitEnabled').onchange=refresh;
 $('fitMove').onclick=()=>gizmo.setMode('translate');$('fitRotate').onclick=()=>gizmo.setMode('rotate');
 $('fitSpace').onchange=()=>gizmo.setSpace($('fitSpace').value);
 $('fitSnap').onchange=()=>{gizmo.setTranslationSnap($('fitSnap').checked?.005:null);gizmo.setRotationSnap($('fitSnap').checked?THREE.MathUtils.degToRad(5):null);};
 $('fitClose').onclick=()=>{const socket=manager().getAttachmentSocket();if(!socket)return;const target=socket.getWorldPosition(new THREE.Vector3()),direction=camera.position.clone().sub(controls.target).normalize();controls.target.copy(target);camera.position.copy(target).addScaledVector(direction,.65);controls.update();};
 return {detach,refresh};
}
