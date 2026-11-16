import assert from 'node:assert/strict';
import vm from 'node:vm';import {readFileSync} from 'node:fs';
let now=0;const c={game:{round:2},performance:{now:()=>now},inside:()=>true,key:(x,y)=>`${x},${y}`,ensureTransientUnitFxLoop(){},combatGpu:{snowAmount:()=>1},hexDistance:(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs(a.x-b.x+a.y-b.y))};vm.createContext(c);vm.runInContext(readFileSync('js/combat-environment-state.js','utf8'),c);
c.warmCombatGround([{x:0,y:0}]);assert.equal(c.game.groundHeat['0,0'].untilRound,5);assert.equal(c.game.groundHeat['0,0'].steamUntil,8000);
for(const round of [2,3,4]){c.game.round=round;assert.equal(c.combatGroundHeat().length,1);}
c.game.round=5;assert.equal(c.combatGroundHeat().length,0);
c.game.firFireStates={tree:{x:0,y:0,state:'burning'}};c.warmFirGround(c.game.firFireStates.tree);assert.equal(c.combatGroundHeat().length,7);c.game.round=6;c.warmFirGround(c.game.firFireStates.tree);c.game.firFireStates.tree.state='burnt';c.game.round=8;assert.equal(c.combatGroundHeat().length,7);c.game.round=9;assert.equal(c.combatGroundHeat().length,0);
console.log('PASS fireball ground heat expires after three rounds; burning trees warm seven cells and retain heat for three rounds after last exposure');

const before=JSON.stringify(c.game);c.combatGroundHeat();assert.equal(JSON.stringify(c.game),before,'Render heat queries are read-only');c.expireCombatGroundHeat();assert.equal(Object.keys(c.game.groundHeat).length,0);

c.game={round:2,firBlockedHexes:new Set(['0,0'])};c.addTerrainScorch=()=>{};c.igniteFirTrees([{x:0,y:0}]);assert.equal(c.combatGroundHeat().length,7,'Ignition heats neighbors before any render');
c.game.round=4;c.advanceFirFires();assert.equal(c.game.firFireStates['0,0'].state,'burnt');c.game.round=6;assert.equal(c.combatGroundHeat().length,7);c.game.round=7;c.advanceFirFires();assert.equal(c.combatGroundHeat().length,0);
c.game.round=8;c.warmCombatGround([{x:0,y:0}]);c.isHexVisibleToFriendlyParty=()=>true;c.hexCenter=(x,y)=>({x,y});c.HEX_W=100;c.combatGpu.burnSmoke=()=>{};
now=500;const snapshot=JSON.stringify(c.game.groundHeat);c.drawGroundSteam();assert.equal(JSON.stringify(c.game.groundHeat),snapshot,'Steam drawing does not mutate encounter state');c.updateGroundSteam();assert.equal(c.game.groundHeat['0,0'].steamUntil,8500);
console.log('PASS tree ignition/round expiry and separate steam update/render lifecycle');
