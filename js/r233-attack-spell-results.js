/*
  R233 — ATTACK-ROLL SPELL RESULT PACING
  ======================================
  Attack-roll spells keep the camera on the target long enough for a MISS,
  Mirror Image interception, or damage result to be understood before combat
  advances.
*/


castMelfsAcidArrowSpell=async function(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("melfs-acid-arrow");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,false)){
    setCombatMessage("Melf's Acid Arrow requires a hostile creature within range.");
    return false;
  }

  if(projectilePathBlocked(caster,target)){
    setCombatMessage("The Acid Arrow does not have a clear firing lane.");
    return false;
  }

  spellCastInProgress=true;

  if(!commitSpellCast(caster,spell,action)){
    return await finishFailedSpellCommit(caster,action);
  }

  pendingAimAction=null;
  exitAimMode(false,false);
  setUnitActionBanner(caster,"Casting Melf's Acid Arrow");

  const rawRoll=d(20);
  const fighterThaco=Math.max(1,21-level);
  const targetAC=effectiveArmorClassForAttack(
    caster,
    target,
    "small-device-missile"
  );
  const targetNumber=fighterThaco-targetAC;
  const modifier=attackEffectModifier(caster,target);
  const resolution=resolveMissileAttackD20(
    rawRoll,
    targetNumber,
    modifier
  );

  playNaturalAttackRollSound(rawRoll);

  setLastRoll(
    "Melf's Acid Arrow: RAW d20 "+
    rawRoll+
    (
      resolution.automatic
        ? " — "+resolution.automatic
        : " "+formatSignedAdjustment(modifier)+
          " = "+resolution.modifiedRoll+
          " vs "+targetNumber
    )
  );

  await r233FocusTarget(target);

  await animateElementalArrowProjectile(
    caster,
    target,
    "acid-arrow",
    0,
    1
  );

  if(!resolution.hit){
    await r233PresentMiss(
      caster,
      target,
      "Melf's Acid Arrow",
      resolution.automatic ||
      (
        "d20 "+
        rawRoll+
        " → "+
        resolution.modifiedRoll+
        " vs "+
        targetNumber
      )
    );

    finishTestSpellCast(
      caster,
      spell.name,
      action
    );
    return true;
  }

  if(interceptWithMirrorImage(target,caster)){
    playMissSound();

    await r233FocusTarget(target);

    setCombatMessage(
      target.name+
      "'s Mirror Image absorbs Melf's Acid Arrow.",
      R233_RESULT_HOLD_MS,
      R233_RESULT_HOLD_MS
    );

    await waitForCombatActionPause();

    finishTestSpellCast(
      caster,
      spell.name,
      action
    );
    return true;
  }

  const damage=
    rollDiceExpression("2d4").total;

  const result=
    await r233ApplySpellDamageBeat(
      caster,
      target,
      damage,
      "Melf's Acid Arrow",
      "acid"
    );

  const remainingTicks=
    Math.floor(level/3);

  if(
    !result.killed &&
    remainingTicks>0
  ){
    addUnitEffect(target,{
      id:"acid-arrow",
      name:"Splashed with Acid",
      kind:"debuff",
      expiresRound:
        game.round+
        remainingTicks+
        1,
      detail:
        "2d4 acid each later round; "+
        remainingTicks+
        " follow-on round"+
        (remainingTicks===1 ? "" : "s")+
        " remaining",
      data:{
        sourceUnitId:caster.id,
        casterLevel:level,
        appliedRound:game.round,
        nextTickRound:game.round+1,
        remainingTicks
      }
    });

    await animateMagicEffectOnUnits(
      [target],
      "acid"
    );
  }

  finishTestSpellCast(
    caster,
    spell.name,
    action
  );
  return true;
};


castShockingGraspSpell=async function(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("shocking-grasp");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;
  const hand=getUnitEffect(caster,"spectral-hand");
  const adjacent=!!target && canMeleeReach(caster,target);
  const handRange=Math.max(0,Number(hand?.data?.rangeHexes)||0);

  const throughHand=
    !!hand &&
    !!target &&
    unitDistance(caster,target)<=handRange &&
    !lineOfSightBlocked(caster,target);

  if(
    !target ||
    target.faction===caster.faction ||
    !target.alive ||
    (!adjacent && !throughHand)
  ){
    setCombatMessage(
      hand
        ? "Shocking Grasp requires a hostile creature within Spectral Hand range ("+handRange+" hexes)."
        : "Shocking Grasp requires an adjacent hostile creature."
    );
    return false;
  }

  spellCastInProgress=true;

  if(!commitSpellCast(caster,spell,action)){
    return await finishFailedSpellCommit(caster,action);
  }

  pendingAimAction=null;
  exitAimMode(false,false);

  const position=attackPositionData(caster,target);

  faceEntityToward(caster,target);

  setUnitActionBanner(
    caster,
    throughHand && !adjacent
      ? "Spectral Hand delivers Shocking Grasp"
      : "Casting Shocking Grasp — "+position.label
  );

  await r233FocusTarget(target);

  const rawRoll=d(20);
  const attackBonus=
    attackEffectModifier(caster,target)+
    (throughHand && !adjacent ? 2 : 0);

  const targetAC=
    effectiveArmorClassForAttack(
      caster,
      target,
      "melee"
    );

  const targetNumber=
    caster.thaco-targetAC;

  const resolution=
    resolveMeleeAttackD20(
      rawRoll,
      targetNumber,
      attackBonus
    );

  playNaturalAttackRollSound(rawRoll);

  setLastRoll(
    "Shocking Grasp: RAW d20 "+
    rawRoll+
    (
      resolution.automatic
        ? " — "+resolution.automatic
        : " "+formatSignedAdjustment(attackBonus)+
          " = "+resolution.modifiedRoll+
          " vs "+targetNumber
    )
  );

  if(!resolution.hit){
    if(rawRoll===1){
      setCriticalRollNotification(
        caster,
        target,
        rawRoll
      );
    }

    await r233PresentMiss(
      caster,
      target,
      "Shocking Grasp",
      resolution.automatic ||
      (
        "d20 "+
        rawRoll+
        " → "+
        resolution.modifiedRoll+
        " vs "+
        targetNumber
      )
    );

    finishTestSpellCast(
      caster,
      spell.name,
      action
    );
    return true;
  }

  /*
    Candidate Rev 31:
    a successful Shocking Grasp touch discharges before damage resolution.
    Mirror Image can still absorb the attack, but the electrical contact is
    visible/audible at the struck image's battlefield position.
  */
  if(
    window.AdventurePartyShockingGraspFx?.play
  ){
    await window.AdventurePartyShockingGraspFx.play(
      caster,
      target,
      {throughHand}
    );
  }else{
    playMagicEffectSound("lightning");
  }

  if(interceptWithMirrorImage(target,caster)){
    playMissSound();

    setCombatMessage(
      target.name+
      "'s Mirror Image absorbs Shocking Grasp.",
      R233_RESULT_HOLD_MS,
      R233_RESULT_HOLD_MS
    );

    await waitForCombatActionPause();

    finishTestSpellCast(
      caster,
      spell.name,
      action
    );
    return true;
  }

  const damage=d(8)+level;

  const result=
    await r233ApplySpellDamageBeat(
      caster,
      target,
      damage,
      "Shocking Grasp",
      "electricity"
    );

  if(rawRoll===20 && !result.killed){
    setCriticalRollNotification(
      caster,
      target,
      rawRoll,
      damage,
      false
    );
  }

  finishTestSpellCast(
    caster,
    spell.name,
    action
  );
  return true;
};


r226CastVampiricTouch=async function(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("vampiric-touch");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(
    !target?.alive ||
    target.faction===caster.faction ||
    !canMeleeReach(caster,target)
  ){
    setCombatMessage(
      "Vampiric Touch requires an adjacent hostile creature."
    );
    return false;
  }

  spellCastInProgress=true;

  if(!commitSpellCast(caster,spell,action)){
    return await finishFailedSpellCommit(caster,action);
  }

  pendingAimAction=null;
  exitAimMode(false,false);

  setUnitActionBanner(
    caster,
    "Vampiric Touch"
  );

  await r233FocusTarget(target);

  if(isUndeadUnit(target)){
    setCombatMessage(
      target.name+
      " is undead and unaffected by Vampiric Touch.",
      R233_RESULT_HOLD_MS,
      R233_RESULT_HOLD_MS
    );

    await waitForCombatActionPause();

    finishTestSpellCast(
      caster,
      spell.name,
      action
    );
    return true;
  }

  const attackRoll=
    r226SpellTouchAttack(
      caster,
      target,
      0
    );

  if(!attackRoll.hit){
    await r233PresentMiss(
      caster,
      target,
      "Vampiric Touch",
      attackRoll.automatic ||
      (
        "d20 "+
        attackRoll.raw+
        " vs target "+
        attackRoll.targetNumber
      )
    );

    finishTestSpellCast(
      caster,
      spell.name,
      action
    );
    return true;
  }

  const dice=
    Math.min(
      6,
      Math.max(
        1,
        Math.floor(level/2)
      )
    );

  const damage=
    rollDiceExpression(
      dice+"d6"
    ).total;

  const result=
    await r233ApplySpellDamageBeat(
      caster,
      target,
      damage,
      "Vampiric Touch",
      "magic"
    );

  const before=caster.hp;
  caster.hp+=damage;

  const temp=
    Math.max(
      0,
      caster.hp-
      (caster.maxHp||caster.hp)
    );

  if(temp>0){
    addUnitEffect(caster,{
      id:"vampiric-vitality",
      name:"Vampiric Vitality",
      kind:"buff",
      expiresRound:null,
      detail:
        temp+
        " temporary hit point"+
        (temp===1 ? "" : "s")+
        " above normal maximum",
      data:{
        sourceUnitId:caster.id,
        casterLevel:level,
        tempHp:temp
      }
    });
  }

  playAttackSound();

  await r233FocusTarget(caster);

  setCombatMessage(
    caster.name+
    " drains "+
    damage+
    " hit points from "+
    target.name+
    " and rises from "+
    before+
    " to "+
    caster.hp+
    " HP.",
    R233_RESULT_HOLD_MS,
    R233_RESULT_HOLD_MS
  );

  await animateMagicEffectOnUnits(
    [caster],
    "vampiric"
  );

  await waitForCombatActionPause();

  if(result.killed){
    await waitForCombatActionPause();
  }

  finishTestSpellCast(
    caster,
    spell.name,
    action
  );
  return true;
};


r226CastFlameArrow=async function(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("flame-arrow");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,false)){
    setCombatMessage(
      "Flame Arrow requires a hostile creature within range."
    );
    return false;
  }

  if(projectilePathBlocked(caster,target)){
    setCombatMessage(
      "Flame Arrow does not have a clear firing lane."
    );
    return false;
  }

  spellCastInProgress=true;

  if(!commitSpellCast(caster,spell,action)){
    return await finishFailedSpellCommit(caster,action);
  }

  pendingAimAction=null;
  exitAimMode(false,false);

  setUnitActionBanner(
    caster,
    "Casting Flame Arrow"
  );

  const bolts=
    Math.max(
      1,
      Math.floor(level/5)
    );

  let hits=0;
  let misses=0;
  let imageHits=0;
  let totalDamage=0;

  for(let index=0;index<bolts;index++){
    if(!target?.alive) break;

    const raw=d(20);
    const thaco=Math.max(1,21-Math.ceil(level/3));
    const targetAC=effectiveArmorClassForAttack(
      caster,
      target,
      "small-device-missile"
    );
    const targetNumber=thaco-targetAC;
    const modifier=attackEffectModifier(caster,target);
    const resolution=resolveMissileAttackD20(
      raw,
      targetNumber,
      modifier
    );

    playNaturalAttackRollSound(raw);

    await r233FocusTarget(target);

    await animateElementalArrowProjectile(
      caster,
      target,
      "flame-arrow",
      index,
      bolts
    );

    if(!resolution.hit){
      misses++;

      await r233PresentMiss(
        caster,
        target,
        "Flame Arrow bolt "+(index+1),
        resolution.automatic ||
        (
          "d20 "+
          raw+
          " → "+
          resolution.modifiedRoll+
          " vs "+
          targetNumber
        )
      );

      continue;
    }

    if(interceptWithMirrorImage(target,caster)){
      imageHits++;
      playMissSound();

      setCombatMessage(
        target.name+
        "'s Mirror Image absorbs Flame Arrow bolt "+
        (index+1)+
        ".",
        R233_RESULT_HOLD_MS,
        R233_RESULT_HOLD_MS
      );

      await waitForCombatActionPause();
      continue;
    }

    hits++;

    const piercing=d(6);
    const fireRoll=
      rollDiceExpression("4d6").total;

    const save=
      rollSpellSave(
        target,
        caster
      );

    const fire=
      unitImmuneToDamageType(
        target,
        "fire"
      )
        ? 0
        : (
            save.success
              ? Math.floor(fireRoll/2)
              : fireRoll
          );

    const damage=
      piercing+fire;

    totalDamage+=damage;

    const result=
      await r233ApplySpellDamageBeat(
        caster,
        target,
        damage,
        "Flame Arrow bolt "+(index+1),
        "magic"
      );

    if(fire>0){
      registerElementalDamageFx(
        target,
        "fire",
        fire
      );
    }

    playAttackSound();

    if(result.killed){
      break;
    }
  }

  log(
    "Flame Arrow resolves "+bolts+
    " bolt"+(bolts===1 ? "" : "s")+
    ": "+hits+" hit, "+
    misses+" miss, "+
    imageHits+" image hit, "+
    totalDamage+" total damage.",
    "system"
  );

  finishTestSpellCast(
    caster,
    spell.name,
    action
  );

  return true;
};
