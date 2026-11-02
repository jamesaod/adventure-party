import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function harness(){
 let now=0,id=0;const timers=new Map(),micro=[],history=[];
 const panel={classList:{add(){},remove(){}},prepend(){}},result={hidden:true,dataset:{},setAttribute(){},replaceChildren(){this.textContent='';},set textContent(v){this.text=v;if(v)history.push({at:now,text:v});},get textContent(){return this.text;}};
 const a={id:'player',name:'Carl'},b={id:'orc',name:'Orc'},c={id:'gnoll',name:'Gnoll'},units=[a,b,c];
 const state={window:{},document:{querySelector:()=>panel,createElement:()=>result},performance:{now:()=>now},setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),queueMicrotask:fn=>micro.push(fn),
 isStudioTestCombat:()=>false,game:{player:a,enemies:[b,c]},currentScreen:'combat',combatAwaitingStart:false,activeUnit:()=>a,getUnitById:id=>units.find(u=>u.id===id),R236_FLOAT_RISE_PX:20,
 r236QueueFloatingCombatText(){},r236ShowDamageText(){},r236FloatingTextStyle(){},addUnitEffect:(u,e)=>e,combatActionPauseRemaining:()=>0,updateUnitInfoPanel(){},triggerDeathFx(){},applySpellDamage(){},longbowAttack:async()=>({hit:false}),slingAttack:async()=>({hit:false}),
 attack:async function(attacker,target){state.candidateWithDamageBeatContext({category:'secondary-damage',damageType:'fire'},()=>state.r236ShowDamageText(target,3));state.r236ShowDamageText(target,7);state.addUnitEffect(target,{id:'weak',name:'Weakened',kind:'debuff'});state.addUnitEffect(target,{id:'bless',name:'Blessed',kind:'buff'});state.triggerDeathFx(target);return {hit:true};},deathFx:{},finishCombat:()=>history.push({at:now,finished:true})};
 vm.createContext(state);vm.runInContext(read('js/candidate-combat-beat-sequence.js'),state);vm.runInContext(read('js/combat-result-panel.js'),state);
 const engine=read('js/adventure-party.js'),start=engine.indexOf('function scheduleCombatFinish(');vm.runInContext(engine.slice(start,engine.indexOf('\nfunction finishCombat(',start)),state);
 const flush=()=>{while(micro.length)micro.shift()();};
 const advance=t=>{flush();while(true){const due=[...timers].filter(([,v])=>v.at<=t).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].fn();flush();}now=t;};
 const stall=t=>{now=t;flush();for(const [key,value] of [...timers].sort((a,b)=>a[1].at-b[1].at)){if(value.at<=t&&timers.has(key)){timers.delete(key);value.fn();flush();}}};
 return {s:state,a,b,c,result,history,flush,advance,stall};
}
const h=harness();await h.s.attack(h.a,h.b);h.s.scheduleCombatFinish('Victory','Done');h.advance(0);
assert.equal(h.history[0].text,'Carl attacks Orc, hitting for 7 points of damage.');
h.advance(999);assert.equal(h.history.length,1);h.advance(1000);assert.equal(h.history[1].text,'Orc takes 3 points of fire damage.');
h.advance(2000);assert.equal(h.history[2].text,'Orc: Blessed.');h.advance(3000);assert.equal(h.history[3].text,'Orc: Weakened.');h.advance(4000);assert.equal(h.history[4].text,'Orc goes down and is dying.');
h.advance(4999);assert(!h.history.some(e=>e.finished));h.advance(5000);assert(h.result.hidden);h.advance(5016);assert(h.history.some(e=>e.finished&&e.at>=5000&&e.at<=5016));
const multi=harness();multi.s.r236ShowDamageText(multi.b,2);multi.s.r236ShowDamageText(multi.c,4);multi.advance(0);assert.equal(multi.history.length,1);multi.advance(1000);assert.equal(multi.history.length,2);assert(multi.history[1].text.includes('Gnoll'));
multi.s.window.AdventurePartyCombatBeats.clear();assert(multi.result.hidden);multi.advance(5000);assert.equal(multi.history.length,2);
const stale=harness();stale.s.r236ShowDamageText(stale.b,2);stale.advance(0);stale.s.game={};stale.s.updateUnitInfoPanel();assert(stale.result.hidden);stale.advance(3000);assert.equal(stale.history.length,1);
const stalled=harness();await stalled.s.attack(stalled.a,stalled.b);stalled.advance(0);stalled.stall(5000);assert.equal(stalled.history.length,2,'Overdue results must not collapse after a stalled frame');stalled.advance(5999);assert.equal(stalled.history.length,2);stalled.advance(6000);assert.equal(stalled.history.length,3);
const studio=harness();studio.s.isStudioTestCombat=()=>true;studio.s.r236ShowDamageText(studio.b,2);studio.s.scheduleCombatFinish('Victory','Done');studio.advance(999);assert(!studio.history.some(e=>e.finished));studio.advance(1016);assert(studio.history.some(e=>e.finished));
const miss=harness();await miss.s.longbowAttack(miss.a,miss.b);miss.advance(0);assert.equal(miss.history[0].text,'Carl attacks Orc, missing.');
const engine=read('js/adventure-party.js');assert(engine.includes('let battlefieldRotation=5;'));assert.match(engine,/battlefieldRotation=5;\s+if\(aiTimer\)/);assert(engine.includes('battlefieldRotation>3?battlefieldRotation-6:battlefieldRotation'));
console.log('PASS production panel order, exact 1-second boundaries, serialized targets, final death hold before victory, misses, cancellation, game isolation and -60-degree default');
