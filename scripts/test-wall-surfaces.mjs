import assert from 'node:assert/strict';
import {quarterTowerSample,seedPack,parsePack,resizeMap} from '../js/exploration-authoring.mjs';
import {paintQuarter,quarterFloor,quarterPoints,quarterContains,validateQuarterWalls} from '../js/quarter-walls.mjs';
import {wallFaceMaterial,wallFaceLabels,quarterOutsidePolygons,surfaceAt} from '../js/wall-surfaces.mjs';
import {paintEdge} from '../js/exploration-edges.mjs';
import {terrainForEncounter} from '../js/exploration-encounters.mjs';
import {solidPrism} from '../js/exploration-combat-geometry.mjs';
const map=quarterTowerSample(),area=poly=>Math.abs(poly.reduce((s,p,i)=>{const n=poly[(i+1)%poly.length];return s+p.x*n.z-n.x*p.z;},0)/2);
for(const q of map.quarterWalls){assert(Math.abs(area(quarterFloor(q))+quarterOutsidePolygons(q).reduce((s,p)=>s+area(p),0)-1)<1e-9);for(const p of quarterOutsidePolygons(q)){const a=p[0],b=p[1],c=p[2];assert((b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z)>0,'Outside floor triangles face upward');}}
paintQuarter(map,7,7,'nw','wood',{faceMaterials:{a:'wood',b:'stone'},outsideGround:'grass'});
assert.equal(wallFaceMaterial(map.quarterWalls.find(q=>q.x===7&&q.z===7),'b'),'stone');
assert.deepEqual(wallFaceLabels({corner:'nw'}),{a:'Inside face',b:'Outside face'});
assert.equal(wallFaceMaterial({material:'wood'},'a'),'wood');
assert.equal(surfaceAt(map,{x:6.55,z:6.55}).ground,'grass');assert(surfaceAt(map,{x:6.55,z:6.55}).outside);assert(!surfaceAt(map,{x:7.4,z:7.4}).outside);
for(const faceMaterials of [null,[],{a:'door'},{c:'stone'}]){const copy=structuredClone(map);copy.quarterWalls[0].faceMaterials=faceMaterials;assert.throws(()=>validateQuarterWalls(copy));const before=JSON.stringify(map);assert.throws(()=>paintQuarter(map,7,7,'nw','stone',{faceMaterials}));assert.equal(JSON.stringify(map),before,'Invalid curve painting is atomic');}
const clone=parsePack(JSON.stringify(seedPack(map))).maps[0];resizeMap(clone,20,20);assert.deepEqual(clone.quarterWalls,map.quarterWalls);
const terrain=terrainForEncounter(map,map.start,new Set());assert(terrain.walls.some(w=>w.faceMaterials?.b==='stone'));assert.equal(terrain.spaces.filter(s=>s.outside).length,64);
for(const [a,b,expected] of [[{x:0,y:0},{x:1,y:0},{x:0,z:1}],[{x:0,y:0},{x:0,y:1},{x:-1,z:0}]]){const face=solidPrism(a,b,.1,1).faces.find(f=>f.side==='a');assert(Math.abs(face.normal.x-expected.x)<1e-9);assert(Math.abs(face.normal.z-expected.z)<1e-9);}
console.log('PASS complete curved floors, upward triangle normals, independent face mapping, exterior material lookup, validation atomicity and roundtrip');
