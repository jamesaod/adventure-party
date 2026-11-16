/*
  R231 — COMPLETION-TIME TARGETING HOOKS
  =======================================
  Loaded after R230 so player and automated spellcasting acquire tactical
  targets only when the casting-time interval has finished.
*/


/* ============================================================
   PLAYER SPELL SELECTION: CHOOSE SPELL NOW, AIM LATER
   ============================================================ */

const r231BaseBeginMageCombatSpell=
  beginMageCombatSpell;

beginMageCombatSpell=function(spellId){
  const spell=getSpellEntry(spellId);
  const caster=activePlayerControlledUnit();

  if(
    !spell ||
    !spell.combatImplemented ||
    !isMageCharacter(caster) ||
    !mageCanCastMemorizedSpell(caster,spellId) ||
    game?.over ||
    game?.active!==caster?.id ||
    isCombatActionPauseActive() ||
    spellCastInProgress ||
    r230UnitIsCasting(caster)
  ){
    return false;
  }

  const action={
    type:"memorized-spell",
    spellId,
    casterLevel:caster.level,
    sourceUnitId:caster.id,
    testHarness:false,
    spellCommitted:false
  };

  return r231BeginCastingWithoutTarget(
    caster,
    spell,
    action
  );
};


const r231BaseBeginCombatTestSpell=
  beginCombatTestSpell;

beginCombatTestSpell=function(spellId){
  const spell=getSpellEntry(spellId);
  const caster=activePlayerControlledUnit();

  if(
    !spell ||
    !spell.combatImplemented ||
    !caster ||
    caster.id!=="player" ||
    game?.over ||
    game?.active!==caster.id ||
    isCombatActionPauseActive() ||
    spellCastInProgress ||
    r230UnitIsCasting(caster)
  ){
    return false;
  }

  const action={
    type:"test-spell",
    spellId,
    casterLevel:TEST_SPELL_CASTER_LEVEL,
    sourceUnitId:caster.id,
    testHarness:true
  };

  return r231BeginCastingWithoutTarget(
    caster,
    spell,
    action
  );
};


/* ============================================================
   SCROLL SPELLS: DEFER AIM UNTIL THE SCROLL'S SPELL IS READY
   ============================================================ */

const r231BaseUseInventoryItem=
  useInventoryItem;

useInventoryItem=function(index){
  const fighter=game?.player;
  const item=fighter?.inventory?.[index];

  if(
    !item ||
    !item.usable ||
    !["magic-missile","fireball"].includes(item.spellId)
  ){
    return r231BaseUseInventoryItem(index);
  }

  if(
    game?.over ||
    game?.round===0 ||
    game?.active!=="player" ||
    !fighter?.alive ||
    isCombatActionPauseActive() ||
    spellCastInProgress ||
    r230UnitIsCasting(fighter)
  ){
    log(
      "That item can only be used during Carl's active combat turn.",
      "system"
    );
    return false;
  }

  const spell=getSpellEntry(item.spellId);
  if(!spell) return false;

  const action={
    type:"spell-scroll",
    spellId:item.spellId,
    itemName:item.name,
    casterLevel:item.scrollCasterLevel || 6,
    sourceUnitId:fighter.id,
    r231ScrollInventoryIndex:index
  };

  return r231BeginCastingWithoutTarget(
    fighter,
    spell,
    action
  );
};


/* ============================================================
   AUTOMATED CASTERS: DISCARD THE START-OF-CAST TARGET SNAPSHOT
   ============================================================ */

const r231BaseScheduleSpellCast=
  r230ScheduleSpellCast;

r230ScheduleSpellCast=function(
  caster,
  spell,
  action,
  context
){
  let schedulingContext=context;

  if(
    action &&
    !action.r230Completing &&
    r231SpellNeedsAim(spell)
  ){
    action.r231DeferredTarget=true;

    schedulingContext={
      ...(context || {}),
      targetHex:null,
      targetUnitId:null
    };
  }

  return r231BaseScheduleSpellCast(
    caster,
    spell,
    action,
    schedulingContext
  );
};


/* ============================================================
   CAST COMPLETION: ACQUIRE THE TACTICAL TARGET NOW
   ============================================================ */

const r231BaseResolveCastingCompletion=
  r230ResolveCastingCompletion;

r230ResolveCastingCompletion=async function(record){
  if(!record){
    return false;
  }

  const caster=getUnitById(record.casterId);
  const spell=getSpellEntry(record.spellId);

  if(
    !record.action?.r231DeferredTarget ||
    !r231SpellNeedsAim(spell)
  ){
    return await r231BaseResolveCastingCompletion(
      record
    );
  }

  if(
    !caster?.alive ||
    caster.fled ||
    record.disrupted
  ){
    return await r231BaseResolveCastingCompletion(
      record
    );
  }

  if(r231PlayerDirectsCompletionTarget(caster)){
    return r231BeginCompletionAim(
      record,
      caster,
      spell
    );
  }

  const chosen=
    r231ChooseAutomatedCompletionTarget(
      caster,
      spell
    );

  if(!chosen){
    record.resolving=true;

    if(caster.r230CastingToken===record.token){
      delete caster.r230CastingToken;
    }

    r231CleanupCompletionRecord(
      record.token,
      caster
    );

    game.active=caster.id;
    spellCastInProgress=false;

    setCombatMessage(
      `${caster.name}'s ${spell.name} completes, but no legal target remains; the spell is lost.`,
      COMBAT_MESSAGE_MIN_HOLD_MS
    );

    log(
      `${caster.name} finishes casting ${spell.name}, but cannot acquire a legal target at completion.`,
      "bad"
    );

    updateUi();
    draw();

    if(!game.over){
      endTurn();
    }

    return true;
  }

  record.targetHex=
    chosen.targetHex
      ? {...chosen.targetHex}
      : null;

  record.targetUnitId=
    chosen.targetUnit?.id || null;

  return await r231BaseResolveCastingCompletion(
    record
  );
};


/* ============================================================
   PLAYER TARGET ACCEPTANCE: CLEAN UP ONLY AFTER A VALID CAST
   ============================================================ */

const r231BaseCastPreparedCombatSpell=
  castPreparedCombatSpell;

castPreparedCombatSpell=async function(
  action,
  targetHex,
  targetUnit
){
  const completionTargeting=
    !!action?.r231CompletionTargeting;

  const token=
    action?.r231CastingToken || null;

  const caster=
    completionTargeting
      ? spellCasterForAction(action)
      : null;

  const resolved=
    await r231BaseCastPreparedCombatSpell(
      action,
      targetHex,
      targetUnit
    );

  /*
    A false result means range/LOS/target validation rejected this choice before
    the spell was committed. Keep AIM active and let the player choose again.
  */
  if(
    completionTargeting &&
    resolved
  ){
    r231CleanupCompletionRecord(
      token,
      caster
    );
  }

  return resolved;
};


/* ============================================================
   ESC AT COMPLETION: FORGO THE ALREADY-COMMITTED SPELL
   ============================================================ */

const r231BaseExitAimMode=
  exitAimMode;

exitAimMode=function(
  redraw=true,
  cancelPending=true
){
  const canceled=(
    cancelPending &&
    pendingAimAction?.r231CompletionTargeting
  )
    ? {...pendingAimAction}
    : null;

  const result=
    r231BaseExitAimMode(
      redraw,
      cancelPending
    );

  if(canceled){
    const caster=
      spellCasterForAction(canceled);

    const spell=
      getSpellEntry(canceled.spellId);

    r231CleanupCompletionRecord(
      canceled.r231CastingToken,
      caster
    );

    spellCastInProgress=false;

    queueMicrotask(()=>{
      setCombatMessage(
        `${caster?.name || "The caster"}'s ${spell?.name || "spell"} is lost without a target.`,
        COMBAT_MESSAGE_MIN_HOLD_MS
      );

      log(
        `${caster?.name || "The caster"} forgoes ${spell?.name || "the completed spell"} instead of choosing a target.`,
        "system"
      );

      updateUi();
      draw();

      if(
        !game?.over &&
        caster?.alive &&
        game.active===caster.id
      ){
        endTurn();
      }
    });
  }

  return result;
};


/* ============================================================
   DIAGNOSTICS
   ============================================================ */

window.AdventurePartyCastingTargeting={
  release:"R231",
  pending:()=>{
    const action=pendingAimAction;
    return {
      completionTargeting:
        !!action?.r231CompletionTargeting,
      spellId:action?.spellId || null,
      castingToken:
        action?.r231CastingToken || null,
      aimMode:!!aimMode,
      activeUnitId:game?.active || null
    };
  }
};

if(window.AdventurePartyCastingTime){
  window.AdventurePartyCastingTime.release="R231";
}
