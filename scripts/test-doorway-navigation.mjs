import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import {blankEdgeMap} from '../js/exploration-authoring.mjs';import {paintEdge} from '../js/exploration-edges.mjs';import {terrainForEncounter} from '../js/exploration-encounters.mjs';
const source=fs.readFileSync('js/adventure-party.js','utf8'),names=['worldPointForHex','cross2','pointOnSegment','segmentsIntersect','pointInConvexPolygon','architecturalHexCoreVertices','architecturalWallLength','architecturalWallPointAt','wallOpeningCenterT','wallOpeningPassesMode','wallBlockingSubsegments','wallSegmentCutsHexInterior','rebuildArchitecturalBlockedHexes','isArchitecturalBlockedHex','architecturalWallBlocksWorldLine','architecturalWallBlocksStep'];const code=names.map(name=>{const a=source.indexOf(`function ${name}(`),b=source.indexOf('\nfunction ',a+1);return source.slice(a,b);}).join('\n');
for(const axis of ['h','v'])for(let n=3;n<12;n++)for(const isOpen of [false,true]){
 const map=blankEdgeMap('door-test','Door test');for(let i=0;i<16;i++)paintEdge(map,{axis,x:axis==='h'?i:n,z:axis==='h'?n:i},i===8?'door':'wall');
 const door=map.doors[0],t=terrainForEncounter(map,{x:3,z:13},new Set(isOpen?[door.id]:[])),b=t.hexBounds,env={HEX_W:64,HEX_H:42,HEX_ROW:31.5,ARCHITECTURAL_HEX_CORE_SCALE:.9,MAP_MIN_X:b.minX,MAP_MAX_X:b.maxX,MAP_MIN_Y:b.minY,MAP_MAX_Y:b.maxY,architecturalWalls:t.walls,architecturalBlockedHexes:new Set(),key:(x,y)=>`${x},${y}`};vm.createContext(env);vm.runInContext(code+'\nrebuildArchitecturalBlockedHexes();',env);
 const cells=[];for(let x=b.minX;x<=b.maxX;x++)for(let y=b.minY;y<=b.maxY;y++)if(t.walkableHex(x,y)&&!env.isArchitecturalBlockedHex(x,y))cells.push({x,y});
 const pos=axis==='h'?{x:8,z:n+.5}:{x:n+.5,z:8},world=t.project(pos.x,pos.z),start=cells.reduce((a,p)=>{const w=env.worldPointForHex(p.x,p.y),d=Math.hypot(w.x-world.x,w.y-world.y);return !a||d<a.d?{...p,d}:a;},null),normal=p=>{const w=env.worldPointForHex(p.x,p.y);return axis==='h'?w.y-t.doors[0].center.y:w.x-t.doors[0].center.x;};
 const valid=new Set(cells.map(p=>`${p.x},${p.y}`)),reached=new Set([`${start.x},${start.y}`]),queue=[start],parents=new Map();let pass=false,destination=null;
 for(let i=0;i<queue.length;i++){if(normal(queue[i])< -32){pass=true;destination=queue[i];break;}for(const [dx,dy] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]){const p={x:queue[i].x+dx,y:queue[i].y+dy},k=`${p.x},${p.y}`;if(valid.has(k)&&!reached.has(k)&&!env.architecturalWallBlocksStep(queue[i],p)){reached.add(k);parents.set(k,queue[i]);queue.push(p);}}}
 assert.equal(pass,isOpen,`${axis} doorway at ${n} must block when closed and permit ordinary adjacent movement when open`);
 if(isOpen){
  const path=[];for(let p=destination;p.x!==start.x||p.y!==start.y;p=parents.get(`${p.x},${p.y}`))path.unshift(p);
  const player={id:'player',name:'Player',alive:true,x:start.x,y:start.y,turnMoves:0,halfMove:100,move:200,fullMove:false},noop=()=>{};
  Object.assign(env,{game:{active:'player',over:false},activePlayerControlledUnit:()=>player,sweepInProgress:false,mobGuardReactionInProgress:false,freeStrikeInProgress:false,isCombatActionPauseActive:()=>false,isWall:(x,y)=>!t.walkableHex(x,y)||env.isArchitecturalBlockedHex(x,y),enemyAtHex:()=>null,occupiedByAnyUnit:()=>false,unitTransitionBlocked:()=>false,log:noop,performLeavingHexFreeAttacks:async()=>true,updateFacingForStep:noop,setUnitActionBanner:noop,maybeRecenterCamera:noop,playMoveSound:noop,updateUi:noop,draw:noop,resolvePersistentAreaMovementStep:async()=>({haltMovement:false}),triggerMobGuardsAgainst:async()=>{},endTurn:noop});
  const a=source.indexOf('async function tryPlayerMove('),b=source.indexOf('\nasync function playerAttackKey(',a);vm.runInContext(source.slice(a,b),env);
  for(const [i,p] of path.entries()){const dx=p.x-player.x,dy=p.y-player.y;assert.equal(Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dx+dy)),1);await env.tryPlayerMove(dx,dy);assert.equal(player.x,p.x);assert.equal(player.y,p.y);assert.equal(player.turnMoves,i+1,'Each ordinary doorway step costs exactly one movement point');}
 }

}

console.log('PASS ordinary one-point door navigation and closed-door blocking across 18 horizontal/vertical grid alignments');
