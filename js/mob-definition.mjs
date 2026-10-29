import {resolveEquipmentLibrary} from './equipment-library-core.mjs?v=R238C201';
import {normalizeSpellPreparation,prepareMobSpells} from './mob-class-rules.mjs?v=R238C190';
import {normalizeGeneration,generationWeaponTypes,sampleGeneration} from './mob-generation.mjs?v=R238C201';
import {createUnitPackage,validateUnitPackage} from './unit-package.mjs';
import {POSE_FALLBACKS} from './pose-fallbacks.mjs?v=R238C176';
import {normalizePoseLibrary,validAuthoringId,poseLibraryCoverage} from './pose-library.mjs?v=R238C196';
import {DEFAULT_ACTION_PROFILE_IDS} from './action-profile-catalog.mjs?v=R238C196';
export const ABILITY_SCORES=Object.freeze(['str','dex','con','int','wis','cha']);
export const MOB_ABILITIES=Object.freeze([{id:'bright-light-penalty',label:'Bright-light attack penalty (−1)'},{id:'spellcasting',label:'Spellcasting'}]);
const number=(v,label,min,max,integer=false)=>{if(!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))throw Error(`${label} must be ${integer?'a whole number ':''}between ${min} and ${max}.`);return v;};
export function normalizeMobRules(value={}){
  if(value.hpMode!==undefined&&!['rolled','fixed'].includes(value.hpMode))throw Error('Choose rolled or fixed HP.');
  const hpMode=value.hpMode==='fixed'?'fixed':'rolled';
  const hitDice=String(value.hitDice||'1d8').trim();
  if(!/^(?:[1-9]\d?|100)d(?:[1-9]\d?|100)(?:[+-]\d{1,3})?$/.test(hitDice))throw Error('Hit dice must be an expression such as 2d8+2.');
  return {classRules:value.classRules==='class'?'class':'authored',overrideHp:value.overrideHp===true,overrideThaco:value.overrideThaco===true,overrideAttacks:value.overrideAttacks===true,system:'adnd-2e',hpMode,hitDice,maxHp:number(value.maxHp??8,'Maximum HP',1,100000,true),ac:number(value.ac??10,'AC',-20,20),thaco:number(value.thaco??20,'THAC0',-20,30),move:number(value.move??12,'Movement',0,100),attacksPerRound:number(value.attacksPerRound??1,'Attacks per round',0.5,20),morale:number(value.morale??10,'Morale',2,20,true),xpValue:number(value.xpValue??0,'XP',0,10000000,true)};
}
export function createMobDefinition({id,name,modelId,library,abilities={},rules={},weaponTypes=['unarmed'],species='Humanoid',size='medium',footprint='single',specialAbilities=[],spellcasting=null,notes='',revision=0,equipment=[],attachments=null,references={},character={},generation=null,spellPreparation={}}){
  if(typeof name!=='string'||!name.trim()||name.length>160)throw Error('Enter a MOB name up to 160 characters.');
  if(!validAuthoringId(id)||!validAuthoringId(modelId))throw Error('Choose valid MOB and model IDs.');
  if(!['small','medium','large'].includes(size))throw Error('Invalid MOB size.');
  if(!['single','triangle3','triangle3-inverted','hex7'].includes(footprint))throw Error('Invalid footprint.');
  if(!Array.isArray(weaponTypes)||!weaponTypes.length||new Set(weaponTypes).size!==weaponTypes.length||weaponTypes.some(id=>!DEFAULT_ACTION_PROFILE_IDS.includes(id)))throw Error('Select at least one supported weapon type.');
  if(!Array.isArray(specialAbilities)||new Set(specialAbilities).size!==specialAbilities.length||specialAbilities.some(id=>!MOB_ABILITIES.some(ability=>ability.id===id)))throw Error('Unknown special ability.');
  const scores=Object.fromEntries(ABILITY_SCORES.map(id=>[id,number(abilities[id]??10,id.toUpperCase(),1,25,true)]));
  if(specialAbilities.includes('spellcasting')){
    if(!spellcasting||!['wizard','priest'].includes(spellcasting.classId))throw Error('Choose a spellcasting class.');
    if(!Array.isArray(spellcasting.spellIds))throw Error('Spell IDs must be a list.');
    spellcasting={classId:spellcasting.classId,level:number(spellcasting.level,'Caster level',1,30,true),spellIds:Array.from(new Set(spellcasting.spellIds||[]))};
    if(spellcasting.spellIds.length>100||spellcasting.spellIds.some(id=>!validAuthoringId(id)))throw Error('Invalid spell IDs.');
  }else spellcasting=null;
  spellPreparation=normalizeSpellPreparation(spellPreparation);
  const poseLibrary=normalizePoseLibrary(library);
  const equipmentCatalog=resolveEquipmentLibrary(references.equipmentLibrary);
  if(generation){generation=normalizeGeneration(generation,{catalog:equipmentCatalog});weaponTypes=[...new Set([...weaponTypes,...generationWeaponTypes(generation,equipmentCatalog)])];if(generation.kind==='unique'){const fixed=sampleGeneration(generation,Math.random,equipmentCatalog);character={...character,classId:fixed.classId,level:fixed.level};equipment=fixed.equipment;}}
  if(generation){const levels=generation.kind==='unique'?[generation.fixed]:generation.classLevels.filter(row=>row.weight>0);for(const row of levels)if(spellPreparation[row.classId]?.mode==='prepared')prepareMobSpells(row.classId,row.level,scores,spellPreparation);}
  return createUnitPackage({id,name,modelId,character:{...character,abilities:scores,rules:normalizeMobRules(rules)},actionProfiles:weaponTypes,equipment,
    attachments,references:{...structuredClone(references),poseFallbacks:POSE_FALLBACKS,poseLibrary},mob:{authoringVersion:1,spellPreparation,...(generation?{generation}:{}),revision:number(revision,'Revision',0,100000,true),species:String(species).slice(0,100),size,footprint,specialAbilities,spellcasting,notes:String(notes).slice(0,4000)}});
}
export function normalizeMobDefinition(value){
  validateUnitPackage(value);
  if(value.mob?.authoringVersion!==1)throw Error('This is not a MOB Creator definition.');
  return createMobDefinition({id:value.id,name:value.name,modelId:value.modelId,library:value.references?.poseLibrary,abilities:value.character.abilities,rules:value.character.rules,weaponTypes:value.actionProfiles,...value.mob,equipment:value.equipment,attachments:value.attachments,references:value.references,character:value.character});
}
export function mobReadiness(unit){const mob=normalizeMobDefinition(unit);return poseLibraryCoverage(mob.references.poseLibrary,mob.actionProfiles,{casting:mob.mob.specialAbilities.includes('spellcasting')|| (mob.mob.generation?.kind==='unique'?['mage','cleric'].includes(mob.mob.generation.fixed.classId):mob.mob.generation?.classLevels.some(r=>r.weight>0&&['mage','cleric'].includes(r.classId)))});}
