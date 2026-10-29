import {generateMobRules} from './mob-class-rules.mjs?v=R238C190';
import {sampleGeneration} from './mob-generation.mjs?v=R238C201';
import {resolveEquipmentLibrary} from './equipment-library-core.mjs?v=R238C201';
import {normalizeMobDefinition} from './mob-definition.mjs?v=R238C201';
import {poseWithFallback} from './pose-fallbacks.mjs?v=R238C176';
import {spriteLayoutDimensions} from './sprite-layouts.mjs?v=R238C201';
import {CAMERA_ELEVATION} from './studio-core.mjs?v=R238C99';

export function createRepositoryMob(template,catalog){
 template=normalizeMobDefinition(template);
 const ITEM_CATALOG=resolveEquipmentLibrary(template.references.equipmentLibrary);
 const entry=catalog.models.find(m=>m.id===template.modelId);
 if(!entry)throw Error('Repository MOB model is missing: '+template.modelId);
 const model={modelId:entry.id,modelUrl:'../'+entry.file,modelHash:'catalog:'+entry.id+':'+entry.file,animationLibrary:entry.animationLibrary};
 function apply(unit,rng=Math.random){
  const sample=sampleGeneration(template.mob.generation,rng,ITEM_CATALOG),rules=template.character.rules;
  const match=/^(\d+)d(\d+)([+-]\d+)?$/.exec(rules.hitDice);
  if(rules.hpMode==='rolled'&&!match)throw Error('Unsupported repository MOB hit dice: '+rules.hitDice);
  const hp=rules.maxHp;
  Object.assign(unit,{repositoryMobId:template.id,repositoryMobModel:model,name:template.name,classId:sample.classId,level:sample.level,abilities:structuredClone(template.character.abilities),hp,maxHp:hp,ac:rules.ac,authoredBaseAc:rules.ac,unarmoredAc:rules.ac,thaco:rules.thaco,move:rules.move,authoredMove:rules.move,attacksPerRound:rules.attacksPerRound,morale:rules.morale,moraleLabel:String(rules.morale),xpValue:rules.xpValue,hitDiceLabel:rules.hitDice,hitDiceValue:match?+match[1]:1,brightLightAttackPenalty:template.mob.specialAbilities.includes('bright-light-penalty')?-1:0});
  unit.inventory=sample.equipment.map(e=>{const item=ITEM_CATALOG[e.itemId];return {name:item.name,type:({shield:'Shield',weapon:'Weapon',armor:'Armor',item:'Item'})[item.category],slot:item.slot,qty:e.quantity||1,equipped:e.slot!=='inventory',equippable:true,catalogItemId:item.id,catalogWeaponId:item.rules.catalogWeaponId,catalogArmorId:item.rules.catalogArmorId,appearanceId:item.appearance?.appearanceId||null,weaponPoseProfileId:item.rules?.poseProfileId||item.appearance?.poseProfileId,...item.rules};});
  Object.assign(unit,generateMobRules(template,sample,rng));
  return unit;
 }
 function recipe(unit){
  const library=template.references.poseLibrary,appearance=template.references.studioAppearance;
  const weapon=unit.inventory.find(i=>i.slot==='weapon'&&i.equipped),profileId=ITEM_CATALOG[weapon?.catalogItemId]?.rules?.poseProfileId||ITEM_CATALOG[weapon?.catalogItemId]?.appearance?.poseProfileId||'one-handed-swing';
  const poses={};for(const pose of ['ready','windup','attack','falling','prone','casting-windup','cast']){const resolved=poseWithFallback(library.profiles,library.sharedActionGroups,profileId,pose);if(resolved)poses[pose]={...resolved.sample,gripCorrection:null};}
  const render=template.references.spriteSets?.[profileId]?.poses?.ready?.render||template.references.spriteSets?.['one-handed-swing']?.poses?.ready?.render;
  // Portable pose libraries have no sprite camera. Fit the normalized rest body once.
  const portable=!render;
  const camera=render||{heading:0,upAxis:'Y',frameHeight:3.15,center:[0,1,0],...appearance};
  const studioWeaponId=ITEM_CATALOG[weapon?.catalogItemId]?.appearance?.studioId;
  const grip=(entry.weaponAttachmentProfileIds||[]).map(id=>catalog.weaponAttachmentProfiles?.[id]).find(p=>p?.weaponIds?.includes(studioWeaponId));
  const factor=appearance.modelScalePercent*appearance.hexScalePercent/10000;
  const frame=spriteLayoutDimensions(appearance.footprint,200,appearance.modelScalePercent,appearance.hexScalePercent);
  frame.anchorX=frame.width/2;frame.anchorY=frame.height/2*(1+2*camera.center[1]*Math.cos(CAMERA_ELEVATION)/camera.frameHeight);
  return {source:'repository-mob:'+template.id,model,poseProfile:{id:template.id+':'+profileId,version:library.revision,poses},renderSettings:{source:'repository-mob',frame,modelScalePercent:appearance.modelScalePercent,hexScalePercent:appearance.hexScalePercent,layoutId:appearance.footprint,resolutionPercent:200,transform:{normalizeRest:true,fitRest:portable,placement:{position:[0,0,0],scale:1},heading:camera.heading,upAxis:camera.upAxis,frameHeight:camera.frameHeight/factor,center:camera.center.map(v=>v/factor)},weaponAttachmentProfile:grip?{...grip,weaponId:studioWeaponId}:null,lighting:camera.lighting,equipment:camera.equipment,shield:camera.shield,offHandEquipment:camera.offHandEquipment,appearanceRecolor:appearance.appearanceRecolor,style:{brightness:1,contrast:1,hue:0,saturation:1,outline:0}}};
 }
 return {apply,recipe,template};
}
export function createRepositoryMobRegistry(templates,catalog){
 const entries=new Map(templates.map(t=>[t.id,createRepositoryMob(t,catalog)]));
 if(entries.size!==templates.length)throw Error('Duplicate repository MOB ID.');
 const defaultMob=entries.get('orc-male-uniformed')||entries.values().next().value;
 return {apply:(unit,rng,id)=>{const api=id?entries.get(id):defaultMob;if(!api)throw Error('Unknown repository MOB: '+id);return api.apply(unit,rng);},
 recipe:unit=>{const api=entries.get(unit.repositoryMobId);if(!api)throw Error('Unknown repository MOB: '+unit.repositoryMobId);return api.recipe(unit);}};
}
if(typeof window!=='undefined'){
 const load=async path=>{const response=await fetch(new URL(path,import.meta.url));if(!response.ok)throw Error('Could not load '+path);return response.json();};
 const [template,archer,catalog]=await Promise.all([load('../data/mobs/orc-male-uniformed.unit-package.json?v=R238C190'),load('../data/mobs/orc-archer.unit-package.json?v=R238C201'),load('../data/studio-models.json?v=R238C196')]);
 window.adventurePartyRepositoryMobs=createRepositoryMobRegistry([template,archer],catalog);
}
