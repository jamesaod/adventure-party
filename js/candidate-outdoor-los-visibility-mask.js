/*
  Candidate LOS fix — restore outdoor obscuring-volume visibility mask
  ===================================================================
  R217 generalized the LOS blackout to outdoor obscuring volumes.
  R234 later replaced drawWallTestLineOfSightMask() with binary full-hex
  rendering, but accidentally scoped that replacement to Wall Test only.

  This candidate fix combines both behaviors:
    - architecture and obscuring volumes both participate in visibility;
    - visibility remains binary by tactical hex center;
    - unseen hexes are rendered as complete opaque hidden tiles;
    - fog/cloud geometry is still repainted afterward by the existing
      post-LOS foreground pass so the obstruction itself remains visible.
*/

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
      Full opaque replacement preserves the R234 fix: an unseen tactical hex
      cannot leak floor texture, terrain color, lighting, or partial geometry.
    */
    ctx.globalCompositeOperation=
      "source-over";

    ctx.globalAlpha=1;
    ctx.fillStyle=palette.fill;
    ctx.fill();

    /*
      Seal polygon antialias seams before redrawing the subdued tactical grid.
    */
    ctx.strokeStyle=palette.fill;
    ctx.lineWidth=2.2;
    ctx.stroke();

    r234TraceHexPath(
      ctx,
      tile.x,
      tile.y
    );

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
  rule:
    "binary hex-center visibility for architecture and obscuring volumes",
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
        )
    };
  }
};
