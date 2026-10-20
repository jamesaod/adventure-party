/*
  Candidate Rev 1 — sequenced "Casting Interrupted" feedback
  ===========================================================
  Presentation-only update; casting mechanics are unchanged.

  - Damage interruption: the normal red damage float is allowed to complete
    first, then "Casting Interrupted" appears as a second rising message.
  - Non-damage magical/status interruption: "Casting Interrupted" appears
    immediately when the canonical disruption path confirms the interruption.
  - Interruption text is white with a dark outline.
  - The interruption notice has its own synthesized fumble SFX.
*/

const CANDIDATE_CAST_INTERRUPTED_FLOAT_MS=1000;
const CANDIDATE_CAST_INTERRUPTED_RISE_PX=22;
const CANDIDATE_DAMAGE_INTERRUPT_DELAY_MS=1000;


/* ============================================================
   STYLE
   ============================================================ */

const candidateBaseFloatingTextStyle=
  r236FloatingTextStyle;

r236FloatingTextStyle=function(kind,alpha){
  if(kind==="casting-interrupted"){
    return {
      fontSize:13,
      fill:
        "rgba(255,255,255,"+
        alpha+
        ")",
      stroke:
        "rgba(8,8,10,"+
        Math.min(1,alpha)+
        ")"
    };
  }

  return candidateBaseFloatingTextStyle(
    kind,
    alpha
  );
};


/* ============================================================
   SYNTHESIZED FUMBLE SFX
   ============================================================ */

function candidatePlayCastingInterruptedFumbleSound(){
  queueSfx(()=>{
    const base=audioCtx.currentTime;

    /*
      A brief unstable magical chirp that collapses downward, followed by a
      soft low "plunk". It is intentionally distinct from the natural-1
      critical-miss cue and uses only Web Audio synthesis.
    */
    const collapse=audioCtx.createOscillator();
    const collapseGain=audioCtx.createGain();
    const collapseFilter=audioCtx.createBiquadFilter();

    collapse.type="triangle";
    collapse.frequency.setValueAtTime(640,base);
    collapse.frequency.exponentialRampToValueAtTime(760,base+0.045);
    collapse.frequency.exponentialRampToValueAtTime(205,base+0.30);

    collapseFilter.type="lowpass";
    collapseFilter.frequency.setValueAtTime(2100,base);
    collapseFilter.frequency.exponentialRampToValueAtTime(720,base+0.30);
    collapseFilter.Q.setValueAtTime(0.9,base);

    collapseGain.gain.setValueAtTime(0.0001,base);
    collapseGain.gain.exponentialRampToValueAtTime(0.15,base+0.008);
    collapseGain.gain.exponentialRampToValueAtTime(0.075,base+0.12);
    collapseGain.gain.exponentialRampToValueAtTime(0.0001,base+0.32);

    collapse.connect(collapseFilter);
    collapseFilter.connect(collapseGain);
    collapseGain.connect(sfxGain);
    collapse.start(base);
    collapse.stop(base+0.34);

    const wobble=audioCtx.createOscillator();
    const wobbleGain=audioCtx.createGain();
    const wobbleFilter=audioCtx.createBiquadFilter();

    wobble.type="sawtooth";
    wobble.frequency.setValueAtTime(430,base+0.025);
    wobble.frequency.exponentialRampToValueAtTime(150,base+0.27);

    wobbleFilter.type="lowpass";
    wobbleFilter.frequency.setValueAtTime(1250,base+0.025);
    wobbleFilter.Q.setValueAtTime(0.7,base+0.025);

    wobbleGain.gain.setValueAtTime(0.0001,base+0.025);
    wobbleGain.gain.exponentialRampToValueAtTime(0.045,base+0.04);
    wobbleGain.gain.exponentialRampToValueAtTime(0.0001,base+0.285);

    wobble.connect(wobbleFilter);
    wobbleFilter.connect(wobbleGain);
    wobbleGain.connect(sfxGain);
    wobble.start(base+0.025);
    wobble.stop(base+0.30);

    const plunk=audioCtx.createOscillator();
    const plunkGain=audioCtx.createGain();

    plunk.type="sine";
    plunk.frequency.setValueAtTime(118,base+0.245);
    plunk.frequency.exponentialRampToValueAtTime(72,base+0.43);

    plunkGain.gain.setValueAtTime(0.0001,base+0.235);
    plunkGain.gain.exponentialRampToValueAtTime(0.105,base+0.255);
    plunkGain.gain.exponentialRampToValueAtTime(0.0001,base+0.45);

    plunk.connect(plunkGain);
    plunkGain.connect(sfxGain);
    plunk.start(base+0.235);
    plunk.stop(base+0.46);

    /* Small sputter makes the failed spell read as magic collapsing, not UI. */
    noiseVoice(
      0.105,
      0.045,
      "bandpass",
      1450,
      1.2,
      0.035
    );
  });
}


/* ============================================================
   INTERRUPTION FLOAT
   ============================================================ */

function candidateShowCastingInterruptedText(unit){
  if(!unit){
    return null;
  }

  const entry=
    r236QueueFloatingCombatText(
      unit,
      "Casting Interrupted",
      "casting-interrupted",
      {
        durationMs:
          CANDIDATE_CAST_INTERRUPTED_FLOAT_MS,
        risePx:
          CANDIDATE_CAST_INTERRUPTED_RISE_PX
      }
    );

  if(entry){
    candidatePlayCastingInterruptedFumbleSound();
  }

  return entry;
}


function candidateInterruptionDelayForReason(reason){
  return /\bdamage\b/i.test(
    String(reason ?? "")
  )
    ? CANDIDATE_DAMAGE_INTERRUPT_DELAY_MS
    : 0;
}


function candidatePresentCastingInterrupted(
  unit,
  reason="interruption"
){
  const delayMs=
    candidateInterruptionDelayForReason(
      reason
    );

  if(delayMs<=0){
    return candidateShowCastingInterruptedText(
      unit
    );
  }

  /*
    onUnitDamaged() reaches r230DisruptCasting() before R236 queues its damage
    number. Waiting one full damage-float lifetime guarantees the red "-N dmg"
    message is the first presentation beat and the white interruption notice is
    the second.
  */
  const unitRef=unit;

  return setTimeout(()=>{
    candidateShowCastingInterruptedText(
      unitRef
    );
  },delayMs);
}


const candidateBaseDisruptCasting=
  r230DisruptCasting;

r230DisruptCasting=function(
  unit,
  reason="interruption"
){
  const disrupted=
    candidateBaseDisruptCasting(
      unit,
      reason
    );

  /*
    Queue presentation only after the canonical engine confirms that an
    in-progress spell was actually interrupted. This covers damage, failed
    saves, and any magic/status effect (for example Silence) that calls the
    canonical r230DisruptCasting() path.
  */
  if(disrupted && unit){
    candidatePresentCastingInterrupted(
      unit,
      reason
    );
  }

  return disrupted;
};


/* ============================================================
   DIAGNOSTICS
   ============================================================ */

if(window.AdventurePartyFloatingCombatText){
  window.AdventurePartyFloatingCombatText.interrupted=
    candidateShowCastingInterruptedText;
}

window.AdventurePartyCastingInterruptedFloat={
  channel:"candidate",
  candidateRevision:1,
  text:"Casting Interrupted",
  durationMs:
    CANDIDATE_CAST_INTERRUPTED_FLOAT_MS,
  risePx:
    CANDIDATE_CAST_INTERRUPTED_RISE_PX,
  damageDelayMs:
    CANDIDATE_DAMAGE_INTERRUPT_DELAY_MS,
  show:(unitOrId)=>{
    const unit=
      typeof unitOrId==="string"
        ? getUnitById(unitOrId)
        : unitOrId;

    return candidateShowCastingInterruptedText(
      unit
    );
  },
  sound:
    candidatePlayCastingInterruptedFumbleSound
};
