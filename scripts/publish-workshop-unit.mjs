import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {unzipSync,strFromU8} from '../assets/vendor/three/addons/libs/fflate.module.js';
import {createWorkshopUnit} from '../js/workshop-unit-package.mjs';
import {validateWorkshopGlb} from '../js/workshop-glb.mjs';
import {workshopRuntimeSupport} from '../js/workshop-runtime-support.mjs';

// Explicit repository publication, independent of browser cache. Source projects
// are retained alongside immutable model assets; catalog registration is last.
export async function publishWorkshopUnit(zipPath,id,{root=resolve(dirname(fileURLToPath(import.meta.url)),'..')}={}){
 const entries=unzipSync(new Uint8Array(await readFile(zipPath)));
 if(!entries['workshop.json']||!entries['model.bin'])throw Error('Not a portable Workshop project.');
 const draft=JSON.parse(strFromU8(entries['workshop.json'])),bytes=entries['model.bin'];
 validateWorkshopGlb(bytes);
 const hash=createHash('sha256').update(bytes).digest('hex'),file=`assets/workshop-units/${id}/${hash}.glb`;
 const pack=createWorkshopUnit({draft,files:{'model.bin':bytes}},{id,modelFile:file,sha256:hash});
 const support=workshopRuntimeSupport(pack.draft);
 if(!support.ready)throw Error('Cannot publish this unit for combat:\n'+support.reasons.join('\n'));
 const manifestPath=resolve(root,'data/mob-library.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 const packageFile=`data/mobs/${id}.workshop-unit.json`;
 const prior=manifest.mobs.find(m=>m.id===id);
 if(prior&&prior.file!==packageFile)throw Error('This ID belongs to an existing non-Workshop MOB. Choose a new ID.');
 const atomic=async(path,data)=>{await mkdir(dirname(path),{recursive:true});const temp=path+'.workshop-tmp';await writeFile(temp,data);await rename(temp,path);};
 await atomic(resolve(root,file),bytes);
 await atomic(resolve(root,`assets/workshop-units/${id}/source-workshop.zip`),await readFile(zipPath));
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
