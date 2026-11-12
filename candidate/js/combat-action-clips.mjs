import * as THREE from '../assets/vendor/three/three.module.min.js';
import {sliceAnimationClip} from './studio-animations.mjs?v=R238C82';

export const ACTION_KINDS=['attack','death'];
export function createActionEntry(model,clip,{name,kind,start,end,speed=1,id=crypto.randomUUID()}){
 if(!ACTION_KINDS.includes(kind)||!name?.trim())throw Error('Choose an action and give it a name.');
 if(!Number.isFinite(speed)||speed<.1||speed>4)throw Error('Speed must be between 0.1 and 4.');
 const trimmed=sliceAnimationClip(clip,start,end,name.trim());
 // Studio bindings contain session UUIDs. Store unique node names, then bind
 // them to the freshly loaded rig at runtime. Never reuse another model’s rig.
 for(const track of trimmed.tracks){
  const dot=track.name.lastIndexOf('.'),nodeName=track.name.slice(0,dot),property=track.name.slice(dot);
  const node=model.getObjectByProperty('uuid',nodeName)||model.getObjectByName(nodeName);
  if(!node?.name)throw Error(`Cannot export animation binding: ${track.name}`);
  let matches=0;model.traverse(o=>{if(o.name===node.name)matches++;});
  if(matches!==1)throw Error(`Animation node name is not unique: ${node.name}`);
  track.name=node.name+property;
 }
 return {id,name:name.trim(),kind,start,end,speed,source:clip.name,clip:THREE.AnimationClip.toJSON(trimmed)};
}
export function bindActionEntry(model,entry){
 const clip=THREE.AnimationClip.parse(entry.clip);
 for(const track of clip.tracks){const dot=track.name.lastIndexOf('.'),node=model.getObjectByName(track.name.slice(0,dot));
  if(!node)throw Error(`Action ${entry.name} is missing its model node: ${track.name}`);
  track.name=node.uuid+track.name.slice(dot);
 }
 return clip;
}
export function validateActionLibrary(library,modelId=library?.modelId){
 if(library?.version!==1||!modelId||library.modelId!==modelId||!Array.isArray(library.entries))throw Error('Animation library does not match this model.');
 const ids=new Set();
 for(const e of library.entries){
  if(!e.id||ids.has(e.id)||!ACTION_KINDS.includes(e.kind)||!e.name||!Number.isFinite(e.speed)||e.speed<.1||e.speed>4||!(e.clip?.duration>0)||!e.clip.tracks?.length)throw Error('Invalid action animation.');
  ids.add(e.id);
 }
 return library;
}
export function actionSample(entry,elapsed){return Math.max(0,Math.min(entry.clip.duration,elapsed*entry.speed));}
export function chooseDeath(entries,random=Math.random){const deaths=entries.filter(e=>e.kind==='death');return deaths.length?deaths[Math.min(deaths.length-1,Math.floor(Math.max(0,random())*deaths.length))]:null;}
let connection;
async function store(mode,fn){
 connection ||= new Promise((resolve,reject)=>{const r=indexedDB.open('adventure-party-action-clips:'+new URL('.',location.href).pathname,1);r.onupgradeneeded=()=>r.result.createObjectStore('models');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const db=await connection;return new Promise((resolve,reject)=>{const tx=db.transaction('models',mode),r=fn(tx.objectStore('models'));tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
}
export async function readActionLibrary(modelId){
 let saved;try{saved=await store('readonly',s=>s.get(modelId));}catch(error){console.warn('Local action library unavailable',error);}
 if(saved)return validateActionLibrary(saved,modelId);
 const response=await fetch(new URL('../assets/animations/actions/'+encodeURIComponent(modelId)+'.json',import.meta.url));
 if(response.status===404)return null;
 if(!response.ok)throw Error('Could not load action library ('+response.status+').');
 return validateActionLibrary(await response.json(),modelId);
}
export const saveActionLibrary=library=>{validateActionLibrary(library);return store('readwrite',s=>s.put(library,library.modelId));};
