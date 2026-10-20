/*
  R233 — SPELL PRESENTATION AUDIT CORE
  ====================================
  Shared presentation contract for every implemented spell:
    1) begin from the caster
    2) hand camera focus to the target / impact point
    3) keep each result readable before advancing

  Spell-specific multi-hit and attack-roll overrides live in companion R233
  modules; this core provides the universal camera/pacing helpers.
*/

const R233_CASTER_FOCUS_MS=180;
const R233_TARGET_SETTLE_MS=110;
const R233_RESULT_HOLD_MS=Math.max(
  850,
  Number(COMBAT_MESSAGE_MIN_HOLD_MS)||0
);

let r233SpellPresentationState={
  casterId:null,
  spellId:null,
  casterFocusedAt:0,
  targetId:null,
  targetHex:null
};


function r233IsCombatSpellAction(action){
  return !!(
    action &&
    action.spellId &&
    game &&
    !game.over &&
    currentScreen==="combat"
  );
}


async function r233FocusCaster(caster,spellId=null,holdMs=R233_CASTER_FOCUS_MS){
  if(
    !caster?.alive ||
    game?.over ||
    currentScreen!=="combat"
  ){
    return false;
  }

  centerCameraOn(caster);
  hoverHex=null;

  r233SpellPresentationState={
    casterId:caster.id,
    spellId:spellId || null,
    casterFocusedAt:performance.now(),
    targetId:null,
    targetHex:null
  };

  updateUi();
  draw();

  if(holdMs>0){
    await sleep(holdMs);
  }

  return true;
}


async function r233FocusTarget(targetOrHex,settleMs=R233_TARGET_SETTLE_MS){
  if(
    !targetOrHex ||
    !Number.isFinite(targetOrHex.x) ||
    !Number.isFinite(targetOrHex.y) ||
    game?.over ||
    currentScreen!=="combat"
  ){
    return false;
  }

  centerCameraOn(targetOrHex);
  hoverHex=null;

  r233SpellPresentationState.targetId=
    targetOrHex.id || null;

  r233SpellPresentationState.targetHex={
    x:targetOrHex.x,
    y:targetOrHex.y
  };

  updateUi();
  draw();

  if(settleMs>0){
    await sleep(settleMs);
  }

  return true;
}


function r233FocusTargetNow(targetOrHex){
  if(
    !targetOrHex ||
    !Number.isFinite(targetOrHex.x) ||
    !Number.isFinite(targetOrHex.y) ||
    game?.over ||
    currentScreen!=="combat"
  ){
    return false;
  }

  centerCameraOn(targetOrHex);
  hoverHex=null;

  r233SpellPresentationState.targetId=
    targetOrHex.id || null;

  r233SpellPresentationState.targetHex={
    x:targetOrHex.x,
    y:targetOrHex.y
  };

  updateUi();
  draw();
  return true;
}


async function r233PresentMiss(
  caster,
  target,
  spellName,
  detail=""
){
  if(target){
    await r233FocusTarget(target);
  }

  playMissSound();

  const targetName=
    target?.name || "the target";

  setCombatMessage(
    (caster?.name || "The caster")+
    "'s "+
    spellName+
    " misses "+
    targetName+
    (detail ? " — "+detail : "")+
    ".",
    R233_RESULT_HOLD_MS,
    R233_RESULT_HOLD_MS
  );

  log(
    (caster?.name || "The caster")+
    "'s "+
    spellName+
    " misses "+
    targetName+
    (detail ? " ("+detail+")" : "")+
    ".",
    "system"
  );

  await waitForCombatActionPause();
}


async function r233PresentNegated(
  caster,
  target,
  spellName,
  reason
){
  if(target){
    await r233FocusTarget(target);
  }

  setCombatMessage(
    (target?.name || "The target")+
    " negates "+
    spellName+
    (reason ? " — "+reason : "")+
    ".",
    R233_RESULT_HOLD_MS,
    R233_RESULT_HOLD_MS
  );

  await waitForCombatActionPause();
}


async function r233ApplySpellDamageBeat(
  caster,
  target,
  damage,
  spellName,
  damageType="magic",
  {
    message=null,
    holdMs=R233_RESULT_HOLD_MS
  }={}
){
  if(!target) return {damage:0,killed:false};

  await r233FocusTarget(target);

  const result=applySpellDamage(
    caster,
    target,
    damage,
    spellName,
    damageType
  );

  if(message && !result.killed){
    setCombatMessage(
      message,
      holdMs,
      holdMs,
      target.id==="player"
        ? "player-damage"
        : "normal"
    );
  }

  await waitForCombatActionPause();
  return result;
}


/* ============================================================
   UNIVERSAL CASTER-FIRST HANDOFF
   ============================================================ */

const r233BaseCastPreparedCombatSpell=
  castPreparedCombatSpell;

castPreparedCombatSpell=async function(
  action,
  targetHex,
  targetUnit
){
  const caster=
    spellCasterForAction(action);

  if(
    r233IsCombatSpellAction(action) &&
    caster?.alive &&
    !action.r233SkipCasterFocus
  ){
    await r233FocusCaster(
      caster,
      action.spellId
    );
  }

  return await r233BaseCastPreparedCombatSpell(
    action,
    targetHex,
    targetUnit
  );
};


/* ============================================================
   TARGET HANDOFF FOR COMMON EFFECT PATHS
   ============================================================ */

const r233BaseAnimateMagicMissile=
  animateMagicMissile;

animateMagicMissile=async function(
  attacker,
  defender,
  index,
  total
){
  if(defender?.alive){
    await r233FocusTarget(defender);
  }

  return await r233BaseAnimateMagicMissile(
    attacker,
    defender,
    index,
    total
  );
};


const r233BaseAnimateFireballProjectile=
  animateFireballProjectile;

animateFireballProjectile=async function(
  caster,
  targetHex
){
  if(targetHex){
    await r233FocusTarget(targetHex);
  }

  return await r233BaseAnimateFireballProjectile(
    caster,
    targetHex
  );
};


const r233BaseAnimateColorSprayEffect=
  animateColorSprayEffect;

animateColorSprayEffect=async function(
  caster,
  targetHex,
  cells
){
  if(targetHex){
    await r233FocusTarget(targetHex);
  }

  return await r233BaseAnimateColorSprayEffect(
    caster,
    targetHex,
    cells
  );
};


const r233BaseRollSpellSave=
  rollSpellSave;

rollSpellSave=function(
  target,
  sourceUnit=null,
  extraModifier=0
){
  if(
    target &&
    (
      spellCastInProgress ||
      r230UnitIsCasting?.(sourceUnit)
    )
  ){
    r233FocusTargetNow(target);
  }

  return r233BaseRollSpellSave(
    target,
    sourceUnit,
    extraModifier
  );
};


const r233BaseAddAreaEffect=
  addAreaEffect;

addAreaEffect=function(effect){
  const added=
    r233BaseAddAreaEffect(effect);

  if(
    spellCastInProgress &&
    added &&
    currentScreen==="combat"
  ){
    let focus=null;

    if(
      Number.isFinite(added.x) &&
      Number.isFinite(added.y)
    ){
      focus={x:added.x,y:added.y};
    }else if(
      Array.isArray(added.cells) &&
      added.cells.length
    ){
      const xs=added.cells.map(cell=>cell.x);
      const ys=added.cells.map(cell=>cell.y);

      focus={
        x:
          xs.reduce((sum,value)=>sum+value,0)/
          xs.length,
        y:
          ys.reduce((sum,value)=>sum+value,0)/
          ys.length
      };
    }

    if(focus){
      r233FocusTargetNow(focus);
    }
  }

  return added;
};


/* ============================================================
   AUDIT / DIAGNOSTIC RECORD
   ============================================================ */

window.AdventurePartySpellPresentation={
  release:"R233",
  state:()=>({
    ...r233SpellPresentationState
  }),
  focusCaster:r233FocusCaster,
  focusTarget:r233FocusTarget,
  audit:{
    sequentialAlready:[
      "Burning Hands",
      "persistent area saves"
    ],
    individualResultOverrides:[
      "Magic Missile",
      "Fireball",
      "Flame Arrow",
      "Lightning Bolt",
      "Melf's Minute Meteors"
    ],
    attackRollMissOverrides:[
      "Melf's Acid Arrow",
      "Shocking Grasp",
      "Vampiric Touch",
      "Flame Arrow",
      "Melf's Minute Meteors"
    ]
  }
};
