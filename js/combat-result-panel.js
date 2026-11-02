/* Persistent, reference-style result blocks; production beats own timing. */
function beginCombatResultTurn(actorId){window.AdventurePartyCombatResults?.beginTurn(actorId);}
function combatResultLines(beat){
 const m=beat.meta||{},target=m.targetName||beat.unit?.name||'Unit';
 const line=(text,role='action')=>({text:String(text).replace(/\.$/,'').toUpperCase(),role});
 if(beat.category==='death')return [line(target,'downed'),line('Goes down'),line('And is dying')];
 if(beat.category==='direct-damage')return [line(m.attackerName||'An effect','actor'),line('Attacks'),line(target,'target'),line(`Hitting for ${m.amount}`),line('Points of damage')];
 if(beat.category==='direct-result')return [line(m.attackerName||'An effect','actor'),line('Attacks'),line(target,'target'),line(m.outcome==='mirror-image'?'Strikes a Mirror Image':'Misses')];
 if(beat.category==='secondary-damage')return [line(target,'target'),line(`Takes ${m.amount} ${m.damageType||'additional'}`),line('Points of damage')];
 return [line(target,'target'),line(beat.text)];
}
(()=>{
 const sources=new WeakMap(),deaths=new WeakMap(),outcomes=new WeakMap();
 const baseFlash=flashAttack;
 flashAttack=function(attacker,target,hit){if(target)outcomes.set(target,{attacker,gameRef:game,hit});return baseFlash(attacker,target,hit);};
 let shownGame=null,turnGame=null,turnKey=null,shownAction=null,actionSequence=0;
 const actions=new WeakMap();
 let physicalAction=null;
 const baseHitSound=playAttackSound,baseRockSound=playRockImpactSound;
 const baseAgony=playAgonySound,baseDeathSound=playDeathSound;
 function actionFor(unit){return actions.get(unit);}
 function captureImpact(base){return function(...args){
  if(physicalAction&&candidateCombatBeatPresentationEnabled()){
   physicalAction.impact=()=>base(...args);return;
  }
  return base(...args);
 };}
 playAttackSound=captureImpact(baseHitSound);
 playRockImpactSound=captureImpact(baseRockSound);
 playAgonySound=function(unit){
  if(candidateCombatBeatPresentationEnabled())return;
  return baseAgony(unit);
 };
 playDeathSound=function(unit){
  if(candidateCombatBeatPresentationEnabled())return;
  return baseDeathSound(unit);
 };
 // Reuse the game's audio mixer and noise voice for short elemental cues.
 function elementalSound(type){
  if(typeof queueSfx!=='function')return;
  queueSfx(()=>{
   const fire=type==='fire',acid=type==='acid';
   noiseVoice(fire?0.45:0.25,0.10,fire?'highpass':acid?'bandpass':'lowpass',fire?1100:acid?1800:650,0.7,0);
  });
 }
 const panel=document.querySelector('.unit-info-panel');
 const result=document.createElement('div');result.id='combatResult';result.hidden=true;
 result.setAttribute('role','log');result.setAttribute('aria-label','Combat results');result.setAttribute('aria-live','polite');result.setAttribute('aria-relevant','additions');panel.insertBefore(result,document.getElementById('combatCompass'));
 function clear(){
  shownGame=null;turnGame=null;turnKey=null;shownAction=null;result.hidden=true;result.replaceChildren();
 }
 function show(beat){
  if(shownGame&&shownGame!==game)clear();
  if(beat.meta?.actionId!=null&&beat.meta.actionId!==shownAction){
   result.replaceChildren();shownAction=beat.meta.actionId;
  }
  const follow=result.scrollTop+result.clientHeight>=result.scrollHeight-4;
  const entry=document.createElement('div');entry.className='combat-result-entry';entry.dataset.category=beat.category;
  for(const {text,role} of combatResultLines(beat)){
   const row=document.createElement('div');row.className='combat-result-line combat-result-'+role;row.textContent=text+'\n';entry.append(row);
  }
  shownGame=game;result.hidden=false;result.append(entry);
  if(follow)result.scrollTop=result.scrollHeight;
 }

 let effectSound=null,capturingEffect=false;
 if(typeof playDqkSpellAffectSound==='function'){
  const baseEffectSound=playDqkSpellAffectSound,baseEffect=addUnitEffect;
  playDqkSpellAffectSound=function(...args){
   if(capturingEffect&&candidateCombatBeatPresentationEnabled()){effectSound=()=>baseEffectSound(...args);return;}
   return baseEffectSound(...args);
  };
  addUnitEffect=function(...args){
   const previous=effectSound,previousCapture=capturingEffect;effectSound=null;capturingEffect=true;
   try{return baseEffect(...args);}finally{effectSound=previous;capturingEffect=previousCapture;}
  };
 }
 const baseQueue=candidateQueueCombatBeat;
 candidateQueueCombatBeat=function(unit,spec={}){
  const source=sources.get(unit),action=actionFor(unit);
  return baseQueue(unit,{...spec,sound:spec.sound||(['buff','debuff','condition'].includes(spec.category)?(effectSound||(typeof playMagicEffectSound==='function'?()=>playMagicEffectSound(spec.category):null)):null),meta:{...spec.meta,actionId:action?.id,action,targetName:unit?.name,attackerName:source?.name||candidateDamageBeatContext?.source||activeUnit()?.name||'An effect'}});
 };
 const baseRun=candidateRunCombatBeat;
 candidateRunCombatBeat=function(beat){
  if(beat?.gameRef===game&&candidateCombatBeatPresentationEnabled()){
   show(beat);
   if(beat.category==='direct-damage'){
    const action=beat.meta?.action;
    if(action?.impact){action.impact();action.impact=null;}
    else if(['fire','acid','cold','electricity'].includes(beat.meta?.damageType))elementalSound(beat.meta.damageType);
    else baseHitSound();
   }else if(beat.category==='secondary-damage')elementalSound(beat.meta?.damageType);
  }
  return baseRun(beat);
 };
 const baseUpdate=updateUnitInfoPanel;
 updateUnitInfoPanel=function(){
  if(shownGame&&shownGame!==game)clear();
  const following=result.scrollTop+result.clientHeight>=result.scrollHeight-4;
  const answer=baseUpdate();
  // Switching between units with different equipment changes the feed height.
  // Keep the latest result visible without disturbing someone reading above.
  if(following&&!result.hidden)result.scrollTop=result.scrollHeight;
  return answer;
 };
 // Source identity is retained across physical wind-up / projectile awaits.
 function physical(base){return async function(attacker,target,...args){
  const combat=game,previous=sources.get(target),previousAction=actions.get(target),previousPhysical=physicalAction;
  const action={id:++actionSequence};physicalAction=action;
  if(target){sources.set(target,attacker);actions.set(target,action);outcomes.delete(target);}
  try{
   const answer=await base(attacker,target,...args);
   const event=outcomes.get(target),resolution=answer||(event?.gameRef===combat&&event.attacker===attacker?event:null);
   if(game===combat&&resolution?.hit===false&&!resolution.interrupted&&!resolution.blockedByWall&&!resolution.blockedByObstacle&&target&&candidateCombatBeatPresentationEnabled())candidateQueueCombatBeat(target,{category:'direct-result',text:`${attacker.name} attacks ${target.name}, ${resolution.mirrorImage?'striking a Mirror Image':'missing'}.`,show:()=>{},meta:{fullText:true,outcome:resolution.mirrorImage?'mirror-image':'miss'}});
   return answer;
  }finally{
   physicalAction=previousPhysical;
   if(target){if(previous)sources.set(target,previous);else sources.delete(target);if(previousAction)actions.set(target,previousAction);else actions.delete(target);}
  }
 };}
 attack=physical(attack);longbowAttack=physical(longbowAttack);slingAttack=physical(slingAttack);
 const baseSpellDamage=applySpellDamage;
 applySpellDamage=function(source,target,...args){
  if(!target)return baseSpellDamage(source,target,...args);
  const previous=sources.get(target),previousAction=actions.get(target);sources.set(target,source);actions.set(target,{id:++actionSequence});
  try{return baseSpellDamage(source,target,...args);}finally{if(previous)sources.set(target,previous);else sources.delete(target);if(previousAction)actions.set(target,previousAction);else actions.delete(target);}
 };
 const baseDeath=triggerDeathFx;
 triggerDeathFx=function(unit){
  if(unit&&deaths.get(unit)!==game&&candidateCombatBeatPresentationEnabled()){
   deaths.set(unit,game);candidateQueueCombatBeat(unit,{category:'death',text:'Goes down and is dying',show:()=>{baseDeathSound(unit);baseDeath(unit);}});
   return;
  }
  if(unit&&deaths.get(unit)===game&&candidateCombatBeatPresentationEnabled())return;
  return baseDeath(unit);
 };
 window.AdventurePartyCombatResults={beginTurn(actorId){
  const key=`${game?.round}:${game?.turnIndex}:${actorId}`;
  if(turnGame!==game||turnKey!==key){clear();turnGame=game;turnKey=key;}
 }};
 const baseClear=window.AdventurePartyCombatBeats.clear;
 window.AdventurePartyCombatBeats.clear=()=>{clear();return baseClear();};
})();
