import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {blankEdgeMap} from '../js/exploration-authoring.mjs';import {paintEdge} from '../js/exploration-edges.mjs';import {terrainForEncounter} from '../js/exploration-encounters.mjs';
const map=blankEdgeMap('performance-regression','Performance regression');
for(let x=2;x<14;x++)for(let z=2;z<14;z++)if((x+z)%4===0)paintEdge(map,{axis:(x+z)%8?'v':'h',x,z},x%5===0?'window':x%3===0?'door':'wall');
const terrain=terrainForEncounter(map,{x:3,z:13},new Set()),source=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const names=['battlefieldZoomAnchor','battlefieldViewportBounds','worldPointForHex','cross2','pointOnSegment','segmentsIntersect','pointInConvexPolygon','architecturalHexCoreVertices','architecturalWallLength','architecturalWallPointAt','wallOpeningCenterT','wallOpeningPassesMode','wallBlockingSubsegments','wallSegmentCutsHexInterior','rebuildArchitecturalBlockedHexes','architecturalWallWorldVertices','wallPolygonSegments','architecturalWallBlocksWorldLine','visibilityWorldBounds','visibilitySegments','cross2d','raySegmentIntersection','castVisibilityRay','wallTestVisibilityPolygonWorld','observerVisibilityContext'];
const code=names.map(name=>{const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);return source.slice(start,end);}).join('\n');
const env={battlefieldZoom:1,battlefieldRotation:0,game:{condition:'wall'},HEX_W:64,HEX_H:42,HEX_ROW:31.5,ARCHITECTURAL_HEX_CORE_SCALE:.9,MAP_MIN_X:-2,MAP_MAX_X:2,MAP_MIN_Y:-2,MAP_MAX_Y:2,architecturalBlockedHexes:new Set(),key:(x,y)=>`${x},${y}`,camera:{x:0,y:0},BATTLEFIELD_LOGICAL_WIDTH:1050,BATTLEFIELD_LOGICAL_HEIGHT:600,architecturalWalls:terrain.walls};vm.createContext(env);vm.runInContext(code,env);
let seed=6731;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),point=()=>({x:(random()-.5)*2400,y:(random()-.7)*1500});
for(const mode of ['movement','los','light','projectile','volume'])for(let i=0;i<250;i++){
 const a=point(),b=point(),expected=env.architecturalWalls.some(w=>env.wallBlockingSubsegments(w,mode).some(s=>env.segmentsIntersect(a,b,s.a,s.b)));
 assert.equal(env.architecturalWallBlocksWorldLine(a,b,mode),expected,'Indexed blocking must match the complete wall scan for '+mode);
}
const segments=env.visibilitySegments('los').segments;let baselineChecks=0,indexedChecks=0;const intersect=env.raySegmentIntersection;env.raySegmentIntersection=(...args)=>{indexedChecks++;return intersect(...args);};
for(let i=0;i<500;i++){
 const origin=i<10?{x:i%2?128:0,y:i%3?0:-128}:point(),angle=i<8?i*Math.PI/4:(random()*2-1)*Math.PI;
 let expected=null;for(const segment of segments){baselineChecks++;const hit=intersect(origin,angle,segment);if(hit&&(!expected||hit.t<expected.t))expected=hit;}
 const actual=env.castVisibilityRay(origin,angle,segments);assert.equal(!!actual,!!expected);
 if(expected){assert(Math.abs(actual.t-expected.t)<1e-7);assert(Math.hypot(actual.x-expected.x,actual.y-expected.y)<1e-7);}
}
const rayChecks=indexedChecks;assert(rayChecks<baselineChecks/3,'Spatial ray walking must remove most segment intersection work');
const observer={x:0,y:0};let casts=0;const cast=env.castVisibilityRay;env.castVisibilityRay=(...args)=>{casts++;return cast(...args);};
const first=env.observerVisibilityContext(observer);assert(first?.polygon.length>2);const coldCasts=casts;
for(let i=0;i<100;i++)assert.equal(env.observerVisibilityContext(observer).polygon,first.polygon);
assert.equal(casts,coldCasts,'Stationary visibility must reuse its polygon across UI, rendering and rule queries');
observer.x++;env.observerVisibilityContext(observer);assert(casts>coldCasts);let prior=casts;env.camera.y++;env.observerVisibilityContext(observer);assert(casts>prior);
prior=casts;env.architecturalWalls=[...env.architecturalWalls];env.observerVisibilityContext(observer);assert(casts>prior,'New door/terrain geometry invalidates visibility');
prior=casts;env.rebuildArchitecturalBlockedHexes();env.observerVisibilityContext(observer);assert(casts>prior,'Explicit terrain rebuild invalidates in-place geometry caches');
const wall={id:'mutable',a:{x:128,y:-64},b:{x:128,y:64},blocksMovement:true,blocksLOS:true,openings:[]};env.architecturalWalls=[wall];assert(env.architecturalWallBlocksWorldLine({x:0,y:0},{x:256,y:0}));wall.openings=[{type:'doorway',centerT:.5,widthWorld:64}];env.rebuildArchitecturalBlockedHexes();assert(!env.architecturalWallBlocksWorldLine({x:0,y:0},{x:256,y:0}));
console.log(`PASS cached visibility invalidation, ${baselineChecks} -> ${rayChecks} ray checks, 1,250 indexed mode queries and exact ray-hit parity across endpoints/corners/outside origins`);

for(const zoom of [.6,1,1.8])for(let rotation=0;rotation<6;rotation++){
 env.battlefieldZoom=zoom;env.battlefieldRotation=rotation;
 const bounds=env.visibilityWorldBounds(),v=env.battlefieldViewportBounds(),a=env.battlefieldZoomAnchor(),c=env.worldPointForHex(env.camera.x,env.camera.y);
 assert(bounds.left<=c.x+v.left-a.x&&bounds.right>=c.x+v.right-a.x);
 assert(bounds.top<=c.y+v.top-a.y&&bounds.bottom>=c.y+v.bottom-a.y);
 const prior=env.wallTestVisibilityPolygonWorld(observer);env.battlefieldZoom=zoom+.001;
 assert.notEqual(env.wallTestVisibilityPolygonWorld(observer),prior,'Zoom invalidates LOS');
}
console.log('PASS LOS viewport coverage at all six rotations and minimum/default/maximum zoom');
