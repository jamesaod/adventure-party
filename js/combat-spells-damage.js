/* Combat owner: combat-spells-damage.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

async function castMagicMissileFromScroll(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry(action?.spellId);

  if(!caster || !spell || !target || !target.alive || target.faction===caster.faction){
    setCombatMessage("Magic Missile requires a living hostile creature.");
    return false;
  }

  if(lineOfSightBlocked(caster,target)){
    setCombatMessage("Line of sight is blocked to that target.");
    return false;
  }

  const shield=getUnitEffect(target,"shield");

  if(shield){
    spellCastInProgress=true;
    if(!commitSpellCast(caster,spell,action,1800,target)){ return await finishFailedSpellCommit(caster,action); }
    pendingAimAction=null;
    exitAimMode(false,false);

    setUnitActionBanner(caster,"Casting Magic Missile");
    setCombatMessage(`${target.name}'s Shield negates Magic Missile.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    log(`${target.name}'s Shield spell totally negates Magic Missile.`,"system");

    if(action.itemName){
      removeOneInventoryItem(caster,action.itemName);
    }

    await waitForCombatActionPause();
    spellCastInProgress=false;

    if(!game.over){
      endTurn();
    }

    return true;
  }

  const casterLevel=Math.max(1,action.casterLevel||6);
  const rangeYards=magicMissileRangeYards(casterLevel);
  const rangeHexes=yardsToTacticalHexes(rangeYards);
  const distance=unitDistance(caster,target);

  if(distance>rangeHexes){
    setCombatMessage(`${target.name} is out of Magic Missile range (${rangeHexes} hexes).`);
    return false;
  }

  const missileCount=magicMissileCountForCasterLevel(casterLevel);
  const damageRolls=[];
  let imageHits=0;

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action,1800,target)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);
  updateUi();

  await focusRangedAttacker(caster);
  setUnitActionBanner(caster,"Casting Magic Missile");
  playAttackSound();

  for(let i=0;i<missileCount;i++){
    await animateMagicMissile(caster,target,i,missileCount);
    playMagicMissileHitSound(i);

    if(interceptWithMirrorImage(target,caster)){
      imageHits++;
      damageRolls.push(0);
    }else{
      damageRolls.push(rollDiceExpression(spell.missileDamage).total);
    }

    await sleep(90);
  }

  const totalDamage=damageRolls.reduce((sum,value)=>sum+value,0);

  if(totalDamage>0){
    target.hp=Math.max(0,target.hp-totalDamage);
    onUnitDamaged(target,totalDamage);
    await focusDamagedTargetIfOffscreen(target);
  }

  if(action.itemName){
    removeOneInventoryItem(caster,action.itemName);
  }

  setCombatMessage(
    totalDamage>0
      ? `${caster.name} damages ${target.name} for ${totalDamage} damage`+
        (imageHits ? `; ${imageHits} missile${imageHits===1 ? "" : "s"} hit images` : "")
      : `Mirror Images absorb all ${missileCount} Magic Missiles.`,
    COMBAT_MESSAGE_MIN_HOLD_MS
  );

  log(
    `${caster.name} uses ${action.itemName || spell.name}: ${missileCount} Magic Missiles `+
    `(${damageRolls.join(" + ")}) resolve against ${target.name}; ${imageHits} image hit${imageHits===1 ? "" : "s"}.`,
    "good"
  );

  if(target.hp<=0 && target.alive){
    target.alive=false;
    setCombatMessage(`${target.name} goes down and is dying`,COMBAT_MESSAGE_MIN_HOLD_MS);
    playAgonySound(target);
    playDeathSound(target);
    triggerDeathFx(target);
    markEnemyNeutralized(target);

    if(isKoboldUnit(target) && activeEnemies().length>0){
      scheduleKoboldGroupMoraleCheck({
        casualties:1,
        magicCasualties:1,
        source:"Magic Missile"
      });
    }

    log(`${target.name} is brought down by Magic Missile.`,"good");
    checkCombatVictory();
  }

  spellCastInProgress=false;
  updateUi();
  draw();
  await waitForCombatActionPause();

  if(!game.over){
    endTurn();
  }

  return true;
}

async function castFireballFromScroll(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry(action?.spellId);

  if(!caster || !spell || !targetHex){
    return false;
  }

  const casterLevel=Math.max(1,action.casterLevel||6);

  if(lineOfSightBlocked(caster,targetHex)){
    setCombatMessage("Line of sight is blocked to the Fireball blast point.");
    return false;
  }

  const rangeYards=fireballRangeYards(casterLevel);
  const rangeHexes=yardsToTacticalHexes(rangeYards);
  const distance=hexDistance(caster,targetHex);

  if(distance>rangeHexes){
    setCombatMessage(
      `That blast point is out of Fireball range (${rangeHexes} hexes).`
    );
    return false;
  }

  const radiusHexes=fireballRadiusHexes();
  const blastCells=fireballBlastCells(targetHex);
  burnWebCells(blastCells,"Fireball");
  const affected=livingUnitsInAreaCells(blastCells);
  const friendlyTargets=affected.filter(unit=>unit.faction===caster.faction);

  spellCastInProgress=true;
  if(!commitSpellCast(caster,getSpellEntry(action?.spellId),action,1800,targetHex)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);
  updateUi();

  setUnitActionBanner(caster,"Casting Fireball");

  /*
    R138: Fireball belongs visually to its destination. Center the camera on
    the selected blast hex before any Fireball projectile/explosion VFX begins.
  */
  centerCameraOn(targetHex);
  draw();
  await sleep(160);

  /* Small fiery projectile from caster to selected blast hex. */
  await animateFireballProjectile(caster,targetHex);

  const damageDice=fireballDamageDiceForCasterLevel(casterLevel);
  const rolledDamage=rollDiceExpression(`${damageDice}d6`).total;

  if(action.itemName){
    removeOneInventoryItem(caster,action.itemName);
  }

  /*
    Roll every save first, then apply every HP change in one batch. This is
    the R93 simultaneous-AoE rule: no victim waits for the previous victim's
    damage message or icon before taking the same Fireball blast.
  */
  const results=affected.map(unit=>{
    const immune=unitImmuneToDamageType(unit,"fire");
    const saveTarget=immune ? null : spellSaveTargetForUnit(unit);
    const saveRoll=immune ? null : d(20);
    const saved=!immune && saveRoll>=saveTarget;
    const damage=immune
      ? 0
      : saved
        ? Math.floor(rolledDamage/2)
        : rolledDamage;

    return {unit,immune,saveTarget,saveRoll,saved,damage};
  });

  for(const result of results){
    const {unit,damage}=result;
    if(damage<=0) continue;
    unit.hp=Math.max(0,unit.hp-damage);
    onUnitDamaged(unit,damage);
    registerElementalDamageFx(unit,"fire",damage);
  }

  updateUi();
  draw();

  log(
    `${caster.name} uses ${action.itemName || "Fireball"}: Fireball detonates at hex `+
    `${targetHex.x},${targetHex.y}; ${damageDice}d6 = ${rolledDamage} damage before saves; `+
    `${affected.length} creature${affected.length===1 ? "" : "s"} caught in the blast; `+
    `${blastCells.length} tactical hex-volumes filled`+
    `${fireballHexEnvironment(targetHex)==="indoor" ? ` (${blastCells.filter(cell=>cell.volumeEnvironment==="indoor").length} indoor, ${blastCells.filter(cell=>cell.volumeEnvironment==="outdoor").length} outdoor after 19/33 conversion)` : ""}.`+
    `${friendlyTargets.length ? ` FRIENDLY FIRE: ${friendlyTargets.length} friendly unit${friendlyTargets.length===1 ? "" : "s"} in blast.` : ""}`,
    friendlyTargets.length ? "bad" : "good"
  );

  for(const result of results){
    const {unit,immune,saveTarget,saveRoll,saved,damage}=result;

    if(immune){
      log(
        unit.name+" is immune to fire and takes no Fireball damage.",
        "system"
      );
      continue;
    }

    log(
      unit.name+": save vs. spell "+saveRoll+" vs "+saveTarget+" — "+
      (saved ? "success, half damage" : "failure, full damage")+
      "; "+damage+" damage.",
      saved ? "system" : "bad"
    );
  }

  setCombatMessage(
    affected.length
      ? `FIREBALL ERUPTS — ${affected.length} TARGET${affected.length===1 ? "" : "S"} TAKE DAMAGE`
      : "FIREBALL ERUPTS — NO CREATURES CAUGHT IN THE BLAST",
    900,
    900,
    friendlyTargets.length ? "player-damage" : "normal"
  );

  /* One impact sound and one expanding fire sphere for the whole blast. */
  playFireballExplosionSound();
  await animateFireballExplosion(targetHex,radiusHexes,blastCells);

  let koboldCasualties=0;
  const killedResults=results.filter(result=>result.unit.hp<=0);

  /*
    Damage happened simultaneously above. Death feedback still honors the
    existing per-death combat beat so skull/agony feedback is not lost.
  */
  for(const result of killedResults){
    const unit=result.unit;
    unit.alive=false;

    if(unit.controller==="mob"){
      markEnemyNeutralized(unit);
      if(isKoboldUnit(unit)) koboldCasualties++;
    }

    log(`${unit.name} goes down and is dying from the Fireball.`,"bad");
    playAgonySound(unit);
    playDeathSound(unit);
    triggerDeathFx(unit);
    updateUi();
    draw();
    await waitForDeathActionPause();
  }

  if(koboldCasualties>0 && activeEnemies().length>0){
    const moraleScheduled=scheduleKoboldGroupMoraleCheck(
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

  /*
    Current battlefield has no walls/doors/solid obstacles, so the PHB rule
    for early detonation against an intervening barrier is preserved as
    spell metadata but has no tactical obstacle to resolve yet.
  */

  spellCastInProgress=false;
  updateUi();
  draw();

  const victory=checkCombatVictory();
  const defeat=checkPartyDefeat();

  if(!victory && !defeat){
    await waitForCombatActionPause();
    if(!game.over) endTurn();
  }

  return true;
}

async function resolveAoeDamageSpell({
  caster,
  spellName,
  targets,
  damage,
  saveForHalf=true,
  magicCasualtySource=spellName,
  damageType=null
}){
  let koboldCasualties=0;

  for(const unit of targets){
    const save=saveForHalf
      ? rollSpellSave(unit,caster)
      : null;

    const actualDamage=save?.success
      ? Math.floor(damage/2)
      : damage;

    unit.hp=Math.max(0,unit.hp-actualDamage);
    onUnitDamaged(unit,actualDamage);
    registerElementalDamageFx(unit,damageType,actualDamage);

    await showAreaEffectUnitResolution({
      unit,
      sourceName:spellName,
      damage:actualDamage,
      secondaryEffects:save
        ? [
            `SAVE ${save.modifiedRoll} vs ${save.targetNumber}: `+
            `${save.success ? "SUCCESS — HALF DAMAGE" : "FAILED — FULL DAMAGE"}`
          ]
        : [],
      killed:unit.hp<=0
    });

    if(unit.hp<=0){
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
    }
  }

  if(koboldCasualties>0 && activeEnemies().length>0){
    const scheduled=scheduleKoboldGroupMoraleCheck({
      casualties:koboldCasualties,
      magicCasualties:koboldCasualties,
      source:magicCasualtySource
    },0);

    if(scheduled){
      await waitForCombatActionPause();
    }
  }
}

async function castBurningHandsSpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(
    targetHex.x===caster.x &&
    targetHex.y===caster.y
  ){
    setCombatMessage("AIM Burning Hands in a direction away from the caster.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,getSpellEntry(action?.spellId),action,1800,targetHex)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);
  setUnitActionBanner(caster,"Casting Burning Hands");

  const blastCells=directionalWedgeCells(
    caster,
    targetHex,
    1,
    Math.PI/3
  );

  /*
    As with Fireball, no faction filtering is allowed here.
    A friendly standing in the fan is burned normally.
  */
  const targets=livingUnitsInAreaCells(blastCells);
  const friendlyTargets=targets.filter(unit=>
    unit.faction===caster.faction
  );

  const damage=d(3)+Math.min(20,2*level);

  if(friendlyTargets.length){
    log(
      `Burning Hands friendly fire: ${friendlyTargets.map(unit=>unit.name).join(", ")} caught in the fan.`,
      "bad"
    );
  }

  if(typeof combatGpu!=="undefined")combatGpu?.meltSnow?.(blastCells,1);
  await animateSpellSurfaceFlash(blastCells);
  if(!await resolveAoeDamageSpell({
    caster,
    spellName:"Burning Hands",
    targets,
    damage,
    saveForHalf:true,
    damageType:"fire"
  }))return false;

  if(!targets.length){
    setCombatMessage("Burning Hands scorches empty ground.",COMBAT_MESSAGE_MIN_HOLD_MS);
    await waitForCombatActionPause();
  }

  finishTestSpellCast(caster,"Burning Hands",action);
  return true;
}

async function castShockingGraspSpell(action,target){
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
        ? `Shocking Grasp requires a hostile creature within Spectral Hand range (${handRange} hexes).`
        : "Shocking Grasp requires an adjacent hostile creature."
    );
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action,1800,target)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  const position=attackPositionData(caster,target);
  faceEntityToward(caster,target);
  setUnitActionBanner(
    caster,
    throughHand && !adjacent
      ? "Spectral Hand delivers Shocking Grasp"
      : `Casting Shocking Grasp — ${position.label}`
  );

  const rawRoll=d(20);
  const attackBonus=attackEffectModifier(caster,target)+(throughHand && !adjacent ? 2 : 0);
  const targetAC=effectiveArmorClassForAttack(caster,target,"melee");
  const targetNumber=caster.thaco-targetAC;
  const resolution=resolveMeleeAttackD20(rawRoll,targetNumber,attackBonus);

  playNaturalAttackRollSound(rawRoll);

  if(!resolution.hit){
    playMissSound();
    if(rawRoll===1){
      setCriticalRollNotification(caster,target,rawRoll);
    }else{
      setCombatMessage(`${caster.name} misses the Shocking Grasp touch attack.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    }

    await waitForCombatActionPause();
    finishTestSpellCast(caster,spell.name,action);
    return true;
  }

  if(interceptWithMirrorImage(target,caster)){
    setCombatMessage(`${target.name}'s Mirror Image absorbs Shocking Grasp.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    await waitForCombatActionPause();
    finishTestSpellCast(caster,spell.name,action);
    return true;
  }

  const damage=d(8)+level;
  const result=applySpellDamage(caster,target,damage,"Shocking Grasp","electricity");

  if(rawRoll===20 && !result.killed){
    setCriticalRollNotification(caster,target,rawRoll,damage,false);
  }

  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castMelfsAcidArrowSpell(action,target){
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
  if(!commitSpellCast(caster,spell,action,1800,target)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);
  setUnitActionBanner(caster,"Casting Melf's Acid Arrow");

  const rawRoll=d(20);
  const fighterThaco=Math.max(1,21-level);
  const targetAC=effectiveArmorClassForAttack(caster,target,"small-device-missile");
  const targetNumber=fighterThaco-targetAC;
  const modifier=attackEffectModifier(caster,target);
  const resolution=resolveMissileAttackD20(rawRoll,targetNumber,modifier);

  playNaturalAttackRollSound(rawRoll);
  await animateElementalArrowProjectile(
    caster,
    target,
    "acid-arrow",
    0,
    1
  );

  if(!resolution.hit){
    playMissSound();
    setCombatMessage("Melf's Acid Arrow misses.",COMBAT_MESSAGE_MIN_HOLD_MS);
  }else if(interceptWithMirrorImage(target,caster)){
    setCombatMessage(`${target.name}'s Mirror Image absorbs the Acid Arrow.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  }else{
    const damage=rollDiceExpression("2d4").total;
    const result=applySpellDamage(caster,target,damage,"Melf's Acid Arrow","acid");
    const remainingTicks=Math.floor(level/3);

    if(!result.killed && remainingTicks>0){
      addUnitEffect(target,{
        id:"acid-arrow",
        name:"Splashed with Acid",
        kind:"debuff",
        expiresRound:game.round+remainingTicks+1,
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
    }

    await animateMagicEffectOnUnits([target],"acid");
  }

  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}
