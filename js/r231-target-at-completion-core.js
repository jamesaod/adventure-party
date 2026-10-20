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
