import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {buildDaylightField} from '../js/portal-daylight.mjs';
import {blankEdgeMap} from '../js/exploration-authoring.mjs';
import {paintEnvironment,paintAmbientLight} from '../js/exploration-environment.mjs';
import {paintEdge,edgeLineBlocked} from '../js/exploration-edges.mjs';
const point=(x,z,y=0)=>({x:x*3,y,z:z*3});
function courtyard(axis='v',kind='door'){
 const map=blankEdgeMap('daylight-qa','Daylight QA');map.torches=[];
 for(let z=0;z<16;z++)for(let x=0;x<16;x++)if((axis==='v'?x:z)>=8)paintEnvironment(map,x,z,true);
 for(let i=0;i<16;i++)paintEdge(map,{axis,x:axis==='v'?8:i,z:axis==='v'?i:8},i===8?kind:'wall');
 return map;
}
const map=courtyard(),door=map.edges.find(e=>e.kind==='door'),closed=buildDaylightField(map),opened=buildDaylightField(map,new Set([door.id])),near=point(7,8),far=point(4,8);
assert.equal(closed.portals.length,0);assert.equal(closed.sample(near).relief,0);
assert.equal(opened.portals.length,1);assert(opened.sample(near).direct>0);assert(opened.sample(near).bounce>0);assert(opened.sample(near).relief>opened.sample(far).relief,'Opening strongest at threshold');
assert.equal(opened.sample(point(10,8)).relief,0,'Outdoor ambient is not added twice');
assert.deepEqual(buildDaylightField(map).sample(near).rgb,[0,0,0],'Closing removes sky and bounce immediately');
const horizontal=courtyard('h'),hDoor=horizontal.edges.find(e=>e.kind==='door');assert(Math.abs(buildDaylightField(horizontal,new Set([hDoor.id])).sample(point(8,7)).relief-opened.sample(near).relief)<1e-10,'Horizontal and vertical openings match');
const windowMap=courtyard('v','window'),window=windowMap.edges.find(e=>e.kind==='window'),windowField=buildDaylightField(windowMap);assert.equal(windowField.portals.length,1);assert(windowField.sample(near).direct>0);assert(edgeLineBlocked(windowMap,new Set(),{x:7,z:8},{x:8,z:8},'movement'),'Windows stay movement-blocking');
const solid=courtyard('v','wall');assert.equal(buildDaylightField(solid).portals.length,0);
const night=structuredClone(map);for(let z=0;z<16;z++)for(let x=8;x<16;x++)paintAmbientLight(night,x,z,0);const nightField=buildDaylightField(night,new Set([door.id]));assert.equal(nightField.portals.length,0);assert(nightField.ambientAt(10,8).intensity<opened.ambientAt(10,8).intensity);
const dim=structuredClone(map);for(let z=0;z<16;z++)for(let x=8;x<16;x++)paintAmbientLight(dim,x,z,40);assert(buildDaylightField(dim,new Set([door.id])).sample(near).relief<opened.sample(near).relief,'Paint controls incoming daylight strength');
paintAmbientLight(dim,6,8,40);assert(buildDaylightField(dim,new Set([door.id])).ambientAt(6,8).intensity>opened.ambientAt(6,8).intensity,'Indoor paint sets authored ambient base');
const partition=structuredClone(map);for(let z=0;z<16;z++)paintEdge(partition,{axis:'v',x:4,z},z===8?'door':'wall');const inner=partition.edges.find(e=>e.kind==='door'&&e.x===4);
const sealed=buildDaylightField(partition,new Set([door.id]));assert.equal(sealed.sample(point(2,8)).relief,0,'No light leaks through a sealed adjacent room');
const connected=buildDaylightField(partition,new Set([door.id,inner.id]));assert(connected.sample(point(2,8)).relief>0);assert(connected.sample(point(2,8)).bounce<connected.sample(point(5,8)).bounce,'Additional doorway attenuates fill');
const facing=opened.sample(point(6,8,1.5),{x:1,y:0,z:0}),away=opened.sample(point(6,8,1.5),{x:-1,y:0,z:0});assert(facing.direct>away.direct,'Wall faces receive orientation-correct sky light');
let rays=0;const visible=()=>{rays++;return true;};const sample=opened.sample(near,{x:0,y:1,z:0},visible),count=rays;assert.equal(opened.sample(near,{x:0,y:1,z:0},visible),sample);assert.equal(rays,count,'Stable queries reuse ray results');assert(count<=3,'Only portal aperture samples cast direct rays');
assert.equal(opened.sample(near,{x:0,y:1,z:0},()=>false).direct,0,'Production visibility callback can occlude the aperture');
const roof=blankEdgeMap('roof','Roof transition');paintEnvironment(roof,8,8,true);assert.equal(buildDaylightField(roof).portals.length,4,'Unwalled roof transitions admit sky through their open edges');
const legacy=JSON.parse(readFileSync(new URL('../data/exploration/old-tollhouse.json',import.meta.url)));assert.equal(buildDaylightField(legacy).portals.length,0,'Legacy all-indoor maps keep prior light');
console.log('PASS daylight doors/open roof edges/windows, four surface environments, close/reopen, painted sky/base ambient, sealed rooms, second-door attenuation, wall normals and cached aperture rays');
// Production cache: changing door or paint snapshots invalidates daylight,
// whereas unit initiative, camera and flicker do not rebuild the static field.
const hooks=readFileSync(new URL('../js/exploration-combat-hooks.js',import.meta.url),'utf8');function extract(name){const a=hooks.indexOf('function '+name+'('),b=hooks.indexOf('\n}',a)+2;return hooks.slice(a,b);}
let builds=0;const env={explorationEncounterApi:{buildDaylightField:(...args)=>{builds++;return buildDaylightField(...args);}},explorationEncounter:{map,openDoors:[]}};vm.createContext(env);vm.runInContext(extract('explorationDaylight'),env);
const a=env.explorationDaylight();assert.equal(env.explorationDaylight(),a);assert.equal(builds,1);env.explorationEncounter.openDoors=[door.id];const b=env.explorationDaylight();assert.notEqual(a,b);assert.equal(b.field.portals.length,1);assert.equal(builds,2);
env.explorationEncounter.map={...map,ambientLight:dim.ambientLight};assert.notEqual(env.explorationDaylight(),b);assert.equal(builds,3);
console.log('PASS production daylight field cache invalidation for doors and ambient paint');

const engine=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8'),start=engine.indexOf('function illuminationAtHex('),end=engine.indexOf('\n}',start)+2;
let darkness=false;const tactical={explorationTerrain:{},explorationAmbientIlluminationAtHex:()=>.9,ambientIlluminationLevel:()=>.42,dynamicIlluminationAtHex:()=>0,hasEffectiveDarknessAtHex:()=>darkness};vm.createContext(tactical);vm.runInContext(engine.slice(start,end),tactical);assert.equal(tactical.illuminationAtHex(0,0),.9,'Tactical illumination sees the same natural daylight');darkness=true;assert.equal(tactical.illuminationAtHex(0,0),0,'Natural daylight does not cancel magical Darkness');
console.log('PASS shared tactical daylight level with authoritative magical Darkness');
