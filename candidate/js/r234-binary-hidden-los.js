/*
  R234 — BINARY HIDDEN-HEX LOS PRESENTATION
  ==========================================
  R215 already decides architectural LOS from the tactical hex center.
  R234 makes the rendering match that rule exactly.

  Previous presentation used a 70% translucent full-screen blackout and
  punched visible hexes through it. Bright indoor stone-texture features,
  illumination, and architectural shading could therefore remain faintly
  visible underneath the blackout and make an unseen hex look partially
  revealed.

  R234 instead paints every UNSEEN tactical hex as one opaque hidden tile.
  Visible hexes are untouched. A same-color edge seal prevents antialias seams,
  then a subdued tactical grid is redrawn on top so hidden hex geometry remains
  readable without leaking floor texture or light information.
*/

function r234HiddenHexPalette(x,y){
  const indoor=
    isIndoorWorldPoint(
      worldPointForHex(x,y)
    );

  return indoor
    ? {
        fill:"#090a0d",
        grid:"rgba(0,0,0,0.96)"
      }
    : {
        fill:"#0d130d",
        grid:"rgba(23,35,23,0.92)"
      };
}


function r234TraceHexPath(targetCtx,x,y){
  const vertices=
    hexScreenVertices(x,y);

  if(!vertices?.length){
    return false;
  }

  targetCtx.beginPath();
  targetCtx.moveTo(
    vertices[0].x,
    vertices[0].y
  );

  for(let index=1;index<vertices.length;index++){
    targetCtx.lineTo(
      vertices[index].x,
      vertices[index].y
    );
  }

  targetCtx.closePath();
  return true;
}


drawWallTestLineOfSightMask=function(){
  if(game?.condition!=="wall"){
    return;
  }

  const contexts=
    friendlyVisibilityObservers()
      .map(observer=>
        observerVisibilityContext(observer)
      )
      .filter(Boolean);

  if(!contexts.length){
    return;
  }

  /*
    Binary presentation:
      center visible  -> draw nothing; original terrain remains
      center hidden   -> replace complete tactical hex with hidden tile
  */
  for(const tile of visibleHexes()){
    const visible=
      contexts.some(context=>
        isHexVisibleFromObserver(
          context.observer,
          tile.x,
          tile.y,
          context
        )
      );

    if(visible){
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
      Fully opaque replacement removes any underlying stone, grass,
      illumination, weather tint, or continuous architectural shading that
      could otherwise imply partial visibility.
    */
    ctx.globalCompositeOperation="source-over";
    ctx.globalAlpha=1;
    ctx.fillStyle=palette.fill;
    ctx.fill();

    /*
      Edge seal: canvas polygon antialiasing can leave subpixel seams between
      neighboring hexes. Stroke with the SAME hidden color before the visible
      grid line so no floor/light sliver survives at a shared edge.
    */
    ctx.strokeStyle=palette.fill;
    ctx.lineWidth=2.2;
    ctx.stroke();

    /*
      Preserve tactical readability without revealing the underlying material.
    */
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
  release:"R234",
  rule:"hex-center binary visibility with opaque hidden tactical hexes",
  hiddenHex:(x,y)=>({
    visible:isHexVisibleToFriendlyParty(x,y),
    palette:r234HiddenHexPalette(x,y),
    indoor:isIndoorWorldPoint(
      worldPointForHex(x,y)
    )
  })
};
