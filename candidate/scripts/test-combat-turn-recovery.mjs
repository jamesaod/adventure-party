import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('js/combat-turn-flow.js','utf8');
let now=0,sequence=0,hold=0,starts=0;const timers=new Map(),warnings=[];
const c=vm.createContext({console:{warn:(...x)=>warnings.push(x),error:(...x)=>{throw Error(x.join(' '));}},
 game:null,aiTimer:null,performance:{now:()=>now},
 setTimeout:(fn,ms)=>{const id=++sequence;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),
 combatActionPauseRemaining:()=>Math.max(0,hold-now),updateUi(){},draw(){},
 getUnitById:id=>id==='dead'?{id,alive:false}:{id,alive:true,controller:'player'},
 r230CastingStore:()=>({}),beginCombatResultTurn(){},centerCameraOn(){},refreshTurnBanner(){},
 handleTurnControlEffects:async()=>false,isPlayerControlledUnit:()=>true,activeEnemies:()=>[{}],log(){},
 syncQuickCommandState(){starts++;},isQuickCommandUnit:()=>false});
vm.runInContext(source,c);
async function advance(ms){const until=now+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);await next[1].fn();await Promise.resolve();}now=until;}
for(let i=0;i<200;i++){
 c.game={round:i+1,order:['attacker','dead','survivor'],turnIndex:0,active:'attacker',over:false,session:{}};
 hold=now+2500;const before=starts;c.endTurn();
 // Reproduce a lost/replaced shared timer after a kill.
 if(i%2===0){timers.delete(c.aiTimer);c.aiTimer=null;}
 await advance(2499);assert.equal(starts,before,'Death presentation must finish');
 await advance(2100);assert.equal(starts,before+1,'Exactly one surviving turn starts');
 assert.equal(c.game.active,'survivor');assert.equal(c.game.turnIndex,2);
 await advance(5000);assert.equal(starts,before+1,'Recovery cannot replay a living turn');
}
assert.equal(warnings.length,100);
const before=starts;c.game={round:1,order:['a','survivor'],turnIndex:0,active:'a',over:false,session:{}};c.endTurn();
c.game={round:1,order:['player'],turnIndex:0,active:'player',over:false,session:{}};
await advance(10000);assert.equal(starts,before,'Old battle cannot affect replacement');
c.game={round:1,order:['a','survivor'],turnIndex:0,active:'a',over:false,session:{pauseAfterAction:true}};c.endTurn();
await advance(10000);assert.equal(starts,before,'Preview pause remains intentional');
console.log('PASS 200 death handoffs, 100 lost timer recoveries, dead-slot skip, presentation holds, no duplicate turns, session isolation and intentional preview pause');
