import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {solidPrism,combatDoorSolids} from '../js/exploration-combat-geometry.mjs';
import {SCENE_STYLE} from '../js/exploration-scene-style.mjs';
import {solarState} from '../js/solar-clock.mjs';
import {cachedWallGroundShadows,projectWallGroundPolygon,wallSunRetention,MAX_WALL_SHADOW_HEIGHTS} from '../js/wall-ground-shadows.mjs';
const t={cellW:128,cellH:128},solid=solidPrism({x:0,y:0},{x:128,y:0},0,35),noon=solarState(12);let builds=0;
const options={geometryKey:'closed',solids:()=>{builds++;return [solid,solid];}};
const field=cachedWallGroundShadows(t,SCENE_STYLE,noon,options),poly=projectWallGroundPolygon(solid,t,SCENE_STYLE,noon);
assert(Math.abs(Math.min(...poly.map(p=>p.z))+3.5/Math.tan(52*Math.PI/180))<1e-8,'Noon shadow length uses physical wall height and 52-degree Sun');
assert.equal(field.occlusion({x:1,z:-1}),1);assert.equal(field.occlusion({x:1,z:1}),0);assert(Math.abs(wallSunRetention(field.occlusion({x:1,z:-1}),noon)-.45)<1e-9,'Overlaps form one shadow, not stacked darkness');
for(let i=0;i<30;i++)assert.equal(cachedWallGroundShadows(t,SCENE_STYLE,noon,{...options,solids:()=>{throw Error('Camera/unit movement must not rebuild wall geometry');}}),field);
assert.equal(builds,1);assert.equal(field.stats.projectionBuilds,1);
const morning=projectWallGroundPolygon(solid,t,SCENE_STYLE,solarState(9)),evening=projectWallGroundPolygon(solid,t,SCENE_STYLE,solarState(15));assert(Math.min(...morning.map(p=>p.x))<0);assert(Math.max(...evening.map(p=>p.x))>3);
const horizon=projectWallGroundPolygon(solid,t,SCENE_STYLE,solarState(6.01));for(const p of horizon){const nearest=Math.max(0,Math.min(3,p.x));assert(Math.hypot(p.x-nearest,p.z)<=3.5*MAX_WALL_SHADOW_HEIGHTS+1e-7);}
const night=cachedWallGroundShadows(t,SCENE_STYLE,solarState(0),options);assert.equal(night.polygons.length,0);assert.equal(night.occlusion({x:1,z:-1}),0);assert.equal(builds,1);
const changed=cachedWallGroundShadows(t,SCENE_STYLE,noon,{...options,geometryKey:'opened'});assert.equal(builds,2);assert.notEqual(changed.revision,field.revision);
const door={edgeId:'door',axis:'z',center:{x:0,y:0},width:.375,open:false},closed=combatDoorSolids(door,t,SCENE_STYLE).leaf,opened=combatDoorSolids({...door,open:true},t,SCENE_STYLE).leaf;assert.notDeepEqual(projectWallGroundPolygon(closed,t,SCENE_STYLE,noon),projectWallGroundPolygon(opened,t,SCENE_STYLE,noon));
// Verify production exposure only modifies outdoor ground sunlight, preserving
// the exact local-light list, indoor ambient and elevated wall exposure.
const hooks=readFileSync(new URL('../js/exploration-combat-hooks.js',import.meta.url),'utf8'),start=hooks.indexOf('function explorationSurfaceExposure('),end=hooks.indexOf('\n}',start)+2;
let environment='outdoor';const captures=[],lights=[{intensity:12}],ambient={sky:0xffffff,ground:0xffffff,intensity:2.4};
const sandbox={adventurePartySolar:{state:()=>noon},explorationTerrain:t,explorationEncounter:{origin:{x:10,z:20},map:{}},explorationDaylight:()=>({field:{ambientAt:()=>ambient,sample:()=>({rgb:[0,0,0]})}}),explorationWallGroundShadows:()=>({occlusion:p=>{assert(Math.abs(p.x-1)<1e-9);assert(Math.abs(p.z+1)<1e-9);return 1;}}),explorationDaylightVisible:()=>true,
 explorationEncounterApi:{SCENE_STYLE,surfaceAt:()=>({cell:{x:0,z:0},environment}),wallSunRetention,solarAmbient:()=>ambient,solarFaceGain:()=>1,surfaceLight:(p,n,l,v,a)=>{captures.push({a,l});return [1,1,1];},displayExposure:x=>x}};
vm.createContext(sandbox);vm.runInContext(hooks.slice(start,end),sandbox);
sandbox.explorationSurfaceExposure({x:31,y:0,z:59},{x:0,y:1,z:0},lights,new Set());assert(Math.abs(captures.at(-1).a.intensity-2.4*.45)<1e-9);assert.equal(captures.at(-1).l,lights);
environment='indoor';sandbox.explorationSurfaceExposure({x:31,y:0,z:59},{x:0,y:1,z:0},lights,new Set());assert.equal(captures.at(-1).a.intensity,2.4);
environment='outdoor';sandbox.explorationSurfaceExposure({x:31,y:3.5,z:59},{x:0,y:1,z:0},lights,new Set());assert.equal(captures.at(-1).a.intensity,2.4);
console.log('PASS physical wall projection/length, horizon cap, union overlap, stable camera/unit cache, door invalidation, night suppression and outdoor-ground-only solar attenuation preserving local lights');
