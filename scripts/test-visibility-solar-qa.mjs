import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {blankEdgeMap} from '../js/exploration-authoring.mjs';
import {paintEdge} from '../js/exploration-edges.mjs';
import {paintQuarter} from '../js/quarter-walls.mjs';
import {accessibleFloor} from '../js/exploration-accessibility.mjs';
import {terrainForEncounter} from '../js/exploration-encounters.mjs';
import {solarState,hourFromPointer,solarAmbient,solarFaceGain,solarTimeLabel} from '../js/solar-clock.mjs';
import {buildDaylightField} from '../js/portal-daylight.mjs';
const map=blankEdgeMap('qa272','Mixed sealed areas');map.start={x:1,z:1,facing:0};map.entrances=[];map.exits=[];
for(let x=4;x<10;x++){paintEdge(map,{axis:'h',x,z:4},'wall');paintEdge(map,{axis:'h',x,z:10},'wall');}
for(let z=4;z<10;z++){paintEdge(map,{axis:'v',x:4,z},'wall');paintEdge(map,{axis:'v',x:10,z},'wall');}
paintEdge(map,{axis:'h',x:13,z:10},'wall'); // A disjoint wall on the same axis must not create a false gap.
paintQuarter(map,5,5,'nw');let access=accessibleFloor(map);assert(!access.at({x:6,z:6}),'Unmatched partial curved-cell edges do not create entrances to sealed straight rooms');
map.exits=[{x:6,z:6,targetMap:'elsewhere',targetEntrance:'entry'}];assert(!accessibleFloor(map).at({x:6,z:6}),'An exit without an entrance does not unseal a region');
const terrain=terrainForEncounter(map,map.start,new Set());assert(terrain.blackoutSpaces.some(s=>s.id==='floor-6-6'));assert(!terrain.spaces.some(s=>s.id==='floor-6-6'));
paintEdge(map,{axis:'h',x:7,z:10},'door');assert(accessibleFloor(map).at({x:6,z:6}),'Openable doors preserve access independent of their current state');assert(accessibleFloor(map).at({x:4.6,z:4.6}),'Partial edge joins remain connected inside accessible rooms');
const edgeMap=blankEdgeMap('border','Sealed edge room');edgeMap.start={x:5,z:1};edgeMap.entrances=[];edgeMap.environment=Array(16).fill('o'.repeat(16));
for(let x=0;x<3;x++){paintEdge(edgeMap,{axis:'h',x,z:5},'wall');paintEdge(edgeMap,{axis:'h',x,z:9},'wall');}for(let z=5;z<9;z++){paintEdge(edgeMap,{axis:'v',x:0,z},'wall');paintEdge(edgeMap,{axis:'v',x:3,z},'wall');}assert(!accessibleFloor(edgeMap).at({x:1,z:6}),'Outdoor map-border cells do not bypass authored enclosure');
const near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
near(solarState(6).altitude,0);near(solarState(6).azimuth,90);near(solarState(12).altitude,52);near(solarState(12).azimuth,180);near(solarState(18).azimuth,270);near(solarState(0).altitude,-52);
near(hourFromPointer(0,-1),12);near(hourFromPointer(-1,0),6);near(hourFromPointer(1,0),18);near(hourFromPointer(0,1),0);assert.equal(solarTimeLabel(24),'00:00');
const base={sky:0xc7deff,ground:0x8b8971,intensity:2.4};assert.deepEqual(solarAmbient(base,solarState(12)),base);assert(solarAmbient(base,solarState(0)).intensity<.1);near(solarFaceGain({x:0,y:0,z:1},solarState(12)),1);assert(solarFaceGain({x:1,y:0,z:0},solarState(7))>solarFaceGain({x:-1,y:0,z:0},solarState(7)));
const daylightMap=blankEdgeMap('daylight','Ambient preservation');daylightMap.environment=Array(16).fill('o'.repeat(16));daylightMap.environment[5]='oooooioooooooooo';daylightMap.ambientLight=Array.from({length:16},()=>Array(16).fill(null));daylightMap.ambientLight[5][5]=150;
const noon=buildDaylightField(daylightMap,new Set(),solarState(12)),night=buildDaylightField(daylightMap,new Set(),solarState(0));near(noon.ambientAt(5,5).intensity,night.ambientAt(5,5).intensity);assert(night.ambientAt(4,5).intensity<noon.ambientAt(4,5).intensity);assert(night.portals.length===0&&noon.portals.length>0);
// Execute the production wall visibility helper against friendly floor polygons.
const hooks=readFileSync(new URL('../js/exploration-combat-hooks.js',import.meta.url),'utf8'),start=hooks.indexOf('function explorationWallFragmentVisible('),end=hooks.indexOf('\n}',start)+2;
const sandbox={combatLightingFrame:1,explorationTerrain:{cellW:128,cellH:72},friendlyVisibilityObservers:()=>[{}],observerVisibilityContext:()=>({polygon:[{x:-100,y:-100},{x:0,y:-100},{x:0,y:100},{x:-100,y:100}]}),pointInSimplePolygon:p=>p.x<0};vm.createContext(sandbox);vm.runInContext(hooks.slice(start,end),sandbox);
const fragment=x=>({points:[{x,y:0},{x:x+1,y:0},{x:x+1,y:1},{x,y:1}]});assert(sandbox.explorationWallFragmentVisible(fragment(-5),{x:0,z:1},true));assert(!sandbox.explorationWallFragmentVisible(fragment(5),{x:0,z:1},true),'A visible portion of the wall cannot illuminate a corner outside floor LOS');
console.log('PASS mixed/edge sealed regions, real partial-span connectivity, door/exit handling, equinox solar geometry, pointer wrap, outdoor-only solar ambient, portals and per-fragment friendly LOS');

const visualStart=hooks.indexOf('function explorationVisualDaylight('),visualEnd=hooks.indexOf('\n}',visualStart)+2;
let hour=12,builds=0;const rulesField={field:{rules:true},revision:7};
const visual={adventurePartySolar:{state:()=>solarState(hour)},explorationDaylight:()=>rulesField,explorationEncounter:{map:{},openDoors:[]},explorationEncounterApi:{buildDaylightField:()=>{builds++;return {visual:true};}}};vm.createContext(visual);vm.runInContext(hooks.slice(visualStart,visualEnd),visual);
assert.equal(visual.explorationVisualDaylight(),rulesField,'Noon reuses the original daylight field');hour=0;const dark=visual.explorationVisualDaylight();assert.notEqual(dark.revision,rulesField.revision,'Solar keys cannot collide with the noon bake');assert.equal(visual.explorationVisualDaylight(),dark);assert.equal(builds,1);hour=12;assert.equal(visual.explorationVisualDaylight(),rulesField);hour=0;assert.equal(visual.explorationVisualDaylight(),dark);assert.equal(builds,1);assert.deepEqual(rulesField.field,{rules:true});
console.log('PASS solar field cache reuse, noon parity, non-colliding bake keys and untouched rules daylight');
