import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const draw=source.slice(source.indexOf('function draw(){'),source.indexOf('\nfunction flashAttack('));
for(const exploration of [true,false]){
  const calls=[],sun={drawingGround:false};
  const record=name=>()=>calls.push(name);
  const context={game:{player:{alive:true},enemies:[{alive:true,species:'orc'}],allies:[],areaEffects:[]},explorationTerrain:exploration,adventurePartySun:sun,
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
