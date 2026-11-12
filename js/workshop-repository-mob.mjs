import {validateWorkshopUnit} from './workshop-unit-package.mjs?v=R238C313';
import {instantiateWorkshopCombat,workshopCombatFits} from './workshop-combat-contract.mjs?v=R238C313';
import {ITEM_CATALOG} from './item-catalog.mjs';
import {normalizeOffHandEquipment} from './studio-equipment.mjs?v=R238C312';

export function createWorkshopRepositoryMob(value){
 const template=validateWorkshopUnit(value),draft=template.draft;
 const model={modelId:template.id,modelUrl:'../'+template.model.file,modelHash:template.model.sha256};
 return {template,
  apply(unit,random=Math.random){
   Object.assign(unit,instantiateWorkshopCombat(draft,{id:unit.id,random}),{
    repositoryMobId:template.id,repositoryMobModel:{...model},
    footprintId:'single',workshopBehavior:structuredClone(draft.creature.behavior)
   });
   return unit;
  },
  recipe(unit){
   const fits=workshopCombatFits(draft,unit.inventory);
   const primary=unit.inventory.find(i=>i.equipped&&i.slot==='weapon'&&i.startingLocation!=='off-hand');
   const off=unit.inventory.find(i=>i.equipped&&i.slot==='weapon'&&i.startingLocation==='off-hand');
   const primaryId=ITEM_CATALOG[primary?.catalogItemId]?.appearance?.studioId||'none';
   const offId=ITEM_CATALOG[off?.catalogItemId]?.appearance?.studioId;
   return {source:'workshop:'+template.id,model:{...model},poseProfile:{id:template.id,version:1,poses:{}},
    renderSettings:{workshopUnit:template,heightInches:unit.heightInches,
     equipment:fits.main||{rightHand:primaryId},offHandEquipment:offId?normalizeOffHandEquipment(fits.off||{rightHand:offId}):undefined,shield:fits.shield,
     modelScalePercent:100,hexScalePercent:100,
     frame:{width:320,height:400,renderWidth:91.56,renderHeight:114.45,anchorX:160,anchorY:264},
     transform:{normalizeRest:true,fitRest:true,placement:{position:[0,0,0],scale:1},heading:0,upAxis:'Y',frameHeight:3.15,center:[0,1,0]}}};
  }
 };
}
