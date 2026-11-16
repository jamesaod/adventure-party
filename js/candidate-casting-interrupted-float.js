/*
  Candidate Rev 2 — ordered "Casting Interrupted" feedback
  ========================================================
  Casting interruption now participates in the shared Candidate combat-beat
  queue instead of using its own fixed delay.

  That means an interruption caused by a multi-component hit naturally waits
  behind every direct/secondary damage beat, then behind any buff/debuff beats,
  before appearing as the follow-on condition beat.

  The message remains white, rises/fades for one second, and keeps its dedicated
  synthesized fumble SFX.
*/

const CANDIDATE_CAST_INTERRUPTED_FLOAT_MS=1000;
const CANDIDATE_CAST_INTERRUPTED_RISE_PX=22;


/* ============================================================
   SYNTHESIZED FUMBLE SFX
   ============================================================ */

function candidatePlayCastingInterruptedFumbleSound(){
  queueSfx(()=>{
    const base=audioCtx.currentTime;

    /*
      Unstable magical chirp that collapses downward, followed by a soft low
      plunk. It is intentionally separate from the natural-1 critical miss cue.
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
   INTERRUPTION BEAT
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


function candidatePresentCastingInterrupted(
  unit,
  reason="interruption"
){
  if(!unit){
    return null;
  }

  return candidateQueueCombatBeat(
    unit,
    {
      category:"condition",
      text:"Casting Interrupted",
      kind:"casting-interrupted",
      durationMs:
        CANDIDATE_CAST_INTERRUPTED_FLOAT_MS,
      risePx:
        CANDIDATE_CAST_INTERRUPTED_RISE_PX,
      show:
        target=>
          candidateShowCastingInterruptedText(
            target
          ),
      meta:{reason}
    }
  );
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

  if(disrupted && unit){
    candidatePresentCastingInterrupted(
      unit,
      reason
    );
  }

  return disrupted;
};


/* ============================================================
   STYLE
   ============================================================ */

const candidateInterruptedBaseFloatingTextStyle=
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

  return candidateInterruptedBaseFloatingTextStyle(
    kind,
    alpha
  );
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
  candidateRevision:2,
  text:"Casting Interrupted",
  durationMs:
    CANDIDATE_CAST_INTERRUPTED_FLOAT_MS,
  risePx:
    CANDIDATE_CAST_INTERRUPTED_RISE_PX,
  queuedAfter:
    "direct damage, secondary damage, buffs and debuffs",
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
