/*
  R232 — LIGHTNING BOLT CAST + VFX
  =================================
  Replaces R226's simple reverse-direction rebound with the shared reflected ray
  from r232-lightning-reflection-core.js.
*/


function r232DrawLightningImpact(collision,fade,time){
  if(!collision?.pointWorld) return;

  const point=
    screenPointForWorld(
      collision.pointWorld
    );

  const pulse=
    0.65+
    0.35*Math.sin(
      time*34+
      point.x*0.03+
      point.y*0.02
    );

  ctx.save();
  ctx.globalCompositeOperation="lighter";

  ctx.fillStyle=
    "rgba(238,248,255,"+
    (0.86*fade)+
    ")";

  ctx.beginPath();
  ctx.arc(
    point.x,
    point.y-10,
    3.2+2.2*pulse,
    0,
    Math.PI*2
  );
  ctx.fill();

  ctx.strokeStyle=
    "rgba(185,225,255,"+
    (0.78*fade)+
    ")";

  ctx.lineWidth=1.2;

  const rays=
    collision.type==="tree"
      ? 7
      : 5;

  for(let index=0;index<rays;index++){
    const angle=
      (
        index/rays
      )*Math.PI*2+
      time*0.9;

    const inner=4;
    const outer=
      8+
      5*pulse+
      (index%2)*3;

    ctx.beginPath();
    ctx.moveTo(
      point.x+
      Math.cos(angle)*inner,
      point.y-10+
      Math.sin(angle)*inner
    );
    ctx.lineTo(
      point.x+
      Math.cos(angle)*outer,
      point.y-10+
      Math.sin(angle)*outer
    );
    ctx.stroke();
  }

  /*
    A trunk collision gets a few tiny warm splinter/ember flecks. This remains
    presentation-only; trees are not ignited or destroyed by R232.
  */
  if(collision.type==="tree"){
    ctx.fillStyle=
      "rgba(255,213,137,"+
      (0.70*fade)+
      ")";

    for(let index=0;index<4;index++){
      const angle=
        time*1.7+
        index*Math.PI/2;

      const radius=
        5+
        index*1.8;

      ctx.fillRect(
        Math.round(
          point.x+
          Math.cos(angle)*radius
        ),
        Math.round(
          point.y-10+
          Math.sin(angle)*radius
        ),
        1,
        1
      );
    }
  }

  ctx.restore();
}


function r232DrawLightningTraceFx(fx){
  if(
    !fx?.r232Trace ||
    !Array.isArray(fx.segments) ||
    !fx.segments.length
  ){
    return;
  }

  const elapsed=
    performance.now()-
    fx.started;

  const progress=
    Math.max(
      0,
      Math.min(
        1,
        elapsed/
        Math.max(1,fx.duration)
      )
    );

  const fade=
    Math.sin(
      Math.PI*progress
    );

  const time=
    performance.now()/1000;

  ctx.save();
  ctx.lineCap="round";
  ctx.lineJoin="round";

  for(
    let segmentIndex=0;
    segmentIndex<fx.segments.length;
    segmentIndex++
  ){
    const segment=
      fx.segments[segmentIndex];

    const from=
      screenPointForWorld(
        segment.fromWorld
      );

    const to=
      screenPointForWorld(
        segment.toWorld
      );

    const dx=to.x-from.x;
    const dy=to.y-from.y;
    const length=
      Math.max(
        1,
        Math.hypot(dx,dy)
      );

    const nx=-dy/length;
    const ny=dx/length;

    const points=[];
    const steps=
      Math.max(
        2,
        Math.ceil(length/20)
      );

    for(let index=0;index<=steps;index++){
      const t=index/steps;

      const endpoint=
        index===0 ||
        index===steps;

      const jitter=
        endpoint
          ? 0
          : (
              Math.sin(
                index*12.97+
                segmentIndex*8.31+
                progress*37
              )*3.2+
              Math.sin(
                index*4.11-
                progress*51
              )*1.4
            );

      points.push({
        x:
          from.x+
          dx*t+
          nx*jitter,
        y:
          from.y+
          dy*t+
          ny*jitter-
          10
      });
    }

    const layers=[
      {
        width:8,
        stroke:
          "rgba(100,175,255,"+
          (0.34*fade)+
          ")"
      },
      {
        width:3.5,
        stroke:
          "rgba(205,231,255,"+
          (0.76*fade)+
          ")"
      },
      {
        width:1.25,
        stroke:
          "rgba(255,255,255,"+
          (0.98*fade)+
          ")"
      }
    ];

    ctx.globalCompositeOperation="lighter";

    for(const layer of layers){
      ctx.strokeStyle=layer.stroke;
      ctx.lineWidth=layer.width;
      ctx.beginPath();

      points.forEach((point,index)=>{
        if(index===0){
          ctx.moveTo(point.x,point.y);
        }else{
          ctx.lineTo(point.x,point.y);
        }
      });

      ctx.stroke();
    }
  }

  ctx.restore();

  for(const collision of fx.collisions || []){
    r232DrawLightningImpact(
      collision,
      fade,
      time
    );
  }
}


const r232BaseDrawLineFx=
  r226DrawLineFx;

r226DrawLineFx=function(fx,kind){
  if(
    kind==="lightning" &&
    fx?.r232Trace
  ){
    r232DrawLightningTraceFx(fx);
    return;
  }

  return r232BaseDrawLineFx(
    fx,
    kind
  );
};


/* ============================================================
   LIGHTNING BOLT RESOLUTION
   ============================================================ */

r226CastLightningBolt=async function(
  action,
  targetHex
){
  const caster=
    spellCasterForAction(action);

  const spell=
    getSpellEntry(
      "lightning-bolt"
    );

  const level=
    action.casterLevel ||
    TEST_SPELL_CASTER_LEVEL;

  if(
    !targetHex ||
    (
      targetHex.x===caster.x &&
      targetHex.y===caster.y
    )
  ){
    setCombatMessage(
      "Lightning Bolt requires a direction."
    );
    return false;
  }

  spellCastInProgress=true;

  if(
    !commitSpellCast(
      caster,
      spell,
      action
    )
  ){
    return await finishFailedSpellCommit(
      caster,
      action
    );
  }

  pendingAimAction=null;
  exitAimMode(false,false);

  setUnitActionBanner(
    caster,
    "Casting Lightning Bolt"
  );

  const trace=
    r232TraceLightningBolt(
      caster,
      targetHex,
      {
        rangeHexes:
          R232_LIGHTNING_RANGE_HEXES,
        maxReflections:
          R232_LIGHTNING_MAX_REFLECTIONS
      }
    );

  const damageDice=
    Math.min(
      10,
      Math.max(1,level)
    );

  const rolled=
    rollDiceExpression(
      damageDice+"d6"
    ).total;

  const occurrences=
    r232UnitOccurrencesAlongTrace(
      trace,
      caster
    );

  r226LightningFx={
    r232Trace:true,
    segments:trace.segments,
    collisions:trace.collisions,
    started:performance.now(),
    duration:650
  };

  playMagicEffectSound(
    "lightning"
  );

  const until=
    performance.now()+650;

  while(performance.now()<until){
    draw();
    await sleep(16);
  }

  r226LightningFx=null;
  draw();

  const results=[];

  /*
    Saves and damage resolve after the single continuous flash is presented.
    A creature can be crossed again by a genuinely reflected segment; each
    distinct reflected pass is therefore a separate exposure. A multi-hex
    creature is counted only once per ray segment.
  */
  for(const occurrence of occurrences){
    const unit=occurrence.unit;

    if(
      !unit?.alive ||
      unit.fled
    ){
      continue;
    }

    const save=
      rollSpellSave(
        unit,
        caster
      );

    const immune=
      unitImmuneToDamageType(
        unit,
        "lightning"
      );

    const damage=
      immune
        ? 0
        : (
            save.success
              ? Math.floor(rolled/2)
              : rolled
          );

    results.push({
      ...occurrence,
      save,
      damage,
      immune
    });

    if(damage>0){
      applySpellDamage(
        caster,
        unit,
        damage,
        "Lightning Bolt",
        "lightning"
      );
    }else if(immune){
      setCombatMessage(
        unit.name+
        " is immune to Lightning Bolt.",
        COMBAT_MESSAGE_MIN_HOLD_MS
      );
    }
  }

  const collisionTypes=
    trace.collisions.map(
      collision=>
        collision.type==="tree"
          ? "tree"
          : "solid barrier"
    );

  const uniqueCollisionTypes=
    [...new Set(collisionTypes)];

  let reflectionText="";

  if(trace.reflections>0){
    reflectionText=
      " and ricochets "+
      trace.reflections+
      " time"+
      (
        trace.reflections===1
          ? ""
          : "s"
      );

    if(uniqueCollisionTypes.length){
      reflectionText+=
        " from "+
        uniqueCollisionTypes.join(
          " and "
        );
    }
  }

  setCombatMessage(
    caster.name+
    "'s Lightning Bolt deals "+
    damageDice+
    "d6 = "+
    rolled+
    " before saves"+
    reflectionText+
    ".",
    COMBAT_MESSAGE_MIN_HOLD_MS
  );

  log(
    caster.name+
    " traces Lightning Bolt through "+
    trace.segments.length+
    " ray segment"+
    (
      trace.segments.length===1
        ? ""
        : "s"
    )+
    ", with "+
    trace.reflections+
    " reflection"+
    (
      trace.reflections===1
        ? ""
        : "s"
    )+
    " and "+
    results.length+
    " creature exposure"+
    (
      results.length===1
        ? ""
        : "s"
    )+
    ".",
    "system"
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
   AIM PREVIEW USES THE SAME REFLECTED RAY
   ============================================================ */

const r232BaseAimAreaPreviewForAction=
  aimAreaPreviewForAction;

aimAreaPreviewForAction=function(
  action,
  targetHex
){
  if(
    action?.spellId!=="lightning-bolt"
  ){
    return r232BaseAimAreaPreviewForAction(
      action,
      targetHex
    );
  }

  const caster=
    spellCasterForAction(action) ||
    activeUnit() ||
    game?.player;

  const spell=
    getSpellEntry(
      "lightning-bolt"
    );

  if(
    !caster ||
    !spell ||
    !targetHex
  ){
    return r232BaseAimAreaPreviewForAction(
      action,
      targetHex
    );
  }

  const trace=
    r232TraceLightningBolt(
      caster,
      targetHex
    );

  const friendlyIds=
    new Set(
      r232UnitOccurrencesAlongTrace(
        trace,
        caster
      )
        .filter(
          occurrence=>
            occurrence.unit.faction===
            caster.faction
        )
        .map(
          occurrence=>
            occurrence.unit.id
        )
    );

  return {
    spell,
    cells:trace.cells,
    tone:"damage",
    dangerous:true,
    friendlyFireCount:
      friendlyIds.size,
    lightningTrace:trace
  };
};


if(window.AdventurePartyLevel3Spells){
  window.AdventurePartyLevel3Spells.release=
    "R232";

  window.AdventurePartyLevel3Spells.lightningTrace=
    (caster,targetHex)=>
      r232TraceLightningBolt(
        caster,
        targetHex
      );
}
