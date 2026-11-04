import {ITEM_CATALOG as BASE} from './item-catalog.mjs?v=R238C204';

export const LIBRARY_SCHEMA='adventure-party.equipment-library';
const clone=value=>structuredClone(value);
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
function merge(base,patch){
 const result=clone(base||{});
 for(const [key,value] of Object.entries(patch||{})){
  if(['__proto__','prototype','constructor'].includes(key))throw Error('Invalid property.');
  result[key]=object(value)?merge(object(result[key])?result[key]:{},value):clone(value);
 }
 return result;
}
export const EFFECT_OPTIONS={recipient:['wielder','target'],trigger:['while-equipped','on-hit','on-critical-hit','on-use'],kind:['stat-modifier','condition','damage','healing'],stacking:['replace','refresh','stack'],save:['none','spell','poison','paralyzation','breath','rod-staff-wand','petrification']};
function validateEffect(effect){
 for(const [key,choices] of Object.entries(EFFECT_OPTIONS))if(!choices.includes(effect[key]))throw Error('Invalid effect '+key+'.');
 if(typeof effect.parameter!=='string'||!effect.parameter.trim()||effect.parameter.length>100)throw Error('An effect needs a stat, condition or damage type.');
 if(typeof effect.value!=='string'||!effect.value.trim()||effect.value.length>80)throw Error('An effect needs a value or dice expression.');
 if(!Number.isFinite(effect.chance)||effect.chance<0||effect.chance>100)throw Error('Effect chance must be 0–100%.');
 if(!Number.isInteger(effect.rounds)||effect.rounds<0||effect.rounds>10000)throw Error('Effect duration must be 0–10000 rounds (0 = while equipped / instant).');
 if(!Number.isInteger(effect.maxStacks)||effect.maxStacks<1||effect.maxStacks>100)throw Error('Effect stack limit must be 1–100.');
}
export function resolveEquipmentLibrary(document={schema:LIBRARY_SCHEMA,version:1,items:[]}){
 if(document?.schema!==LIBRARY_SCHEMA||document.version!==1||!Array.isArray(document.items)||document.items.length>1000)throw Error('Choose an Equipment Library v1 JSON file.');
 const definitions=new Map();
 for(const entry of document.items){
  if(!/^[a-z0-9][a-z0-9-]{0,99}$/.test(entry.id||'')||definitions.has(entry.id))throw Error('Invalid or duplicate equipment ID: '+entry.id);
  if(!object(entry.overrides))throw Error('Item overrides must be an object.');
  definitions.set(entry.id,entry);
 }
 const catalog=clone(BASE),visiting=new Set(),done=new Set();
 // A plain base sword is distinct from the existing enchanted combat item.
 catalog['long-sword']={...clone(BASE['flaming-sword-5']),id:'long-sword',name:'Long Sword',rules:{...clone(BASE['flaming-sword-5'].rules),magicHitBonus:0,magicDamageBonus:0,bonusDamageExpression:'',bonusDamageType:''}};
 function resolve(id){
  if(done.has(id))return catalog[id];
  const record=definitions.get(id);
  if(!record){if(!catalog[id])throw Error('Missing base item: '+id);return catalog[id];}
  if(visiting.has(id))throw Error('Equipment inheritance cycle: '+id);
  visiting.add(id);
  const base=record.parentId?resolve(record.parentId):catalog[id]||{category:'weapon',slot:'weapon',rules:{handsRequired:1},appearance:null};
  const item=merge(base,record.overrides);item.id=id;item.parentId=record.parentId||null;
  if(typeof item.name!=='string'||!item.name.trim()||item.name.length>160)throw Error('Enter an item name (maximum 160 characters).');
  if(!['weapon','shield','armor','item'].includes(item.category))throw Error('Invalid equipment category.');
  if(!['weapon','shield','armor','inventory'].includes(item.slot))throw Error('Invalid equipment slot.');
  if(item.unique!==undefined&&typeof item.unique!=='boolean'||item.enchanted!==undefined&&typeof item.enchanted!=='boolean')throw Error('Item flags must be boolean.');
  if(!object(item.rules))throw Error('Item rules must be an object.');
  if(item.rules.handsRequired!==undefined&&![1,2].includes(item.rules.handsRequired))throw Error('Hands required must be 1 or 2.');
  for(const key of ['magicHitBonus','magicDamageBonus'])if(item.rules[key]!==undefined&&(!Number.isFinite(item.rules[key])||Math.abs(item.rules[key])>20))throw Error('Magic bonuses must be between -20 and 20.');
  if(item.appearance!==null&&item.appearance!==undefined&&(!object(item.appearance)||!Object.values(BASE).some(i=>i.appearance?.studioId===item.appearance.studioId)))throw Error('Choose an existing equipment model or No model.');
  if(!Array.isArray(item.effects||[])||(item.effects||[]).length>100)throw Error('Invalid effects list.');
  for(const effect of item.effects||[])validateEffect(effect);
  catalog[id]=item;visiting.delete(id);done.add(id);return item;
 }
 for(const id of definitions.keys())resolve(id);
 for(const item of Object.values(catalog)){item.enchanted??=Boolean(item.rules?.magicHitBonus||item.rules?.magicDamageBonus||item.rules?.bonusDamageExpression);item.unique??=false;}
 return catalog;
}
export function equipmentSnapshot(document,ids){
 const definitions=new Map(document.items.map(i=>[i.id,i])),selected=new Map();
 function add(id){const row=definitions.get(id);if(!row||selected.has(id))return;selected.set(id,row);if(row.parentId)add(row.parentId);}
 ids.forEach(add);
 return {schema:LIBRARY_SCHEMA,version:1,items:clone([...selected.values()])};
}
export const emptyEquipmentLibrary=()=>({schema:LIBRARY_SCHEMA,version:1,items:[]});
