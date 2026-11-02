/*
  Candidate Rev 9 — evolving gaseous union outline
  =================================================
  Keeps Rev 8's soft, unoutlined individual tufts, but adds one outline around
  the total currently-visible gaseous mass while the one-second build animation
  is in progress.

  The outline is generated from the same bottom-to-top layer timing as the
  cloud fills, so it expands with the assembled mass instead of revealing the
  final silhouette on frame one.
*/

const CANDIDATE_REV9_FORMATION_OUTLINE_RADIUS=2;
const CANDIDATE_REV9_FORMATION_OUTLINE_ALPHA=0.82;


function candidateRev9TracePolygonOnContext(
  targetCtx,
  vertices,
  offsetX=0,
  offsetY=0
){
  if(
    !targetCtx ||
    !Array.isArray(vertices) ||
    vertices.length<3
  ){
    return false;
  }

  targetCtx.beginPath();
  targetCtx.moveTo(
    vertices[0].x+offsetX,
    vertices[0].y+offsetY
  );

  for(let i=1;i<vertices.length;i++){
    targetCtx.lineTo(
      vertices[i].x+offsetX,
      vertices[i].y+offsetY
    );
  }

  targetCtx.closePath();
  return true;
}


function candidateRev9FillMaskEllipse(
  targetCtx,
  x,
  y,
  rx,
  ry,
  opacity
){
  if(
    !targetCtx ||
    opacity<=0.001
  ){
    return;
  }

  targetCtx.save();
  targetCtx.globalAlpha=
    Math.max(
      0,
      Math.min(1,opacity)
    );
  targetCtx.fillStyle=
    "rgba(0,0,0,1)";
  targetCtx.beginPath();
  targetCtx.ellipse(
    x,
    y,
    rx,
    ry,
    0,
    0,
    Math.PI*2
  );
  targetCtx.fill();
  targetCtx.restore();
}


function candidateRev9DrawFormationUnionOutline(
  effect,
  rawProgress
){
  if(
    !candidateIsGaseousAreaEffect(effect) ||
    !Array.isArray(effect.cells) ||
    !effect.cells.length ||
    rawProgress<=0.001
  ){
    return;
  }

  const visible=
    effect.cells.filter(cell=>
      inside(cell.x,cell.y) &&
      isHexOnBattlefieldScreen(
        cell.x,
        cell.y,
        HEX_W
      )
    );

  if(!visible.length){
    return;
  }

  const time=
    performance.now();

  const centers=
    visible.map(cell=>
      hexCenter(
        cell.x,
        cell.y
      )
    );

  const minX=
    Math.floor(
      Math.min(
        ...centers.map(
          point=>point.x
        )
      )-
      HEX_W*1.35
    );

  const maxX=
    Math.ceil(
      Math.max(
        ...centers.map(
          point=>point.x
        )
      )+
      HEX_W*1.35
    );

  const minY=
    Math.floor(
      Math.min(
        ...centers.map(
          point=>point.y
        )
      )-
      HEX_W*1.45
    );

  const maxY=
    Math.ceil(
      Math.max(
        ...centers.map(
          point=>point.y
        )
      )+
      HEX_H*0.75
    );

  const width=
    Math.max(
      1,
      maxX-minX+1
    );

  const height=
    Math.max(
      1,
      maxY-minY+1
    );

  const bodyCanvas=
    document.createElement(
      "canvas"
    );

  bodyCanvas.width=width;
  bodyCanvas.height=height;

  const bodyCtx=
    bodyCanvas.getContext(
      "2d"
    );

  bodyCtx.imageSmoothingEnabled=false;

  const lx=-minX;
  const ly=-minY;

  for(const cell of visible){
    const center=
      hexCenter(
        cell.x,
        cell.y
      );

    const seedBase=
      (
        Math.abs(
          cell.x*73856093 ^
          cell.y*19349663
        )>>>0
      );

    const drift=
      Math.sin(
        (time*0.0017)+
        (cell.x*0.61)+
        (cell.y*0.43)
      )*3.0;

    const floorOpacity=
      candidateRev7GasLayerOpacity(
        rawProgress,
        0
      );

    if(floorOpacity>0.001){
      const floorVertices=
        hexScreenVertices(
          cell.x,
          cell.y
        );

      bodyCtx.save();
      bodyCtx.globalAlpha=
        floorOpacity;
      bodyCtx.fillStyle=
        "rgba(0,0,0,1)";

      if(
        candidateRev9TracePolygonOnContext(
          bodyCtx,
          floorVertices,
          lx,
          ly
        )
      ){
        bodyCtx.fill();
      }

      bodyCtx.restore();
    }

    /*
      Match Rev 7's four complete body ovals. Each contributes to the union
      outline with the same layer opacity used by the visible fill.
    */
    for(
      let layer=0;
      layer<4;
      layer++
    ){
      const opacity=
        candidateRev7GasLayerOpacity(
          rawProgress,
          layer
        );

      if(opacity<=0.001){
        continue;
      }

      const y=
        center.y-
        10-
        layer*15+
        Math.sin(
          time*0.0018+
          seedBase*0.000001+
          layer
        )*1.8;

      candidateRev9FillMaskEllipse(
        bodyCtx,
        center.x+
          drift*0.10+
          (layer%2 ? 3 : -3)+
          lx,
        y+ly,
        HEX_W*(
          0.45-
          layer*0.025
        ),
        13+
          (layer%2)*2,
        opacity
      );
    }

    /*
      Match the eight drifting puff ellipses from Rev 7.
    */
    for(let i=0;i<8;i++){
      const a=
        (
          (
            seedBase+
            i*2654435761
          )>>>0
        );

      const fx=
        (
          (a & 1023)/1023
        )-
        0.5;

      const fy=
        (
          (a>>>10)&1023
        )/
        1023;

      const rx=
        16+
        (
          (a>>>20)&7
        );

      const ry=
        9+
        (
          (a>>>23)&7
        );

      const phase=
        (a & 255)*0.023;

      const sway=
        Math.sin(
          time*0.0021+
          phase
        )*4.0;

      const lift=
        Math.cos(
          time*0.0018+
          phase*1.7
        )*2.3;

      const layer=
        Math.min(
          3,
          Math.floor(
            fy*4
          )
        );

      const opacity=
        candidateRev7GasLayerOpacity(
          rawProgress,
          layer
        );

      candidateRev9FillMaskEllipse(
        bodyCtx,
        center.x+
          fx*HEX_W*0.70+
          sway+
          lx,
        center.y-
          8-
          fy*(HEX_W-12)+
          lift+
          ly,
        rx,
        ry,
        opacity
      );
    }

    /*
      Match the final upper cap.
    */
    const capOpacity=
      candidateRev7GasLayerOpacity(
        rawProgress,
        4
      );

    if(capOpacity>0.001){
      const capBob=
        Math.sin(
          time*0.0022+
          seedBase*0.000002
        )*3;

      candidateRev9FillMaskEllipse(
        bodyCtx,
        center.x+
          drift*0.14+
          lx,
        center.y-
          HEX_W+
          5+
          capBob*0.28+
          ly,
        HEX_W*0.42,
        12,
        capOpacity
      );
    }
  }

  const outlineCanvas=
    document.createElement(
      "canvas"
    );

  outlineCanvas.width=
    bodyCanvas.width;

  outlineCanvas.height=
    bodyCanvas.height;

  const outlineCtx=
    outlineCanvas.getContext(
      "2d"
    );

  outlineCtx.imageSmoothingEnabled=false;

  const radius=
    CANDIDATE_REV9_FORMATION_OUTLINE_RADIUS;

  /*
    Dilate the currently-visible cloud alpha mask. This produces one silhouette
    around the union of every visible tuft/body layer rather than an outline
    around individual circles.
  */
  for(let dy=-radius;dy<=radius;dy++){
    for(let dx=-radius;dx<=radius;dx++){
      if(dx===0 && dy===0){
        continue;
      }

      if(
        dx*dx+
        dy*dy>
        radius*radius
      ){
        continue;
      }

      outlineCtx.drawImage(
        bodyCanvas,
        dx,
        dy
      );
    }
  }

  outlineCtx.globalCompositeOperation=
    "destination-out";

  outlineCtx.drawImage(
    bodyCanvas,
    0,
    0
  );

  outlineCtx.globalCompositeOperation=
    "source-in";

  outlineCtx.fillStyle=
    effect.spellKind==="stinking-cloud"
      ? "rgba(27,72,35,1)"
      : "rgba(0,0,0,1)";

  outlineCtx.fillRect(
    0,
    0,
    outlineCanvas.width,
    outlineCanvas.height
  );

  outlineCtx.globalCompositeOperation=
    "source-over";

  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.globalAlpha=
    CANDIDATE_REV9_FORMATION_OUTLINE_ALPHA;
  ctx.drawImage(
    outlineCanvas,
    minX,
    minY
  );
  ctx.restore();
}


/* ============================================================
   FORMATION OUTLINE OVERRIDE
   ============================================================ */

const candidateRev9PreviousDrawFogEffectOutline=
  drawFogEffectOutline;

drawFogEffectOutline=function(effect){
  if(
    !candidateIsGaseousAreaEffect(
      effect
    )
  ){
    return candidateRev9PreviousDrawFogEffectOutline(
      effect
    );
  }

  const raw=
    candidateRev7GasFormationRaw(
      effect
    );

  if(raw>=1){
    /*
      Return to the production union outline once the full gaseous body has
      assembled.
    */
    return candidateRev6BaseDrawFogEffectOutline(
      effect
    );
  }

  return candidateRev9DrawFormationUnionOutline(
    effect,
    raw
  );
};


/* ============================================================
   DIAGNOSTICS
   ============================================================ */

window.AdventurePartyGaseousSpellPresentation={
  ...(window.AdventurePartyGaseousSpellPresentation || {}),
  channel:"candidate",
  candidateRevision:9,
  formationStyle:
    "complete soft tufts fade bottom-to-top with one evolving union outline",
  perTuftOutline:false,
  formationUnionOutline:true,
  finishedUnionOutline:true,
  formationOutlineRadius:
    CANDIDATE_REV9_FORMATION_OUTLINE_RADIUS,
  formationOutlineAlpha:
    CANDIDATE_REV9_FORMATION_OUTLINE_ALPHA
};
