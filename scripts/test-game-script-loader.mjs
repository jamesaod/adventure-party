import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {loadGameScripts,scriptRequestUrl} from '../js/game-script-loader.mjs';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const html=read('index.html');
const entries=[...html.matchAll(/<script src="([^"]+)" type="text\/plain" data-game-script="(classic|module)"><\/script>/g)]
  .map(([,src,type])=>({src,type}));
const pathOf=entry=>entry.src.split('?')[0];
assert.ok(entries.length>40,'The complete existing engine runs behind the startup gate');
assert.equal(pathOf(entries[0]),'js/priest-spells.js');
assert.equal(pathOf(entries[1]),'js/adventure-party.js');
assert.equal(pathOf(entries.at(-1)),'js/sprite-set-runtime.mjs');
assert.equal(entries.at(-1).type,'module');
const activeSources=[...html.matchAll(/<script\b([^>]*src="[^"]+"[^>]*)>/g)]
  .filter(([,attributes])=>!attributes.includes('type="text/plain"'));
assert.equal(activeSources.length,1,'No game script can bypass ordered startup');
assert.ok(activeSources[0][1].includes('js/game-script-loader.mjs'));
for(const entry of entries){
  assert.match(entry.src,/\?v=R238C(?:171|172|173|176|177|178|181|182|183|184)$/,'Refresh the former shared R238 script cache');
  if(entry.type==='classic')new vm.Script(read(pathOf(entry)),{filename:pathOf(entry)});
}

const helpers='js/r226-level3-helpers.js',systems='js/r226-level3-systems.js',casts='js/r226-level3-casts-a.js';
function spellContext(){
  const context={game:{round:1},allUnits:()=>[],getUnitEffect:()=>null,
    removeUnitEffect:()=>false,breakInvisibility:()=>false};
  for(const [,name] of read(systems).matchAll(/const r226Base\w+=(\w+);/g))context[name]=()=>{};
  return vm.createContext(context);
}
// Reproduce the screenshot's exact failure using the real expiry hook and a
// missing casts-a file, rather than a substitute cleanup implementation.
const broken=spellContext();
vm.runInContext(read(helpers),broken);vm.runInContext(read(systems),broken);
assert.throws(()=>vm.runInContext('expireTimedUnitEffects()',broken),
  /r226CleanupRadiusInvisibility is not defined/);

const sequence=entries.filter(entry=>[helpers,systems,casts].includes(pathOf(entry)));
const repaired=spellContext(),attempts=[];
await loadGameScripts(sequence,{loadScript:async(entry,attempt)=>{
  const path=pathOf(entry);attempts.push([path,attempt]);
  if(path===casts&&!attempt)throw Object.assign(new Error('Simulated network failure'),{retryable:true});
  vm.runInContext(read(path),repaired,{filename:path});
}});
assert.deepEqual(attempts,[[helpers,0],[systems,0],[casts,0],[casts,1]]);
assert.doesNotThrow(()=>vm.runInContext('expireTimedUnitEffects()',repaired));
assert.equal(vm.runInContext('typeof r226CleanupRadiusInvisibility',repaired),'function');
assert.equal(vm.runInContext('typeof r226ResolveBlinkAtTurnStart',repaired),'function');

// The recovery preserves the actual radius rules (no missing-function no-op).
const source={id:'caster',alive:true},near={id:'near'},far={id:'far'},removed=[];
repaired.allUnits=()=>[source,near,far];
repaired.getUnitEffect=()=>({data:{radiusSourceUnitId:'caster'}});
repaired.getUnitById=()=>source;
repaired.unitDistance=(_source,unit)=>unit===far?2:1;
repaired.removeUnitEffect=(unit,id)=>removed.push([unit.id,id]);
repaired.log=()=>{};
vm.runInContext('r226CleanupRadiusInvisibility()',repaired);
assert.deepEqual(removed,[['far','invisibility']]);

for(const retryable of [true,false]){
  const started=[];
  await assert.rejects(loadGameScripts(sequence,{loadScript:async(entry,attempt)=>{
    const path=pathOf(entry);started.push([path,attempt]);
    if(path===systems)throw Object.assign(new Error('Cannot initialize'),{retryable});
  }}),/Cannot initialize/);
  assert.ok(!started.some(([path])=>path===casts),'No later wrapper runs after a failed prerequisite');
  assert.equal(started.filter(([path])=>path===systems).length,retryable?2:1,
    'Do not replay partially evaluated global scripts');
}
const base='https://example.test/candidate/index.html?model=blond-scale-mail-woman';
const src='js/r226-level3-casts-a.js?v=R238C171';
assert.equal(scriptRequestUrl(src,base),'https://example.test/candidate/'+src);
assert.equal(new URL(scriptRequestUrl(src,base,{attempt:1,now:123})).searchParams.get('gameScriptRetry'),'retry-123');
assert.notEqual(scriptRequestUrl(src,base,{reloadToken:'456'}),
 scriptRequestUrl(src,base,{reloadToken:'456',attempt:1,now:789}),'A retry also bypasses a failed forced-reload request');
assert.ok(html.includes('id="gameStartupReload"')&&html.includes('id="gameStartup"'));
console.log('PASS ordered engine startup, exact missing-radius-hook reproduction, safe retry, failure stop and unchanged invisibility rules');

const game=read('js/adventure-party.js');
const gateStart=game.indexOf('function createStudioSpriteLoadingGate(');
const gateCode=game.slice(gateStart,game.indexOf('\n}',gateStart)+2);
let releaseStartup;const startupReady=new Promise(resolve=>{releaseStartup=resolve;});
const timers=[];const gateContext=vm.createContext({setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){}});
vm.runInContext(gateCode,gateContext);
const waiting=gateContext.createStudioSpriteLoadingGate(15000,startupReady);
assert.equal(timers.length,0,'Script retries cannot exhaust the Studio draft timeout');
releaseStartup();await startupReady;
assert.equal(timers.length,1);assert.equal(waiting.state,'pending');
waiting.finish();timers[0]();assert.equal(waiting.state,'ready');
