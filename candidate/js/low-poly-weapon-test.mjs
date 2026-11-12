import {ITEM_CATALOG} from './item-catalog.mjs';
// Opt-in test inventory; production parties and saved loadouts are untouched.
export function addWeaponTestInventory(unit){
 const inventory=unit.inventory ||= [];
 for(const item of Object.values(ITEM_CATALOG)){
  if(item.category!=='weapon'||item.appearance?.presetRevision!==100)continue;
  if(inventory.some(i=>i.catalogItemId===item.id))continue;
  inventory.push({...structuredClone(item.rules),encumbrance:0,name:item.name,type:'Weapon',slot:'weapon',qty:1,equippable:true,equipped:false,catalogItemId:item.id,appearanceId:item.appearance.appearanceId,weaponPoseProfileId:item.appearance.poseProfileId,detail:'Weightless sample for the local weapon test.'});
 }
 return unit;
}
if(typeof window!=='undefined'&&new URLSearchParams(location.search).has('weaponTest')){
 const make=window.makeFighter;
 window.makeFighter=function(...args){return addWeaponTestInventory(make.apply(this,args));};
 const button=document.createElement('button');button.textContent='Prepare weapon test (authoring)';button.style.cssText='position:fixed;top:4px;right:4px;z-index:10000';document.body.append(button);
 button.onclick=async()=>{
  button.disabled=true;
  try{
   const {appearanceRecipeForMob}=await import('./mob-appearance.mjs');
   const {loadCombatPoseRecipe}=await import('./combat-pose-recipe.mjs');
   const {requestPreparedAsset}=await import('./combat-prepared-store.mjs');
   const {preparedAssetKey}=await import('./combat-prepared-assets.mjs');
   const source=typeof game!=='undefined'&&game?.player||make();
   const unit=structuredClone(source);addWeaponTestInventory(unit);
   const captured=unit.repositoryMobId?window.adventurePartyRepositoryMobs.recipe(unit):await loadCombatPoseRecipe({mobType:unit.type});
   const context={...window.humanoidRuntimeModel(unit),...captured.model,poseProfile:captured.poseProfile,renderSettings:{...captured.renderSettings,renderer:'supersampled-battlefield-v2'}};
   let count=0;
   for(const item of unit.inventory.filter(i=>ITEM_CATALOG[i.catalogItemId]?.appearance?.presetRevision===100)){
    for(const i of unit.inventory)if(i.slot==='weapon'||i.slot==='shield')i.equipped=false;
    item.equipped=true;
    const shield=unit.inventory.find(i=>i.slot==='shield');
    for(const useShield of (shield&&ITEM_CATALOG[item.catalogItemId].rules.handsRequired===1?[false,true]:[false])){
     if(shield)shield.equipped=useShield;
     const recipe=appearanceRecipeForMob(unit,context);await requestPreparedAsset(preparedAssetKey(recipe),recipe);count++;
    }
   }
   button.textContent=`${count} queued — opening authoring builder`;location.href='weapon-preparation.html';
  }catch(error){button.textContent=error.message;button.disabled=false;console.error(error);}
 };
}
