import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync('js/adventure-party.js','utf8');
const rates=fs.readFileSync('js/r226-level3-systems.js','utf8');
const spells=fs.readFileSync('js/combat-spells-support.js','utf8');
function extract(s,start,end){return s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)));}
for(const enlarged of [false,true])for(const remaining of [1,2]){
 const actor={id:'elf',alive:true,type:'repository',faction:'friendly',missileCatalogId:'bow-composite-long',missileRateOfFire:2,missileAmmoQuantity:20,shotsRemaining:remaining,__r226AttackRateRound:1,attacksRemaining:1,buffs:[]};
 let shots=0,done=0;
 const ctx=vm.createContext({game:{round:1,active:'elf',over:false},quickCommandGeneration:1,quickCommandRunning:false,quickCommandUnitId:"elf",getUnitById:()=>actor,
 activePlayerControlledUnit:()=>actor,isQuickCommandUnit:()=>true,isPlayerControlledUnit:()=>true,
 combatActionPauseRemaining:()=>0,exitAimMode:()=>{},closeCharacterSheet:()=>{},selectCombatAiWeapon:async()=>{},unitHasRangedWeaponInHand:()=>true,bestRangedAiTargetFrom:()=>({id:'enemy'}),
 longbowAttack:async()=>{shots++;actor.missileAmmoQuantity--;return {hit:false};},waitForCombatActionPause:async()=>{},playerDone:()=>{done++;ctx.game.active=null;},updateUi:()=>{},draw:()=>{},getUnitEffect:(u,id)=>u.buffs.find(e=>e.id===id),fighterAttacksThisRound:()=>1,
 spellCasterForAction:()=>({faction:'friendly'}),getSpellEntry:()=>({}),TEST_SPELL_CASTER_LEVEL:1,validCreatureTargetWithinRange:()=>true,lineOfSightBlocked:()=>false,commitSpellCast:()=>true,spellCastInProgress:false,pendingAimAction:null,enlargeVisualScale:()=>1,addUnitEffect:(u,e)=>u.buffs.push(e),triggerEnlargeTransition:()=>{},setCombatMessage:()=>{},COMBAT_MESSAGE_MIN_HOLD_MS:1,finishTestSpellCast:()=>{}});
 vm.runInContext(extract(rates,'function r226PreparePlayerAttackRate(', '\n}\n')+'\n}',ctx);
 vm.runInContext(extract(source,'async function runQuickCommandPlayerTurn(','function activateQuickCommand('),ctx);
 vm.runInContext(extract(spells,'async function castEnlargeSpell(','async function castProtectionFromEvilSpell('),ctx);
 if(enlarged){await ctx.castEnlargeSpell({casterLevel:5},actor);assert.equal(actor.shotsRemaining,remaining);assert.equal(actor.missileRateOfFire,2);}
 await ctx.runQuickCommandPlayerTurn(1);
 assert.equal(shots,remaining);assert.equal(actor.shotsRemaining,0);assert.equal(done,1);assert.equal(actor.missileAmmoQuantity,20-remaining);
}
console.log('PASS Quick bow fires remaining shots, including enlarged elves, without refilling spent shots');
