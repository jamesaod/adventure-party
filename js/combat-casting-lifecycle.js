/* Spell casting lifecycle owner. Legacy r230/r231 names remain compatible.
 * Records, timing, resource consumption, interruption, completion and target selection
 * are defined here; hook files adapt existing engine services in their original order.
 * Classic-script module using shared engine services; no new clock or frame loop. */
/*
  R230 — AD&D 2E CASTING-TIME INITIATIVE
  =======================================
  Implements the Player's Handbook casting-time delay model on top of the
  existing Adventure Party turn engine.

  Numeric casting times:
    completion initiative = caster initiative + Casting Time.

  "1 round" casting times:
    resolve at the end of the current round.

  Multi-round / turn casting times:
    the caster remains occupied through the required rounds and resolves at the
    end of the final casting round.

  The spell is committed to memory when casting begins, but incantation, R225
  casting SFX, and spell resolution occur only at completion. Damage or a failed
  saving throw before completion disrupts and loses the spell.
*/

const R230_CAST_TOKEN_PREFIX="r230-cast:";
let r230CastSequence=0;
let r230CastContext=null;


function r230CastingStore(){
  if(!game) return {};
  if(!game.r230Castings || typeof game.r230Castings!=="object"){
    game.r230Castings={};
  }
  return game.r230Castings;
}


function r230InitiativeStore(){
  if(!game) return {};
  if(!game.r230InitiativeByUnit || typeof game.r230InitiativeByUnit!=="object"){
    game.r230InitiativeByUnit={};
  }
  return game.r230InitiativeByUnit;
}


function r230CastingTimeSpec(spell){
  const raw=spell?.castingTime;

  if(Number.isFinite(Number(raw)) && String(raw).trim()!==""){
    return {
      kind:"initiative",
      value:Math.max(0,Number(raw)),
      label:String(raw)
    };
  }

  const text=String(raw ?? "").trim().toLowerCase();

  let match=text.match(/^(\d+)\s*rounds?$/);
  if(match){
    return {
      kind:"rounds",
      rounds:Math.max(1,Number(match[1])||1),
      label:String(raw)
    };
  }

  match=text.match(/^(\d+)\s*turns?$/);
  if(match){
    return {
      kind:"rounds",
      rounds:Math.max(1,(Number(match[1])||1)*10),
      label:String(raw)
    };
  }

  /*
    Combat-ready spells should normally use one of the PHB forms above.
    Unknown/special casting-time text resolves at the caster's current slot so
    a future spell is not silently broken by the scheduler.
  */
  return {
    kind:"initiative",
    value:0,
    label:String(raw ?? "0")
  };
}


function r230CastingRecordForUnit(unit){
  if(!unit?.r230CastingToken || !game) return null;
  return r230CastingStore()[unit.r230CastingToken] || null;
}


function r230UnitIsCasting(unit){
  const record=r230CastingRecordForUnit(unit);
  return !!(
    record &&
    !record.disrupted &&
    !record.resolving
  );
}


function r230CastingCompletionLabel(record){
  if(!record) return "";

  if(record.completeRound>record.startRound){
    return `end of round ${record.completeRound}`;
  }

  if(record.endOfRound){
    return "end of this round";
  }

  return `initiative ${record.completeInitiative}`;
}


function r230NewCastToken(caster){
  r230CastSequence++;
  return (
    R230_CAST_TOKEN_PREFIX+
    String(caster?.id || "caster")+
    ":"+
    String(game?.round || 0)+
    ":"+
    String(r230CastSequence)
  );
}


function r230OrderInitiativeForId(id){
  const castRecord=r230CastingStore()[id];
  if(castRecord){
    return Number.isFinite(castRecord.completeInitiative)
      ? castRecord.completeInitiative
      : 9999;
  }

  const entry=r230InitiativeStore()[id];
  return Number.isFinite(entry?.roll)
    ? entry.roll
    : 9999;
}


function r230InsertCurrentRoundCompletion(record){
  if(
    !game ||
    !record ||
    record.completeRound!==game.round ||
    game.order.includes(record.token)
  ){
    return false;
  }

  if(record.endOfRound){
    game.order.push(record.token);
    return true;
  }

  let insertAt=game.order.length;

  for(let index=game.turnIndex+1;index<game.order.length;index++){
    const candidateId=game.order[index];
    const candidateInitiative=r230OrderInitiativeForId(candidateId);

    /*
      Equal modified initiative remains deterministic in the current sequential
      engine: the already-listed actor resolves first, then the spell. This
      preserves a real interruption opportunity instead of granting the caster
      an artificial tie advantage.
    */
    if(candidateInitiative>record.completeInitiative){
      insertAt=index;
      break;
    }
  }

  game.order.splice(insertAt,0,record.token);
  return true;
}


function r230RemoveCompletionToken(token){
  if(!game || !token) return;

  const index=game.order.indexOf(token);
  if(index<0) return;

  /*
    A disruption normally removes a future token. If a defensive edge case ever
    removes the currently active token, do not shift the current index backward.
  */
  game.order.splice(index,1);
  if(index<game.turnIndex){
    game.turnIndex=Math.max(0,game.turnIndex-1);
  }
}


function createSpellCastingRecord(caster,spell,action,context){
  if(!game || !caster?.alive || !spell || !action || !context){
    return null;
  }

  const spec=r230CastingTimeSpec(spell);
  const initiativeEntry=r230InitiativeStore()[caster.id] || {};
  const baseInitiative=Number.isFinite(initiativeEntry.roll)
    ? Number(initiativeEntry.roll)
    : Math.max(1,game.turnIndex+1);

  const token=r230NewCastToken(caster);

  const record={
    token,
    casterId:caster.id,
    spellId:spell.id,
    spellName:spell.name,
    action,
    targetHex:context.targetHex
      ? {x:context.targetHex.x,y:context.targetHex.y}
      : null,
    targetUnitId:context.targetUnitId || null,
    startRound:game.round,
    startInitiative:baseInitiative,
    castingTimeRaw:spell.castingTime,
    castingTimeLabel:spec.label,
    completeRound:game.round,
    completeInitiative:baseInitiative,
    endOfRound:false,
    disrupted:false,
    resolving:false,
    startedAt:performance.now()
  };

  if(spec.kind==="rounds"){
    record.completeRound=
      game.round+
      Math.max(1,spec.rounds)-
      1;
    record.completeInitiative=9999;
    record.endOfRound=true;
  }else{
    record.completeInitiative=
      baseInitiative+
      Math.max(0,Number(spec.value)||0);
  }

  r230CastingStore()[token]=record;
  caster.r230CastingToken=token;

  /*
    Same-round completions are inserted immediately. Longer castings are added
    by the initiative wrapper when their final casting round begins.
  */
  r230InsertCurrentRoundCompletion(record);

  action.r230Scheduled=true;
  action.r230CastingToken=token;
  action.r230CastingTime=spell.castingTime;

  return record;
}


function r230CancelCastingRecord(record){
  if(!record || !game) return;

  const caster=getUnitById(record.casterId);
  if(caster?.r230CastingToken===record.token){
    delete caster.r230CastingToken;
  }

  r230RemoveCompletionToken(record.token);
  delete r230CastingStore()[record.token];
}


function r230DisruptCasting(unit,reason="interruption"){
  const record=r230CastingRecordForUnit(unit);

  if(
    !record ||
    record.resolving ||
    record.disrupted
  ){
    return false;
  }

  record.disrupted=true;
  r230CancelCastingRecord(record);

  spellCastInProgress=false;

  setCombatMessage(
    `${unit.name}'s spell has been interrupted.`,
    COMBAT_MESSAGE_MIN_HOLD_MS,
    COMBAT_MESSAGE_DISPLAY_MS,
    unit.id==="player" ? "player-damage" : "normal"
  );

  log(
    `${unit.name}'s ${record.spellName} has been interrupted by ${reason}; the spell is lost.`,
    "bad"
  );

  updateUi();
  draw();
  return true;
}


function r230PendingCastings(){
  return Object.values(r230CastingStore())
    .filter(record=>
      record &&
      !record.disrupted
    );
}


function r230CastingDebugState(){
  return r230PendingCastings().map(record=>({
    token:record.token,
    casterId:record.casterId,
    spellId:record.spellId,
    spellName:record.spellName,
    startRound:record.startRound,
    startInitiative:record.startInitiative,
    completeRound:record.completeRound,
    completeInitiative:record.completeInitiative,
    endOfRound:record.endOfRound,
    completion:r230CastingCompletionLabel(record),
    resolving:record.resolving
  }));
}

/*
  R231 — TARGET SPELLS AT CAST COMPLETION
  ========================================
  Spell choice is declared when casting begins. Tactical aim/target selection
  is deferred until the spell reaches its casting-time completion slot.

  Player flow:
    choose spell -> casting interval -> completion slot -> AIM -> resolve

  Self-only spells resolve automatically at completion.
*/

function r231SpellNeedsAim(spell){
  return !!spell && spell.targetMode!=="self";
}

function r231PlayerDirectsCompletionTarget(caster){
  return !!(
    caster?.alive &&
    isPlayerControlledUnit(caster) &&
    !isQuickCommandUnit(caster)
  );
}

function r231CleanupCompletionRecord(token,caster=null){
  if(!token || !game) return false;

  const store=r230CastingStore();
  const record=store[token] || null;
  const resolvedCaster=
    caster ||
    (record?.casterId ? getUnitById(record.casterId) : null);

  if(resolvedCaster?.r230CastingToken===token){
    delete resolvedCaster.r230CastingToken;
  }

  /*
    Do not splice the synthetic token out of game.order while it is the active
    slot. endTurn() must advance past that slot normally.
  */
  delete store[token];
  return !!record;
}

function r231BeginCastingWithoutTarget(
  caster,
  spell,
  action
){
  if(
    !game ||
    game.over ||
    !caster?.alive ||
    !spell ||
    !action
  ){
    return false;
  }

  if(r230UnitIsCasting(caster)){
    setCombatMessage(
      `${caster.name} is already casting a spell.`
    );
    return false;
  }

  /*
    The PHB interruption rule loses the memorized spell if casting is broken, so
    a memorized spell is removed at the instant casting begins.
  */
  if(
    action.type==="memorized-spell" &&
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

  closeSpellCastOverlay();
  closeCharacterSheet();
  pendingAimAction=null;
  exitAimMode(false,false);

  action.r231DeferredTarget=
    r231SpellNeedsAim(spell);

  const record=r230ScheduleSpellCast(
    caster,
    spell,
    action,
    {
      targetHex:null,
      targetUnitId:null
    }
  );

  if(!record){
    return false;
  }

  /*
    Casting start is intentionally silent. No incantation, generic casting SFX,
    casting glow, projectile, or spell-specific sound occurs here.
  */
  spellCastInProgress=false;

  setUnitActionBanner(
    caster,
    "Casting Spell"
  );

  setCombatMessage(
    `${caster.name} begins casting a spell...`,
    1000,
    1000
  );

  log(
    `${caster.name} begins casting ${spell.name}; target selection is deferred until ${r230CastingCompletionLabel(record)}.`,
    "system"
  );

  updateUi();
  draw();

  const token=record.token;

  setTimeout(()=>{
    const live=
      game &&
      r230CastingStore()[token];

    if(
      !game?.over &&
      live &&
      !live.disrupted &&
      !live.resolving &&
      game.active===caster.id
    ){
      endTurn();
    }
  },1000);

  return true;
}


function r231CompletionTargetPrompt(
  spell,
  caster
){
  if(spell?.id==="wall-of-fog"){
    const autoOrientation=
      wallOfFogAutoOrientationIndex(
        caster,
        aimCursor
      );

    return (
      `${spell.name} is ready: AIM the center, then use the mouse wheel `+
      `to rotate (${wallOfFogOrientationLabel(autoOrientation)}).`
    );
  }

  return (
    `${spell.name} is ready: `+
    `${testSpellTargetPrompt(spell)}.`
  );
}


function r231BeginCompletionAim(
  record,
  caster,
  spell
){
  if(
    !record ||
    !caster?.alive ||
    !spell ||
    !game
  ){
    return false;
  }

  record.resolving=true;
  record.awaitingTarget=true;

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

  const action=record.action;

  action.r230Completing=true;
  action.r230Scheduled=false;
  action.r231DeferredTarget=true;
  action.r231CompletionTargeting=true;
  action.r231CastingToken=record.token;

  pendingAimAction=action;

  /*
    AIM mode itself is not an in-progress spell effect. The actual spell
    resolver will raise spellCastInProgress when the target is accepted.
  */
  spellCastInProgress=false;

  setUnitActionBanner(
    caster,
    `Completing ${spell.name}`
  );

  enterAimMode();

  setCombatMessage(
    r231CompletionTargetPrompt(
      spell,
      caster
    ),
    0,
    0
  );

  log(
    `${caster.name} completes the casting time for ${spell.name} and now chooses the spell's target.`,
    "system"
  );

  updateUi();
  draw();
  return true;
}


function r231VisibleHostilesFor(
  caster,
  spell
){
  const level=Math.max(
    1,
    Number(caster?.level) ||
    TEST_SPELL_CASTER_LEVEL
  );

  const range=spell
    ? spellRangeHexes(spell,level)
    : Infinity;

  return hostileCombatantsFor(caster)
    .filter(target=>
      target?.alive &&
      !target.fled &&
      unitDistance(caster,target)<=range &&
      (
        typeof unitVisibleToObserver!=="function" ||
        unitVisibleToObserver(caster,target)
      ) &&
      !lineOfSightBlocked(caster,target)
    )
    .sort((a,b)=>
      unitDistance(caster,a)-unitDistance(caster,b) ||
      a.hp-b.hp ||
      a.id.localeCompare(b.id)
    );
}


function r231ChooseAutomatedCompletionTarget(
  caster,
  spell
){
  if(!caster || !spell) return null;

  if(spell.targetMode==="self"){
    return {
      targetHex:{x:caster.x,y:caster.y},
      targetUnit:caster
    };
  }

  /*
    Current Mage/Quick AI specifically selects Fireball, Sleep, and Magic
    Missile. Re-evaluate their tactical choice now rather than using the map
    snapshot from the beginning of casting.
  */
  if(
    spell.id==="fireball" &&
    typeof bestSafeFireballTarget==="function"
  ){
    const blast=
      bestSafeFireballTarget(caster,caster);

    if(blast){
      return {
        targetHex:{x:blast.x,y:blast.y},
        targetUnit:null
      };
    }
  }

  if(
    spell.id==="sleep" &&
    typeof bestSafeSleepTarget==="function"
  ){
    const sleepTarget=
      bestSafeSleepTarget(caster,caster);

    if(sleepTarget){
      return {
        targetHex:{
          x:sleepTarget.x,
          y:sleepTarget.y
        },
        targetUnit:null
      };
    }
  }

  const hostiles=
    r231VisibleHostilesFor(
      caster,
      spell
    );

  const target=hostiles[0] || null;
  if(!target) return null;

  if(
    spell.targetMode==="adjacent-hostile" &&
    !canMeleeReach(caster,target)
  ){
    return null;
  }

  if(
    [
      "hostile-creature",
      "adjacent-hostile",
      "creature",
      "touch-creature"
    ].includes(spell.targetMode)
  ){
    return {
      targetHex:{x:target.x,y:target.y},
      targetUnit:target
    };
  }

  /*
    Directional and ground spells use the current hostile position as the aim
    point. The spell resolver still performs its normal range/LOS/geometry
    validation at completion.
  */
  return {
    targetHex:{x:target.x,y:target.y},
    targetUnit:null
  };
}

function r230ScheduleSpellCast(
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

  const record=createSpellCastingRecord(
    caster,
    spell,
    action,
    schedulingContext
  );
  if(record&&caster&&typeof r236ShowBeginsCastingText==='function')r236ShowBeginsCastingText(caster);
  return record;
}
async function r230ResolveCastingCompletion(record){
  if(!record){
    return false;
  }

  const caster=getUnitById(record.casterId);
  const spell=getSpellEntry(record.spellId);

  if(
    !record.action?.r231DeferredTarget ||
    !r231SpellNeedsAim(spell)
  ){
    return await completeSpellCastingEffect(
      record
    );
  }

  if(
    !caster?.alive ||
    caster.fled ||
    record.disrupted
  ){
    return await completeSpellCastingEffect(
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

  return await completeSpellCastingEffect(
    record
  );
}
async function completeSpellCastingEffect(record){
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
    resolved=await dispatchPreparedSpellEffect(
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


function beginScheduledSpellCast(fallback,
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
  if(typeof isCarlCombatTestOverride==='function'&&isCarlCombatTestOverride(caster)){
    return fallback(caster,spell,action,0);
  }
  if(action?.r230Completing){
    return fallback(
      caster,
      spell,
      action,
      durationMs
    );
  }

  /*
    Calls outside resolvePreparedSpellAction retain their prior immediate behavior.
    This protects any diagnostic or future non-combat use that is not part of the
    tactical casting pipeline.
  */
  if(
    !r230CastContext ||
    r230CastContext.action!==action
  ){
    return fallback(
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
}

async function presentScheduledSpellStart(fallback,caster,action){
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

  return await fallback(
    caster,
    action
  );
}
function cancelCompletionAim(fallback,
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
    fallback(
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
}

// Initiative adapter owned by casting state; ordinary actor ordering stays in turn flow.
function castingInitiativeSlots(rolled){

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
}
