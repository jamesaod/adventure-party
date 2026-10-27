import {captureGroupPath,isSharedCaptureGroup} from './action-capture-groups.mjs?v=R238C172';
import {normalizePoseLibrary} from './pose-library.mjs?v=R238C172';
import { createUnitPackage } from './unit-package.mjs';
import { spriteSetSlug } from './sprite-set-core.mjs?v=R238C153';
import { itemCatalogEntry, ITEM_CATALOG } from './item-catalog.mjs?v=R238C146';

// Bundle references to existing assets; each capture retains its own loadout,
// stable animation source ID and time instead of borrowing the last UI state.
export function buildStudioUnitExport({name,settings,profiles}){
  const spriteSets={},sharedActionGroups={},equipment=new Map((settings.unitPackage?.equipment||[]).map(item=>[(item.slot||'primary')+':'+item.itemId,structuredClone(item)]));
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
    (isSharedCaptureGroup(id)?sharedActionGroups:spriteSets)[id]={manifest:`${captureGroupPath(id)}/manifest.json`,poses};
  }
  for(const value of Object.values(spriteSets))value.sharedActionGroups=Object.keys(sharedActionGroups);
  return createUnitPackage({
    id:settings.unitPackage?.id||spriteSetSlug(name),name:settings.unitPackage?.name||name,
    modelId:settings.libraryModelId||spriteSetSlug(settings.modelName||name),
    character:settings.unitPackage?.character||{},
    attachments:settings.unitPackage?.attachments||null,
    actionProfiles:[...new Set([...(settings.unitPackage?.actionProfiles||[]),...Object.keys(spriteSets)])],equipment:[...equipment.values()],
    mob:{...(settings.unitPackage?.mob||{}),type:settings.mobType||null},
    references:{...(settings.unitPackage?.references||{}),...(settings.poseLibrary?{poseLibrary:normalizePoseLibrary(settings.poseLibrary)}:{}),captureFormatVersion:2,spriteSets,sharedActionGroups}
  });
}
