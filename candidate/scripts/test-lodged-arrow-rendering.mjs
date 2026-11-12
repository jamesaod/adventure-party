import assert from 'node:assert/strict';
import {ARROW_VISUAL} from '../js/arrow-visual-profile.mjs';
import vm from 'node:vm';
import {readCombatFixture as readFileSync} from './combat-test-source.mjs';
const engine=readFileSync('js/adventure-party.js','utf8'),addon=readFileSync('js/combat-environment-actions.js','utf8');
const start=engine.lastIndexOf('function drawFloor(){'),end=engine.indexOf('\nfunction ',start+1),events=[];
const context={combatMovementSelectionActive:()=>false,combatTacticalGridVisible:()=>false,combatSceneTerrain:null,combatGpu:null,globalThis:{},ctx:{fillRect(){}},BATTLEFIELD_LOGICAL_WIDTH:100,BATTLEFIELD_LOGICAL_HEIGHT:100,activeCombatTerrainTileSet(){},visibleHexes:()=>[{x:0,y:0}],drawHexFill:()=>events.push('floor'),drawArchitecturalFloorRegions(){},drawTerrainScorch(){},drawTerrainIlluminationLayer(){},drawHexGridLine:()=>events.push('grid'),drawEnvironmentGroundArrows:()=>events.push('arrows'),hoverHighlightCells:()=>[],aimMode:false};
vm.runInNewContext(engine.slice(start,end)+';drawFloor();',context);
assert.deepEqual(events,['floor','grid','arrows'],'Actual final floor renderer draws lodged arrows after floor/grid');
let strokes=0,visible=false,camera=true,surface=true;
const wall={id:'wall',a:{x:0,y:0},b:{x:100,y:0},thickness:3};
const c=vm.createContext({architecturalWalls:[wall],environmentSquash:()=>1,isHexVisibleToFriendlyParty:()=>visible,explorationWallGroundSolids:()=>[{faces:[{side:'a'},{side:'b'}]}],explorationEncounterApi:{wallFaceFacesCamera:()=>camera},explorationWallFragmentVisible:()=>surface,isArchitecturalWallVisibleToFriendlyParty:()=>true,environmentArrowScreen:p=>p,screenPointForWorld:p=>p,combatSpriteBrightness:()=>1,drawCombatArrowSilhouette(){strokes+=2},ctx:{save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){strokes++},fillRect(){}}});
const a=addon.indexOf('function drawEnvironmentArrow('),b=addon.indexOf('async function breakNearbyCombatWindow',a);vm.runInContext(addon.slice(a,b),c);
const arrow={x:10,y:0,hex:{x:0,y:0},direction:{x:0,y:-1},height:15,wallId:'wall'};
c.drawEnvironmentArrow(arrow);assert.equal(strokes,2,'Visible wall face renders even when containing hex is hidden');
surface=false;c.drawEnvironmentArrow(arrow);assert.equal(strokes,2);surface=true;camera=false;c.drawEnvironmentArrow(arrow);assert.equal(strokes,2);camera=true;
c.drawEnvironmentArrow({...arrow,wallId:null});assert.equal(strokes,2);visible=true;c.drawEnvironmentArrow({...arrow,wallId:null});assert.equal(strokes,4);
console.log('PASS production floor arrow draw, wall surface visibility, camera occlusion and ground LOS');
const finishStart=addon.indexOf('async function finishEnvironmentArrow('),finishEnd=addon.indexOf('function drawEnvironmentArrow(',finishStart);
const state={arrows:[],sequence:0};const finishContext=vm.createContext({inside:()=>true,combatEnvironment:()=>state});vm.runInContext(addon.slice(finishStart,finishEnd),finishContext);
for(const controller of ['player','mob'])await finishContext.finishEnvironmentArrow({controller},{x:10,y:0,hex:{x:0,y:0},direction:{x:1,y:0},kind:'ground'});
assert.equal(state.arrows.length,2,'Both controllers retain ground impacts');
finishContext.inside=()=>false;await finishContext.finishEnvironmentArrow({controller:'mob'},arrow);assert.equal(state.arrows.length,3,'Boundary wall impacts survive a hex centre outside the map');
console.log('PASS player/enemy impact persistence and boundary-wall impacts');

// The shared silhouette draws a dark shaft, white feathers, and a separate soft shadow.
const effectSource=readFileSync('js/combat-effect-animation.js','utf8');
const helper=effectSource.slice(effectSource.indexOf('function combatArrowShadowPoint'),effectSource.indexOf('async function animateArrowProjectile'));
const ink=[];const arrowCtx={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){ink.push(this.strokeStyle)}};
let sun={direction:{x:1,y:1,z:0}};
const arrowSandbox=vm.createContext({ctx:arrowCtx,AdventurePartyArrowVisual:ARROW_VISUAL,adventurePartySolar:{state:()=>sun},HEX_W:30,HEX_ROW:20,
  combatSceneTerrain:{cellW:60,cellH:40},explorationEncounterApi:{SCENE_STYLE:{cellMetres:3,wallMetres:3.5,tacticalWallPixels:35}},
  screenPointForWorld:(p,h=0)=>({x:p.x,y:p.y-h}),battlefieldProjectVector:p=>p,isIndoorWorldPoint:()=>false});
vm.runInContext(helper,arrowSandbox);
arrowSandbox.drawCombatArrowSilhouette({x:0,y:0},{x:18,y:0});
assert.deepEqual(ink,['rgba(0,0,0,.38)','rgba(0,0,0,.38)',ARROW_VISUAL.wood,ARROW_VISUAL.feather]);
console.log('PASS shared wood shaft, pale fletching and soft arrow shadow');

const east=arrowSandbox.combatArrowShadowPoint({x:50,y:30},10);
assert.equal(east.x,30);assert.equal(east.y,40,'Elevated shaft projects onto ground');
sun={direction:{x:-1,y:1,z:0}};
assert.equal(arrowSandbox.combatArrowShadowPoint({x:50,y:30},10).x,70,'Sun reversal reverses shadow');
sun={direction:{x:1,y:1,z:0}};
const wallShadow=arrowSandbox.combatArrowShadowPoint({x:2,y:20},15,{a:{x:0,y:0},b:{x:0,y:100}});
assert.equal(wallShadow.x,0);assert.equal(wallShadow.y,21,'Wall arrow projects onto receiving face');
sun={direction:{x:1,y:-1,z:0}};
assert.equal(arrowSandbox.combatArrowShadowPoint({x:50,y:30},10),null,'No solar shadow below horizon');
ink.length=0;arrowSandbox.drawCombatArrowSilhouette({x:0,y:0},{x:18,y:0});
assert.deepEqual(ink,[ARROW_VISUAL.wood,ARROW_VISUAL.feather]);
console.log('PASS sun-directed ground/wall projections and night suppression');

// Exercise the production miss resolver with controlled random draws.
const missCode=addon.slice(addon.indexOf('function resolveEnvironmentArrow('),addon.indexOf('function environmentArrowScreen('));
let samples=[],intercept=null;
const missMath=Object.create(Math);missMath.random=()=>samples.shift()??.5;
const missSandbox=vm.createContext({Math:missMath,HEX_W:30,worldPointForHex:(x,y)=>({x:x*30,y:y*30}),
  hexDistance:(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs(a.x+a.y-b.x-b.y)),
  environmentSquash:()=>1,environmentWindowAtTarget:()=>null,environmentRayHit:()=>intercept,
  environmentHex:p=>({x:Math.round(p.x/30),y:Math.round(p.y/30)}),document:{getElementById:()=>null}});
vm.runInContext(missCode,missSandbox);
const shooter={x:0,y:0,environmentMissileRoll:{targetNumber:15,modifiedRoll:14}},victim={x:4,y:0};
samples=[.5,.1,.5,.5];const shortMiss=missSandbox.resolveEnvironmentArrow(shooter,victim);
assert(shortMiss.x>0&&shortMiss.x<120,'Near-roll misses can land short, rather than at feet');
samples=[.5,.9,.5];const longMiss=missSandbox.resolveEnvironmentArrow(shooter,victim);
assert(longMiss.x>120,'Misses can continue past target');
samples=[.5,.1,.99,.99];const closeMiss=missSandbox.resolveEnvironmentArrow(shooter,{x:1,y:0});
assert(closeMiss.x>30,'A miss inside three hexes always overshoots');
for(const target of [{x:2,y:0},{x:0,y:2},{x:-2,y:2},{x:-2,y:0},{x:0,y:-2},{x:2,y:-2}]){
 for(const value of [0,.1,.49,.5,.99]){
  samples=[value,value,value,value];const impact=missSandbox.resolveEnvironmentArrow(shooter,target);
  const dx=target.x*30,dy=target.y*30;
  assert((impact.x-dx)*dx+(impact.y-dy)*dy>0,'Close miss is beyond the target in every direction');
 }
}
samples=[.5,.1,.5,.5];assert(missSandbox.resolveEnvironmentArrow(shooter,{x:3,y:0}).x<90,'Exactly three hexes can still land short');
intercept={x:60,y:0,wallId:'test-wall',height:15,kind:'wall'};
samples=[.5,.9,.5];assert.equal(missSandbox.resolveEnvironmentArrow(shooter,victim).wallId,'test-wall','Walls still intercept missed shots');
intercept=null;samples=[.5];assert.equal(missSandbox.resolveEnvironmentArrow(shooter,victim,{empty:true}).x,120,'Empty-hex aim retains intended range');
console.log('PASS short/long misses, close-range bounds, interception and empty-hex aim');
