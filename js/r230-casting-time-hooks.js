/*
  R230 — CASTING-TIME ENGINE HOOKS
  =================================
  Adapters for the existing initiative, commit, damage/save and armor services.
  State transitions and targeting belong to combat-casting-lifecycle.js.
*/


/* ============================================================
   INITIATIVE STORAGE + FUTURE-ROUND CASTING SLOTS
   ============================================================ */




/* ============================================================
   SPELL DISPATCH CONTEXT
   ============================================================ */




/* ============================================================
   COMMIT NOW MEANS "BEGIN CASTING"; COMPLETION COMMITS EFFECT
   ============================================================ */

const r230BaseCommitSpellCast=AdventurePartyCombatServices.current('commitSpellCast');

AdventurePartyCombatServices.register('commitSpellCast','r230-casting-time-hooks.js:29:commitSpellCast',function(...args){return beginScheduledSpellCast(r230BaseCommitSpellCast,...args);});


/* ============================================================
   BEGIN-CAST PRESENTATION
   ============================================================ */

const r230BaseFinishFailedSpellCommit=AdventurePartyCombatServices.current('finishFailedSpellCommit');

AdventurePartyCombatServices.register('finishFailedSpellCommit','r230-casting-time-hooks.js:38:finishFailedSpellCommit',async function(...args){return presentScheduledSpellStart(r230BaseFinishFailedSpellCommit,...args);});


/* ============================================================
   SYNTHETIC CAST-COMPLETION INITIATIVE SLOT
   ============================================================ */





/* ============================================================
   INTERRUPTION: DAMAGE + FAILED SAVING THROWS
   ============================================================ */

const r230BaseOnUnitDamaged=AdventurePartyCombatServices.current('onUnitDamaged');

AdventurePartyCombatServices.register('onUnitDamaged','r230-casting-time-hooks.js:55:onUnitDamaged',function(unit,damage){
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
});


const r230BaseRollSpellSave=AdventurePartyCombatServices.current('rollSpellSave');

AdventurePartyCombatServices.register('rollSpellSave','r230-casting-time-hooks.js:72:rollSpellSave',function(
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
});


/* ============================================================
   PHB CASTING DEFENSE: NO DEXTERITY AC BENEFIT
   ============================================================ */

const r230BaseEffectiveArmorClassForAttack=AdventurePartyCombatServices.current('effectiveArmorClassForAttack');

AdventurePartyCombatServices.register('effectiveArmorClassForAttack','r230-casting-time-hooks.js:105:effectiveArmorClassForAttack',function(
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
});


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
