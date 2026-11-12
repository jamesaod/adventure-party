import {validateWorkshopUnit} from './workshop-unit-package.mjs?v=R238C313';
import {validateWorkshopProject} from './mob-workshop-project.mjs?v=R238C313';

const DEFAULT_ROOT=new URL('../',import.meta.url);
function entryPath(entry){
 if(!/^[a-z0-9][a-z0-9-]{1,79}$/.test(entry?.id||'')||entry.file!==`data/mobs/${entry.id}.workshop-unit.json`)
  throw Error('Invalid published Workshop MOB reference.');
 return entry.file;
}
async function json(fetcher,url,label){
 const response=await fetcher(url,{cache:'no-cache'});
 if(!response.ok)throw Error(`${label} could not load (${response.status}).`);
 return response.json();
}
export async function listPublishedWorkshopMobs({root=DEFAULT_ROOT,fetcher=fetch}={}){
 const catalog=await json(fetcher,new URL('data/mob-library.json',root),'MOB library');
 if(!Array.isArray(catalog?.mobs))throw Error('The MOB library has no valid MOB list.');
 const entries=[],ids=new Set();
 for(const entry of catalog.mobs){
  if(!String(entry?.file||'').endsWith('.workshop-unit.json'))continue;
  entryPath(entry);if(ids.has(entry.id))continue;ids.add(entry.id);
  const label=entry.name||entry.id.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' ');
  entries.push({id:entry.id,file:entry.file,label});
 }
 return entries.sort((a,b)=>a.label.localeCompare(b.label));
}
export async function openPublishedWorkshopMob(entry,{root=DEFAULT_ROOT,fetcher=fetch}={}){
 const source=await json(fetcher,new URL(entryPath(entry),root),'Workshop MOB');
 const pack=validateWorkshopUnit(source);
 if(pack.id!==entry.id)throw Error('The MOB package does not match the selected library entry.');
 const response=await fetcher(new URL(pack.model.file,root));
 if(!response.ok)throw Error(`The MOB's model could not load (${response.status}).`);
 const bytes=await response.arrayBuffer();
 if(!bytes.byteLength||bytes.byteLength>150*1024*1024)throw Error('The MOB model must be between 1 byte and 150 MB.');
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==pack.model.sha256)throw Error('The MOB model does not match its published checksum.');
 const project=validateWorkshopProject({draft:pack.draft,files:{'model.bin':bytes}});
 project.draft.publishedSource={id:pack.id,file:entry.file,modelSha256:pack.model.sha256};
 return project;
}
