import {workshopCombatConnections} from './workshop-combat-contract.mjs?v=R238C313';
import {ITEM_CATALOG} from './item-catalog.mjs';
import {STUDIO_OFF_HAND_WEAPONS} from './studio-equipment.mjs?v=R238C312';
// Advertise only consumers implemented in the actual combat runtime.
export function workshopRuntimeSupport(draft){
 const report=workshopCombatConnections(draft,{publication:true,directModels:true,animations:true,stats:true,equipmentFits:true,handPose:true,behavior:true,racialTraits:true});
 const b=draft.creature.behavior;
 for(const row of draft.inventoryItems||[]){
  const item=ITEM_CATALOG[row.id];
  if(row.location==='main-hand'&&item?.category==='shield')report.reasons.push('Right-hand shields need a combat attachment handler.');
  if(row.location==='off-hand'&&item?.category==='weapon'&&!STUDIO_OFF_HAND_WEAPONS.some(w=>w.id===item.appearance?.studioId))report.reasons.push('No left-hand weapon mount is available for '+item.name+'.');
 }
 if(!['nearest-visible','weakest-visible'].includes(b.target)||!['adaptive','melee','ranged'].includes(b.style)||b.hazard!=='cautious'||!b.memory||!b.retreat||!b.avoidOpportunity)report.reasons.push('Custom Workshop AI policy is not connected; use the default policy for this test.');
 report.ready=report.reasons.length===0;return report;
}
