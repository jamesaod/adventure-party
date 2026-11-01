import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {encounterAt,validateEncounters,terrainForEncounter,recordOutcome,readProgress,progressKey,torchPlacement,SCENE_STYLE} from '../js/exploration-encounters.mjs';
const map=JSON.parse(readFileSync(new URL('../data/exploration/old-tollhouse.json',import.meta.url)));
const initial={encounters:{},player:null},event=map.encounters[0];
assert.deepEqual(validateEncounters(map),[]);
assert.equal(encounterAt(map,{x:3,z:8},initial),undefined);
assert.equal(encounterAt(map,{x:3,z:6},initial),event);
const player={hp:12,maxHp:20,inventory:{arrows:7}},enemies=[{hp:3,level:2,equipment:{weapon:'spear'}}];
const retreat=recordOutcome(initial,event.id,'retreat',player,enemies);
assert.equal(encounterAt(map,{x:3,z:6},retreat),event);
assert.deepEqual(initial,{encounters:{},player:null});
const storage=new Map();storage.setItem=(k,v)=>storage.set(k,v);storage.getItem=k=>storage.get(k);
storage.setItem(progressKey('qa'),JSON.stringify(retreat));
assert.deepEqual(readProgress(storage,'qa').encounters[event.id].enemies,enemies);
assert.equal(readProgress(storage,'qa').player.inventory.arrows,7);
const victory=recordOutcome(retreat,event.id,'victory',player,[]);
assert.equal(encounterAt(map,{x:3,z:6},victory),undefined);
const closed=terrainForEncounter(map,{x:3,z:6},new Set());
const opened=terrainForEncounter(map,{x:3,z:6},new Set(['3,7','3,9']));
assert.equal(closed.walls.filter(w=>w.id==='door-3-7').length,1);
assert.equal(opened.walls.filter(w=>w.id==='door-3-7').length,0);
assert.equal(opened.project(4,6).x-opened.project(3,6).x,128);
assert.equal(opened.walkableHex(0,0),true);
assert.equal(opened.walkableHex(30,30),false);
assert.ok(opened.spaces.every(s=>s.environment==='indoor'));
assert.ok(opened.walls.every(w=>w.blocksMovement&&w.blocksLOS));
const bad=structuredClone(map);bad.encounters[0].count=7;assert.ok(validateEncounters(bad).length);
bad.encounters[0].count=2;bad.encounters[0].spawnX=0;assert.ok(validateEncounters(bad).length);
console.log('PASS exploration encounter regions, persistence, victory suppression, physical terrain scale and doors');
import vm from 'node:vm';
const hook=readFileSync(new URL('../js/exploration-combat-hooks.js',import.meta.url),'utf8');
const sandbox={location:{search:''},URLSearchParams,structuredClone,Image:class{},window:{},explorationEncounter:{event:{mobId:'orc',count:1,spawnX:1,spawnZ:0},position:{x:0,z:0}},explorationTerrain:{project:(x,y)=>({x:x*64,y:y*32})},HEX_W:64,MAP_MIN_X:0,MAP_MAX_X:2,MAP_MIN_Y:0,MAP_MAX_Y:0,
makeFighter:()=>({id:'player',hp:30,alive:true}),makeLibraryMob:()=>({hp:8,alive:true}),isWall:()=>false,key:(x,y)=>`${x},${y}`,inside:(x,y)=>x>=0&&x<=2&&y===0,worldPointForHex:(x,y)=>({x:x*64,y:y*32}),occupiedHexesAt:(u,x,y)=>[{x,y}],occupiedHexes:u=>[{x:u.x,y:u.y}],architecturalWallBlocksStep:()=>false};
const engine=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const facingStart=engine.indexOf('function hexDirectionIndexToward('),facingEnd=engine.indexOf('\n}',facingStart)+2;
sandbox.HEX_DIRS=[{x:1,y:0},{x:1,y:-1},{x:0,y:-1},{x:-1,y:0},{x:-1,y:1},{x:0,y:1}];sandbox.hexDistance=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs(a.x+a.y-b.x-b.y));
vm.createContext(sandbox);vm.runInContext(engine.slice(facingStart,facingEnd),sandbox);vm.runInContext(hook,sandbox);
const roster=sandbox.explorationUnits();assert.equal(roster.player.id,'player','Engine initiative resolves its controlled character by stable player ID');assert.equal(roster.player.controller,'player');assert.equal(roster.enemies.length,1);assert.notEqual(roster.enemies[0].x,roster.player.x);
assert.equal(roster.enemies[0].facingHex,sandbox.hexDirectionIndexToward(roster.enemies[0],roster.player));assert.equal(roster.enemies[0].facing,'left');
console.log('PASS encounter deployment preserves production player identity and non-overlapping opponents');
sandbox.explorationTerrain.scale=2;
sandbox.explorationEncounter.previous={enemies:[{hp:7,alive:true,x:1,y:0}]};
const migrated=sandbox.explorationUnits();assert.equal(migrated.enemies[0].x,2);assert.equal(migrated.enemies[0].hp,7,'Scale migration must retain enemy state');
sandbox.explorationEncounter.previous.terrainScale=2;
assert.equal(sandbox.explorationUnits().enemies[0].x,1,'Current-scale snapshots must not be scaled again');
console.log('PASS legacy encounter positions migrate from 1:1 to 1:2 without resetting survivors');

sandbox.explorationEncounter={map,origin:{x:3,z:6},openDoors:['3,7','3,9']};
Object.assign(sandbox,{explorationEncounterApi:{terrainForEncounter,torchPlacement,SCENE_STYLE},HEX_ROW:31.5,MAP_MIN_X:-20,MAP_MAX_X:19,MAP_MIN_Y:-16,MAP_MAX_Y:15,
  walls:new Set(),rebuildArchitecturalBlockedHexes(){},worldPointForHex:(x,y)=>({x:x*64+y*32,y:y*31.5})});
sandbox.isWall=(x,y)=>sandbox.walls.has(`${x},${y}`);
sandbox.configureExplorationTerrain();
assert(sandbox.explorationTerrain.torches.length>0);
for(const torch of sandbox.explorationTerrain.torches){assert.equal(sandbox.isWall(torch.x,torch.y),false);assert.equal(torch.sourceKind,'torch');assert.equal(torch.radiusHexes,3);}
assert(sandbox.explorationTerrain.torches.length<map.torches.length,'Exclude torches beyond the bounded encounter');
console.log('PASS map torches project onto valid encounter floor and remain crop bounded');

// Fresh encounter facing is chosen before checking a rotating two-hex footprint.
for(const dir of sandbox.HEX_DIRS){
 const spawn={x:dir.x*3,z:dir.y*3},checks=[];
 const env={...sandbox,MAP_MIN_X:-6,MAP_MAX_X:6,MAP_MIN_Y:-6,MAP_MAX_Y:6,explorationEncounter:{event:{mobId:'orc',count:1,spawnX:spawn.x,spawnZ:spawn.z},position:{x:0,z:0}},
 explorationTerrain:{scale:2,project:(x,y)=>({x:x*64+y*32,y:y*31.5})},inside:(x,y)=>x>=-6&&x<=6&&y>=-6&&y<=6,isWall:()=>false,makeLibraryMob:()=>({alive:true,facingHex:0}),
 occupiedHexesAt:(u,x,y,facing=u.facingHex||0)=>{if(u.id!=='player')checks.push({x,y,facing});return u.id==='player'?[{x,y}]:[{x,y},{x:x+sandbox.HEX_DIRS[facing].x,y:y+sandbox.HEX_DIRS[facing].y}];}};
 env.occupiedHexes=u=>env.occupiedHexesAt(u,u.x,u.y,u.facingHex||0);vm.createContext(env);vm.runInContext(hook,env);
 const deployed=env.explorationUnits(),enemy=deployed.enemies[0],wanted=sandbox.hexDirectionIndexToward(enemy,deployed.player);assert.equal(enemy.facingHex,wanted);assert(checks.some(c=>c.x===enemy.x&&c.y===enemy.y&&c.facing===wanted));
 const footprint=env.occupiedHexes(enemy);assert(footprint.every(c=>env.inside(c.x,c.y)&&!(c.x===deployed.player.x&&c.y===deployed.player.y)));
 env.explorationEncounter.previous={terrainScale:2,enemies:[{...enemy,facingHex:(wanted+1)%6}]};const resumed=env.explorationUnits();assert.equal(resumed.enemies[0].facingHex,(wanted+1)%6,'Resuming preserves the saved tactical facing');
}
console.log('PASS all six initial MOB facings, final-orientation footprint checks and saved encounter facing');
