import {poseChecklist} from './pose-checklist.mjs?v=R238C181';
import {poseWithFallback} from './pose-fallbacks.mjs?v=R238C176';
import {capturePosesForGroup,captureGroupForPose} from './action-capture-groups.mjs?v=R238C176';
import {ACTION_POSE_LABELS,ACTION_PROFILE_CATALOG} from './action-profile-catalog.mjs?v=R238C176';
import {createPoseLibrary,normalizePoseLibrary,recordLibraryPose,addCaptureRecipes,poseLibrarySignature,resolveLibraryPose,libraryPoseGroup,changedLibraryPoses} from './pose-library.mjs?v=R238C176';
import {browserAuthoringStore,readAuthoringJson,downloadAuthoringJson,SHARED_POSE_LIBRARY_ID} from './authoring-store.mjs?v=R238C183';
export function createStudioPoseLibrary({getSample,getClips,preview,selectProfile,getCaptureRecipes,invalidateCaptures,getSignature,getLinkedLibrary,setLink,initialLibrary=null,readOnly=false,getCaptureStates=()=>({}),selectCaptureLibrary=()=>{},copyCaptureLibrary=()=>{},clearCaptures=()=>{},resetAdjustments=async()=>{}}){
  const store=browserAuthoringStore(),panel=document.createElement('div');panel.className='studio-pose-library';panel.id='studioPoseLibraryPanel';
  panel.innerHTML=`<label class="studio-field">Pose library<select id="studioPoseLibrarySelect"></select></label>
  <p class="studio-note">Every capture saves its animation frame here and its sprites/equipment with this model.</p>
  <details class="studio-library-options"><summary>Library settings</summary><div class="studio-recipe-fields"><label class="studio-field">Library name<input id="studioPoseLibraryName" maxlength="160"></label><label class="studio-field">Library ID<input id="studioPoseLibraryId" maxlength="100"></label><label class="studio-field">Humanoid size<select id="studioPoseLibrarySize"><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label></div>
  <div class="studio-sheet-actions"><button id="studioSaveLibraryId" type="button" class="studio-button">Save under new ID</button></div><p class="studio-note">Enter a unique ID using lowercase letters, numbers and hyphens. Saving under a new ID copies this library and this model’s captures; existing MOB links keep the original. Shared keeps its permanent ID.</p><div class="studio-sheet-actions"><button id="studioImportPoseLibrary" type="button" class="studio-button">Import library JSON</button><button id="studioNewPoseLibrary" type="button" class="studio-button">New library from Shared</button></div><input id="studioPoseLibraryFile" type="file" accept=".json,application/json" hidden>
  <div class="studio-sheet-actions"><button id="studioClearPoseLibrary" type="button" class="studio-button">Clear library poses</button><button id="studioDeletePoseLibrary" type="button" class="studio-button">Delete library</button><button id="studioResetModelAdjustments" type="button" class="studio-button">Reset model adjustments</button></div>
  <p class="studio-note">Shared Pose Library is the permanent editable default. Clear removes this library's assignments and captures in this workspace. Reset restores model size/front and equipped-item grips; it keeps pose assignments.</p>
  <div class="studio-sheet-actions"><button id="studioExportLibraryJson" type="button" class="studio-button">Export Pose Library JSON</button></div>
  <p class="studio-note">JSON transfers reusable animation/frame assignments only. Complete Capture ZIP exports this library's model-specific sprites, grips and pose JSON for repository integration. To reuse a ZIP's poses, extract pose-library.json and import it here; importing JSON does not restore sprites.</p>
  <div id="studioLibraryConfirm" role="alert" hidden><p id="studioLibraryConfirmMessage" class="studio-note"></p><div class="studio-sheet-actions"><button id="studioLibraryConfirmYes" type="button" class="studio-button">Confirm</button><button id="studioLibraryConfirmNo" type="button" class="studio-button">Cancel</button></div></div><div id="studioLibraryImportReview" hidden><p id="studioLibraryImportSummary" class="studio-note"></p><label class="studio-field">Import destination<select id="studioLibraryImportMode"><option value="new">New library (keep existing libraries)</option><option value="replace">Replace selected library's poses</option></select></label><div class="studio-sheet-actions"><button id="studioApplyLibraryImport" type="button" class="studio-button">Import reviewed JSON</button><button id="studioCancelLibraryImport" type="button" class="studio-button">Cancel import</button></div></div>
  <div id="studioLegacyRecipePanel" class="studio-sheet-actions" hidden><select id="studioLegacyRecipe" aria-label="Earlier shared pose recipes"></select><button id="studioRestoreLegacyRecipe" type="button" class="studio-button">Restore earlier recipe</button></div></details>
  <p id="studioPoseLibraryStatus" class="studio-note" role="status" aria-live="polite"></p>`;
  document.getElementById('studioPoseLibraryMount').append(panel);
  const byId=id=>document.getElementById('studio'+id),status=(message,failed=false)=>{byId('PoseLibraryStatus').textContent=message;byId('PoseLibraryStatus').classList.toggle('error',failed);};
  const previewButton=document.createElement('button');previewButton.type='button';previewButton.className='studio-button';previewButton.id='studioPreviewRecipe';previewButton.textContent='Preview saved pose';byId('CaptureSelectedPoseButton').after(previewButton);
  const summary=document.createElement('p');summary.id='studioRecipeSummary';summary.className='studio-note';byId('CaptureProfileSummary').after(summary);
  const checklist=document.createElement('section');checklist.className='studio-panel chrome studio-pose-checklist';checklist.innerHTML='<h2>Pose Checklist</h2><p id="studioChecklistSummary" class="studio-note"></p><ul id="studioChecklistRows"></ul>';
  document.getElementById('studioCaptureChecklistMount')?.append(checklist);
  let pendingImport=null;
  let library=normalizePoseLibrary(initialLibrary||store.library(SHARED_POSE_LIBRARY_ID)),loadedId=library.id,dirty=false;
  const latest=store.library(library.id);if(!readOnly&&latest&&latest.revision>library.revision)library=latest;
  const currentProfile=()=>byId('ActionProfile').value,currentPose=()=>byId('ActionPose').value;
  const count=()=>Object.values({...library.profiles,...library.sharedActionGroups}).reduce((n,group)=>n+Object.values(group).filter(Boolean).length,0);
  function updateList(){const selected=byId('PoseLibrarySelect');selected.replaceChildren(...store.libraries().map(item=>new Option(`${item.id===SHARED_POSE_LIBRARY_ID?'Shared Pose Library':item.name} · r${item.revision}`,item.id)));if(![...selected.options].some(o=>o.value===library.id))selected.add(new Option(library.name,library.id));selected.value=library.id;}
  function updateLink(){selectCaptureLibrary(library.id);const signature=poseLibrarySignature(library);if(getSignature()&&getSignature()!==signature){const previous=getLinkedLibrary();invalidateCaptures('Assigned pose changed',previous?{changedPoses:changedLibraryPoses(previous,library)}:{});}setLink(library,signature);}
  function refresh(){
    const rows=poseChecklist(library,getCaptureStates());
    const list=byId('ChecklistRows');
    if(list){list.replaceChildren(...rows.map(row=>{const li=document.createElement('li');li.className='pose-check-'+row.state;
      li.textContent=`${row.state==='captured'?'✓':row.state==='outdated'?'⚠':'✓'} ${row.label} — ${row.state==='captured'?'Captured':row.state==='outdated'?'Outdated snapshot; recapture':row.assigned?'Frame assigned; sprites not captured':'Not captured; frame unassigned'}`;return li;}));
      byId('ChecklistSummary').textContent=`${rows.filter(r=>r.state==='captured').length} captured · ${rows.filter(r=>r.state==='missing').length} missing · ${rows.filter(r=>r.state==='outdated').length} outdated. Green = current sprites; red = missing; amber = preserved old snapshot.`;}
    byId('DeletePoseLibrary').disabled=readOnly||library.id===SHARED_POSE_LIBRARY_ID;

    const allowed=capturePosesForGroup(currentProfile()),pose=libraryPoseGroup(library,currentProfile())?.[currentPose()];
    summary.textContent=`${count()} frame references · ${ACTION_POSE_LABELS[currentPose()]}: ${pose?pose.animation+' @ '+pose.timeSeconds.toFixed(3)+' s':'No frame captured yet'}`;
    const fallback=poseWithFallback(library.profiles,library.sharedActionGroups,currentProfile(),currentPose());
    previewButton.disabled=!fallback;
    if(!pose&&fallback)summary.textContent+=` · Fallback: 1H Swing ${ACTION_POSE_LABELS[fallback.pose]}`;
    const earlier=Object.entries(library.legacySharedPoses||{}).flatMap(([id,poses])=>allowed.filter(p=>poses[p]).map(p=>[id,p]));
    byId('LegacyRecipePanel').hidden=!earlier.length;
    byId('LegacyRecipe').replaceChildren(...earlier.map(([id,p])=>new Option(`${ACTION_PROFILE_CATALOG.get(id).label}: ${ACTION_POSE_LABELS[p]}`,id+':'+p)));
  }
  function fields(){byId('PoseLibraryId').disabled=readOnly;byId('PoseLibraryName').disabled=readOnly||library.id===SHARED_POSE_LIBRARY_ID;byId('PoseLibraryName').value=library.id===SHARED_POSE_LIBRARY_ID?'Shared Pose Library':library.name;byId('PoseLibraryId').value=library.id;byId('PoseLibrarySize').value=library.size;updateList();refresh();}
  function readFields(){return normalizePoseLibrary({...library,id:library.id,name:byId('PoseLibraryName').value.trim(),size:byId('PoseLibrarySize').value});}
  function persist(){
    dirty=true;
    try{if(library.id!==loadedId&&store.library(library.id)?.revision)throw Error('That library ID already exists. Use a new ID.');library=store.saveLibrary(library);loadedId=library.id;dirty=false;status(`Frame references saved automatically · ${library.name} r${library.revision}`);}
    catch(error){status(`Frame references are unsaved in the library: ${error.message} Export action poses (ZIP) to preserve the open copy.`,true);}
    updateLink();fields();return !dirty;
  }
  function attempt(fn){return async()=>{try{if(readOnly)throw Error('This is a read-only MOB preview. Open editable Studio to make changes.');await fn();}catch(error){status(error.message,true);}};}
  function record(profile,pose,sample){library=recordLibraryPose(readFields(),profile,pose,sample);persist();}
  async function previewPose(profile=currentProfile(),pose=currentPose()){
    const result=resolveLibraryPose(library,profile,pose,getClips());
    await selectProfile(captureGroupForPose(profile,pose));byId('ActionPose').value=pose;await preview(result);refresh();return result;
  }
  byId('RestoreLegacyRecipe').addEventListener('click',attempt(()=>{const [id,pose]=byId('LegacyRecipe').value.split(':');record(currentProfile(),pose,library.legacySharedPoses[id][pose]);}));
  previewButton.addEventListener('click',attempt(()=>previewPose()));
  let confirmation=null;
  const confirmChange=message=>new Promise(resolve=>{if(confirmation)confirmation(false);byId('LibraryConfirmMessage').textContent=message;byId('LibraryConfirm').hidden=false;const id=library.id;confirmation=answer=>{byId('LibraryConfirm').hidden=true;confirmation=null;resolve(answer&&library.id===id);};});
  byId('LibraryConfirmYes').addEventListener('click',()=>confirmation?.(true));
  byId('LibraryConfirmNo').addEventListener('click',()=>confirmation?.(false));
  const ensureSaved=()=>{if(dirty)throw Error('Export Pose Library JSON or Complete Capture ZIP before leaving unsaved work.');};
  function useLibrary(next){library=normalizePoseLibrary(next);loadedId=library.id;updateLink();fields();}
  byId('NewPoseLibrary').addEventListener('click',attempt(()=>{ensureSaved();library={...store.library(SHARED_POSE_LIBRARY_ID),id:'humanoid-custom-'+Date.now(),name:'New library from Shared',revision:0};persist();}));
  byId('PoseLibrarySelect').addEventListener('change',attempt(()=>{const id=byId('PoseLibrarySelect').value;byId('PoseLibrarySelect').value=library.id;ensureSaved();const next=store.library(id);if(!next)throw Error('This library was deleted.');useLibrary(next);status(`Loaded ${library.name}. Its captures for this model are shown below.`);}));
  byId('ClearPoseLibrary').addEventListener('click',attempt(async()=>{ensureSaved();if(!await confirmChange(`Clear all pose assignments in ${library.name} and its captures in this workspace? Export first to keep a backup. Other libraries and pinned MOB copies are unchanged.`))return;
    library=createPoseLibrary({id:library.id,name:library.name,size:library.size});library.revision=store.library(library.id)?.revision||0;
    if(persist()){clearCaptures();refresh();status('Library poses cleared. Model and grip adjustments were kept.');}}));
  byId('DeletePoseLibrary').addEventListener('click',attempt(async()=>{ensureSaved();if(library.id===SHARED_POSE_LIBRARY_ID)throw Error('Shared Pose Library cannot be deleted.');if(!await confirmChange(`Delete ${library.name} and its captures in this workspace? Export first to keep a backup. Pinned MOB copies and other model workspaces are unchanged.`))return;
    store.deleteLibrary(library.id,library.revision);clearCaptures();useLibrary(store.library(SHARED_POSE_LIBRARY_ID));status('Library deleted. Shared Pose Library is selected.');}));
  byId('ResetModelAdjustments').addEventListener('click',attempt(async()=>{if(!await confirmChange('Reset model size to 100%, front direction to 0°, and current equipment grips to defaults? Pose assignments stay saved; existing sprites become outdated.'))return;await resetAdjustments();refresh();status('Model size, front and grips reset. Recapture affected sprites.');}));
  byId('ExportLibraryJson').addEventListener('click',()=>{downloadAuthoringJson(library,library.id+'.pose-library.json');status(`Exported ${count()} frame references as JSON. No sprites or grips are included.`);});
  byId('ImportPoseLibrary').addEventListener('click',()=>{byId('PoseLibraryFile').value='';byId('PoseLibraryFile').click();});
  byId('PoseLibraryFile').addEventListener('change',attempt(async()=>{ensureSaved();pendingImport=normalizePoseLibrary(await readAuthoringJson(byId('PoseLibraryFile').files[0]));
    const assigned=Object.values({...pendingImport.profiles,...pendingImport.sharedActionGroups}).reduce((n,g)=>n+Object.values(g).filter(Boolean).length,0);
    byId('LibraryImportSummary').textContent=`Pose Library JSON: ${pendingImport.name} · ${assigned} frame assignments · ${pendingImport.size}. Contains no sprites, models or grip settings. Replacement target: ${library.name}.`;
    byId('LibraryImportMode').value='new';byId('LibraryImportReview').hidden=false;}));
  byId('CancelLibraryImport').addEventListener('click',()=>{pendingImport=null;byId('LibraryImportReview').hidden=true;});
  byId('ApplyLibraryImport').addEventListener('click',attempt(async()=>{ensureSaved();if(!pendingImport)throw Error('Choose a JSON file first.');const replace=byId('LibraryImportMode').value==='replace';
    if(replace&&!await confirmChange(`Replace all assignments in ${library.name} and clear its captures in this workspace? Other libraries are preserved.`))return;
    library=replace?{...pendingImport,id:library.id,name:library.name,revision:library.revision}:{...pendingImport,id:'humanoid-import-'+Date.now(),revision:0};
    if(persist()){if(replace)clearCaptures();pendingImport=null;byId('LibraryImportReview').hidden=true;refresh();status('Pose references imported. Capture them on this model to create sprites.');}}));
  byId('SaveLibraryId').addEventListener('click',attempt(()=>{ensureSaved();const id=byId('PoseLibraryId').value.trim();
    if(id===library.id){status('This is already the current library ID.');return;}
    const next=normalizePoseLibrary({...readFields(),id,revision:0,name:library.id===SHARED_POSE_LIBRARY_ID?'Copy of Shared Pose Library':byId('PoseLibraryName').value.trim()});
    if(store.library(id))throw Error('That library ID already exists. Choose a unique ID.');
    const saved=store.saveLibrary(next);copyCaptureLibrary(id);useLibrary(saved);status(`Saved under ${id}. Poses and this model’s captures copied; the original library and existing MOB links are unchanged.`);
  }));
  for(const id of ['PoseLibraryName','PoseLibrarySize'])byId(id).addEventListener('change',attempt(()=>{library=readFields();persist();}));
  for(const id of ['ActionProfile','ActionPose'])byId(id).addEventListener('change',refresh);
  document.addEventListener('studio-captures-changed',refresh);
  window.addEventListener('storage',event=>{if(event.key?.startsWith('adventure-party-authoring:'))status('This library changed in another tab. Export open work before selecting the saved library again.',true);});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  for(const id of ['SaveLibraryId','ClearPoseLibrary','ResetModelAdjustments','ImportPoseLibrary','NewPoseLibrary','ApplyLibraryImport','PoseLibrarySize'])byId(id).disabled=readOnly;
  selectCaptureLibrary(library.id);fields();
  // Older workspaces can have pixels but an empty starter library. Seed once,
  // automatically; never overwrite an already assigned reusable library.
  if(!readOnly&&!count()){
    const recovered=addCaptureRecipes(library,getCaptureRecipes());
    if(poseLibrarySignature(recovered)!==poseLibrarySignature(library)){library=recovered;persist();}
    else{updateLink();status('Choose a pose and capture its frame. Sprites and frame references save together.');}
  }else{updateLink();status(`Using ${library.name} · Frame references save automatically when you capture.`);}
  return {recordCapture(profile,pose){record(profile,pose,getSample());},previewPose,library:()=>normalizePoseLibrary(library)};
}
