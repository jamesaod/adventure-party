import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const state=fs.readFileSync('js/combat-session-state.js','utf8');
const start=state.indexOf('  const explorationRoster=scenario.roster'),end=state.indexOf('  const groupKobolds=',start);
const setup=state.slice(start,end)+';globalThis.result={player,allies,enemies,scenario};';
for(const include of [true,false]){
 let carls=0;
 const friendly={id:'roster-friendly',alive:true},enemy={id:'roster-hostile',alive:true};
 const c={scenario:{source:'combat-test'},condition:'grass',explorationEncounter:null,combatIncludeCarl:include,selectedMobEncounter:'custom',URLSearchParams,window:{location:{search:''}},readCombatMobRoster:()=>[{count:1,faction:'friendly'},{count:1,faction:'hostile'}],libraryTestPlayer:()=>null,makeFighter:()=>{carls++;return {id:'player',type:'fighter',name:'Dungeon Crawler Carl'};},equipCarlBowForCombatTest(){},syncFighterEquipment(){},applyFighterClassRules(){},deployConfiguredCombatMobs:(condition,anchor,{autonomous})=>{assert.equal(autonomous,!include);return {allies:[friendly],enemies:[enemy]};}};
 vm.runInNewContext(setup,c);
 assert.equal(carls,include?1:0);assert.equal(c.result.player,include?c.result.player:friendly);
 assert.equal(c.result.player.id,include?'player':'roster-friendly');assert.equal(c.result.allies.length,include?1:0);assert.equal(c.result.scenario.autonomous,!include||undefined);
 c.combatIncludeCarl=false;c.readCombatMobRoster=()=>[{count:1,faction:'hostile'}];assert.throws(()=>vm.runInNewContext(setup,{...c}),/Friendly and one Hostile/);
}
const a=state.indexOf('function deployConfiguredCombatMobs('),b=state.indexOf('function newGame(',a);
const distance=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs(a.x+a.y-b.x-b.y));
const cells=u=>[{x:u.x,y:u.y}];
const c={readCombatMobRoster:()=>[{type:'orc',count:2,faction:'friendly'},{type:'orc',count:2,faction:'hostile'}],makeStudioTestMob:()=>({alive:true}),axialDisk:()=>Array.from({length:31},(_,i)=>({x:i-10,y:0})),inside:()=>true,isWall:()=>false,HEX_DIRS:[{x:1,y:0}],occupiedHexes:cells,occupiedHexesAt:(u,x,y)=>[{x,y}],key:(x,y)=>x+','+y,hexDistance:distance,hexDirectionIndexToward:()=>0,lastMobDeployment:null};
vm.runInNewContext(state.slice(a,b),c);
const roster=c.deployConfiguredCombatMobs('grass',{x:0,y:0},{autonomous:true});
assert([...roster.allies,...roster.enemies].every(u=>u.controller==='mob'));
assert.equal(roster.allies[0].x,0,'No phantom Carl reserves the central hex');
assert(roster.allies.every(a=>roster.enemies.every(e=>distance(a,e)>=10)));
const finish=state.slice(state.indexOf('function finishCombat('));assert(finish.indexOf('game.session?.autonomous')<finish.indexOf('awardFighterXp('));
console.log('PASS autonomous roster: no Carl creation, both factions required, all AI, real primary MOB, spacing, and no Carl rewards');

const render=fs.readFileSync('js/combat-render-units.js','utf8');const drawStart=render.indexOf('function drawFighter('),drawEnd=render.indexOf('\n}',drawStart)+2;
// Use the next declaration so both LF and CRLF files are handled.
const drawSource=render.slice(drawStart,render.indexOf('function drawStudioSpriteMob(',drawStart));
for(const [unit,expected] of [[{type:'kobold'},'kobold'],[{type:'orc'},'orc'],[{type:'juvenile-red-dragon'},'dragon'],[{type:'mob:wood-elf-archer',repositoryMobId:'wood-elf-archer'},'workshop']]){
 let drawn;vm.runInNewContext(drawSource+';drawFighter(unit);',{unit,game:{session:{autonomous:true}},unitPoseDefinition:()=>null,drawKobold:()=>drawn='kobold',drawOrc:()=>drawn='orc',drawLargeTestMob:()=>drawn='dragon',drawStudioSpriteMob:()=>drawn='workshop'});assert.equal(drawn,expected);
}
console.log('PASS autonomous primary MOB uses its own artwork instead of Carl');
