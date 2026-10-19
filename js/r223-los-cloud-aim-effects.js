/*
  R223 — LOS-AWARE STINKING CLOUD + AIM TILE EFFECT INSPECTION
  ============================================================
  - Stinking Cloud keeps its low 0.125 body opacity over party-visible cells.
  - The same cloud returns to 0.50 opacity only where its tactical cell is
    currently outside party LOS, making hidden space visibly concealed.
  - AIM inspection now reports persistent area effects occupying the aimed hex,
    whether or not a visible unit occupies that hex.
*/


/* ============================================================
   LOS-AWARE STINKING CLOUD OPACITY
   ============================================================ */

function r223StinkingCloudOpacityForCell(
  cell,
  effect=null
){
  if(
    effect?.spellKind!=="stinking-cloud" ||
    !cell ||
    !inside(cell.x,cell.y)
  ){
    return 0.125;
  }

  /*
    R219's transparent value remains authoritative where the party can actually
    see the tactical cell. No-LOS portions return to the original fog-volume
    opacity instead of letting hidden space read as transparent.

    Because party visibility is a union of living friendly observers, a
    friendly unit standing inside the cloud keeps its own cell transparent
    enough to remain readable while cells it cannot see become denser.
  */
  return isHexVisibleToFriendlyParty(
    cell.x,
    cell.y
  )
    ? 0.125
    : 0.50;
}


/* ============================================================
   AIM TILE EFFECT INSPECTION
   ============================================================ */

function r223EscapeHtml(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function r223AreaEffectCoversHex(
  effect,
  x,
  y
){
  if(!effect) return false;

  if(
    Array.isArray(effect.cells) &&
    areaEffectContains(
      effect,
      x,
      y
    )
  ){
    return true;
  }

  /*
    Illumination fields are radial rather than cell arrays. Include them in AIM
    inspection whenever the aimed hex lies inside their effective radius.
  */
  if(
    effect.type==="illumination" &&
    Number.isFinite(effect.x) &&
    Number.isFinite(effect.y)
  ){
    return (
      hexDistance(
        {x:effect.x,y:effect.y},
        {x,y}
      )<=
      Math.max(
        0,
        Number(effect.radiusHexes)||0
      )
    );
  }

  return false;
}

function r223AreaEffectsAtHex(x,y){
  if(!game || !inside(x,y)) return [];

  return (game.areaEffects || [])
    .filter(effect=>
      r223AreaEffectCoversHex(
        effect,
        x,
        y
      )
    );
}

function r223AreaEffectName(effect){
  if(!effect) return "Area Effect";

  if(effect.name){
    return String(effect.name);
  }

  if(effect.sourceName){
    return String(effect.sourceName);
  }

  if(effect.spellKind==="stinking-cloud"){
    return "Stinking Cloud";
  }

  if(effect.spellKind==="fog-cloud"){
    return "Fog Cloud";
  }

  if(effect.type==="fog"){
    return "Wall of Fog";
  }

  const fallback={
    grease:"Grease",
    web:"Web",
    darkness:"Darkness",
    "flaming-sphere":"Flaming Sphere",
    illumination:"Magical Light"
  };

  return (
    fallback[effect.type] ||
    String(effect.type || "Area Effect")
  );
}

function r223AreaEffectRuleText(effect){
  if(!effect) return "";

  if(effect.spellKind==="stinking-cloud"){
    return "Obscures sight/projectiles; poison save; failed save causes nausea.";
  }

  if(effect.spellKind==="fog-cloud"){
    return "Dense fog obscures sight and projectile lanes.";
  }

  if(effect.type==="fog"){
    return "Opaque fog obscures sight and projectile lanes.";
  }

  if(effect.type==="grease"){
    return "Slippery surface; entering/caught creatures may fall prone.";
  }

  if(effect.type==="web"){
    return "Restraining magical web; failed save can leave a creature Webbed.";
  }

  if(effect.type==="darkness"){
    return "Magical darkness blocks normal vision and illumination.";
  }

  if(effect.type==="flaming-sphere"){
    return "Mobile fire hazard; contact and adjacent heat can cause fire damage.";
  }

  if(effect.type==="illumination"){
    return "Magical illumination field.";
  }

  return "";
}

function r223AreaEffectDurationText(effect){
  if(!effect) return "";

  if(Number.isFinite(effect.expiresRound)){
    const remaining=
      Math.max(
        0,
        Number(effect.expiresRound)-
        Number(game?.round || 0)
      );

    return (
      remaining===0
        ? "expires this round"
        : `${remaining} round${remaining===1 ? "" : "s"} remaining`
    );
  }

  if(effect.expiresRound===null){
    return "persistent";
  }

  return "";
}

function r223AreaEffectSourceText(effect){
  if(!effect?.sourceUnitId) return "";

  const source=
    getUnitById(effect.sourceUnitId);

  return source?.name
    ? `Source: ${source.name}`
    : "";
}

function r223AreaEffectDetail(effect){
  return [
    r223AreaEffectRuleText(effect),
    r223AreaEffectDurationText(effect),
    r223AreaEffectSourceText(effect)
  ]
    .filter(Boolean)
    .join(" ");
}

function r223RenderAimTileEffects(
  x,
  y,
  {
    append=false
  }={}
){
  const effects=
    r223AreaEffectsAtHex(x,y);

  if(
    !append ||
    ui.unitInfoEffects.hidden
  ){
    if(!append){
      ui.unitInfoEffects.innerHTML="";
    }
  }

  if(!effects.length){
    if(!append){
      ui.unitInfoEffects.hidden=true;
    }
    return;
  }

  const html=
    effects.map(effect=>
      '<div class="unit-effect area-effect">'+
        '<div>'+
          r223EscapeHtml(
            r223AreaEffectName(effect)
          )+
        '</div>'+
        (
          r223AreaEffectDetail(effect)
            ? '<div>'+
                r223EscapeHtml(
                  r223AreaEffectDetail(effect)
                )+
              '</div>'
            : ""
        )+
      '</div>'
    ).join("");

  ui.unitInfoEffects.insertAdjacentHTML(
    "beforeend",
    html
  );

  ui.unitInfoEffects.hidden=false;
}

function r223AimModeLabel(){
  return pendingAimAction
    ? (
        getSpellEntry(
          pendingAimAction.spellId
        )?.name ||
        "TARGET ACTION"
      )
    : "INSPECT / TARGET";
}

function r223RenderEmptyAimHex(x,y){
  const losVisible=
    isHexVisibleToFriendlyParty(x,y);

  const environment=
    environmentAtWorldPoint(
      worldPointForHex(x,y)
    );

  ui.unitInfoName.textContent=
    `Hex ${x}, ${y}`;

  ui.unitInfoMode.textContent=
    r223AimModeLabel();

  ui.unitInfoRows.innerHTML=
    '<span>Hex</span>'+
      `<span>${x}, ${y}</span>`+
    '<span>Line of Sight</span>'+
      `<span>${losVisible ? "Visible" : "Obscured"}</span>`+
    '<span>Environment</span>'+
      `<span>${r223EscapeHtml(environment==="indoor" ? "Indoor" : "Outdoor")}</span>`;

  ui.unitInfoAbilities.innerHTML="";
  ui.unitInfoAbilities.hidden=true;

  ui.unitInfoEffects.innerHTML="";
  ui.unitInfoEffects.hidden=true;

  r223RenderAimTileEffects(
    x,
    y,
    {append:false}
  );
}


const r223BaseUpdateUnitInfoPanel=
  updateUnitInfoPanel;

updateUnitInfoPanel=function(){
  if(!game) return;

  if(!aimMode){
    r223BaseUpdateUnitInfoPanel();
    return;
  }

  const x=aimCursor.x;
  const y=aimCursor.y;

  const rawInspected=
    unitAtHex(x,y);

  const inspected=
    (
      rawInspected &&
      (
        isFriendlyCombatUnit(rawInspected) ||
        isUnitVisibleToFriendlyParty(
          rawInspected
        )
      )
    )
      ? rawInspected
      : null;

  if(!inspected){
    /*
      Unlike the old "preserve last valid unit" behavior, AIM over an empty or
      hidden-unit hex now intentionally shows information about the selected
      tactical tile itself.
    */
    r223RenderEmptyAimHex(
      x,
      y
    );
    return;
  }

  /*
    Let the existing panel renderer build all normal unit statistics/status
    information first, then augment it with tile context.
  */
  r223BaseUpdateUnitInfoPanel();

  ui.unitInfoRows.insertAdjacentHTML(
    "beforeend",
    '<span>Aimed Hex</span>'+
    `<span>${x}, ${y}</span>`+
    '<span>Hex LOS</span>'+
    `<span>${isHexVisibleToFriendlyParty(x,y) ? "Visible" : "Obscured"}</span>`
  );

  r223RenderAimTileEffects(
    x,
    y,
    {append:true}
  );
};


/* Public diagnostic hook for AIM/tile inspection. */
window.AdventurePartyAimTileEffects={
  effectsAtHex:r223AreaEffectsAtHex,
  opacityForStinkingCloud:r223StinkingCloudOpacityForCell
};


/* ============================================================
   R223 — LEVEL 2 LATIN INCANTATIONS
   ============================================================ */

const R223_LEVEL2_INCANTATIONS=Object.freeze({
  "blindness":"Caecitas!",
  "blur":"Imago Tremula!",
  "continual-light":"Lux Perpetua!",
  "darkness-15-radius":"Orbis Tenebrarum!",
  "deafness":"Surditia!",
  "detect-invisibility":"Invisibilia Pateant!",
  "flaming-sphere":"Sphaera Ignea!",
  "fog-cloud":"Nebula Densa!",
  "glitterdust":"Pulvis Scintillans!",
  "invisibility":"Invisibilis Esto!",
  "melfs-acid-arrow":"Sagitta Acida!",
  "mirror-image":"Imagines Speculares!",
  "pyrotechnics":"Spectaculum Ignis!",
  "ray-of-enfeeblement":"Radius Languoris!",
  "scare":"Pavorem Incute!",
  "spectral-hand":"Manus Spectralis!",
  "stinking-cloud":"Nubes Foetida!",
  "strength":"Robur Corporis!",
  "tashas-hideous-laughter":"Risus Foedus Tashae!",
  "web":"Rete Araneum!"
});

for(const [spellId,incantation] of Object.entries(R223_LEVEL2_INCANTATIONS)){
  const spell=getSpellEntry(spellId);
  if(spell){
    spell.incantation=incantation;
  }
}

/*
  Hypnotic Pattern has S, M components but no V component. Keep it explicitly
  silent even if a future data merge accidentally supplies an incantation.
*/
if(getSpellEntry("hypnotic-pattern")){
  delete getSpellEntry("hypnotic-pattern").incantation;
}


/* ============================================================
   R223 — DENSER DRAGON BREATH EDGE-OVERLAP VFX
   ============================================================ */

drawDragonBreathFx=function(){
  if(!dragonBreathFx) return;

  const fx=dragonBreathFx;
  const dragon=getUnitById(fx.dragonId);
  if(!dragon) return;

  const now=performance.now();
  const elapsed=Math.max(0,now-fx.started);
  const frameMs=58;
  const frame=Math.floor(elapsed/frameMs);
  const steppedElapsed=Math.min(fx.duration,frame*frameMs);
  const t=Math.max(0,Math.min(1,steppedElapsed/Math.max(1,fx.duration)));

  const growthEnd=0.58;
  const growth=Math.min(1,t/growthEnd);
  const fade=t<0.72
    ? 1
    : Math.max(0,1-(t-0.72)/0.28);

  if(growth<=0 || fade<=0) return;

  const presentation=dragonPresentationMetrics(dragon,"attack");
  const mouth={
    x:presentation.anchor.x+
      (dragon.facing==="left" ? -1 : 1)*presentation.width*0.36,
    y:presentation.anchor.y-presentation.height*0.41
  };

  function hash32(a,b,c,d){
    let n=(
      Math.imul((a|0)+4099,73856093) ^
      Math.imul((b|0)-8191,19349663) ^
      Math.imul((c|0)+131,83492791) ^
      Math.imul((d|0)+17,2654435761)
    )>>>0;
    n^=n>>>13;
    n=Math.imul(n,1274126177)>>>0;
    n^=n>>>16;
    return n>>>0;
  }

  function hash01(a,b,c,d){
    return hash32(a,b,c,d)/4294967295;
  }

  const flamePalette=[
    [112,18,6],
    [176,34,6],
    [229,67,7],
    [255,112,12],
    [255,171,30],
    [255,218,78],
    [255,244,174],
    [255,255,236]
  ];

  const visibleCells=(fx.cells || [])
    .filter(cell=>
      Number(cell.breathStep||0) <=
      Math.max(1,Math.ceil((Number(fx.rangeHexes)||9)*growth))
    )
    .slice();

  if(!visibleCells.length) return;

  const maxVisibleStep=Math.max(
    ...visibleCells.map(cell=>Math.max(1,Number(cell.breathStep)||1))
  );

  const farRow=visibleCells.filter(cell=>
    (Number(cell.breathStep)||1)===maxVisibleStep
  );

  const farCenterCell=
    farRow.find(cell=>(Number(cell.breathLane)||0)===0) ||
    farRow[Math.floor(farRow.length/2)] ||
    visibleCells[visibleCells.length-1];

  const farCenter=hexCenter(farCenterCell.x,farCenterCell.y);
  farCenter.y-=7;

  const fullDx=farCenter.x-mouth.x;
  const fullDy=farCenter.y-mouth.y;
  const fullLength=Math.max(1,Math.hypot(fullDx,fullDy));
  const dirX=fullDx/fullLength;
  const dirY=fullDy/fullLength;
  const normalX=-dirY;
  const normalY=dirX;
  const directionAngle=Math.atan2(dirY,dirX);

  const fullEndHalfWidth=Math.min(
    62,
    Math.max(34,fullLength*0.115)
  );

  const currentLength=fullLength*growth;
  const currentEndHalfWidth=4+(fullEndHalfWidth-4)*growth;

  const coneEnd={
    x:mouth.x+dirX*currentLength,
    y:mouth.y+dirY*currentLength
  };

  /*
    R223: outermost fast flame lobes are centered directly ON the mathematical
    cone boundary. That puts approximately half of each round/elliptical object
    inside the cone and half beyond the edge.

    The clip expands only enough to preserve those edge halves instead of
    cutting them off. Gameplay breath geometry is untouched.
  */
  const edgeLobeAllowance=
    6+
    4*growth;

  const bodyCanvas=document.createElement("canvas");
  bodyCanvas.width=ctx.canvas.width;
  bodyCanvas.height=ctx.canvas.height;
  const bodyCtx=bodyCanvas.getContext("2d");
  bodyCtx.imageSmoothingEnabled=false;

  bodyCtx.save();
  bodyCtx.beginPath();
  bodyCtx.moveTo(
    mouth.x+normalX*(3+edgeLobeAllowance*0.62),
    mouth.y+normalY*(3+edgeLobeAllowance*0.62)
  );
  bodyCtx.lineTo(
    coneEnd.x+
      normalX*(currentEndHalfWidth+edgeLobeAllowance),
    coneEnd.y+
      normalY*(currentEndHalfWidth+edgeLobeAllowance)
  );
  bodyCtx.lineTo(
    coneEnd.x-
      normalX*(currentEndHalfWidth+edgeLobeAllowance),
    coneEnd.y-
      normalY*(currentEndHalfWidth+edgeLobeAllowance)
  );
  bodyCtx.lineTo(
    mouth.x-normalX*(3+edgeLobeAllowance*0.62),
    mouth.y-normalY*(3+edgeLobeAllowance*0.62)
  );
  bodyCtx.closePath();
  bodyCtx.clip();

  /*
    R223 substantially increases flame-lobe density:
      R192: 52 slices, 3..8 lobes per slice
      R223: 72 slices, 4..12 lobes per slice

    Outermost lobes use lateralNorm +/-1.0 exactly, so their centers lie on
    the theoretical cone edge and the object overlaps that edge by ~50%.
  */
  const sliceCount=72;
  const visibleSlices=Math.max(3,Math.ceil(sliceCount*growth));

  for(let slice=0;slice<visibleSlices;slice++){
    const q=(slice+1)/sliceCount;
    const centerX=mouth.x+dirX*fullLength*q;
    const centerY=mouth.y+dirY*fullLength*q;
    const halfWidth=4+(fullEndHalfWidth-4)*q;
    const acrossCount=4+Math.round(q*8);

    for(let across=0;across<acrossCount;across++){
      const lateralNorm=
        acrossCount===1
          ? 0
          : (across/(acrossCount-1))*2-1;

      const edgeObject=
        across===0 ||
        across===acrossCount-1;

      const h1=hash01(slice,across,frame%7,11);
      const h2=hash01(slice+71,across-37,frame+19,23);
      const h3=hash01(slice-43,across+113,frame+31,37);
      const h4=hash01(slice+149,across+29,frame+47,53);

      const lateral=
        edgeObject
          ? Math.sign(lateralNorm || 1)*halfWidth
          : (
              lateralNorm*halfWidth*0.93+
              (h1-0.5)*2.5
            );

      const alongJitter=(h2-0.5)*2.3;

      const px=
        centerX+
        dirX*alongJitter+
        normalX*lateral;

      const py=
        centerY+
        dirY*alongJitter+
        normalY*lateral;

      const radius=(
        5.2+
        q*3.8+
        h3*1.8
      )*Math.max(0.48,Math.min(1,growth*1.18));

      const rx=radius*(1.13+0.08*h1);
      const ry=radius*(0.72+0.08*h4);

      const lateralHeat=
        1-
        Math.min(
          1,
          Math.abs(lateralNorm)
        );

      const heat=Math.max(
        0,
        0.96-
        q*0.18-
        (1-lateralHeat)*0.62
      );

      let colorIndex=Math.round(
        2+
        heat*5+
        (h4>0.70 ? 1 : h4<0.18 ? -1 : 0)
      );

      colorIndex=Math.max(
        0,
        Math.min(
          flamePalette.length-1,
          colorIndex
        )
      );

      const [r,g,b]=flamePalette[colorIndex];

      bodyCtx.fillStyle=
        `rgba(${r},${g},${b},1)`;

      bodyCtx.beginPath();
      bodyCtx.ellipse(
        px,
        py,
        rx,
        ry,
        directionAngle,
        0,
        Math.PI*2
      );
      bodyCtx.fill();
    }

    const coreH=hash01(slice,frame,83,97);
    const coreRadius=
      (3.0+q*1.9)*
      (0.82+coreH*0.18);

    const coreX=
      centerX+
      normalX*(coreH-0.5)*1.5;

    const coreY=
      centerY+
      normalY*(coreH-0.5)*1.5;

    bodyCtx.fillStyle=
      q<0.62
        ? "rgba(255,255,244,1)"
        : "rgba(255,245,184,1)";

    bodyCtx.beginPath();
    bodyCtx.ellipse(
      coreX,
      coreY,
      coreRadius*1.75,
      coreRadius*0.82,
      directionAngle,
      0,
      Math.PI*2
    );
    bodyCtx.fill();
  }

  /*
    Denser muzzle bridge so the increased particle field still reads as one
    continuous breath emerging from the dragon's mouth.
  */
  for(let i=0;i<8;i++){
    const q=(i+1)/88;
    const px=mouth.x+dirX*fullLength*q;
    const py=mouth.y+dirY*fullLength*q;
    const radius=(3.4+i*0.58)*Math.max(0.55,growth);

    bodyCtx.fillStyle=
      i<6
        ? "rgba(255,255,246,1)"
        : "rgba(255,225,96,1)";

    bodyCtx.beginPath();
    bodyCtx.ellipse(
      px,
      py,
      radius*1.55,
      radius*0.70,
      directionAngle,
      0,
      Math.PI*2
    );
    bodyCtx.fill();
  }

  bodyCtx.restore();

  const silhouetteCanvas=document.createElement("canvas");
  silhouetteCanvas.width=bodyCanvas.width;
  silhouetteCanvas.height=bodyCanvas.height;

  const silhouetteCtx=silhouetteCanvas.getContext("2d");
  silhouetteCtx.imageSmoothingEnabled=false;
  silhouetteCtx.drawImage(bodyCanvas,0,0);
  silhouetteCtx.globalCompositeOperation="source-in";
  silhouetteCtx.fillStyle="rgba(0,0,0,1)";
  silhouetteCtx.fillRect(
    0,
    0,
    silhouetteCanvas.width,
    silhouetteCanvas.height
  );
  silhouetteCtx.globalCompositeOperation="source-over";

  const outlineCanvas=document.createElement("canvas");
  outlineCanvas.width=bodyCanvas.width;
  outlineCanvas.height=bodyCanvas.height;

  const outlineCtx=outlineCanvas.getContext("2d");
  outlineCtx.imageSmoothingEnabled=false;

  for(let dy=-2;dy<=2;dy++){
    for(let dx=-2;dx<=2;dx++){
      if(dx===0 && dy===0) continue;
      if((dx*dx)+(dy*dy)>4) continue;
      outlineCtx.drawImage(silhouetteCanvas,dx,dy);
    }
  }

  outlineCtx.globalCompositeOperation="destination-out";
  outlineCtx.drawImage(silhouetteCanvas,0,0);
  outlineCtx.globalCompositeOperation="source-over";

  ctx.save();
  ctx.imageSmoothingEnabled=false;

  /*
    R223 increases the exhaust population as well so the denser flame cone does
    not terminate into a comparatively sparse smoke field.
  */
  const smokePuffCount=32;

  for(let puff=0;puff<smokePuffCount;puff++){
    const h1=hash01(puff,frame+307,5,13);
    const h2=hash01(puff+97,frame-179,17,29);
    const h3=hash01(puff-211,frame+263,31,43);

    const q=0.64+h1*0.36;
    if(q>growth+0.02) continue;

    const halfWidth=4+(fullEndHalfWidth-4)*q;
    const lateral=(h2-0.5)*halfWidth*1.30;
    const age=(t+h3*0.24)%1;

    const sx=
      mouth.x+
      dirX*fullLength*q+
      normalX*lateral;

    const sy=
      mouth.y+
      dirY*fullLength*q+
      normalY*lateral-
      age*(18+q*24);

    const smokeRadius=(
      7+
      q*11+
      hash01(puff,frame,59,71)*5
    )*(0.78+0.28*growth);

    const smokeAlpha=
      (0.10+q*0.12)*
      (1-age*0.72)*
      fade;

    ctx.globalAlpha=smokeAlpha;

    ctx.fillStyle=
      puff%3===0
        ? "#171a1e"
        : puff%3===1
          ? "#292c30"
          : "#3a3c3f";

    ctx.beginPath();
    ctx.ellipse(
      sx,
      sy,
      smokeRadius*1.15,
      smokeRadius*0.72,
      0,
      0,
      Math.PI*2
    );
    ctx.fill();
  }

  ctx.save();
  ctx.globalCompositeOperation="lighter";
  ctx.filter="blur(6px)";
  ctx.globalAlpha=0.31*fade;
  ctx.drawImage(bodyCanvas,0,0);
  ctx.filter="blur(2px)";
  ctx.globalAlpha=0.19*fade;
  ctx.drawImage(bodyCanvas,0,0);
  ctx.restore();

  ctx.globalAlpha=0.55*fade;
  ctx.drawImage(outlineCanvas,0,0);

  ctx.globalAlpha=0.92*fade;
  ctx.drawImage(bodyCanvas,0,0);

  ctx.globalCompositeOperation="lighter";
  ctx.globalAlpha=0.25*fade;
  ctx.drawImage(bodyCanvas,0,0);
  ctx.globalCompositeOperation="source-over";
  ctx.globalAlpha=1;

  const grainCount=
    Math.max(
      260,
      Math.round(520*growth)
    );

  for(let i=0;i<grainCount;i++){
    const q=
      hash01(
        i,
        fx.source.x+11,
        fx.source.y-17,
        3
      )*growth;

    const h2=
      hash01(
        i,
        fx.source.x-29,
        fx.source.y+7,
        9
      );

    const h3=
      hash01(
        i,
        fx.source.x+53,
        fx.source.y+91,
        15
      );

    const halfWidth=
      4+
      (fullEndHalfWidth-4)*q;

    const lateral=
      (h2-0.5)*
      2*
      halfWidth*
      0.96;

    const px=
      mouth.x+
      dirX*fullLength*q+
      normalX*lateral;

    const py=
      mouth.y+
      dirY*fullLength*q+
      normalY*lateral;

    const size=h3>0.84 ? 3 : 2;

    const lateralNorm=
      halfWidth>0
        ? Math.min(
            1,
            Math.abs(lateral)/halfWidth
          )
        : 0;

    ctx.fillStyle=
      lateralNorm<0.34
        ? `rgba(255,255,232,${0.74*fade})`
        : lateralNorm<0.72
          ? `rgba(255,210,82,${0.64*fade})`
          : `rgba(235,78,8,${0.48*fade})`;

    ctx.fillRect(
      Math.round(px),
      Math.round(py),
      size,
      size
    );
  }

  const particleCount=680;

  for(let i=0;i<particleCount;i++){
    const born=
      hash01(
        fx.source.x+211,
        fx.source.y-97,
        i,
        7
      )*0.46;

    if(t<born) continue;

    const life=Math.max(
      0,
      Math.min(
        1,
        (t-born)/
          Math.max(0.01,1-born)
      )
    );

    if(life>=1) continue;

    const q=
      hash01(
        fx.source.x-43,
        fx.source.y+67,
        i,
        13
      );

    if(q>growth+0.07) continue;

    const halfWidth=
      4+
      (fullEndHalfWidth-4)*
      Math.min(1,q);

    const lateral=(
      hash01(
        fx.source.x+19,
        fx.source.y+149,
        i,
        23
      )-0.5
    )*2*halfWidth*1.12;

    const rise=
      life*(
        9+
        hash01(
          fx.source.x+89,
          fx.source.y-17,
          i,
          31
        )*30
      );

    const px=
      mouth.x+
      dirX*fullLength*q+
      normalX*lateral;

    const py=
      mouth.y+
      dirY*fullLength*q+
      normalY*lateral-
      rise;

    const sizeRoll=
      hash01(
        fx.source.x-131,
        fx.source.y+41,
        i,
        47
      );

    const size=
      sizeRoll>0.94
        ? 3
        : sizeRoll>0.55
          ? 2
          : 1;

    const alpha=
      Math.max(0,1-life)*
      0.62*
      fade;

    ctx.fillStyle=
      i%3===0
        ? `rgba(255,242,150,${alpha})`
        : i%3===1
          ? `rgba(255,132,20,${alpha})`
          : `rgba(196,45,8,${alpha})`;

    if(i%4===0){
      ctx.fillRect(
        Math.round(px),
        Math.round(py),
        size,
        Math.max(2,size+2)
      );
    }else{
      ctx.fillRect(
        Math.round(px),
        Math.round(py),
        size,
        size
      );
    }
  }

  ctx.restore();
};
