import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {terrainForEncounter,doorwayCrossings} from '../js/exploration-encounters.mjs';
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

const player={id:'player',alive:true,x:front.x,y:front.y,turnMoves:0,halfMove:5,move:10,fullMove:false};
const calls=[],logs=[],noop=()=>{};
const env={game:{active:'player',over:false},activePlayerControlledUnit:()=>player,sweepInProgress:false,mobGuardReactionInProgress:false,freeStrikeInProgress:false,explorationDoorCrossingBusy:false,isCombatActionPauseActive:()=>false,
 explorationDoorRoutes:()=>routes,isWall:()=>false,architecturalWallBlocksStep:()=>false,enemyAtHex:()=>null,occupiedByAnyUnit:()=>false,unitTransitionBlocked:()=>false,
 log:m=>logs.push(m),performLeavingHexFreeAttacks:async()=>{calls.push('leave');return true;},updateFacingForStep:noop,setUnitActionBanner:noop,maybeRecenterCamera:noop,playMoveSound:noop,updateUi:noop,draw:noop,
 resolvePersistentAreaMovementStep:async()=>{calls.push('area');return {haltMovement:false};},triggerMobGuardsAgainst:async()=>calls.push('guard'),endTurn:noop};
vm.createContext(env);const start=source.indexOf('async function tryPlayerMove('),end=source.indexOf('\nasync function playerAttackKey(',start);vm.runInContext(source.slice(start,end),env);
await env.tryPlayerMove(1,-2,{doorCrossing:routes[0]});assert.equal(player.turnMoves,2);assert.equal(player.x,back.x);assert.equal(player.y,back.y);assert.deepEqual(calls,['leave','area','guard']);
Object.assign(player,{...front,turnMoves:4,move:5,fullMove:true});await env.tryPlayerMove(1,-2,{doorCrossing:routes[0]});assert.equal(player.turnMoves,4);assert.equal(player.y,front.y);assert(logs.at(-1).includes('Not enough movement'));
Object.assign(player,{turnMoves:0,move:10,fullMove:false});env.explorationDoorRoutes=()=>[];await env.tryPlayerMove(1,-2,{doorCrossing:routes[0]});assert.equal(player.turnMoves,0);
await env.tryPlayerMove(1,0);assert.equal(player.turnMoves,1,'Ordinary movement still costs one');
const awareness=readFileSync(new URL('../js/r220-mob-hazard-awareness.js',import.meta.url),'utf8');
const wrapperStart=awareness.indexOf('const r220BaseTryPlayerMove='),wrapperEnd=awareness.indexOf('const r220BasePathToAdjacent=',wrapperStart);
let observations=0;env.r220ObserveVisibleTargetsForAllMobs=()=>observations++;
vm.runInContext(awareness.slice(wrapperStart,wrapperEnd),env);
Object.assign(player,{...front,turnMoves:0,move:10,fullMove:false});env.explorationDoorRoutes=()=>routes;env.explorationDoorCrossingBusy=true;
await env.tryPlayerMove(1,-2,{doorCrossing:routes[0]});assert.equal(player.turnMoves,2,'Production awareness wrapper must forward the crossing option');assert.equal(player.y,back.y);assert.equal(observations,2);
console.log('PASS exact closed-door approach regression, blocked closed plane, open two-point crossing both directions, occupancy/wall/budget checks and existing reaction pipeline');
