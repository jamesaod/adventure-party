/* Combat owner: combat-spells-control.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

async function castCharmPersonSpell(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("charm-person");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(
    !validCreatureTargetWithinRange(caster,target,spell,level,false) ||
    !isCharmPersonEligible(target)
  ){
    setCombatMessage(
      "Charm Person requires a living hostile humanoid of Medium size or smaller within 12 hexes."
    );
    return false;
  }

  if(lineOfSightBlocked(caster,target)){
    setCombatMessage("Line of sight is blocked to that target.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,getSpellEntry(action?.spellId),action,1800,target)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);
  setUnitActionBanner(caster,"Casting Charm Person");

  const save=rollSpellSave(target,caster);

  setLastRoll(
    `Charm Person save: d20 ${save.rawRoll}`+
    `${save.modifier ? ` ${save.modifier>=0 ? "+" : ""}${save.modifier}` : ""}`+
    ` = ${save.modifiedRoll} vs ${save.targetNumber}`
  );

  if(save.success){
    playMagicEffectSound("charm");
    setCombatMessage(
      `${target.name} resists Charm Person.`,
      COMBAT_MESSAGE_MIN_HOLD_MS
    );
    log(
      `${target.name} saves against Charm Person and remains hostile.`,
      "system"
    );
    await waitForCombatActionPause();
  }else{
    applyCharmPersonAllegiance(target,caster);

    setCombatMessage(
      `${target.name} is CHARMED and changes sides!`,
      COMBAT_MESSAGE_MIN_HOLD_MS
    );
    log(
      `${target.name} is charmed by ${caster.name}; it now fights its former allies under AI control.`,
      "good"
    );

    await animateMagicEffectOnUnits([target],"charm");
    ensurePersistentStatusFxLoop();
  }

  finishTestSpellCast(caster,"Charm Person",action);
  return true;
}

async function castColorSpraySpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(
    targetHex.x===caster.x &&
    targetHex.y===caster.y
  ){
    setCombatMessage("AIM Color Spray in a direction away from the caster.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,getSpellEntry(action?.spellId),action,1800,targetHex)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);
  setUnitActionBanner(caster,"Casting Color Spray");

  const maxAffected=d(6);
  const sprayCells=directionalWedgeCells(
    caster,
    targetHex,
    2,
    Math.PI/3
  );

  const candidates=livingUnitsInAreaCells(sprayCells)
    .filter(unit=>unit.id!==caster.id)
    .sort((a,b)=>
      hexDistance(caster,a)-hexDistance(caster,b) ||
      a.id.localeCompare(b.id)
    )
    .slice(0,maxAffected);

  /* One shared prismatic fan for the whole instantaneous spell. */
  await animateColorSprayEffect(
    caster,
    targetHex,
    sprayCells
  );

  const newlyUnconscious=[];

  for(const unit of candidates){
    const hd=spellHitDiceValue(unit);
    let saved=false;
    let save=null;

    if(hd>level || hd>=6){
      save=rollSpellSave(unit,caster);
      saved=save.success;
    }

    if(saved){
      setCombatMessage(
        `${unit.name} saves against Color Spray (${save.modifiedRoll} vs ${save.targetNumber}).`,
        COMBAT_MESSAGE_MIN_HOLD_MS
      );
      await waitForCombatActionPause();
      continue;
    }

    if(hd<=level){
      const rounds=d(4)+d(4);
      applyUnconsciousEffect(unit,rounds,"Color Spray");
      newlyUnconscious.push(unit);
      setCombatMessage(`${unit.name} is knocked unconscious by Color Spray for ${rounds} rounds.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    }else if(hd<=level+2){
      const rounds=d(4);
      applyBlindEffect(unit,rounds,"Color Spray");
      setCombatMessage(`${unit.name} is blinded by Color Spray for ${rounds} rounds.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    }else{
      applyStunnedEffect(unit,1,"Color Spray");
      setCombatMessage(`${unit.name} is stunned by Color Spray.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    }

    await waitForCombatActionPause();
  }

  if(!candidates.length){
    setCombatMessage("Color Spray catches no creatures.",COMBAT_MESSAGE_MIN_HOLD_MS);
    await waitForCombatActionPause();
  }

  if(newlyUnconscious.length){
    /* Strong one-shot status application; persistent orbiting stars take over afterward. */
    await animateMagicEffectOnUnits(newlyUnconscious,"unconscious",{playSound:false});
    ensurePersistentStatusFxLoop();
  }

  finishTestSpellCast(caster,"Color Spray",action);
  return true;
}

async function castGreaseSpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("grease");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Grease target hex is out of range.");
    return false;
  }

  if(lineOfSightBlocked(caster,targetHex)){
    setCombatMessage("Line of sight is blocked to that hex.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,getSpellEntry(action?.spellId),action,1800,targetHex)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  playMagicEffectSound("grease");

  const effect=addAreaEffect({
    id:`grease-${Date.now()}`,
    type:"grease",
    name:"Grease",
    cells:[{x:targetHex.x,y:targetHex.y}],
    expiresRound:game.round+3+level,
    sourceUnitId:caster.id
  });

  const occupants=livingUnitsInAreaCells([
    {x:targetHex.x,y:targetHex.y}
  ]);

  for(const unit of occupants){
    await resolvePersistentAreaSave(
      unit,
      effect,
      {trigger:"cast"}
    );
  }

  if(!occupants.length){
    setCombatMessage("Grease coats the targeted hex.",COMBAT_MESSAGE_MIN_HOLD_MS);
    await waitForCombatActionPause();
  }

  finishTestSpellCast(caster,"Grease",action);
  return true;
}

async function castSleepSpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("sleep");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Sleep center is out of range.");
    return false;
  }

  if(lineOfSightBlocked(caster,targetHex)){
    setCombatMessage("Line of sight is blocked to the Sleep center.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,getSpellEntry(action?.spellId),action,1800,targetHex)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);
  setUnitActionBanner(caster,"Casting Sleep");

  let hdPool=d(4)+d(4);
  /* R94: Sleep uses one complete radius-1 hex cluster (7 hexes). */
  const sleepCells=hexesWithinRadius(targetHex,1);

  const candidates=livingUnitsInAreaCells(sleepCells)
    .filter(unit=>
      !isUndeadUnit(unit) &&
      spellHitDiceValue(unit)<4.375
    )
    .sort((a,b)=>
      spellHitDiceValue(a)-spellHitDiceValue(b) ||
      hexDistance(a,targetHex)-hexDistance(b,targetHex) ||
      a.id.localeCompare(b.id)
    );

  const affected=[];

  for(const unit of candidates){
    const hd=spellHitDiceValue(unit);
    if(hd>hdPool) continue;

    hdPool-=hd;
    affected.push(unit);

    addUnitEffect(unit,{
      id:"sleep",
      name:"Magical Sleep",
      kind:"debuff",
      expiresRound:game.round+5*level,
      detail:"Sleep: cannot act; wounding awakens",
      data:{sourceUnitId:caster.id}
    });

    log(`${unit.name} falls into magical sleep.`,"system");
  }

  if(affected.length){
    setCombatMessage(
      `SLEEP TAKES HOLD — ${affected.length} CREATURE${affected.length===1 ? "" : "S"} FALL ASLEEP`,
      900,
      900
    );

    /*
      First consumer of the reusable R93 magic-effect framework: every unit
      that actually receives Sleep gets a visible magical shimmer and its own
      short magic SFX cue during one shared animation beat.
    */
    await animateMagicEffectOnUnits(affected,"sleep");

    /* R95: transition from the stronger application burst to the quiet persistent status FX. */
    ensurePersistentStatusFxLoop();
  }else{
    setCombatMessage("Sleep affects no eligible creatures.",COMBAT_MESSAGE_MIN_HOLD_MS);
    await waitForCombatActionPause();
  }

  finishTestSpellCast(caster,"Sleep",action);
  return true;
}

async function castSpookSpell(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("spook");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(
    !validCreatureTargetWithinRange(caster,target,spell,level,false) ||
    isUndeadUnit(target)
  ){
    setCombatMessage("Spook requires a living hostile creature within 30 feet.");
    return false;
  }

  if(lineOfSightBlocked(caster,target)){
    setCombatMessage("Line of sight is blocked to that target.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,getSpellEntry(action?.spellId),action,1800,target)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  const penalty=-Math.min(6,Math.floor(level/2));
  const save=rollSpellSave(target,caster,penalty);

  if(save.success){
    setCombatMessage(`${target.name} resists Spook.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  }else{
    addUnitEffect(target,{
      id:"spook",
      name:"Spooked",
      kind:"debuff",
      detail:"Forced to flee; new unmodified save each later turn",
      data:{sourceUnitId:caster.id}
    });

    setCombatMessage(`${target.name} panics and flees from Spook.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  }

  await waitForCombatActionPause();
  finishTestSpellCast(caster,"Spook",action);
  return true;
}

async function castTauntSpell(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("taunt");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,false)){
    setCombatMessage("Taunt target is out of range.");
    return false;
  }

  if(lineOfSightBlocked(caster,target)){
    setCombatMessage("Line of sight is blocked to that target.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,getSpellEntry(action?.spellId),action,1800,target)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  playMagicEffectSound("taunt");

  const targetType=target.type || target.name;
  const candidates=unitsWithinHexRadius(target,3)
    .filter(unit=>
      unit.faction!==caster.faction &&
      (unit.type || unit.name)===targetType &&
      !isUndeadUnit(unit)
    );

  for(const unit of candidates){
    const save=rollSpellSave(unit,caster);

    if(save.success){
      setCombatMessage(`${unit.name} resists Taunt.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    }else{
      addUnitEffect(unit,{
        id:"taunt",
        name:"Taunted",
        kind:"debuff",
        expiresRound:game.round+1,
        detail:`Compelled to rush ${caster.name} for melee`,
        data:{sourceUnitId:caster.id}
      });
      ensurePersistentStatusFxLoop();

      setCombatMessage(`${unit.name} is enraged by Taunt and rushes the caster.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    }

    await waitForCombatActionPause();
  }

  if(!candidates.length){
    setCombatMessage("Taunt catches no creatures of that type.",COMBAT_MESSAGE_MIN_HOLD_MS);
    await waitForCombatActionPause();
  }

  finishTestSpellCast(caster,"Taunt",action);
  return true;
}

async function castWallOfFogSpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("wall-of-fog");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Wall of Fog target is out of range.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,getSpellEntry(action?.spellId),action,1800,targetHex)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  playMagicEffectSound("wall-of-fog");

  const duration=d(4)+d(4)+level;
  const cells=createWallOfFogCells(
    caster,
    targetHex,
    level,
    action.wallOfFogOrientationIndex
  );

  addAreaEffect({
    id:`fog-${Date.now()}`,
    type:"fog",
    name:"Wall of Fog",
    cells,
    visualHeightPx:HEX_W,
    expiresRound:game.round+duration,
    sourceUnitId:caster.id
  });

  const visibleFogCells=cells.filter(cell=>
    inside(cell.x,cell.y) &&
    isHexOnBattlefieldScreen(cell.x,cell.y,HEX_W)
  ).length;
  setCombatMessage(
    `Wall of Fog rises across ${visibleFogCells} visible hex${visibleFogCells===1 ? "" : "es"}, ending at solid obstacles and the map edge.`,
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  finishTestSpellCast(caster,"Wall of Fog",action);
  return true;
}

async function castBlindnessSpell(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("blindness");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,false)){
    setCombatMessage("Blindness requires a hostile creature within range.");
    return false;
  }
  if(lineOfSightBlocked(caster,target)){
    setCombatMessage("Line of sight is blocked to that target.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action,1800,target)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  const save=rollSpellSave(target,caster);
  if(save.success){
    setCombatMessage(`${target.name} resists Blindness.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  }else{
    applyBlindEffect(target,null,"Blindness",{attackPenalty:-4,savePenalty:0,acPenalty:4});
    setCombatMessage(`${target.name} is blinded!`,COMBAT_MESSAGE_MIN_HOLD_MS);
    await animateMagicEffectOnUnits([target],"blindness");
  }

  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castDarknessSpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("darkness-15-radius");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Darkness center is out of range.");
    return false;
  }
  if(lineOfSightBlockedBetweenHexes(caster,targetHex)){
    setCombatMessage("Line of sight is blocked to the Darkness center.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action,1800,targetHex)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  addAreaEffect({
    id:`darkness:${Date.now()}`,
    type:"darkness",
    name:"Darkness, 15' Radius",
    cells:hexesWithinRadius(targetHex,1).filter(cell=>inside(cell.x,cell.y)),
    expiresRound:game.round+10+level,
    sourceUnitId:caster.id
  });

  playMagicEffectSound("darkness");
  setCombatMessage("Magical Darkness swallows the area.",COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castDeafnessSpell(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("deafness");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,false)){
    setCombatMessage("Deafness requires a hostile creature within range.");
    return false;
  }
  if(lineOfSightBlocked(caster,target)){
    setCombatMessage("Line of sight is blocked to that target.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action,1800,target)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  const save=rollSpellSave(target,caster);
  if(save.success){
    setCombatMessage(`${target.name} resists Deafness.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  }else{
    addUnitEffect(target,{
      id:"deafness",
      name:"Deafened",
      kind:"debuff",
      expiresRound:null,
      detail:"20% chance to miscast spells with verbal components",
      data:{sourceUnitId:caster.id}
    });
    setCombatMessage(`${target.name} is deafened.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    await animateMagicEffectOnUnits([target],"deafness");
  }

  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castFogCloudSpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("fog-cloud");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Fog Cloud center is out of range.");
    return false;
  }
  if(lineOfSightBlockedBetweenHexes(caster,targetHex)){
    setCombatMessage("Line of sight is blocked to that hex.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action,1800,targetHex)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  playMagicEffectSound("fog-cloud");

  const cells=hexesWithinRadius(targetHex,1).filter(cell=>inside(cell.x,cell.y));
  addAreaEffect({
    id:`fog-cloud:${Date.now()}`,
    type:"fog",
    spellKind:"fog-cloud",
    name:"Fog Cloud",
    cells,
    visualHeightPx:HEX_W,
    expiresRound:game.round+4+level,
    sourceUnitId:caster.id
  });

  setCombatMessage(`Fog Cloud fills ${cells.length} battlefield hexes.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castGlitterdustSpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("glitterdust");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Glitterdust center is out of range.");
    return false;
  }
  if(lineOfSightBlockedBetweenHexes(caster,targetHex)){
    setCombatMessage("Line of sight is blocked to that hex.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action,1800,targetHex)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  const cells=hexesWithinRadius(targetHex,1);
  const targets=livingUnitsInAreaCells(cells);
  const dustRounds=d(4)+level;
  const blinded=[];

  for(const unit of targets){
    addUnitEffect(unit,{
      id:"glitterdust",
      name:"Glitterdust",
      kind:"debuff",
      expiresRound:game.round+dustRounds,
      detail:"Sparkling dust reveals invisibility",
      data:{sourceUnitId:caster.id}
    });

    const save=rollSpellSave(unit,caster);
    if(!save.success){
      const blindRounds=d(4)+1;
      applyBlindEffect(unit,blindRounds,"Glitterdust");
      blinded.push(unit);
    }
  }

  if(targets.length){
    await animateMagicEffectOnUnits(targets,"glitterdust");
  }

  setCombatMessage(
    `Glitterdust coats ${targets.length} creature${targets.length===1 ? "" : "s"}; ${blinded.length} blinded.`,
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castHypnoticPatternSpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("hypnotic-pattern");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Hypnotic Pattern center is out of range.");
    return false;
  }
  if(lineOfSightBlockedBetweenHexes(caster,targetHex)){
    setCombatMessage("Line of sight is blocked to that hex.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action,1800,targetHex)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  let hdRemaining=24;
  const targets=livingUnitsInAreaCells(hexesWithinRadius(targetHex,1))
    .slice()
    .sort((a,b)=>spellHitDiceValue(a)-spellHitDiceValue(b));
  const affected=[];

  for(const unit of targets){
    const hd=spellHitDiceValue(unit);
    if(hd>hdRemaining) continue;
    const save=rollSpellSave(unit,caster);
    if(save.success) continue;

    hdRemaining-=hd;
    addUnitEffect(unit,{
      id:"hypnotic-pattern",
      name:"Hypnotic Pattern",
      kind:"debuff",
      expiresRound:game.round+3,
      detail:"Fascinated; cannot act; damage breaks the effect",
      data:{sourceUnitId:caster.id}
    });
    affected.push(unit);
  }

  if(affected.length){
    await animateMagicEffectOnUnits(affected,"hypnotic-pattern");
  }
  setCombatMessage(
    affected.length
      ? `${affected.length} creature${affected.length===1 ? "" : "s"} stare helplessly at the Hypnotic Pattern.`
      : "No creature succumbs to the Hypnotic Pattern.",
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castPyrotechnicsSpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("pyrotechnics");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Pyrotechnics target is out of range.");
    return false;
  }

  const fireSource=flamingSphereEffects().find(effect=>
    areaEffectContains(effect,targetHex.x,targetHex.y)
  );

  if(!fireSource){
    setCombatMessage("Pyrotechnics currently requires an active Flaming Sphere as its fire source.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action,1800,targetHex)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  game.areaEffects=(game.areaEffects || []).filter(effect=>effect!==fireSource);

  const blinded=[];
  for(const unit of allUnits()){
    if(!unit?.alive || unit.fled || unit.id===caster.id) continue;
    if(unitDistance(unit,targetHex)>12) continue;
    if(lineOfSightBlockedBetweenHexes(targetHex,unit)) continue;

    const save=rollSpellSave(unit,caster);
    if(!save.success){
      const rounds=d(4)+1;
      applyBlindEffect(unit,rounds,"Pyrotechnics");
      blinded.push(unit);
    }
  }

  playFireballExplosionSound();
  if(blinded.length){
    await animateMagicEffectOnUnits(blinded,"pyrotechnics");
  }
  setCombatMessage(
    `Pyrotechnics erupts in fireworks; ${blinded.length} creature${blinded.length===1 ? "" : "s"} blinded.`,
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castRayOfEnfeeblementSpell(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("ray-of-enfeeblement");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,false)){
    setCombatMessage("Ray of Enfeeblement requires a hostile creature within range.");
    return false;
  }
  if(lineOfSightBlocked(caster,target)){
    setCombatMessage("Line of sight is blocked to that target.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action,1800,target)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  const save=rollSpellSave(target,caster);
  if(save.success){
    setCombatMessage(`${target.name} resists Ray of Enfeeblement.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  }else{
    addUnitEffect(target,{
      id:"ray-enfeeblement",
      name:"Enfeebled",
      kind:"debuff",
      expiresRound:game.round+level,
      detail:"−2 attack rolls; −1 weapon damage",
      data:{sourceUnitId:caster.id}
    });
    await animateMagicEffectOnUnits([target],"enfeeblement");
    setCombatMessage(`${target.name} is enfeebled.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  }

  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castScareSpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("scare");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Scare center is out of range.");
    return false;
  }
  if(lineOfSightBlockedBetweenHexes(caster,targetHex)){
    setCombatMessage("Line of sight is blocked to that hex.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action,1800,targetHex)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  playMagicEffectSound("fear");

  const duration=d(4)+level;
  const affected=[];

  for(const unit of livingUnitsInAreaCells(hexesWithinRadius(targetHex,1))){
    if(unit.id===caster.id) continue;
    if(spellHitDiceValue(unit)>=6) continue;
    if(isUndeadUnit(unit) || unit.isExtraplanar || unit.extraplanar) continue;

    const race=String(unit.race||"").toLowerCase();
    const group=String(unit.classGroup||"").toLowerCase();
    const receivesSave=race.includes("elf") || group==="priest";
    if(receivesSave && rollSpellSave(unit,caster).success) continue;

    addUnitEffect(unit,{
      id:"scare",
      name:"Scared",
      kind:"debuff",
      expiresRound:game.round+duration,
      detail:"Compelled to flee",
      data:{sourceUnitId:caster.id}
    });
    affected.push(unit);
  }

  if(affected.length){
    await animateMagicEffectOnUnits(
      affected,
      "fear",
      {playSound:false}
    );
  }
  setCombatMessage(
    affected.length
      ? `${affected.length} creature${affected.length===1 ? "" : "s"} flee from Scare.`
      : "Scare affects no eligible creatures.",
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castStinkingCloudSpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("stinking-cloud");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Stinking Cloud center is out of range.");
    return false;
  }
  if(lineOfSightBlockedBetweenHexes(caster,targetHex)){
    setCombatMessage("Line of sight is blocked to that hex.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action,1800,targetHex)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  const cells=hexesWithinRadius(targetHex,1).filter(cell=>inside(cell.x,cell.y));
  const effect=addAreaEffect({
    id:`stinking-cloud:${Date.now()}`,
    type:"fog",
    spellKind:"stinking-cloud",
    name:"Stinking Cloud",
    cells,
    visualHeightPx:HEX_W,
    expiresRound:game.round+level,
    sourceUnitId:caster.id
  });

  playStinkingCloudCastSound();

  const nauseated=[];
  for(const unit of livingUnitsInAreaCells(cells)){
    if(await resolveStinkingCloudExposure(unit,effect)){
      nauseated.push(unit);
    }
  }

  setCombatMessage(
    `Stinking Cloud billows out; ${nauseated.length} creature${nauseated.length===1 ? "" : "s"} overcome.`,
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castTashasHideousLaughterSpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("tashas-hideous-laughter");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Hideous Laughter center is out of range.");
    return false;
  }
  if(lineOfSightBlockedBetweenHexes(caster,targetHex)){
    setCombatMessage("Line of sight is blocked to that hex.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action,1800,targetHex)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  playMagicEffectSound("laughter");

  const maxTargets=Math.max(1,Math.floor(level/3));
  const candidates=livingUnitsInAreaCells(hexesWithinRadius(targetHex,1))
    .filter(unit=>unit.id!==caster.id)
    .sort((a,b)=>hexDistance(a,targetHex)-hexDistance(b,targetHex));
  const affected=[];

  for(const unit of candidates){
    if(affected.length>=maxTargets) break;
    const intelligence=Math.max(1,Number(unit.stats?.int)||3);
    if(intelligence<=4) continue;

    const savePenalty=
      intelligence<=7 ? -6 :
      intelligence<=12 ? -4 :
      intelligence<=14 ? -2 : 0;

    if(rollSpellSave(unit,caster,savePenalty).success) continue;

    addUnitEffect(unit,{
      id:"hideous-laughter",
      name:"Hideous Laughter",
      kind:"debuff",
      expiresRound:game.round+level,
      detail:"Collapsed laughing; 2 disabled actions, then −2 attack and damage",
      data:{sourceUnitId:caster.id,disabledActionsRemaining:2}
    });
    affected.push(unit);
  }

  if(affected.length){
    await animateMagicEffectOnUnits(
      affected,
      "laughter",
      {playSound:false}
    );
  }
  setCombatMessage(
    affected.length
      ? `${affected.map(unit=>unit.name).join(", ")} collapse in hideous laughter.`
      : "No creature succumbs to Hideous Laughter.",
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castWebSpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("web");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Web center is out of range.");
    return false;
  }
  if(lineOfSightBlockedBetweenHexes(caster,targetHex)){
    setCombatMessage("Line of sight is blocked to that hex.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action,1800,targetHex)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  const cells=hexesWithinRadius(targetHex,1).filter(cell=>inside(cell.x,cell.y));
  const durationRounds=Math.min(
    Math.max(1,Number(spell.maxDurationRounds)||6),
    Math.max(
      1,
      Math.floor(Number(level)||1)*
      Math.max(1,Number(spell.durationRoundsPerCasterLevel)||1)
    )
  );
  const effect=addAreaEffect({
    id:`web:${Date.now()}`,
    type:"web",
    name:"Web",
    cells,
    expiresRound:game.round+durationRounds,
    sourceUnitId:caster.id
  });

  const trapped=[];
  for(const unit of livingUnitsInAreaCells(cells)){
    const result=await resolvePersistentAreaSave(
      unit,
      effect,
      {trigger:"cast"}
    );
    if(result.failed){
      trapped.push(unit);
    }
  }

  setCombatMessage(
    `Web fills ${cells.length} hexes for ${durationRounds} round${durationRounds===1 ? "" : "s"}; ${trapped.length} creature${trapped.length===1 ? "" : "s"} trapped.`,
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}
