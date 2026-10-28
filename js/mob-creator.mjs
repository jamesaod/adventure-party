import {createGenerationEditor} from './mob-generation-editor.mjs?v=R238C182';
import {sampleGeneration,generationWeaponTypes} from './mob-generation.mjs?v=R238C182';
import {ITEM_CATALOG} from './item-catalog.mjs?v=R238C176';
import {poseWithFallback} from './pose-fallbacks.mjs?v=R238C176';
import {CAPTURE_GROUP_CATALOG,capturePosesForGroup} from './action-capture-groups.mjs?v=R238C176';
import {ACTION_POSES,ACTION_POSE_LABELS,ACTION_PROFILE_CATALOG} from './action-profile-catalog.mjs?v=R238C176';
import {SPRITE_LAYOUT_PRESETS} from './sprite-layouts.mjs?v=R238C95';
import {ABILITY_SCORES,MOB_ABILITIES,createMobDefinition,normalizeMobDefinition,mobReadiness} from './mob-definition.mjs?v=R238C182';
import {normalizePoseLibrary,poseLibrarySignature,libraryPoseGroup,poseLibraryCoverage} from './pose-library.mjs?v=R238C176';
import {browserAuthoringStore,downloadAuthoringJson,readAuthoringJson} from './authoring-store.mjs?v=R238C182';
const $=id=>document.getElementById(id),store=browserAuthoringStore();
let generationEditor,generated=null,generatedFrom=null;
let loaded=null,library=null,models=[],dirty=false,previewReady=false;
const status=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
function attempt(fn){return async event=>{try{await fn(event);}catch(error){status(error.message,true);}};}
function checkboxes(container,entries,name){for(const entry of entries){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.name=name;input.value=entry.id;label.append(input,document.createTextNode(entry.label));$(container).append(label);}}
const checked=name=>[...document.querySelectorAll(`input[name="${name}"]:checked`)].map(input=>input.value);
const setChecked=(name,values)=>document.querySelectorAll(`input[name="${name}"]`).forEach(input=>{input.checked=values.includes(input.value);});
function libraryOptions(){const items=store.libraries();if(library&&!items.some(item=>item.id===library.id))items.push(library);$('libraryId').replaceChildren(...items.map(item=>new Option(item.name,item.id)));if(library)$('libraryId').value=library.id;}
function mobOptions(){const selected=loaded?.id||'';$('savedMob').replaceChildren(new Option('New MOB',''),...store.mobs().map(mob=>new Option(mob.name,mob.id)));$('savedMob').value=selected;}
function studioUrl(preview=false){const params=new URLSearchParams({mob:$('mobId').value,model:$('modelId').value,poseLibrary:library.id});if(preview)params.set('preview','1');return './3d-studio.html?'+params;}
function read(){
 if(!$('mobForm').reportValidity())throw Error('Check the highlighted fields.');
 const sameModel=loaded?.modelId===$('modelId').value;
 const references=sameModel?structuredClone(loaded.references):{};
 if(!sameModel||poseLibrarySignature(library)!==poseLibrarySignature(loaded.references.poseLibrary)){delete references.spriteSets;delete references.sharedActionGroups;delete references.captureRecovery;delete references.captureFormatVersion;}
 return createMobDefinition({id:$('mobId').value.trim(),name:$('mobName').value.trim(),modelId:$('modelId').value,library,
 abilities:Object.fromEntries(ABILITY_SCORES.map(id=>[id,Number($(id).value)])),rules:Object.fromEntries(['hpMode','hitDice','maxHp','ac','thaco','move','attacksPerRound','morale','xpValue'].map(id=>[id,['hpMode','hitDice'].includes(id)?$(id).value:Number($(id).value)])),
 generation:generationEditor.read(),weaponTypes:[...new Set([...checked('weaponType'),...generationWeaponTypes(generationEditor.read())])],species:$('species').value,size:$('size').value,footprint:$('footprint').value,specialAbilities:checked('specialAbility'),spellcasting:{classId:$('casterClass').value,level:Number($('casterLevel').value),spellIds:$('spellIds').value.split(',').map(id=>id.trim()).filter(Boolean)},notes:$('notes').value,
 revision:loaded?.id===$('mobId').value?loaded.mob.revision:0,equipment:sameModel?loaded.equipment:[],attachments:sameModel?loaded.attachments:null,references,character:loaded?.character||{}});
}
function renderPoses(){
 $('castingFields').hidden=!checked('specialAbility').includes('spellcasting');
 $('libraryInfo').textContent=`Linked: ${library.name} · revision ${library.revision} · Humanoid ${library.size}. Updates are applied only when you choose them.`;
 const group=$('poseWeapon').value,allowed=capturePosesForGroup(group),previous=$('poseAction').value;
 $('poseAction').replaceChildren(...allowed.map(id=>new Option(ACTION_POSE_LABELS[id],id)));$('poseAction').value=allowed.includes(previous)?previous:allowed[0];
 const poses=libraryPoseGroup(library,group);$('poseRows').replaceChildren();
 for(const id of allowed){const tr=document.createElement('tr'),name=document.createElement('td'),value=document.createElement('td');name.textContent=ACTION_POSE_LABELS[id];const resolved=poseWithFallback(library.profiles,library.sharedActionGroups,group,id),pose=resolved?.sample;value.textContent=pose?`${pose.animation} · ${pose.timeSeconds.toFixed(3)} s${resolved.fallback?' (1H Swing fallback)':''}`:'Not assigned';if(!pose)value.className='missing';tr.append(name,value);$('poseRows').append(tr);}
 let generatedTypes=[];try{generatedTypes=generationWeaponTypes(generationEditor.read());}catch{}
 const types=[...new Set([...checked('weaponType'),...generatedTypes])],{total,present}=poseLibraryCoverage(library,types,{casting:checked('specialAbility').includes('spellcasting')});
 $('coverage').textContent=`${present} / ${total} required poses available (assigned or fallback) for ${types.length} selected weapon types and shared actions.${present<total?' Missing weapon poses use 1H Swing; Falling/Prone use 1H Ready when available.':''}`;
 $('openStudio').href=studioUrl();
}
function fill(mob){
 loaded=normalizeMobDefinition(mob);library=loaded.references.poseLibrary;generationEditor.load(loaded.mob.generation,loaded.character,loaded.equipment);generated=null;$('exportGeneratedMob').disabled=true;$('generatedMobSummary').textContent='Generate a sample to inspect class, level and equipment.';
 for(const [id,value] of Object.entries({mobId:mob.id,mobName:mob.name,modelId:mob.modelId,species:mob.mob.species,size:mob.mob.size,footprint:mob.mob.footprint,notes:mob.mob.notes,...mob.character.abilities,...mob.character.rules}))if($(id))$(id).value=value;
 if(!models.some(model=>model.id===mob.modelId)){$('modelId').add(new Option('Unavailable model: '+mob.modelId,mob.modelId));$('modelId').value=mob.modelId;}
 setChecked('weaponType',mob.actionProfiles);setChecked('specialAbility',mob.mob.specialAbilities);$('casterClass').value=mob.mob.spellcasting?.classId||'wizard';$('casterLevel').value=mob.mob.spellcasting?.level||1;$('spellIds').value=(mob.mob.spellcasting?.spellIds||[]).join(', ');
 libraryOptions();mobOptions();renderPoses();dirty=false;clearPreview();
}
function clearPreview(){previewReady=false;$('preview').hidden=true;$('preview').removeAttribute('src');$('previewStatus').textContent='Save and preview to load the selected model and linked library.';}
function fresh(){const id='humanoid-'+Date.now();fill(createMobDefinition({id,name:'New Humanoid',modelId:models[0].id,library:store.library('humanoid-medium')}));status('New MOB. Set its name, model, stats and weapon types.');}
function save(){const mob=read();if(loaded?.id!==mob.id&&store.mob(mob.id))throw Error('That MOB ID already exists. Choose a different ID.');loaded=store.saveMob(mob);dirty=false;const url=new URL(location.href);url.searchParams.set("mob",loaded.id);history.replaceState(null,"",url);mobOptions();renderPoses();const ready=mobReadiness(loaded);status(`Saved ${loaded.name} r${loaded.mob.revision}. ${ready.present}/${ready.total} required poses assigned. Export when ready for integration.`);return loaded;}
function sendPreview(){if(!previewReady)throw Error('Save and preview the model first, then wait for it to load.');$('preview').contentWindow.postMessage({type:'mob-preview-pose',profile:$('poseWeapon').value,pose:$('poseAction').value},location.origin);}
async function start(){
 const response=await fetch('./data/studio-models.json',{cache:'no-cache'});if(!response.ok)throw Error('Model catalog could not be loaded.');const catalog=await response.json();models=catalog.models.filter(model=>!catalog.studioModelIds||catalog.studioModelIds.includes(model.id));if(!models.length)throw Error('No Studio models are available.');
 $('modelId').replaceChildren(...models.map(model=>new Option(model.label,model.id)));$('footprint').replaceChildren(...SPRITE_LAYOUT_PRESETS.map(item=>new Option(item.label,item.id)));
 for(const id of ABILITY_SCORES){const label=document.createElement('label'),input=document.createElement('input');label.textContent=id.toUpperCase();Object.assign(input,{id,type:'number',min:'1',max:'25',value:'10',required:true});label.append(input);$('scores').append(label);}
 checkboxes('weaponTypes',[...ACTION_PROFILE_CATALOG.values()].filter(item=>item.id!=='spell-casting'),'weaponType');checkboxes('specialAbilities',MOB_ABILITIES,'specialAbility');
 $('poseWeapon').replaceChildren(...[...CAPTURE_GROUP_CATALOG.values()].filter(item=>item.id!=='spell-casting').map(item=>new Option(item.label,item.id)));$('poseAction').replaceChildren(...ACTION_POSES.map(id=>new Option(ACTION_POSE_LABELS[id],id)));
 generationEditor=createGenerationEditor($('generationEditor'),{onChange:()=>{dirty=true;generated=null;$('exportGeneratedMob').disabled=true;renderPoses();}});
 const requested=new URLSearchParams(location.search).get('mob'),mob=requested?store.mob(requested):null;
 if(mob){fill(mob);status(`Opened ${mob.name}. Its pose library is pinned at revision ${library.revision}.`);}else{fresh();if(requested)status('Requested draft was not found in this browser. Import its exported MOB JSON.',true);}
 $('mobForm').addEventListener('submit',event=>event.preventDefault());
 $('mobForm').addEventListener('input',event=>{if(['poseWeapon','poseAction'].includes(event.target.id))return;dirty=true;renderPoses();});
 $('modelId').addEventListener('change',()=>{clearPreview();status('Model changed. Its Studio workspace and grip adjustments are separate.');});
 $('libraryId').addEventListener('change',attempt(()=>{library=store.library($('libraryId').value);dirty=true;clearPreview();renderPoses();}));
 $('poseWeapon').addEventListener('change',renderPoses);
 $('generateMob').addEventListener('click',attempt(()=>{const definition=read(),sample=sampleGeneration(definition.mob.generation);generated=structuredClone(definition);generated.id=definition.id.slice(0,65)+'-sample-'+Date.now();generated.name=definition.name+' Sample';generated.character.classId=sample.classId;generated.character.level=sample.level;generated.equipment=sample.equipment;generated.mob.generation=sample.generation;generated.mob.revision=0;for(const key of ['spriteSets','sharedActionGroups','captureRecovery','captureFormatVersion'])delete generated.references[key];generated=normalizeMobDefinition(generated);generatedFrom=JSON.stringify(definition);$('generatedMobSummary').textContent=`${sample.classId||'No character class'}${sample.classId?' level '+sample.level:''} · ${sample.equipment.map(i=>`${ITEM_CATALOG[i.itemId].name}${i.quantity?' × '+i.quantity:''} (${i.slot})`).join(', ')||'No equipment'} · Not saved or deployed.`;$('exportGeneratedMob').disabled=false;}));
 $('exportGeneratedMob').addEventListener('click',attempt(()=>{if(!generated||generatedFrom!==JSON.stringify(read()))throw Error('The definition changed. Generate a fresh sample first.');downloadAuthoringJson(generated,generated.id+'.unit-package.json');}));
 $('saveMob').addEventListener('click',attempt(save));
 $('newMob').addEventListener('click',attempt(()=>{if(dirty)throw Error('Save or export your current edits before creating another MOB.');fresh();}));
 $('duplicateMob').addEventListener('click',attempt(()=>{const copy=read();copy.id=copy.id.slice(0,65)+'-copy-'+Date.now();copy.name+=' Copy';copy.mob.revision=0;fill(copy);dirty=true;status('Independent copy created. Save it under its new ID.');}));
 $('savedMob').addEventListener('change',attempt(()=>{const id=$('savedMob').value;if(dirty){$('savedMob').value=loaded?.id||'';throw Error('Save your edits before opening another MOB.');}if(id){fill(store.mob(id));status('Opened '+loaded.name);}else fresh();}));
 $('exportMob').addEventListener('click',attempt(()=>{const mob=read();downloadAuthoringJson(mob,mob.id+'.unit-package.json');dirty=false;status('Exported MOB category, generation choices, stats, equipment and linked pose library. Use Studio ZIP for rendered sprites and equipment grips.');}));
 $('exportLibrary').addEventListener('click',attempt(()=>downloadAuthoringJson(library,library.id+'.pose-library.json')));
 $('refreshLibrary').addEventListener('click',attempt(()=>{const latest=store.library(library.id);if(!latest)throw Error('Import or save this library in Studio first.');library=latest;dirty=true;libraryOptions();clearPreview();renderPoses();status('Linked the latest saved revision. Save the MOB to keep this selection.');}));
 $('previewModel').addEventListener('click',attempt(()=>{save();if(!models.some(model=>model.id===loaded.modelId))throw Error('This model is unavailable in Studio. Choose an available model.');previewReady=false;$('preview').hidden=false;$('preview').src=studioUrl(true);$('previewStatus').textContent='Loading model and the existing humanoid animation library…';}));
 $('openStudio').addEventListener('click',event=>{try{save();$('openStudio').href=studioUrl();}catch(error){event.preventDefault();status(error.message,true);}});
 $('previewPose').addEventListener('click',attempt(sendPreview));
 $('importMob').addEventListener('click',()=>{$('importFile').value='';$('importFile').click();});
 $('importFile').addEventListener('change',attempt(async()=>{if(dirty)throw Error('Save your current edits before importing.');const data=await readAuthoringJson($('importFile').files[0]);if(data.schema==='adventure-party.pose-library'){let incoming=normalizePoseLibrary(data);const existing=store.library(incoming.id);if(existing&&poseLibrarySignature(existing)!==poseLibrarySignature(incoming))incoming={...incoming,id:incoming.id.slice(0,65)+'-import-'+Date.now(),revision:0};else if(existing)incoming=existing;library=store.saveLibrary(incoming);libraryOptions();clearPreview();renderPoses();dirty=true;status('Imported and linked pose library. Save the MOB to keep its selection.');}else{const incoming=normalizeMobDefinition(data);if(store.mob(incoming.id)){incoming.id=incoming.id.slice(0,65)+'-import-'+Date.now();incoming.mob.revision=0;}fill(incoming);dirty=true;status('Imported MOB as a draft. Review it, then save.');}}));
 window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==$('preview').contentWindow)return;if(event.data?.type==='mob-preview-ready'){previewReady=true;$('previewStatus').textContent='Model ready. Choose a weapon type and preview its assigned pose.';}else if(event.data?.type==='mob-preview-result')$('previewStatus').textContent=event.data.message;});
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 window.addEventListener('storage',event=>{if(event.key?.startsWith('adventure-party-authoring:')){libraryOptions();mobOptions();status('Authoring data changed in another tab. Use latest saved library to update this MOB, or reopen a changed MOB before saving.');}});
}
start().catch(error=>status(error.message,true));
