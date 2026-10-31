import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {terrainForEncounter,doorwayCrossings,closedDoorsInReach,combatDoorPresentation,combatDoorFrame} from '../js/exploration-encounters.mjs';
const source=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const names=['worldPointForHex','cross2','pointOnSegment','segmentsIntersect','pointInConvexPolygon','architecturalHexCoreVertices','architecturalWallLength','architecturalWallPointAt','wallOpeningCenterT','wallOpeningPassesMode','wallBlockingSubsegments','wallSegmentCutsHexInterior','rebuildArchitecturalBlockedHexes','isArchitecturalBlockedHex','architecturalWallBlocksWorldLine','architecturalWallBlocksStep'];
const functions=names.map(name=>{const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);return source.slice(start,end);}).join('\n');
function geometry(open,axis='z'){
  const map={width:9,height:9,grid:['#########','#.......#','####D####','#.......#','#.......#','#.......#','#.......#','#.......#','#########'],doors:[{x:4,z:2,axis}]};
  const terrain=terrainForEncounter(map,{x:4,z:4},new Set(open?['4,2']:[]));
  const ctx={HEX_W:64,HEX_H:42,HEX_ROW:31.5,ARCHITECTURAL_HEX_CORE_SCALE:.9,MAP_MIN_X:-20,MAP_MAX_X:19,MAP_MIN_Y:-16,MAP_MAX_Y:15,architecturalWalls:terrain.walls,architecturalBlockedHexes:new Set(),key:(x,y)=>`${x},${y}`};
  vm.createContext(ctx);vm.runInContext(functions+'\nrebuildArchitecturalBlockedHexes();',ctx);
  const stand=p=>p.x>=-20&&p.x<=19&&p.y>=-16&&p.y<=15&&terrain.walkableHex(p.x,p.y)&&!ctx.isArchitecturalBlockedHex(p.x,p.y);
  const blocked=(a,b)=>ctx.architecturalWallBlocksWorldLine(a,b,'movement');
  return {terrain,ctx,stand,blocked};
}
const front={x:2,y:-4},back={x:3,y:-6},closed=geometry(false);
assert(closed.stand(front),'The exact hex in front of the closed door must be a standing space');
assert.equal(closed.ctx.architecturalWallBlocksStep({x:2,y:-3},front),false,'Approaching a closed door must not cross its blocking plane');
assert.equal(closed.ctx.architecturalWallBlocksStep(front,back),true,'The actual closed door remains solid');
assert.equal(doorwayCrossings(closed.terrain,front,closed.stand,closed.blocked).length,0);
const open=geometry(true),routes=doorwayCrossings(open.terrain,front,open.stand,open.blocked);
assert.equal(routes.length,1);assert.deepEqual(routes[0].to,back);assert.equal(routes[0].cost,2);
assert.deepEqual(doorwayCrossings(open.terrain,back,open.stand,open.blocked)[0].to,front,'Crossings work both directions');
assert.equal(doorwayCrossings(open.terrain,front,()=>false,open.blocked).length,0,'Occupied or oversized landings must not be bypassed');
assert.equal(doorwayCrossings(open.terrain,front,open.stand,()=>true).length,0,'A crossing cannot skip another wall');


const player={id:'player',alive:true,...front,turnMoves:0,halfMove:5,move:10,fullMove:false};
const calls=[],logs=[],noop=()=>{};
const env={game:{active:'player',over:false},activePlayerControlledUnit:()=>player,sweepInProgress:false,mobGuardReactionInProgress:false,freeStrikeInProgress:false,isCombatActionPauseActive:()=>false,
 isWall:()=>false,architecturalWallBlocksStep:()=>false,enemyAtHex:()=>null,occupiedByAnyUnit:()=>false,unitTransitionBlocked:()=>false,
 log:m=>logs.push(m),performLeavingHexFreeAttacks:async()=>{calls.push('leave');return true;},updateFacingForStep:noop,setUnitActionBanner:noop,maybeRecenterCamera:noop,playMoveSound:noop,updateUi:noop,draw:noop,
 resolvePersistentAreaMovementStep:async()=>{calls.push('area');return {haltMovement:false};},triggerMobGuardsAgainst:async()=>calls.push('guard'),endTurn:noop};
vm.createContext(env);const start=source.indexOf('async function tryPlayerMove('),end=source.indexOf('\nasync function playerAttackKey(',start);vm.runInContext(source.slice(start,end),env);
await env.tryPlayerMove(1,0);assert.equal(player.turnMoves,1);assert.equal(player.x,front.x+1);assert.deepEqual(calls,['leave','area','guard']);
Object.assign(player,{...front,turnMoves:5,move:5,fullMove:true});await env.tryPlayerMove(1,0);assert.equal(player.turnMoves,5);assert.equal(player.x,front.x);assert(logs.at(-1).includes('Not enough movement'));
Object.assign(player,{turnMoves:0,move:10,fullMove:false});env.architecturalWallBlocksStep=()=>true;await env.tryPlayerMove(1,0);assert.equal(player.turnMoves,0,'Closed doors and walls still reject normal movement');env.architecturalWallBlocksStep=()=>false;
const awareness=readFileSync(new URL('../js/r220-mob-hazard-awareness.js',import.meta.url),'utf8'),wrapperStart=awareness.indexOf('const r220BaseTryPlayerMove='),wrapperEnd=awareness.indexOf('const r220BasePathToAdjacent=',wrapperStart);
let observations=0;env.r220ObserveVisibleTargetsForAllMobs=()=>observations++;vm.runInContext(awareness.slice(wrapperStart,wrapperEnd),env);await env.tryPlayerMove(1,0);assert.equal(player.turnMoves,1);assert.equal(observations,2);
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert(!html.includes('id="doorCrossingButton"'),'There is no separate crossing button');
console.log('PASS normal one-point movement, closed-wall/budget checks and unchanged reaction/area/awareness pipeline');

const hooks=readFileSync(new URL('../js/exploration-combat-hooks.js',import.meta.url),'utf8'),api=await import('../js/exploration-encounters.mjs'),store=new Map(),openLogs=[];
const openingPlayer={id:'player',name:'Test player',alive:true,...front,turnMoves:0,halfMove:3,move:7,fullMove:false};
const opening={explorationEncounterApi:api,explorationTerrain:closed.terrain,explorationEncounter:{openDoors:[]},game:{active:'player',player:openingPlayer},
 activePlayerControlledUnit:()=>openingPlayer,controlledUnitCanAct:u=>u===openingPlayer,combatAwaitingStart:false,combatOpeningSpeechDone:true,
 aimMode:false,classReportOpen:false,characterSheetOpen:false,inventoryOpen:false,spellCastOverlayOpen:false,spellCastInProgress:false,sweepInProgress:false,mobGuardReactionInProgress:false,freeStrikeInProgress:false,isCombatActionPauseActive:()=>false,
 architecturalWallBlocksWorldLine:closed.blocked,occupiedHexes:u=>[{x:u.x,y:u.y}],wallSegmentCutsHexInterior:closed.ctx.wallSegmentCutsHexInterior,
 sessionStorage:{setItem:(key,value)=>store.set(key,value)},log:m=>openLogs.push(m),refreshTurnBanner:noop,updateUi:noop,draw:noop,
 configureExplorationTerrain(){opening.explorationTerrain=geometry(opening.explorationEncounter.openDoors.includes('4,2')).terrain;}};
vm.createContext(opening);const wallStart=hooks.indexOf('function explorationDoorWall('),wallEnd=hooks.indexOf('\nfunction ',wallStart+1);vm.runInContext(hooks.slice(wallStart,wallEnd)+'\n'+hooks.slice(hooks.indexOf('function explorationDoorOpeningAllowed(')),opening);
assert.equal(opening.explorationReachableDoors(openingPlayer).length,1);
opening.tryExplorationToggleDoor();assert.equal(openingPlayer.turnMoves,1);assert(opening.explorationEncounter.openDoors.includes('4,2'));assert(JSON.parse(store.get(api.HANDOFF_KEY)).openDoors.includes('4,2'));
Object.assign(openingPlayer,{x:2,y:-5});opening.tryExplorationToggleDoor();assert.equal(openingPlayer.turnMoves,1,'Cannot close a doorway occupied by a footprint');assert(openLogs.at(-1).includes('occupies'));
Object.assign(openingPlayer,front);opening.tryExplorationToggleDoor();assert.equal(openingPlayer.turnMoves,2);assert.equal(opening.explorationEncounter.openDoors.length,0);assert.equal(JSON.parse(store.get(api.HANDOFF_KEY)).openDoors.length,0,'Closed state is saved for return/reload');assert(openLogs.at(-1).includes('closes'));
openingPlayer.turnMoves=7;opening.tryExplorationToggleDoor();assert.equal(opening.explorationEncounter.openDoors.length,0);
openingPlayer.turnMoves=3;opening.sessionStorage.setItem=()=>{throw Error('quota');};opening.tryExplorationToggleDoor();assert.equal(openingPlayer.turnMoves,3);assert.equal(opening.explorationEncounter.openDoors.length,0);
opening.sessionStorage.setItem=(key,value)=>store.set(key,value);opening.tryExplorationToggleDoor();assert.equal(openingPlayer.turnMoves,4);assert(openingPlayer.fullMove);
for(const guard of ['aimMode','combatAwaitingStart','inventoryOpen','freeStrikeInProgress','spellCastInProgress']){opening[guard]=true;openingPlayer.turnMoves=0;opening.tryExplorationToggleDoor();assert.equal(openingPlayer.turnMoves,0);opening[guard]=false;}
console.log('PASS open/close toggle cost, occupied-door rejection, state persistence, budget/threshold and pause guards');
for(const axis of ['x','z']){
 const map={width:9,height:9,grid:axis==='x'?['#########','#...#...#','#...#...#','#...#...#','#...D...#','#...#...#','#...#...#','#...#...#','#########']:['#########','#.......#','#.......#','#.......#','####D####','#.......#','#.......#','#.......#','#########'],doors:[{x:4,z:4,axis}]};
 const terrain=terrainForEncounter(map,{x:4,z:4},new Set()),from=axis==='x'?{x:-1,y:0}:{x:0,y:1};
 assert.equal(closedDoorsInReach(terrain,from,()=>false).length,1,'Both orientations can be opened');
 assert.equal(closedDoorsInReach(terrain,from,()=>true).length,0,'Cannot reach through another wall');
 assert.equal(closedDoorsInReach(terrain,{x:10,y:10},()=>false).length,0,'Distant door is not reachable');
 for(const open of [false,true]){
  const p=combatDoorPresentation({...terrain.doors[0],open},terrain);
  assert.equal(p.width,50,'Door artwork is twice the former 25px width');assert.equal(p.height,30.8);
  assert(p.vx>=36&&p.vy>=0,'The edge-on cutaway stays readable in either state');
 }
}
console.log('PASS production door opening cost/threshold, pause/turn guards, saved state, immediate collision/LOS rebuild, both axes and readable doubled-width cutaways');

for(const axis of ['x','z']){
 const terrain={cellW:128,cellH:72},door={axis,center:{x:200,y:200}},closed=combatDoorPresentation({...door,open:false},terrain),opened=combatDoorPresentation({...door,open:true},terrain),frame=combatDoorFrame(door,terrain);
 assert.deepEqual(opened.base,closed.base,'The open leaf must share the exact grounded closed-door hinge on '+axis);
 assert.deepEqual(frame.hinge,opened.base,'The masonry jamb must meet the leaf hinge');
 const area=points=>Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0)/2);
 assert(frame.polygons.every(p=>area(p)>0),'Piers and lintel must be solid surfaces, including the edge-on cutaway');
 assert.equal(frame.polygons.length,3);
}
console.log('PASS solid masonry frame polygons and identical grounded hinge anchors in closed/open states on both axes');
