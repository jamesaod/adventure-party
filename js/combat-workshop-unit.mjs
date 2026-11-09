import * as THREE from '../assets/vendor/three/three.module.min.js';
import {loadCombatModel} from './combat-model-source.mjs';
import {validateWorkshopUnit} from './workshop-unit-package.mjs';
import {buildSceneGraph,configureCamera,normalizedFrame,mountCombatEquipment} from './combat-mob-renderer.mjs';
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
 const local=structuredClone(recipe),group=buildSceneGraph(model,local),frame=normalizedFrame(local),camera=configureCamera(local,frame);
 await mountCombatEquipment(model,local);
 const hand=createHandPose(THREE);hand.bind(model);
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
  const asset={group,camera,triangles,workshopSample(entity,walkSeconds,now){
   const selected=select(entity,slot,walkSeconds,Math.floor(now*30/1000)*1000/30);
   if(shared.key!==selected.key||shared.entity!==entity){
    hand.restore();mixer.stopAllAction();grounding.reset();
    if(selected.assignment){const action=actions.get(selected.assignment.clipId);action.reset();action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.setTime(selected.time);}
    if(selected.slot==='move')grounding.apply();
    hand.apply(draft.equipment.primaryHandPose);group.updateMatrixWorld(true);
    shared.key=selected.key;shared.entity=entity;
   }
   asset.workshopPoseKey=selected.key;return selected.animating;
  }};
  for(const facing of HEX_FACINGS){const file=pose+'-'+facing.id+'.png';const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Cannot initialize direct model frame handle.'));i.src=src;});setDirectUnit(image,asset,facing.yawRadians);images[file]=image;sourceUrls[file]=src;poses[pose].frames[facing.id]=file;}
 }
 return {manifest:{schema:'adventure-party.sprite-set',version:1,...workshopAttackTiming(draft,weaponSlot),id:'workshop-'+pack.id,label:draft.name,frame,facings:HEX_FACINGS.map(f=>f.id),poses,partialPoses:true,actionProfileId:weaponSlot,layout:{id:'single',resolutionPercent:200},modelScalePercent:local.renderSettings.modelScalePercent,hexScalePercent:100,render:{renderer:'direct-workshop-v1'}},images,runtimeImages:{},sourceUrls};
}

