import {ITEM_CATALOG} from './item-catalog.mjs?v=R238C176';
export const MOB_CLASSES=Object.freeze([{id:'none',name:'No character class'},...['fighter','mage','cleric','thief','ranger'].map(id=>({id,name:id[0].toUpperCase()+id.slice(1)}))]);
const offHands=new Set(['medieval-sword','battle-axe','short-sword','dagger']);
export const primaryItems=()=>Object.values(ITEM_CATALOG).filter(i=>i.category==='weapon');
export const offHandItems=()=>Object.values(ITEM_CATALOG).filter(i=>i.category==='shield'||i.category==='weapon'&&offHands.has(i.appearance?.studioId));
export const needsBothHands=id=>(ITEM_CATALOG[id]?.appearance?.handsRequired||ITEM_CATALOG[id]?.rules?.handsRequired||1)===2;
const integer=(v,min,max,label)=>{if(!Number.isInteger(v)||v<min||v>max)throw Error(`Invalid ${label}.`);return v;};
const item=(id,choices,label)=>{if(id!=='none'&&!choices.some(i=>i.id===id))throw Error(`Invalid ${label} item.`);return id;};
const classLevel=value=>{if(!MOB_CLASSES.some(c=>c.id===value?.classId))throw Error('Choose a supported character class.');return {classId:value.classId,level:value.classId==='none'?1:integer(value.level,1,20,'class level')};};
export function distribution(rows,normalize,label,{complete=false}={}){
 if(!Array.isArray(rows)||rows.length>100)throw Error(`Invalid ${label} distribution.`);
 const seen=new Set();let total=0;
 const result=rows.map(row=>{const choice=normalize(row),key=JSON.stringify(choice);if(seen.has(key))throw Error(`Duplicate ${label} choice.`);seen.add(key);if(!Number.isFinite(row.weight)||row.weight<0||row.weight>100)throw Error(`Invalid ${label} probability.`);total+=row.weight;return {...choice,weight:row.weight};});
 if(total>100.000001)throw Error(`${label} probabilities exceed 100%.`);
 if(complete&&Math.abs(total-100)>.000001)throw Error(`${label} probabilities must total 100% before generation (currently ${total}%).`);
 return result;
}
export function normalizeGeneration(value,{complete=false}={}){
 if(!value||value.version!==1||!['unique','template'].includes(value.kind))throw Error('Choose Unique or Template MOB.');
 const alwaysItems=(value.alwaysItems||[]).map(row=>{if(!ITEM_CATALOG[row.itemId])throw Error('Unknown Always has item.');return {itemId:row.itemId,quantity:integer(row.quantity,1,999,'item quantity')};});
 if(new Set(alwaysItems.map(i=>i.itemId)).size!==alwaysItems.length)throw Error('Duplicate Always has item; use its quantity.');
 const base={version:1,kind:value.kind,alwaysItems};
 if(value.kind==='unique'){
  const fixed={...classLevel(value.fixed),primary:item(value.fixed?.primary,primaryItems(),'primary'),offHand:item(value.fixed?.offHand,offHandItems(),'off-hand')};
  if(needsBothHands(fixed.primary)&&fixed.offHand!=='none')throw Error('Two-handed weapons require an empty off hand.');return {...base,fixed};
 }
 return {...base,classLevels:distribution(value.classLevels,classLevel,'Class/level',{complete}),primary:distribution(value.primary,r=>({itemId:item(r.itemId,primaryItems(),'primary')}),'Primary weapon',{complete}),offHand:distribution(value.offHand,r=>({itemId:item(r.itemId,offHandItems(),'off-hand')}),'Off hand',{complete})};
}
export function defaultGeneration(character={},equipment=[]){return {version:1,kind:'unique',fixed:{classId:MOB_CLASSES.some(c=>c.id===character.classId)?character.classId:'none',level:character.level||1,primary:equipment.find(i=>i.slot==='primary')?.itemId||'none',offHand:equipment.find(i=>['off-hand','shield'].includes(i.slot))?.itemId||'none'},alwaysItems:equipment.filter(i=>!['primary','off-hand','shield'].includes(i.slot)&&ITEM_CATALOG[i.itemId]).map(i=>({itemId:i.itemId,quantity:i.quantity||1}))};}
export function sampleGeneration(value,rng=Math.random){
 const g=normalizeGeneration(value,{complete:true});
 const pick=rows=>{const roll=rng();if(!Number.isFinite(roll)||roll<0||roll>=1)throw Error('Random source must return [0,1).');let threshold=0;for(const row of rows){threshold+=row.weight;if(roll*100<threshold)return row;}throw Error('Incomplete distribution.');};
 const fixed=g.kind==='unique'?g.fixed:{...pick(g.classLevels),primary:pick(g.primary).itemId,offHand:'none'};
 if(g.kind==='template'&&!needsBothHands(fixed.primary))fixed.offHand=pick(g.offHand).itemId;
 const equipment=[...(fixed.primary==='none'?[]:[{itemId:fixed.primary,slot:'primary'}]),...(fixed.offHand==='none'?[]:[{itemId:fixed.offHand,slot:ITEM_CATALOG[fixed.offHand].category==='shield'?'shield':'off-hand'}]),...g.alwaysItems.map(i=>({...i,slot:'inventory'}))];
 return {classId:fixed.classId==='none'?null:fixed.classId,level:fixed.level,equipment,generation:{version:1,kind:'unique',fixed:{classId:fixed.classId,level:fixed.level,primary:fixed.primary,offHand:fixed.offHand},alwaysItems:g.alwaysItems}};
}
export function generationWeaponTypes(g){g=normalizeGeneration(g);const ids=g.kind==='unique'?[g.fixed.primary]:g.primary.filter(r=>r.weight>0).map(r=>r.itemId);const result=new Set(ids.map(id=>id==='none'?'unarmed':ITEM_CATALOG[id].appearance?.poseProfileId).filter(Boolean));const off=g.kind==='unique'?[g.fixed.offHand]:g.offHand.filter(r=>r.weight>0).map(r=>r.itemId);if(off.some(id=>ITEM_CATALOG[id]?.category==='weapon')&&ids.some(id=>id!=='none'&&!needsBothHands(id)))result.add('dual-wield');return [...result];}
