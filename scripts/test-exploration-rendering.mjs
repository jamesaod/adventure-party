import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const draw=source.slice(source.indexOf('function draw(){'),source.indexOf('\nfunction flashAttack('));
for(const exploration of [true,false]){
  const calls=[],sun={drawingGround:false};
  const record=name=>()=>calls.push(name);
  const context={game:{player:{alive:true},enemies:[{alive:true,species:'orc'}],allies:[],areaEffects:[]},explorationTerrain:exploration,explorationVisibleWallBoundaries:()=>[],adventurePartySun:sun,
    ctx:new Proxy({},{get:()=>()=>{},set:()=>true}),canvas:{width:100,height:100},battlefieldZoom:1,BATTLEFIELD_RENDER_DENSITY:1,architecturalWalls:[],
    visibleHexes:()=>[],battlefieldZoomAnchor:()=>({x:0,y:0}),visibleTreeDecorations:()=>[],activeCombatTerrainTileSet:()=>({}),unitDepthSortPoint:()=>({x:0,y:0}),
    shouldRenderUnitUnderPartyVisibility:()=>true,unitPoseDefinition:()=>({spriteLayout:{}}),performance:{now:()=>0},
    drawFighter:()=>calls.push(sun.drawingGround?'player shadow':'player'),drawStudioSpriteMob:()=>calls.push(sun.drawingGround?'orc shadow':'orc')};
  for(const name of [...draw.matchAll(/\b((?:draw|ensure|clip)[A-Z]\w*)\(/g)].map(m=>m[1]))context[name]??=record(name);
  vm.runInNewContext(draw+'\ndraw();',context);
  assert.equal(calls.filter(x=>x==='orc').length,1);
  assert.equal(calls.filter(x=>x==='orc shadow').length,1);
  assert.equal(calls.filter(x=>x==='drawWallTestLineOfSightMask').length,1);
  if(exploration){
    assert(calls.indexOf('drawWallTestLineOfSightMask')<calls.indexOf('orc'));
    assert(!calls.includes('drawVisibleArchitecturalWallsOverLOS'));
    assert(calls.includes('drawExplorationDarknessVolumes'));
    assert(calls.indexOf('clipExplorationFloor')<calls.indexOf('drawWallTestLineOfSightMask'));
  }else{
    assert(calls.indexOf('drawWallTestLineOfSightMask')>calls.indexOf('orc'));
    assert(calls.includes('drawVisibleArchitecturalWallsOverLOS'));
    assert(!calls.includes('clipExplorationFloor'));
  }
}
console.log('PASS exploration floor masking precedes single unit pass; ordinary combat keeps existing LOS repaint');

const hooks=readFileSync(new URL('../js/exploration-combat-hooks.js',import.meta.url),'utf8');
const paths=[],reductions=[],fills=[];
const maskContext={clearRect(){},fillRect(){fills.push(this.fillStyle);},fill(){}};
const context={Image:class{},document:{createElement:()=>({width:0,height:0,getContext(){return {...maskContext,drawImage:(_image,_x,_y,w,h)=>reductions.push([w,h])};}})},
  friendlyVisibilityObservers:()=>[{x:0,y:0}],observerVisibilityContext:()=>({polygon:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}]}),
  screenPointForWorld:(p,elevation=0)=>{assert.equal(elevation,0,'Polygon indices must not become vertex heights');return p;},tracePolygonOnContext:(_ctx,p)=>{paths.push(p);return true;},hasActiveObscuringLosVolume:()=>false,
  visibleHexes:()=>{throw Error('Architectural floor visibility must not use hex centers');},BATTLEFIELD_LOGICAL_WIDTH:100,BATTLEFIELD_LOGICAL_HEIGHT:100,ctx:{drawImage(){}}};
vm.createContext(context);vm.runInContext(hooks.slice(0,hooks.indexOf('function configureExplorationTerrain()')),context);
context.drawExplorationVisibilityMask();assert.equal(paths.length,1);assert.equal(paths[0][1].x,100);assert.equal(fills[0],'#08080c','Unseen floor must be opaque');
const image={complete:true,naturalWidth:1024,naturalHeight:1024};
const tile=context.explorationMaterialTile(image);assert.equal(tile.width,64);assert.deepEqual(reductions,[[512,512],[256,256],[128,128],[64,64]]);
assert.equal(context.explorationMaterialTile(image),tile);assert.equal(reductions.length,4,'Reuse filtered texture rather than rebuilding it per frame');
const shadows=source.slice(source.indexOf('function drawArchitecturalWallShadows(){'),source.indexOf('\nfunction closestPointOnWorldSegment('));
vm.runInNewContext(shadows+'\ndrawArchitecturalWallShadows();',{explorationTerrain:{},architecturalWalls:[{}]});
console.log('PASS wall-edge mask uses room LOS polygons, cached texture prefilter and no indoor test-sun shadows');

const waitCode=source.slice(source.indexOf('async function waitForCombatUnitRenders('),source.indexOf('\nfunction combatRenderingPanel('));
const waitContext={};vm.createContext(waitContext);vm.runInContext(waitCode,waitContext);
let playerReady,enemyReady,finished=false;
const player={appearanceRefreshPromise:new Promise(r=>{playerReady=r;})},enemy={appearanceRefreshPromise:new Promise(r=>{enemyReady=r;})};
const waiting=waitContext.waitForCombatUnitRenders([player,enemy]).then(()=>{finished=true;});
playerReady({applied:true});await new Promise(r=>setImmediate(r));assert.equal(finished,false,'A rendered player must not reveal fallback enemies');
enemyReady({applied:true});await waiting;assert.equal(finished,true);
await assert.rejects(waitContext.waitForCombatUnitRenders([{name:'Orc',appearanceRefreshPromise:Promise.resolve(null)}]),/Could not render Orc/);
let superseded;const changing={appearanceRefreshPromise:new Promise(r=>{superseded=r;})};
const changed=waitContext.waitForCombatUnitRenders([changing]);changing.appearanceRefreshPromise=Promise.resolve({applied:true});superseded(null);await changed;
console.log('PASS all-unit rendering gate waits for enemies, follows superseding renders and reports failure');

const {explorationDoor,CELL,HEIGHT}=await import('../js/exploration-materials.mjs');
const {combatSceneryEntries}=await import('../js/exploration-combat-scenery.mjs');
const {terrainForEncounter}=await import('../js/exploration-encounters.mjs');
const map=JSON.parse(readFileSync(new URL('../data/exploration/old-tollhouse.json',import.meta.url)));
const terrain=terrainForEncounter(map,{x:3,z:6},new Set(['3,7']));
const scenery=combatSceneryEntries(map,terrain,new Set(['3,7']));
assert(scenery.some(e=>e.kind==='wall'));assert(scenery.some(e=>e.kind==='door'&&e.open));assert(scenery.some(e=>e.kind==='door'&&!e.open));
for(const entry of scenery.filter(e=>e.kind==='wall'))assert(entry.wallIds.some(id=>terrain.walls.some(w=>w.id===id)));
const closedDoor=explorationDoor(undefined,undefined),openDoor=explorationDoor(undefined,undefined,true);
assert.equal(CELL,3);assert.equal(HEIGHT,3.5);assert.equal(closedDoor.hinge.rotation.y,0);assert.equal(openDoor.hinge.rotation.y,-Math.PI/2);
assert.equal(closedDoor.root.children.length,4);assert.equal(closedDoor.hinge.children.length,1);
assert.equal(closedDoor.hinge.children[0].geometry.parameters.width,2.5);
assert(terrain.walls.every(w=>w.height===35&&w.thickness===3));
assert(!hooks.includes('createCombatScenery('),'Combat must use compact walls instead of full-height scenery');
console.log('PASS compact combat wall dimensions and shared exploration door geometry');

const lightCalls=[];
Object.assign(context,{illuminationSources:()=>[{x:1,y:2,radiusHexes:3}],wallTestVisibilityPolygonWorld:(source,mode)=>{assert.equal(mode,'light');return [{x:0,y:0},{x:10,y:0},{x:0,y:10}];},hexCenter:()=>({x:64,y:63}),HEX_W:64,HEX_ROW:31.5,
ctx:{save(){},restore(){},clip(){lightCalls.push('clip');},translate(){},scale(x,y){assert(y<1);},createRadialGradient(){return {addColorStop(){}};},fillRect(){lightCalls.push('fill');}}});
context.drawExplorationIlluminationLayer();assert.deepEqual(lightCalls,['clip','fill']);
console.log('PASS opaque unseen floor and projected torch falloff clipped to light-blocking walls');

const boundaryContext={};vm.runInNewContext(hooks.slice(hooks.indexOf('function explorationVisibleFloorArea(')),boundaryContext);
const room={left:0,right:10,top:0,bottom:10};
assert.equal(boundaryContext.explorationVisibleFloorArea([{x:11,y:0},{x:20,y:0},{x:20,y:10},{x:11,y:10}],room),0);
assert.equal(boundaryContext.explorationVisibleFloorArea([{x:10,y:0},{x:20,y:0},{x:20,y:10},{x:10,y:10}],room),0,'Corner/edge contact must not reveal a hidden room');
assert(boundaryContext.explorationVisibleFloorArea([{x:0,y:0},{x:5,y:0},{x:5,y:10},{x:0,y:10}],room)>0,'Partly visible floor reveals its boundary face');
Object.assign(boundaryContext,{friendlyVisibilityObservers:()=>[{}],observerVisibilityContext:()=>({polygon:[{x:0,y:0},{x:5,y:0},{x:5,y:10},{x:0,y:10}]}),architecturalWalls:[{id:'visible',borderFloor:room},{id:'hidden',borderFloor:{left:20,right:30,top:0,bottom:10}}]});
assert.deepEqual(Array.from(boundaryContext.explorationVisibleWallBoundaries(),w=>w.id),['visible']);
assert(!source.includes('drawExplorationWallCap'));
assert(terrain.walls.filter(w=>!w.id.startsWith('door-')).every(w=>w.borderFloor));
console.log('PASS visible passable floor reveals boundary walls, hidden rooms stay hidden, solid caps removed');
