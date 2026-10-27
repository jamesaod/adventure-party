import {createPoseLibrary,normalizePoseLibrary,poseLibrarySignature} from './pose-library.mjs?v=R238C172';
import {normalizeMobDefinition} from './mob-definition.mjs?v=R238C172';
export function createAuthoringStore(storage,scope){
  const key=`adventure-party-authoring:${scope}`;
  function read(){
    const text=storage.getItem(key);if(!text)return {version:1,libraries:[],mobs:[]};
    let data;try{data=JSON.parse(text);}catch{throw Error('Authoring storage is unreadable. Export your open work before resetting storage.');}
    if(data.version!==1||!Array.isArray(data.libraries)||!Array.isArray(data.mobs))throw Error('Unsupported authoring storage.');
    return {version:1,libraries:data.libraries.map(normalizePoseLibrary),mobs:data.mobs.map(normalizeMobDefinition)};
  }
  function write(data){try{storage.setItem(key,JSON.stringify(data));}catch{throw Error('Browser storage could not save this draft. Export JSON to keep your work.');}}
  const seeds=()=>['small','medium','large'].map(size=>createPoseLibrary({id:`humanoid-${size}`,name:`Humanoid ${size[0].toUpperCase()+size.slice(1)}`,size}));
  function libraries(){const data=read();return [...seeds().filter(seed=>!data.libraries.some(item=>item.id===seed.id)),...data.libraries];}
  function saveLibrary(value){
    const next=normalizePoseLibrary(value),data=read(),old=data.libraries.find(item=>item.id===next.id);
    if(old&&old.revision!==next.revision)throw Error('This pose library changed in another tab. Reload it before saving.');
    if(old&&poseLibrarySignature(old)===poseLibrarySignature(next))return old;
    next.revision=(old?.revision||0)+1;data.libraries=data.libraries.filter(item=>item.id!==next.id).concat(next);write(data);return next;
  }
  function saveMob(value){
    const next=normalizeMobDefinition(value),data=read(),old=data.mobs.find(item=>item.id===next.id);
    if(old&&old.mob.revision!==next.mob.revision)throw Error('This MOB changed in another tab. Reopen it before saving.');
    next.mob.revision=(old?.mob.revision||0)+1;data.mobs=data.mobs.filter(item=>item.id!==next.id).concat(next);write(data);return next;
  }
  return {libraries,library:id=>libraries().find(item=>item.id===id)||null,mobs:()=>read().mobs,mob:id=>read().mobs.find(item=>item.id===id)||null,saveLibrary,saveMob};
}
export function browserAuthoringStore(){return createAuthoringStore(localStorage,new URL('.',location.href).pathname);}
export function downloadAuthoringJson(value,filename){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function readAuthoringJson(file){if(!file||file.size>2*1024*1024)throw Error('Choose a JSON file smaller than 2 MB.');try{return JSON.parse(await file.text());}catch{throw Error('The selected file is not valid JSON.');}}
