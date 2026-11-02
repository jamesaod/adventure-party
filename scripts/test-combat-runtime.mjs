import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {floorFragmentIndex,polygonArea} from '../js/combat-surface-lighting.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('js/combat-runtime.js').replace(/await import\('[^']+'\)/,'sceneApi');
function fixture(){
 const events=[],images=Array.from({length:4},()=>({src:'',decode:async()=>{events.push('image');}}));
 const c={sceneApi:{GRASS_TEXTURES:{short:'grass.png'}},ensureCombatRenderer:async()=>events.push('renderer'),studioSpriteLoading:{state:'ready'},explorationEncounterApi:null,explorationFloorImage:images[0],explorationWallImage:images[1],explorationDoorImage:images[2],explorationGrassImage:images[3],game:null,isKoboldUnit:()=>false,
  newGame:(condition,scenario)=>{events.push('new');c.game=c.createCombatGame(condition,scenario.roster,scenario);},allUnits:()=>[c.game.player,...c.game.allies,...c.game.enemies],fitBattleCanvas:()=>events.push('fit'),waitForCombatUnitRenders:async()=>events.push('sprites'),presentCombatFrame:async()=>events.push('frame'),startRound:()=>{events.push('round');c.game.round++;},canvas:{dataset:{}},setTimeout,clearTimeout,HEX_W:64,HEX_ROW:31.5,MAP_MIN_X:-8,MAP_MAX_X:8,MAP_MIN_Y:-8,MAP_MAX_Y:8,WALL_TEST_ROOM:{left:-64,right:128,top:-63,bottom:63},worldPointForHex:(x,y)=>({x:(x+y/2)*64,y:y*31.5})};
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
 const resets=await c.startCombatSession(scenario);assert.notEqual(resets,result);assert.equal(events.filter(x=>x==='image').length,4,'Every entry uses the same cached material dependency gate');
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
const scene=fixture();const rulesWalls=[{id:'rules-wall'}],rulesSpaces=[{id:'rules-room'}];scene.c.architecturalWalls=rulesWalls;scene.c.architecturalSpaces=rulesSpaces;scene.c.configureStandaloneCombatScene('wall');assert.equal(scene.c.architecturalWalls,rulesWalls);assert.equal(scene.c.architecturalSpaces,rulesSpaces);assert.equal(scene.c.MAP_MIN_X,-8,'Render adaptation cannot change gameplay geometry or bounds');
const {spaces}=scene.c.combatSceneTerrain;
assert.equal(spaces.length,5);const fragments=floorFragmentIndex(spaces);
for(const cell of [{x:0,y:0},{x:2,y:0},{x:0,y:3}]){
 const covered=fragments(cell).reduce((sum,f)=>sum+Math.abs(polygonArea(f.polygon)),0);
 assert(Math.abs(covered-64*31.5)<1e-6,'Indoor/outdoor render partitions cover each hex exactly once, including boundary slivers');
}
assert.equal(scene.c.combatSceneContext.synthetic,true);
// Exercise the real exposure helper with no imported exploration gameplay map.
// Legacy test scenes must bind their renderer scene before sampling lighting.
const hooks=read('js/exploration-combat-hooks.js'),exposureStart=hooks.indexOf('function explorationSurfaceExposure('),exposureEnd=hooks.indexOf('\n}',exposureStart)+2;
scene.c.explorationTerrain=null;scene.c.explorationEncounter=null;
scene.c.explorationEncounterApi={SCENE_STYLE:{cellMetres:3,ambient:.2},ambientForCell:()=>1,surfaceLight:(p,n,l,v,a)=>[a,a,a],displayExposure:rgb=>rgb[0]};
scene.c.explorationDaylight=()=>null;scene.c.explorationDaylightVisible=()=>true;scene.c.isIndoorWorldPoint=p=>p.x<0;
vm.runInContext(hooks.slice(exposureStart,exposureEnd),scene.c);
assert.equal(scene.c.explorationSurfaceExposure({x:-1,z:0},{x:0,y:1,z:0},[],new Set()),.2);
assert.equal(scene.c.explorationSurfaceExposure({x:1,z:0},{x:0,y:1,z:0},[],new Set()),1);

const preview=read('js/candidate-spell-previewer.js');assert(!/game\s*=\s*\{/.test(preview),'Previewer cannot construct a private battle state');assert(!preview.includes('spellPreviewBaseEndTurn'));assert(!preview.includes('spellPreviewBaseCheckCombatVictory'));assert(!preview.includes('spellPreviewBaseCheckPartyDefeat'));
for(const retired of ['spellPreviewRunSleep','spellPreviewRunWallOfFog','spellPreviewRunLightningBolt','spellPreviewApplyDamage'])assert(!preview.includes(retired),'No Previewer-owned spell simulation: '+retired);
assert(preview.includes('await startCombatSession('));assert(read('js/adventure-party.js').includes('await startCombatSession('));
console.log('PASS shared startup/material/sprite/frame gate, battle state and reset across all entries, cancellation/supersession, exact legacy floor partitions and production-only Previewer spells');
