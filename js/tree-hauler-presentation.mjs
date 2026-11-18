import {savedFit} from './mob-workshop-fit-store.mjs?v=R238C306';
import {TREE_CLUB_ASSET,INDIVIDUAL_TREE_CLUBS,treeClubById,harvestedTreeClubScale,treeClubUsesOffHand} from './tree-trunk-club.mjs';
import {inferHandGripLocal,solveTwoHandedGrip,HELD_WEAPON_AXIS} from './studio-equipment.mjs?v=hand-range20';
import * as T from '../assets/vendor/three/three.module.min.js';
import {weaponGripQuaternion} from './weapon-shaft-roll.mjs?v=R238C194';
import {loadCombatModel} from './combat-model-source.mjs';
import {prepareStudioAnimations} from './studio-animations.mjs';
import {retargetHumanoidClip} from './mixamo-retarget.mjs';
import {semanticBoneMap} from './humanoid-rig.mjs';
import {removeWorkshopRootTravel} from './workshop-grounding.mjs';
export async function prepareTreeHauler(model,group,mixer,actions,prepareMaterials,draft,physicalScale){
 const source=await loadCombatModel(new URL('../assets/animations/ual1/ual1-death02-source.glb',import.meta.url).href),clips=prepareStudioAnimations(source.animations),durations={};
 for(const name of ['Push_Enter','Push_Exit','PickUp_Kneeling']){
  const original=clips.find(c=>c.name===name);if(!original)throw Error('UAL source is missing '+name);
  const clip=removeWorkshopRootTravel(retargetHumanoidClip(T,original,source.scene,model,name,{mode:'world-bind-delta',hipTranslation:'scaled-world-y'}),model);
  actions.set(name,mixer.clipAction(clip));durations[name]=clip.duration;
 }
 globalThis.adventurePartyTreeHaulerDurations=durations;
 const bones=semanticBoneMap(model),hand=bones.get('rightHand');if(!hand)throw Error('Orc right hand is unavailable');
 if(!Number.isFinite(physicalScale)||physicalScale<=0)throw Error('Tree club physical scale is unavailable');
 const clubSources=new Map(await Promise.all([{id:'tree-trunk-club',appearance:{asset:TREE_CLUB_ASSET}},...INDIVIDUAL_TREE_CLUBS].map(async c=>[c.id,(await loadCombatModel(new URL('../'+c.appearance.asset,import.meta.url))).scene])));
 const carried=new WeakMap();let held=null,mesh=null,attachment=null,saved=[];
 return {restore(){for(const [bone,q]of saved)bone.quaternion.copy(q);saved=[];},constrain(entity,slot){if(!mesh||!treeClubUsesOffHand(entity,slot)){if(entity)entity.treeGripDiagnostic={active:false};return;}model.traverse(b=>{if(b.isBone)saved.push([b,b.quaternion.clone()]);});const result=solveTwoHandedGrip(T,{model,attachment,iterations:24,tolerance:.012});entity.treeGripDiagnostic={active:true,error:result.error,solved:result.solved};},select(entity,now){if(!entity)return null;entity.treeActionDurations=durations;const a=entity.alive&&entity.treeInteraction;if(!a)return null;const time=Math.min(a.seconds,Math.max(0,(now-a.started)/a.duration)*a.seconds);return {slot:'tree-action',assignment:{clipId:a.name},time,key:a.name+':'+time,animating:time<a.seconds};},update(entity){
  if(!entity)return;
  if(held===entity.carriedTreeLog)return;held=entity.carriedTreeLog;mesh?.removeFromParent();mesh=null;attachment=null;if(!held)return;
  const cached=carried.get(held);if(cached){mesh=cached.mesh;attachment=cached.attachment;hand.add(mesh);return;}
  const club=treeClubById(held.clubId),metresToModel=physicalScale,copy=cloneTreeLogObject(clubSources.get(club.id));
  const clubFit=savedFit(draft,'main',club.id);
  const assetScale=held.clubId?(clubFit?.sizePercent??100)/100:harvestedTreeClubScale(held.lengthMetres,clubFit?.sizePercent??75);
  copy.scale.setScalar(assetScale*metresToModel);
  mesh=new T.Group();mesh.name='Treebreaker held trunk';mesh.add(copy);
  if(clubFit?.position)mesh.position.fromArray(clubFit.position);
  else mesh.position.copy(inferHandGripLocal(T,hand,model,'right'));
  const fit=clubFit||savedFit(draft,'main','two-handed-battle-axe');
  if(fit)mesh.quaternion.copy(weaponGripQuaternion(T,fit.rotation,club.appearance.primaryAxis,fit.shaftRollDegrees||0));
  else mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(...HELD_WEAPON_AXIS));
  hand.add(mesh);hand.updateWorldMatrix(true,false);const worldScale=hand.getWorldScale(new T.Vector3());mesh.scale.set(1/worldScale.x,1/worldScale.y,1/worldScale.z);
  attachment={model:copy,weapon:{inchesPerLocalUnit:1/.0254,handsRequired:2,primaryAxis:[0,1,0],secondaryGrip:held.clubId?club.appearance.secondaryGrip:[0,Math.min(.4,held.lengthMetres*.15)/assetScale,0],calibratedLengthInches:1/.0254},secondaryGripOffsetInches:clubFit?.secondaryGripOffsetInches||[0,0,0]};
  prepareMaterials(mesh);carried.set(held,{mesh,attachment});group.updateMatrixWorld(true);
 }};
}

export function cloneTreeLogObject(object){
 const copy=object.clone(true);copy.visible=true;copy.traverse(o=>{if(!o.isMesh)return;o.visible=true;o.geometry=o.geometry.clone();const array=Array.isArray(o.material),materials=[o.material].flat().map(m=>{const c=m.clone();c.visible=true;for(const[k,v]of Object.entries(c))if(v?.isTexture)c[k]=v.clone();return c;});o.material=array?materials:materials[0];});
 return copy;
}
