import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {blankMap,seedPack,parsePack,resizeMap,paintCell,rectangleSelection,setEncounterArea,removeEncounterSquares,deleteSelectedEncounters} from '../js/exploration-authoring.mjs';
import {encounterCells,encounterAt,validateEncounters,recordOutcome,terrainForEncounter} from '../js/exploration-encounters.mjs';
const map=blankMap('areas','Areas'),record={id:'patrol',name:'Patrol',mobId:'orc',count:2,spawnX:4,spawnZ:4,color:'#638bdb',enabled:true};
let selected=rectangleSelection({x:2,z:2},{x:4,z:4});
assert.equal(selected.length,9);
selected=rectangleSelection({x:3,z:3},{x:3,z:3},selected,'subtract');
selected=rectangleSelection({x:5,z:4},{x:5,z:4},selected,'add');
const points=()=>selected.map(k=>{const [x,z]=k.split(',').map(Number);return {x,z};});
setEncounterArea(map,record,points());
assert.equal(encounterCells(map.encounters[0]).length,9);
assert.equal(encounterAt(map,{x:3,z:3},{encounters:{}}),undefined,'A hole inside the bounding rectangle must not trigger');
for(const p of points())assert.equal(encounterAt(map,p,{encounters:{}}).id,'patrol');
const cleared=recordOutcome({encounters:{}},'patrol','victory',{hp:12},[]);
for(const p of points())assert.equal(encounterAt(map,p,cleared),undefined,'One victory clears every square of the same area');
const pack=seedPack(map),roundTrip=parsePack(JSON.stringify(pack));assert.deepEqual(roundTrip.maps[0].encounters,map.encounters);
const before=structuredClone(map.encounters);
assert.throws(()=>setEncounterArea(map,{...record,id:'overlap'},[{x:2,z:2}]),/overlap/);assert.deepEqual(map.encounters,before);
assert.throws(()=>paintCell(map,2,2,'wall'),/encounter area/);
removeEncounterSquares(map,['2,2','5,4']);assert.equal(map.encounters[0].id,'patrol');assert.equal(map.encounters[0].cells.length,7);
assert.equal(encounterAt(map,{x:2,z:2},{encounters:{}}),undefined);
assert.deepEqual(validateEncounters(map),[]);
setEncounterArea(map,{...record,id:'second',name:'Second'},[{x:6,z:4}]);
const undo=structuredClone(map);deleteSelectedEncounters(map,['2,3','6,4']);assert.equal(map.encounters.length,0);
map.encounters=undo.encounters;assert.equal(map.encounters.length,2,'An ordinary pack snapshot restores a bulk deletion');
removeEncounterSquares(map,encounterCells(map.encounters[0]).map(p=>`${p.x},${p.z}`));assert.equal(map.encounters.length,1,'Removing the final square removes its area');
const legacy=blankMap('legacy','Legacy');legacy.encounters=[{...record,x:2,z:2,width:3,height:2}];
assert.equal(encounterCells(legacy.encounters[0]).length,6);removeEncounterSquares(legacy,['3,2']);
assert.equal(legacy.encounters[0].id,'patrol');assert.equal(legacy.encounters[0].cells.length,5);
assert.equal(encounterAt(legacy,{x:3,z:2},{encounters:{}}),undefined);assert.deepEqual(validateEncounters(legacy),[]);
const invalid=structuredClone(legacy);invalid.encounters[0].cells.push({x:0,z:0});assert(validateEncounters(invalid).length);
const resize=blankMap('large','Large');resizeMap(resize,32,32);resize.start={x:2,z:2,facing:0};
setEncounterArea(resize,{...record,spawnX:20,spawnZ:20},[{x:20,z:20}]);assert.throws(()=>resizeMap(resize,16,16),/encounters/);
console.log('PASS irregular encounter triggers, shared victory, legacy migration, overlap rejection, partial/bulk removal, undo snapshots, export and resize protection');

// Exercise the production movement geometry, including wall-bisected hex rejection.
const source=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const names=['worldPointForHex','cross2','pointOnSegment','segmentsIntersect','pointInConvexPolygon','architecturalHexCoreVertices','architecturalWallLength','architecturalWallPointAt','wallOpeningCenterT','wallOpeningPassesMode','wallBlockingSubsegments','wallSegmentCutsHexInterior','rebuildArchitecturalBlockedHexes','isArchitecturalBlockedHex','architecturalWallBlocksWorldLine','architecturalWallBlocksStep'];
const functions=names.map(name=>{const start=source.indexOf(`function ${name}(`);assert(start>=0,name);const end=source.indexOf('\nfunction ',start+1);return source.slice(start,end<0?undefined:end);}).join('\n');
function canTraverse(horizontal,open){
  const grid=Array.from({length:9},(_,z)=>Array.from({length:9},(_,x)=>(horizontal?z===4&&x>0&&x<8:x===4&&z>0&&z<8)?(x===4&&z===4?'D':'.'):'#').join(''));
  const m={width:9,height:9,grid,doors:[{x:4,z:4,axis:horizontal?'x':'z'}]},origin=horizontal?{x:2,z:4}:{x:4,z:2};
  const terrain=terrainForEncounter(m,origin,new Set(open?['4,4']:[]));assert.equal(terrain.scale,2);assert(terrain.walls.every(w=>w.height===35&&w.thickness===3));
  const ctx={HEX_W:64,HEX_H:42,HEX_ROW:31.5,ARCHITECTURAL_HEX_CORE_SCALE:.9,MAP_MIN_X:-20,MAP_MAX_X:19,MAP_MIN_Y:-16,MAP_MAX_Y:15,architecturalWalls:terrain.walls,architecturalBlockedHexes:new Set(),key:(x,y)=>`${x},${y}`};
  vm.createContext(ctx);vm.runInContext(functions+'\nrebuildArchitecturalBlockedHexes();',ctx);
  const allowed=(x,y)=>x>=-20&&x<=19&&y>=-16&&y<=15&&terrain.walkableHex(x,y)&&!ctx.isArchitecturalBlockedHex(x,y);
  assert(allowed(0,0));const queue=[{x:0,y:0}],seen=new Set(['0,0']);
  for(let i=0;i<queue.length;i++)for(const [dx,dy] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]){
    const p={x:queue[i].x+dx,y:queue[i].y+dy},k=ctx.key(p.x,p.y);if(allowed(p.x,p.y)&&!seen.has(k)&&!ctx.architecturalWallBlocksStep(queue[i],p)){seen.add(k);queue.push(p);}
  }
  return queue.some(p=>{const c=terrain.cellAt(p.x,p.y);return horizontal?c.x===6:c.z===6;});
}
for(const horizontal of [false,true]){assert.equal(canTraverse(horizontal,true),true,'An opened one-square doorway/corridor must be traversable at 1:2');assert.equal(canTraverse(horizontal,false),false,'Closed doors still block traversal');}
console.log('PASS production wall collision: 1:2 one-square corridors and both doorway orientations traverse only when open; walls stay 35px high');
