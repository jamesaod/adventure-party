import {recoveryPoseReference} from './studio-capture-export.mjs?v=R238C196';
import {captureGroupPath,isSharedCaptureGroup} from './action-capture-groups.mjs?v=R238C196';
import {POSE_FALLBACKS} from './pose-fallbacks.mjs?v=R238C176';
import {normalizePoseLibrary} from './pose-library.mjs?v=R238C196';
import { createUnitPackage } from './unit-package.mjs';
import { spriteSetSlug } from './sprite-set-core.mjs?v=R238C196';
import { itemCatalogEntry, ITEM_CATALOG } from './item-catalog.mjs?v=R238C198';

// Bundle references to existing assets; each capture retains its own loadout,
// stable animation source ID and time instead of borrowing the last UI state.
export function buildStudioUnitExport({name,settings,profiles,recovery=[]}){
  const spriteSets={},sharedActionGroups={},equipment=new Map((settings.unitPackage?.equipment||[]).map(item=>[(item.slot||'primary')+':'+item.itemId,structuredClone(item)]));
  for(const {id,manifest} of [...profiles,...recovery]){
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
    if(profiles.some(profile=>profile.manifest===manifest))(isSharedCaptureGroup(id)?sharedActionGroups:spriteSets)[id]={manifest:`${captureGroupPath(id)}/manifest.json`,poses};
  }
  for(const value of Object.values(spriteSets))value.sharedActionGroups=Object.keys(sharedActionGroups);
  return createUnitPackage({
    id:settings.unitPackage?.id||spriteSetSlug(name),name:settings.unitPackage?.name||name,
    modelId:settings.libraryModelId||spriteSetSlug(settings.modelName||name),
    character:settings.unitPackage?.character||{},
    attachments:settings.unitPackage?.attachments||null,
    actionProfiles:[...new Set([...(settings.unitPackage?.actionProfiles||[]),...Object.keys(spriteSets),...recovery.filter(record=>!isSharedCaptureGroup(record.id)).map(record=>record.id)])],equipment:[...equipment.values()],
    mob:{...(settings.unitPackage?.mob||{}),type:settings.mobType||null},
    references:{...(settings.unitPackage?.references||{}),...(settings.poseLibrary?{poseLibrary:normalizePoseLibrary(settings.poseLibrary)}:{}),studioAppearance:{version:1,modelId:settings.libraryModelId||spriteSetSlug(settings.modelName||name),modelScalePercent:settings.modelScalePercent??100,hexScalePercent:settings.hexScalePercent??100,footprint:settings.layoutId||settings.layout?.id||'single',size:settings.poseLibrary?.size||'medium'},captureFormatVersion:2,poseFallbacks:POSE_FALLBACKS,spriteSets,sharedActionGroups,
      captureRecovery:recovery.map(recoveryPoseReference)}
  });
}
