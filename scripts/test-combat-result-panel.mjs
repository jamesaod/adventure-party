import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function harness(){
 let now=0,id=0;const timers=new Map(),micro=[],history=[];
 let result;const classes=[];
 class Element{
  constructor(){this.children=[];this.dataset={};this.hidden=false;this.scrollTop=0;this.clientHeight=100;this.scrollHeight=0;this.attributes={};this.classList={add:v=>classes.push(v),remove(){}};}
  set scrollTop(v){this.top=Math.max(0,Math.min(v,Math.max(0,(this.scrollHeight||0)-(this.clientHeight||0))));}
  get scrollTop(){return this.top||0;}
  setAttribute(k,v){this.attributes[k]=v;}
  append(node){this.children.push(node);this.scrollHeight+=50;if(this===result)history.push({at:now,text:node.textContent.trim()});}
  insertBefore(node,before){this.children.splice(this.children.indexOf(before),0,node);}
  replaceChildren(){this.children=[];this.ownText='';this.scrollHeight=0;}
  set textContent(v){this.children=[];this.ownText=v;}
  get textContent(){return (this.ownText||'')+this.children.map(c=>c.textContent).join('');}
 }
 const summary=new Element(),compass=new Element(),panel=new Element();panel.children=[summary,compass];

 const a={id:'player',name:'Carl'},b={id:'orc',name:'Orc'},c={id:'gnoll',name:'Gnoll'},units=[a,b,c];
 const state={window:{},document:{querySelector:()=>panel,getElementById:()=>compass,createElement:()=>{const node=new Element();if(!result)result=node;return node;}},performance:{now:()=>now},setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),queueMicrotask:fn=>micro.push(fn),
 isStudioTestCombat:()=>false,game:{player:a,enemies:[b,c]},currentScreen:'combat',combatAwaitingStart:false,activeUnit:()=>a,getUnitById:id=>units.find(u=>u.id===id),R236_FLOAT_RISE_PX:20,
 flashAttack(){},r236QueueFloatingCombatText(){},r236ShowDamageText(){},r236FloatingTextStyle(){},addUnitEffect:(u,e)=>e,combatActionPauseRemaining:()=>0,updateUnitInfoPanel(){state.summaryUpdated?.();},triggerDeathFx(){},applySpellDamage(){},longbowAttack:async()=>({hit:false}),slingAttack:async function(a,b){state.flashAttack(a,b,false);},
 attack:async function(attacker,target){state.candidateWithDamageBeatContext({category:'secondary-damage',damageType:'fire'},()=>state.r236ShowDamageText(target,3));state.r236ShowDamageText(target,7);state.addUnitEffect(target,{id:'weak',name:'Weakened',kind:'debuff'});state.addUnitEffect(target,{id:'bless',name:'Blessed',kind:'buff'});state.triggerDeathFx(target);return {hit:true};},deathFx:{},finishCombat:()=>history.push({at:now,finished:true})};
 vm.createContext(state);vm.runInContext(read('js/candidate-combat-beat-sequence.js'),state);vm.runInContext(read('js/combat-result-panel.js'),state);
 const engine=read('js/adventure-party.js'),start=engine.indexOf('function scheduleCombatFinish(');vm.runInContext(engine.slice(start,engine.indexOf('\nfunction finishCombat(',start)),state);
 const flush=()=>{while(micro.length)micro.shift()();};
 const advance=t=>{flush();while(true){const due=[...timers].filter(([,v])=>v.at<=t).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].fn();flush();}now=t;};
 const stall=t=>{now=t;flush();for(const [key,value] of [...timers].sort((a,b)=>a[1].at-b[1].at)){if(value.at<=t&&timers.has(key)){timers.delete(key);value.fn();flush();}}};
 return {s:state,a,b,c,result,history,flush,advance,stall,panel,summary,compass,classes};
}
const h=harness();await h.s.attack(h.a,h.b);h.s.scheduleCombatFinish('Victory','Done');h.advance(0);
assert.equal(h.history[0].text,'CARL\nATTACKS\nORC\nHITTING FOR 7\nPOINTS OF DAMAGE');
h.advance(999);assert.equal(h.history.length,1);h.advance(1000);assert.equal(h.history[1].text,'ORC\nTAKES 3 FIRE\nPOINTS OF DAMAGE');
h.advance(2000);assert.equal(h.history[2].text,'ORC\nBLESSED');h.advance(3000);assert.equal(h.history[3].text,'ORC\nWEAKENED');h.advance(4000);assert.equal(h.history[4].text,'ORC\nGOES DOWN\nAND IS DYING');
h.advance(4999);assert(!h.history.some(e=>e.finished));h.advance(5000);assert(!h.result.hidden);assert.equal(h.result.children.length,5);assert.equal(h.panel.children[0],h.summary);assert.equal(h.panel.children[1],h.result);assert.equal(h.panel.children[2],h.compass);assert.equal(h.classes.length,0);h.advance(5016);assert(h.history.some(e=>e.finished&&e.at>=5000&&e.at<=5016));
assert.equal(h.result.children[0].children[0].className,'combat-result-line combat-result-actor');assert.equal(h.result.children[0].children[2].className,'combat-result-line combat-result-target');assert.equal(h.result.children[4].children[0].className,'combat-result-line combat-result-downed');assert.equal(h.result.attributes.role,'log');h.advance(10000);assert.equal(h.result.children.length,5,'Messages do not expire after their one-second beat');
const resized=harness();resized.s.r236ShowDamageText(resized.b,2);resized.advance(0);resized.result.scrollHeight=300;resized.result.clientHeight=100;resized.result.scrollTop=200;resized.s.summaryUpdated=()=>{resized.result.clientHeight=50;};resized.s.updateUnitInfoPanel();assert.equal(resized.result.scrollTop,250,'A taller unit summary must keep the newest result in view');resized.result.scrollTop=50;resized.s.summaryUpdated=()=>{resized.result.clientHeight=25;};resized.s.updateUnitInfoPanel();assert.equal(resized.result.scrollTop,50,'Keep an older-history reader in place');
const multi=harness();multi.s.r236ShowDamageText(multi.b,2);multi.s.r236ShowDamageText(multi.c,4);multi.advance(0);assert.equal(multi.history.length,1);multi.advance(1000);assert.equal(multi.history.length,2);assert(multi.history[1].text.includes('GNOLL'));
multi.s.window.AdventurePartyCombatBeats.clear();assert(multi.result.hidden);multi.advance(5000);assert.equal(multi.history.length,2);
const stale=harness();stale.s.r236ShowDamageText(stale.b,2);stale.advance(0);stale.s.game={};stale.s.updateUnitInfoPanel();assert(stale.result.hidden);stale.advance(3000);assert.equal(stale.history.length,1);
const stalled=harness();await stalled.s.attack(stalled.a,stalled.b);stalled.advance(0);stalled.stall(5000);assert.equal(stalled.history.length,2,'Overdue results must not collapse after a stalled frame');stalled.advance(5999);assert.equal(stalled.history.length,2);stalled.advance(6000);assert.equal(stalled.history.length,3);
const studio=harness();studio.s.isStudioTestCombat=()=>true;studio.s.r236ShowDamageText(studio.b,2);studio.s.scheduleCombatFinish('Victory','Done');studio.advance(999);assert(!studio.history.some(e=>e.finished));studio.advance(1016);assert(studio.history.some(e=>e.finished));
const miss=harness();await miss.s.longbowAttack(miss.a,miss.b);miss.advance(0);assert.equal(miss.history[0].text,'CARL\nATTACKS\nORC\nMISSES');
const sling=harness();await sling.s.slingAttack(sling.a,sling.b);sling.advance(0);assert.equal(sling.history[0].text,'CARL\nATTACKS\nORC\nMISSES','Legacy sling resolver returns undefined; use its actual flash result');
const engine=read('js/adventure-party.js');assert(engine.includes('let battlefieldRotation=5;'));assert.match(engine,/battlefieldRotation=5;\s+if\(aiTimer\)/);assert(engine.includes('battlefieldRotation>3?battlefieldRotation-6:battlefieldRotation'));
console.log('PASS production panel order, exact 1-second boundaries, serialized targets, persistent colored/stacked history with visible unit summary, final death hold before victory, misses, cancellation, game isolation and -60-degree default');
