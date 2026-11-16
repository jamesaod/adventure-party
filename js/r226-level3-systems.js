/* ============================================================
   EFFECT / INITIATIVE / MISSILE SYSTEM EXTENSIONS
   ============================================================ */

const r226BaseAddUnitEffect=addUnitEffect;
addUnitEffect=function(unit,effectSpec){
  const effect=r226BaseAddUnitEffect(unit,effectSpec);
  if(["haste","slow","gust-wind"].includes(effectSpec?.id)){
    r226RecomputeMobility(unit);
  }
  if(effectSpec?.id && R226_DISPELLABLE_UNIT_EFFECTS.has(effectSpec.id)){
    queueMicrotask(()=>ensurePersistentStatusFxLoop());
  }
  return effect;
};

const r226BaseRemoveUnitEffect=removeUnitEffect;
removeUnitEffect=function(unit,id){
  const removed=r226BaseRemoveUnitEffect(unit,id);
  if(removed && ["haste","slow","gust-wind"].includes(id)){
    r226RecomputeMobility(unit);
  }
  return removed;
};

const r226BaseExpireTimedUnitEffects=expireTimedUnitEffects;
expireTimedUnitEffects=function(){
  r226BaseExpireTimedUnitEffects();
  r226ActiveWindWalls();
  r226RecomputeAllMobility();
  r226CleanupRadiusInvisibility();
};

const r226BaseRollInitiative=rollInitiative;
rollInitiative=function(){
  const rolls=r226BaseRollInitiative();
  for(const entry of rolls){
    const unit=getUnitById(entry.id);
    if(getUnitEffect(unit,"haste")) entry.roll=Math.max(0,entry.roll-2);
  }
  rolls.sort((a,b)=>a.roll-b.roll || a.tie-b.tie || a.id.localeCompare(b.id));
  return rolls;
};

const r226BaseAttackEffectModifier=attackEffectModifier;
attackEffectModifier=function(attacker,defender){
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
};

const r226BaseSpellSaveRollModifier=spellSaveRollModifier;
spellSaveRollModifier=function(target,sourceUnit=null,extraModifier=0){
  let modifier=r226BaseSpellSaveRollModifier(target,sourceUnit,extraModifier);
  if(
    sourceUnit && isEvilAlignment(sourceUnit) &&
    !getUnitEffect(target,"protection-from-evil") &&
    r226ProtectionAuraSourceFor(target)
  ){
    modifier+=2;
  }
  return modifier;
};

const r226BaseEffectiveArmorClassForAttack=effectiveArmorClassForAttack;
effectiveArmorClassForAttack=function(attacker,defender,attackKind="melee"){
  let ac=r226BaseEffectiveArmorClassForAttack(attacker,defender,attackKind);
  if(getUnitEffect(defender,"slow")) ac+=4;
  return r226Clamp(ac,-10,10);
};

function r226SlowAttackBlocked(attacker){
  const slow=getUnitEffect(attacker,"slow");
  if(!slow) return false;
  if(game.round%2!==0) return true;
  return slow.data?.attackUsedRound===game.round;
}

const r226BaseAttack=attack;
attack=function(attacker,defender,options={}){
  if(r226SlowAttackBlocked(attacker)){
    setCombatMessage(`${attacker.name} is Slowed and cannot make another attack this round.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    log(`${attacker.name}'s Slow effect suppresses the attack.`,"system");
    return {hit:false,killed:false,damage:0,blockedBySlow:true};
  }

  const result=r226BaseAttack(attacker,defender,options);
  if(getUnitEffect(attacker,"slow") && !result?.blockedBySlow){
    getUnitEffect(attacker,"slow").data.attackUsedRound=game.round;
  }
  return result;
};

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

function r226NormalMissileProtected(defender){
  return !!getUnitEffect(defender,"protection-from-normal-missiles");
}

async function r226ProtectedLongbowMiss(attacker,defender,reason){
  if(!attacker?.alive || !defender?.alive) return {hit:false,killed:false,damage:0};
  await focusRangedAttacker(attacker);
  attacker.weaponInHand="ranged";
  faceEntityToward(attacker,defender);
  triggerUnitAttackPose(attacker);
  breakInvisibility(attacker,"making a Longbow attack");
  playMissSound();
  await animateArrowProjectile(attacker,defender,false);
  setCombatMessage(reason,COMBAT_MESSAGE_MIN_HOLD_MS);
  log(reason,"system");
  return {hit:false,killed:false,damage:0,blockedByMagic:true};
}

const r226BaseLongbowAttack=longbowAttack;
longbowAttack=async function(attacker,defender){
  if(r226NormalMissileProtected(defender)){
    return await r226ProtectedLongbowMiss(
      attacker,defender,
      `${defender.name}'s Protection From Normal Missiles turns aside the arrow.`
    );
  }
  if(r226LineCrossesWindWall(attacker,defender)){
    return await r226ProtectedLongbowMiss(
      attacker,defender,
      `The arrow is deflected by the Wind Wall before it can reach ${defender.name}.`
    );
  }
  return await r226BaseLongbowAttack(attacker,defender);
};

async function r226ProtectedSlingMiss(attacker,defender){
  if(Number.isFinite(attacker.missileAmmoQuantity) && attacker.missileAmmoQuantity<=0){
    setCombatMessage(`${attacker.name} is out of sling bullets.`);
    return false;
  }
  if(projectilePathBlocked(attacker,defender)) return await r226BaseSlingAttack(attacker,defender);

  await focusRangedAttacker(attacker);
  setUnitActionBanner(attacker,"Preparing Sling");
  playSlingWindupSound();
  await sleep(300);

  attacker.weaponInHand="ranged";
  triggerUnitAttackPose(attacker);
  playSlingReleaseSound();
  breakInvisibility(attacker,"making a Sling attack");

  if(Number.isFinite(attacker.missileAmmoQuantity)){
    attacker.missileAmmoQuantity=Math.max(0,attacker.missileAmmoQuantity-1);
  }
  await animateSlingProjectile(attacker,defender,false);
  playMissSound();
  setCombatMessage(`${defender.name}'s Protection From Normal Missiles turns aside the sling shot.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  log(`${attacker.name}'s sling missile is negated by Protection From Normal Missiles.`,"system");
  updateUi();
  return false;
}

const r226BaseSlingAttack=slingAttack;
slingAttack=async function(attacker,defender){
  if(r226NormalMissileProtected(defender)){
    return await r226ProtectedSlingMiss(attacker,defender);
  }
  return await r226BaseSlingAttack(attacker,defender);
};


