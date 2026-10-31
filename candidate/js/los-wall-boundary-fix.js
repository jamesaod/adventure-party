/*
  R216 — WALL-BOUNDARY LOS MASK CORRECTION
  -----------------------------------------
  R215 intentionally uses tactical hex centers as the authoritative gameplay
  visibility sample. Architectural wall cells are different: a solid wall can
  pass through a hex center, and those wall-bisected cells are already marked
  non-passable. If their center is hidden, blacking the entire hex paints a
  dark wedge onto the physically visible side of the wall.

  This presentation-only override keeps normal tactical cells fully binary.
  Only non-passable wall-bisected cells may use the continuous architectural
  LOS polygon to carve the blackout on the observer-facing side of the wall.
  Targeting, hidden-unit detection, fog blocking, and usable-hex visibility
  remain governed by the R215 center rule in adventure-party.js.
*/

function drawWallTestLineOfSightMask(){
  if(game?.condition!=="wall") return;

  const contexts=friendlyVisibilityObservers()
    .map(observer=>observerVisibilityContext(observer))
    .filter(Boolean);

  if(!contexts.length) return;

  const maskCanvas=drawWallTestLineOfSightMask.maskCanvas ||
    (drawWallTestLineOfSightMask.maskCanvas=document.createElement("canvas"));

  if(maskCanvas.width!==canvas.width || maskCanvas.height!==canvas.height){
    maskCanvas.width=canvas.width;
    maskCanvas.height=canvas.height;
  }

  const maskCtx=maskCanvas.getContext("2d");
  maskCtx.clearRect(0,0,maskCanvas.width,maskCanvas.height);
  maskCtx.globalCompositeOperation="source-over";

  /* Fully unseen terrain remains readable at 70% black. */
  maskCtx.fillStyle="rgba(0,0,0,0.70)";
  maskCtx.fillRect(0,0,maskCanvas.width,maskCanvas.height);

  maskCtx.globalCompositeOperation="destination-out";
  maskCtx.fillStyle="rgba(0,0,0,1)";

  for(const tile of visibleHexes()){
    const visible=contexts.some(context=>
      isHexVisibleFromObserver(
        context.observer,
        tile.x,
        tile.y,
        context
      )
    );

    const vertices=hexScreenVertices(tile.x,tile.y);

    /*
      Normal tactical cell: R215 remains strict. A visible center reveals the
      complete hex; an unseen center keeps the complete hex obscured.
    */
    if(visible){
      maskCtx.beginPath();
      maskCtx.moveTo(vertices[0].x,vertices[0].y);

      for(let i=1;i<vertices.length;i++){
        maskCtx.lineTo(vertices[i].x,vertices[i].y);
      }

      maskCtx.closePath();
      maskCtx.fill();
      continue;
    }

    /*
      Architectural boundary cell: its center can lie inside/behind the wall
      slab even though part of the cell is on the observer-facing side. These
      cells cannot be occupied, so refine only their rendered blackout with
      the continuous LOS polygon.
    */
    if(!isArchitecturalBlockedHex(tile.x,tile.y)) continue;

    maskCtx.save();

    maskCtx.beginPath();
    maskCtx.moveTo(vertices[0].x,vertices[0].y);
    for(let i=1;i<vertices.length;i++){
      maskCtx.lineTo(vertices[i].x,vertices[i].y);
    }
    maskCtx.closePath();
    maskCtx.clip();

    for(const context of contexts){
      /*
        Magical obscuration remains tactical-cell based. Do not use the
        architectural presentation exception to see through fog/cloud effects.
      */
      if(
        fogBlocksVisibilityToHex(
          context.observer,
          tile.x,
          tile.y
        )
      ){
        continue;
      }

      const visiblePolygon=context.polygon.map(point=>
        screenPointForWorld(point)
      );

      if(tracePolygonOnContext(maskCtx,visiblePolygon)){
        maskCtx.fill();
      }
    }

    maskCtx.restore();
  }

  maskCtx.globalCompositeOperation="source-over";

  ctx.save();
  ctx.globalCompositeOperation="source-over";
  ctx.drawImage(maskCanvas,0,0);
  ctx.restore();
}
