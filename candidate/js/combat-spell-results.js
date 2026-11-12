/* Shared post-animation, target-by-target spell resolution. */
let combatSpellResultsGeneration=0;
const combatSpellResultsDepths=new WeakMap();
function captureSpellTargetResults(){return {gameRef:game,generation:combatSpellResultsGeneration,screen:currentScreen};}
function spellTargetResultsCurrent(session){
 return session.gameRef===game&&session.generation===combatSpellResultsGeneration&&session.screen===currentScreen;
}
async function waitForSpellTargetResults(session){
 // Queueing a result flushes in a microtask. Re-check after each actual beat;
 // a stalled tab must not shorten the current target's death/result display.
 await Promise.resolve();
 while(spellTargetResultsCurrent(session)){
  const remaining=combatActionPauseRemaining();
  const pending=[...candidateCombatBeatGroups.values()].some(g=>g.gameRef===game&&g.pending.length);
  if(!pending&&remaining<=0)return true;
  await sleep(Math.max(16,remaining));
 }
 return false;
}
async function presentSpellTargetResults(caster,results,resolve,session=captureSpellTargetResults()){
 combatSpellResultsDepths.set(session.gameRef,(combatSpellResultsDepths.get(session.gameRef)||0)+1);
 try{
  for(const result of results){
   if(!spellTargetResultsCurrent(session))return false;
   const unit=result.unit;
   if(!unit?.alive||unit.fled)continue;
   if(!await waitForSpellTargetResults(session))return false;
   if(typeof rangedFramingEnabled==='undefined'||!rangedFramingEnabled)centerCameraOn(unit);
   hoverHex=null;
   draw();
   await presentCombatFrame();
   if(!spellTargetResultsCurrent(session))return false;
   window.AdventurePartyCombatResults.withTarget(caster,unit,()=>resolve(result));
   updateUi();draw();
   if(!await waitForSpellTargetResults(session))return false;
  }
  return spellTargetResultsCurrent(session);
 }finally{combatSpellResultsDepths.set(session.gameRef,Math.max(0,(combatSpellResultsDepths.get(session.gameRef)||0)-1));}
}
// Resolve all victims in one frame and hold turn progression once.
async function presentSimultaneousSpellTargetResults(caster,results,resolve,session=captureSpellTargetResults()){
 combatSpellResultsDepths.set(session.gameRef,(combatSpellResultsDepths.get(session.gameRef)||0)+1);
 try{
  if(!await waitForSpellTargetResults(session))return false;
  candidateWithSimultaneousCombatBeats(()=>{
   for(const result of results){
    if(!spellTargetResultsCurrent(session))break;
    if(!result.unit?.alive||result.unit.fled)continue;
    window.AdventurePartyCombatResults.withTarget(caster,result.unit,()=>resolve(result));
   }
  });
  hoverHex=null;updateUi();draw();
  return await waitForSpellTargetResults(session);
 }finally{combatSpellResultsDepths.set(session.gameRef,Math.max(0,(combatSpellResultsDepths.get(session.gameRef)||0)-1));}
}
// A blast can include enemies and allies, including its caster. Finish only
// after every captured target has resolved, even if one faction falls first.
const spellResultsBaseVictory=AdventurePartyCombatServices.current('checkCombatVictory'),spellResultsBaseDefeat=AdventurePartyCombatServices.current('checkPartyDefeat');
AdventurePartyCombatServices.register('checkCombatVictory','combat-spell-results.js:43:checkCombatVictory',function(...args){return combatSpellResultsDepths.get(game)?false:spellResultsBaseVictory(...args);});
AdventurePartyCombatServices.register('checkPartyDefeat','combat-spell-results.js:44:checkPartyDefeat',function(...args){return combatSpellResultsDepths.get(game)?false:spellResultsBaseDefeat(...args);});
const spellResultsBaseClear=window.AdventurePartyCombatBeats.clear;
window.AdventurePartyCombatBeats.clear=function(){combatSpellResultsGeneration++;return spellResultsBaseClear();};

// Burning Hands and other cone/area callers share the same complete target beat.
AdventurePartyCombatServices.register('resolveAoeDamageSpell','combat-spell-results.js:49:resolveAoeDamageSpell',async function({caster,spellName,targets,damage,saveForHalf=true,magicCasualtySource=spellName,damageType=null}){
 let koboldCasualties=0;
 const completed=await presentSpellTargetResults(caster,targets.map(unit=>({unit})),({unit})=>{
  const save=saveForHalf?rollSpellSave(unit,caster):null;
  const actualDamage=save?.success?Math.floor(damage/2):damage;
  unit.hp=Math.max(0,unit.hp-actualDamage);
  if(actualDamage>0){
   candidateWithDamageBeatContext({category:'direct-damage',damageType,source:spellName},()=>onUnitDamaged(unit,actualDamage));
   registerElementalDamageFx(unit,damageType,actualDamage);
  }else candidateQueueCombatBeat(unit,{category:'condition',text:'Takes no '+spellName+' damage',sound:()=>{}});
  if(save)log(`${unit.name}: save ${save.modifiedRoll} vs ${save.targetNumber}: ${save.success?'half':'full'} damage.`,'system');
  if(unit.hp<=0){
   unit.alive=false;
   playAgonySound(unit);playDeathSound(unit);triggerDeathFx(unit);
   if(unit.controller==='mob'){
    markEnemyNeutralized(unit);
    if(isKoboldUnit(unit))koboldCasualties++;
   }
  }
 });
 if(!completed)return false;
 if(koboldCasualties>0&&activeEnemies().length>0){
  const scheduled=scheduleKoboldGroupMoraleCheck({casualties:koboldCasualties,magicCasualties:koboldCasualties,source:magicCasualtySource},0);
  if(scheduled)await waitForCombatActionPause();
 }
 return true;
});
