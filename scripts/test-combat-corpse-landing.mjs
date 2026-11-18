import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const c=vm.createContext({});vm.runInContext(fs.readFileSync('js/corpse-landing-planner.js','utf8'),c);const {plan}=c.AdventureCorpseLanding;
const base={origin:{x:0,y:0},units:[],length:3,preferred:0};
assert.equal(plan(base).moves.length,0);
const single=plan({...base,directions:[0],units:[{id:'a',x:2,y:0}]});assert.equal(single.moves.length,1);assert.equal(single.cells.some(c=>c.x===single.moves[0].to.x&&c.y===single.moves[0].to.y),false);
const units=[2,3,4].map((x,i)=>({id:String(i),x,y:0})),corridor=c=>c.y!==0||c.x<0||c.x>5;
const chain=plan({...base,units,directions:[0],blocked:corridor});assert.equal(chain.moves.length,3);assert.equal(new Set(chain.moves.map(m=>m.to.x+','+m.to.y)).size,3);assert.equal(Math.max(...chain.moves.map(m=>m.depth)),2);
assert.equal(plan({...base,units,directions:[0],blocked:c=>corridor(c)||c.x===5}),null);
assert.equal(plan({...base,units}).moves.length,0,'prefer another clear fall direction');
assert.equal(plan({...base,units,directions:[0],blocked:corridor,maxDepth:1}),null);
assert.equal(plan({...base,directions:[0],stepBlocked:()=>true}),null);
assert.equal(plan({...base,directions:[0],blocked:c=>c.x===1}),null);
console.log('Corpse landing: clear / push / chain / blocked / alternate / bounds / walls passed');

assert.doesNotMatch(fs.readFileSync('corpse-landing-test.html','utf8'),/<iframe/i);
assert.doesNotMatch(fs.readFileSync('index.html','utf8'),/combat-corpse-landing/);
assert.doesNotMatch(fs.readFileSync('js/adventure-party.js','utf8'),/planGiantCorpseLanding/);

const shape=[{x:0,y:0},{x:-1,y:1},{x:-1,y:-1}];
const shaped=plan({...base,footprintOffsets:shape,directions:[0],units:[{id:'leg',x:-1,y:1}]});assert.equal(shaped.moves.length,1,'unit under leg must move');assert.equal(shaped.cells.length,3);assert.equal(shaped.cells.some(c=>c.x===2&&c.y===0),false,'no invented head cell');
