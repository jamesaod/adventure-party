/*
  R229 — STORED MINUTE METEOR CAST UNLOCK
  ========================================
  Fixes the next-round UI state where a valid stored Minute Meteor pool could
  coexist with a stale generic spellCastInProgress lock. Melee attacks ignore
  that lock, but CAST does not, which made CAST appear grey until another action
  refreshed state.

  A stored Minute Meteor pool is already-cast magic. On a later round its
  manual RELEASE action must not be blocked by a stale generic cast lock.
*/

function r229StoredMeteorReleaseReady(caster=activePlayerControlledUnit()){
  if(!caster || !game || game.over) return false;
  if(!r228ManualMeteorCaster(caster)) return false;
  if(game.active!==caster.id) return false;

  const effect=r227MinuteMeteorEffect(caster);
  const remaining=r227MinuteMeteorRemaining(effect);

  if(!effect || remaining<=0) return false;
  if(effect.data?.lastVolleyRound===game.round) return false;
  if(pendingAimAction?.meteorVolley) return false;

  return true;
}

function r229ClearStoredMeteorCastLock(caster,reason="stored Minute Meteor release"){
  if(
    !r229StoredMeteorReleaseReady(caster) ||
    !spellCastInProgress ||
    pendingAimAction
  ){
    return false;
  }

  spellCastInProgress=false;
  log(
    `Cleared stale spell-cast lock for ${caster.name}: ${reason} is already-cast stored magic.`,
    "system"
  );
  return true;
}


/* ============================================================
   UI: STORED METEORS MAY ENABLE CAST WITHOUT FIRST ATTACKING
   ============================================================ */

const r229BaseUpdateUi=updateUi;
updateUi=function(){
  r229BaseUpdateUi();

  const caster=activePlayerControlledUnit();
  const castButton=document.getElementById("castButton");

  if(
    castButton &&
    r229StoredMeteorReleaseReady(caster) &&
    !isCombatActionPauseActive() &&
    !freeStrikeInProgress &&
    !aimMode
  ){
    /*
      Do not require another combat action merely to shake loose a stale
      spellCastInProgress flag. The release pool has already been created and
      paid for by the original spell cast.
    */
    castButton.disabled=false;

    const effect=r227MinuteMeteorEffect(caster);
    const remaining=r227MinuteMeteorRemaining(effect);

    castButton.title=
      remaining===1
        ? "1 stored Minute Meteor ready to release"
        : `${remaining} stored Minute Meteors ready to release`;

    castButton.setAttribute(
      "aria-label",
      remaining===1
        ? "Cast menu; 1 stored Minute Meteor ready to release"
        : `Cast menu; ${remaining} stored Minute Meteors ready to release`
    );
  }
};


/* ============================================================
   OPEN CAST MENU: CLEAR ONLY THE STALE LOCK FOR STORED METEORS
   ============================================================ */

const r229BaseOpenSpellCastOverlay=openSpellCastOverlay;
openSpellCastOverlay=function(){
  const caster=activePlayerControlledUnit();

  if(
    r229StoredMeteorReleaseReady(caster) &&
    spellCastInProgress &&
    !pendingAimAction
  ){
    r229ClearStoredMeteorCastLock(
      caster,
      "next-round manual release"
    );
  }

  return r229BaseOpenSpellCastOverlay();
};


/* ============================================================
   TURN START: NORMALIZE BEFORE THE PLAYER RECEIVES CONTROL
   ============================================================ */

const r229BaseHandleTurnControlEffects=handleTurnControlEffects;
handleTurnControlEffects=async function(actor){
  const handled=await r229BaseHandleTurnControlEffects(actor);
  if(handled) return true;

  if(
    r228ManualMeteorCaster(actor) &&
    r227MinuteMeteorRemaining(r227MinuteMeteorEffect(actor))>0 &&
    r227MinuteMeteorEffect(actor)?.data?.lastVolleyRound!==game.round &&
    !pendingAimAction
  ){
    r229ClearStoredMeteorCastLock(
      actor,
      "turn-start stored release"
    );
    updateUi();
  }

  return false;
};


/* ============================================================
   DIAGNOSTICS
   ============================================================ */

if(window.AdventurePartyLevel3Spells){
  window.AdventurePartyLevel3Spells.release="R229";
  window.AdventurePartyLevel3Spells.minuteMeteorCastGate=()=>{
    const caster=activePlayerControlledUnit() || game?.player;
    const effect=caster ? r227MinuteMeteorEffect(caster) : null;
    return {
      casterId:caster?.id || null,
      remaining:r227MinuteMeteorRemaining(effect),
      lastVolleyRound:effect?.data?.lastVolleyRound ?? null,
      currentRound:game?.round ?? null,
      spellCastInProgress:!!spellCastInProgress,
      pendingAimActionType:pendingAimAction?.type || null,
      activeUnitId:game?.active || null,
      releaseReady:r229StoredMeteorReleaseReady(caster)
    };
  };
}
