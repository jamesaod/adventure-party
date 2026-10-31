import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {upgradeEdgeMap,edgeAtSide,edgeKey,paintEdge,edgeLineBlocked,syncEdgeDoors,effectiveEdges} from '../js/exploration-edges.mjs';
import {blankMap,blankEdgeMap,paintCell,seedPack,packIssues,parsePack,resizeMap} from '../js/exploration-authoring.mjs';
import {validateMap,createExplorationState,act} from '../js/exploration-core.mjs';
import {hasSight,restoreDiscovery,revealDiscovery,saveDiscovery} from '../js/exploration-discovery.mjs';
import {explorationMapMarkup} from '../js/exploration-map.mjs';
import {terrainForEncounter,closedDoorsInReach,doorwayCrossings,combatDoorFrame,combatDoorPresentation} from '../js/exploration-encounters.mjs';
const legacy=JSON.parse(readFileSync(new URL('../data/exploration/old-tollhouse.json',import.meta.url))),original=JSON.stringify(legacy),migrated=upgradeEdgeMap(legacy);
assert.equal(JSON.stringify(legacy),original,'Migration never mutates the saved source');validateMap(migrated);
assert.equal(migrated.version,2);assert.equal(migrated.doors.length,legacy.doors.length);assert.equal(migrated.migrationNotes.length,legacy.doors.length);
assert.deepEqual(migrated.start,legacy.start);assert.deepEqual(migrated.encounters,legacy.encounters);
assert(migrated.grid.every((row,z)=>row===legacy.grid[z].replaceAll('D','.')));
assert.deepEqual(parsePack(JSON.stringify(seedPack(migrated))).maps[0].edges,migrated.edges);
assert.equal(edgeKey(edgeAtSide(3,3,'e')),edgeKey(edgeAtSide(4,3,'w')),'Shared edges have a single identity');
const source=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const names=['worldPointForHex','cross2','pointOnSegment','segmentsIntersect','pointInConvexPolygon','architecturalHexCoreVertices','architecturalWallLength','architecturalWallPointAt','wallOpeningCenterT','wallOpeningPassesMode','wallBlockingSubsegments','wallSegmentCutsHexInterior','rebuildArchitecturalBlockedHexes','isArchitecturalBlockedHex','architecturalWallBlocksWorldLine','architecturalWallBlocksStep'];
const functions=names.map(name=>{const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);return source.slice(start,end);}).join('\n');
function geometry(map,opened){
 const terrain=terrainForEncounter(map,{x:4,z:4},opened),ctx={HEX_W:64,HEX_H:42,HEX_ROW:31.5,ARCHITECTURAL_HEX_CORE_SCALE:.9,MAP_MIN_X:-20,MAP_MAX_X:19,MAP_MIN_Y:-16,MAP_MAX_Y:15,architecturalWalls:terrain.walls,architecturalBlockedHexes:new Set(),key:(x,y)=>`${x},${y}`};
 vm.createContext(ctx);vm.runInContext(functions+'\nrebuildArchitecturalBlockedHexes();',ctx);
 const stand=p=>terrain.walkableHex(p.x,p.y)&&!ctx.isArchitecturalBlockedHex(p.x,p.y),block=(a,b,mode='movement')=>ctx.architecturalWallBlocksWorldLine(a,b,mode);
 return {terrain,ctx,stand,block};
}
for(const axis of ['h','v']){
 const map=upgradeEdgeMap(blankMap('edge-room-'+axis,'Edge room'));map.width=9;map.height=9;map.grid=Array.from({length:9},(_,z)=>z===0||z===8?'#########':'#.......#');map.start={x:4,z:5,facing:0};map.entrances=[{id:'entry',name:'Entry',...map.start}];map.edges=[];syncEdgeDoors(map);
 for(let i=1;i<8;i++)paintEdge(map,{axis,x:axis==='h'?i:4,z:axis==='h'?4:i},i===4?'door':'wall');
 validateMap(map);const door=map.doors[0],id=door.id,near=axis==='h'?{x:4,z:4}:{x:4,z:4},far=axis==='h'?{x:4,z:3}:{x:3,z:4};
 assert(edgeLineBlocked(map,new Set(),near,far));assert(!edgeLineBlocked(map,new Set([id]),near,far));
 const state=createExplorationState(map);Object.assign(state,near,{facing:axis==='h'?0:3});assert.equal(act(map,state,'forward').changed,false);
 assert.equal(act(map,state,'door').open,true);assert.equal(act(map,state,'forward').moved,true);assert.deepEqual({x:state.x,z:state.z},far);
 Object.assign(state,far,{facing:axis==='h'?2:1});assert.equal(act(map,state,'door').open,false,'The same edge door operates from either side');
 assert(!hasSight(map,state,near.x,near.z));state.openDoors.add(id);assert(hasSight(map,state,near.x,near.z));
 const discovery=restoreDiscovery(map,null);revealDiscovery(map,state,discovery);assert(explorationMapMarkup(map,state,discovery).includes('data-edge="'+id+'"'));assert(restoreDiscovery(map,saveDiscovery(discovery)).knownDoors.has(id));
 const closed=geometry(map,new Set()),opened=geometry(map,new Set([id]));assert(closed.terrain.edgeBased);assert(closed.terrain.walls.every(w=>w.height===35));assert.equal(opened.terrain.cellW,128);
 const candidates=[];for(let q=-8;q<=8;q++)for(let r=-8;r<=8;r++){const p={x:q,y:r};if(closed.stand(p)&&closedDoorsInReach(closed.terrain,p,closed.block).length&&doorwayCrossings(opened.terrain,p,opened.stand,opened.block).length)candidates.push(p);}
 assert(candidates.length,'An actual production hex can approach, open and cross '+axis+' doorway');
 const route=doorwayCrossings(opened.terrain,candidates[0],opened.stand,opened.block)[0];assert.equal(route.cost,2);assert.equal(route.doorId,id);
 const frame=combatDoorFrame(opened.terrain.doors[0],opened.terrain),leaf=combatDoorPresentation(opened.terrain.doors[0],opened.terrain);assert.deepEqual(frame.hinge,leaf.base);
 paintEdge(map,{axis,x:4,z:4},'window');const window=geometry(map,new Set()),a=window.terrain.project(near.x,near.z),b=window.terrain.project(far.x,far.z);
 assert(window.block(a,b,'movement'));assert(!window.block(a,b,'los'));assert(!window.block(a,b,'light'));assert(window.block(a,b,'projectile'));assert(window.block(a,b,'volume'));
 assert(edgeLineBlocked(map,new Set(),near,far,'movement'));assert(!edgeLineBlocked(map,new Set(),near,far,'los'));
 paintEdge(map,{axis,x:4,z:4},'erase');assert(!edgeLineBlocked(map,new Set(),near,far));
 assert.throws(()=>paintEdge(map,{axis:'h',x:0,z:0},'door'),/floor/);assert.throws(()=>paintEdge(map,{axis:'h',x:4,z:1},'erase'),/boundary/);
 paintEdge(map,{axis,x:4,z:4},'door',{width:.8,hinge:'end',initialOpen:true});assert(createExplorationState(map).openDoors.has(id));
 const snapshot=JSON.stringify(map);assert.throws(()=>paintEdge(map,{axis,x:4,z:4},'door',{width:2}));assert.equal(JSON.stringify(map),snapshot,'Failed edge edit is atomic');
 const duplicate=structuredClone(map);duplicate.edges.push({...duplicate.edges[0]});assert.throws(()=>validateMap(duplicate),/Duplicate/);
 const cached=effectiveEdges(map);paintCell(map,2,2,'void');assert.notEqual(effectiveEdges(map),cached,'Floor edits invalidate perimeter cache');
 assert.equal(map.grid[2][2],'#');paintCell(map,2,2,'floor');assert.equal(map.grid[2][2],'.');
 const pack=seedPack(map);assert.deepEqual(packIssues(pack),[]);assert.deepEqual(parsePack(JSON.stringify(pack)),pack);
 resizeMap(map,12,12);validateMap(map);assert(map.edges.some(e=>e.id===id));
}
console.log('PASS edge migration, canonical ownership, atomic paint/settings, both-axis exploration movement/doors/discovery, production hex approach/crossing, shared hinge and window mode parity, export and resize');

const full=blankEdgeMap('full-floor','Full floor');assert(full.grid.every(row=>!row.includes('#')),'New maps use all squares as floor; perimeter edges consume no cell');
paintCell(full,0,0,'void');paintCell(full,0,0,'floor');resizeMap(full,20,18);assert.equal(full.grid[0][0],'.');assert.equal(full.grid[17][19],'.');validateMap(full);

// A new test visit must retain authored initial-open state. Only an actual
// saved array (including []) may override it.
const explorationSource=readFileSync(new URL('../js/exploration.mjs',import.meta.url),'utf8');
const restoreStart=explorationSource.indexOf('const opened=JSON.parse('),restoreEnd=explorationSource.indexOf(';}}catch',restoreStart);
assert(restoreStart>0&&restoreEnd>restoreStart);
const restoreCode=explorationSource.slice(restoreStart,restoreEnd)+';';
const initialMap=blankEdgeMap('initial-state','Initial state');paintEdge(initialMap,{axis:'h',x:4,z:4},'door',{initialOpen:true});
for(const saved of [null,'[]']){const state=createExplorationState(initialMap),env={sessionStorage:{getItem:()=>saved},testStateKey:()=>'',context:{},map:initialMap,state,doorKey:d=>d.id};vm.runInNewContext(restoreCode,env);assert.equal(state.openDoors.size,saved===null?1:0);}
