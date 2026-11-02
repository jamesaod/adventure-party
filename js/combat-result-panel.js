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
 let shownGame=null,turnGame=null,turnKey=null;
 const panel=document.querySelector('.unit-info-panel');
 const result=document.createElement('div');result.id='combatResult';result.hidden=true;
 result.setAttribute('role','log');result.setAttribute('aria-label','Combat results');result.setAttribute('aria-live','polite');result.setAttribute('aria-relevant','additions');panel.insertBefore(result,document.getElementById('combatCompass'));
 function clear(){
  shownGame=null;turnGame=null;turnKey=null;result.hidden=true;result.replaceChildren();
 }
 function show(beat){
  if(shownGame&&shownGame!==game)clear();
  const follow=result.scrollTop+result.clientHeight>=result.scrollHeight-4;
  const entry=document.createElement('div');entry.className='combat-result-entry';entry.dataset.category=beat.category;
  for(const {text,role} of combatResultLines(beat)){
   const row=document.createElement('div');row.className='combat-result-line combat-result-'+role;row.textContent=text+'\n';entry.append(row);
  }
  shownGame=game;result.hidden=false;result.append(entry);
  if(follow)result.scrollTop=result.scrollHeight;
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
  const combat=game,previous=sources.get(target);if(target){sources.set(target,attacker);outcomes.delete(target);}
  try{
   const answer=await base(attacker,target,...args);
   const event=outcomes.get(target),resolution=answer||(event?.gameRef===combat&&event.attacker===attacker?event:null);
   if(game===combat&&resolution?.hit===false&&!resolution.interrupted&&!resolution.blockedByWall&&!resolution.blockedByObstacle&&target&&candidateCombatBeatPresentationEnabled())candidateQueueCombatBeat(target,{category:'direct-result',text:`${attacker.name} attacks ${target.name}, ${resolution.mirrorImage?'striking a Mirror Image':'missing'}.`,show:()=>{},meta:{fullText:true,outcome:resolution.mirrorImage?'mirror-image':'miss'}});
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
 window.AdventurePartyCombatResults={beginTurn(actorId){
  const key=`${game?.round}:${game?.turnIndex}:${actorId}`;
  if(turnGame!==game||turnKey!==key){clear();turnGame=game;turnKey=key;}
 }};
 const baseClear=window.AdventurePartyCombatBeats.clear;
 window.AdventurePartyCombatBeats.clear=()=>{clear();return baseClear();};
})();
