import {resolveEquipmentLibrary,equipmentSnapshot} from './equipment-library-core.mjs?v=R238C199';
import {readEquipmentLibrary} from './equipment-library-store.mjs?v=R238C199';
import {generateMobRules,classProgression} from './mob-class-rules.mjs?v=R238C190';
import {createMobSpellEditor} from './mob-spell-editor.mjs?v=R238C190';
import {mobFromStudioPackage,readMobImport} from './mob-studio-import.mjs?v=R238C199';
import {createGenerationEditor} from './mob-generation-editor.mjs?v=R238C199';
import {sampleGeneration,generationWeaponTypes} from './mob-generation.mjs?v=R238C199';
let equipmentDocument,ITEM_CATALOG;
import {CAPTURE_GROUP_CATALOG,capturePosesForGroup} from './action-capture-groups.mjs?v=R238C196';
import {ACTION_POSE_LABELS,ACTION_PROFILE_CATALOG} from './action-profile-catalog.mjs?v=R238C196';
import {SPRITE_LAYOUT_PRESETS} from './sprite-layouts.mjs?v=R238C95';
import {ABILITY_SCORES,MOB_ABILITIES,createMobDefinition,normalizeMobDefinition,mobReadiness} from './mob-definition.mjs?v=R238C199';
import {normalizePoseLibrary,poseLibrarySignature,libraryPoseGroup} from './pose-library.mjs?v=R238C196';
import {browserAuthoringStore,downloadAuthoringJson,readAuthoringJson} from './authoring-store.mjs?v=R238C200';
const $=id=>document.getElementById(id),store=browserAuthoringStore();
let spellEditor,generationEditor,generated=null,generatedFrom=null;
let loaded=null,library=null,models=[],dirty=false;
const status=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
function attempt(fn){return async event=>{try{await fn(event);}catch(error){status(error.message,true);}};}
function checkboxes(container,entries,name){for(const entry of entries){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.name=name;input.value=entry.id;label.append(input,document.createTextNode(entry.label));$(container).append(label);}}
const checked=name=>[...document.querySelectorAll(`input[name="${name}"]:checked`)].map(input=>input.value);
const setChecked=(name,values)=>document.querySelectorAll(`input[name="${name}"]`).forEach(input=>{input.checked=values.includes(input.value);});
function libraryOptions(){const items=store.libraries();if(library&&!items.some(item=>item.id===library.id))items.push(library);$('libraryId').replaceChildren(...items.map(item=>new Option(`${item.id==='orc-fighter'?'Orc Fighter':item.name} · ${item.id}`,item.id)));if(library)$('libraryId').value=library.id;}
function mobOptions(){const selected=loaded?.id||'';$('savedMob').replaceChildren(new Option('New MOB',''),...store.mobs().map(mob=>new Option(mob.name,mob.id)));$('savedMob').value=selected;}
function read(){
 if(!$('modelId').value)throw Error('Load a library exported with its Studio model settings. In Studio use Export Library for MOB Creator.');
 if(!$('mobForm').reportValidity())throw Error('Check the highlighted fields.');
 const g=generationEditor.read();
 const ids=[...(g.kind==='unique'?[g.fixed.primary,g.fixed.offHand]:[...g.primary,...g.offHand].map(i=>i.itemId)),...g.alwaysItems.map(i=>i.itemId)];
 const sameModel=loaded?.modelId===$('modelId').value;
 const references=sameModel?structuredClone(loaded.references):{};
 if(!sameModel||poseLibrarySignature(library)!==poseLibrarySignature(loaded.references.poseLibrary)){delete references.spriteSets;delete references.sharedActionGroups;delete references.captureRecovery;delete references.captureFormatVersion;}
 references.equipmentLibrary=equipmentSnapshot(equipmentDocument,ids);
 return createMobDefinition({id:$('mobId').value.trim(),name:$('mobName').value.trim(),modelId:$('modelId').value,library,
 abilities:Object.fromEntries(ABILITY_SCORES.map(id=>[id,Number($(id).value)])),rules:{classRules:$('classRules').value,overrideHp:$('overrideHp').checked,overrideThaco:$('overrideThaco').checked,overrideAttacks:$('overrideAttacks').checked,...Object.fromEntries(['hpMode','hitDice','maxHp','ac','thaco','move','attacksPerRound','morale','xpValue'].map(id=>[id,['hpMode','hitDice'].includes(id)?$(id).value:Number($(id).value)]))},
 spellPreparation:spellEditor.read(),generation:generationEditor.read(),weaponTypes:[...new Set([...checked('weaponType'),...generationWeaponTypes(generationEditor.read(),ITEM_CATALOG)])],species:$('species').value,size:library.size,footprint:$('footprint').value,specialAbilities:checked('specialAbility'),spellcasting:{classId:$('casterClass').value,level:Number($('casterLevel').value),spellIds:$('spellIds').value.split(',').map(id=>id.trim()).filter(Boolean)},notes:$('notes').value,
 revision:loaded?.id===$('mobId').value?loaded.mob.revision:0,equipment:sameModel?loaded.equipment:[],attachments:sameModel?loaded.attachments:null,references,character:loaded?.character||{}});
}
function applyLibraryAppearance(){
 const appearance=library.studioAppearance;if(!appearance){$('modelId').value='';$('mobDefinitionFields').disabled=true;delete loaded.references.studioAppearance;return;}
 if(!models.some(model=>model.id===appearance.modelId)&&!Array.from($('modelId').options).some(o=>o.value===appearance.modelId))$('modelId').add(new Option(appearance.modelId,appearance.modelId));
 $('modelId').value=appearance.modelId;$('footprint').value=appearance.footprint;$('size').value=library.size;$('mobDefinitionFields').disabled=false;
 loaded.modelId=appearance.modelId;loaded.attachments=null;loaded.references.studioAppearance=structuredClone(appearance);
 for(const key of ['spriteSets','sharedActionGroups','captureRecovery','captureFormatVersion'])delete loaded.references[key];
}
function renderClassSummary(){
 if(!generationEditor)return;
 try{const g=generationEditor.read(),rows=g.kind==='unique'?[g.fixed]:g.classLevels.filter(r=>r.weight>0),scores=Object.fromEntries(ABILITY_SCORES.map(id=>[id,Number($(id).value)]));
 const derived=$('classRules').value==='class'&&rows.some(r=>r.classId!=='none');
 for(const id of ['hpMode','hitDice','maxHp'])$(id).disabled=derived&&!$('overrideHp').checked;
 $('thaco').disabled=derived&&!$('overrideThaco').checked;$('attacksPerRound').disabled=derived&&!$('overrideAttacks').checked;
 $('classSummary').textContent=rows.map(row=>{const d=classProgression(row.classId,row.level,scores);return d?`${row.classId} ${row.level}: ${d.hitDice}, CON ${d.con>=0?'+':''}${d.con}/die · THAC0 ${d.thaco} · ${d.attacksPerRound} attacks/round${d.spellSlots.length?' · Spell slots by level: '+d.spellSlots.join('/') : ''}`:'No class: authored statistics';}).join(' | ');
 }catch(e){$('classSummary').textContent=e.message;}
}
function renderPoses(){
 const appearance=library.studioAppearance||loaded?.references?.studioAppearance;const model=models.find(m=>m.id===appearance?.modelId);$('studioAppearanceInfo').textContent=appearance?`Model: ${model?.label||appearance.modelId} · File: ${model?.file||'Unavailable in current catalog'} · Model size: ${appearance.modelScalePercent}% · Hex scale: ${appearance.hexScalePercent}% · Footprint: ${appearance.footprint} · Humanoid ${library.size}. Equipment adjustments included: ${appearance.equipment||appearance.poseEquipment?'Yes':'Not supplied'}.`:'No linked model settings. Re-export this library using Export Library for MOB Creator in Studio.';
 $('size').value=library.size;
 renderClassSummary();
 $('castingFields').hidden=true;
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
 const embedded=mob.references?.equipmentLibrary;
 if(embedded){const rows=new Map(equipmentDocument.items.map(i=>[i.id,i]));for(const row of embedded.items)rows.set(row.id,row);const next={...equipmentDocument,items:[...rows.values()]};const resolved=resolveEquipmentLibrary(next);equipmentDocument=next;Object.assign(ITEM_CATALOG,resolved);}
 loaded=normalizeMobDefinition(mob);spellEditor.load(loaded.mob.spellPreparation);for(const id of ['overrideHp','overrideThaco','overrideAttacks'])$(id).checked=loaded.character.rules[id];$('classRules').value=loaded.character.rules.classRules;library=loaded.references.poseLibrary;generationEditor.load(loaded.mob.generation,loaded.character,loaded.equipment);generated=null;$('exportGeneratedMob').disabled=true;$('generatedMobSummary').textContent='Generate a sample to inspect class, level and equipment.';
 for(const [id,value] of Object.entries({mobId:mob.id,mobName:mob.name,modelId:mob.modelId,species:mob.mob.species,size:mob.mob.size,footprint:mob.mob.footprint,notes:mob.mob.notes,...mob.character.abilities,...mob.character.rules}))if($(id))$(id).value=value;
 if(!models.some(model=>model.id===mob.modelId)){$('modelId').add(new Option('Unavailable model: '+mob.modelId,mob.modelId));$('modelId').value=mob.modelId;}
 setChecked('weaponType',mob.actionProfiles);setChecked('specialAbility',mob.mob.specialAbilities);$('casterClass').value=mob.mob.spellcasting?.classId||'wizard';$('casterLevel').value=mob.mob.spellcasting?.level||1;$('spellIds').value=(mob.mob.spellcasting?.spellIds||[]).join(', ');
 const appearance=loaded.references.studioAppearance;$('studioAppearanceInfo').textContent=appearance?`From Studio: model size ${appearance.modelScalePercent}% · hex scale ${appearance.hexScalePercent}% · footprint ${appearance.footprint}. Change these in Studio and re-export.`:'Imported legacy MOB: model and footprint preserved. Import a fresh Studio ZIP to include visual scale.';
 libraryOptions();mobOptions();renderPoses();dirty=false;
}
function fresh(){const id='humanoid-'+Date.now();fill(createMobDefinition({id,name:'New Humanoid',modelId:'pending-studio-model',library:store.library('humanoid-medium'),rules:{classRules:'class'},generation:{version:1,kind:'template',alwaysItems:[],classLevels:[{classId:'none',level:1,weight:100}],primary:[{itemId:'none',weight:100}],offHand:[{itemId:'none',weight:100}]}}));$('mobDefinitionFields').disabled=true;$('modelId').value='';$('studioAppearanceInfo').textContent='Select or import a Studio library containing model settings. Older pose-only libraries must be re-exported from Studio.';status('Select or import your Studio library, then edit the MOB name, stats and equipment probabilities.');}
function save(){const mob=read();if(loaded?.id!==mob.id&&store.mob(mob.id))throw Error('That MOB ID already exists. Choose a different ID.');loaded=store.saveMob(mob);dirty=false;const url=new URL(location.href);url.searchParams.set("mob",loaded.id);history.replaceState(null,"",url);mobOptions();renderPoses();const ready=mobReadiness(loaded);status(`Saved ${loaded.name} r${loaded.mob.revision}. ${ready.present}/${ready.total} required poses assigned. Export when ready for integration.`);return loaded;}
async function start(){
 equipmentDocument=readEquipmentLibrary();ITEM_CATALOG=resolveEquipmentLibrary(equipmentDocument);
 const response=await fetch('./data/studio-models.json',{cache:'no-cache'});if(!response.ok)throw Error('Model catalog could not be loaded.');const catalog=await response.json();models=catalog.models.filter(model=>!catalog.studioModelIds||catalog.studioModelIds.includes(model.id));if(!models.length)throw Error('No Studio models are available.');
 $('modelId').replaceChildren(new Option('Not imported from Studio',''),...models.map(model=>new Option(model.label,model.id)));$('footprint').replaceChildren(...SPRITE_LAYOUT_PRESETS.map(item=>new Option(item.label,item.id)));
 for(const id of ABILITY_SCORES){const label=document.createElement('label'),input=document.createElement('input');label.textContent=id.toUpperCase();Object.assign(input,{id,type:'number',min:'1',max:'25',value:'10',required:true});label.append(input);$('scores').append(label);}
 checkboxes('weaponTypes',[...ACTION_PROFILE_CATALOG.values()].filter(item=>item.id!=='spell-casting'),'weaponType');checkboxes('specialAbilities',MOB_ABILITIES.filter(a=>a.id!=='spellcasting'),'specialAbility');
 spellEditor=createMobSpellEditor($('mobSpells'),()=>{dirty=true;});
 generationEditor=createGenerationEditor($('generationEditor'),{catalog:ITEM_CATALOG,onChange:()=>{dirty=true;generated=null;$('exportGeneratedMob').disabled=true;renderPoses();}});
 const requested=new URLSearchParams(location.search).get('mob'),mob=requested?store.mob(requested):null;
 if(mob){fill(mob);status(`Opened ${mob.name}. Its pose library is pinned at revision ${library.revision}.`);}else{fresh();if(requested)status('Requested draft was not found in this browser. Import its exported MOB JSON.',true);}
 $('mobForm').addEventListener('submit',event=>event.preventDefault());
 $('mobForm').addEventListener('input',event=>{dirty=true;renderPoses();});
 $('modelId').addEventListener('change',()=>{status('Model changed. Its Studio workspace and grip adjustments are separate.');});
 $('libraryId').addEventListener('change',attempt(()=>{library=store.library($('libraryId').value);applyLibraryAppearance();dirty=true;renderPoses();}));
 $('generateMob').addEventListener('click',attempt(()=>{const definition=read(),sample=sampleGeneration(definition.mob.generation,Math.random,ITEM_CATALOG);generated=structuredClone(definition);generated.id=definition.id.slice(0,65)+'-sample-'+Date.now();generated.name=definition.name+' Sample';generated.character.classId=sample.classId;generated.character.level=sample.level;generated.equipment=sample.equipment;const result=generateMobRules(definition,sample);generated.character.rules={...generated.character.rules,classRules:'authored',hpMode:'fixed',maxHp:result.hp,thaco:result.thaco,attacksPerRound:result.attacksPerRound,hitDice:result.hitDiceLabel};generated.references.generatedClassRules=result;for(const classId of ['mage','cleric']){const ids=classId==='mage'?result.memorizedSpellIds:result.memorizedPriestSpellIds;generated.mob.spellPreparation[classId]={mode:'prepared',choices:[...new Set(ids)].map(spellId=>({spellId,count:ids.filter(id=>id===spellId).length}))};}generated.mob.generation=sample.generation;generated.mob.revision=0;for(const key of ['spriteSets','sharedActionGroups','captureRecovery','captureFormatVersion'])delete generated.references[key];generated=normalizeMobDefinition(generated);generatedFrom=JSON.stringify(definition);$('generatedMobSummary').textContent=`${sample.classId||'No character class'}${sample.classId?' level '+sample.level:''} · ${sample.equipment.map(i=>`${ITEM_CATALOG[i.itemId].name}${i.quantity?' × '+i.quantity:''} (${i.slot})`).join(', ')||'No equipment'} · HP ${result.hp} · THAC0 ${result.thaco} · ${result.memorizedSpellIds.length+result.memorizedPriestSpellIds.length} prepared spells · Not saved or deployed.`;$('exportGeneratedMob').disabled=false;}));
 $('exportGeneratedMob').addEventListener('click',attempt(()=>{if(!generated||generatedFrom!==JSON.stringify(read()))throw Error('The definition changed. Generate a fresh sample first.');downloadAuthoringJson(generated,generated.id+'.unit-package.json');}));
 $('saveMob').addEventListener('click',attempt(save));
 $('newMob').addEventListener('click',attempt(()=>{if(dirty)throw Error('Save or export your current edits before creating another MOB.');fresh();}));
 $('duplicateMob').addEventListener('click',attempt(()=>{const copy=read();copy.id=copy.id.slice(0,65)+'-copy-'+Date.now();copy.name+=' Copy';copy.mob.revision=0;fill(copy);dirty=true;status('Independent copy created. Save it under its new ID.');}));
 $('savedMob').addEventListener('change',attempt(()=>{const id=$('savedMob').value;if(dirty){$('savedMob').value=loaded?.id||'';throw Error('Save your edits before opening another MOB.');}if(id){fill(store.mob(id));status('Opened '+loaded.name);}else fresh();}));
 $('exportMob').addEventListener('click',attempt(()=>{const mob=read();downloadAuthoringJson(mob,mob.id+'.unit-package.json');dirty=false;status('Exported MOB category, generation choices, stats, equipment and linked pose library. Use Studio ZIP for rendered sprites and equipment grips.');}));
 $('importMob').addEventListener('click',()=>{$('importFile').value='';$('importFile').click();});
 $('importFile').addEventListener('change',attempt(async()=>{if(dirty&&$('modelId').value)throw Error('Save your current edits before importing.');const data=await readMobImport($('importFile').files[0]);if(data.schema==='adventure-party.pose-library'){let incoming=normalizePoseLibrary(data);const existing=store.library(incoming.id);if(existing&&poseLibrarySignature(existing)!==poseLibrarySignature(incoming)){if(incoming.revision<existing.revision)throw Error('A newer revision of this library is already saved. Export its latest version from Studio.');incoming={...incoming,revision:existing.revision};}else if(existing)incoming=existing;library=store.saveLibrary(incoming);applyLibraryAppearance();libraryOptions();renderPoses();dirty=true;status('Imported and linked pose library. Save the MOB to keep its selection.');}else{const incoming=mobFromStudioPackage(data);if(store.mob(incoming.id)){incoming.id=incoming.id.slice(0,65)+'-import-'+Date.now();incoming.mob.revision=0;}fill(incoming);dirty=true;status('Imported Studio/MOB package. Model and footprint are read-only; edit the character sheet, then save.');}}));
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 window.addEventListener('storage',event=>{if(event.key?.startsWith('adventure-party-authoring:')){libraryOptions();mobOptions();status('Authoring data changed in another tab. Reselect the pose library to link its latest saved revision, or reopen a changed MOB before saving.');}});
}
start().catch(error=>status(error.message,true));
