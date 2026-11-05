/* Combat owner: combat-melee-actions.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

function fighterHasSweepSlashingWeapon(fighter){
  if(!fighter?.weaponCatalogId){
    return false;
  }

  return weaponSupportsAttackType(
    fighter.weaponCatalogId,
    FIGHTER_CLASS.sweepRequiredAttackType
  );
}

function resolveChillTouchOnHit(attacker,defender){
  const effect=getUnitEffect(attacker,"chill-touch");

  if(!effect || !defender?.alive){
    return 0;
  }

  const casterLevel=Number(effect.data?.casterLevel)||1;

  if(isUndeadUnit(defender)){
    const save=rollSpellSave(defender,attacker);

    if(!save.success){
      addUnitEffect(defender,{
        id:"spook",
        name:"Fleeing from Chill Touch",
        kind:"debuff",
        expiresRound:game.round+Math.max(1,d(4)+casterLevel),
        detail:"Undead repelled by Chill Touch",
        data:{sourceUnitId:attacker.id}
      });
    }

    return 0;
  }

  const save=rollSpellSave(defender,attacker);

  if(save.success){
    log(`${defender.name} resists the Chill Touch rider effect.`,"system");
    return 0;
  }

  const extra=rollDiceExpression("1d4").total;
  defender.hp=Math.max(0,defender.hp-extra);

  if(typeof candidateWithDamageBeatContext==="function"){
    candidateWithDamageBeatContext(
      {
        category:"secondary-damage",
        damageType:"cold",
        source:"Chill Touch"
      },
      ()=>onUnitDamaged(defender,extra)
    );
  }else{
    onUnitDamaged(defender,extra);
  }

  const existing=getUnitEffect(defender,"chill-touch-strength-loss");
  const strengthLoss=(Number(existing?.data?.strengthLoss)||0)+1;

  addUnitEffect(defender,{
    id:"chill-touch-strength-loss",
    name:"Chill Touch: Strength Loss",
    kind:"debuff",
    detail:`Strength loss ${strengthLoss}; attack penalty ${formatSignedAdjustment(-Math.floor(strengthLoss/2))}`,
    data:{strengthLoss}
  });

  log(
    `${attacker.name}'s Chill Touch adds ${extra} damage and 1 point of Strength loss to ${defender.name}.`,
    "good"
  );

  return extra;
}

function meleeDamageExpression(attacker,defender){
  const catalogEntry=getWeaponCatalogEntry(attacker?.weaponCatalogId);
  if(catalogEntry) return damageExpressionForSize(catalogEntry,defender);

  return targetUsesLargeWeaponDamage(defender)
    ? (attacker?.weaponDamageL || attacker?.weaponDamageSM || "1d2")
    : (attacker?.weaponDamageSM || attacker?.weaponDamageL || "1d2");
}

async function resolveMeleeHit(attacker,defender,options={}){
  if(game.over || !attacker.alive || !defender.alive){
    return {hit:false,killed:false,damage:0};
  }

  if(unitDistance(attacker,defender)<=1 && !canMeleeReach(attacker,defender)){
    setCombatMessage("A wall blocks the melee attack.");
    return {hit:false,killed:false,damage:0,blockedByWall:true};
  }

  const position=
    attackPositionData(attacker,defender);

  faceEntityToward(attacker,defender);
  attacker.weaponInHand="melee";

  // Physical attacks are silent and effect-free until their actual attack frame.
  // Awaiting here also prevents turn advancement and follow-up attacks from
  // observing damage that has not yet happened.
  const beforeWindupGame=game;
  await prepareUnitAttackWindup(attacker);
  if(game!==beforeWindupGame || game?.over || !attacker.alive || !defender.alive){
    return {hit:false,killed:false,damage:0,interrupted:true};
  }
  triggerUnitAttackPose(attacker);
  breakInvisibility(attacker,"making a melee attack");

  setUnitActionBanner(
    attacker,
    options.actionLabel
      ? `${options.actionLabel} — ${position.label}`
      : `Attacking ${position.label} with ${unitActionWeapon(attacker)}`
  );

  /* R97: the hit/attack transient is result-dependent.
     A miss must produce only the whiff cue, never the hit transient. */

  const weaponHitBonus=attacker.weaponHitBonus || 0;
  const totalAttackBonus=
    (attacker.attackBonus || 0)+
    weaponHitBonus+
    attackEffectModifier(attacker,defender);

  /* Roll the physical attack die BEFORE applying any modifier. */
  const rawRoll=d(20);

  /* THAC0/AC establishes the unmodified target number. */
  const targetArmorClass=effectiveArmorClassForAttack(
    attacker,
    defender,
    "melee"
  );

  const targetNumber=
    attacker.thaco-targetArmorClass;

  /*
    Natural 1/20 are resolved from rawRoll before totalAttackBonus
    is ever considered by the resolver.
  */
  const resolution=resolveMeleeAttackD20(
    rawRoll,
    targetNumber,
    totalAttackBonus
  );

  playNaturalAttackRollSound(rawRoll);

  const hit=resolution.hit;

  setLastRoll(
    `${attacker.name} [${position.label}]: RAW d20 ${rawRoll}`+
    (
      resolution.automatic
        ? ` — ${resolution.automatic} (modifiers ignored)`
        : ` ${formatSignedAdjustment(totalAttackBonus)} = ${resolution.modifiedRoll} vs target ${targetNumber}`
    )+
    (
      position.directRear
        ? ` — rear +2; beneficial DEX AC and shield denied`
        : position.rearFlank
          ? ` — rear flank; shield denied`
          : ""
    )
  );

  if(!hit){
    playMissSound();
    if(rawRoll===1){
      setCriticalRollNotification(
        attacker,
        defender,
        rawRoll
      );
    }

    log(
      `${attacker.name} attacks ${defender.name} from ${position.label}: raw d20 ${rawRoll}`+
      `${resolution.automatic ? " — automatic miss." : `, modified ${resolution.modifiedRoll} vs ${targetNumber} — miss.`}`,
      attacker.id==="player" ? "" : "bad"
    );
    flashAttack(attacker,defender,false);
    return {
      hit:false,
      killed:false,
      damage:0,
      criticalMiss:rawRoll===1,
      attackSector:position.label,
      attackPosition:position
    };
  }

  if(interceptWithMirrorImage(defender,attacker)){
    playMissSound();
    setCombatMessage(`${defender.name}'s Mirror Image is struck instead.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    flashAttack(attacker,defender,false);
    return {hit:false,killed:false,damage:0,mirrorImage:true,attackSector:position.label,attackPosition:position};
  }

  /* Confirmed melee hit: retain the existing successful-hit sound. */
  playAttackSound();

  const baseExpression=meleeDamageExpression(attacker,defender);
  const baseRoll=rollDiceExpression(baseExpression);
  const enlargedMultiplier=enlargedDamageMultiplier(attacker);
  const scaledBaseDamage=Math.ceil(baseRoll.total*enlargedMultiplier);
  const weaponBonus=(attacker.damageBonus||0)+(attacker.weaponDamageBonus||0)+physicalDamageEffectModifier(attacker,"melee");
  const bonusRoll=
    attacker.bonusDamageExpression
      ? rollDiceExpression(attacker.bonusDamageExpression)
      : {expression:null,total:0};

  /*
    Candidate Rev 2 presentation contract:
    keep the established total damage result, but split a weapon's rider damage
    into its own damage application/presentation beat. This lets a Flaming
    Sword +5 read as sword damage first, then fire damage, without changing the
    final combined damage total used by death/critical resolution.
  */
  let damage=Math.max(1,scaledBaseDamage+weaponBonus+bonusRoll.total);
  const secondaryDamage=
    Math.min(
      Math.max(0,Number(bonusRoll.total)||0),
      Math.max(0,damage-1)
    );
  const directDamage=
    Math.max(
      1,
      damage-secondaryDamage
    );

  defender.hp=Math.max(0,defender.hp-directDamage);

  if(typeof candidateWithDamageBeatContext==="function"){
    candidateWithDamageBeatContext(
      {
        category:"direct-damage",
        damageType:"physical",
        source:attacker.weapon || "melee"
      },
      ()=>onUnitDamaged(defender,directDamage)
    );
  }else{
    onUnitDamaged(defender,directDamage);
  }

  if(secondaryDamage>0){
    defender.hp=Math.max(0,defender.hp-secondaryDamage);

    if(typeof candidateWithDamageBeatContext==="function"){
      candidateWithDamageBeatContext(
        {
          category:"secondary-damage",
          damageType:
            attacker.bonusDamageType ||
            "bonus",
          source:
            attacker.weapon ||
            "melee rider"
        },
        ()=>onUnitDamaged(defender,secondaryDamage)
      );
    }else{
      onUnitDamaged(defender,secondaryDamage);
    }

    if(attacker.bonusDamageType==="fire"){
      registerElementalDamageFx(
        defender,
        "fire",
        secondaryDamage
      );
    }
  }

  const chillExtra=resolveChillTouchOnHit(attacker,defender);

  if(chillExtra>0){
    damage+=chillExtra;
  }

  if(rawRoll===20){
    setCriticalRollNotification(
      attacker,
      defender,
      rawRoll,
      damage,
      false
    );
  }else{
    setCombatMessage(
      `${attacker.name} damages ${defender.name} for ${damage} damage`,
      COMBAT_MESSAGE_MIN_HOLD_MS,
      COMBAT_MESSAGE_DISPLAY_MS,
      defender.id==="player" ? "player-damage" : "normal"
    );
  }

  log(
    `${attacker.name} hits ${defender.name} from ${position.label} for ${damage} damage `+
    `(base ${baseExpression} → ${baseRoll.total}`+
    `${weaponBonus ? ` ${weaponBonus>=0?"+":""}${weaponBonus}` : ""}`+
    `${bonusRoll.expression ? ` + ${bonusRoll.total} ${attacker.bonusDamageType || "bonus"}` : ""}).`,
    attacker.id==="player" ? "good" : "bad"
  );

  flashAttack(attacker,defender,true);

  if(defender.hp<=0){
    defender.alive=false;

    if(rawRoll===20){
      setCriticalRollNotification(
        attacker,
        defender,
        rawRoll,
        damage,
        true
      );
    }else{
      setCombatMessage(
        `${defender.name} goes down and is dying`,
        COMBAT_MESSAGE_MIN_HOLD_MS,
        COMBAT_MESSAGE_DISPLAY_MS,
        defender.id==="player" ? "player-damage" : "normal"
      );
    }

    playAgonySound(defender);
    playDeathSound(defender);
    triggerDeathFx(defender);
    markEnemyNeutralized(isKoboldUnit(defender) ? defender : null);

    if(
      isKoboldUnit(defender) &&
      activeEnemies().length>0
    ){
      scheduleKoboldGroupMoraleCheck({
        casualties:1,
        magicCasualties:0,
        source:attacker.weapon || "melee attack"
      });
    }

    log(`${defender.name} is slain.`,"good");

    updateUi();
    draw();

    if(defender.faction==="player"){
      if(defender.id==="player"){
        ui.turnBanner.textContent="DUNGEON CRAWLER CARL FALLEN";
      }

      if(checkPartyDefeat()){
        return {hit:true,killed:true,damage,attackSector:position.label,attackPosition:position};
      }

      return {hit:true,killed:true,damage,attackSector:position.label,attackPosition:position};
    }

    if(checkCombatVictory()){
      return {hit:true,killed:true,damage,attackSector:position.label,attackPosition:position};
    }

    return {hit:true,killed:true,damage,attackSector:position.label,attackPosition:position};
  }

  updateUi();
  return {hit:true,killed:false,damage,attackSector:position.label,attackPosition:position};
}

async function playerAttackKey(){
  const p=activePlayerControlledUnit();
  if(
    game.over || !p || game.active!==p.id || sweepInProgress ||
    mobGuardReactionInProgress || isCombatActionPauseActive()
  ) return;

  if(p.fullMove){ log("Cannot attack after choosing a full move.","system"); return; }

  const targets=activeEnemies().filter(k=>canMeleeReach(p,k)).sort((a,b)=>a.hp-b.hp || a.id.localeCompare(b.id));
  if(!targets.length){ log("No adjacent target.","system"); return; }
  const target=targets[0];

  if(p.id==="player" && isSweepEligibleTarget(target) && canUseSweep()){
    await performSweep(target);
    return;
  }

  const result=await attack(p,target);
  if(result?.killed || result?.criticalMiss) await waitForCombatActionPause();
  if(!game.over) finishPlayerAttackAction();
}

function isSweepEligibleTarget(unit){
  return !!(
    unit &&
    unit.alive &&
    !unit.fled &&
    unit.faction==="enemy" &&
    typeof unit.hitDiceValue==="number" &&
    unit.hitDiceValue<1
  );
}

function adjacentSweepTargets(){
  if(!game?.player) return [];

  return activeEnemies()
    .filter(unit=>
      isSweepEligibleTarget(unit) &&
      canMeleeReach(game.player,unit)
    )
    .sort((a,b)=>a.hp-b.hp || a.id.localeCompare(b.id));
}

function canUseSweep(){
  if(
    !game ||
    game.over ||
    game.active!=="player" ||
    !game.player.alive ||
    game.player.type!=="fighter" ||
    !FIGHTER_CLASS.canSweep ||
    sweepInProgress
  ){
    return false;
  }

  const p=game.player;

  if(p.fullMove) return false;
  if(p.turnMoves>p.halfMove) return false;
  if(p.sweepUsedThisRound) return false;

  /*
    R53 Sweep weapon gate:
    only an equipped weapon capable of a Slashing (S) attack can Sweep.
    Piercing-only, Bludgeoning-only, missile, or unarmed attacks cannot.
  */
  if(!fighterHasSweepSlashingWeapon(p)) return false;

  /* Sweep replaces an unused normal attack routine for this round. */
  if(p.attacksRemaining!==p.attacksThisRound) return false;

  return adjacentSweepTargets().length>0;
}

async function performSweep(preferredTarget=null){
  if(!canUseSweep()) return false;

  if(
    preferredTarget &&
    (
      !isSweepEligibleTarget(preferredTarget) ||
      !canMeleeReach(game.player,preferredTarget)
    )
  ){
    return false;
  }

  exitAimMode(false);

  const p=game.player;
  p.sweepUsedThisRound=true;
  sweepInProgress=true;

  const maxSweepAttacks=p.level;
  let attacksMade=0;
  let sweepInterruptedByCriticalMiss=false;
  const attackedOnce=new Set();

  ui.turnBanner.textContent=
    `${p.name} sweeps with ${p.weapon || p.weaponBaseName || "weapon"}`;

  log(
    `${p.name} automatically Sweeps with ${p.weaponBaseName || p.weapon} `+
    `using its Slashing (S) attack: up to ${maxSweepAttacks} attacks.`,
    "good"
  );

  try{
    while(
      attacksMade<maxSweepAttacks &&
      !game.over &&
      p.alive
    ){
      const eligible=adjacentSweepTargets();

      if(!eligible.length){
        break;
      }

      let target=null;

      if(
        attacksMade===0 &&
        preferredTarget &&
        eligible.includes(preferredTarget)
      ){
        target=preferredTarget;
      }

      if(!target){
        target=eligible.find(unit=>!attackedOnce.has(unit.id));
      }

      if(!target){
        attackedOnce.clear();
        target=eligible[0];
      }

      if(!target) break;

      attackedOnce.add(target.id);

      const dx=target.x-p.x;
      const dy=target.y-p.y;
      updateFacingForStep(p,dx,dy);

      const result=await attack(p,target);
      attacksMade++;

      updateUi();
      draw();

      if(game.over) break;

      if(result?.criticalMiss){
        sweepInterruptedByCriticalMiss=true;
        await waitForCombatActionPause();
        log(`${p.name}'s Sweep is interrupted immediately by the critical miss.`,"bad");
        break;
      }

      if(result?.hit){
        await waitForCombatActionPause();
      }else{
        await sleep(145);
      }
    }

    p.attacksRemaining=0;

    log(
      sweepInterruptedByCriticalMiss
        ? `${p.name}'s automatic Sweep ends after ${attacksMade} attack${attacksMade===1?"":"s"}.`
        : `${p.name} completes the automatic Sweep after ${attacksMade} attack${attacksMade===1?"":"s"}.`,
      sweepInterruptedByCriticalMiss ? "bad" : "system"
    );
  }finally{
    sweepInProgress=false;
  }

  updateUi();
  draw();

  if(!game.over){
    endTurn();
  }

  return true;
}

function resolveMeleePerception(attacker,defender,options={}){
  if(
    attacker &&
    defender &&
    attacker.faction!==defender.faction &&
    r222IsAutomatedAttacker(attacker) &&
    !r222UnitCurrentlyVisible(
      attacker,
      defender
    )
  ){
    log(
      `${attacker.name} cannot visually acquire ${defender.name} through the obscuration.`,
      "system"
    );

    return {
      hit:false,
      killed:false,
      damage:0,
      blockedByPerception:true
    };
  }

  return resolveMeleeHit(
    attacker,
    defender,
    options
  );
}

function resolveMeleeSlow(attacker,defender,options={}){
  if(r226SlowAttackBlocked(attacker)){
    setCombatMessage(`${attacker.name} is Slowed and cannot make another attack this round.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    log(`${attacker.name}'s Slow effect suppresses the attack.`,"system");
    return {hit:false,killed:false,damage:0,blockedBySlow:true};
  }

  const result=resolveMeleePerception(attacker,defender,options);
  if(getUnitEffect(attacker,"slow") && !result?.blockedBySlow){
    getUnitEffect(attacker,"slow").data.attackUsedRound=game.round;
  }
  return result;
}

function resolveMeleeSound(
  attacker,
  defender,
  options={}
){
  const baseMissSound=
    playMissSound;

  /*
    The generic attack() path is the adjacent physical/melee attack path.
    Longbow, sling, projectile spell and other ranged resolvers use their own
    attack functions and therefore retain the established ranged miss sound.
  */
  const adjacentPhysicalAttack=
    !!(
      attacker?.alive &&
      defender?.alive &&
      attacker.weaponInHand!=="ranged" &&
      canMeleeReach(
        attacker,
        defender
      )
    );

  if(adjacentPhysicalAttack){
    playMissSound=
      playDqkMeleeMissSound;
  }

  try{
    return resolveMeleeSlow(
      attacker,
      defender,
      options
    );
  }finally{
    playMissSound=
      baseMissSound;
  }
}

async function attack(attacker,defender,options={}){
  return window.AdventurePartyCombatResults.physical(resolveMeleeSound,attacker,defender,options);
}
