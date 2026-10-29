import {ORC_FIGHTER_POSE_LIBRARY} from './orc-fighter-pose-library.mjs?v=R238C196';
import {DEFAULT_MEDIUM_POSE_LIBRARY} from './default-pose-library.mjs?v=R238C196';
import {createPoseLibrary,normalizePoseLibrary,poseLibrarySignature} from './pose-library.mjs?v=R238C196';
import {normalizeMobDefinition} from './mob-definition.mjs?v=R238C198';
export const SHARED_POSE_LIBRARY_ID='humanoid-medium';
export function createAuthoringStore(storage,scope){
  const key=`adventure-party-authoring:${scope}`;
  function read(){
    const text=storage.getItem(key);if(!text)return {version:1,libraries:[],mobs:[]};
    let data;try{data=JSON.parse(text);}catch{throw Error('Authoring storage is unreadable. Export your open work before resetting storage.');}
    if(data.version!==1||!Array.isArray(data.libraries)||!Array.isArray(data.mobs))throw Error('Unsupported authoring storage.');
    return {version:1,deletedLibraryIds:data.deletedLibraryIds||[],libraries:data.libraries.map(normalizePoseLibrary),mobs:data.mobs.map(normalizeMobDefinition)};
  }
  function write(data){try{storage.setItem(key,JSON.stringify(data));}catch{throw Error('Browser storage could not save this draft. Export JSON to keep your work.');}}
  const seeds=()=>['small','medium','large'].map(size=>createPoseLibrary({id:`humanoid-${size}`,name:size==='medium'?'Shared Pose Library':`Humanoid ${size[0].toUpperCase()+size.slice(1)}`,size})).concat(normalizePoseLibrary({...DEFAULT_MEDIUM_POSE_LIBRARY,id:'humanoid-medium-user-r16',name:'Humanoid Medium — supplied poses',revision:0}),normalizePoseLibrary(ORC_FIGHTER_POSE_LIBRARY));
  function libraries(){const data=read();return [...seeds().filter(seed=>!(data.deletedLibraryIds||[]).includes(seed.id)&&!data.libraries.some(item=>item.id===seed.id)),...data.libraries];}
  function saveLibrary(value){
    const next=normalizePoseLibrary(value),data=read(),old=data.libraries.find(item=>item.id===next.id);
    if((data.deletedLibraryIds||[]).includes(next.id))throw Error('This library was deleted. Import it as a new library to recover it.');
    if(old&&old.revision!==next.revision)throw Error('This pose library changed in another tab. Reload it before saving.');
    if(old&&poseLibrarySignature(old)===poseLibrarySignature(next))return old;
    data.deletedLibraryIds=(data.deletedLibraryIds||[]).filter(id=>id!==next.id);
    next.revision=(old?.revision||0)+1;data.libraries=data.libraries.filter(item=>item.id!==next.id).concat(next);write(data);return next;
  }
  function deleteLibrary(id,revision){
    if(id===SHARED_POSE_LIBRARY_ID)throw Error('Shared Pose Library cannot be deleted.');
    const data=read(),old=libraries().find(item=>item.id===id);
    if(!old||old.revision!==revision)throw Error('This library changed. Reload it before deleting.');
    data.libraries=data.libraries.filter(item=>item.id!==id);
    data.deletedLibraryIds=[...new Set([...(data.deletedLibraryIds||[]),id])];write(data);
  }
  function saveMob(value){
    const next=normalizeMobDefinition(value),data=read(),old=data.mobs.find(item=>item.id===next.id);
    if(old&&old.mob.revision!==next.mob.revision)throw Error('This MOB changed in another tab. Reopen it before saving.');
    next.mob.revision=(old?.mob.revision||0)+1;data.mobs=data.mobs.filter(item=>item.id!==next.id).concat(next);write(data);return next;
  }
  return {deleteLibrary,libraries,library:id=>libraries().find(item=>item.id===id)||null,mobs:()=>read().mobs,mob:id=>read().mobs.find(item=>item.id===id)||null,saveLibrary,saveMob};
}
export function browserAuthoringStore(){return createAuthoringStore(localStorage,new URL('.',location.href).pathname);}
export function downloadAuthoringJson(value,filename){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function readAuthoringJson(file){if(!file||file.size>2*1024*1024)throw Error('Choose a JSON file smaller than 2 MB.');try{return JSON.parse(await file.text());}catch{throw Error('The selected file is not valid JSON.');}}
