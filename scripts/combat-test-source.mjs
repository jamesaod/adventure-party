import {readFileSync as nativeRead} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
// Legacy tests extract production functions. Follow their new owners instead of
// retaining obsolete copies in the launcher. Startup tests use native reads.
export function readCombatFixture(path,options){
 const name=path instanceof URL?fileURLToPath(path):String(path);
 if(!/[\\/]js[\\/]adventure-party\.js$/.test(name)&&name!=='js/adventure-party.js'){
  const bytes=nativeRead(path,options);
  if(/\.js$/.test(name)&&(typeof bytes==='string'||Buffer.isBuffer(bytes))&&String(bytes).includes('AdventurePartyCombatServices.')&&!name.endsWith('combat-services.js')){
   const text=nativeRead(new URL('js/combat-services.js',root),'utf8')+'\n'+String(bytes);
   return typeof bytes==='string'?text:Buffer.from(text);
  }
  return bytes;
 }
 const manifest=JSON.parse(nativeRead(new URL('js/combat-module-manifest.json',root),'utf8'));
 const text=[nativeRead(path,'utf8'),...manifest.owners.map(file=>nativeRead(new URL('js/'+file,root),'utf8'))].join('\n');
 return typeof options==='string'||options?.encoding?text:Buffer.from(text);
}
import vm from 'node:vm';
// Extract a production declaration without relying on its former neighbours.
export function extractCombatFunction(source,name){
 const match=new RegExp('(?:^|\\n)((?:async )?function '+name+'\\()').exec(source);
 if(!match)throw Error('Missing production function '+name);
 const start=match.index+(source[match.index]==='\n'?1:0);
 for(let end=source.indexOf('}',start);end>=0;end=source.indexOf('}',end+1)){
  const text=source.slice(start,end+1);try{new vm.Script('('+text+')');return text;}catch{}
 }
 throw Error('Unterminated production function '+name);
}
