/*
  Candidate LOS fix — restore outdoor obscuring-volume visibility mask
  ===================================================================
  R217 generalized the LOS blackout to outdoor obscuring volumes.
  R234 later replaced drawWallTestLineOfSightMask() with binary full-hex
  rendering, but accidentally scoped that replacement to Wall Test only.

  This candidate fix combines both behaviors:
    - architecture and obscuring volumes both participate in visibility;
    - visibility remains binary by tactical hex center;
    - unseen hexes receive a uniform 25% hidden-area overlay;
    - fog/cloud geometry is still repainted afterward by the existing
      post-LOS foreground pass so the obstruction itself remains visible.
*/

const CANDIDATE_LOS_HIDDEN_OPACITY=0.25;

function candidateLosVisibilityContexts(){
  if(!game){
    return [];
  }

  const architecturalMode=
    game.condition==="wall";

  return friendlyVisibilityObservers()
    .map(observer=>({
      observer,
      context:
        architecturalMode
          ? observerVisibilityContext(observer)
          : null
    }))
    .filter(entry=>
      !architecturalMode ||
      !!entry.context
    );
}


function candidateHexVisibleToParty(
  tile,
  observerEntries
){
  if(!tile){
    return false;
  }

  return observerEntries.some(entry=>
    isHexVisibleFromObserver(
      entry.observer,
      tile.x,
      tile.y,
      entry.context
    )
  );
}


drawWallTestLineOfSightMask=function(){
  if(!game){
    return;
  }

  const architecturalMode=
    game.condition==="wall";

  const obscuringMode=
    hasActiveObscuringLosVolume();

  /*
    Open terrain with no fog/cloud/darkness remains completely unchanged.
  */
  if(
    !architecturalMode &&
    !obscuringMode
  ){
    return;
  }

  const observerEntries=
    candidateLosVisibilityContexts();

  if(!observerEntries.length){
    return;
  }

  for(const tile of visibleHexes()){
    if(
      candidateHexVisibleToParty(
        tile,
        observerEntries
      )
    ){
      continue;
    }

    const palette=
      r234HiddenHexPalette(
        tile.x,
        tile.y
      );

    ctx.save();

    if(
      !r234TraceHexPath(
        ctx,
        tile.x,
        tile.y
      )
    ){
      ctx.restore();
      continue;
    }

    /*
      Keep the binary full-hex boundary from R234, but use a 25% overlay so
      unseen terrain remains legible enough for QA while still reading as hidden.
      Every hidden hex gets the same opacity; there is no partial visibility
      inside a tactical hex.
    */
    ctx.globalCompositeOperation=
      "source-over";

    ctx.globalAlpha=CANDIDATE_LOS_HIDDEN_OPACITY;
    ctx.fillStyle=palette.fill;
    ctx.fill();

    /*
      Seal polygon antialias seams using the same 25% treatment, then restore
      full alpha for the subdued tactical grid.
    */
    ctx.strokeStyle=palette.fill;
    ctx.lineWidth=2.2;
    ctx.stroke();

    r234TraceHexPath(
      ctx,
      tile.x,
      tile.y
    );

    ctx.globalAlpha=1;
    ctx.strokeStyle=palette.grid;
    ctx.lineWidth=1;
    ctx.stroke();

    ctx.restore();
  }
};


window.AdventurePartyLosPresentation={
  ...(window.AdventurePartyLosPresentation || {}),
  channel:"candidate",
  outdoorObscuringMaskRestored:true,
  hiddenOpacity:CANDIDATE_LOS_HIDDEN_OPACITY,
  rule:
    "binary hex-center visibility with 25% hidden-area overlay for architecture and obscuring volumes",
  inspect:(x,y)=>{
    const architecturalMode=
      game?.condition==="wall";

    const obscuringMode=
      !!game &&
      hasActiveObscuringLosVolume();

    const observerEntries=
      candidateLosVisibilityContexts();

    return {
      x,
      y,
      architecturalMode,
      obscuringMode,
      visible:
        candidateHexVisibleToParty(
          {x,y},
          observerEntries
        ),
      palette:
        r234HiddenHexPalette(
          x,
          y
        ),
      hiddenOpacity:
        CANDIDATE_LOS_HIDDEN_OPACITY
    };
  }
};
