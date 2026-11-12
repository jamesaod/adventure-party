/*
  R231 — COMPLETION-TIME TARGETING HOOKS
  =======================================
  Loaded after R230 so player and automated spellcasting acquire tactical
  targets only when the casting-time interval has finished.
*/


/* ============================================================
   PLAYER SPELL SELECTION: CHOOSE SPELL NOW, AIM LATER
   ============================================================ */

const r231BaseBeginMageCombatSpell=AdventurePartyCombatServices.current('beginMageCombatSpell');

AdventurePartyCombatServices.register('beginMageCombatSpell','r231-target-at-completion-hooks.js:16:beginMageCombatSpell',function(spellId){
  const spell=getSpellEntry(spellId);
  const caster=activePlayerControlledUnit();
  if(isCarlCombatTestOverride(caster)) return r231BaseBeginMageCombatSpell(spellId);

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
});


const r231BaseBeginCombatTestSpell=AdventurePartyCombatServices.current('beginCombatTestSpell');

AdventurePartyCombatServices.register('beginCombatTestSpell','r231-target-at-completion-hooks.js:54:beginCombatTestSpell',function(spellId){
  const spell=getSpellEntry(spellId);
  const caster=activePlayerControlledUnit();
  if(isCarlCombatTestOverride(caster)) return r231BaseBeginCombatTestSpell(spellId);

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
});


/* ============================================================
   SCROLL SPELLS: DEFER AIM UNTIL THE SCROLL'S SPELL IS READY
   ============================================================ */

const r231BaseUseInventoryItem=AdventurePartyCombatServices.current('useInventoryItem');

AdventurePartyCombatServices.register('useInventoryItem','r231-target-at-completion-hooks.js:95:useInventoryItem',function(index){
  const fighter=game?.player;
  if(isCarlCombatTestOverride(fighter)) return r231BaseUseInventoryItem(index);
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
});


/* ============================================================
   AUTOMATED CASTERS: DISCARD THE START-OF-CAST TARGET SNAPSHOT
   ============================================================ */




/* ============================================================
   CAST COMPLETION: ACQUIRE THE TACTICAL TARGET NOW
   ============================================================ */




/* ============================================================
   PLAYER TARGET ACCEPTANCE: CLEAN UP ONLY AFTER A VALID CAST
   ============================================================ */




/* ============================================================
   ESC AT COMPLETION: FORGO THE ALREADY-COMMITTED SPELL
   ============================================================ */

const r231BaseExitAimMode=AdventurePartyCombatServices.current('exitAimMode');

AdventurePartyCombatServices.register('exitAimMode','r231-target-at-completion-hooks.js:171:exitAimMode',function(...args){return cancelCompletionAim(r231BaseExitAimMode,...args);});


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
