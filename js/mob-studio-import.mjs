import {validateUnitPackage} from './unit-package.mjs';
import {createMobDefinition,normalizeMobDefinition} from './mob-definition.mjs?v=R238C196';
import {normalizePoseLibrary} from './pose-library.mjs?v=R238C196';
import {unzipSync,strFromU8} from '../assets/vendor/three/addons/libs/fflate.module.js';
export function mobFromStudioPackage(value){
 validateUnitPackage(value);
 if(value.mob?.authoringVersion===1)return normalizeMobDefinition(value);
 const appearance=value.references?.studioAppearance;
 if(!appearance||appearance.version!==1||appearance.modelId!==value.modelId||!Number.isFinite(appearance.modelScalePercent)||appearance.modelScalePercent<=0||!Number.isFinite(appearance.hexScalePercent)||appearance.hexScalePercent<=0)throw Error('This package lacks Studio appearance settings. Export a new Complete Capture ZIP from Studio.');
 const library=normalizePoseLibrary(value.references?.poseLibrary);
 return createMobDefinition({id:value.id,name:value.name,modelId:value.modelId,library,size:appearance.size,footprint:appearance.footprint,weaponTypes:value.actionProfiles.length?value.actionProfiles:['unarmed'],character:value.character,abilities:value.character.abilities,rules:value.character.rules,equipment:value.equipment,attachments:value.attachments,references:value.references});
}
export async function readMobImport(file){
 if(!file)throw Error('Choose a Studio ZIP or JSON file.');
 if(/\.zip$/i.test(file.name)){
  if(file.size>512*1024*1024)throw Error('Choose a ZIP smaller than 512 MB.');
  const files=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:entry=>entry.name==='unit-package.json'&&entry.originalSize<=2*1024*1024});
  if(!files['unit-package.json'])throw Error('The ZIP must contain unit-package.json at its root (maximum 2 MB).');
  return JSON.parse(strFromU8(files['unit-package.json']));
 }
 if(file.size>2*1024*1024)throw Error('Choose a JSON file smaller than 2 MB.');
 return JSON.parse(await file.text());
}
