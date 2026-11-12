/*
  R230 — CASTING-TIME ENGINE HOOKS
  =================================
  Loaded after all existing spell modules so the scheduler can wrap the final
  spell dispatcher and R225 commit sound hook without rewriting individual
  spells.
*/


/* ============================================================
   INITIATIVE STORAGE + FUTURE-ROUND CASTING SLOTS
   ============================================================ */

const r230BaseRollInitiative=rollInitiative;

rollInitiative=function(){
  const rolled=r230BaseRollInitiative();

  if(!game){
    return rolled;
  }

  const initiativeStore=r230InitiativeStore();

  for(const keyName of Object.keys(initiativeStore)){
    delete initiativeStore[keyName];
  }

  for(const entry of rolled){
    initiativeStore[entry.id]={
      roll:Number(entry.roll),
      tie:Number(entry.tie)
    };
  }

  const pending=r230PendingCastings();

  /*
    Multi-round casters do not receive ordinary action slots while their spell
    is still being cast.
  */
  const busyCasterIds=new Set(
    pending
      .filter(record=>
        game.round<=record.completeRound &&
        !record.resolving
      )
      .map(record=>record.casterId)
  );

  const result=rolled.filter(entry=>
    !busyCasterIds.has(entry.id)
  );

  /*
    A multi-round spell due this round gets one synthetic completion slot at the
    end of the round. Same-round numeric castings are inserted dynamically when
    the player/AI begins casting, so they do not appear here.
  */
  for(const record of pending){
    if(
      record.completeRound===game.round &&
      record.startRound<game.round &&
      !record.disrupted &&
      !record.resolving
    ){
      result.push({
        id:record.token,
        roll:9999,
        tie:9999,
        r230CastingCompletion:true
      });
    }
  }

  result.sort((a,b)=>
    Number(a.roll)-Number(b.roll) ||
    Number(a.tie)-Number(b.tie) ||
    String(a.id).localeCompare(String(b.id))
  );

  return result;
};


/* ============================================================
   SPELL DISPATCH CONTEXT
   ============================================================ */

const r230BaseCastPreparedCombatSpell=castPreparedCombatSpell;

castPreparedCombatSpell=async function(
  action,
  targetHex,
  targetUnit
){
  if(action?.r230Completing){
    return await r230BaseCastPreparedCombatSpell(
      action,
      targetHex,
      targetUnit
    );
  }

  const previousContext=r230CastContext;

  r230CastContext={
    action,
    targetHex:targetHex
      ? {x:targetHex.x,y:targetHex.y}
      : null,
    targetUnitId:targetUnit?.id || null
  };

  try{
    return await r230BaseCastPreparedCombatSpell(
      action,
      targetHex,
      targetUnit
    );
  }finally{
    r230CastContext=previousContext;
  }
};


/* ============================================================
   COMMIT NOW MEANS "BEGIN CASTING"; COMPLETION COMMITS EFFECT
   ============================================================ */

const r230BaseCommitSpellCast=commitSpellCast;

commitSpellCast=function(
  caster,
  spell,
  action,
  durationMs=1800
){
  /*
    At the scheduled completion slot, fall through to the established commit
    path. That is where Deafness checks, spoken incantations, invisibility
    breaking, and the R225 universal casting sound now occur.
  */
  if(action?.r230Completing){
    return r230BaseCommitSpellCast(
      caster,
      spell,
      action,
      durationMs
    );
  }

  /*
    Calls outside castPreparedCombatSpell retain their prior immediate behavior.
    This protects any diagnostic or future non-combat use that is not part of the
    tactical casting pipeline.
  */
  if(
    !r230CastContext ||
    r230CastContext.action!==action
  ){
    return r230BaseCommitSpellCast(
      caster,
      spell,
      action,
      durationMs
    );
  }

  if(action?.r230Scheduled){
    return false;
  }

  /*
    The spell leaves memory when casting begins. If casting is later disrupted,
    it remains lost exactly as the PHB specifies.
  */
  if(
    action?.type==="memorized-spell" &&
    !action.spellCommitted
  ){
    if(!mageConsumeMemorizedSpell(caster,spell.id)){
      setCombatMessage(
        `${spell.name} is no longer memorized.`
      );
      return false;
    }

    action.spellCommitted=true;
  }

  const record=r230ScheduleSpellCast(
    caster,
    spell,
    action,
    r230CastContext
  );

  if(!record){
    return false;
  }

  /*
    IMPORTANT: no incantation, no casting SFX, and no spell-specific sound here.
    Returning false stops the current spell resolver before its effect; the
    scheduled-cast finish hook below recognizes this as a delay, not a failure.
  */
  return false;
};


/* ============================================================
   BEGIN-CAST PRESENTATION
   ============================================================ */

const r230BaseFinishFailedSpellCommit=finishFailedSpellCommit;

finishFailedSpellCommit=async function(caster,action){
  if(
    action?.r230Scheduled &&
    !action?.r230Completing
  ){
    const record=
      r230CastingStore()[action.r230CastingToken];

    pendingAimAction=null;
    exitAimMode(false,false);

    /*
      spellCastInProgress is only the UI/action lock used by the immediate
      resolver. The durable casting state lives on the unit/record while other
      combatants take their initiative slots.
    */
    spellCastInProgress=false;

    if(!record){
      updateUi();
      draw();
      if(!game.over) endTurn();
      return true;
    }

    setUnitActionBanner(
      caster,
      `Casting ${record.spellName}`
    );

    setCombatMessage(
      `${caster.name} begins casting a spell...`,
      1000,
      1000
    );

    log(
      `${caster.name} begins casting ${record.spellName}; completion: ${r230CastingCompletionLabel(record)}.`,
      "system"
    );

    updateUi();
    draw();

    /*
      The requested one-second notice is purely presentation. It makes no sound.
      Initiative resumes immediately afterward.
    */
    await sleep(1000);

    if(
      !game.over &&
      r230CastingStore()[record.token] &&
      !record.disrupted
    ){
      endTurn();
    }

    return true;
  }

  return await r230BaseFinishFailedSpellCommit(
    caster,
    action
  );
};


/* ============================================================
   SYNTHETIC CAST-COMPLETION INITIATIVE SLOT
   ============================================================ */

async function r230ResolveCastingCompletion(record){
  if(!game || !record) return false;

  const caster=getUnitById(record.casterId);

  if(
    !caster?.alive ||
    caster.fled ||
    record.disrupted
  ){
    r230CancelCastingRecord(record);
    game.turnIndex++;
    game.active=null;
    beginTurn();
    return true;
  }

  record.resolving=true;

  if(caster.r230CastingToken===record.token){
    delete caster.r230CastingToken;
  }

  game.active=caster.id;

  if(
    caster.controller!=="mob" ||
    mobPositionVisibleToFriendlyParty(caster)
  ){
    centerCameraOn(caster);
  }

  setUnitActionBanner(
    caster,
    `Completing ${record.spellName}`
  );

  refreshTurnBanner();
  updateUi();
  draw();

  const action=record.action;
  action.r230Completing=true;
  action.r230Scheduled=false;

  spellCastInProgress=true;

  const targetUnit=
    record.targetUnitId
      ? getUnitById(record.targetUnitId)
      : null;

  let resolved=false;

  try{
    resolved=await r230BaseCastPreparedCombatSpell(
      action,
      record.targetHex
        ? {x:record.targetHex.x,y:record.targetHex.y}
        : {x:caster.x,y:caster.y},
      targetUnit
    );
  }finally{
    delete r230CastingStore()[record.token];

    if(caster.r230CastingToken===record.token){
      delete caster.r230CastingToken;
    }
  }

  /*
    Most successful spell resolvers call finishTestSpellCast() themselves and
    therefore advance initiative. Melf's Minute Meteors may deliberately enter
    its target-allocation state instead. If a target became illegal before the
    completion slot and the resolver simply returns false, consume the already
    committed spell and advance without deadlocking the round.
  */
  if(
    !resolved &&
    !game.over &&
    game.active===caster.id
  ){
    spellCastInProgress=false;

    setCombatMessage(
      `${caster.name}'s ${record.spellName} cannot complete and is lost.`,
      COMBAT_MESSAGE_MIN_HOLD_MS
    );

    log(
      `${caster.name}'s ${record.spellName} reaches its casting slot but cannot resolve its selected target/effect.`,
      "bad"
    );

    updateUi();
    draw();
    endTurn();
  }

  return true;
}


const r230BaseBeginTurn=beginTurn;

beginTurn=async function(){
  if(
    game &&
    !game.over &&
    game.turnIndex<game.order.length
  ){
    const slotId=game.order[game.turnIndex];
    const record=r230CastingStore()[slotId];

    if(record){
      return await r230ResolveCastingCompletion(record);
    }
  }

  return await r230BaseBeginTurn();
};


/* ============================================================
   INTERRUPTION: DAMAGE + FAILED SAVING THROWS
   ============================================================ */

const r230BaseOnUnitDamaged=onUnitDamaged;

onUnitDamaged=function(unit,damage){
  r230BaseOnUnitDamaged(unit,damage);

  if(
    Number(damage)>0 &&
    r230UnitIsCasting(unit)
  ){
    r230DisruptCasting(
      unit,
      `${Math.floor(Number(damage))} damage`
    );
  }
};


const r230BaseRollSpellSave=rollSpellSave;

rollSpellSave=function(
  target,
  sourceUnit=null,
  extraModifier=0
){
  const result=r230BaseRollSpellSave(
    target,
    sourceUnit,
    extraModifier
  );

  if(
    target &&
    !result.success &&
    r230UnitIsCasting(target)
  ){
    r230DisruptCasting(
      target,
      "a failed saving throw"
    );
  }

  return result;
};


/* ============================================================
   PHB CASTING DEFENSE: NO DEXTERITY AC BENEFIT
   ============================================================ */

const r230BaseEffectiveArmorClassForAttack=
  effectiveArmorClassForAttack;

effectiveArmorClassForAttack=function(
  attacker,
  defender,
  attackKind="melee"
){
  let ac=r230BaseEffectiveArmorClassForAttack(
    attacker,
    defender,
    attackKind
  );

  if(
    defender &&
    r230UnitIsCasting(defender)
  ){
    const position=
      attackPositionData(attacker,defender);

    if(!position.dexterityBonusDenied){
      const dexAdjustment=
        dexterityAdjustments(
          defender?.stats?.dex ?? 10
        ).defensive;

      /*
        Beneficial AD&D Dexterity AC adjustments are negative. Add that benefit
        back while casting, because the PHB says the caster cannot move to dodge
        and gains no Dexterity AC benefit.
      */
      if(dexAdjustment<0){
        ac-=dexAdjustment;
      }
    }
  }

  return Math.max(-10,Math.min(10,ac));
};


/* ============================================================
   PUBLIC DIAGNOSTICS
   ============================================================ */

window.AdventurePartyCastingTime={
  release:"R230",
  pending:r230CastingDebugState,
  isCasting:(unitOrId)=>{
    const unit=typeof unitOrId==="string"
      ? getUnitById(unitOrId)
      : unitOrId;
    return r230UnitIsCasting(unit);
  },
  disrupt:(unitOrId,reason="diagnostic interruption")=>{
    const unit=typeof unitOrId==="string"
      ? getUnitById(unitOrId)
      : unitOrId;
    return r230DisruptCasting(unit,reason);
  },
  initiative:()=>({...r230InitiativeStore()})
};
