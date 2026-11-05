import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readCombatFixture as readFileSync} from './combat-test-source.mjs';
const text=readFileSync(new URL('../js/combat-environment-actions.js',import.meta.url),'utf8');
const start=text.indexOf('function combatWallScorch('),end=text.indexOf('function resolveFireballEnvironment(',start);
const walls=[{id:'one',a:{x:0,y:0},b:{x:128,y:0}},{id:'two',a:{x:128,y:0},b:{x:256,y:0}},{id:'three',a:{x:256,y:0},b:{x:384,y:0}},{id:'corner',a:{x:256,y:0},b:{x:256,y:128}}];
const state={wallScorch:{'one:a':[{x:0,y:0,endX:128,endY:0,radius:28.8}],'two:a':[{x:128,y:0,endX:256,endY:0,radius:28.8}]}};
const context=vm.createContext({architecturalWalls:walls,game:{environmentState:state},environmentSquash:()=>1});
vm.runInContext(text.slice(start,end),context);
for(const wall of walls.slice(0,2)){
 const marks=context.combatWallScorch(wall,{side:'a'});
 assert.equal(marks.length,1,'Adjacent burns merge into one continuous span, without restarting at the shared editor boundary');
 assert.equal(marks[0].x,0);assert.equal(marks[0].endX,256);
 assert.equal(context.combatWallScorch(wall,{side:'b'}).length,0,'Opposite face stays clean');
}
assert.equal(context.combatWallScorch(walls[2],{side:'a'}).length,0,'Do not extend scorch into the unburned adjoining section');
assert.equal(context.combatWallScorch(walls[3],{side:'a'}).length,0,'Do not carry soot around an unimpacted corner');
assert.equal(context.combatWallScorch(walls[0],{side:'top',cap:true}).length,0);
const reversed={id:'reversed',a:{x:256,y:0},b:{x:128,y:0}};
assert.equal(context.combatWallScorch(reversed,{side:'b'}).length,1,'Wall direction does not reverse the impacted physical side');
state.wallScorch['two:a'][0].x=160;
assert.equal(context.combatWallScorch(walls[0],{side:'a'}).length,1,'The first span remains local when a real unburned gap exists');
assert.equal(context.combatWallScorch({a:{x:0,y:0},b:{x:256,y:0}},{side:'a'}).length,2,'A real gap is preserved instead of merging disconnected burns');
console.log('PASS continuous coplanar scorch, outer-edge fade, real gaps, reversed walls and clean opposite/corner/cap faces');

// Reproduce the overshoot: one affected hex beside long and split wall sections.
const engine=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const extract=name=>{const start=engine.indexOf('function '+name+'(');return engine.slice(start,engine.indexOf('\nfunction ',start+1));};
const ctx=vm.createContext({game:{environmentState:{wallScorch:{}}},combatSceneTerrain:{},HEX_W:64,HEX_H:42,environmentSquash:()=>1,architecturalWalls:[{id:'left',a:{x:-128,y:0},b:{x:0,y:0}},{id:'right',a:{x:0,y:0},b:{x:128,y:0}},{id:'remote',a:{x:192,y:0},b:{x:320,y:0}}],worldPointForHex:(x,y)=>({x:64*(x+y*.5),y:y*31.5}),environmentRayHit:()=>null});
ctx.combatEnvironment=()=>ctx.game.environmentState;
vm.runInContext(extract('architecturalHexCoreVertices'),ctx);
vm.runInContext(text.slice(text.indexOf('function clipScorchWallToPolygon('),text.indexOf('function resolveFireballEnvironment(')),ctx);
ctx.scorchCombatWalls({x:0,y:1},[{x:0,y:0}]);
const marks=ctx.game.environmentState.wallScorch;
assert.equal(Object.keys(marks).length,2,'A remote wall is not scorched by a padded-neighbour test');
assert.equal(marks['left:a'][0].x,-32);assert.equal(marks['left:a'][0].endX,0);
assert.equal(marks['right:a'][0].x,0);assert.equal(marks['right:a'][0].endX,32,'Only the actual hex intersection is marked, not the whole 128px section');
const continuous=ctx.combatWallScorch(ctx.architecturalWalls[0],{side:'a'});
assert.equal(continuous.length,1);assert.equal(continuous[0].x,-32);assert.equal(continuous[0].endX,32);
ctx.scorchCombatWalls({x:0,y:1},[{x:1,y:0}]);
assert.equal(ctx.combatWallScorch(ctx.architecturalWalls[1],{side:'a'})[0].endX,96,'Repeated casts union real affected spans without expanding their ends');
ctx.game.environmentState={wallScorch:{}};ctx.environmentRayHit=()=>({wallId:'occluder'});
ctx.scorchCombatWalls({x:0,y:1},[{x:0,y:0}]);assert.equal(Object.keys(ctx.game.environmentState.wallScorch).length,0,'Another wall shields the surface');
console.log('PASS exact Fireball-hex wall clipping, partial sections, adjacent seams, remote walls, accumulated casts and occlusion');
