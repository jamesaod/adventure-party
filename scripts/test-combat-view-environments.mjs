import assert from 'node:assert/strict';
import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {blankEdgeMap,paintCell,resizeMap,seedPack,parsePack} from '../js/exploration-authoring.mjs';
import {isOutdoor,validateEnvironment} from '../js/exploration-environment.mjs';
import {SCENE_STYLE,materialMetrics,ambientForCell,surfaceLight} from '../js/exploration-scene-style.mjs';
import {explorationDoor} from '../js/exploration-materials.mjs';
const map=blankEdgeMap('environment-test','Environment test');
assert(!isOutdoor(map,3,3));paintCell(map,3,3,'outdoor');paintCell(map,4,3,'outdoor');
assert(isOutdoor(map,3,3));assert.equal(map.grid[3][3],'.');
const roundtrip=parsePack(JSON.stringify(seedPack(map))).maps[0];assert(isOutdoor(roundtrip,3,3));
resizeMap(roundtrip,20,18);assert(isOutdoor(roundtrip,3,3));assert(!isOutdoor(roundtrip,19,17));validateEnvironment(roundtrip);
paintCell(roundtrip,3,3,'indoor');assert(!isOutdoor(roundtrip,3,3));
assert.throws(()=>validateEnvironment({...map,environment:['o']}));
const point={x:0,y:0,z:0},normal={x:0,y:1,z:0};
const indoor=surfaceLight(point,normal,[],()=>true,ambientForCell(map,2,3)),outdoor=surfaceLight(point,normal,[],()=>true,ambientForCell(map,3,3));assert(outdoor.every((n,i)=>n>indoor[i]));
assert.equal(SCENE_STYLE.door.depth,SCENE_STYLE.wallDepthMetres/2);
assert.equal(explorationDoor().hinge.children[0].geometry.parameters.depth,SCENE_STYLE.wallDepthMetres/2);
const source=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
function extract(name){const start=source.indexOf(`function ${name}(`),end=source.indexOf('\n}',start)+2;return source.slice(start,end);}
const state={HEX_W:64,HEX_H:42,HEX_ROW:31.5,camera:{x:0,y:0},battlefieldZoom:1,battlefieldRotation:0,BATTLEFIELD_LOGICAL_WIDTH:1050,BATTLEFIELD_LOGICAL_HEIGHT:600,canvas:{getBoundingClientRect:()=>({left:0,top:0,width:1050,height:600})},hoverHex:null,document:{getElementById:()=>null},draw(){}};
vm.createContext(state);vm.runInContext(['worldPointForHex','screenPointForWorld','battlefieldProjectVector','battlefieldWorldAtScreen','battlefieldWorldViewport','hexCenter','hexScreenVertices','roundAxial','hexAtCanvasPoint','battlefieldZoomAnchor','battlefieldViewportBounds','canvasEventPoint','rotateBattlefield'].map(extract).join('\n'),state);
for(const zoom of [.6,1,1.8])for(let step=0;step<6;step++){
 state.battlefieldZoom=zoom;state.battlefieldRotation=step;
 const a=state.battlefieldZoomAnchor();
 for(const hex of [{x:-5,y:8},{x:2,y:-3},{x:0,y:0}]){
 const p=state.hexCenter(hex.x,hex.y),back=state.canvasEventPoint({clientX:a.x+(p.x-a.x)*zoom,clientY:a.y+(p.y-a.y)*zoom});
 const actual=state.hexAtCanvasPoint(back.x,back.y);assert.equal(actual.x,hex.x);assert.equal(actual.y,hex.y,'Rotated clicks select the original world hex');
 const raised=state.hexCenter(hex.x,hex.y,35);assert.equal(raised.x,p.x);assert.equal(raised.y,p.y-35,'Height stays vertical at every azimuth');
 }

}
state.battlefieldRotation=0;state.rotateBattlefield(-1);assert.equal(state.battlefieldRotation,5);for(let i=0;i<6;i++)state.rotateBattlefield(1);assert.equal(state.battlefieldRotation,5);
const facing=[];const caster={alive:true,x:0,y:0};
const spellEnv={faceEntityToward:(c,t)=>facing.push(t),speakSpellIncantation(){},getUnitEffect:()=>null,spellBreaksInvisibility:()=>false};vm.createContext(spellEnv);vm.runInContext(extract('commitSpellCast'),spellEnv);
assert(spellEnv.commitSpellCast(caster,{},null,1800,{x:2,y:-1}));assert.equal(facing.length,1);
spellEnv.commitSpellCast(caster,{},null,1800,{x:0,y:0});assert.equal(facing.length,1,'Self cast preserves facing');
spellEnv.commitSpellCast({...caster,alive:false},{},null,1800,{x:1,y:0});assert.equal(facing.length,1,'Rejected cast does not turn');
console.log('PASS environment paint/export/resize/legacy defaults, local ambient, half-wall door thickness, 18 rotated input transforms, rotation wrapping and committed spell facing');

let viewportCalls=0;
Object.assign(state,{camera:{x:0,y:0},VIEW_RADIUS:20,HEX_W:64,HEX_H:42,HEX_ROW:31.5,inside:()=>true,hexCenter:(x,y)=>({x:493.5+x*64+y*32,y:342+y*31.5})});
const viewport=state.battlefieldWorldViewport;state.battlefieldWorldViewport=()=>{viewportCalls++;return viewport();};
vm.runInContext(extract('visibleHexes'),state);assert(state.visibleHexes().length>0);assert.equal(viewportCalls,1,'Compute viewport once per terrain scan, not once per hex');

const geometry=await import('../js/exploration-combat-geometry.mjs');
const terrain={cellW:128,cellH:128*31.5/64/(Math.sqrt(3)/2)},style=SCENE_STYLE;
for(const axis of ['x','z'])for(const hinge of ['start','end']){
 const door={center:{x:128,y:75},edgeId:'door',axis,hinge,width:.42,open:false};
 const closed=geometry.combatDoorSolids(door,terrain,style),opened=geometry.combatDoorSolids({...door,open:true},terrain,style);
 assert.deepEqual(closed.hinge,opened.hinge);assert.equal(closed.leaf.depth,style.tacticalWallThickness/2);
 for(const solid of [closed.leaf,opened.leaf]){
  assert.equal(solid.faces.length,5,'Two broad faces, two ends and a top');
  for(let angle=0;angle<6;angle++){
   state.battlefieldRotation=angle;
   for(const face of solid.faces.filter(f=>!f.cap)){
    const bottom=state.screenPointForWorld(face.points[0],face.points[0].elevation),top=state.screenPointForWorld(face.points[3],face.points[3].elevation);
    assert.equal(bottom.x,top.x);assert(Math.abs(bottom.y-top.y-solid.height)<1e-8);
   }
  }
  const footprint=new Set(solid.faces.flatMap(f=>f.points).map(p=>`${p.x},${p.y}`));assert.equal(footprint.size,4,'Leaf is a solid rectangle, never a plane');
 }
}
// Production renderer: unseen architecture is composited once at .1 opacity;
// stationary/camera-pan redraws reuse pixels rather than relighting each face.
const hooks=readFileSync(new URL('../js/exploration-combat-hooks.js',import.meta.url),'utf8');
let allocations=0,drawAlpha=[];
const facePaints=[];const target=new Proxy({},{get:()=>()=>{},set:(o,key,value)=>{if(key==='fillStyle')facePaints.push(value);return true;}});
const render={...state,Image:class{},DOMMatrix:class{},explorationEncounterApi:{...geometry,materialMetrics,SCENE_STYLE:style},explorationTerrain:terrain,explorationEncounter:{origin:{x:0,z:0},openDoors:[]},
 document:{createElement:()=>{allocations++;return {getContext:()=>target};}},ctx:{save(){},restore(){},drawImage(){drawAlpha.push(this.globalAlpha);}},
 explorationVisualLights:()=>[],explorationSurfaceExposure:()=>({multiply:[255,255,255],boost:[0,0,0]}),isArchitecturalWallVisibleToFriendlyParty:()=>false};
vm.createContext(render);vm.runInContext(hooks.slice(0,hooks.indexOf('function configureExplorationTerrain()')),render);
render.explorationVisualLights=()=>[];render.explorationSurfaceExposure=()=>({multiply:[255,255,255],boost:[0,0,0]});
render.explorationMaterialTile=()=>null;
const wall={a:{x:0,y:0},b:{x:64,y:0}},solids=[geometry.solidPrism(wall.a,wall.b,3,35,0,terrain.cellH/terrain.cellW)];
render.drawExplorationSolids(solids,wall,false);assert.equal(allocations,1);assert.equal(drawAlpha.at(-1),.1);
render.drawExplorationSolids(solids,wall,true);assert.equal(allocations,1);assert.equal(drawAlpha.at(-1),1);
render.camera.x++;render.drawExplorationSolids(solids,wall,false);assert.equal(allocations,1,'Camera pans reuse geometry lighting');
render.battlefieldRotation=(render.battlefieldRotation+1)%6;render.drawExplorationSolids(solids,wall,false);assert.equal(allocations,2,'Azimuth changes rebuild projected faces');
console.log('PASS solid door front/back/end/top geometry, stable hinges, vertical height at six azimuths, unseen wall opacity and bounded render caching');

const names=['E','NE','NW','W','SW','SE'],frames=Object.fromEntries(names.map(name=>[name,{image:{complete:true,naturalWidth:10,naturalHeight:10},assetId:name}]));
Object.assign(state,{HEX_DIRS:names.map(name=>({name})),facingDirectionIndex:u=>u.facingHex,unitPoseDefinition:()=>({directionalSprites:{stand:frames},defaultPose:'stand'}),activeUnitPoseName:()=> 'stand'});
vm.runInContext(extract('directionalUnitPoseFrame'),state);
for(let azimuth=0;azimuth<6;azimuth++)for(let facing=0;facing<6;facing++){
 state.battlefieldRotation=azimuth;const unit={facingHex:facing};assert.equal(state.directionalUnitPoseFrame(unit).facing,names[(facing-azimuth+6)%6]);assert.equal(unit.facingHex,facing);
}
console.log('PASS all 36 view-relative sprite facings without mutating tactical facing');

const {tileDistanceVisibility,distanceDarkness}=await import('../js/distance-visibility.mjs');
const {ambientLightAt,paintAmbientLight}=await import('../js/exploration-environment.mjs');
assert.equal(tileDistanceVisibility(6),1);assert.equal(tileDistanceVisibility(7),.9);assert.equal(tileDistanceVisibility(8),.8);
for(let distance=0;distance<100;distance++){
 assert(tileDistanceVisibility(distance)>=.2);assert.equal(tileDistanceVisibility(distance,100),1);
 assert(Math.abs(tileDistanceVisibility(distance,10)-Math.min(1,1-Math.max(0,distanceDarkness(distance)-.1)))<1e-10);
}
assert.equal(tileDistanceVisibility(30,0,1),1);assert.equal(tileDistanceVisibility(30),.2);
const lightingMap=blankEdgeMap('ambient-test','Ambient test');assert.equal(ambientLightAt(lightingMap,3,3),0);
paintCell(lightingMap,3,3,'outdoor');assert.equal(ambientLightAt(lightingMap,3,3),100);
paintAmbientLight(lightingMap,3,3,40);assert.equal(ambientLightAt(lightingMap,3,3),40);
const exported=parsePack(JSON.stringify(seedPack(lightingMap))).maps[0];assert.equal(ambientLightAt(exported,3,3),40);
resizeMap(exported,20,18);assert.equal(ambientLightAt(exported,3,3),40);assert.equal(ambientLightAt(exported,19,17),0);
paintCell(exported,3,3,'ambient-default');assert.equal(ambientLightAt(exported,3,3),100);
assert.throws(()=>paintAmbientLight(exported,3,3,101));assert.throws(()=>parsePack(JSON.stringify(seedPack({...lightingMap,ambientLight:[[200]]}))));
// Exercise the production layer: active actor, ambient overrides and wall-blocked lights.
const painted=[];let actor={x:0,y:0,alive:true},ambient=0,blocked=false;
const fade={game:{player:actor,condition:'open'},activeUnit:()=>actor,explorationTerrain:{cellAt:(x,y)=>({x,z:y})},explorationEncounter:{map:lightingMap},explorationEncounterApi:{tileDistanceVisibility,DISTANCE_VISIBILITY:{startHex:7},ambientLightAt:()=>ambient},
 ctx:{save(){},restore(){},fill(){painted.push(this.fillStyle);}},hexDistance:(a,b)=>Math.abs(a.x-b.x),illuminationSources:()=>[{x:10,y:0}],illuminationContributionFromSource:()=>blocked?0:.3,tracePolygonOnContext:()=>true,hexScreenVertices:()=>[]};
vm.createContext(fade);const start=hooks.indexOf('function drawDistanceVisibilityLayer('),end=hooks.indexOf('\n}',start)+2;for(const name of ['explorationVisibilityAtHex','explorationTorchAnimation']){const a=hooks.indexOf('function '+name+'('),b=hooks.indexOf('\n}',a)+2;vm.runInContext(hooks.slice(a,b),fade);}
vm.runInContext(hooks.slice(start,end),fade);
fade.drawDistanceVisibilityLayer([{x:10,y:0}]);assert(Math.abs(Number(painted.at(-1).split(',').at(-1).slice(0,-1))-.1)<1e-10);
blocked=true;fade.drawDistanceVisibilityLayer([{x:10,y:0}]);assert.equal(painted.at(-1),'rgba(0,0,0,0.4)');
ambient=100;const count=painted.length;fade.drawDistanceVisibilityLayer([{x:90,y:0}]);assert.equal(painted.length,count);
ambient=0;actor={x:8,y:0,alive:true};fade.drawDistanceVisibilityLayer([{x:10,y:0}]);assert.equal(painted.length,count,'Distance follows the active actor');
console.log('PASS distance 7/8 thresholds, 20% minimum, bright-day override, additive ambient/torch relief, active actor and ambient paint/export/resize/reset');

const {torchPlacement,torchAnimation}=await import('../js/exploration-scene-style.mjs');
const {paintEdge}=await import('../js/exploration-edges.mjs');
for(const [axis,x,z,dx,dz] of [['h',4,4,0,-1],['v',5,4,1,0],['h',4,5,0,1],['v',4,4,-1,0]]){
 const room=blankEdgeMap('sconce','Sconce');paintEdge(room,{axis,x,z},'wall');const mount=torchPlacement(room,{x:4,z:4});
 assert(mount.attached);assert.equal(mount.dx,dx);assert.equal(mount.dz,dz);assert.equal(mount.x,12+dx*1.25);assert.equal(mount.z,12+dz*1.25);assert.equal(mount.wallX,12+dx*1.5);assert.equal(mount.wallZ,12+dz*1.5);assert.equal(mount.y,SCENE_STYLE.torch.height);
}
assert(!torchPlacement(blankEdgeMap('open','Open'),{x:4,z:4}).attached);
for(let t=0;t<5000;t+=17){const a=torchAnimation(t,42);assert(a.intensity>=.85-1e-9&&a.intensity<=1.15+1e-9);assert(Math.abs(a.swayX)<=.035);assert(Math.abs(a.swayZ)<=.025);assert(a.height>=.88-1e-9&&a.height<=1.12+1e-9);}
assert.deepEqual(torchAnimation(234,42),torchAnimation(234,42));assert.notDeepEqual(torchAnimation(234,42),torchAnimation(234,99));assert.deepEqual(torchAnimation(234,42,true),{intensity:1,height:1,width:1,swayX:0,swayZ:0});
Object.assign(render,{game:{player:{x:-20,y:0,alive:true}},hexDistance:(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs(a.x+a.y-b.x-b.y)),illuminationSources:()=>[],illuminationContributionFromSource:()=>0});
render.explorationEncounterApi={...render.explorationEncounterApi,tileDistanceVisibility,DISTANCE_VISIBILITY:{startHex:7},ambientLightAt:()=>0};render.explorationTerrain={...terrain,cellAt:(x,y)=>({x,z:y})};
facePaints.length=0;render.drawExplorationSolids(solids,wall,true);assert(facePaints.some(s=>s==='rgba(0,0,0,0.8)'),'Wall faces receive the same capped distance darkness as floors');const warmAllocations=allocations;render.drawExplorationSolids(solids,wall,true);assert.equal(allocations,warmAllocations,'Wall fading reuses its presentation buffer and static material bake');
render.explorationEncounterApi.ambientLightAt=()=>100;facePaints.length=0;render.drawExplorationSolids(solids,wall,true);assert(!facePaints.some(s=>s.startsWith('rgba(0,0,0,')),'Bright ambient cancels wall distance fading without rebuilding base material lighting');
render.explorationTerrain.torches=[{}];render.matchMedia=()=>({matches:true});assert(!render.hasAnimatedExplorationTorches());render.matchMedia=()=>({matches:false});assert(render.hasAnimatedExplorationTorches());
console.log('PASS four wall-sconce mounts, shared bounded/seeded flicker and sway, reduced motion, wall distance fading and bright-day cancellation');
