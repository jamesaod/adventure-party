import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {boulderRange,boulderScatter,boulderSaveDamage,boulderRollCells} from '../js/combat-boulder-rules.mjs';
const dirs=[{x:1,y:0},{x:1,y:-1},{x:0,y:-1},{x:-1,y:0},{x:-1,y:1},{x:0,y:1}];
for(const [distance,penalty]of [[1,0],[3,0],[4,-2],[6,-2],[7,-5],[10,-5],[11,null]])assert.equal(boulderRange(distance).penalty,penalty);
assert.equal(boulderSaveDamage(15,false),7);assert.equal(boulderSaveDamage(15,true),0);
for(let i=0;i<6;i++)assert.deepEqual(boulderScatter({x:0,y:0},dirs,()=>true,()=>i/6),dirs[i]);
assert.deepEqual(boulderRollCells({x:0,y:0},{x:3,y:0},dirs),[{x:4,y:0},{x:5,y:0}]);
const source=readFileSync(new URL('../js/combat-boulders.js',import.meta.url),'utf8');
const actor={id:'giant',repositoryMobId:'hill-giant',treeHauler:{stage:'seek'},alive:true},rock={id:'rock',x:1,y:0,state:'ground'};
let picked=0,ends=0;
const c={console,game:{active:actor.id,boulders:[rock],testTrees:[{x:5,y:0}]},hexDistance:(a,b)=>Math.abs((a.x||0)-b.x)+Math.abs((a.y||0)-b.y),treeFallFor:()=>null,searchRotatingFootprintPath:()=>({value:true,path:[]}),setUnitActionBanner(){},animateMobAlongPath:async()=>{},treeHaulerCurrent:()=>true,endTurn(){ends++;}};
vm.createContext(c);vm.runInContext(source,c);c.boulderPickup=async()=>{picked++;};
await c.giantBoulderTurn(actor);assert.equal(picked,1);assert.equal(ends,1);assert.equal(rock.reservedBy,undefined);
c.game.testTrees=[{x:0,y:0}];assert.equal(await c.giantBoulderTurn(actor),false);assert.equal(picked,1,'Closer tree keeps the tree objective');
const victim={id:'v',alive:true,hp:20,name:'Victim'};
Object.assign(c,{combatBoulderRules:{boulderSaveDamage},d:()=>1,breathSaveTargetForUnit:()=>10,log(){},window:{},onUnitDamaged(){},flashAttack(){},updateUi(){}});
// lexical owner rules are populated by prepare in production; configure explicitly in fixture.
vm.runInContext('combatBoulderRules={boulderSaveDamage:(n,s)=>s?0:Math.floor(n/2)}',c);
c.damageByBoulder(actor,victim,15,true);assert.equal(victim.hp,13);
c.d=()=>20;c.damageByBoulder(actor,victim,15,true);assert.equal(victim.hp,13);
console.log('PASS boulder bands, adjacent scatter, two-hex continuation, half damage/breath avoidance, closest resource and reservation release');

// Resolve complete production throw actions with deterministic dice and obstacles.
const target={id:'target',name:'Target',x:3,y:0,hp:100,alive:true},unit={...actor,x:0,y:0,name:'Giant',thaco:10,stats:{dex:10},treeActionDurations:{Boulder_Throw:1}};
Object.assign(c,{HEX_W:64,performance:{now:()=>100},combatEffectDuration:n=>n,unitDistance:(a,b)=>Math.abs(a.x-b.x),dexterityAdjustments:()=>({missile:0}),attackEffectModifier:()=>0,effectiveArmorClassForAttack:()=>5,HEX_DIRS:dirs,inside:()=>true,isWall:()=>false,faceEntityToward(){},breakInvisibility(){},presentCombatFrame:async()=>{},worldPointForHex:(x,y)=>({x,y}),architecturalWallBlocksWorldLine:()=>false,combatReachableMovement:{},allUnits:()=>[unit,target],occupiedHexes:u=>[u],combatGpu:{stampBoulderGround(){}},isFirBlockedHex:()=>false});
vm.runInContext('combatBoulderRules={boulderRange:(d)=>({band:"SHORT",penalty:0}),boulderSaveDamage:(n,s)=>s?0:Math.floor(n/2),boulderScatter:t=>({x:t.x,y:t.y+1}),boulderRollCells:(o,t)=>[{x:t.x+1,y:t.y},{x:t.x+2,y:t.y}]}',c);
c.boulderFrames=async(_session,_seconds,fn)=>{fn(0);fn(1);return true;};
let dice=20;c.d=n=>n===20?dice:4;
const makeRock=()=>({id:'r',state:'held',x:0,y:0,spin:0});
let r=makeRock();unit.carriedBoulder=r;await c.throwCombatBoulder(unit,target,r,c.game);assert.equal(target.hp,92);assert.equal(r.x,3,'Direct unit hit stops at impact');assert.equal(r.state,'ground');
dice=1;r=makeRock();unit.carriedBoulder=r;await c.throwCombatBoulder(unit,target,r,c.game);assert.equal(r.x,5);assert.equal(r.y,1,'Miss lands adjacent, then rolls two cells');
const blocker={id:'blocker',name:'Blocker',x:4,y:1,hp:100,alive:true};c.allUnits=()=>[unit,target,blocker];r=makeRock();unit.carriedBoulder=r;await c.throwCombatBoulder(unit,target,r,c.game);assert.equal(blocker.hp,96);assert.equal(r.x,4,'Rolling contact stops at first unit');
c.allUnits=()=>[unit,target];c.architecturalWallBlocksWorldLine=(_a,b)=>b.x===4;r=makeRock();unit.carriedBoulder=r;await c.throwCombatBoulder(unit,target,r,c.game);assert.equal(r.x,3,'Wall stops rolling before crossing');
c.architecturalWallBlocksWorldLine=()=>false;c.isFirBlockedHex=(x,y)=>x===4&&y===1;r=makeRock();unit.carriedBoulder=r;await c.throwCombatBoulder(unit,target,r,c.game);assert.equal(r.x,3,'Tree stops rolling before entry');
console.log('PASS production throw: direct hit, adjacent miss, two-cell roll, half-damage unit contact, wall/tree stops');

