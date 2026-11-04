/*
  R228 — MINUTE METEOR REMAINDER RECOVERY
  =========================================
  Hardens the R227 stored-meteor release path, especially the common level-6
  case where the first five-meteor volley leaves exactly one meteor for the
  following round.
*/

function r228StoredMinuteMeteorState(caster=activePlayerControlledUnit()){
  const effect=caster ? r227MinuteMeteorEffect(caster) : null;
  const remaining=r227MinuteMeteorRemaining(effect);
  return {caster,effect,remaining};
}

function r228ManualMeteorCaster(caster){
  return !!(
    caster?.alive &&
    isPlayerControlledUnit(caster) &&
    !isQuickCommandUnit(caster)
  );
}


/* ============================================================
   NEXT-TURN RECOVERY
   ============================================================ */

const r228BaseHandleTurnControlEffects=handleTurnControlEffects;
handleTurnControlEffects=async function(actor){
  const handled=await r228BaseHandleTurnControlEffects(actor);
  if(handled) return true;

  const {effect,remaining}=r228StoredMinuteMeteorState(actor);

  if(
    r228ManualMeteorCaster(actor) &&
    effect &&
    remaining>0 &&
    !pendingAimAction?.meteorVolley
  ){
    /*
      A stored meteor pool is not an in-progress cast. If an earlier resolution
      path left the generic spell lock raised, clear only that stale lock at the
      start of this caster's next usable turn.
    */
    if(spellCastInProgress){
      spellCastInProgress=false;
      log(
        `Recovered stored Minute Meteor action state for ${actor.name}; ${remaining} meteor${remaining===1?"":"s"} remain.`,
        "system"
      );
    }

    setCombatMessage(
      remaining===1
        ? `${actor.name} has 1 Minute Meteor remaining — use CAST → Release Minute Meteor.`
        : `${actor.name} has ${remaining} Minute Meteors remaining — use CAST → Release Minute Meteors.`,
      0,
      COMBAT_MESSAGE_DISPLAY_MS
    );

    updateUi();
    draw();
  }

  return false;
};


/* ============================================================
   CAST MENU: ALWAYS EXPOSE ANY POSITIVE REMAINDER
   ============================================================ */

const r228BaseRenderSpellCastList=renderSpellCastList;
renderSpellCastList=function(){
  r228BaseRenderSpellCastList();

  const {caster,effect,remaining}=r228StoredMinuteMeteorState(
    activePlayerControlledUnit()
  );

  if(
    !r228ManualMeteorCaster(caster) ||
    !effect ||
    remaining<=0
  ){
    return;
  }

  const list=document.getElementById("spellCastList");
  const subtitle=document.getElementById("spellCastSubtitle");
  if(!list) return;

  /*
    Stored meteors are an already-cast resource, not another memorized casting.
    Remove any ordinary Melf entry and rebuild one authoritative release action.
  */
  for(const button of list.querySelectorAll(
    '[data-cast-spell="melfs-minute-meteors"]'
  )){
    button.remove();
  }

  for(const empty of list.querySelectorAll(".sheet-item")){
    if(/No combat-ready spells memorized/i.test(empty.textContent || "")){
      empty.remove();
    }
  }

  const volley=Math.min(5,remaining);
  const button=document.createElement("button");
  button.className="spell-cast-choice";
  button.type="button";
  button.dataset.castSpell="melfs-minute-meteors";
  button.dataset.minuteMeteorsRelease="true";
  button.innerHTML=
    `<b>Release Minute Meteor${remaining===1?"":"s"} — ${remaining} remaining</b>`+
    `<span>Assign ${volley} target${volley===1?"":"s"}; repeated targets allowed</span>`+
    `<span>All ${volley} launch together after the final target is selected</span>`;

  list.prepend(button);

  if(subtitle && !/Stored Minute Meteors:/i.test(subtitle.textContent || "")){
    subtitle.textContent=
      `${subtitle.textContent} Stored Minute Meteors: ${remaining} remaining; release manually.`;
  }
};


/* ============================================================
   RELEASE ROUTING: STORED POOL ALWAYS WINS
   ============================================================ */

const r228BaseBeginSelectedCombatSpell=beginSelectedCombatSpell;
beginSelectedCombatSpell=function(spellId){
  const caster=activePlayerControlledUnit();

  if(
    spellId==="melfs-minute-meteors" &&
    r228ManualMeteorCaster(caster)
  ){
    const effect=r227MinuteMeteorEffect(caster);
    const remaining=r227MinuteMeteorRemaining(effect);

    if(effect && remaining>0){
      if(effect.data?.lastVolleyRound===game.round){
        setCombatMessage(
          `${caster.name} has already released Minute Meteors this round.`
        );
        return false;
      }

      spellCastInProgress=false;
      return r227BeginMinuteMeteorTargeting(caster,effect);
    }
  }

  return r228BaseBeginSelectedCombatSpell(spellId);
};


/* ============================================================
   UI HINT + DIAGNOSTICS
   ============================================================ */

const r228BaseUpdateUi=updateUi;
updateUi=function(){
  r228BaseUpdateUi();

  const {caster,remaining}=r228StoredMinuteMeteorState(
    activePlayerControlledUnit()
  );
  const castButton=document.getElementById("castButton");

  if(
    castButton &&
    r228ManualMeteorCaster(caster) &&
    remaining>0 &&
    !isSpellTargetingMode()
  ){
    castButton.setAttribute(
      "aria-label",
      remaining===1
        ? "Cast menu; 1 stored Minute Meteor ready to release"
        : `Cast menu; ${remaining} stored Minute Meteors ready to release`
    );
    castButton.title=
      remaining===1
        ? "1 stored Minute Meteor ready"
        : `${remaining} stored Minute Meteors ready`;
  }
};

if(window.AdventurePartyLevel3Spells){
  window.AdventurePartyLevel3Spells.release="R228";
  window.AdventurePartyLevel3Spells.minuteMeteorRemainder=()=>{
    const {caster,effect,remaining}=r228StoredMinuteMeteorState(
      activePlayerControlledUnit() || game?.player
    );
    return {
      casterId:caster?.id || null,
      remaining,
      hasStoredEffect:!!effect,
      lastVolleyRound:effect?.data?.lastVolleyRound ?? null,
      currentRound:game?.round ?? null,
      manualReleaseAvailable:!!(
        caster &&
        r228ManualMeteorCaster(caster) &&
        effect &&
        remaining>0 &&
        effect.data?.lastVolleyRound!==game?.round
      ),
      spellCastInProgress:!!spellCastInProgress,
      targeting:!!pendingAimAction?.meteorVolley
    };
  };
}
