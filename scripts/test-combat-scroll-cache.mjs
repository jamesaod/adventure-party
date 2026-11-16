import assert from 'node:assert/strict';
import vm from 'node:vm';import fs from 'node:fs';
import {createGroundCover} from '../js/combat-ground-cover.mjs?v=tree-snow-grains1';
import {extractCombatFunction} from './combat-test-source.mjs';
let allocations=0,receiver,offset=0;const observer={id:'a',x:0,y:0},context=new Proxy({}, {get:()=>()=>{}});const env={queueCombatUnitGpuShadow(){},game:{},combatGpu:{projectedShadows:{receiver:r=>receiver=r,lighting(){}}},combatSceneTerrain:{},combatSceneContext:null,architecturalWalls:[],combatShadowScale:()=>[1,1,1],battlefieldWorldViewport:()=>({left:offset,top:0,right:offset+100,bottom:100}),friendlyVisibilityObservers:()=>[observer],document:{createElement:()=>{allocations++;return {getContext:()=>context};}},observerVisibilityContext:()=>null,HEX_W:64,HEX_H:42,HEX_ROW:31.5,inside:()=>true,isHexVisibleToFriendlyParty:()=>true,explorationFloorFragments:()=>[],explorationEncounterApi:{SCENE_STYLE:{cellMetres:3}},explorationRenderLights:()=>[]};vm.createContext(env);const source=fs.readFileSync(new URL('../js/combat-lighting-services.js',import.meta.url),'utf8');vm.runInContext(extractCombatFunction(source,'prepareCombatProjectedShadows'),env);env.prepareCombatProjectedShadows([]);assert.equal(allocations,1);const first=receiver;offset=30;env.prepareCombatProjectedShadows([]);assert.equal(receiver,first);offset=65;env.prepareCombatProjectedShadows([]);assert.equal(allocations,2);observer.x=1;env.prepareCombatProjectedShadows([]);assert.equal(allocations,3,'Moving observers invalidate receiver LOS');env.architecturalWalls=[];env.prepareCombatProjectedShadows([]);assert.equal(allocations,4,'Geometry invalidates receiver');console.log('PASS receiver containment, panning reuse and observer/geometry refresh');




