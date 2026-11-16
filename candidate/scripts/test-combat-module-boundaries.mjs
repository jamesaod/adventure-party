import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

import {extractCombatFunction} from './combat-test-source.mjs';
const manifest=JSON.parse(readFileSync('js/combat-module-manifest.json','utf8'));
// Extraction hashes document the original move, not immutable gameplay forever.
// Assert ownership and parseability while behavioral tests cover subsequent changes.
for(const entry of manifest.extractions){
 const current=entry.name==='attack'?'resolveMeleeHit':entry.name;
 assert(manifest.owners.includes(entry.file), 'Unregistered owner: '+entry.file);
 const owner=readFileSync('js/'+entry.file,'utf8');
 assert(extractCombatFunction(owner,current).length>0);
 const declarations=manifest.owners.flatMap(file=>[...readFileSync('js/'+file,'utf8').matchAll(new RegExp('(?:^|\\n)(?:async )?function '+current+'\\(','g'))]);
 assert.equal(declarations.length,1,'Exactly one owner for '+current);
}
const c=vm.createContext({sample:function(x){return x+1;}});vm.runInContext(readFileSync('js/combat-services.js','utf8'),c);const registry=c.AdventurePartyCombatServices,first=registry.current('sample');registry.register('sample','first',function(x){return first.call(this,x)*2;});const facade=c.sample,previous=registry.current('sample');registry.register('sample','second',function(x){return previous.call(this,x)+3;});assert.equal(c.sample,facade);assert.equal(c.sample(2),9);assert.deepEqual(Array.from(registry.inspect()[0].stages),['first','second']);assert.throws(()=>registry.register('sample','second',()=>0),/Duplicate/);assert.throws(()=>registry.register('sample','invalid',null),/Invalid/);
const trace=[];registry.register('sample','async',async x=>{trace.push('before');const result=previous(x);await Promise.resolve();trace.push('after');return result;});assert.equal(await c.sample(2),6);assert.deepEqual(trace,['before','after']);
const html=readFileSync('index.html','utf8');for(const file of manifest.owners)assert(html.indexOf('js/'+file)<html.indexOf('js/adventure-party.js'),'Owner definitions must exist before scheduler/launcher setup: '+file);
console.log('PASS '+manifest.extractions.length+' owned extracted functions, ordered stable service facades, captured predecessors, invalid/duplicate stages and async results');
