import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {extractCombatFunction} from './combat-test-source.mjs';
const s=readFileSync('js/combat-render-frame.js','utf8');
const dead=s.slice(s.indexOf('for(const corpse of'),s.indexOf('  const treeDecorations='));
const living=s.slice(s.indexOf('  if(!deathPresentationActive(game.player))'),s.indexOf('  if(explorationTerrain?.isRenderableHex)'));
for(const workshop of [false,true])for(const phase of ['alive','pending','falling','settled']){
 const enemy={id:'orc',species:'orc',alive:phase==='alive'};if(phase==='falling'||phase==='settled')enemy.deathPresentationStartedAt=10;
 const calls=[],c=vm.createContext({HEX_W:64,HEX_H:42,game:{player:{id:'player',alive:true},allies:[],enemies:[enemy]},shouldRenderUnitUnderPartyVisibility:()=>true,unitDepthSortPoint:()=>({x:0,y:0}),unitPoseDefinition:()=>workshop?{spriteLayout:{}}:null,drawFighter(){},drawFriendlyMage(){},drawFriendlyArcher(){},drawOrc:()=>calls.push('orc'),drawStudioSpriteMob:()=>calls.push('model'),drawLargeTestMob(){},drawKobold(){}});
 vm.runInContext(extractCombatFunction(s,'deathPresentationActive')+';const actors=[];'+dead+living+';for(const a of actors)if(a.entity.id==="orc")a.fn();',c);
 assert.deepEqual(calls,[workshop||phase==='falling'||phase==='settled'?'model':'orc'],phase+' must draw exactly once through the correct renderer');
}
console.log('PASS legacy and Workshop Orcs remain drawn exactly once before, during and after the death beat');
