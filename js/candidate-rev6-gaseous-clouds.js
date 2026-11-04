/*
  Candidate Rev 6 — gaseous LOS contract + bottom-up formation
  =============================================================
  All production fog/cloud area effects share one explicit LOS contract and
  reveal their rendered volume from the tactical floor upward over one second.

  Mechanical obscuration is immediate. The one-second formation is visual only.
*/

const CANDIDATE_GAS_FORMATION_MS=1000;


/* ============================================================
   SHARED GASEOUS EFFECT CONTRACT
   ============================================================ */

function candidateIsGaseousAreaEffect(effect){
  return !!(
    effect &&
    effect.type==="fog"
  );
}


function candidateGasFormationProgress(
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

  const raw=
    Math.max(
      0,
      Math.min(
        1,
        (now-started)/
        CANDIDATE_GAS_FORMATION_MS
      )
    );

  /* Smoothstep keeps the floor emergence and final settle from snapping. */
  return raw*raw*(3-2*raw);
}


function candidateGasFormationClipForCell(
  cell,
  effect
){
  const center=
    hexCenter(
      cell.x,
      cell.y
    );

  const progress=
    candidateGasFormationProgress(
      effect
    );

  const bottomY=
    center.y+
    HEX_H*0.58+
    10;

  const topY=
    center.y-
    HEX_W-
    18;

  const fullHeight=
    bottomY-topY;

  return {
    progress,
    left:
      center.x-
      HEX_W*0.72,
    top:
      bottomY-
      fullHeight*progress,
    width:
      HEX_W*1.44,
    height:
      Math.max(
        0,
        fullHeight*progress
      ),
    bottomY
  };
}


const candidateRev6BaseAddAreaEffect=
  addAreaEffect;

addAreaEffect=function(effect){
  if(candidateIsGaseousAreaEffect(effect)){
    /*
      R217 already treats fog as obscuring unless explicitly false. Make that
      contract explicit on newly-created gaseous spells so Fog Cloud and
      Stinking Cloud cannot silently diverge from Wall of Fog in later layers.
    */
    if(effect.obscuresLOS===undefined){
      effect.obscuresLOS=true;
    }

    if(
      !Number.isFinite(
        effect.gasFormationStartedAt
      )
    ){
      effect.gasFormationStartedAt=
        performance.now();
    }

    effect.gasFormationDurationMs=
      CANDIDATE_GAS_FORMATION_MS;
  }

  return candidateRev6BaseAddAreaEffect(
    effect
  );
};


/* ============================================================
   BOTTOM-UP CLOUD FORMATION
   ============================================================ */

const candidateRev6BaseDrawFogVolumeCell=
  drawFogVolumeCell;

drawFogVolumeCell=function(
  cell,
  effect=null
){
  if(
    !candidateIsGaseousAreaEffect(effect)
  ){
    return candidateRev6BaseDrawFogVolumeCell(
      cell,
      effect
    );
  }

  const clip=
    candidateGasFormationClipForCell(
      cell,
      effect
    );

  if(clip.progress<=0.001){
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(
    clip.left,
    clip.top,
    clip.width,
    clip.height
  );
  ctx.clip();

  candidateRev6BaseDrawFogVolumeCell(
    cell,
    effect
  );

  ctx.restore();
};


const candidateRev6BaseDrawFogEffectOutline=
  drawFogEffectOutline;

drawFogEffectOutline=function(effect){
  if(
    !candidateIsGaseousAreaEffect(effect) ||
    !Array.isArray(effect.cells) ||
    !effect.cells.length
  ){
    return candidateRev6BaseDrawFogEffectOutline(
      effect
    );
  }

  const progress=
    candidateGasFormationProgress(
      effect
    );

  if(progress<=0.001){
    return;
  }

  const centers=
    effect.cells
      .filter(cell=>
        inside(cell.x,cell.y)
      )
      .map(cell=>
        hexCenter(
          cell.x,
          cell.y
        )
      );

  if(!centers.length){
    return;
  }

  const minX=
    Math.min(
      ...centers.map(
        point=>point.x
      )
    )-
    HEX_W*1.45;

  const maxX=
    Math.max(
      ...centers.map(
        point=>point.x
      )
    )+
    HEX_W*1.45;

  const bottomY=
    Math.max(
      ...centers.map(
        point=>
          point.y+
          HEX_H*0.58+
          12
      )
    );

  const topY=
    Math.min(
      ...centers.map(
        point=>
          point.y-
          HEX_W-
          20
      )
    );

  const fullHeight=
    bottomY-topY;

  ctx.save();
  ctx.beginPath();
  ctx.rect(
    minX,
    bottomY-
      fullHeight*progress,
    maxX-minX,
    fullHeight*progress
  );
  ctx.clip();

  candidateRev6BaseDrawFogEffectOutline(
    effect
  );

  ctx.restore();
};


/* ============================================================
   DIAGNOSTICS
   ============================================================ */

window.AdventurePartyGaseousSpellPresentation={
  channel:"candidate",
  candidateRevision:6,
  formationMs:
    CANDIDATE_GAS_FORMATION_MS,
  mechanicalLosImmediate:true,
  inspect:(effectId)=>{
    const effect=
      (game?.areaEffects || [])
        .find(
          entry=>
            entry?.id===effectId
        ) || null;

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
      formationProgress:
        effect
          ? candidateGasFormationProgress(
              effect
            )
          : null
    };
  }
};
