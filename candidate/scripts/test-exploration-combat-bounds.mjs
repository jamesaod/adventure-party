import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {blankEdgeMap} from '../js/exploration-authoring.mjs';
import {paintEdge} from '../js/exploration-edges.mjs';
import {terrainForEncounter} from '../js/exploration-encounters.mjs';
const map=blankEdgeMap('bounds-regression','Bounds regression');
paintEdge(map,{axis:'h',x:6,z:7},'wall');
const origin={x:3,z:13},terrain=terrainForEncounter(map,origin,new Set());
assert.deepEqual(terrain.bounds,{left:0,right:15,top:0,bottom:15});
assert(terrain.walls.some(w=>w.id==='edge-h:6,7'),'Wall six and a half rows north of entry must survive combat import');
assert(!terrain.walls.some(w=>w.id.startsWith('crop-')),'Do not replace real architecture with an artificial crop wall');
for(const [x,z] of [[0,0],[15,0],[15,15],[0,15],[6,7]]){
 const p=terrain.project(x,z),r=Math.round(p.y/terrain.hexRow),q=Math.round(p.x/terrain.hexWidth-r/2),b=terrain.hexBounds;
 assert(q>=b.minX&&q<=b.maxX&&r>=b.minY&&r<=b.maxY,'Axial bounds must cover every square-map corner and authored edge');
}
const source=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const names=['worldPointForHex','cross2','pointOnSegment','segmentsIntersect','pointInConvexPolygon','architecturalHexCoreVertices','architecturalWallLength','architecturalWallPointAt','wallOpeningCenterT','wallOpeningPassesMode','wallBlockingSubsegments','wallSegmentCutsHexInterior','rebuildArchitecturalBlockedHexes','architecturalWallWorldVertices','wallPolygonSegments','worldLineBlockedByOtherArchitecturalWalls','isArchitecturalWallVisibleToFriendlyParty'];
const functions=names.map(name=>{const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);return source.slice(start,end);}).join('\n');
const env={game:{condition:'wall'},HEX_W:64,HEX_H:42,HEX_ROW:31.5,ARCHITECTURAL_HEX_CORE_SCALE:.9,MAP_MIN_X:terrain.hexBounds.minX,MAP_MAX_X:terrain.hexBounds.maxX,MAP_MIN_Y:terrain.hexBounds.minY,MAP_MAX_Y:terrain.hexBounds.maxY,architecturalWalls:terrain.walls,architecturalBlockedHexes:new Set(),key:(x,y)=>`${x},${y}`,friendlyVisibilityObservers:()=>[{x:12,y:-12}]};
vm.createContext(env);vm.runInContext(functions,env);
assert(env.isArchitecturalWallVisibleToFriendlyParty(terrain.walls.find(w=>w.id==='edge-h:6,7')),'Imported thin wall must reach the actual visibility/render queue');
// Verify the bounded segment scan against the production core-intersection
// oracle, including diagonal walls and window openings used by ordinary combat.
env.MAP_MIN_X=-8;env.MAP_MAX_X=8;env.MAP_MIN_Y=-8;env.MAP_MAX_Y=8;
env.architecturalWalls=[{id:'h',a:{x:-220,y:0},b:{x:220,y:0},blocksMovement:true,openings:[{type:'doorway',centerT:.5,widthWorld:50}]},{id:'v',a:{x:90,y:-170},b:{x:90,y:170},blocksMovement:true,openings:[]},{id:'diagonal',a:{x:-170,y:-140},b:{x:160,y:120},blocksMovement:true,openings:[]}];
const expected=new Set();for(let x=-8;x<=8;x++)for(let y=-8;y<=8;y++)if(env.architecturalWalls.some(w=>env.wallBlockingSubsegments(w,'movement').some(s=>env.wallSegmentCutsHexInterior(s,x,y))))expected.add(`${x},${y}`);
env.rebuildArchitecturalBlockedHexes();assert.deepEqual([...env.architecturalBlockedHexes].sort(),[...expected].sort(),'Spatial scan must retain exact existing hex-core collision results');
const large=blankEdgeMap('large-bounds','Large bounds');large.width=128;large.height=128;large.grid=Array.from({length:128},()=>'.'.repeat(128));const largeTerrain=terrainForEncounter(large,{x:2,z:125},new Set());
assert.equal(largeTerrain.bounds.top,0);assert.equal(largeTerrain.bounds.right,127);assert(largeTerrain.hexBounds.minY<-16&&largeTerrain.hexBounds.maxX>19);
console.log('PASS full edge-map import, distant thin-wall visibility, skew-aware dynamic hex bounds, 128-square extent and exact optimized collision parity');
