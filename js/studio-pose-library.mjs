import {capturePosesForGroup,captureGroupForPose} from './action-capture-groups.mjs?v=R238C172';
import {ACTION_POSE_LABELS,ACTION_PROFILE_CATALOG} from './action-profile-catalog.mjs?v=R238C172';
import {createPoseLibrary,normalizePoseLibrary,recordLibraryPose,addCaptureRecipes,poseLibrarySignature,resolveLibraryPose,libraryPoseGroup,changedLibraryPoses} from './pose-library.mjs?v=R238C172';
import {browserAuthoringStore,readAuthoringJson} from './authoring-store.mjs?v=R238C172';
export function createStudioPoseLibrary({getSample,getClips,preview,selectProfile,getCaptureRecipes,invalidateCaptures,getSignature,getLinkedLibrary,setLink,initialLibrary=null,readOnly=false}){
  const store=browserAuthoringStore(),panel=document.createElement('div');panel.className='studio-pose-library';panel.id='studioPoseLibraryPanel';
  panel.innerHTML=`<label class="studio-field">Pose library<select id="studioPoseLibrarySelect"></select></label>
  <p class="studio-note">Every capture saves its animation frame here and its sprites/equipment with this model.</p>
  <details class="studio-library-options"><summary>Library settings</summary><div class="studio-recipe-fields"><label class="studio-field">Library name<input id="studioPoseLibraryName" maxlength="160"></label><label class="studio-field">Library ID<input id="studioPoseLibraryId" maxlength="100"></label><label class="studio-field">Humanoid size<select id="studioPoseLibrarySize"><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label></div>
  <div class="studio-sheet-actions"><button id="studioImportPoseLibrary" type="button" class="studio-button">Import library JSON</button><button id="studioNewPoseLibrary" type="button" class="studio-button">New library</button></div><input id="studioPoseLibraryFile" type="file" accept=".json,application/json" hidden>
  <div id="studioLegacyRecipePanel" class="studio-sheet-actions" hidden><select id="studioLegacyRecipe" aria-label="Earlier shared pose recipes"></select><button id="studioRestoreLegacyRecipe" type="button" class="studio-button">Restore earlier recipe</button></div></details>
  <p id="studioPoseLibraryStatus" class="studio-note" role="status" aria-live="polite"></p>`;
  document.getElementById('studioPoseLibraryMount').append(panel);
  const byId=id=>document.getElementById('studio'+id),status=(message,failed=false)=>{byId('PoseLibraryStatus').textContent=message;byId('PoseLibraryStatus').classList.toggle('error',failed);};
  const previewButton=document.createElement('button');previewButton.type='button';previewButton.className='studio-button';previewButton.id='studioPreviewRecipe';previewButton.textContent='Preview saved pose';byId('CaptureSelectedPoseButton').after(previewButton);
  const summary=document.createElement('p');summary.id='studioRecipeSummary';summary.className='studio-note';byId('CaptureProfileSummary').after(summary);
  let library=normalizePoseLibrary(initialLibrary||store.library('humanoid-medium')),loadedId=library.id,dirty=false;
  const currentProfile=()=>byId('ActionProfile').value,currentPose=()=>byId('ActionPose').value;
  const count=()=>Object.values({...library.profiles,...library.sharedActionGroups}).reduce((n,group)=>n+Object.values(group).filter(Boolean).length,0);
  function updateList(){const selected=byId('PoseLibrarySelect');selected.replaceChildren(...store.libraries().map(item=>new Option(`${item.name} · r${item.revision}`,item.id)));if(![...selected.options].some(o=>o.value===library.id))selected.add(new Option(library.name,library.id));selected.value=library.id;}
  function updateLink(){const signature=poseLibrarySignature(library);if(getSignature()&&getSignature()!==signature){const previous=getLinkedLibrary();invalidateCaptures('Assigned pose changed',previous?{changedPoses:changedLibraryPoses(previous,library)}:{});}setLink(library,signature);}
  function refresh(){
    const allowed=capturePosesForGroup(currentProfile()),pose=libraryPoseGroup(library,currentProfile())?.[currentPose()];
    summary.textContent=`${count()} frame references · ${ACTION_POSE_LABELS[currentPose()]}: ${pose?pose.animation+' @ '+pose.timeSeconds.toFixed(3)+' s':'No frame captured yet'}`;
    previewButton.disabled=!pose;
    const earlier=Object.entries(library.legacySharedPoses||{}).flatMap(([id,poses])=>allowed.filter(p=>poses[p]).map(p=>[id,p]));
    byId('LegacyRecipePanel').hidden=!earlier.length;
    byId('LegacyRecipe').replaceChildren(...earlier.map(([id,p])=>new Option(`${ACTION_PROFILE_CATALOG.get(id).label}: ${ACTION_POSE_LABELS[p]}`,id+':'+p)));
  }
  function fields(){byId('PoseLibraryName').value=library.name;byId('PoseLibraryId').value=library.id;byId('PoseLibrarySize').value=library.size;updateList();refresh();}
  function readFields(){return normalizePoseLibrary({...library,id:byId('PoseLibraryId').value.trim(),name:byId('PoseLibraryName').value.trim(),size:byId('PoseLibrarySize').value});}
  function persist(){
    dirty=true;
    try{if(library.id!==loadedId&&store.library(library.id)?.revision)throw Error('That library ID already exists. Use a new ID.');library=store.saveLibrary(library);loadedId=library.id;dirty=false;status(`Frame references saved automatically · ${library.name} r${library.revision}`);}
    catch(error){status(`Frame references are unsaved in the library: ${error.message} Export action poses (ZIP) to preserve the open copy.`,true);}
    updateLink();fields();
  }
  function attempt(fn){return async()=>{try{await fn();}catch(error){status(error.message,true);}};}
  function record(profile,pose,sample){library=recordLibraryPose(readFields(),profile,pose,sample);persist();}
  async function previewPose(profile=currentProfile(),pose=currentPose()){
    const result=resolveLibraryPose(library,profile,pose,getClips());
    await selectProfile(captureGroupForPose(profile,pose));byId('ActionPose').value=pose;await preview(result);refresh();return result;
  }
  byId('RestoreLegacyRecipe').addEventListener('click',attempt(()=>{const [id,pose]=byId('LegacyRecipe').value.split(':');record(currentProfile(),pose,library.legacySharedPoses[id][pose]);}));
  previewButton.addEventListener('click',attempt(()=>previewPose()));
  byId('NewPoseLibrary').addEventListener('click',attempt(()=>{if(dirty)throw Error('Export action poses before switching away from unsaved references.');library=createPoseLibrary({id:'humanoid-custom-'+Date.now(),name:'Humanoid Custom'});persist();}));
  byId('PoseLibrarySelect').addEventListener('change',attempt(()=>{const id=byId('PoseLibrarySelect').value;if(dirty){byId('PoseLibrarySelect').value=library.id;throw Error('Export action poses before switching away from unsaved references.');}library=store.library(id);loadedId=id;updateLink();fields();status(`Using ${library.name}. New captures save their frames here automatically.`);}));
  byId('ImportPoseLibrary').addEventListener('click',()=>byId('PoseLibraryFile').click());
  byId('PoseLibraryFile').addEventListener('change',attempt(async()=>{if(dirty)throw Error('Export action poses before importing another library.');const imported=normalizePoseLibrary(await readAuthoringJson(byId('PoseLibraryFile').files[0]));const exists=store.library(imported.id);library=exists&&poseLibrarySignature(exists)!==poseLibrarySignature(imported)?{...imported,id:imported.id.slice(0,65)+'-import-'+Date.now(),revision:0}:imported;persist();}));
  for(const id of ['PoseLibraryName','PoseLibraryId','PoseLibrarySize'])byId(id).addEventListener('change',attempt(()=>{library=readFields();persist();}));
  for(const id of ['ActionProfile','ActionPose'])byId(id).addEventListener('change',refresh);
  document.addEventListener('studio-captures-changed',refresh);
  window.addEventListener('storage',event=>{if(event.key?.startsWith('adventure-party-authoring:'))status('This library changed in another tab. Export open work before selecting the saved library again.',true);});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  fields();
  // Older workspaces can have pixels but an empty starter library. Seed once,
  // automatically; never overwrite an already assigned reusable library.
  if(!readOnly&&!count()){
    const recovered=addCaptureRecipes(library,getCaptureRecipes());
    if(poseLibrarySignature(recovered)!==poseLibrarySignature(library)){library=recovered;persist();}
    else{updateLink();status('Choose a pose and capture its frame. Sprites and frame references save together.');}
  }else{updateLink();status(`Using ${library.name} · Frame references save automatically when you capture.`);}
  return {recordCapture(profile,pose){record(profile,pose,getSample());},previewPose,library:()=>normalizePoseLibrary(library)};
}
