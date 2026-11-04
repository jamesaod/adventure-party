import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
function fn(name){const a=source.indexOf(`function ${name}(`),b=source.indexOf('\n}',a)+2;assert(a>=0&&b>a);return source.slice(source.slice(a-6,a)==='async '?a-6:a,b);}
const mover={id:'m',name:'Mover',x:1,y:0,alive:true,faction:'player'},enemy={id:'a',name:'Enemy',x:0,y:0,alive:true,faction:'enemy'};
let roster=[mover,enemy],strikes=[],kill=false;
const c={game:{over:false},freeStrikeInProgress:false,allUnits:()=>roster,
 occupiedHexesAt:(u,x,y)=>(u.offsets||[{x:0,y:0}]).map(p=>({x:x+p.x,y:y+p.y})),
 unitFootprintDefinition:u=>({rotates:!!u.rotates}),hexDirectionIndexToward:()=>2,
 architecturalWallBlocksStep:()=>false,unitHasRangedWeaponInHand:u=>!!u.ranged,getUnitEffect:(u,id)=>u.effects?.[id],
 log(){},unitActionWeapon:()=> 'Sword',attack:async(a,m)=>{assert.equal(m.x,1,'Reactions resolve before moving');strikes.push(a.id);if(kill)m.alive=false;return {hit:true,killed:kill};},
 updateUi(){},draw(){},refreshTurnBanner(){},waitForCombatActionPause:async()=>{},sleep:async()=>{}};
vm.createContext(c);vm.runInContext(['hexDistance','unitDistance','canMeleeReach','unitCanMakeLeavingHexFreeAttack','movementLeavesMeleeReach','leavingHexFreeAttackers','performLeavingHexFreeAttacks'].map(fn).join('\n'),c);
const ids=to=>Array.from(c.leavingHexFreeAttackers(mover,to),u=>u.id);
assert.deepEqual(ids({x:1,y:-1}),[],'Circling the same adjacent enemy is safe');
assert.deepEqual(ids({x:2,y:0}),['a'],'Leaving adjacency triggers a reaction');
assert.deepEqual(ids({x:1,y:0}),[]);assert.deepEqual(ids(null),[],'Non-movement actions cannot trigger the leave reaction');
mover.x=2;assert.deepEqual(ids({x:1,y:0}),[],'Entering reach does not trigger a reaction');
enemy.meleeRange=2;assert.deepEqual(ids({x:1,y:1}),[],'Remaining in extended melee reach is safe');assert.deepEqual(ids({x:3,y:0}),['a']);delete enemy.meleeRange;mover.x=1;
const other={...enemy,id:'b',x:2};roster=[mover,enemy,other];assert.deepEqual(ids({x:0,y:1}),['b'],'Evaluate leaving range separately for each enemy');
roster=[mover,enemy];enemy.ranged=true;assert.deepEqual(ids({x:2,y:0}),[]);delete enemy.ranged;enemy.effects={sleep:{}};assert.deepEqual(ids({x:2,y:0}),[]);enemy.effects={};
assert.equal(await c.performLeavingHexFreeAttacks(mover,{x:1,y:-1}),true);assert.deepEqual(strikes,[]);
assert.equal(await c.performLeavingHexFreeAttacks(mover,{x:2,y:0}),true);assert.deepEqual(strikes,['a']);
strikes=[];kill=true;assert.equal(await c.performLeavingHexFreeAttacks(mover,{x:2,y:0}),false,'A lethal reaction cancels the pending movement');assert.deepEqual(strikes,['a']);mover.alive=true;kill=false;
// A footprint still touching the enemy remains in range even if its anchor leaves.
mover.offsets=[{x:0,y:0},{x:-1,y:0}];assert.deepEqual(ids({x:2,y:0}),[]);delete mover.offsets;
assert.deepEqual(ids({x:2,y:0,escape:true}),['a'],'Leaving the battlefield can still provoke a reaction');
console.log('PASS opportunity attacks only on leaving each enemy melee reach; adjacent circling, entry, reach weapons, footprints, non-movement, incapacitation and lethal movement cancellation');
