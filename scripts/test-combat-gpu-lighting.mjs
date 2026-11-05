import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readCombatFixture as readFileSync} from './combat-test-source.mjs';
import {MAX_COMBAT_LIGHTS,packCombatLights,linearLightColor} from '../js/combat-light-shader.mjs';
import {triangulateSurfaces} from '../js/combat-webgl.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const light={x:2,y:3,z:4,color:0xffa64d,intensity:8,range:10,decay:1.5,bounds:[-4,-5,8,10]};
const spell={kind:'spell',x:.25,y:2,color:[255,100,0],intensity:2,range:5,bounds:[0,0,64,32]};
const packed=packCombatLights([light,spell]);
assert.deepEqual([...packed.position.slice(0,8)],[2,3,4,0,.25,2,0,1]);
assert(Math.abs(packed.color[1]-linearLightColor(0xffa64d)[1])<1e-6);
assert(Math.abs(packed.color[5]-100/255)<1e-6,'Spell color stays display RGB');
assert.throws(()=>packCombatLights(Array(MAX_COMBAT_LIGHTS+1).fill(light)),RangeError);
const mesh=triangulateSurfaces([{points:[{x:0,y:0},{x:1,y:0},{x:0,y:1}],lightPoints:[[1,2,3],[2,2,3],[1,2,4]],lightNormal:[0,0,1],lightWorld:[[7,8],[7,8],[7,8]],visibility:.2,tint:[.5,.4,.3]}]);
assert.deepEqual(mesh.lightPoint,[1,2,3,2,2,3,1,2,4]);assert.deepEqual(mesh.lightWorld,[7,8,7,8,7,8]);assert.deepEqual(mesh.visibility,[.2,.2,.2]);
// Execute production setup with real source count and fake raster only. The
// overflow route must retain CPU lighting, never silently discard emitters.
const hooks=read('js/combat-lighting-hooks.js');let transferred;
const target={save(){},restore(){},setTransform(){},clearRect(){},beginPath(){},rect(){},clip(){},translate(){},scale(){},fillRect(){}};
const mask={width:0,height:0,getContext:()=>target};
const state={URLSearchParams,location:{search:'?combatLighting=gpu'},combatGpu:{setLighting:v=>{transferred=v;}},explorationTerrain:{cellW:128,cellH:72,torches:[]},explorationEncounterApi:{SCENE_STYLE:{cellMetres:3}},explorationEncounter:{origin:{x:0,z:0},openDoors:[]},
 explorationVisualLights:()=>Array(33).fill(light),explorationRenderLights:()=>[],document:{createElement:()=>mask},game:{condition:'grass',areaEffects:[]},HEX_W:64,HEX_ROW:31.5,camera:{x:0,y:0},battlefieldZoom:1,battlefieldRotation:0};
vm.createContext(state);vm.runInContext(hooks,state);vm.runInContext('prepareExplorationGpuLighting()',state);assert.equal(transferred,undefined);
state.explorationVisualLights=()=>[light];vm.runInContext('prepareExplorationGpuLighting()',state);assert.equal(transferred.lights.length,1);const revision=transferred.maskRevision;
vm.runInContext('prepareExplorationGpuLighting()',state);assert.equal(transferred.maskRevision,revision,'Static lights reuse their visibility silhouettes');
light.intensity=9;vm.runInContext('prepareExplorationGpuLighting()',state);assert.equal(transferred.maskRevision,revision,'Flicker updates shader intensity without rebuilding silhouettes');
light.x+=1;vm.runInContext('prepareExplorationGpuLighting()',state);assert(transferred.maskRevision>revision,'Moving a light invalidates its silhouette');
state.explorationEncounter.openDoors=['open'];vm.runInContext('prepareExplorationGpuLighting()',state);assert(transferred.maskRevision>revision,'Opening a door invalidates visibility transport');
state.location.search='';transferred=undefined;vm.runInContext('prepareExplorationGpuLighting()',state);assert.equal(transferred,undefined);
console.log('PASS GPU light units/colors, per-surface samples, explicit overflow/reference routes, static silhouette reuse and door invalidation');
