import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {extractCombatFunction} from './combat-test-source.mjs';
const source=fs.readFileSync(new URL('../js/combat-session-state.js',import.meta.url),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function harness(){
  const preparation=deferred(),acknowledgement=deferred(),calls={ready:0,finish:0,begin:0,failed:0};
  const button={textContent:'Begin Battle',disabled:false,setAttribute(){},removeAttribute(){}};
  const screen=()=>({classList:{add(){},remove(){}}});
  const context={URLSearchParams,location:{search:''},combatAwaitingStart:false,currentScreen:'combat-conditions',selectedCombatCondition:'grass',studioDraftAutoSelect:true,pendingCombatStart:null,studioSpriteLoading:{state:'ready'},explorationEncounter:null,
    document:{getElementById:id=>id==='beginBattleButton'?button:null},console:{error(){}},updateAudioIndicators(){},syncWeatherAudio(){},
    launcherScreen:screen(),combatConditionsScreen:screen(),xpLootScreen:screen(),spellbookScreen:screen(),classbookScreen:screen(),spellPreviewScreen:screen(),combatScreen:screen(),
    // Deliberately no retired title-music or Pixel Editor globals.
    combatRenderingPanel:()=>({ready(){calls.ready++;return acknowledgement.promise;},finish(){calls.finish++;acknowledgement.resolve(false);},fail(){calls.failed++;}}),
    startCombatSession:()=>preparation.promise,
    beginCombatFromPrompt:async()=>{calls.begin++;}
  };
  vm.createContext(context);vm.runInContext(['cancelPendingCombatStart','showCombat'].map(n=>extractCombatFunction(source,n)).join('\n'),context);
  return {context,calls,preparation,acknowledgement};
}
{
  const h=harness(),run=h.context.showCombat('wall');await flush();assert.equal(h.calls.begin,0);assert.equal(h.calls.ready,0);
  h.preparation.resolve({});await flush();assert.equal(h.calls.ready,1);assert.equal(h.calls.begin,0,'Completed assets still wait for acknowledgement');assert(h.context.pendingCombatStart);
  assert.equal(await h.context.showCombat(),false,'Repeated launches cannot start another session while waiting');
  h.acknowledgement.resolve(true);await run;assert.equal(h.calls.begin,1);assert.equal(h.calls.finish,1);assert.equal(h.context.pendingCombatStart,null);
}
{
  const h=harness(),run=h.context.showCombat();h.preparation.resolve({});await flush();h.context.cancelPendingCombatStart();await run;
  assert.equal(h.calls.begin,0,'Cancel while reviewing history cannot start combat');assert.equal(h.context.pendingCombatStart,null);
}
{
  const h=harness(),run=h.context.showCombat();h.context.cancelPendingCombatStart();h.preparation.resolve(false);await run;assert.equal(h.calls.ready,0);assert.equal(h.calls.begin,0);
}
{
  const h=harness(),run=h.context.showCombat();h.preparation.reject(Error('Asset unavailable'));await run;assert.equal(h.calls.failed,1);assert.equal(h.calls.ready,0);assert.equal(h.calls.begin,0);assert.equal(h.context.pendingCombatStart,null);
}
console.log('PASS preparation readiness gate, exactly-once entry, duplicate launch guard, cancellation and error recovery without retired globals');

{const h=harness();h.context.location.search='?terrainLab=1';const run=h.context.showCombat();h.preparation.resolve({});await run;assert.equal(h.calls.begin,0);assert.equal(h.calls.ready,0);assert.equal(h.calls.finish,1);assert.equal(h.context.combatAwaitingStart,true);assert.equal(h.context.pendingCombatStart,null);}

