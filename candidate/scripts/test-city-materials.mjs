import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {blankEdgeMap,paintCell,seedPack,parsePack,resizeMap} from '../js/exploration-authoring.mjs';
import {paintEdge} from '../js/exploration-edges.mjs';
import {paintQuarter} from '../js/quarter-walls.mjs';
import {wallFaceMaterial} from '../js/wall-surfaces.mjs';
import {terrainForEncounter} from '../js/exploration-encounters.mjs';
import {groundKind} from '../js/exploration-ground.mjs';
import {texturePreview} from '../js/editor-view-tools.mjs';
import {CITY_WALL_TEXTURES,CITY_WOOD_FLOOR} from '../js/city-materials.mjs';
const map=blankEdgeMap('city-materials','City materials');
paintCell(map,5,5,'ground-wood');
paintEdge(map,{axis:'h',x:5,z:5},'window',{material:'red-brick',faceMaterials:{a:'red-brick',b:'beige-stone'}});
paintQuarter(map,7,7,'nw','beige-stone',{faceMaterials:{a:'beige-stone',b:'red-brick'}});
const restored=parsePack(JSON.stringify(seedPack(map))).maps[0];resizeMap(restored,20,20);
assert.equal(groundKind(restored,5,5),'wood');
assert.equal(restored.quarterWalls[0].material,'beige-stone');
const terrain=terrainForEncounter(restored,{x:5,z:5},new Set());
assert.equal(terrain.spaces.find(s=>s.id==='floor-5-5').ground,'wood');
assert(terrain.walls.some(w=>wallFaceMaterial(w,'a')==='red-brick'&&wallFaceMaterial(w,'b')==='beige-stone'));
assert(terrain.walls.some(w=>wallFaceMaterial(w,'a')==='beige-stone'&&wallFaceMaterial(w,'b')==='red-brick'));
for(const [id,asset] of Object.entries(CITY_WALL_TEXTURES)){assert(existsSync(new URL('../'+asset.src,import.meta.url)));assert.equal(texturePreview('wall','edge-wall',id).src,asset.src);}
assert.equal(texturePreview('floor','ground-wood').src,CITY_WOOD_FLOOR);
assert(existsSync(new URL('../'+CITY_WOOD_FLOOR,import.meta.url)));
console.log('PASS city wall faces/curves/windows and wood floor survive authoring, export, resize, combat conversion and swatches');
import {CITY_FLOOR_TEXTURES} from '../js/city-materials.mjs';
for(const [kind,asset] of Object.entries(CITY_FLOOR_TEXTURES)){
 const floorMap=blankEdgeMap('floor-'+kind,asset.name);paintCell(floorMap,5,5,'ground-'+kind);paintCell(floorMap,6,5,'ground-'+kind);
 const saved=parsePack(JSON.stringify(seedPack(floorMap))).maps[0];resizeMap(saved,20,20);
 assert.equal(groundKind(saved,5,5),kind);assert.equal(groundKind(saved,6,5),kind);
 const converted=terrainForEncounter(saved,{x:5,z:5},new Set());assert.equal(converted.spaces.find(s=>s.id==='floor-5-5').ground,kind);
 assert.equal(texturePreview('floor','ground-'+kind).src,asset.src);assert(existsSync(new URL('../'+asset.src,import.meta.url)));
}
console.log('PASS all illustrated city floors persist, convert to combat and use their own preview assets');
// Placing an opening preserves the existing wall's independent face materials.
const doorMap=blankEdgeMap('brick-door','Brick Door'),doorEdge={axis:'h',x:5,z:5};
paintEdge(doorMap,doorEdge,'wall',{material:'red-brick',faceMaterials:{a:'red-brick',b:'beige-stone'}});
paintEdge(doorMap,doorEdge,'door',{width:.375,hinge:'start',initialOpen:false});
assert.equal(doorMap.doors[0].material,'red-brick');assert.equal(doorMap.doors[0].faceMaterials.b,'beige-stone');
const doorSaved=parsePack(JSON.stringify(seedPack(doorMap))).maps[0];
assert.equal(doorSaved.doors[0].faceMaterials.a,'red-brick');
paintEdge(doorMap,doorEdge,'window',{material:'beige-stone',faceMaterials:{a:'beige-stone',b:'beige-stone'},width:.84});
assert.equal(doorMap.edges.find(e=>e.x===5&&e.z===5).material,'beige-stone');
console.log('PASS openings inherit existing wall faces and accept explicit surround overrides');
