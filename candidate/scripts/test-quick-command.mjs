import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const section=(from,to)=>{
 const a=source.indexOf(from),b=source.indexOf(to,a);
 assert.ok(a>=0 && b>a,`Missing production section: ${from}`);
 return source.slice(a,b);
};
function harness(active='player'){
 const unit=(id,faction='player',controller='player',extra={})=>({id,name:id,faction,controller,alive:true,...extra});
 const roster=[unit('player'),unit('ally'),unit('npc','player','npc'),unit('friendly-orc','player','mob'),unit('enemy','enemy','mob'),unit('dead','player','player',{alive:false}),unit('fled','player','player',{fled:true})];
 const timers=[],runs=[],logs=[];let exits=0;
 const context=vm.createContext({game:{player:roster[0],allies:roster.slice(1,4),enemies:roster.slice(4),round:1,active,over:false},
  spellCastInProgress:false,spellCastOverlayOpen:false,inventoryOpen:false,characterSheetOpen:false,classReportOpen:false,aimMode:false,
  isCombatActionPauseActive:()=>false,isSpellTargetingMode:()=>false,
  exitAimMode:()=>false,closeCharacterSheet(){},refreshTurnBanner(){},updateUi(){},draw(){},setCombatMessage(){},
  log:message=>logs.push(message),exitCombat:()=>exits++,setTimeout:callback=>timers.push(callback),
  runQuickCommandPlayerTurn:token=>runs.push(token),
  selectedPlayerUnitForQuickCommand:()=>{const u=roster.find(u=>u.id===context.game.active);return u?.controller==='player'?u:null;},
  activeCombatants:()=>roster.filter(u=>u.alive&&!u.fled)});
 vm.runInContext(section('const quickCommandUnitIds=new Set();','/* Most recent randomized MOB deployment')+
  section('function isFriendlyCombatUnit(','function pointInSimplePolygon(')+
  section('function cancelQuickCommandForUnit(','function chooseQuickCommandTarget(')+
  section('function activateQuickCommand(','function playerDone(')+
  section('function handleCombatKey(','function handleCombatConditionsKey('),context);
 const key=(key,extra={})=>{let prevented=false;context.handleCombatKey({key,code:key==='Escape'?'Escape':'KeyQ',target:{tagName:'BODY'},preventDefault(){prevented=true;},...extra});return prevented;};
 const ids=()=>roster.filter(u=>context.isQuickCommandUnit(u)).map(u=>u.id);
 return {context,roster,timers,runs,logs,key,ids,exits:()=>exits,generation:()=>vm.runInContext('quickCommandGeneration',context)};
}
const h=harness(),before=JSON.stringify(h.roster);
assert.equal(h.key('q',{ctrlKey:true}),true);
assert.deepEqual(h.ids(),['player','ally','npc','friendly-orc']);
assert.equal(JSON.stringify(h.roster),before,'Quick must not change controllers, allegiance or unit data');
assert.equal(h.timers.length,1,'Only the current player actor starts now');
const token=h.generation();
h.key('q',{ctrlKey:true});h.key('q',{ctrlKey:true,repeat:true});
assert.equal(h.timers.length,1);assert.equal(h.generation(),token,'Repeated activation must not interrupt a running turn');
h.key('Escape');
assert.deepEqual(h.ids(),[]);assert.equal(h.exits(),0,'Canceling Quick keeps combat open');
assert.ok(h.generation()>token);
h.timers[0]();assert.equal(h.runs.length,0,'Escape cancels the pending Quick callback');

const single=harness();single.key('q');assert.deepEqual(single.ids(),['player']);
const singleToken=single.generation();single.key('q',{ctrlKey:true});
assert.equal(single.generation(),singleToken,'Adding allies preserves the active Quick turn token');
assert.equal(single.timers.length,1,'Group activation must not duplicate the active actor');
single.timers[0]();assert.deepEqual(single.runs,[singleToken]);

const enemy=harness('enemy');enemy.key('q',{ctrlKey:true});
assert.deepEqual(enemy.ids(),['player','ally','npc','friendly-orc']);assert.equal(enemy.timers.length,0,'Hostile turns queue friendlies without running them out of turn');
enemy.key('Escape');assert.deepEqual(enemy.ids(),[]);assert.equal(enemy.exits(),0);

for(const extra of [{metaKey:true},{altKey:true},{shiftKey:true},{isComposing:true},{defaultPrevented:true},...['INPUT','TEXTAREA','SELECT'].map(tagName=>({target:{tagName}})),{target:{tagName:'DIV',isContentEditable:true}}]){
 const guarded=harness();assert.equal(guarded.key('q',{ctrlKey:true,...extra}),false);assert.deepEqual(guarded.ids(),[]);
}
const repeat=harness();repeat.key('q',{ctrlKey:true,repeat:true});assert.deepEqual(repeat.ids(),[]);
for(const setup of [h=>h.context.game.round=0,h=>h.context.game.over=true,h=>h.context.spellCastInProgress=true,h=>h.context.isCombatActionPauseActive=()=>true]){
 const guarded=harness();setup(guarded);guarded.key('q',{ctrlKey:true});assert.deepEqual(guarded.ids(),[],'Existing Quick availability guards remain effective');
}
console.log('PASS group Quick: mixed friendly roster, exclusions, unchanged controllers, hostile-turn queue, single Q, repeated activation, typing/modifiers and Escape cancellation');
