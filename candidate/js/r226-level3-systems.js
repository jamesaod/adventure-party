/* ============================================================
   EFFECT / INITIATIVE / MISSILE SYSTEM EXTENSIONS
   ============================================================ */

const r226BaseAddUnitEffect=AdventurePartyCombatServices.current('addUnitEffect');
AdventurePartyCombatServices.register('addUnitEffect','r226-level3-systems.js:6:addUnitEffect',function(unit,effectSpec){
  const effect=r226BaseAddUnitEffect(unit,effectSpec);
  if(["haste","slow","gust-wind"].includes(effectSpec?.id)){
    r226RecomputeMobility(unit);
  }
  if(effectSpec?.id && R226_DISPELLABLE_UNIT_EFFECTS.has(effectSpec.id)){
    queueMicrotask(()=>ensurePersistentStatusFxLoop());
  }
  return effect;
});

const r226BaseRemoveUnitEffect=AdventurePartyCombatServices.current('removeUnitEffect');
AdventurePartyCombatServices.register('removeUnitEffect','r226-level3-systems.js:18:removeUnitEffect',function(unit,id){
  const removed=r226BaseRemoveUnitEffect(unit,id);
  if(removed && ["haste","slow","gust-wind"].includes(id)){
    r226RecomputeMobility(unit);
  }
  return removed;
});

const r226BaseExpireTimedUnitEffects=AdventurePartyCombatServices.current('expireTimedUnitEffects');
AdventurePartyCombatServices.register('expireTimedUnitEffects','r226-level3-systems.js:27:expireTimedUnitEffects',function(){
  r226BaseExpireTimedUnitEffects();
  r226ActiveWindWalls();
  r226RecomputeAllMobility();
  r226CleanupRadiusInvisibility();
});



const r226BaseAttackEffectModifier=AdventurePartyCombatServices.current('attackEffectModifier');
AdventurePartyCombatServices.register('attackEffectModifier','r226-level3-systems.js:37:attackEffectModifier',function(attacker,defender){
  let modifier=r226BaseAttackEffectModifier(attacker,defender);

  if(getUnitEffect(attacker,"slow")) modifier-=4;

  if(
    defender && attacker && isEvilAlignment(attacker) &&
    !getUnitEffect(defender,"protection-from-evil") &&
    r226ProtectionAuraSourceFor(defender)
  ){
    modifier-=2;
  }

  if(
    attacker?.weaponInHand==="ranged" &&
    attacker?.rangedWeapon==="Sling"
  ){
    const wall=r226LineCrossesWindWall(attacker,defender);
    if(wall){
      if(!wall.shotsByAttacker) wall.shotsByAttacker={};
      const count=wall.shotsByAttacker[attacker.id] || 0;
      modifier+=count===0 ? -4 : -2;
      wall.shotsByAttacker[attacker.id]=count+1;
    }
  }

  return modifier;
});

const r226BaseSpellSaveRollModifier=AdventurePartyCombatServices.current('spellSaveRollModifier');
AdventurePartyCombatServices.register('spellSaveRollModifier','r226-level3-systems.js:67:spellSaveRollModifier',function(target,sourceUnit=null,extraModifier=0){
  let modifier=r226BaseSpellSaveRollModifier(target,sourceUnit,extraModifier);
  if(
    sourceUnit && isEvilAlignment(sourceUnit) &&
    !getUnitEffect(target,"protection-from-evil") &&
    r226ProtectionAuraSourceFor(target)
  ){
    modifier+=2;
  }
  return modifier;
});

const r226BaseEffectiveArmorClassForAttack=AdventurePartyCombatServices.current('effectiveArmorClassForAttack');
AdventurePartyCombatServices.register('effectiveArmorClassForAttack','r226-level3-systems.js:80:effectiveArmorClassForAttack',function(attacker,defender,attackKind="melee"){
  let ac=r226BaseEffectiveArmorClassForAttack(attacker,defender,attackKind);
  if(getUnitEffect(defender,"slow")) ac+=4;
  return r226Clamp(ac,-10,10);
});

function r226SlowAttackBlocked(attacker){
  const slow=getUnitEffect(attacker,"slow");
  if(!slow) return false;
  if(game.round%2!==0) return true;
  return slow.data?.attackUsedRound===game.round;
}



function r226PreparePlayerAttackRate(actor){
  if(!actor || !isPlayerControlledUnit(actor)) return;
  if(actor.__r226AttackRateRound===game.round) return;
  actor.__r226AttackRateRound=game.round;

  let base=actor.id==="player"
    ? fighterAttacksThisRound(actor,game.round)
    : 1;

  if(getUnitEffect(actor,"haste")) base*=2;
  if(getUnitEffect(actor,"slow")) base=(game.round%2===0 ? 1 : 0);

  actor.attacksThisRound=Math.max(0,Math.floor(base));
  actor.attacksRemaining=actor.attacksThisRound;

  if(Number.isFinite(actor.missileRateOfFire)){
    const missileBase=Math.max(1,Number(actor.missileRateOfFire)||1);
    actor.shotsThisRound=getUnitEffect(actor,"haste") ? missileBase*2 : missileBase;
    if(getUnitEffect(actor,"slow")) actor.shotsThisRound=game.round%2===0 ? 1 : 0;
    actor.shotsRemaining=actor.shotsThisRound;
  }
}

