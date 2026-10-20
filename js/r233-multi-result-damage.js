/*
  R233 — MULTI-RESULT SPELL DAMAGE
  =================================
  Multi-hit / multi-target direct spells present each result as a distinct
  camera/message beat instead of collapsing the combat feedback into one line.
*/


castMagicMissileFromScroll=async function(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry(action?.spellId);

  if(
    !caster ||
    !spell ||
    !target ||
    !target.alive ||
    target.faction===caster.faction
  ){
    setCombatMessage(
      "Magic Missile requires a living hostile creature."
    );
    return false;
  }

  if(lineOfSightBlocked(caster,target)){
    setCombatMessage(
      "Line of sight is blocked to that target."
    );
    return false;
  }

  const shield=getUnitEffect(target,"shield");

  if(shield){
    spellCastInProgress=true;

    if(!commitSpellCast(caster,spell,action)){
      return await finishFailedSpellCommit(caster,action);
    }

    pendingAimAction=null;
    exitAimMode(false,false);

    setUnitActionBanner(
      caster,
      "Casting Magic Missile"
    );

    await r233FocusTarget(target);

    setCombatMessage(
      target.name+
      "'s Shield negates Magic Missile.",
      R233_RESULT_HOLD_MS,
      R233_RESULT_HOLD_MS
    );

    log(
      target.name+
      "'s Shield spell totally negates Magic Missile.",
      "system"
    );

    if(action.itemName){
      removeOneInventoryItem(
        caster,
        action.itemName
      );
    }

    await waitForCombatActionPause();

    finishTestSpellCast(
      caster,
      spell.name,
      action
    );

    return true;
  }

  const casterLevel=
    Math.max(
      1,
      action.casterLevel||6
    );

  const rangeYards=
    magicMissileRangeYards(
      casterLevel
    );

  const rangeHexes=
    yardsToTacticalHexes(
      rangeYards
    );

  const distance=
    unitDistance(
      caster,
      target
    );

  if(distance>rangeHexes){
    setCombatMessage(
      target.name+
      " is out of Magic Missile range ("+
      rangeHexes+
      " hexes)."
    );
    return false;
  }

  const missileCount=
    magicMissileCountForCasterLevel(
      casterLevel
    );

  spellCastInProgress=true;

  if(!commitSpellCast(caster,spell,action)){
    return await finishFailedSpellCommit(caster,action);
  }

  pendingAimAction=null;
  exitAimMode(false,false);
  updateUi();

  setUnitActionBanner(
    caster,
    "Casting Magic Missile"
  );

  playAttackSound();

  const damageRolls=[];
  let imageHits=0;

  /*
    Keep the victim technically alive until the entire magical volley has
    resolved. This preserves the simultaneous-volley rule while still showing
    every missile's damage as a separate readable beat.
  */
  const aliveAtVolleyStart=target.alive;

  for(let index=0;index<missileCount;index++){
    await animateMagicMissile(
      caster,
      target,
      index,
      missileCount
    );

    playMagicMissileHitSound(index);

    if(interceptWithMirrorImage(target,caster)){
      imageHits++;
      damageRolls.push(0);
      playMissSound();

      setCombatMessage(
        "Magic Missile "+
        (index+1)+
        " strikes one of "+
        target.name+
        "'s Mirror Images.",
        R233_RESULT_HOLD_MS,
        R233_RESULT_HOLD_MS
      );

      await waitForCombatActionPause();
      continue;
    }

    const damage=
      rollDiceExpression(
        spell.missileDamage
      ).total;

    damageRolls.push(damage);

    await r233FocusTarget(target);

    target.hp=
      Math.max(
        0,
        target.hp-damage
      );

    onUnitDamaged(
      target,
      damage
    );

    setCombatMessage(
      "Magic Missile "+
      (index+1)+
      " damages "+
      target.name+
      " for "+
      damage+
      " damage.",
      R233_RESULT_HOLD_MS,
      R233_RESULT_HOLD_MS,
      target.id==="player"
        ? "player-damage"
        : "normal"
    );

    log(
      "Magic Missile "+
      (index+1)+
      "/"+
      missileCount+
      " deals "+
      damage+
      " damage to "+
      target.name+
      ".",
      "system"
    );

    updateUi();
    draw();

    await waitForCombatActionPause();
  }

  if(action.itemName){
    removeOneInventoryItem(
      caster,
      action.itemName
    );
  }

  const totalDamage=
    damageRolls.reduce(
      (sum,value)=>sum+value,
      0
    );

  if(
    aliveAtVolleyStart &&
    target.hp<=0 &&
    target.alive
  ){
    target.alive=false;

    setCombatMessage(
      target.name+
      " goes down and is dying — Magic Missile",
      R233_RESULT_HOLD_MS,
      R233_RESULT_HOLD_MS,
      target.id==="player"
        ? "player-damage"
        : "normal"
    );

    playAgonySound(target);
    playDeathSound(target);
    triggerDeathFx(target);

    if(target.controller==="mob"){
      markEnemyNeutralized(target);
    }

    if(
      isKoboldUnit(target) &&
      activeEnemies().length>0
    ){
      scheduleKoboldGroupMoraleCheck({
        casualties:1,
        magicCasualties:1,
        source:"Magic Missile"
      });
    }

    await waitForCombatActionPause();
  }

  log(
    caster.name+
    " resolves "+
    missileCount+
    " Magic Missiles against "+
    target.name+
    ": "+
    damageRolls.join(" + ")+
    " = "+
    totalDamage+
    " damage; "+
    imageHits+
    " Mirror Image hit"+
    (imageHits===1 ? "" : "s")+
    ".",
    "good"
  );

  finishTestSpellCast(
    caster,
    spell.name,
    action
  );

  return true;
};


castFireballFromScroll=async function(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry(action?.spellId);

  if(!caster || !spell || !targetHex){
    return false;
  }

  const casterLevel=
    Math.max(
      1,
      action.casterLevel||6
    );

  if(lineOfSightBlocked(caster,targetHex)){
    setCombatMessage(
      "Line of sight is blocked to the Fireball blast point."
    );
    return false;
  }

  const rangeYards=
    fireballRangeYards(
      casterLevel
    );

  const rangeHexes=
    yardsToTacticalHexes(
      rangeYards
    );

  const distance=
    hexDistance(
      caster,
      targetHex
    );

  if(distance>rangeHexes){
    setCombatMessage(
      "That blast point is out of Fireball range ("+
      rangeHexes+
      " hexes)."
    );
    return false;
  }

  const radiusHexes=
    fireballRadiusHexes();

  const blastCells=
    fireballBlastCells(
      targetHex
    );

  burnWebCells(
    blastCells,
    "Fireball"
  );

  const affected=
    livingUnitsInAreaCells(
      blastCells
    );

  const friendlyTargets=
    affected.filter(
      unit=>
        unit.faction===caster.faction
    );

  spellCastInProgress=true;

  if(!commitSpellCast(
    caster,
    getSpellEntry(action?.spellId),
    action
  )){
    return await finishFailedSpellCommit(
      caster,
      action
    );
  }

  pendingAimAction=null;
  exitAimMode(false,false);
  updateUi();

  setUnitActionBanner(
    caster,
    "Casting Fireball"
  );

  /*
    R233's projectile wrapper moves the camera to the blast point before the
    fireball enters the target view.
  */
  await animateFireballProjectile(
    caster,
    targetHex
  );

  const damageDice=
    fireballDamageDiceForCasterLevel(
      casterLevel
    );

  const rolledDamage=
    rollDiceExpression(
      damageDice+"d6"
    ).total;

  if(action.itemName){
    removeOneInventoryItem(
      caster,
      action.itemName
    );
  }

  /*
    Fireball remains mechanically simultaneous: every saving throw and HP
    change is determined before any individual presentation card. We then
    walk the already-resolved results one creature at a time for readability.
  */
  const results=
    affected.map(unit=>{
      const immune=
        unitImmuneToDamageType(
          unit,
          "fire"
        );

      const save=
        immune
          ? null
          : r233BaseRollSpellSave(
              unit,
              caster
            );

      const damage=
        immune
          ? 0
          : save.success
            ? Math.floor(rolledDamage/2)
            : rolledDamage;

      return {
        unit,
        immune,
        save,
        damage,
        killed:false
      };
    });

  for(const result of results){
    if(result.damage<=0) continue;

    result.unit.hp=
      Math.max(
        0,
        result.unit.hp-result.damage
      );

    onUnitDamaged(
      result.unit,
      result.damage
    );

    registerElementalDamageFx(
      result.unit,
      "fire",
      result.damage
    );

    result.killed=
      result.unit.hp<=0;
  }

  updateUi();
  draw();

  playFireballExplosionSound();

  await animateFireballExplosion(
    targetHex,
    radiusHexes,
    blastCells
  );

  let koboldCasualties=0;

  for(const result of results){
    const unit=result.unit;

    await r233FocusTarget(unit);

    if(result.immune){
      setCombatMessage(
        unit.name+
        " is immune to Fireball and takes no damage.",
        R233_RESULT_HOLD_MS,
        R233_RESULT_HOLD_MS
      );

      log(
        unit.name+
        " is immune to fire and takes no Fireball damage.",
        "system"
      );

      await waitForCombatActionPause();
      continue;
    }

    await showAreaEffectUnitResolution({
      unit,
      sourceName:"Fireball",
      damage:result.damage,
      secondaryEffects:[
        "SAVE "+
        result.save.modifiedRoll+
        " vs "+
        result.save.targetNumber+
        ": "+
        (
          result.save.success
            ? "SUCCESS — HALF DAMAGE"
            : "FAILED — FULL DAMAGE"
        )
      ],
      killed:result.killed,
      damageIcon:"fireball"
    });

    log(
      unit.name+
      ": save vs. spell "+
      result.save.modifiedRoll+
      " vs "+
      result.save.targetNumber+
      " — "+
      (
        result.save.success
          ? "success, half damage"
          : "failure, full damage"
      )+
      "; "+
      result.damage+
      " damage.",
      result.save.success
        ? "system"
        : "bad"
    );

    if(
      result.killed &&
      unit.alive
    ){
      unit.alive=false;

      playAgonySound(unit);
      playDeathSound(unit);
      triggerDeathFx(unit);

      if(unit.controller==="mob"){
        markEnemyNeutralized(unit);

        if(isKoboldUnit(unit)){
          koboldCasualties++;
        }
      }

      updateUi();
      draw();
    }
  }

  if(
    koboldCasualties>0 &&
    activeEnemies().length>0
  ){
    const moraleScheduled=
      scheduleKoboldGroupMoraleCheck(
        {
          casualties:koboldCasualties,
          magicCasualties:koboldCasualties,
          source:"Fireball"
        },
        0
      );

    if(moraleScheduled){
      await waitForCombatActionPause();
    }
  }

  log(
    caster.name+
    " casts Fireball at "+
    targetHex.x+
    ","+
    targetHex.y+
    ": "+
    damageDice+
    "d6 = "+
    rolledDamage+
    " before saves; "+
    affected.length+
    " creature"+
    (affected.length===1 ? "" : "s")+
    " affected"+
    (
      friendlyTargets.length
        ? "; FRIENDLY FIRE "+friendlyTargets.length
        : ""
    )+
    ".",
    friendlyTargets.length
      ? "bad"
      : "good"
  );

  finishTestSpellCast(
    caster,
    spell.name,
    action
  );

  return true;
};
