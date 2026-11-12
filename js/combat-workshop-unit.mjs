import {savedFit} from './mob-workshop-fit-store.mjs?v=R238C306';
import {normalizeQuiverArrows} from './quiver-arrow-settings.mjs?v=R238C312';
import {loadWorkshopBackAttachment} from './studio-back-equipment.mjs?v=R238C312';
import {combatPerformance as perf} from './combat-performance.mjs';
import {appearanceCacheKey} from './mob-appearance.mjs?v=R238C204';
import {applyModelUpAxis} from './workshop-model-axis.mjs';
import {bowArrowStateAt,bowPickupTime} from './equipment-visual-states.mjs?v=R238C304';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {loadCombatModel} from './combat-model-source.mjs';
import {validateWorkshopUnit} from './workshop-unit-package.mjs?v=R238C313';
import {buildSceneGraph,configureCamera,normalizedFrame,mountCombatEquipment} from './combat-mob-renderer.mjs?v=R238C312';
import {restoreDirectMaterials,setDirectUnit} from './combat-direct-units.mjs';
import {createWorkshopAnimationSelector,workshopAttackTiming} from './workshop-animation-runtime.mjs';
import {createHandPose} from './mob-workshop-hand-pose.mjs';
import {removeWorkshopRootTravel,createWorkshopGrounding} from './workshop-grounding.mjs';
import {HEX_FACINGS} from './studio-core.mjs';

export async function loadWorkshopCombatUnit(recipe,{onProgress}={}){
 const pack=validateWorkshopUnit(recipe.renderSettings.workshopUnit),draft=pack.draft;
 onProgress?.({step:'Loading Workshop unit',reason:'Loading the published rig and authored clips directly; no sprite baking.'});
 const gltf=await loadCombatModel(new URL('../'+pack.model.file,import.meta.url),{sha256:pack.model.sha256}),model=gltf.scene;
 const mixer=new THREE.AnimationMixer(model),actions=new Map();
 for(const source of draft.clips){
  const clip=THREE.AnimationClip.parse(source.data);
  for(const track of clip.tracks){const dot=track.name.lastIndexOf('.'),name=track.name.slice(0,dot),matches=[];model.traverse(node=>{if(node.name===name)matches.push(node);});if(matches.length!==1)throw Error(`Workshop animation binding is missing or ambiguous: ${name}`);track.name=matches[0].uuid+track.name.slice(dot);}
  actions.set(source.id,mixer.clipAction(removeWorkshopRootTravel(clip,model)));
 }
 const oriented=new THREE.Group();oriented.add(model);applyModelUpAxis(THREE,oriented,draft.modelUpAxis||'Y');oriented.updateMatrixWorld(true);
 const local=structuredClone(recipe),group=buildSceneGraph(oriented,local),frame=normalizedFrame(local),camera=configureCamera(local,frame);
 model.userData.workshopPhysicalEquipment=true;
 const equipment=await mountCombatEquipment(model,local);
 const hand=createHandPose(THREE);hand.bind(model);
 const backId=draft.equipment.back??'auto';
 const backAttachment=await loadWorkshopBackAttachment(THREE,model,draft,item=>loadCombatModel(new URL('../'+item.file,import.meta.url)).then(g=>g.scene));
 const bowAssignment=recipe.equipment?.poseProfileId==='bow'?draft.assignments.bow?.[0]:null;
 const pickupTime=bowPickupTime(bowAssignment),bundleSettings=normalizeQuiverArrows(savedFit(draft,'back')?.arrows);
 if(pickupTime!=null&&equipment.attachment?.calibrateArrowPickup&&(backId==='auto'||backAttachment?.arrowSocket)){
  const action=actions.get(bowAssignment.clipId);action.reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  mixer.setTime(pickupTime);hand.apply(draft.equipment.primaryHandPose);group.updateMatrixWorld(true);
  if(backAttachment?.arrowSocket)equipment.attachment.calibrateArrowPickup(null,{arrowSocket:backAttachment.arrowSocket,bundleSettings});
  else{const quiver=await loadCombatModel(new URL('../assets/models/weapons/low-poly-medieval/quiver.glb',import.meta.url));equipment.attachment.calibrateArrowPickup(quiver.scene,{bundleSettings});}
  hand.restore();mixer.stopAllAction();group.updateMatrixWorld(true);
 }
 restoreDirectMaterials(group);
 let triangles=0;group.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
 const grounding=createWorkshopGrounding(THREE,model,group);
 const select=createWorkshopAnimationSelector(draft),shared={key:null,entity:null};
 const weaponSlot=recipe.equipment?.poseProfileId||'one-handed-swing';
 const poses={},images={},sourceUrls={};
 const mapping={ready:'idle',windup:weaponSlot,attack:weaponSlot,falling:'death',prone:'death','casting-windup':'cast',cast:'aim-fire-spell'};
 // Dimensions-only handles preserve the existing renderer dispatch interface.
 // These contain no rendered model pixels: all visible geometry is drawn by GPU.
 const src='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}"/>`);
 for(const [pose,slot] of Object.entries(mapping)){
  poses[pose]={frames:{}};
  const asset={group,camera,triangles,workshopSample(entity,walkSeconds,now,arrowScale=1){
   const selected=select(entity,slot,walkSeconds,Math.floor(now*30/1000)*1000/30);
   if(shared.key!==selected.key||shared.ammo!==entity?.missileAmmoQuantity||shared.arrowScale!==arrowScale){
      perf.count('workshopPoseEvaluations');
    hand.restore();mixer.stopAllAction();grounding.reset();
    if(selected.assignment){const action=actions.get(selected.assignment.clipId);action.reset();action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.setTime(selected.time);}
    if(selected.slot==='move')grounding.apply();
    if(selected.slot==='death')grounding.applyCorpse();
    hand.apply(draft.equipment.primaryHandPose);group.updateMatrixWorld(true);
    equipment.attachment?.setBowState(bowArrowStateAt(selected.assignment,selected.time,entity?.missileAmmoQuantity),arrowScale);
    shared.key=selected.key;shared.entity=entity;shared.ammo=entity?.missileAmmoQuantity;shared.arrowScale=arrowScale;
   }
   asset.workshopPoseKey=selected.key+'|arrows:'+(entity?.missileAmmoQuantity??'default')+'|arrowScale:'+arrowScale;return selected.animating;
  }};
  for(const facing of HEX_FACINGS){const file=pose+'-'+facing.id+'.png';const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Cannot initialize direct model frame handle.'));i.src=src;});setDirectUnit(image,asset,facing.yawRadians);images[file]=image;sourceUrls[file]=src;poses[pose].frames[facing.id]=file;}
 }
 return {manifest:{schema:'adventure-party.sprite-set',version:1,...workshopAttackTiming(draft,weaponSlot),bowDrawDelayMs:bowAssignment?.bowTiming?(bowAssignment.bowTiming.draw-bowAssignment.start)/bowAssignment.speed*1000:0,id:'workshop-'+pack.id+'-'+appearanceCacheKey(recipe),label:draft.name,frame,facings:HEX_FACINGS.map(f=>f.id),poses,partialPoses:true,actionProfileId:weaponSlot,layout:{id:'single',resolutionPercent:200},modelScalePercent:local.renderSettings.modelScalePercent,hexScalePercent:100,render:{renderer:'direct-workshop-v1'}},images,runtimeImages:{},sourceUrls};
}

