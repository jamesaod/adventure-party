/*
  R233 — LIGHTNING BOLT RESULT PACING
  ===================================
  Keeps the R232 reflected ray exactly as-is, but presents every creature
  exposure individually after the shared continuous discharge.
*/

r226CastLightningBolt=async function(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("lightning-bolt");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(
    !targetHex ||
    (
      targetHex.x===caster.x &&
      targetHex.y===caster.y
    )
  ){
    setCombatMessage(
      "Lightning Bolt requires a direction."
    );
    return false;
  }

  spellCastInProgress=true;

  if(!commitSpellCast(caster,spell,action)){
    return await finishFailedSpellCommit(
      caster,
      action
    );
  }

  pendingAimAction=null;
  exitAimMode(false,false);

  setUnitActionBanner(
    caster,
    "Casting Lightning Bolt"
  );

  const trace=
    r232TraceLightningBolt(
      caster,
      targetHex,
      {
        rangeHexes:
          R232_LIGHTNING_RANGE_HEXES,
        maxReflections:
          R232_LIGHTNING_MAX_REFLECTIONS
      }
    );

  const damageDice=
    Math.min(
      10,
      Math.max(1,level)
    );

  const rolled=
    rollDiceExpression(
      damageDice+"d6"
    ).total;

  const occurrences=
    r232UnitOccurrencesAlongTrace(
      trace,
      caster
    );

  /*
    Target view first, then the shared electrical discharge arrives.
  */
  await r233FocusTarget(
    targetHex,
    120
  );

  r226LightningFx={
    r232Trace:true,
    segments:trace.segments,
    collisions:trace.collisions,
    started:performance.now(),
    duration:650
  };

  playMagicEffectSound(
    "lightning"
  );

  const until=
    performance.now()+650;

  while(performance.now()<until){
    draw();
    await sleep(16);
  }

  r226LightningFx=null;
  draw();

  let resolvedCount=0;

  for(const occurrence of occurrences){
    const unit=occurrence.unit;

    if(
      !unit?.alive ||
      unit.fled
    ){
      continue;
    }

    await r233FocusTarget(unit);

    const save=
      rollSpellSave(
        unit,
        caster
      );

    const immune=
      unitImmuneToDamageType(
        unit,
        "lightning"
      );

    if(immune){
      setCombatMessage(
        unit.name+
        " is immune to Lightning Bolt.",
        R233_RESULT_HOLD_MS,
        R233_RESULT_HOLD_MS
      );

      log(
        unit.name+
        " is immune to Lightning Bolt on reflected segment "+
        (occurrence.segmentIndex+1)+
        ".",
        "system"
      );

      await waitForCombatActionPause();
      resolvedCount++;
      continue;
    }

    const damage=
      save.success
        ? Math.floor(rolled/2)
        : rolled;

    const result=
      applySpellDamage(
        caster,
        unit,
        damage,
        "Lightning Bolt",
        "lightning"
      );

    log(
      unit.name+
      " Lightning Bolt exposure "+
      (occurrence.segmentIndex+1)+
      ": save "+
      save.modifiedRoll+
      " vs "+
      save.targetNumber+
      " — "+
      (
        save.success
          ? "SUCCESS, half damage"
          : "FAILED, full damage"
      )+
      "; "+
      damage+
      " damage.",
      save.success
        ? "system"
        : "bad"
    );

    if(!result.killed){
      setCombatMessage(
        unit.name+
        " takes "+
        damage+
        " Lightning Bolt damage — SAVE "+
        save.modifiedRoll+
        " vs "+
        save.targetNumber+
        ": "+
        (
          save.success
            ? "SUCCESS — HALF DAMAGE."
            : "FAILED — FULL DAMAGE."
        ),
        R233_RESULT_HOLD_MS,
        R233_RESULT_HOLD_MS,
        unit.id==="player"
          ? "player-damage"
          : "normal"
      );
    }

    await waitForCombatActionPause();
    resolvedCount++;
  }

  const collisionTypes=
    trace.collisions.map(
      collision=>
        collision.type==="tree"
          ? "tree"
          : "solid barrier"
    );

  const uniqueCollisionTypes=
    [...new Set(collisionTypes)];

  log(
    caster.name+
    " completes Lightning Bolt: "+
    damageDice+
    "d6 = "+
    rolled+
    " before saves; "+
    trace.reflections+
    " reflection"+
    (trace.reflections===1 ? "" : "s")+
    (
      uniqueCollisionTypes.length
        ? " from "+uniqueCollisionTypes.join(" and ")
        : ""
    )+
    "; "+
    resolvedCount+
    " creature exposure"+
    (resolvedCount===1 ? "" : "s")+
    ".",
    "system"
  );

  finishTestSpellCast(
    caster,
    spell.name,
    action
  );

  return true;
};
