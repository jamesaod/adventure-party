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
