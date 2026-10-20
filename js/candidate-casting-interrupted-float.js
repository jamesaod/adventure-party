/*
  Candidate UI — rising "Casting Interrupted" feedback
  ====================================================
  Adds an over-unit interruption cue without changing casting mechanics.

  The hook wraps the canonical r230DisruptCasting() path after R235/R236 load,
  so any valid disruption source using that path receives the same feedback:
  damage, failed saves, and magic/status effects such as Silence.

  The message rises and fades for one second, matching the existing floating
  damage/healing motion language.
*/

const CANDIDATE_CAST_INTERRUPTED_FLOAT_MS=1000;
const CANDIDATE_CAST_INTERRUPTED_RISE_PX=22;


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
        "rgba(255,118,72,"+
        alpha+
        ")",
      stroke:
        "rgba(24,3,2,"+
        Math.min(1,alpha*0.98)+
        ")"
    };
  }

  return candidateBaseFloatingTextStyle(
    kind,
    alpha
  );
};


/* ============================================================
   INTERRUPTION FLOAT
   ============================================================ */

function candidateShowCastingInterruptedText(unit){
  if(!unit){
    return null;
  }

  return r236QueueFloatingCombatText(
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
    in-progress spell was actually interrupted. Invalid/no-op disruption calls
    therefore cannot create misleading feedback.
  */
  if(disrupted && unit){
    candidateShowCastingInterruptedText(
      unit
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
  text:"Casting Interrupted",
  durationMs:
    CANDIDATE_CAST_INTERRUPTED_FLOAT_MS,
  risePx:
    CANDIDATE_CAST_INTERRUPTED_RISE_PX,
  show:(unitOrId)=>{
    const unit=
      typeof unitOrId==="string"
        ? getUnitById(unitOrId)
        : unitOrId;

    return candidateShowCastingInterruptedText(
      unit
    );
  }
};
