/*
  Candidate Rev 7 — layered gaseous formation
  =============================================
  Replaces Rev 6's vertical reveal with complete cloud shapes introduced in
  bottom-to-top layers. Individual puffs/ovals never grow or clip into view:
  each appears at full geometry and fades from zero to its normal opacity.

  Mechanical LOS remains immediate from Rev 6/R217. This is presentation only.
*/

const CANDIDATE_REV7_GAS_LAYER_COUNT=5;
const CANDIDATE_REV7_GAS_LAYER_STAGGER=0.16;
const CANDIDATE_REV7_GAS_LAYER_FADE=0.32;


function candidateRev7GasFormationRaw(
  effect,
  now=performance.now()
){
  if(!candidateIsGaseousAreaEffect(effect)){
    return 1;
  }

  const started=
    Number(effect.gasFormationStartedAt);

  if(!Number.isFinite(started)){
    return 1;
  }

  return Math.max(
    0,
    Math.min(
      1,
      (now-started)/
      CANDIDATE_GAS_FORMATION_MS
    )
  );
}


function candidateRev7Smoothstep(value){
  const t=
    Math.max(
      0,
      Math.min(1,value)
    );

  return t*t*(3-2*t);
}


function candidateRev7GasLayerOpacity(
  rawProgress,
  layer
){
  const safeLayer=
    Math.max(
      0,
      Math.min(
        CANDIDATE_REV7_GAS_LAYER_COUNT-1,
        Math.floor(Number(layer)||0)
      )
    );

  const start=
    safeLayer*
    CANDIDATE_REV7_GAS_LAYER_STAGGER;

  const local=
    (
      rawProgress-start
    )/
    CANDIDATE_REV7_GAS_LAYER_FADE;

  return candidateRev7Smoothstep(
    local
  );
}


function candidateRev7FogPalette(
  isStinkingCloud
){
  return isStinkingCloud
    ? {
        floor:"rgba(72,112,42,0.88)",
        structure:[
          "rgba(63,116,43,0.82)",
          "rgba(82,139,48,0.82)",
          "rgba(126,170,58,0.78)",
          "rgba(174,199,74,0.68)"
        ],
        puffs:[
          [188,205,77],
          [126,170,58],
          [82,139,48],
          [48,101,45]
        ],
        cap:"rgba(202,216,94,0.72)",
        accent:"rgba(156,190,73,0.58)",
        outline:"rgba(27,72,35,0.92)"
      }
    : {
        floor:"rgba(207,216,218,0.84)",
        structure:[
          "rgba(188,199,201,0.84)",
          "rgba(197,207,209,0.82)",
          "rgba(214,223,225,0.78)",
          "rgba(236,241,242,0.66)"
        ],
        puffs:null,
        cap:"rgba(242,246,247,0.68)",
        accent:"rgba(236,242,243,0.52)",
        outline:"rgba(0,0,0,0.92)"
      };
}


function candidateRev7DrawCompleteEllipse(
  x,
  y,
  rx,
  ry,
  fillStyle,
  outlineStyle,
  opacity,
  {
    outlineWidth=1.5,
    globalScale=0.5
  }={}
){
  if(opacity<=0.001){
    return;
  }

  ctx.save();

  /*
    Complete geometry is painted immediately. Opacity is the only formation
    parameter; there is no clipping, vertical scaling or partial ellipse.
  */
  ctx.globalAlpha=
    Math.max(
      0,
      Math.min(
        1,
        globalScale*opacity
      )
    );

  ctx.beginPath();
  ctx.ellipse(
    x,
    y,
    rx,
    ry,
    0,
    0,
    Math.PI*2
  );
  ctx.fillStyle=fillStyle;
  ctx.fill();

  if(outlineStyle){
    ctx.globalAlpha=
      Math.max(
        0,
        Math.min(
          1,
          0.76*opacity
        )
      );
    ctx.strokeStyle=outlineStyle;
    ctx.lineWidth=outlineWidth;
    ctx.stroke();
  }

  ctx.restore();
}


function candidateRev7DrawFogFormationCell(
  cell,
  effect,
  rawProgress
){
  if(
    !cell ||
    !inside(cell.x,cell.y) ||
    !isHexOnBattlefieldScreen(
      cell.x,
      cell.y,
      HEX_W
    )
  ){
    return;
  }

  const c=
    hexCenter(
      cell.x,
      cell.y
    );

  const height=HEX_W;
  const top=
    hexScreenVertices(
      cell.x,
      cell.y
    );

  const time=
    performance.now();

  const seedBase=
    (
      Math.abs(
        cell.x*73856093 ^
        cell.y*19349663
      )>>>0
    );

  const isStinkingCloud=
    effect?.spellKind===
    "stinking-cloud";

  const palette=
    candidateRev7FogPalette(
      isStinkingCloud
    );

  const drift=
    Math.sin(
      (time*0.0017)+
      (cell.x*0.61)+
      (cell.y*0.43)
    )*3.0;

  /*
    Layer 0 starts with the floor haze. The hex-shaped haze is a complete
    shape as well; only opacity changes.
  */
  const floorOpacity=
    candidateRev7GasLayerOpacity(
      rawProgress,
      0
    );

  if(floorOpacity>0.001){
    ctx.save();
    ctx.globalAlpha=
      0.5*floorOpacity;
    polygonPath(top);
    ctx.fillStyle=
      palette.floor;
    ctx.fill();
    ctx.restore();
  }

  /*
    Four broad, complete body ovals provide the underlying cloud mass. They
    arrive sequentially from the battlefield floor upward.
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
      c.y-
      10-
      layer*15+
      Math.sin(
        time*0.0018+
        seedBase*0.000001+
        layer
      )*1.8;

    candidateRev7DrawCompleteEllipse(
      c.x+
        drift*0.10+
        (layer%2 ? 3 : -3),
      y,
      HEX_W*(
        0.45-
        layer*0.025
      ),
      13+
        (layer%2)*2,
      palette.structure[
        Math.min(
          layer,
          palette.structure.length-1
        )
      ],
      palette.outline,
      opacity,
      {
        outlineWidth:1.35,
        globalScale:0.5
      }
    );
  }

  /*
    Original eight animated puffs, now assigned to a vertical formation layer.
    Each puff is born as one complete ellipse and only fades in.
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

    const px=
      c.x+
      fx*HEX_W*0.70+
      sway;

    const py=
      c.y-
      8-
      fy*(height-12)+
      lift;

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

    if(opacity<=0.001){
      continue;
    }

    const alphaPulse=
      0.73+
      0.17*
      Math.sin(
        time*0.0024+
        phase*2.1
      );

    let fillStyle;

    if(isStinkingCloud){
      const puff=
        palette.puffs[
          (seedBase+i)%
          palette.puffs.length
        ];

      fillStyle=
        `rgba(${puff[0]},${puff[1]},${puff[2]},${0.80*alphaPulse})`;
    }else{
      fillStyle=
        i%2
          ? `rgba(225,232,233,${0.74*alphaPulse})`
          : `rgba(197,207,209,${0.78*alphaPulse})`;
    }

    candidateRev7DrawCompleteEllipse(
      px,
      py,
      rx,
      ry,
      fillStyle,
      palette.outline,
      opacity,
      {
        outlineWidth:1.15,
        globalScale:0.5
      }
    );
  }

  /*
    The upper cap is the final layer. It too appears at full oval dimensions
    and fades into place rather than being revealed by a moving crop.
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

    candidateRev7DrawCompleteEllipse(
      c.x+
        drift*0.14,
      c.y-
        height+
        5+
        capBob*0.28,
      HEX_W*0.42,
      12,
      palette.cap,
      palette.outline,
      capOpacity,
      {
        outlineWidth:1.4,
        globalScale:0.5
      }
    );

    ctx.save();
    ctx.globalAlpha=
      0.5*capOpacity;
    ctx.strokeStyle=
      palette.accent;
    ctx.lineWidth=1.2;
    ctx.beginPath();
    ctx.moveTo(
      c.x-
        HEX_W*0.42+
        drift*0.12,
      c.y-
        height+
        8
    );
    ctx.lineTo(
      c.x-
        HEX_W*0.42+
        drift*0.12,
      c.y-2
    );
    ctx.moveTo(
      c.x+
        HEX_W*0.42+
        drift*0.12,
      c.y-
        height+
        8
    );
    ctx.lineTo(
      c.x+
        HEX_W*0.42+
        drift*0.12,
      c.y-2
    );
    ctx.stroke();
    ctx.restore();
  }
}


/* ============================================================
   RENDER OVERRIDES
   ============================================================ */

const candidateRev7PreviousDrawFogVolumeCell=
  drawFogVolumeCell;

drawFogVolumeCell=function(
  cell,
  effect=null
){
  if(
    !candidateIsGaseousAreaEffect(
      effect
    )
  ){
    return candidateRev7PreviousDrawFogVolumeCell(
      cell,
      effect
    );
  }

  const raw=
    candidateRev7GasFormationRaw(
      effect
    );

  if(raw>=1){
    /*
      Use the original production renderer once formation is complete. Rev 6
      captured that renderer before introducing its vertical clipping pass.
    */
    return candidateRev6BaseDrawFogVolumeCell(
      cell,
      effect
    );
  }

  return candidateRev7DrawFogFormationCell(
    cell,
    effect,
    raw
  );
};


const candidateRev7PreviousDrawFogEffectOutline=
  drawFogEffectOutline;

drawFogEffectOutline=function(effect){
  if(
    !candidateIsGaseousAreaEffect(
      effect
    )
  ){
    return candidateRev7PreviousDrawFogEffectOutline(
      effect
    );
  }

  const raw=
    candidateRev7GasFormationRaw(
      effect
    );

  if(raw>=1){
    return candidateRev6BaseDrawFogEffectOutline(
      effect
    );
  }

  /*
    During formation each complete puff carries its own fading outline. Avoid
    drawing the finished union outline early; it appears only once the cloud
    has fully assembled.
  */
  return;
};


/* ============================================================
   DIAGNOSTICS
   ============================================================ */

window.AdventurePartyGaseousSpellPresentation={
  channel:"candidate",
  candidateRevision:7,
  formationMs:
    CANDIDATE_GAS_FORMATION_MS,
  formationStyle:
    "complete puff/oval layers, bottom-to-top, opacity fade only",
  layerCount:
    CANDIDATE_REV7_GAS_LAYER_COUNT,
  layerStagger:
    CANDIDATE_REV7_GAS_LAYER_STAGGER,
  layerFade:
    CANDIDATE_REV7_GAS_LAYER_FADE,
  mechanicalLosImmediate:true,
  inspect:(effectId)=>{
    const effect=
      (game?.areaEffects || [])
        .find(
          entry=>
            entry?.id===effectId
        ) || null;

    const raw=
      effect
        ? candidateRev7GasFormationRaw(
            effect
          )
        : null;

    return {
      effectId:
        effect?.id || null,
      name:
        effect?.name || null,
      spellKind:
        effect?.spellKind || null,
      gaseous:
        candidateIsGaseousAreaEffect(
          effect
        ),
      obscuresLOS:
        effect?.obscuresLOS!==false,
      formationStartedAt:
        effect?.gasFormationStartedAt ??
        null,
      rawProgress:raw,
      layerOpacity:
        raw===null
          ? null
          : Array.from(
              {
                length:
                  CANDIDATE_REV7_GAS_LAYER_COUNT
              },
              (_,layer)=>
                candidateRev7GasLayerOpacity(
                  raw,
                  layer
                )
            )
    };
  }
};
