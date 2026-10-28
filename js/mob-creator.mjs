import {mobFromStudioPackage,readMobImport} from './mob-studio-import.mjs?v=R238C187';
import {createGenerationEditor} from './mob-generation-editor.mjs?v=R238C183';
import {sampleGeneration,generationWeaponTypes} from './mob-generation.mjs?v=R238C182';
import {ITEM_CATALOG} from './item-catalog.mjs?v=R238C176';
import {CAPTURE_GROUP_CATALOG,capturePosesForGroup} from './action-capture-groups.mjs?v=R238C176';
import {ACTION_POSE_LABELS,ACTION_PROFILE_CATALOG} from './action-profile-catalog.mjs?v=R238C176';
import {SPRITE_LAYOUT_PRESETS} from './sprite-layouts.mjs?v=R238C95';
import {ABILITY_SCORES,MOB_ABILITIES,createMobDefinition,normalizeMobDefinition,mobReadiness} from './mob-definition.mjs?v=R238C182';
import {normalizePoseLibrary,poseLibrarySignature,libraryPoseGroup} from './pose-library.mjs?v=R238C176';
import {browserAuthoringStore,downloadAuthoringJson,readAuthoringJson} from './authoring-store.mjs?v=R238C186';
const $=id=>document.getElementById(id),store=browserAuthoringStore();
let generationEditor,generated=null,generatedFrom=null;
let loaded=null,library=null,models=[],dirty=false;
const status=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
function attempt(fn){return async event=>{try{await fn(event);}catch(error){status(error.message,true);}};}
function checkboxes(container,entries,name){for(const entry of entries){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.name=name;input.value=entry.id;label.append(input,document.createTextNode(entry.label));$(container).append(label);}}
const checked=name=>[...document.querySelectorAll(`input[name="${name}"]:checked`)].map(input=>input.value);
const setChecked=(name,values)=>document.querySelectorAll(`input[name="${name}"]`).forEach(input=>{input.checked=values.includes(input.value);});
function libraryOptions(){const items=store.libraries();if(library&&!items.some(item=>item.id===library.id))items.push(library);$('libraryId').replaceChildren(...items.map(item=>new Option(`${item.id==='orc-fighter'?'Orc Fighter':item.name} · ${item.id}`,item.id)));if(library)$('libraryId').value=library.id;}
function mobOptions(){const selected=loaded?.id||'';$('savedMob').replaceChildren(new Option('New MOB',''),...store.mobs().map(mob=>new Option(mob.name,mob.id)));$('savedMob').value=selected;}
function read(){
 if(!$('modelId').value)throw Error('Import a Complete Capture ZIP or Unit Package from Studio first. A pose library alone has no model or footprint.');
 if(!$('mobForm').reportValidity())throw Error('Check the highlighted fields.');
 const sameModel=loaded?.modelId===$('modelId').value;
 const references=sameModel?structuredClone(loaded.references):{};
 if(!sameModel||poseLibrarySignature(library)!==poseLibrarySignature(loaded.references.poseLibrary)){delete references.spriteSets;delete references.sharedActionGroups;delete references.captureRecovery;delete references.captureFormatVersion;}
 return createMobDefinition({id:$('mobId').value.trim(),name:$('mobName').value.trim(),modelId:$('modelId').value,library,
 abilities:Object.fromEntries(ABILITY_SCORES.map(id=>[id,Number($(id).value)])),rules:Object.fromEntries(['hpMode','hitDice','maxHp','ac','thaco','move','attacksPerRound','morale','xpValue'].map(id=>[id,['hpMode','hitDice'].includes(id)?$(id).value:Number($(id).value)])),
 generation:generationEditor.read(),weaponTypes:[...new Set([...checked('weaponType'),...generationWeaponTypes(generationEditor.read())])],species:$('species').value,size:library.size,footprint:$('footprint').value,specialAbilities:checked('specialAbility'),spellcasting:{classId:$('casterClass').value,level:Number($('casterLevel').value),spellIds:$('spellIds').value.split(',').map(id=>id.trim()).filter(Boolean)},notes:$('notes').value,
 revision:loaded?.id===$('mobId').value?loaded.mob.revision:0,equipment:sameModel?loaded.equipment:[],attachments:sameModel?loaded.attachments:null,references,character:loaded?.character||{}});
}
function renderPoses(){
 $('size').value=library.size;
 $('castingFields').hidden=!checked('specialAbility').includes('spellcasting');
 $('libraryInfo').textContent=`${library.name} · revision ${library.revision} · Humanoid ${library.size}. Checks mean assigned animation frames, not model-specific sprite captures.`;
 $('poseChecklist').replaceChildren();
 for(const group of CAPTURE_GROUP_CATALOG.values()){
  if(group.id==='spell-casting')continue;
  const poses=libraryPoseGroup(library,group.id),ids=capturePosesForGroup(group.id);
  if(!ids.some(id=>poses[id])&&!['one-handed-swing','death-prone'].includes(group.id))continue;
  const section=document.createElement('section'),heading=document.createElement('h3'),list=document.createElement('ul');heading.textContent=group.label;list.className='pose-checklist';
  for(const id of ids){const pose=poses[id],row=document.createElement('li');row.className=pose?'pose-present':'pose-missing';row.textContent=`${pose?'✓':'✗'} ${ACTION_POSE_LABELS[id]} — ${pose?`${pose.animation} · ${pose.timeSeconds.toFixed(3)} s`:'Not assigned'}`;list.append(row);}
  section.append(heading,list);$('poseChecklist').append(section);
 }
}
function fill(mob){
 $('mobDefinitionFields').disabled=false;
 loaded=normalizeMobDefinition(mob);library=loaded.references.poseLibrary;generationEditor.load(loaded.mob.generation,loaded.character,loaded.equipment);generated=null;$('exportGeneratedMob').disabled=true;$('generatedMobSummary').textContent='Generate a sample to inspect class, level and equipment.';
 for(const [id,value] of Object.entries({mobId:mob.id,mobName:mob.name,modelId:mob.modelId,species:mob.mob.species,size:mob.mob.size,footprint:mob.mob.footprint,notes:mob.mob.notes,...mob.character.abilities,...mob.character.rules}))if($(id))$(id).value=value;
 if(!models.some(model=>model.id===mob.modelId)){$('modelId').add(new Option('Unavailable model: '+mob.modelId,mob.modelId));$('modelId').value=mob.modelId;}
 setChecked('weaponType',mob.actionProfiles);setChecked('specialAbility',mob.mob.specialAbilities);$('casterClass').value=mob.mob.spellcasting?.classId||'wizard';$('casterLevel').value=mob.mob.spellcasting?.level||1;$('spellIds').value=(mob.mob.spellcasting?.spellIds||[]).join(', ');
 const appearance=loaded.references.studioAppearance;$('studioAppearanceInfo').textContent=appearance?`From Studio: model size ${appearance.modelScalePercent}% · hex scale ${appearance.hexScalePercent}% · footprint ${appearance.footprint}. Change these in Studio and re-export.`:'Imported legacy MOB: model and footprint preserved. Import a fresh Studio ZIP to include visual scale.';
 libraryOptions();mobOptions();renderPoses();dirty=false;
}
function fresh(){const id='humanoid-'+Date.now();fill(createMobDefinition({id,name:'New Humanoid',modelId:'pending-studio-model',library:store.library('humanoid-medium'),generation:{version:1,kind:'template',alwaysItems:[],classLevels:[{classId:'none',level:1,weight:100}],primary:[{itemId:'none',weight:100}],offHand:[{itemId:'none',weight:100}]}}));$('mobDefinitionFields').disabled=true;$('modelId').value='';$('studioAppearanceInfo').textContent='No Studio appearance imported. Import a Complete Capture ZIP; selecting a pose library does not choose a model.';status('Import your Studio Complete Capture ZIP, then edit the MOB name, stats and equipment probabilities.');}
function save(){const mob=read();if(loaded?.id!==mob.id&&store.mob(mob.id))throw Error('That MOB ID already exists. Choose a different ID.');loaded=store.saveMob(mob);dirty=false;const url=new URL(location.href);url.searchParams.set("mob",loaded.id);history.replaceState(null,"",url);mobOptions();renderPoses();const ready=mobReadiness(loaded);status(`Saved ${loaded.name} r${loaded.mob.revision}. ${ready.present}/${ready.total} required poses assigned. Export when ready for integration.`);return loaded;}
async function start(){
 const response=await fetch('./data/studio-models.json',{cache:'no-cache'});if(!response.ok)throw Error('Model catalog could not be loaded.');const catalog=await response.json();models=catalog.models.filter(model=>!catalog.studioModelIds||catalog.studioModelIds.includes(model.id));if(!models.length)throw Error('No Studio models are available.');
 $('modelId').replaceChildren(new Option('Not imported from Studio',''),...models.map(model=>new Option(model.label,model.id)));$('footprint').replaceChildren(...SPRITE_LAYOUT_PRESETS.map(item=>new Option(item.label,item.id)));
 for(const id of ABILITY_SCORES){const label=document.createElement('label'),input=document.createElement('input');label.textContent=id.toUpperCase();Object.assign(input,{id,type:'number',min:'1',max:'25',value:'10',required:true});label.append(input);$('scores').append(label);}
 checkboxes('weaponTypes',[...ACTION_PROFILE_CATALOG.values()].filter(item=>item.id!=='spell-casting'),'weaponType');checkboxes('specialAbilities',MOB_ABILITIES,'specialAbility');
 generationEditor=createGenerationEditor($('generationEditor'),{onChange:()=>{dirty=true;generated=null;$('exportGeneratedMob').disabled=true;renderPoses();}});
 const requested=new URLSearchParams(location.search).get('mob'),mob=requested?store.mob(requested):null;
 if(mob){fill(mob);status(`Opened ${mob.name}. Its pose library is pinned at revision ${library.revision}.`);}else{fresh();if(requested)status('Requested draft was not found in this browser. Import its exported MOB JSON.',true);}
 $('mobForm').addEventListener('submit',event=>event.preventDefault());
 $('mobForm').addEventListener('input',event=>{dirty=true;renderPoses();});
 $('modelId').addEventListener('change',()=>{status('Model changed. Its Studio workspace and grip adjustments are separate.');});
 $('libraryId').addEventListener('change',attempt(()=>{library=store.library($('libraryId').value);dirty=true;renderPoses();}));
 $('generateMob').addEventListener('click',attempt(()=>{const definition=read(),sample=sampleGeneration(definition.mob.generation);generated=structuredClone(definition);generated.id=definition.id.slice(0,65)+'-sample-'+Date.now();generated.name=definition.name+' Sample';generated.character.classId=sample.classId;generated.character.level=sample.level;generated.equipment=sample.equipment;generated.mob.generation=sample.generation;generated.mob.revision=0;for(const key of ['spriteSets','sharedActionGroups','captureRecovery','captureFormatVersion'])delete generated.references[key];generated=normalizeMobDefinition(generated);generatedFrom=JSON.stringify(definition);$('generatedMobSummary').textContent=`${sample.classId||'No character class'}${sample.classId?' level '+sample.level:''} · ${sample.equipment.map(i=>`${ITEM_CATALOG[i.itemId].name}${i.quantity?' × '+i.quantity:''} (${i.slot})`).join(', ')||'No equipment'} · Not saved or deployed.`;$('exportGeneratedMob').disabled=false;}));
 $('exportGeneratedMob').addEventListener('click',attempt(()=>{if(!generated||generatedFrom!==JSON.stringify(read()))throw Error('The definition changed. Generate a fresh sample first.');downloadAuthoringJson(generated,generated.id+'.unit-package.json');}));
 $('saveMob').addEventListener('click',attempt(save));
 $('newMob').addEventListener('click',attempt(()=>{if(dirty)throw Error('Save or export your current edits before creating another MOB.');fresh();}));
 $('duplicateMob').addEventListener('click',attempt(()=>{const copy=read();copy.id=copy.id.slice(0,65)+'-copy-'+Date.now();copy.name+=' Copy';copy.mob.revision=0;fill(copy);dirty=true;status('Independent copy created. Save it under its new ID.');}));
 $('savedMob').addEventListener('change',attempt(()=>{const id=$('savedMob').value;if(dirty){$('savedMob').value=loaded?.id||'';throw Error('Save your edits before opening another MOB.');}if(id){fill(store.mob(id));status('Opened '+loaded.name);}else fresh();}));
 $('exportMob').addEventListener('click',attempt(()=>{const mob=read();downloadAuthoringJson(mob,mob.id+'.unit-package.json');dirty=false;status('Exported MOB category, generation choices, stats, equipment and linked pose library. Use Studio ZIP for rendered sprites and equipment grips.');}));
 $('importMob').addEventListener('click',()=>{$('importFile').value='';$('importFile').click();});
 $('importFile').addEventListener('change',attempt(async()=>{if(dirty&&$('modelId').value)throw Error('Save your current edits before importing.');const data=await readMobImport($('importFile').files[0]);if(data.schema==='adventure-party.pose-library'){let incoming=normalizePoseLibrary(data);const existing=store.library(incoming.id);if(existing&&poseLibrarySignature(existing)!==poseLibrarySignature(incoming))(()=>{throw Error('A different library already uses this ID. Update it in Studio or save there under a new ID before importing.');})();else if(existing)incoming=existing;library=store.saveLibrary(incoming);libraryOptions();renderPoses();dirty=true;status('Imported and linked pose library. Save the MOB to keep its selection.');}else{const incoming=mobFromStudioPackage(data);if(store.mob(incoming.id)){incoming.id=incoming.id.slice(0,65)+'-import-'+Date.now();incoming.mob.revision=0;}fill(incoming);dirty=true;status('Imported Studio/MOB package. Model and footprint are read-only; edit the character sheet, then save.');}}));
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 window.addEventListener('storage',event=>{if(event.key?.startsWith('adventure-party-authoring:')){libraryOptions();mobOptions();status('Authoring data changed in another tab. Reselect the pose library to link its latest saved revision, or reopen a changed MOB before saving.');}});
}
start().catch(error=>status(error.message,true));
