import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readCombatFixture as readFileSync} from './combat-test-source.mjs';
import {createCombatTestMap} from '../js/combat-test-map.mjs';
import * as sceneApi from '../js/exploration-encounters.mjs';
import {floorFragmentIndex,polygonArea} from '../js/combat-surface-lighting.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('js/combat-runtime.js').replace(/await import\('[^']+'\)/g,'sceneApi').replace("import('./combat-fir-trees.mjs?v=R238C329')",'Promise.resolve({createCombatFirTrees:async()=>({})})');
function fixture(){
 const events=[],images=Array.from({length:10},()=>({src:'',decode:async()=>{events.push('image');}}));
 const c={document:new EventTarget(),sceneApi:{...sceneApi,createCombatTestMap},ensureCombatRenderer:async()=>events.push('renderer'),studioSpriteLoading:{state:'ready'},explorationEncounterApi:null,explorationFloorImage:images[0],explorationWallImage:images[1],explorationDoorImage:images[2],explorationGrassImage:images[3],explorationWoodWallImage:images[4],explorationCityWallImages:{"red-brick":images[5],"beige-stone":images[6]},explorationCityWoodFloorImage:images[7],explorationCityFloorImages:{wood:images[7],'gray-stone':images[8],'gray-flagstone':images[9]},game:null,isKoboldUnit:()=>false,
  initializeFirMovementObstacles:()=>events.push('fir-obstacles'),newGame:(condition,scenario)=>{events.push('new');c.game=c.createCombatGame(condition,scenario.roster,scenario);},allUnits:()=>[c.game.player,...c.game.allies,...c.game.enemies],fitBattleCanvas:()=>events.push('fit'),waitForCombatUnitRenders:async()=>events.push('sprites'),presentCombatFrame:async()=>events.push('frame'),startRound:()=>{events.push('round');c.game.round++;},canvas:{dataset:{}},setTimeout,clearTimeout,HEX_W:64,HEX_ROW:31.5,MAP_MIN_X:-8,MAP_MAX_X:8,MAP_MIN_Y:-8,MAP_MAX_Y:8,WALL_TEST_ROOM:{left:-64,right:128,top:-63,bottom:63},worldPointForHex:(x,y)=>({x:(x+y/2)*64,y:y*31.5})};
 vm.createContext(c);vm.runInContext(source,c);return {c,events};
}
for(const entry of ['combat-test','exploration','spell-preview']){
 const {c,events}=fixture(),player={id:'player',x:0,y:0},caster={id:'caster'},target={id:'target'};
 const scenario={source:entry,condition:'grass',roster:{player,allies:[caster],enemies:[target]},autoStart:entry==='spell-preview',controlledActorId:entry==='spell-preview'?'caster':null};
 const result=await c.startCombatSession(scenario);
 assert.equal(result,c.game);assert.equal(result.session.source,entry);assert.equal(result.enemies[0],target);assert.equal(result.order.length,0);assert.equal(result.areaEffects.length,0);
 assert(events.indexOf('renderer')<events.indexOf('new'));assert(events.indexOf('sprites')<events.indexOf('frame'));
 if(scenario.autoStart)assert(events.indexOf('sprites')<events.indexOf('round')&&events.indexOf('round')<events.indexOf('frame'));
 assert.equal(c.canvas.dataset.combatPipeline,'shared');
 const resets=await c.startCombatSession(scenario);assert.notEqual(resets,result);assert.equal(events.filter(x=>x==='image').length,10,'Every entry uses the same cached material dependency gate');
}
const cancelled=fixture();let release;
cancelled.c.ensureCombatRenderer=()=>new Promise(r=>release=r);
let current=true;const pending=cancelled.c.startCombatSession({source:'combat-test'},{isCurrent:()=>current});current=false;release();
assert.equal(await pending,false);assert(!cancelled.events.includes('new'),'Leaving during preparation does not create a late battle');
const superseded=fixture();let renderRelease,enteredResolve;const entered=new Promise(resolve=>enteredResolve=resolve);
superseded.c.waitForCombatUnitRenders=()=>{enteredResolve();return new Promise(r=>renderRelease=r);};
const roster={player:{id:'p'},allies:[],enemies:[]};const old=superseded.c.startCombatSession({source:'combat-test',roster});
await entered;const finishOld=renderRelease;
superseded.c.waitForCombatUnitRenders=async()=>{};
const latest=await superseded.c.startCombatSession({source:'spell-preview',roster});finishOld();assert.equal(await old,false);assert.equal(superseded.c.game,latest,'Old sprite completion cannot replace the current battle');
const scene=fixture();await scene.c.prepareCombatSession();
let converted;
scene.c.configureCombatMap=request=>{converted=request;scene.c.combatSceneContext=request;scene.c.combatSceneTerrain=sceneApi.terrainForEncounter(request.map,request.origin,new Set(request.openDoors));};
scene.c.configureStandaloneCombatScene('wall');
assert.equal(converted.map.version,2);assert(!converted.synthetic,'Test maps cannot select the old synthetic renderer');
const terrain=scene.c.combatSceneTerrain;
assert(terrain.walls.every(w=>w.material==='exploration-stone'));
assert.equal(terrain.doors.length,2);assert.equal(terrain.windows.length,7,'Wall Test has a complete row of seven windows');
assert(terrain.spaces.some(s=>s.environment==='indoor')&&terrain.spaces.some(s=>s.environment==='outdoor'));
assert(converted.map.torches.every(t=>sceneApi.torchPlacement(converted.map,t).attached),'Test torches use authored wall mounts');
const fragments=floorFragmentIndex(terrain.spaces);
for(const cell of [{x:0,y:0},{x:2,y:0},{x:0,y:3}])assert(Math.abs(fragments(cell).reduce((sum,f)=>sum+Math.abs(polygonArea(f.polygon)),0)-64*31.5)<1e-6);
scene.c.configureStandaloneCombatScene('grass');assert(scene.c.combatSceneTerrain.spaces.every(s=>s.environment==='outdoor'));
let masks=0;const los={window:{},combatSceneTerrain:terrain,explorationTerrain:null,drawExplorationVisibilityMask:()=>masks++};vm.createContext(los);vm.runInContext(read('js/candidate-outdoor-los-visibility-mask.js'),los);los.drawWallTestLineOfSightMask();assert.equal(masks,1,'Standalone scenes use the exact exploration LOS mask even without a campaign handoff');
const hooks=read('js/exploration-combat-hooks.js');
const maskStart=hooks.indexOf('function drawExplorationVisibilityMask('),maskEnd=hooks.indexOf('\n}',maskStart)+2;
vm.runInNewContext(hooks.slice(maskStart,maskEnd)+';drawExplorationVisibilityMask();',{game:{condition:'grass'},hasActiveObscuringLosVolume:()=>false,document:{createElement:()=>{throw Error('Clear open terrain must not receive a blackout mask');}}});
const doorStart=hooks.indexOf('function tryExplorationToggleDoor('),doorEnd=hooks.indexOf('\n}',doorStart)+2;
for(const standalone of [true,false]){
 const request={standalone,openDoors:[]},unit={turnMoves:0,move:12,halfMove:6},writes=[];let rebuilt;
 const c={combatSceneContext:request,explorationEncounter:standalone?null:request,activePlayerControlledUnit:()=>unit,explorationDoorOpeningAllowed:()=>true,explorationReachableDoors:()=>[{id:'door',open:false}],explorationEncounterApi:{HANDOFF_KEY:'handoff'},sessionStorage:{setItem:(...args)=>writes.push(args)},configureCombatMap:r=>rebuilt=r,log(){},refreshTurnBanner(){},updateUi(){},draw(){}};
 vm.runInNewContext(hooks.slice(doorStart,doorEnd)+';tryExplorationToggleDoor();',c);
 assert.equal(rebuilt,request);assert.deepEqual(Array.from(request.openDoors),['door']);assert.equal(unit.turnMoves,1);assert.equal(writes.length,standalone?0:1,'Test doors cannot overwrite a campaign handoff');
}
const preview=read('js/candidate-spell-previewer.js');assert(!/game\s*=\s*\{/.test(preview),'Previewer cannot construct a private battle state');assert(!preview.includes('spellPreviewBaseEndTurn'));assert(!preview.includes('spellPreviewBaseCheckCombatVictory'));assert(!preview.includes('spellPreviewBaseCheckPartyDefeat'));
for(const retired of ['spellPreviewRunSleep','spellPreviewRunWallOfFog','spellPreviewRunLightningBolt','spellPreviewApplyDamage'])assert(!preview.includes(retired),'No Previewer-owned spell simulation: '+retired);
assert(preview.includes('await startCombatSession('));assert(read('js/adventure-party.js').includes('await startCombatSession('));
console.log('PASS shared startup/material/sprite/frame gate, battle state and reset across all entries, cancellation/supersession, authored test maps, exact floor partitions and production-only Previewer spells');



// A long but progressing appearance build must not hit an elapsed-time deadline.
{
 const {c}=fixture(),timers=new Map();let id=0,finish;
 c.setTimeout=fn=>{timers.set(++id,fn);return id;};c.clearTimeout=key=>timers.delete(key);
 c.waitForCombatUnitRenders=()=>new Promise(resolve=>finish=resolve);
 const started=c.startCombatSession({source:'exploration',roster:{player:{id:'p'},allies:[],enemies:[]}});
 while(!finish)await Promise.resolve();
 const first=[...timers.keys()][0];c.document.dispatchEvent(new Event('adventure-party:unit-render-progress'));
 assert(!timers.has(first),'Progress resets the stall timer');assert.equal(timers.size,1);
 finish();await started;assert.equal(timers.size,0);
 c.document.dispatchEvent(new Event('adventure-party:unit-render-progress'));assert.equal(timers.size,0,'Listener removed after success');
 const stalled=c.startCombatSession({source:'exploration',roster:{player:{id:'p'},allies:[],enemies:[]}});finish=null;
 while(!finish)await Promise.resolve();
 const rejected=assert.rejects(stalled,/stopped making progress/);[...timers.values()][0]();await rejected;
 assert.equal(timers.size,0,'Timer cleaned after failure');
}
