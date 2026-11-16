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


function r230ScheduleSpellCast(caster,spell,action,context){
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
