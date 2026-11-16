/*
  R235 — PRIORITY SPELL-INTERRUPTION NOTICE
  =========================================
  Mechanical casting interruption already worked in R230, but the notice could
  be overwritten immediately by the attack/damage message that continued in the
  same synchronous call stack.

  R235 gives the interruption notice exclusive ownership of the combat message
  bar for exactly one second. The most recent ordinary combat message attempted
  during that second is deferred and displayed afterward.
*/

const R235_SPELL_INTERRUPTION_NOTICE_MS=1000;

let r235SpellInterruptionNoticeUntil=0;
let r235DeferredCombatMessage=null;
let r235SpellInterruptionFlushTimer=null;
let r235WritingPriorityMessage=false;


function r235SpellInterruptionNoticeRemaining(){
  return Math.max(
    0,
    Math.ceil(
      r235SpellInterruptionNoticeUntil-
      performance.now()
    )
  );
}


function r235SpellInterruptionNoticeActive(){
  return r235SpellInterruptionNoticeRemaining()>0;
}


const r235BaseSetCombatMessage=setCombatMessage;

setCombatMessage=function(
  message,
  holdMs=0,
  displayMs=COMBAT_MESSAGE_DISPLAY_MS,
  tone="normal"
){
  if(
    r235SpellInterruptionNoticeActive() &&
    !r235WritingPriorityMessage
  ){
    /*
      Preserve the message that would otherwise have replaced the interruption
      notice. Keep only the most recent one, matching the pre-R235 behavior
      where later synchronous messages replaced earlier ones.
    */
    r235DeferredCombatMessage={
      message,
      holdMs,
      displayMs,
      tone
    };
    return;
  }

  return r235BaseSetCombatMessage(
    message,
    holdMs,
    displayMs,
    tone
  );
};


function r235FlushDeferredCombatMessage(){
  if(r235SpellInterruptionNoticeActive()){
    return false;
  }

  const deferred=r235DeferredCombatMessage;
  r235DeferredCombatMessage=null;

  if(!deferred){
    return false;
  }

  r235WritingPriorityMessage=true;

  try{
    r235BaseSetCombatMessage(
      deferred.message,
      deferred.holdMs,
      deferred.displayMs,
      deferred.tone
    );
  }finally{
    r235WritingPriorityMessage=false;
  }

  return true;
}


function r235ScheduleDeferredCombatMessageFlush(){
  if(r235SpellInterruptionFlushTimer){
    clearTimeout(
      r235SpellInterruptionFlushTimer
    );
    r235SpellInterruptionFlushTimer=null;
  }

  const remaining=
    r235SpellInterruptionNoticeRemaining();

  r235SpellInterruptionFlushTimer=
    setTimeout(()=>{
      r235SpellInterruptionFlushTimer=null;

      if(r235SpellInterruptionNoticeActive()){
        r235ScheduleDeferredCombatMessageFlush();
        return;
      }

      r235FlushDeferredCombatMessage();
    },Math.max(1,remaining+1));
}


/* ============================================================
   INTERRUPT PRESENTATION
   ============================================================ */

const r235BaseDisruptCasting=r230DisruptCasting;

r230DisruptCasting=function(
  unit,
  reason="interruption"
){
  /*
    Let R230 decide whether a valid in-progress casting actually exists.
    Establish the priority window before calling it so its own interruption
    message is permitted while later attack/damage messages are deferred.
  */
  const priorUntil=
    r235SpellInterruptionNoticeUntil;

  const priorDeferred=
    r235DeferredCombatMessage;

  r235SpellInterruptionNoticeUntil=
    performance.now()+
    R235_SPELL_INTERRUPTION_NOTICE_MS;

  r235DeferredCombatMessage=null;
  r235WritingPriorityMessage=true;

  let disrupted=false;

  try{
    disrupted=
      r235BaseDisruptCasting(
        unit,
        reason
      );
  }finally{
    r235WritingPriorityMessage=false;
  }

  if(!disrupted){
    r235SpellInterruptionNoticeUntil=
      priorUntil;
    r235DeferredCombatMessage=
      priorDeferred;
    return false;
  }

  /*
    R230 used the normal 1500 ms message display time. Re-issue through the
    unwrapped base setter so this specific notification is exactly the requested
    one-second presentation, while also guaranteeing a one-second action hold.
  */
  r235WritingPriorityMessage=true;

  try{
    r235BaseSetCombatMessage(
      `${unit.name}'s spell has been interrupted.`,
      R235_SPELL_INTERRUPTION_NOTICE_MS,
      R235_SPELL_INTERRUPTION_NOTICE_MS,
      unit.id==="player"
        ? "player-damage"
        : "normal"
    );
  }finally{
    r235WritingPriorityMessage=false;
  }

  r235ScheduleDeferredCombatMessageFlush();

  return true;
};


/* ============================================================
   ACTION PAUSE MUST INCLUDE THE DEFERRED FOLLOW-UP MESSAGE
   ============================================================ */

waitForCombatActionPause=async function(){
  while(true){
    const priorityRemaining=
      r235SpellInterruptionNoticeRemaining();

    if(
      priorityRemaining<=0 &&
      r235DeferredCombatMessage
    ){
      r235FlushDeferredCombatMessage();
    }

    const remaining=
      Math.max(
        combatActionPauseRemaining(),
        r235SpellInterruptionNoticeRemaining()
      );

    if(remaining<=0){
      if(r235DeferredCombatMessage){
        r235FlushDeferredCombatMessage();
        continue;
      }

      return;
    }

    await sleep(
      Math.max(1,remaining)
    );
  }
};


/* ============================================================
   DIAGNOSTICS
   ============================================================ */

window.AdventurePartySpellInterruptionNotice={
  release:"R235",
  durationMs:R235_SPELL_INTERRUPTION_NOTICE_MS,
  state:()=>({
    active:r235SpellInterruptionNoticeActive(),
    remainingMs:r235SpellInterruptionNoticeRemaining(),
    deferredMessage:
      r235DeferredCombatMessage?.message ||
      null
  })
};

if(window.AdventurePartyCastingTime){
  window.AdventurePartyCastingTime.release="R235";
}
