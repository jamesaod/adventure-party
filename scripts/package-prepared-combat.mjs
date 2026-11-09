// Offline publication only: share identical geometry and image payloads across equipment sets.
import {readdirSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const source=process.argv[2]||'assets/combat-units';
const destination=process.argv[3]||'assets/prepared-combat';
mkdirSync(`${destination}/chunks`,{recursive:true});
const written=new Set(),keys=[];let bytes=0;
function save(path,value){const data=gzipSync(JSON.stringify(value),{level:9});writeFileSync(path,data);bytes+=data.length;}
for(const file of readdirSync(source).filter(f=>f.endsWith('.json.gz')).sort()){
  const pack=JSON.parse(gunzipSync(readFileSync(`${source}/${file}`)));
  if(pack.format!=='adventure-party-direct-unit'||file!==`${pack.key}.json.gz`)throw Error(`Invalid pack ${file}`);
  pack.sharedSceneVersion=1;
  for(const field of ['geometries','images'])pack.scene[field]=(pack.scene[field]||[]).map(entry=>{
    const {uuid,...payload}=entry,hash=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    if(!written.has(hash)){save(`${destination}/chunks/${hash}.json.gz`,payload);written.add(hash);}
    return {uuid,chunk:hash};
  });
  save(`${destination}/${file}`,pack);keys.push(pack.key);
}
writeFileSync(`${destination}/index.json`,JSON.stringify({version:1,keys},null,2)+'\n');
console.log(JSON.stringify({packs:keys.length,chunks:written.size,compressedBytes:bytes}));
