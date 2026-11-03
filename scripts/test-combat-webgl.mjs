import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {combatProjection,triangulateSurfaces,createCombatRenderer} from '../js/combat-webgl.mjs';
import {solidPrism} from '../js/exploration-combat-geometry.mjs';
import {faceLightFragments} from '../js/combat-surface-lighting.mjs';
import * as sceneApi from '../js/exploration-encounters.mjs';
const engine=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
// A single non-CORS external bitmap permanently taints the shared raster
// canvas, preventing all later WebGL uploads, even on a different test map.
const stoneUrl=engine.match(/const STONE_FLOOR_TEXTURE_SRC=\s*'([^']+)'/)[1];
assert.equal(stoneUrl.split('?')[0],'assets/terrain/stone-floor-pamnawi.png');
const stoneBytes=readFileSync(new URL('../'+stoneUrl.split('?')[0],import.meta.url));
assert.equal(stoneBytes.subarray(1,4).toString(),'PNG');
assert.equal(createHash('sha256').update(stoneBytes).digest('hex'),'ffcbaaf76efd87964b165e3c6078f9e1de7da5fb96222d64aaa540dc6f075ba0');
assert(engine.indexOf('stoneFloorTexture.crossOrigin="anonymous"')<engine.indexOf('stoneFloorTexture.src=STONE_FLOOR_TEXTURE_SRC'));
console.log('PASS standalone stone artwork is byte-identical, same-origin and configured for CORS before loading');
const extract=name=>{const start=engine.indexOf(`function ${name}(`);return engine.slice(start,engine.indexOf('\n}',start)+2);};
const state={HEX_W:64,HEX_ROW:31.5,camera:{x:4,y:-3},battlefieldRotation:0,BATTLEFIELD_LOGICAL_WIDTH:1080,BATTLEFIELD_LOGICAL_HEIGHT:600};
vm.createContext(state);vm.runInContext(['worldPointForHex','screenPointForWorld','battlefieldProjectVector'].map(extract).join('\n'),state);
// The GPU projection and existing inverse pointer/target math must agree at
// every supported azimuth and zoom, including door leaf thickness and caps.
for(let rotation=0;rotation<6;rotation++)for(const zoom of [.45,1,1.8]){
 state.battlefieldRotation=rotation;
 const p=state.screenPointForWorld({x:0,y:0}),u=state.battlefieldProjectVector({x:1,y:0}),v=state.battlefieldProjectVector({x:0,y:1}),anchor={x:507.6,y:342};
 const view={matrix:[u.x,u.y,v.x,v.y,p.x,p.y],anchor,zoom};
 for(const point of [{x:0,y:0,elevation:0},{x:115,y:-93,elevation:35},{x:-217,y:180,elevation:17.5}]){
  const expected=state.screenPointForWorld(point,point.elevation),actual=combatProjection(point,view);
  assert(Math.abs(actual.x-(anchor.x+(expected.x-anchor.x)*zoom))<1e-8);
  assert(Math.abs(actual.y-(anchor.y+(expected.y-anchor.y)*zoom))<1e-8);
 }
}
const prism=solidPrism({x:0,y:0},{x:128,y:0},1.5,35,0,.57,'door');
const fragments=prism.faces.flatMap(f=>faceLightFragments(f)),mesh=triangulateSurfaces(fragments);
assert(mesh.position.includes(35),'Wall/door height stays in GPU geometry');
assert(mesh.position.some((v,i)=>i%3===1&&Math.abs(v)===.4275),'Door has physical half-wall thickness');
assert.equal(mesh.position.length,mesh.multiply.length);assert.equal(mesh.uv.length,mesh.position.length/3*2);
assert(mesh.position.every(Number.isFinite));
const light=triangulateSurfaces([{points:[{x:0,y:0},{x:1,y:0},{x:0,y:1}],multiply:[.2,.3,.4],boost:[.1,.2,.3],add:[.8,.2,0]}]);
assert.deepEqual(light.multiply,[.2,.3,.4,.2,.3,.4,.2,.3,.4]);assert.deepEqual(light.add,[.8,.2,0,.8,.2,0,.8,.2,0]);
let requested;
assert.throws(()=>createCombatRenderer({getContext(kind){requested=kind;return null;}},{}),/requires WebGL 2/);
assert.equal(requested,'webgl2','No silent WebGL 1 or software renderer substitution');
console.log('PASS GPU projection matches tactical coordinates at all six rotations/zooms; solid height, thickness, light attributes, and explicit WebGL 2 capability failure');

// Exercise the production adapter, replacing only exposure inputs and the GPU
// sink. Static transport is cached; distance/spell presentation stays dynamic.
const hooks=readFileSync(new URL('../js/exploration-combat-hooks.js',import.meta.url),'utf8');
const adapterName='function drawExplorationGpuSolids(',start=hooks.indexOf(adapterName),end=hooks.indexOf('\n}',start)+2;
const draws=[];let samples=0,visibility=1;
const gpuState={explorationEncounterApi:sceneApi,explorationTerrain:{cellW:128,cellH:72.746,torches:[]},explorationEncounter:{origin:{x:0,z:0},openDoors:[]},
 battlefieldViewportBounds:()=>({left:-1000,right:1000,top:-1000,bottom:1000}),screenPointForWorld:(p,h=0)=>({x:p.x,y:p.y-h}),
 explorationVisualLights:()=>[],explorationRenderLights:()=>[],explorationDaylight:()=>null,
 explorationSurfaceExposure:()=>{samples++;return {multiply:[200,180,160],boost:[0,0,0]};},
 explorationVisibilityAtHex:()=>visibility,explorationSpellRadianceAtHex:()=>[.3,.1,0],
 HEX_W:64,HEX_ROW:31.5,explorationDoorImage:{id:'door'},explorationWallImage:{id:'wall'},
 document:{createElement:()=>({tagName:'CANVAS',getContext:()=>({fillRect(){}})})},
 combatGpu:{surface:(surfaces,image)=>draws.push({surfaces,image})}};
vm.createContext(gpuState);const faceStart=hooks.indexOf('function explorationFaceRenderable('),faceEnd=hooks.indexOf('\n}',faceStart)+2;vm.runInContext(hooks.slice(faceStart,faceEnd),gpuState);vm.runInContext(hooks.slice(start,end),gpuState);
const owner={};gpuState.drawExplorationGpuSolids([prism],owner,true);
assert.equal(draws.length,1,'Door faces and textured wood cap share the door artwork in painter order');
assert.equal(draws[0].image.id,'door');assert(draws.every(d=>d.surfaces.every(f=>f.uv.flat().every(Number.isFinite))));
const firstSamples=samples;visibility=.2;draws.length=0;gpuState.drawExplorationGpuSolids([prism],owner,true);
assert.equal(samples,firstSamples,'Distance/flicker must not rebake physical wall transport');
assert(Math.abs(draws[0].surfaces[0].multiply[0]-200/255*.2)<1e-8);
assert.deepEqual(Array.from(draws[0].surfaces[0].add),[.3,.1,0],'Spell radiance may exceed ambient darkness');
draws.length=0;gpuState.drawExplorationGpuSolids([prism],owner,false);
assert(Math.abs(draws[0].surfaces[0].multiply[0]-200/255*.1)<1e-8);assert.deepEqual(Array.from(draws[0].surfaces[0].add),[0,0,0]);
gpuState.explorationEncounter.openDoors=['changed'];gpuState.drawExplorationGpuSolids([prism],owner,true);assert(samples>firstSamples,'Door changes invalidate physical wall light');
console.log('PASS production GPU wall adapter preserves batched solid geometry, cached transport, dynamic fade/radiance, hidden-wall opacity and door invalidation');

// On the shader route the adapter must send ambient/daylight only, with direct
// visibility/tint separate from the exposure decoded by the fragment shader.
gpuState.explorationGpuLighting={};gpuState.explorationGpuPoint=p=>[p.x/128*3,(p.elevation||0)/10,p.y/72.746*3];
gpuState.explorationSurfaceExposure=(p,n,lights)=>{assert.equal(lights.length,0);return {multiply:[200,180,160],boost:[0,0,0]};};
gpuState.explorationSpellRadianceAtHex=()=>{throw Error('CPU spell color/falloff was still evaluated');};
draws.length=0;gpuState.drawExplorationGpuSolids([prism],{},true);
assert(Math.abs(draws[0].surfaces[0].multiply[0]-200/255)<1e-8);
assert.equal(draws[0].surfaces[0].visibility,.2);assert.deepEqual(Array.from(draws[0].surfaces[0].add),[0,0,0]);
assert(draws.every(d=>d.surfaces.every(s=>s.lightPoints.flat().every(Number.isFinite))));
console.log('PASS shader wall route transports base exposure/geometry without CPU point-light or spell shading');
