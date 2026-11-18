import assert from 'node:assert/strict';
import vm from 'node:vm';import fs from 'node:fs';
import {createGroundCover} from '../js/combat-ground-cover.mjs?v=cover-profile1';
import {extractCombatFunction} from './combat-test-source.mjs';
let allocations=0,receiver,offset=0;const observer={id:'a',x:0,y:0},context=new Proxy({}, {get:()=>()=>{}});const env={queueCombatUnitGpuShadow(){},game:{},combatGpu:{projectedShadows:{receiver:r=>receiver=r,lighting(){}}},combatSceneTerrain:{},combatSceneContext:null,architecturalWalls:[],combatShadowScale:()=>[1,1,1],battlefieldWorldViewport:()=>({left:offset,top:0,right:offset+100,bottom:100}),friendlyVisibilityObservers:()=>[observer],document:{createElement:()=>{allocations++;return {getContext:()=>context};}},observerVisibilityContext:()=>null,HEX_W:64,HEX_H:42,HEX_ROW:31.5,inside:()=>true,isHexVisibleToFriendlyParty:()=>true,explorationFloorFragments:()=>[],explorationEncounterApi:{SCENE_STYLE:{cellMetres:3}},explorationRenderLights:()=>[]};vm.createContext(env);const source=fs.readFileSync(new URL('../js/combat-lighting-services.js',import.meta.url),'utf8');vm.runInContext(extractCombatFunction(source,'prepareCombatProjectedShadows'),env);env.prepareCombatProjectedShadows([]);assert.equal(allocations,1);const first=receiver;offset=30;env.prepareCombatProjectedShadows([]);assert.equal(receiver,first);offset=65;env.prepareCombatProjectedShadows([]);assert.equal(allocations,2);observer.x=1;env.prepareCombatProjectedShadows([]);assert.equal(allocations,3,'Moving observers invalidate receiver LOS');env.architecturalWalls=[];env.prepareCombatProjectedShadows([]);assert.equal(allocations,4,'Geometry invalidates receiver');console.log('PASS receiver containment, panning reuse and observer/geometry refresh');





// Screen painter order can change while the same crown constraints remain.
const THREE=await import('../assets/vendor/three/three.module.min.js');
globalThis.matchMedia=()=>({matches:true});THREE.TextureLoader.prototype.load=()=>new THREE.Texture();
const cover=createGroundCover({snow:{texture:null,footprintTexture:null,bounds:new THREE.Vector4()},texture:t=>t,flush(){},markBackdrop(){},paint(){}});
const face={_groundKey:'pan-test',grass:true,snowEligible:1,grassUnit:10,grassSquash:1,points:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}]};
const crowns=[{x:20,y:25,sortY:28,rx:15,ry:10},{x:70,y:25,sortY:28,rx:15,ry:10}];
function prepareCrowns(input,tx=0,ty=0){cover.begin({width:1000,height:1000,anchor:{x:0,y:0},zoom:1,matrix:[1,0,0,1,tx,ty]});cover.collect([face],{});cover.prepare([],[],input);return cover.diagnostics().layoutReused;}
assert.equal(prepareCrowns(crowns),false);
assert.equal(prepareCrowns([...crowns].reverse()),true,'Painter reordering cannot rebuild grass');
assert.equal(prepareCrowns(crowns.map(c=>({...c,x:c.x+3.25,y:c.y-2.75,sortY:c.sortY-2.75})).reverse(),3.25,-2.75),true,'Fractional pan retains identical world constraints');
assert.equal(prepareCrowns([{...crowns[0],rx:30},crowns[1]]),false,'Real crown changes invalidate layout');
assert.equal(prepareCrowns([crowns[0]]),false,'Removed crowns invalidate layout');cover.dispose();
console.log('PASS pan/reordered crown reuse and actual crown edit/removal invalidation');
