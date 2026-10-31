import assert from 'node:assert/strict';
import {SCENE_STYLE as style,materialMetrics,projectSceneObject,sceneLights,surfaceLight,sceneLightVisible,torchPlacement,displayExposure} from '../js/exploration-scene-style.mjs';
import {SCENE_STYLE as materialStyle,explorationDoor} from '../js/exploration-materials.mjs';
assert.deepEqual(materialStyle,style,'Both adapters must use the same scene profile');
const one={cellW:64,cellH:36},two={cellW:128,cellH:72};
for(const terrain of [one,two]){
  const m=materialMetrics(terrain,35);assert.equal(m.wallHeight,35);assert.equal(style.materials.wallRows,6);
  assert.equal(m.floorWidth/style.materials.sourceFloorSlabs,terrain.cellW/4,'Slabs have one authored physical size');
}
for(const kind of ['door','window']){
  const a=projectSceneObject(kind,one),b=projectSceneObject(kind,two);
  assert.equal(b.width,2*a.width);assert.equal(b.height,a.height);assert.deepEqual(b.artwork,a.artwork,'Footprint expansion must not stretch door/window artwork');assert(Math.abs(b.artwork.width/b.artwork.height-style[kind].width/style[kind].height)<1e-10);assert.equal(b.sill,a.sill,'Tactical spacing must not double window sill height');
}
const prop=projectSceneObject('prop',two,{width:1,height:2,depth:.5});
assert.equal(prop.width,128/3);assert.equal(prop.height,20);assert.equal(prop.depth,12);
const door=explorationDoor(undefined,undefined);assert.equal(door.hinge.position.x,style.door.hingeX);
assert.equal(door.hinge.children[0].geometry.parameters.height,style.door.height);
assert.equal(door.hinge.children[0].geometry.parameters.width,style.door.width);
const map={grid:['#######','#.....#','#.....#','#.....#','#######'],torches:[{x:1,z:1}]};
const party={x:9,z:6},lights=sceneLights(map,party),mount=torchPlacement(map,map.torches[0]);
assert.equal(lights[0].x,mount.x);assert.equal(lights[0].y,style.torch.height);
assert.equal(lights.at(-1).kind,'lantern');assert.equal(lights.at(-1).x,party.x);
assert.equal(lights.at(-1).intensity,style.lantern.intensity);
const normal={x:0,y:1,z:0},point={x:9,y:0,z:6},ambient=surfaceLight(point,normal,[]),lit=surfaceLight(point,normal,lights);
assert(lit.every((v,i)=>v>ambient[i]),'The party lantern lights the floor in both views');
const blocked=surfaceLight(point,normal,lights,()=>false);assert.deepEqual(blocked,ambient);
const near=surfaceLight(point,normal,[{...style.lantern,x:9,z:6,y:2}]);
const far=surfaceLight(point,normal,[{...style.lantern,x:9,z:12,y:2}]);assert(near[0]>far[0]);
const beyond=surfaceLight(point,normal,[{...style.lantern,x:9,z:100,y:2}]);assert.deepEqual(beyond,ambient);
const exposure=displayExposure([.25,1,4]);assert(exposure.multiply[0]<255);assert.equal(exposure.multiply[1],255);assert.equal(exposure.boost[0],0);assert(exposure.boost[2]>0);
const doorMap={grid:['#####','#.D.#','#####']},a={x:3,y:1.9,z:3},b={x:9,y:0,z:3};
assert.equal(sceneLightVisible(doorMap,new Set(),a,b),false);assert.equal(sceneLightVisible(doorMap,new Set(['2,1']),a,b),true);
console.log('PASS shared six-course/four-slab materials, independent object axes, shared door dimensions, lantern/torch settings, light falloff and closed-door occlusion');
