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
const target=new Proxy({},{get:()=>()=>{},set:()=>true});
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
