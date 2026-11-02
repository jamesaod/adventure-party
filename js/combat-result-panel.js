/* One readable result channel, using the production damage/effect beat queue. */
(()=>{
 const sources=new WeakMap(),deaths=new WeakMap();
 let shownGame=null,clearTimer=null,token=0;
 const panel=document.querySelector('.unit-info-panel');
 const result=document.createElement('div');result.id='combatResult';result.hidden=true;
 result.setAttribute('role','status');result.setAttribute('aria-live','polite');result.setAttribute('aria-atomic','true');panel.prepend(result);
 function clear(){
  token++;clearTimeout(clearTimer);clearTimer=null;shownGame=null;
  panel.classList.remove('showing-result');result.hidden=true;result.replaceChildren();
 }
 function show(beat){
  const meta=beat.meta||{},target=meta.targetName||beat.unit.name;
  let text;
  if(beat.category==='death')text=`${target} goes down and is dying.`;
  else if(meta.fullText)text=beat.text;
  else if(beat.category==='direct-damage')text=`${meta.attackerName||'An effect'} attacks ${target}, hitting for ${meta.amount} points of damage.`;
  else if(beat.category==='secondary-damage')text=`${target} takes ${meta.amount} points of ${meta.damageType||'additional'} damage.`;
  else if(beat.category==='buff'||beat.category==='debuff')text=`${target}: ${beat.text}.`;
  else text=`${target}: ${beat.text}.`;
  shownGame=game;panel.classList.add('showing-result');result.hidden=false;
  result.dataset.category=beat.category;result.textContent=text;
  const id=++token;clearTimeout(clearTimer);
  clearTimer=setTimeout(()=>{if(id!==token)return;clear();if(game===beat.gameRef)updateUnitInfoPanel();},1000);
 }
 const baseQueue=candidateQueueCombatBeat;
 candidateQueueCombatBeat=function(unit,spec={}){
  const source=sources.get(unit);
  return baseQueue(unit,{...spec,meta:{...spec.meta,targetName:unit?.name,attackerName:source?.name||candidateDamageBeatContext?.source||activeUnit()?.name||'An effect'}});
 };
 const baseRun=candidateRunCombatBeat;
 candidateRunCombatBeat=function(beat){
  if(beat?.gameRef===game&&candidateCombatBeatPresentationEnabled())show(beat);
  return baseRun(beat);
 };
 const baseUpdate=updateUnitInfoPanel;
 updateUnitInfoPanel=function(){if(shownGame&&shownGame!==game)clear();return baseUpdate();};
 // Source identity is retained across physical wind-up / projectile awaits.
 function physical(base){return async function(attacker,target,...args){
  const combat=game,previous=sources.get(target);if(target)sources.set(target,attacker);
  try{
   const answer=await base(attacker,target,...args);
   if(game===combat&&answer?.hit===false&&!answer.interrupted&&!answer.blockedByWall&&!answer.blockedByObstacle&&target&&candidateCombatBeatPresentationEnabled())candidateQueueCombatBeat(target,{category:'direct-result',text:`${attacker.name} attacks ${target.name}, ${answer.mirrorImage?'striking a Mirror Image':'missing'}.`,show:()=>{},meta:{fullText:true}});
   return answer;
  }finally{if(target){if(previous)sources.set(target,previous);else sources.delete(target);}}
 };}
 attack=physical(attack);longbowAttack=physical(longbowAttack);slingAttack=physical(slingAttack);
 const baseSpellDamage=applySpellDamage;
 applySpellDamage=function(source,target,...args){
  if(!target)return baseSpellDamage(source,target,...args);
  const previous=sources.get(target);sources.set(target,source);
  try{return baseSpellDamage(source,target,...args);}finally{if(previous)sources.set(target,previous);else sources.delete(target);}
 };
 const baseDeath=triggerDeathFx;
 triggerDeathFx=function(unit){
  if(unit&&deaths.get(unit)!==game&&candidateCombatBeatPresentationEnabled()){
   deaths.set(unit,game);candidateQueueCombatBeat(unit,{category:'death',text:'Goes down and is dying',show:()=>{}});
  }
  return baseDeath(unit);
 };
 const baseClear=window.AdventurePartyCombatBeats.clear;
 window.AdventurePartyCombatBeats.clear=()=>{clear();return baseClear();};
})();
