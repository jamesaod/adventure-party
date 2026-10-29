import {resolveEquipmentLibrary,emptyEquipmentLibrary,EFFECT_OPTIONS} from './equipment-library-core.mjs?v=R238C201';
import {readEquipmentLibrary,saveEquipmentLibrary} from './equipment-library-store.mjs?v=R238C201';
import {ITEM_CATALOG as BASE} from './item-catalog.mjs?v=R238C201';
import {offHandItems} from './mob-generation.mjs?v=R238C201';
import {ACTION_PROFILE_CATALOG} from './action-profile-catalog.mjs?v=R238C196';
const $=id=>document.getElementById(id),clone=v=>structuredClone(v);
let library,catalog,selected,record,dirty=false,effects=[];
const message=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('error',error);};
const attempt=fn=>async event=>{try{await fn(event);}catch(error){message(error.message,true);}};
const modelItems=[...new Map(Object.values(BASE).filter(i=>i.appearance).map(i=>[i.appearance.studioId,i])).values()];
const fields=[
 ['name','Name','text'],['category','Category',['weapon','shield','armor','item']],['slot','Equipment slot',['weapon','shield','armor','inventory']],
 ['description','Description / history','textarea'],['unique','Unique item','checkbox'],['enchanted','Enchanted item','checkbox'],['questId','Quest reference','text'],
 ['appearance','Model',[['none','No model'],...modelItems.map(i=>[i.appearance.studioId,i.appearance.studioId==='medieval-sword'?'Long Sword':i.name])]],
 ['rules.catalogWeaponId','Engine weapon rule ID','text'],['rules.catalogArmorId','Engine armor rule ID','text'],['rules.baseArmorClass','Base armor class','number'],['rules.acBonus','Shield AC bonus','number'],['rules.poseProfileId','Weapon pose type',[['','Unspecified'],...[...ACTION_PROFILE_CATALOG.values()].filter(i=>i.id!=='spell-casting').map(i=>[i.id,i.label])]],
 ['rules.handsRequired','Hands required',[['1','One'],['2','Two']]],['rules.offHandAllowed','Allowed in off hand','checkbox'],
 ['rules.damageSM','Damage vs small / medium','text'],['rules.damageL','Damage vs large','text'],['rules.cost','Cost','text'],['rules.encumbrance','Weight','number'],
 ['rules.magicHitBonus','Magic attack bonus','number'],['rules.magicDamageBonus','Magic damage bonus','number'],['rules.bonusDamageExpression','Bonus damage dice','text'],['rules.bonusDamageType','Bonus damage type','text']
];
const get=(value,path)=>path.split('.').reduce((v,k)=>v?.[k],value);
function set(value,path,data){const keys=path.split('.'),last=keys.pop();let target=value;for(const k of keys)target=target[k]??={};target[last]=data;}
function control(type,value,label){const el=document.createElement(type==='textarea'?'textarea':Array.isArray(type)?'select':'input');el.setAttribute('aria-label',label);if(Array.isArray(type)){el.replaceChildren(...type.map(v=>new Option(Array.isArray(v)?v[1]:v,Array.isArray(v)?v[0]:v)));el.value=String(value??'');}else if(type==='checkbox'){el.type='checkbox';el.checked=value===true;}else{if(type!=='textarea')el.type=type;el.value=value??'';if(type==='number')el.step='any';}return el;}
function table(){
 const query=$('search').value.toLowerCase();$('items').replaceChildren();
 for(const item of Object.values(catalog).sort((a,b)=>a.name.localeCompare(b.name)).filter(i=>(i.name+' '+i.id).toLowerCase().includes(query))){
  const row=document.createElement('tr');row.classList.toggle('selected',item.id===selected);const name=document.createElement('td'),button=document.createElement('button');button.textContent=item.name;button.setAttribute('aria-pressed',String(item.id===selected));button.onclick=attempt(()=>{guard();open(item.id);});name.append(button);row.append(name);for(const text of [item.category,item.appearance?'Linked':'None']){const td=document.createElement('td');td.textContent=text;row.append(td);}$('items').append(row);
 }
}
function guard(){if(dirty)throw Error('Save your current edits before switching items or importing.');}
function values(){
 const overrides=clone(record.overrides);
 for(const [path,,type] of fields){const row=$('fields').querySelector(`[data-path="${path}"]`);if(!row.querySelector('.override').checked){const keys=path.split('.');if(keys.length===1)delete overrides[path];else if(overrides[keys[0]])delete overrides[keys[0]][keys[1]];continue;}
  const input=row.querySelector('.value');let v=type==='checkbox'?input.checked:type==='number'?Number(input.value):input.value;
  if(path==='rules.handsRequired')v=Number(v);
  if(path==='appearance')v=v==='none'?null:clone(modelItems.find(i=>i.appearance.studioId===v).appearance);
  set(overrides,path,v);
 }
 if($('overrideEffects').checked)overrides.effects=clone(effects);else delete overrides.effects;
 return {id:$('itemId').value.trim(),parentId:$('parent').value||null,overrides};
}
function renderFields(){
 let inherited=record.parentId?catalog[record.parentId]:resolveEquipmentLibrary()[record.id];
 inherited=inherited||{name:'New item',category:'weapon',slot:'weapon',appearance:null,rules:{handsRequired:1}};
 $('fields').replaceChildren();
 for(const [path,label,type] of fields){
  const override=get(record.overrides,path)!==undefined;let value=override?get(record.overrides,path):get(inherited,path);
  if(path==='appearance')value=value?.studioId||'none';
  if(path==='rules.handsRequired')value??=inherited.appearance?.handsRequired||1;
  if(path==='rules.offHandAllowed')value??=offHandItems(catalog).some(i=>i.id===inherited.id);
  if(path==='rules.poseProfileId')value??=inherited.appearance?.poseProfileId||'';
  const row=document.createElement('div');row.className='field-row';row.dataset.path=path;const toggle=document.createElement('label');toggle.className='inline';const check=control('checkbox',override,'Override '+label);check.className='override';toggle.append(check,document.createTextNode('Override'));const wrap=document.createElement('label');wrap.append(document.createTextNode(label));const input=control(type,value,label);input.classList.add('value');input.disabled=!override;wrap.append(input);check.onchange=()=>{input.disabled=!check.checked;dirty=true;};row.append(toggle,wrap);$('fields').append(row);
 }
 effects=clone(record.overrides.effects??inherited.effects??[]);$('overrideEffects').checked=record.overrides.effects!==undefined;renderEffects();
}
function renderEffects(){
 $('effects').replaceChildren();$('addEffect').disabled=!$('overrideEffects').checked;
 effects.forEach((effect,index)=>{const row=document.createElement('fieldset');row.className='effect-row';row.disabled=!$('overrideEffects').checked;const legend=document.createElement('legend');legend.textContent='Effect '+(index+1)+' · definition only';row.append(legend);const grid=document.createElement('div');grid.className='fields';
  for(const [key,label,type] of [['recipient','Recipient',EFFECT_OPTIONS.recipient],['trigger','Trigger',EFFECT_OPTIONS.trigger],['kind','Effect',EFFECT_OPTIONS.kind],['parameter','Stat / condition / damage type','text'],['value','Amount / dice expression','text'],['chance','Chance (%)','number'],['rounds','Duration (rounds; 0 = equipped / instant)','number'],['save','Saving throw negates',EFFECT_OPTIONS.save],['stacking','Stacking',EFFECT_OPTIONS.stacking],['maxStacks','Maximum stacks','number']]){const wrap=document.createElement('label');wrap.textContent=label;const input=control(type,effect[key],`Effect ${index+1} ${label}`);input.oninput=()=>{effect[key]=type==='number'?Number(input.value):input.value;dirty=true;};wrap.append(input);grid.append(wrap);}const remove=document.createElement('button');remove.type='button';remove.textContent='Remove effect';remove.onclick=()=>{effects.splice(index,1);dirty=true;renderEffects();};row.append(grid,remove);$('effects').append(row);
 });
}
function open(id,newRecord){selected=id;record=clone(newRecord||library.items.find(i=>i.id===id)||{id,overrides:{}});$('heading').textContent=newRecord?'New item / variant':catalog[id].name;$('itemId').value=record.id;$('itemId').disabled=!newRecord;$('parent').replaceChildren(new Option('No base item',''),...Object.values(catalog).filter(i=>i.id!==id).map(i=>new Option(i.name,i.id)));$('parent').value=record.parentId||'';renderFields();dirty=false;table();}
function commit(next){const resolved=resolveEquipmentLibrary(next);saveEquipmentLibrary(next);library=next;catalog=resolved;dirty=false;}
function download(){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(library,null,2)],{type:'application/json'}));a.href=url;a.download='equipment-library.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function start(){
 library=readEquipmentLibrary();catalog=resolveEquipmentLibrary(library);open('long-sword');
 $('search').oninput=table;$('editor').oninput=()=>{dirty=true;};$('editor').onsubmit=attempt(event=>{event.preventDefault();const entry=values();if(!selected&&catalog[entry.id])throw Error('That item ID already exists.');const next={...library,items:[...library.items.filter(i=>i.id!==entry.id),entry]};commit(next);open(entry.id);message('Saved '+catalog[entry.id].name+'. Open or reload MOB Creator to select it. MOB exports carry the item definition.');});
 $('parent').onchange=attempt(()=>{record=values();record.parentId=$('parent').value||null;renderFields();dirty=true;});
 $('newItem').onclick=attempt(()=>{guard();open(null,{id:'',overrides:{name:'New item',category:'item',slot:'inventory',appearance:null,rules:{handsRequired:1}}});dirty=true;});
 $('variant').onclick=attempt(()=>{guard();if(!selected)throw Error('Select a base item first.');open(null,{id:'',parentId:selected,overrides:{name:catalog[selected].name+' Variant'}});dirty=true;});
 $('overrideEffects').onchange=()=>{dirty=true;renderEffects();};$('addEffect').onclick=()=>{effects.push({recipient:'wielder',trigger:'while-equipped',kind:'stat-modifier',parameter:'',value:'',chance:100,rounds:0,save:'none',stacking:'refresh',maxStacks:1});dirty=true;renderEffects();};
 $('reset').onclick=attempt(()=>{if(!selected){open('long-sword');return;}const next={...library,items:library.items.filter(i=>i.id!==selected)};if(next.items.some(i=>i.parentId===selected)&&!resolveEquipmentLibrary()[selected])throw Error('Other variants depend on this item. Change their base first.');commit(next);open(catalog[selected]?selected:'long-sword');message('Draft removed / repository defaults restored. Existing exported MOBs retain their pinned definitions.');});
 $('exportLibrary').onclick=attempt(()=>{guard();download();message('Exported browser overrides and variants. Send this file for repository integration.');});$('importLibrary').onclick=attempt(()=>{guard();$('file').value='';$('file').click();});
 $('file').onchange=attempt(async()=>{const file=$('file').files[0];if(!file)return;if(file.size>2*1024*1024)throw Error('Choose a file smaller than 2 MB.');const incoming=JSON.parse(await file.text());resolveEquipmentLibrary(incoming);const rows=new Map(library.items.map(i=>[i.id,i]));for(const item of incoming.items){if(rows.has(item.id)&&JSON.stringify(rows.get(item.id))!==JSON.stringify(item))throw Error('Conflicting item ID: '+item.id+'. Existing edits were preserved.');rows.set(item.id,item);}commit({...library,items:[...rows.values()]});open(incoming.items[0]?.id||'long-sword');message('Library imported. Matching IDs were deduplicated.');});
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
}
try{start();}catch(error){message('Equipment library could not load: '+error.message,true);$('editor').hidden=true;}
