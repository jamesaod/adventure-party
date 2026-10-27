import {capturePosesForGroup,captureGroupForPose} from './action-capture-groups.mjs?v=R238C172';
import {ACTION_POSES,ACTION_POSE_LABELS,ACTION_PROFILE_CATALOG} from './action-profile-catalog.mjs?v=R238C172';
import {createPoseLibrary,normalizePoseLibrary,recordLibraryPose,addCaptureRecipes,poseLibrarySignature,resolveLibraryPose,libraryPoseGroup,changedLibraryPoses} from './pose-library.mjs?v=R238C172';
import {browserAuthoringStore,downloadAuthoringJson,readAuthoringJson} from './authoring-store.mjs?v=R238C172';
export function createStudioPoseLibrary({getSample,getClips,preview,selectProfile,getCaptureRecipes,invalidateCaptures,getSignature,getLinkedLibrary,setLink,initialLibrary=null}){
  const store=browserAuthoringStore(),anchor=document.querySelector('.studio-animation');
  const panel=document.createElement('section');panel.className='studio-panel chrome studio-pose-library';panel.id='studioPoseLibraryPanel';
  panel.innerHTML=`<h2>Reusable pose library</h2><p class="studio-note">Animation frames shared across models. Equipment grips and captured pixels stay with each model.</p>
  <label class="studio-field">Saved library<select id="studioPoseLibrarySelect"></select></label>
  <div class="studio-recipe-fields"><label class="studio-field">Library name<input id="studioPoseLibraryName" maxlength="160"></label><label class="studio-field">Library ID<input id="studioPoseLibraryId" maxlength="100"></label><label class="studio-field">Humanoid size<select id="studioPoseLibrarySize"><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label></div>
  <label class="studio-field">Library action pose<select id="studioLibraryPose"></select></label><p class="studio-note">Uses the weapon type or shared action group selected above. Recording a frame changes this library; capturing creates model-specific sprites.</p>
  <div class="studio-sheet-actions"><button id="studioRecordRecipe" type="button" class="studio-button">Record current frame</button><button id="studioPreviewRecipe" type="button" class="studio-button">Preview assigned pose</button><button id="studioCaptureRecipe" type="button" class="studio-button">Capture assigned pose</button></div>
  <div id="studioLegacyRecipePanel" class="studio-sheet-actions" hidden><select id="studioLegacyRecipe" aria-label="Earlier shared pose recipes"></select><button id="studioRestoreLegacyRecipe" type="button" class="studio-button">Restore earlier recipe</button></div><p id="studioRecipeSummary" class="studio-note" role="status"></p>
  <div class="studio-sheet-actions"><button id="studioSavePoseLibrary" type="button" class="studio-button studio-primary">Save library</button><button id="studioExportPoseLibrary" type="button" class="studio-button">Export pose library JSON</button><button id="studioImportPoseLibrary" type="button" class="studio-button">Import library JSON</button><button id="studioSeedPoseLibrary" type="button" class="studio-button">Use existing capture references</button><button id="studioNewPoseLibrary" type="button" class="studio-button">New library</button></div><input id="studioPoseLibraryFile" type="file" accept=".json,application/json" hidden><p id="studioPoseLibraryStatus" class="studio-note" role="status"></p>`;
  anchor.insertAdjacentElement('afterend',panel);
  const byId=id=>document.getElementById('studio'+id),status=message=>{byId('PoseLibraryStatus').textContent=message;};
  let library=normalizePoseLibrary(initialLibrary||store.library('humanoid-medium')),loadedId=library.id,dirty=false;
  byId('LibraryPose').replaceChildren(...ACTION_POSES.map(id=>new Option(ACTION_POSE_LABELS[id],id)));byId('LibraryPose').value=byId('ActionPose').value;
  byId('LibraryPose').addEventListener('change',()=>{byId('ActionPose').value=byId('LibraryPose').value;refresh();});
  const currentProfile=()=>byId('ActionProfile').value,currentPose=()=>byId('LibraryPose').value;
  function updateList(){const selected=byId('PoseLibrarySelect');selected.replaceChildren(...store.libraries().map(item=>new Option(`${item.name} · r${item.revision}`,item.id)));if(![...selected.options].some(o=>o.value===library.id))selected.add(new Option(library.name,library.id));selected.value=library.id;}
  function updateLink(){const signature=poseLibrarySignature(library);if(getSignature()&&getSignature()!==signature){const previous=getLinkedLibrary();invalidateCaptures('Assigned pose changed',previous?{changedPoses:changedLibraryPoses(previous,library)}:{});}setLink(library,signature);}
  function refresh(){
    const allowed=capturePosesForGroup(currentProfile()),previous=currentPose();
    byId('LibraryPose').replaceChildren(...allowed.map(id=>new Option(ACTION_POSE_LABELS[id],id)));
    byId('LibraryPose').value=allowed.includes(previous)?previous:allowed[0];
    const pose=libraryPoseGroup(library,currentProfile())?.[currentPose()];
    const count=Object.values({...library.profiles,...library.sharedActionGroups}).reduce((n,group)=>n+Object.values(group).filter(Boolean).length,0);
    byId('RecipeSummary').textContent=`${count} assigned poses across weapon and shared groups · ${ACTION_POSE_LABELS[currentPose()]}: ${pose?pose.animation+' @ '+pose.timeSeconds.toFixed(3)+' s':'Not assigned'}`;
    const earlier=Object.entries(library.legacySharedPoses||{}).flatMap(([id,poses])=>allowed.filter(p=>poses[p]).map(p=>[id,p]));
    byId('LegacyRecipePanel').hidden=!earlier.length;
    byId('LegacyRecipe').replaceChildren(...earlier.map(([id,p])=>new Option(`${ACTION_PROFILE_CATALOG.get(id).label}: ${ACTION_POSE_LABELS[p]}`,id+':'+p)));
  }
  function fields(){byId('PoseLibraryName').value=library.name;byId('PoseLibraryId').value=library.id;byId('PoseLibrarySize').value=library.size;updateList();refresh();}
  function readFields(){library=normalizePoseLibrary({...library,id:byId('PoseLibraryId').value.trim(),name:byId('PoseLibraryName').value.trim(),size:byId('PoseLibrarySize').value});return library;}
  function attempt(fn){return async()=>{try{await fn();}catch(error){status(error.message);}};}
  function record(profile,pose,sample){library=recordLibraryPose(readFields(),profile,pose,sample);dirty=true;updateLink();refresh();status('Pose recipe recorded. Save or export the library to keep it.');}
  async function previewPose(profile=currentProfile(),pose=currentPose()){
    const result=resolveLibraryPose(readFields(),profile,pose,getClips());
    await selectProfile(captureGroupForPose(profile,pose));refresh();
    byId('LibraryPose').value=pose;byId('ActionPose').value=pose;await preview(result);updateLink();refresh();return result;
  }
  byId('RestoreLegacyRecipe').addEventListener('click',attempt(()=>{const [id,pose]=byId('LegacyRecipe').value.split(':');record(currentProfile(),pose,library.legacySharedPoses[id][pose]);}));
  byId('RecordRecipe').addEventListener('click',attempt(()=>record(currentProfile(),currentPose(),getSample())));
  byId('PreviewRecipe').addEventListener('click',attempt(()=>previewPose()));
  byId('CaptureRecipe').addEventListener('click',attempt(async()=>{await previewPose();byId('CaptureSelectedPoseButton').click();}));
  byId('SavePoseLibrary').addEventListener('click',attempt(()=>{readFields();if(library.id!==loadedId&&store.library(library.id)?.revision)throw Error('That ID already exists. Use a new library ID.');library=store.saveLibrary(library);loadedId=library.id;dirty=false;updateLink();fields();status(`Saved ${library.name} r${library.revision}. Linked MOBs retain their pinned revision until updated.`);}));
  byId('ExportPoseLibrary').addEventListener('click',attempt(()=>{downloadAuthoringJson(readFields(),`${library.id}.pose-library.json`);dirty=false;status('Exported weapon poses plus one shared Magic and Death/Prone set.');}));
  byId('SeedPoseLibrary').addEventListener('click',attempt(()=>{library=addCaptureRecipes(readFields(),getCaptureRecipes());dirty=true;updateLink();refresh();status('Copied animation references only. Review, save or export this library.');}));
  byId('NewPoseLibrary').addEventListener('click',attempt(()=>{if(dirty)throw Error('Save or export your current library before creating another.');library=createPoseLibrary({id:'humanoid-custom-'+Date.now(),name:'Humanoid Custom'});loadedId=library.id;fields();status('Name the new library, choose its size, then record poses.');}));
  byId('PoseLibrarySelect').addEventListener('change',attempt(()=>{const id=byId('PoseLibrarySelect').value;if(dirty){byId('PoseLibrarySelect').value=library.id;throw Error('Save the current edits before switching libraries.');}library=store.library(id);loadedId=id;updateLink();fields();status(`Selected ${library.name}. Model and equipment settings stay intact.`);}));
  byId('ImportPoseLibrary').addEventListener('click',()=>byId('PoseLibraryFile').click());
  byId('PoseLibraryFile').addEventListener('change',attempt(async()=>{const imported=normalizePoseLibrary(await readAuthoringJson(byId('PoseLibraryFile').files[0]));if(dirty)throw Error('Save the current edits before importing.');const exists=store.library(imported.id);library=exists&&poseLibrarySignature(exists)!==poseLibrarySignature(imported)?{...imported,id:imported.id.slice(0,65)+'-import-'+Date.now(),revision:0}:imported;loadedId=library.id;dirty=true;fields();status('Imported the pose library. Save it to make it available in MOB Creator.');}));
  for(const id of ['PoseLibraryName','PoseLibraryId','PoseLibrarySize'])byId(id).addEventListener('input',()=>{dirty=true;});
  for(const id of ['ActionProfile','ActionPose'])byId(id).addEventListener('change',()=>{byId('LibraryPose').value=byId('ActionPose').value;refresh();});
  window.addEventListener('storage',event=>{if(event.key?.startsWith('adventure-party-authoring:'))status('Authoring data changed in another tab. Reload the saved library before editing it.');});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  fields();if(initialLibrary)updateLink();status(`Ready: ${library.name} · ${library.revision?'saved library':'empty starter; no poses assigned yet'}`);
  return {recordCapture(profile,pose,capture){try{record(profile,pose,{animation:capture.clip,sourceId:capture.clipSourceId,timeSeconds:capture.time});}catch(error){status(error.message);}},previewPose,library:()=>normalizePoseLibrary(library)};
}
