import {browserAuthoringStore} from './authoring-store.mjs?v=R238C202';
import {normalizeMobDefinition,mobReadiness} from './mob-definition.mjs?v=R238C202';
import {normalizeGeneration} from './mob-generation.mjs?v=R238C202';
import {resolveEquipmentLibrary} from './equipment-library-core.mjs?v=R238C202';
export function encounterReadiness(mob,catalog){
 const reasons=[];
 try{mob=normalizeMobDefinition(mob);const appearance=mob.references.studioAppearance||mob.references.poseLibrary.studioAppearance;
 if(!catalog.models.some(m=>m.id===mob.modelId))reasons.push('Model is unavailable.');
 if(!appearance||appearance.modelId!==mob.modelId)reasons.push('Link the model and footprint from Studio.');
 const coverage=mobReadiness(mob);if(coverage.missing.length)reasons.push(`${coverage.missing.length} required poses have no assigned frame or allowed fallback.`);
 normalizeGeneration(mob.mob.generation,{complete:true,catalog:resolveEquipmentLibrary(mob.references.equipmentLibrary)});
 }catch(error){reasons.push(error.message);}
 return {ready:reasons.length===0,reasons};
}
export function createMobLibrary(store,seeds,catalog){
 function records(){const local=store.mobs(),deleted=new Set(store.deletedMobIds());return [...seeds.filter(m=>!local.some(l=>l.id===m.id)),...local].filter(m=>!deleted.has(m.id)).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).map(mob=>({mob,origin:local.some(m=>m.id===mob.id)?(seeds.some(m=>m.id===mob.id)?'Local changes to published MOB':'Browser MOB'):'Published MOB',...encounterReadiness(mob,catalog)}));}
 return {records,get:id=>records().find(r=>r.mob.id===id)?.mob||null,save:mob=>{if(mob.mob.encounterEnabled){const ready=encounterReadiness(mob,catalog);if(!ready.ready)throw Error(ready.reasons.join(' '));}return store.saveMob(mob);},delete:mob=>store.deleteMob(mob.id,mob.mob.revision),restore:mob=>store.restoreMob(mob),available:()=>records().filter(r=>r.mob.mob.encounterEnabled&&r.ready).map(r=>r.mob)};
}
export async function loadMobLibrary(){
 const get=async path=>{const res=await fetch(new URL('../'+path,import.meta.url),{cache:'no-cache'});if(!res.ok)throw Error('Could not load '+path);return res.json();};
 const [manifest,catalog]=await Promise.all([get('data/mob-library.json'),get('data/studio-models.json')]);
 const seeds=await Promise.all(manifest.mobs.map(async item=>{const mob=await get(item.file);mob.mob.encounterEnabled=mob.mob.encounterEnabled??true;return normalizeMobDefinition(mob);}));
 return {library:createMobLibrary(browserAuthoringStore(),seeds,catalog),catalog,manifest};
}
