/*
  R224 — HYPNOTIC PATTERN PERSISTENT VFX
  =======================================
  Presentation-only persistent spell visuals for Hypnotic Pattern.

  Gameplay remains the established R209 implementation:
  - seven-hex tactical footprint
  - 24 HD budget
  - saving throw negates
  - affected creatures cannot act
  - damage breaks the creature's fascination
  - existing three-round tactical duration
  - S, M components only; no spoken incantation

  R224 deliberately stores the visual separately from game.areaEffects so the
  R212 last-cast area-ownership rules cannot delete or displace unrelated fog,
  web, grease, Darkness, or other persistent gameplay areas.
*/

const R224_HYPNOTIC_COLORS=Object.freeze([
  [170,230,255],
  [205,170,255],
  [255,175,230],
  [255,230,150],
  [155,255,220],
  [236,220,255]
]);


function r224HypnoticVisualStore(){
  if(!game) return [];

  if(!Array.isArray(game.hypnoticPatternVisuals)){
    game.hypnoticPatternVisuals=[];
  }

  game.hypnoticPatternVisuals=
    game.hypnoticPatternVisuals.filter(effect=>
      effect &&
      Array.isArray(effect.cells) &&
      effect.cells.length &&
      (
        !Number.isFinite(effect.expiresRound) ||
        Number(game.round||0)<effect.expiresRound
      )
    );

  return game.hypnoticPatternVisuals;
}


function r224RegisterHypnoticPatternVisual(
  caster,
  targetHex,
  cells,
  expiresRound
){
  if(
    !game ||
    !targetHex ||
    !Array.isArray(cells) ||
    !cells.length
  ){
    return null;
  }

  const visual={
    id:
      `hypnotic-pattern-vfx:${caster?.id || "unknown"}:`+
      `${game.round}:${Date.now()}`,
    type:"hypnotic-pattern",
    spellKind:"hypnotic-pattern",
    name:"Hypnotic Pattern",
    sourceUnitId:caster?.id || null,
    centerHex:{
      x:targetHex.x,
      y:targetHex.y
    },
    cells:cells.map(cell=>({
      x:cell.x,
      y:cell.y
    })),
    createdAt:performance.now(),
    expiresRound,
    presentationOnly:true
  };

  r224HypnoticVisualStore().push(visual);
  queueMicrotask(()=>ensurePersistentStatusFxLoop());

  return visual;
}


function r224ActiveHypnoticPatternVisuals(){
  return r224HypnoticVisualStore();
}


function r224PersistentHypnotizedUnits(){
  if(!game || game.over) return [];

  return allUnits().filter(unit=>
    unit?.alive &&
    !unit.fled &&
    !!getUnitEffect(unit,"hypnotic-pattern")
  );
}


/* ============================================================
   CONTINUOUS ANIMATION LOOP INTEGRATION
   ============================================================ */

const r224BaseHasPersistentStatusFx=
  hasPersistentStatusFx;

hasPersistentStatusFx=function(){
  return !!(
    r224BaseHasPersistentStatusFx() ||
    r224ActiveHypnoticPatternVisuals().length ||
    r224PersistentHypnotizedUnits().length
  );
};


const r224BaseAddUnitEffect=
  addUnitEffect;

addUnitEffect=function(unit,effectSpec){
  const effect=
    r224BaseAddUnitEffect(
      unit,
      effectSpec
    );

  if(effectSpec?.id==="hypnotic-pattern"){
    queueMicrotask(()=>ensurePersistentStatusFxLoop());
  }

  return effect;
};


/* ============================================================
   CAST HOOK
   ============================================================ */

castHypnoticPatternSpell=async function(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("hypnotic-pattern");
  const level=
    action.casterLevel ||
    TEST_SPELL_CASTER_LEVEL;

  if(
    hexDistance(caster,targetHex)>
    spellRangeHexes(spell,level)
  ){
    setCombatMessage(
      "Hypnotic Pattern center is out of range."
    );
    return false;
  }

  if(
    lineOfSightBlockedBetweenHexes(
      caster,
      targetHex
    )
  ){
    setCombatMessage(
      "Line of sight is blocked to that hex."
    );
    return false;
  }

  spellCastInProgress=true;

  if(!commitSpellCast(caster,spell,action)){
    return await finishFailedSpellCommit(
      caster,
      action
    );
  }

  pendingAimAction=null;
  exitAimMode(false,false);

  const cells=
    hexesWithinRadius(
      targetHex,
      1
    )
      .filter(cell=>
        inside(cell.x,cell.y)
      );

  const expiresRound=
    game.round+3;

  /*
    The mesmerizing display exists whether or not any creature fails its save.
    It is registered before resolution so the spell visibly appears as the
    saving throws/results occur.
  */
  r224RegisterHypnoticPatternVisual(
    caster,
    targetHex,
    cells,
    expiresRound
  );

  let hdRemaining=24;

  const targets=
    livingUnitsInAreaCells(cells)
      .slice()
      .sort((a,b)=>
        spellHitDiceValue(a)-
        spellHitDiceValue(b)
      );

  const affected=[];

  for(const unit of targets){
    const hd=
      spellHitDiceValue(unit);

    if(hd>hdRemaining){
      continue;
    }

    const save=
      rollSpellSave(
        unit,
        caster
      );

    if(save.success){
      continue;
    }

    hdRemaining-=hd;

    addUnitEffect(unit,{
      id:"hypnotic-pattern",
      name:"Hypnotic Pattern",
      kind:"debuff",
      expiresRound,
      detail:
        "Fascinated; cannot act; damage breaks the effect",
      data:{
        sourceUnitId:caster.id
      }
    });

    affected.push(unit);
  }

  if(affected.length){
    await animateMagicEffectOnUnits(
      affected,
      "hypnotic-pattern"
    );
  }

  setCombatMessage(
    affected.length
      ? (
          `${affected.length} creature`+
          `${affected.length===1 ? "" : "s"} `+
          "stare helplessly at the Hypnotic Pattern."
        )
      : "No creature succumbs to the Hypnotic Pattern.",
    COMBAT_MESSAGE_MIN_HOLD_MS
  );

  await waitForCombatActionPause();

  finishTestSpellCast(
    caster,
    spell.name,
    action
  );

  return true;
};


/* ============================================================
   VISIBILITY / GEOMETRY HELPERS
   ============================================================ */

function r224VisibleHypnoticCells(effect){
  return (effect?.cells || [])
    .filter(cell=>
      inside(cell.x,cell.y) &&
      isHexOnBattlefieldScreen(
        cell.x,
        cell.y,
        HEX_W
      ) &&
      isHexVisibleToFriendlyParty(
        cell.x,
        cell.y
      )
    );
}


function r224HypnoticPresentationMetrics(effect){
  const cells=
    r224VisibleHypnoticCells(effect);

  if(!cells.length){
    return null;
  }

  const centers=
    cells.map(cell=>
      hexCenter(
        cell.x,
        cell.y
      )
    );

  const center={
    x:
      centers.reduce(
        (sum,p)=>sum+p.x,
        0
      )/centers.length,
    y:
      centers.reduce(
        (sum,p)=>sum+p.y,
        0
      )/centers.length
  };

  let maxDx=0;
  let maxDy=0;

  for(const p of centers){
    maxDx=Math.max(
      maxDx,
      Math.abs(p.x-center.x)
    );

    maxDy=Math.max(
      maxDy,
      Math.abs(p.y-center.y)
    );
  }

  return {
    cells,
    center,
    anchor:{
      x:center.x,
      y:center.y-HEX_W*0.76
    },
    radiusX:Math.max(
      HEX_W*0.72,
      Math.min(
        HEX_W*1.85,
        maxDx+HEX_W*0.62
      )
    ),
    radiusY:Math.max(
      25,
      Math.min(
        HEX_W*0.90,
        maxDy+HEX_W*0.34
      )
    ),
    volumeHeight:HEX_W*1.16
  };
}


function r224StringHash(value){
  const s=String(value || "");
  let hash=2166136261>>>0;

  for(let i=0;i<s.length;i++){
    hash^=s.charCodeAt(i);
    hash=Math.imul(hash,16777619)>>>0;
  }

  return hash>>>0;
}


function r224Hash01(seed,index,salt=0){
  let n=(
    seed ^
    Math.imul(index+17,2654435761) ^
    Math.imul(salt+53,2246822519)
  )>>>0;

  n^=n>>>15;
  n=Math.imul(n,3266489917)>>>0;
  n^=n>>>16;

  return n/4294967295;
}


function r224PatternAgeSeconds(effect){
  return Math.max(
    0,
    (
      performance.now()-
      Number(effect?.createdAt || 0)
    )/1000
  );
}


function r224PatternColor(index,alpha=1){
  const color=
    R224_HYPNOTIC_COLORS[
      (
        (index%R224_HYPNOTIC_COLORS.length)+
        R224_HYPNOTIC_COLORS.length
      )%
      R224_HYPNOTIC_COLORS.length
    ];

  return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}


/* ============================================================
   GROUND SHIMMER
   ============================================================ */

function r224DrawHypnoticGroundShimmer(effect){
  const metrics=
    r224HypnoticPresentationMetrics(effect);

  if(!metrics) return;

  const t=
    r224PatternAgeSeconds(effect);

  const pulse=
    0.5+
    0.5*
    Math.sin(
      t*1.15+
      r224StringHash(effect.id)*0.00001
    );

  const c=metrics.center;

  ctx.save();
  ctx.globalCompositeOperation="lighter";

  const gradient=
    ctx.createRadialGradient(
      c.x,
      c.y+3,
      0,
      c.x,
      c.y+3,
      metrics.radiusX*0.95
    );

  gradient.addColorStop(
    0,
    `rgba(192,175,255,${0.075+0.025*pulse})`
  );

  gradient.addColorStop(
    0.55,
    `rgba(130,220,255,${0.045+0.020*pulse})`
  );

  gradient.addColorStop(
    1,
    "rgba(110,150,255,0)"
  );

  ctx.fillStyle=gradient;

  ctx.beginPath();
  ctx.ellipse(
    c.x,
    c.y+4,
    metrics.radiusX,
    metrics.radiusY*0.75,
    0,
    0,
    Math.PI*2
  );
  ctx.fill();

  /*
    A pair of very faint projected rings anchors the airborne magic without
    turning Hypnotic Pattern into a conventional ground decal.
  */
  for(let ring=0;ring<2;ring++){
    const phase=
      t*(0.28+ring*0.06)+
      ring*Math.PI*0.7;

    ctx.strokeStyle=
      r224PatternColor(
        ring+1,
        0.10+0.025*pulse
      );

    ctx.lineWidth=1;

    ctx.beginPath();
    ctx.ellipse(
      c.x,
      c.y+4,
      metrics.radiusX*
        (0.62+ring*0.20),
      metrics.radiusY*
        (0.28+ring*0.10),
      Math.sin(phase)*0.12,
      0,
      Math.PI*2
    );
    ctx.stroke();
  }

  ctx.restore();
}


const r224BaseDrawSpellAreaEffects=
  drawSpellAreaEffects;

drawSpellAreaEffects=function(){
  r224BaseDrawSpellAreaEffects();

  for(const effect of r224ActiveHypnoticPatternVisuals()){
    r224DrawHypnoticGroundShimmer(effect);
  }
};


/* ============================================================
   AIRBORNE PATTERN VOLUME
   ============================================================ */

function r224TraceRibbon(
  effect,
  metrics,
  ribbonIndex
){
  const t=
    r224PatternAgeSeconds(effect);

  const seed=
    r224StringHash(
      effect.id
    );

  const anchor=
    metrics.anchor;

  const radiusX=
    metrics.radiusX*
    (
      0.58+
      ribbonIndex*0.085
    );

  const radiusY=
    metrics.radiusY*
    (
      0.72+
      ribbonIndex*0.06
    );

  const lift=
    (
      ribbonIndex-2.0
    )*
    6.2;

  const rotation=
    t*
      (
        ribbonIndex%2===0
          ? 0.19
          : -0.15
      )+
    ribbonIndex*0.82+
    r224Hash01(
      seed,
      ribbonIndex,
      11
    )*0.8;

  const wobble=
    0.22+
    ribbonIndex*0.035;

  const samples=64;

  ctx.beginPath();

  for(let i=0;i<=samples;i++){
    const u=
      i/samples*
      Math.PI*2;

    /*
      Lissajous-like loop:
      - x follows the primary ellipse
      - y includes a doubled-frequency weave
      - z is projected vertically to fake a ribbon moving through a volume
    */
    const localX=
      Math.cos(u)*
      radiusX;

    const localY=
      Math.sin(u)*
      radiusY*0.44;

    const weave=
      Math.sin(
        u*2+
        t*(0.42+ribbonIndex*0.035)+
        ribbonIndex
      )*
      metrics.volumeHeight*
      wobble;

    const rotatedX=
      localX*Math.cos(rotation)-
      localY*Math.sin(rotation);

    const rotatedY=
      localX*Math.sin(rotation)*
        0.18+
      localY*Math.cos(rotation);

    const x=
      anchor.x+
      rotatedX;

    const y=
      anchor.y+
      rotatedY+
      lift-
      weave*0.48;

    if(i===0){
      ctx.moveTo(x,y);
    }else{
      ctx.lineTo(x,y);
    }
  }

  const alpha=
    0.20+
    0.045*
    Math.sin(
      t*0.85+
      ribbonIndex*1.3
    );

  ctx.strokeStyle=
    r224PatternColor(
      ribbonIndex,
      alpha
    );

  ctx.lineWidth=
    2.0+
    (ribbonIndex%2)*0.65;

  ctx.stroke();
}


function r224DrawHypnoticArcs(
  effect,
  metrics
){
  const t=
    r224PatternAgeSeconds(effect);

  const seed=
    r224StringHash(effect.id);

  for(let arc=0;arc<7;arc++){
    const radius=
      metrics.radiusX*
      (
        0.32+
        arc*0.075
      );

    const phase=
      t*
      (
        arc%2===0
          ? 0.24
          : -0.20
      )+
      arc*0.76+
      r224Hash01(seed,arc,19);

    const span=
      Math.PI*
      (
        0.52+
        r224Hash01(
          seed,
          arc,
          23
        )*0.38
      );

    const yOffset=
      -metrics.volumeHeight*0.04+
      (
        r224Hash01(
          seed,
          arc,
          29
        )-
        0.5
      )*
      metrics.volumeHeight*
      0.54;

    ctx.strokeStyle=
      r224PatternColor(
        arc+2,
        0.18+
        0.08*
        (
          0.5+
          0.5*
          Math.sin(
            t*0.72+arc
          )
        )
      );

    ctx.lineWidth=
      1.2+
      (arc%3)*0.35;

    ctx.beginPath();

    ctx.ellipse(
      metrics.anchor.x,
      metrics.anchor.y+yOffset,
      radius,
      radius*
        (
          0.23+
          (arc%2)*0.06
        ),
      Math.sin(
        phase*0.37
      )*0.42,
      phase,
      phase+span
    );

    ctx.stroke();
  }
}


function r224DrawHypnoticCore(
  effect,
  metrics
){
  const t=
    r224PatternAgeSeconds(effect);

  const pulse=
    0.5+
    0.5*
    Math.sin(t*1.30);

  const x=
    metrics.anchor.x;

  const y=
    metrics.anchor.y-
    metrics.volumeHeight*0.03;

  ctx.save();
  ctx.globalCompositeOperation="lighter";

  const glowRadius=
    18+
    pulse*5;

  const glow=
    ctx.createRadialGradient(
      x,
      y,
      1,
      x,
      y,
      glowRadius
    );

  glow.addColorStop(
    0,
    `rgba(255,255,246,${0.30+0.10*pulse})`
  );

  glow.addColorStop(
    0.42,
    `rgba(235,205,255,${0.18+0.06*pulse})`
  );

  glow.addColorStop(
    1,
    "rgba(170,190,255,0)"
  );

  ctx.fillStyle=glow;
  ctx.beginPath();
  ctx.arc(
    x,
    y,
    glowRadius,
    0,
    Math.PI*2
  );
  ctx.fill();

  for(let loop=0;loop<3;loop++){
    const phase=
      t*
      (
        loop%2===0
          ? 0.44
          : -0.37
      )+
      loop*1.9;

    ctx.strokeStyle=
      r224PatternColor(
        loop+3,
        0.32+0.06*pulse
      );

    ctx.lineWidth=
      1.4+
      loop*0.25;

    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      9+loop*5,
      3.8+loop*2.4,
      phase,
      0,
      Math.PI*2
    );
    ctx.stroke();
  }

  ctx.fillStyle=
    `rgba(255,255,242,${0.72+0.14*pulse})`;

  ctx.beginPath();
  ctx.arc(
    x,
    y,
    2.1+pulse*0.8,
    0,
    Math.PI*2
  );
  ctx.fill();

  ctx.restore();
}


function r224DrawHypnoticMotes(
  effect,
  metrics
){
  const t=
    r224PatternAgeSeconds(effect);

  const seed=
    r224StringHash(effect.id);

  const moteCount=32;

  for(let i=0;i<moteCount;i++){
    const h1=
      r224Hash01(
        seed,
        i,
        41
      );

    const h2=
      r224Hash01(
        seed,
        i,
        47
      );

    const h3=
      r224Hash01(
        seed,
        i,
        59
      );

    const orbit=
      metrics.radiusX*
      (
        0.20+
        h1*0.72
      );

    const angle=
      h2*Math.PI*2+
      t*
      (
        0.11+
        h3*0.13
      )*
      (
        i%2===0
          ? 1
          : -1
      );

    const verticalCycle=
      (
        h3+
        t*
          (
            0.035+
            h1*0.035
          )
      )%1;

    const x=
      metrics.anchor.x+
      Math.cos(angle)*
      orbit;

    const y=
      metrics.anchor.y+
      Math.sin(angle)*
      orbit*
      0.24-
      (
        verticalCycle-0.5
      )*
      metrics.volumeHeight*
      0.74;

    const blink=
      0.5+
      0.5*
      Math.sin(
        t*
          (
            1.15+
            h2
          )+
        i*1.7
      );

    const radius=
      h3>0.88
        ? 2.0
        : h3>0.48
          ? 1.35
          : 0.9;

    ctx.fillStyle=
      r224PatternColor(
        i,
        0.22+
        blink*0.38
      );

    ctx.beginPath();
    ctx.arc(
      x,
      y,
      radius,
      0,
      Math.PI*2
    );
    ctx.fill();
  }
}


function r224DrawHypnoticPatternVolume(effect){
  const metrics=
    r224HypnoticPresentationMetrics(effect);

  if(!metrics) return;

  ctx.save();
  ctx.lineCap="round";
  ctx.lineJoin="round";
  ctx.globalCompositeOperation="lighter";

  /*
    Soft airborne envelope. It is intentionally very transparent: its purpose is
    to establish a 3-D magical volume, not to obscure units like fog.
  */
  const envelope=
    ctx.createRadialGradient(
      metrics.anchor.x,
      metrics.anchor.y,
      4,
      metrics.anchor.x,
      metrics.anchor.y,
      metrics.radiusX
    );

  envelope.addColorStop(
    0,
    "rgba(205,185,255,0.055)"
  );

  envelope.addColorStop(
    0.58,
    "rgba(145,220,255,0.035)"
  );

  envelope.addColorStop(
    1,
    "rgba(145,190,255,0)"
  );

  ctx.fillStyle=envelope;

  ctx.beginPath();
  ctx.ellipse(
    metrics.anchor.x,
    metrics.anchor.y,
    metrics.radiusX,
    metrics.volumeHeight*0.55,
    0,
    0,
    Math.PI*2
  );
  ctx.fill();

  for(let ribbon=0;ribbon<5;ribbon++){
    r224TraceRibbon(
      effect,
      metrics,
      ribbon
    );
  }

  r224DrawHypnoticArcs(
    effect,
    metrics
  );

  r224DrawHypnoticMotes(
    effect,
    metrics
  );

  r224DrawHypnoticCore(
    effect,
    metrics
  );

  ctx.restore();
}


/* ============================================================
   AFFECTED-UNIT ENTRANCEMENT STATUS
   ============================================================ */

function r224DrawHypnoticStatus(unit,index=0){
  if(
    !unit?.alive ||
    unit.fled ||
    !getUnitEffect(
      unit,
      "hypnotic-pattern"
    ) ||
    !shouldRenderUnitUnderPartyVisibility(unit)
  ){
    return;
  }

  const c=
    unitFootprintScreenCenter(unit);

  const t=
    performance.now()/1000;

  const phase=
    t*0.68+
    index*0.57;

  const pulse=
    0.5+
    0.5*
    Math.sin(
      t*1.25+
      index
    );

  const y=
    c.y-
    34*
    Math.max(
      1,
      enlargeVisualScale(unit)
    );

  ctx.save();
  ctx.globalCompositeOperation="lighter";
  ctx.lineCap="round";

  /*
    Delicate head-level halo: enough to identify the failed-save victims without
    resembling Sleep, Unconsciousness, or a generic buff ring.
  */
  for(let ring=0;ring<2;ring++){
    ctx.strokeStyle=
      r224PatternColor(
        index+ring+1,
        0.22+
        pulse*0.10
      );

    ctx.lineWidth=
      ring===0
        ? 1.45
        : 0.95;

    ctx.beginPath();

    ctx.ellipse(
      c.x,
      y+ring*1.5,
      11.5-ring*2.5,
      4.4-ring*1.0,
      Math.sin(
        phase+
        ring
      )*0.20,
      0,
      Math.PI*2
    );

    ctx.stroke();
  }

  for(let mote=0;mote<3;mote++){
    const angle=
      phase*
      (
        mote%2===0
          ? 1
          : -1
      )+
      mote*
      Math.PI*
      2/3;

    const mx=
      c.x+
      Math.cos(angle)*
      13;

    const my=
      y+
      Math.sin(angle)*
      5.4-
      2;

    const size=
      2.0+
      (
        mote===0
          ? pulse*0.7
          : 0
      );

    drawStatusStar(
      mx,
      my,
      size,
      r224PatternColor(
        index+mote+2,
        0.66+0.18*pulse
      ),
      "rgba(15,8,24,0.82)"
    );
  }

  ctx.restore();
}


function r224DrawAllHypnoticStatusFx(){
  const units=
    r224PersistentHypnotizedUnits();

  for(let i=0;i<units.length;i++){
    r224DrawHypnoticStatus(
      units[i],
      i
    );
  }
}


/*
  drawPersistentCharmStatusFx is already called after units and before transient
  projectile/explosion passes. Extend that established persistent-status pass so
  the floating pattern remains above the battlefield sprites while staying below
  messages, weather foreground, death markers, and UI.
*/
const r224BaseDrawPersistentCharmStatusFx=
  drawPersistentCharmStatusFx;

drawPersistentCharmStatusFx=function(){
  r224BaseDrawPersistentCharmStatusFx();

  for(const effect of r224ActiveHypnoticPatternVisuals()){
    r224DrawHypnoticPatternVolume(effect);
  }

  r224DrawAllHypnoticStatusFx();
};


/* ============================================================
   AIM TILE INSPECTION
   ============================================================ */

const r224BaseAreaEffectsAtHex=
  r223AreaEffectsAtHex;

r223AreaEffectsAtHex=function(x,y){
  const result=
    r224BaseAreaEffectsAtHex(
      x,
      y
    );

  for(const effect of r224ActiveHypnoticPatternVisuals()){
    if(
      r223AreaEffectCoversHex(
        effect,
        x,
        y
      )
    ){
      result.push(effect);
    }
  }

  return result;
};


const r224BaseAreaEffectRuleText=
  r223AreaEffectRuleText;

r223AreaEffectRuleText=function(effect){
  if(
    effect?.type==="hypnotic-pattern"
  ){
    return (
      "Entrancing visual pattern; creatures that fail their save are "+
      "fascinated and cannot act until the effect ends or damage breaks it."
    );
  }

  return r224BaseAreaEffectRuleText(effect);
};


if(window.AdventurePartyAimTileEffects){
  window.AdventurePartyAimTileEffects.effectsAtHex=
    r223AreaEffectsAtHex;
}


/* ============================================================
   DIAGNOSTICS
   ============================================================ */

window.AdventurePartyHypnoticPatternFx={
  visuals:r224ActiveHypnoticPatternVisuals,
  affectedUnits:r224PersistentHypnotizedUnits,
  metrics:r224HypnoticPresentationMetrics
};
