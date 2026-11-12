import {raceProfile} from './racial-traits.mjs?v=R238C311';
import {validateWorkshopProject} from './mob-workshop-project.mjs?v=R238C313';
import {readiness} from './mob-workshop-core.mjs?v=R238C313';
import {instantiateCreature} from './mob-workshop-creature.mjs?v=R238C313';
import {ITEM_CATALOG} from './item-catalog.mjs';
import {savedFit} from './mob-workshop-fit-store.mjs';

// This boundary deliberately does not normalize through the older MOB schema:
// that schema loses multiclass, INT 0, action assignments and inventory locations.
export const WORKSHOP_COMBAT_SCHEMA='adventure-party.workshop-combat';
export const WORKSHOP_COMBAT_VERSION=1;
const clone=value=>structuredClone(value);
const AMMUNITION_IDS=new Set(['arrows','bolt-light','bolt-heavy','sling-bullet','sling-stone']);

export function workshopCombatInventory(draft) {
  const rows=(draft.inventoryItems||[]).map(row=>{
    const item=ITEM_CATALOG[row.id];
    if(!item)throw Error('Unknown inventory item: '+row.id);
    const held=['main-hand','off-hand'].includes(row.location);
    const ammunition=AMMUNITION_IDS.has(item.rules?.catalogWeaponId);
    return {...clone(item.rules),name:item.name,
      type:ammunition?'Ammo':({weapon:'Weapon',shield:'Shield',armor:'Armor',item:'Item',ammo:'Ammo'})[item.category]||'Item',
      slot:item.slot,qty:row.quantity,equipped:held&&!ammunition,equippable:!ammunition,
      catalogItemId:item.id,appearanceId:item.appearance?.appearanceId||null,
      weaponPoseProfileId:item.rules?.poseProfileId||item.appearance?.poseProfileId,
      startingLocation:row.location};
  });
  // Armor is an explicit authoring field, not one of the three attachment sites.
  if(draft.equipment.armor){
    const armor=ITEM_CATALOG[draft.equipment.armor];
    if(!armor||armor.category!=='armor')throw Error('Unknown armor: '+draft.equipment.armor);
    const existing=rows.find(row=>row.catalogItemId===armor.id);
    if(existing)existing.equipped=true;
    else rows.push({...clone(armor.rules),name:armor.name,type:'Armor',slot:armor.slot,
      qty:1,equipped:true,equippable:true,catalogItemId:armor.id,startingLocation:'back'});
  }
  return rows;
}

export function workshopCombatFits(draft,inventory=workshopCombatInventory(draft)) {
  const fits={};
  for(const row of inventory.filter(row=>row.equipped)){
    const item=ITEM_CATALOG[row.catalogItemId],id=item?.appearance?.studioId;
    if(!id)continue;
    const slot=row.type==='Shield'?'shield':row.startingLocation==='off-hand'?'off':'main';
    const fit=savedFit(draft,slot,id);
    if(fit)fits[slot]=fit;
  }
  return fits;
}

// Pure unit conversion: no renderer, browser storage, random rerolls or side changes.
// Registration is intentionally separate, so an unimplemented capability cannot
// accidentally become encounter-selectable just because its JSON parses.
export function instantiateWorkshopCombat(draft,{id,random=Math.random}={}) {
  const instance=instantiateCreature(clone(draft),{id,random}),c=instance.definition;
  const abilities=Object.fromEntries(['str','dex','con','int','wis','cha'].map(k=>[k,draft.stats[k]]));
  return {id,name:draft.name,raceId:c.raceId,race:raceProfile(c.raceId).label,gender:c.gender,moraleOverride:c.moraleOverride,hp:instance.hp,maxHp:instance.maxHp,
    ac:instance.ac,authoredBaseAc:draft.stats.ac,unarmoredAc:draft.stats.ac,
    thaco:instance.thaco,move:draft.stats.move,authoredMove:draft.stats.move,
    attacksPerRound:1,hitDiceLabel:instance.hitDiceLabel,
    hitDiceValue:instance.hitDiceValue,lessThanOneHitDie:instance.lessThanOneHitDie,
    morale:c.stats.morale,moraleLabel:String(c.stats.morale),xpValue:draft.stats.xp,
    heightInches:draft.height/0.0254,sizeCategory:c.body.size,species:draft.stats.species,
    abilities,stats:clone(abilities),classes:clone(draft.classes||[]),
    classId:draft.classes?.[0]?.id||'none',level:draft.classes?.[0]?.level||1,
    saves:{death:c.combat.savePoison,wand:c.combat.saveWand,poly:c.combat.savePetrification,
      breath:c.combat.saveBreath,spell:c.combat.saveSpell},
    inventory:workshopCombatInventory(draft),conditions:[],
    workshopDefinition:clone(c)};
}

// Each connection must be explicitly advertised by the real consumer. Merely
// retaining a field in workshopDefinition is NOT proof the rule is implemented.
export function workshopCombatReadiness(project,consumers={}) {
  let draft;
  try{({draft}=validateWorkshopProject(project));}
  catch(error){return {ready:false,reasons:[error.message]};}
  return workshopCombatConnections(draft,consumers);
}

// Cheap UI diagnostic. Full dependency validation belongs at import/export,
// not on every input event (animation tracks can contain millions of values).
export function workshopCombatConnections(draft,consumers={}) {
  const reasons=readiness(draft).filter(check=>!check.ok).map(check=>check.label);
  const require=(key,needed,message)=>{if(needed&&consumers[key]!==true)reasons.push(message);};
  require('publication',true,'Repository publication is not connected.');
  require('directModels',true,'Workshop direct-model loading is not connected.');
  require('animations',true,'Workshop animation assignments are not connected.');
  require('equipmentFits',draft.inventoryItems?.some(i=>['main-hand','off-hand'].includes(i.location)), 'Workshop equipment fits are not connected.');
  require('handPose',!!draft.equipment.primaryHandPose,'Authored hand pose is not connected.');
  require('stats',true,'Workshop combat statistics are not connected.');
  require('behavior',true,'Workshop behavior preferences are not connected.');
  require('naturalAttacks',draft.creature.attacks.length,'Natural attack routines are not connected.');
  require('spells',draft.creature.spells.length,'Authored spell uses are not connected.');
  require('racialTraits',draft.raceId==='elf','Racial combat traits are not connected.');
  require('traits',draft.creature.traits.length,'Authored traits need registered combat handlers.');
  require('magicResistance',draft.creature.combat.magicResistance>0,'Magic resistance is not connected.');
  require('specialMovement',['fly','swim','climb','burrow'].some(k=>draft.creature.body[k]>0),'Special movement is not connected.');
  require('footprint',draft.creature.body.footprint!==1,'Multi-hex creature footprint is not connected.');
  try{workshopCombatInventory(draft);}catch(error){reasons.push(error.message);}
  return {ready:reasons.length===0,reasons:[...new Set(reasons)]};
}
