import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {unzipSync,strFromU8} from '../assets/vendor/three/addons/libs/fflate.module.js';
import {createWorkshopUnit} from '../js/workshop-unit-package.mjs';
import {validateWorkshopGlb} from '../js/workshop-glb.mjs';
import {workshopRuntimeSupport} from '../js/workshop-runtime-support.mjs';
import {creatureIssues} from '../js/mob-workshop-creature.mjs';

// Explicit repository publication, independent of browser cache. Source projects
// are retained alongside immutable model assets; catalog registration is last.
export async function readWorkshopArchive(zipPath){
 const source=await readFile(zipPath),entries=unzipSync(new Uint8Array(source));
 if(!entries['workshop.json']||!entries['model.bin'])throw Error('Not a portable Workshop project.');
 const draft=JSON.parse(strFromU8(entries['workshop.json'])),bytes=entries['model.bin'];
 const extension=/\.fbx$/i.test(draft.model?.file||'')?'fbx':'glb';
 if(extension==='glb')validateWorkshopGlb(bytes);
 else if(!new TextDecoder().decode(bytes.subarray(0,23)).startsWith('Kaydara FBX Binary'))throw Error('Workshop FBX must be a binary FBX file.');
 return {source,draft,bytes,extension,hash:createHash('sha256').update(bytes).digest('hex')};
}
export function prepareWorkshopUnit(archive,id){
 const {draft,bytes,extension,hash}=archive,file=`assets/workshop-units/${id}/${hash}.${extension}`;
 let pack;
 try{pack=createWorkshopUnit({draft,files:{'model.bin':bytes}},{id,modelFile:file,sha256:hash});}
 catch(error){
  let details=[];try{details=creatureIssues(structuredClone(draft)).errors;}catch{/* Keep the original envelope/schema failure. */}
  throw Error(['Cannot import '+id+':',error.message,...details].join('\n'),{cause:error});
 }
 const support=workshopRuntimeSupport(pack.draft);
 if(!support.ready)throw Error('Cannot publish this unit for combat:\n'+support.reasons.join('\n'));
 return pack;
}
export async function publishWorkshopUnit(zipPath,id,{root=resolve(dirname(fileURLToPath(import.meta.url)),'..')}={}){
 const archive=await readWorkshopArchive(zipPath),pack=prepareWorkshopUnit(archive,id),file=pack.model.file,bytes=archive.bytes;
 const manifestPath=resolve(root,'data/mob-library.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 const packageFile=`data/mobs/${id}.workshop-unit.json`;
 const prior=manifest.mobs.find(m=>m.id===id);
 if(prior&&prior.file!==packageFile)throw Error('This ID belongs to an existing non-Workshop MOB. Choose a new ID.');
 const atomic=async(path,data)=>{await mkdir(dirname(path),{recursive:true});const temp=path+'.workshop-tmp';await writeFile(temp,data);await rename(temp,path);};
 await atomic(resolve(root,file),bytes);
 await atomic(resolve(root,`assets/workshop-units/${id}/source-workshop.zip`),archive.source);
 await atomic(resolve(root,packageFile),JSON.stringify(pack,null,2)+'\n');
 const item={id,file:packageFile,encounterType:'workshop-'+id};
 manifest.mobs=prior?manifest.mobs.map(m=>m.id===id?item:m):[...manifest.mobs,item];
 await atomic(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 return pack;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [zip,id]=process.argv.slice(2);
 if(!zip||!id)throw Error('Usage: node scripts/publish-workshop-unit.mjs <project.zip> <stable-id>');
 const pack=await publishWorkshopUnit(zip,id);console.log('Published '+pack.id+' to the local repository. No remote push or deployment.');
}
