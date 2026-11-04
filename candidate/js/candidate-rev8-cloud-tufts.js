/*
  Candidate Rev 8 — soft gaseous tuft formation
  ===============================================
  Formation keeps Rev 7's complete-shape, bottom-to-top layered fade-in, but
  removes the per-shape outline from individual cloud tufts/body ovals/cap.

  The finished production union outline still appears after the one-second
  formation completes. Mechanical LOS behavior is unchanged.
*/

const candidateRev8BaseDrawCompleteEllipse=
  candidateRev7DrawCompleteEllipse;

candidateRev7DrawCompleteEllipse=function(
  x,
  y,
  rx,
  ry,
  fillStyle,
  outlineStyle,
  opacity,
  options={}
){
  /*
    Ignore the requested per-tuft outline during formation. The fill geometry,
    opacity envelope, layering and normal post-formation union outline remain
    unchanged.
  */
  return candidateRev8BaseDrawCompleteEllipse(
    x,
    y,
    rx,
    ry,
    fillStyle,
    null,
    opacity,
    options
  );
};

window.AdventurePartyGaseousSpellPresentation={
  ...(window.AdventurePartyGaseousSpellPresentation || {}),
  channel:"candidate",
  candidateRevision:8,
  formationStyle:
    "complete puff/oval layers, bottom-to-top, opacity fade only; no per-tuft outlines",
  perTuftOutline:false,
  finishedUnionOutline:true
};
