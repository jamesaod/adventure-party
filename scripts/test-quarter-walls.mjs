import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {quarterTowerSample,seedPack,parsePack,resizeMap,paintCell} from '../js/exploration-authoring.mjs';
import {quarterAt,quarterPoints,quarterFloor,quarterSegments,quarterContains} from '../js/quarter-walls.mjs';
import {effectiveEdges,blockingEdgeSegments,edgeLineBlocked,paintEdge} from '../js/exploration-edges.mjs';
import {validateMap} from '../js/exploration-core.mjs';
import {terrainForEncounter,torchPlacement,SCENE_STYLE} from '../js/exploration-encounters.mjs';
import {buildDaylightField} from '../js/portal-daylight.mjs';
import {installPaintedAmbient} from '../js/exploration-painted-ambient.mjs';
const map=quarterTowerSample();validateMap(map);
assert.equal(map.quarterWalls.length,4);assert.equal(effectiveEdges(map).length,0,'Quarter arcs replace the square perimeter');assert.equal(quarterSegments(map).length,64);
const endpoints=map.quarterWalls.map(q=>quarterPoints(q));for(let i=0;i<4;i++)assert.deepEqual(endpoints[i].at(-1),endpoints[(i+1)%4][0],'Quarter endpoints form a closed circle');
const area=poly=>Math.abs(poly.reduce((sum,p,i)=>{const n=poly[(i+1)%poly.length];return sum+p.x*n.z-n.x*p.z;},0)/2);
assert(Math.abs(map.quarterWalls.reduce((sum,q)=>sum+area(quarterFloor(q)),0)-Math.PI)<.01);
const center={x:7.5,z:7.5};for(const mode of ['movement','los','light']){assert(edgeLineBlocked(map,new Set(),center,{x:9,z:7.5},mode));assert(!edgeLineBlocked(map,new Set(),{x:7,z:7},{x:8,z:7},mode));assert.equal(blockingEdgeSegments(map,new Set(),mode).length,64);}
assert.throws(()=>paintEdge(map,{axis:'h',x:7,z:7},'door',{width:.375}));
const exported=parsePack(JSON.stringify(seedPack(map))).maps[0];resizeMap(exported,20,20);assert.deepEqual(exported.quarterWalls,map.quarterWalls);assert.equal(exported.ceiling[7][7],'w');assert.equal(exported.ceiling[19][19],'a');
const t=terrainForEncounter(map,map.start,new Set());assert.equal(t.walls.length,64);assert(t.walls.every(w=>w.curve&&w.edgeMaterial==='wood'));assert.equal(t.spaces.length,4);assert(Math.abs(t.spaces.reduce((sum,s)=>sum+area(s.polygon.map(p=>({x:p.x/t.cellW,z:p.y/t.cellH}))),0)-Math.PI)<.01);
for(let q=-6;q<=6;q++)for(let r=-6;r<=6;r++)if(t.walkableHex(q,r)){const p={x:map.start.x+(q+r/2)/2,z:map.start.z+r*Math.sqrt(3)/4};assert(quarterContains(quarterAt(map,Math.floor(p.x+.5),Math.floor(p.z+.5)),p));}
const mount=torchPlacement(map,{x:7,z:7});assert(mount.attached&&mount.curved);assert(Math.hypot(mount.dx,mount.dz)>.99);
const skyMap=structuredClone(map);skyMap.grid=Array.from({length:16},()=>'.'.repeat(16));skyMap.environment=Array.from({length:16},(_,z)=>Array.from({length:16},(_,x)=>quarterAt(skyMap,x,z)?'i':'o').join(''));assert.equal(buildDaylightField(skyMap).portals.length,0,'Solid curves do not leak outdoor ambient into a sealed tower');
paintCell(exported,7,7,'curve-erase');assert(!quarterAt(exported,7,7));paintCell(exported,7,7,'curve-nw',0,{material:'stone'});assert.equal(quarterAt(exported,7,7).material,'stone');
const scene=new THREE.Scene(),material=new THREE.MeshLambertMaterial();scene.add(new THREE.Mesh(new THREE.BoxGeometry(),material));installPaintedAmbient(THREE,scene,map,SCENE_STYLE.cellMetres);const shader={uniforms:{},vertexShader:THREE.ShaderLib.lambert.vertexShader,fragmentShader:THREE.ShaderLib.lambert.fragmentShader};material.onBeforeCompile(shader,{});assert(shader.uniforms.paintedAmbient&&shader.fragmentShader.includes('reflectedLight.indirectDiffuse*='),'Actual Lambert exploration materials receive painted ambient');
const base=new URL('../assets/textures/exploration/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('wood-materials.generated.json',base),'utf8'));for(const record of manifest.assets){const bytes=readFileSync(new URL(record.file,base));assert.equal(bytes.readUInt32BE(16),512);assert.equal(bytes.readUInt32BE(20),512);assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);assert.notEqual(createHash('sha256').update(bytes).digest('hex'),createHash('sha256').update(readFileSync(new URL('door.png',base))).digest('hex'));}
console.log('PASS four closed tower quarters, circular floor coverage, shared movement/LOS/light walls, torches, no daylight leaks, authoring roundtrip/resize, real wood textures and Lambert ambient binding');
