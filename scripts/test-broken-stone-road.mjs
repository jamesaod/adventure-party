import assert from 'node:assert/strict';
import {blankEdgeMap,paintCell,resizeMap,seedPack,parsePack} from '../js/exploration-authoring.mjs';
import {roadStones,roadSignature,roadRandom} from '../js/broken-stone-road.mjs';
import {groundKind,validateGround} from '../js/exploration-ground.mjs';
import {terrainForEncounter} from '../js/exploration-encounters.mjs';
const m=blankEdgeMap('road-test','Road test');
for(let z=2;z<=6;z++)for(let x=2;x<=7;x++)paintCell(m,x,z,'ground-road');
validateGround(m);assert.equal(groundKind(m,4,4),'road');
const original=roadStones(m,4,4);assert.deepEqual(original,roadStones(structuredClone(m),4,4));assert.notDeepEqual(original,roadStones(m,5,4));
// Stones crossing an authored seam must have identical shapes and damage.
const right=roadStones(m,5,4);let shared=0;
for(const s of original.filter(s=>s.x<1&&s.x+s.w>1)){const t=right.find(t=>t.col===s.col&&t.row===s.row);assert(t);assert(Math.abs(s.x-1-t.x)<1e-12);for(const k of ['w','h','chip','tone','crack'])assert.equal(s[k],t[k]);shared++;}assert(shared>0);
const key=roadSignature(m,4,4);paintCell(m,5,4,'ground-grass');assert.notEqual(roadSignature(m,4,4),key);assert(roadStones(m,5,4).length<right.length,"Erasing road removes local paving");paintCell(m,5,4,'ground-road');assert.deepEqual(roadStones(m,4,4),original);
const restored=parsePack(JSON.stringify(seedPack(m))).maps[0];assert.deepEqual(roadStones(restored,4,4),original);resizeMap(restored,18,18);assert.deepEqual(roadStones(restored,4,4),original);
const terrain=terrainForEncounter(restored,{x:4,z:4},new Set());assert.equal(terrain.spaces.find(s=>s.id==='floor-4-4').ground,'road');
for(let x=0;x<100;x++)assert(roadRandom(x,2)>=0&&roadRandom(x,2)<1);
console.log('PASS broken road deterministic paint, neighbor/erase updates, shared-edge slabs, save/load/resize and combat handoff');

const shapes=new Set();let count=0;for(let z=3;z<6;z++)for(let x=3;x<7;x++){const slabs=roadStones(m,x,z);for(const a of slabs){shapes.add(a.w.toFixed(4)+','+a.h.toFixed(4));count++;for(const b of slabs){if(a===b)continue;assert(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)<.021||Math.min(a.z+a.h,b.z+b.h)-Math.max(a.z,b.z)<.021,'Overlap must remain a narrow edge');}}}assert(shapes.size>=5,'Mixed slab sizes');assert(count>0);
const below=roadStones(m,4,5);for(const a of original.filter(a=>a.z<1&&a.z+a.h>1)){const b=below.find(b=>a.col===b.col&&a.row===b.row);assert(b);assert(Math.abs(a.z-1-b.z)<1e-12);assert.equal(a.tone,b.tone);}
console.log('PASS mixed slab sizes, bounded overlaps and vertical seams');

const {roadRelief}=await import('../js/broken-stone-road.mjs');
const normals=roadRelief(m,4,4,64);assert.deepEqual(normals,roadRelief(structuredClone(m),4,4,64));assert.equal(normals.length,64*64*4);let slopes=0;for(let i=0;i<normals.length;i+=4){assert.equal(normals[i+3],255);assert(normals[i+2]>=128);if(Math.abs(normals[i]-128)>12||Math.abs(normals[i+1]-128)>12)slopes++;}assert(slopes>64,'Relief must contain non-flat faces');console.log('PASS deterministic finite stone normals');

const {streetV2Cell}=await import('../js/city-streets-v2.mjs');
paintCell(m,4,4,'ground-road2');validateGround(m);assert.equal(groundKind(m,4,4),'road2');const v2=parsePack(JSON.stringify(seedPack(m))).maps[0];resizeMap(v2,18,18);assert.equal(groundKind(v2,4,4),'road2');assert.equal(terrainForEncounter(v2,{x:4,z:4},new Set()).spaces.find(s=>s.id==='floor-4-4').ground,'road2');assert.deepEqual(streetV2Cell(-1,16),{x:15,z:0});assert.deepEqual(streetV2Cell(3,4),streetV2Cell(19,20));console.log('PASS V2 paint, save/load, resize, combat handoff and authored-space repeat');
