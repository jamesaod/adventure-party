import { createUnitPackage } from './unit-package.mjs';
import { spriteSetSlug } from './sprite-set-core.mjs?v=R238C153';
import { itemCatalogEntry, ITEM_CATALOG } from './item-catalog.mjs?v=R238C146';

// Bundle references to existing assets; each capture retains its own loadout,
// stable animation source ID and time instead of borrowing the last UI state.
export function buildStudioUnitExport({name,settings,profiles}){
  const spriteSets={},equipment=new Map();
  for(const {id,manifest} of profiles){
    const poses=structuredClone(manifest.poses);
    for(const pose of Object.values(poses)){
      const render=pose.render||manifest.render||{};
      for(const [slot,key,itemKey] of [['primary','equipment','rightHand'],['off-hand','offHandEquipment','rightHand'],['shield','shield','leftHandShield']]){
        const mount=render[key],studioId=mount?.[itemKey];
        if(!studioId||studioId==='none')continue;
        const item=Object.values(ITEM_CATALOG).find(item=>item.appearance?.studioId===studioId)||itemCatalogEntry(studioId);
        if(item)equipment.set(slot+':'+item.id,{itemId:item.id,slot});
      }
    }
    spriteSets[id]={manifest:`profiles/${id}/manifest.json`,poses};
  }
  return createUnitPackage({
    id:spriteSetSlug(name),name,
    modelId:settings.libraryModelId||spriteSetSlug(settings.modelName||name),
    character:settings.unitPackage?.character||{},
    actionProfiles:Object.keys(spriteSets),equipment:[...equipment.values()],
    mob:{...(settings.unitPackage?.mob||{}),type:settings.mobType||null},
    references:{...(settings.unitPackage?.references||{}),spriteSets}
  });
}
