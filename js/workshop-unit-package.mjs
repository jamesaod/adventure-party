import {validateWorkshopProject} from './mob-workshop-project.mjs';
import {readiness} from './mob-workshop-core.mjs';
export const PACKAGE_SCHEMA='adventure-party.workshop-unit';
export function isWorkshopUnit(value){return value?.schema===PACKAGE_SCHEMA;}
export function createWorkshopUnit(project,{id,modelFile,sha256}={}){
 const {draft}=validateWorkshopProject(project);
 const missing=readiness(draft).filter(c=>!c.ok);
 if(missing.length)throw Error(missing.map(c=>c.label).join('\n'));
 if(!/^[a-z0-9][a-z0-9-]{1,79}$/.test(id||''))throw Error('Use a stable lowercase unit ID.');
 if(!/^[a-f0-9]{64}$/.test(sha256||'')||modelFile!==`assets/workshop-units/${id}/${sha256}.glb`)throw Error('Invalid published model reference.');
 return {schema:PACKAGE_SCHEMA,version:1,id,name:draft.name,draft,model:{file:modelFile,sha256},mob:{encounterEnabled:true,revision:1}};
}
export function validateWorkshopUnit(pack){
 if(!isWorkshopUnit(pack)||pack.version!==1)throw Error('Unsupported Workshop unit package.');
 // The actual model bytes are checked by the publisher; runtime validates the
 // same authored payload and verifies the fetched model's hash before loading.
 const rebuilt=createWorkshopUnit({draft:pack.draft,files:{'model.bin':new ArrayBuffer(1)}},{id:pack.id,modelFile:pack.model?.file,sha256:pack.model?.sha256});
 return {...rebuilt,mob:{...rebuilt.mob,encounterEnabled:pack.mob?.encounterEnabled!==false}};
}
