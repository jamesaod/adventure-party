import {readFile,writeFile,mkdir,rename,unlink,open} from 'node:fs/promises';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {readWorkshopArchive,prepareWorkshopUnit} from './publish-workshop-unit.mjs';
import {quickCheckWorkshopUnit} from './workshop-import-checks.mjs';

const DEFAULT_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const same=(a,b)=>a===null?b===null:b!==null&&Buffer.from(a).equals(Buffer.from(b));
async function optionalRead(path){try{return await readFile(path);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function atomicWrite(path,bytes){
 await mkdir(dirname(path),{recursive:true});const temp=path+'.import-'+randomUUID()+'.tmp';
 try{await writeFile(temp,bytes);await rename(temp,path);}finally{await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
function stableId(id){if(!/^[a-z0-9][a-z0-9-]{1,79}$/.test(id||''))throw Error('Use a stable lowercase MOB ID.');return id;}
function packagePath(entry){stableId(entry.id);const path=`data/mobs/${entry.id}.workshop-unit.json`;if(entry.file!==path)throw Error('ID belongs to a non-Workshop or mismatched MOB: '+entry.id);return path;}
async function chooseId(draft,manifest,root,{id,newId}){
 if(id&&newId)throw Error('Choose replacement (--id) or creation (--new), not both.');
 if(newId){stableId(newId);if(manifest.mobs.some(m=>m.id===newId))throw Error('New MOB ID already exists: '+newId);return newId;}
 if(id)return stableId(id);
 if(draft.publishedSource?.id)return stableId(draft.publishedSource.id);
 const name=String(draft.name||'').trim().toLowerCase(),matches=[];
 for(const entry of manifest.mobs.filter(m=>m.file?.endsWith('.workshop-unit.json'))){
  const pack=JSON.parse(await readFile(resolve(root,packagePath(entry)),'utf8'));
  if(String(pack.name).trim().toLowerCase()===name)matches.push(entry.id);
 }
 if(matches.length!==1)throw Error(matches.length?'Multiple MOBs share that name; specify --id.':'No existing MOB matches this export. Use --id for a replacement or --new <stable-id> for an explicitly requested new MOB.');
 return matches[0];
}
export async function verifyLiveWorkshopImport(baseUrl,pack,{fetcher=fetch}={}){
 const base=new URL(baseUrl);if(!base.pathname.endsWith('/'))base.pathname+='/';
 const get=async path=>{const response=await fetcher(new URL(path,base),{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error(`HTTP ${response.status}: ${path}`);return response.json();};
 const [manifest,served]=await Promise.all([get('data/mob-library.json'),get(`data/mobs/${pack.id}.workshop-unit.json`)]);
 const entries=manifest.mobs.filter(m=>m.id===pack.id);assert.equal(entries.length,1,'Live MOB entry must be unique');packagePath(entries[0]);
 assert.deepEqual(served,pack,'Live package differs from imported package');return 'passed';
}

export async function importWorkshopMob(zipPath,{root=DEFAULT_ROOT,id,newId,check=false,baseUrl,fetcher=fetch,writer=atomicWrite}={}){
 const started=performance.now();root=resolve(root);
 const manifestPath=resolve(root,'data/mob-library.json');
 const [archive,manifestBytes]=await Promise.all([readWorkshopArchive(zipPath),readFile(manifestPath)]);
 const manifest=JSON.parse(manifestBytes);if(!Array.isArray(manifest.mobs))throw Error('Invalid MOB library.');
 assert.equal(new Set(manifest.mobs.map(m=>m.id)).size,manifest.mobs.length,'Duplicate MOB IDs in the library');
 const target=await chooseId(archive.draft,manifest,root,{id,newId}),prior=manifest.mobs.find(m=>m.id===target);
 if(!newId&&!prior)throw Error('Replacement ID does not exist: '+target+'. No MOB was created.');
 if(prior)packagePath(prior);
 const pack=prepareWorkshopUnit(archive,target),packPath=`data/mobs/${target}.workshop-unit.json`,oldBytes=await optionalRead(resolve(root,packPath));
 const old=oldBytes?JSON.parse(oldBytes):null;
 if(prior&&(!old||old.id!==target))throw Error('Existing package is missing or has a mismatched identity.');
 if(newId&&old)throw Error('A package already occupies the requested new ID.');
 if(old)pack.mob={...pack.mob,...old.mob}; // Keep availability and other library metadata.
 const checks=quickCheckWorkshopUnit(pack);
 const nextManifest=prior?manifest:{...manifest,mobs:[...manifest.mobs,{id:target,file:packPath,encounterType:'workshop-'+target}]};
 const desired=[
  [pack.model.file,Buffer.from(archive.bytes)],
  [`assets/workshop-units/${target}/source-workshop.zip`,archive.source],
  [packPath,json(pack)],['data/mob-library.json',prior?manifestBytes:json(nextManifest)]
 ];
 const files=await Promise.all(desired.map(async([path,next])=>({path,next,previous:path===packPath?oldBytes:path==='data/mob-library.json'?manifestBytes:await optionalRead(resolve(root,path))})));
 const model=files[0];if(model.previous&&digest(model.previous)!==pack.model.sha256)throw Error('Existing immutable model file failed its checksum; repair it before importing.');
 const changed=files.filter(f=>!same(f.previous,f.next));
 const changedFields=old?Object.keys(pack.draft).filter(k=>JSON.stringify(pack.draft[k])!==JSON.stringify(old.draft?.[k])):Object.keys(pack.draft);
 const report={status:check?'checked':changed.length?(prior?'replaced':'created'):'unchanged',id:target,name:pack.name,
  mode:prior?'replace':'new',changedFields,files:changed.map(f=>f.path),modelReused:!!model.previous,checks,backup:null,live:'not requested'};
 if(check){report.elapsedMs=Math.round(performance.now()-started);return report;}
 if(changed.length){
  const local=resolve(root,'.local/workshop-imports');await mkdir(local,{recursive:true});const lockPath=resolve(local,'active.lock');
  let lock;try{lock=await open(lockPath,'wx');}catch(e){if(e.code==='EEXIST')throw Error('Another Workshop import is active. No files changed.');throw e;}
  const applied=[];let backup;
  try{
   // Detect changes since validation before touching any game asset.
   for(const f of files)if(!same(f.previous,await optionalRead(resolve(root,f.path))))throw Error('File changed during import validation: '+f.path);
   backup=resolve(local,new Date().toISOString().replaceAll(':','-')+'-'+target+'-'+randomUUID().slice(0,8));
   await mkdir(backup,{recursive:true});
   for(const f of files.slice(1))if(f.previous){const path=resolve(backup,f.path);await mkdir(dirname(path),{recursive:true});await writeFile(path,f.previous);}
   report.backup=relative(root,backup).split(sep).join('/');
   await writeFile(resolve(backup,'before.json'),json({id:target,files:files.map(f=>({path:f.path,existed:f.previous!==null,beforeSha256:f.previous?digest(f.previous):null,afterSha256:digest(f.next)}))}));
   for(const f of changed){applied.push(f);await writer(resolve(root,f.path),f.next);}
   for(const f of files)assert(same(await readFile(resolve(root,f.path)),f.next),'Written file differs: '+f.path);
  }catch(error){
   const failures=[];
   for(const f of applied.reverse())try{if(f.previous)await atomicWrite(resolve(root,f.path),f.previous);else await unlink(resolve(root,f.path)).catch(e=>{if(e.code!=='ENOENT')throw e;});}catch(e){failures.push(f.path+': '+e.message);}
   throw Error(error.message+(failures.length?'\nRollback needs attention: '+failures.join('; '):applied.length?'\nPrevious repository state restored.':'')+(backup?'\nBackup: '+backup:''),{cause:error});
  }finally{await lock.close();await unlink(lockPath);}
 }
 if(baseUrl){try{report.live=await verifyLiveWorkshopImport(baseUrl,pack,{fetcher});}catch(e){report.live='failed: '+e.message;}}
 report.elapsedMs=Math.round(performance.now()-started);
 if(report.backup)await writeFile(resolve(root,report.backup,'report.json'),json(report));
 return report;
}

function options(args){
 const result={},values={'--id':'id','--new':'newId','--root':'root','--base-url':'baseUrl'};let zip;
 for(let i=0;i<args.length;i++){
  const arg=args[i];if(arg==='--check')result.check=true;else if(values[arg]){if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing value for '+arg);result[values[arg]]=args[++i];}
  else if(arg.startsWith('--'))throw Error('Unknown option: '+arg);else if(zip)throw Error('Provide one Workshop ZIP.');else zip=arg;
 }
 if(!zip)throw Error('Usage: node scripts/import-workshop-mob.mjs <project.zip> [--id existing-id | --new new-id] [--check] [--base-url http://127.0.0.1:8276/]');
 return {zip,result};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const {zip,result}=options(process.argv.slice(2));const report=await importWorkshopMob(zip,result);console.log(JSON.stringify(report,null,2));if(report.live.startsWith('failed:'))process.exitCode=2;}
 catch(error){console.error(error.message);process.exitCode=1;}
}
