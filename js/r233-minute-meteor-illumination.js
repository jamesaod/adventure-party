/*
  R233 — MINUTE METEOR CAMERA + MOVING ILLUMINATION
  ==================================================
  Experimental projectile light:
    radius: 1 tactical hex (10 feet)
    color: dark red
    source follows every meteor during flight

  The light is injected into the existing R195 illumination system, so wall
  shadowing and terrain lighting use the same engine as Light / Continual Light.
*/

let r233MinuteMeteorLights=[];


/* ============================================================
   TRANSIENT ILLUMINATION SOURCES
   ============================================================ */

const r233BaseIlluminationSources=
  illuminationSources;

illuminationSources=function(){
  const sources=
    r233BaseIlluminationSources();

  if(!r233MinuteMeteorLights.length){
    return sources;
  }

  return sources.concat(
    r233MinuteMeteorLights.map(
      (light,index)=>({
        id:
          "minute-meteor-flight:"+
          index,
        sourceKind:"projectile",
        sourceName:"Melf's Minute Meteor",
        x:light.x,
        y:light.y,
        radiusHexes:1,
        intensity:1.05,
        color:[118,8,8]
      })
    )
  );
};


function r233MeteorGeometry(caster,results){
  const total=
    Math.max(
      1,
      results.length
    );

  return results.map((result,index)=>{
    const target=result.target;

    const side=
      (
        index-
        (total-1)/2
      )*0.035;

    const missSide=
      result.hit
        ? 0
        : (
            index%2===0
              ? 0.18
              : -0.18
          );

    return {
      index,
      targetId:
        target?.id || null,
      hit:!!result.hit,
      startAxial:{
        x:caster.x+side,
        y:caster.y-side*0.35
      },
      endAxial:target
        ? {
            x:
              target.x+
              missSide,
            y:
              target.y+
              (
                result.hit
                  ? 0
                  : 0.10
              )
          }
        : {
            x:caster.x,
            y:caster.y
          },
      currentAxial:{
        x:caster.x,
        y:caster.y
      }
    };
  });
}


r227DrawMeteorVolleyFx=function(){
  const fx=r227MeteorVolleyFx;

  if(!fx?.meteors?.length){
    return;
  }

  const elapsed=
    performance.now()-
    fx.started;

  const t=
    Math.max(
      0,
      Math.min(
        1,
        elapsed/
        Math.max(1,fx.duration)
      )
    );

  const eased=
    1-
    Math.pow(
      1-t,
      2.2
    );

  ctx.save();
  ctx.globalCompositeOperation="lighter";
  ctx.lineCap="round";

  for(const meteor of fx.meteors){
    const x=
      meteor.startAxial.x+
      (
        meteor.endAxial.x-
        meteor.startAxial.x
      )*eased;

    const y=
      meteor.startAxial.y+
      (
        meteor.endAxial.y-
        meteor.startAxial.y
      )*eased;

    meteor.currentAxial={
      x,
      y
    };

    const head=
      hexCenter(x,y);

    const arcLift=
      Math.sin(Math.PI*t)*18;

    const priorT=
      Math.max(
        0,
        eased-0.075
      );

    const tx=
      meteor.startAxial.x+
      (
        meteor.endAxial.x-
        meteor.startAxial.x
      )*priorT;

    const ty=
      meteor.startAxial.y+
      (
        meteor.endAxial.y-
        meteor.startAxial.y
      )*priorT;

    const tail=
      hexCenter(tx,ty);

    const tailLift=
      Math.sin(
        Math.PI*
        Math.max(
          0,
          t-0.06
        )
      )*17;

    ctx.strokeStyle=
      "rgba(255,68,18,0.72)";
    ctx.lineWidth=5.2;
    ctx.beginPath();
    ctx.moveTo(
      tail.x,
      tail.y-17-tailLift
    );
    ctx.lineTo(
      head.x,
      head.y-17-arcLift
    );
    ctx.stroke();

    ctx.strokeStyle=
      "rgba(255,192,82,0.90)";
    ctx.lineWidth=2.1;
    ctx.beginPath();
    ctx.moveTo(
      tail.x,
      tail.y-17-tailLift
    );
    ctx.lineTo(
      head.x,
      head.y-17-arcLift
    );
    ctx.stroke();

    ctx.fillStyle=
      "rgba(255,239,198,0.99)";
    ctx.beginPath();
    ctx.arc(
      head.x,
      head.y-17-arcLift,
      2.7,
      0,
      Math.PI*2
    );
    ctx.fill();
  }

  ctx.restore();
};


r227AnimateMeteorVolley=async function(caster,results){
  if(!caster?.alive){
    return;
  }

  await r233FocusCaster(
    caster,
    "melfs-minute-meteors",
    150
  );

  const firstTarget=
    results
      .map(result=>result.target)
      .find(target=>target?.alive) ||
    null;

  if(firstTarget){
    await r233FocusTarget(
      firstTarget,
      100
    );
  }

  r227MeteorVolleyFx={
    casterId:caster.id,
    started:performance.now(),
    duration:420,
    meteors:
      r233MeteorGeometry(
        caster,
        results
      )
  };

  playAttackSound();

  while(true){
    const elapsed=
      performance.now()-
      r227MeteorVolleyFx.started;

    const t=
      Math.max(
        0,
        Math.min(
          1,
          elapsed/
          r227MeteorVolleyFx.duration
        )
      );

    const eased=
      1-
      Math.pow(
        1-t,
        2.2
      );

    r233MinuteMeteorLights=
      r227MeteorVolleyFx.meteors.map(
        meteor=>({
          x:
            meteor.startAxial.x+
            (
              meteor.endAxial.x-
              meteor.startAxial.x
            )*eased,
          y:
            meteor.startAxial.y+
            (
              meteor.endAxial.y-
              meteor.startAxial.y
            )*eased
        })
      );

    draw();

    if(
      elapsed>=
      r227MeteorVolleyFx.duration
    ){
      break;
    }

    await sleep(16);
  }

  r233MinuteMeteorLights=[];
  r227MeteorVolleyFx=null;

  draw();
};


/* ============================================================
   PLAYER-ASSIGNED VOLLEY — INDIVIDUAL OUTCOME PRESENTATION
   ============================================================ */

r227ResolveSelectedMeteorVolley=async function(action,effect){
  const caster=
    spellCasterForAction(action);

  const spell=
    getSpellEntry(
      "melfs-minute-meteors"
    );

  if(!caster?.alive || !effect){
    return false;
  }

  const targetIds=[
    ...(action.meteorTargetIds || [])
  ];

  if(!targetIds.length){
    return false;
  }

  pendingAimAction=null;
  exitAimMode(false,false);

  spellCastInProgress=true;

  setUnitActionBanner(
    caster,
    "Releasing Minute Meteors"
  );

  faceEntityToward(
    caster,
    getUnitById(targetIds[0]) ||
    caster
  );

  triggerUnitAttackPose(caster);

  breakInvisibility(
    caster,
    "releasing Minute Meteors"
  );

  const results=
    r227BuildMeteorAttackResults(
      caster,
      targetIds,
      effect
    );

  for(const result of results){
    if(Number.isFinite(result.raw)){
      playNaturalAttackRollSound(
        result.raw
      );
    }
  }

  setLastRoll(
    "Minute Meteors: "+
    results.map(result=>{
      if(!result.target){
        return "#"+
          (result.index+1)+
          " invalid";
      }

      if(result.resolution?.automatic){
        return "#"+
          (result.index+1)+
          " "+
          result.target.name+
          ": d20 "+
          result.raw+
          " — "+
          result.resolution.automatic;
      }

      return "#"+
        (result.index+1)+
        " "+
        result.target.name+
        ": d20 "+
        result.raw+
        " "+
        formatSignedAdjustment(
          result.modifier
        )+
        " = "+
        result.resolution.modifiedRoll+
        " vs "+
        result.targetNumber;
    }).join("; ")
  );

  await r227AnimateMeteorVolley(
    caster,
    results
  );

  let hits=0;
  let misses=0;
  let imageHits=0;
  let totalDamage=0;

  const deathCandidates=
    new Set();

  for(const result of results){
    const target=result.target;
    const meteorNumber=
      result.index+1;

    if(!target){
      misses++;
      continue;
    }

    if(!result.hit){
      misses++;

      await r233PresentMiss(
        caster,
        target,
        "Minute Meteor "+meteorNumber,
        result.resolution?.automatic ||
        (
          "d20 "+
          result.raw+
          " → "+
          result.resolution.modifiedRoll+
          " vs "+
          result.targetNumber
        )
      );

      continue;
    }

    if(interceptWithMirrorImage(target,caster)){
      imageHits++;
      playMissSound();

      await r233FocusTarget(target);

      setCombatMessage(
        "Minute Meteor "+
        meteorNumber+
        " strikes one of "+
        target.name+
        "'s Mirror Images.",
        R233_RESULT_HOLD_MS,
        R233_RESULT_HOLD_MS
      );

      await waitForCombatActionPause();
      continue;
    }

    hits++;

    const damage=d(4);
    totalDamage+=damage;

    await r233FocusTarget(target);

    /*
      The volley was already physically in flight together. Defer the actual
      death transition until all assigned meteors have resolved so later
      simultaneous meteors do not disappear when an earlier one reduces HP to 0.
    */
    target.hp=
      Math.max(
        0,
        target.hp-damage
      );

    onUnitDamaged(
      target,
      damage
    );

    registerElementalDamageFx(
      target,
      "fire",
      damage
    );

    playMagicMissileHitSound(
      result.index
    );

    setCombatMessage(
      "Minute Meteor "+
      meteorNumber+
      " damages "+
      target.name+
      " for "+
      damage+
      " damage.",
      R233_RESULT_HOLD_MS,
      R233_RESULT_HOLD_MS,
      target.id==="player"
        ? "player-damage"
        : "normal"
    );

    log(
      caster.name+
      "'s Minute Meteor "+
      meteorNumber+
      " hits "+
      target.name+
      " for "+
      damage+
      " damage.",
      "system"
    );

    updateUi();
    draw();

    await waitForCombatActionPause();

    if(target.hp<=0){
      deathCandidates.add(
        target.id
      );
    }
  }

  for(const targetId of deathCandidates){
    const target=
      getUnitById(targetId);

    if(
      !target ||
      !target.alive ||
      target.hp>0
    ){
      continue;
    }

    await r233FocusTarget(target);

    target.alive=false;

    setCombatMessage(
      target.name+
      " goes down and is dying — Melf's Minute Meteors",
      R233_RESULT_HOLD_MS,
      R233_RESULT_HOLD_MS,
      target.id==="player"
        ? "player-damage"
        : "normal"
    );

    playAgonySound(target);
    playDeathSound(target);
    triggerDeathFx(target);

    if(target.controller==="mob"){
      markEnemyNeutralized(target);

      if(
        isKoboldUnit(target) &&
        activeEnemies().length>0
      ){
        scheduleKoboldGroupMoraleCheck({
          casualties:1,
          magicCasualties:1,
          source:"Melf's Minute Meteors"
        });
      }
    }

    updateUi();
    draw();

    await waitForCombatActionPause();
  }

  const spent=targetIds.length;

  effect.data.remaining=
    Math.max(
      0,
      r227MinuteMeteorRemaining(effect)-
      spent
    );

  effect.data.lastVolleyRound=
    game.round;

  effect.data.mode=
    "five-per-round-player-targeted";

  effect.detail=
    effect.data.remaining+
    " meteor"+
    (
      effect.data.remaining===1
        ? ""
        : "s"
    )+
    " remaining; CAST to assign the next volley";

  if(effect.data.remaining<=0){
    removeUnitEffect(
      caster,
      "minute-meteors"
    );
  }

  const remaining=
    Math.max(
      0,
      Number(effect.data?.remaining)||0
    );

  log(
    caster.name+
    " releases "+
    spent+
    " player-assigned Minute Meteor"+
    (spent===1 ? "" : "s")+
    ": "+
    hits+
    " hit, "+
    misses+
    " miss, "+
    imageHits+
    " image hit, "+
    totalDamage+
    " total damage; "+
    remaining+
    " remaining.",
    "system"
  );

  if(
    !game.over &&
    remaining>0
  ){
    setCombatMessage(
      remaining+
      " Minute Meteor"+
      (remaining===1 ? "" : "s")+
      " remain stored.",
      0,
      1100
    );

    draw();
    await sleep(220);
  }

  spellCastInProgress=false;
  updateUi();
  draw();

  if(action.fromInitialCast){
    finishTestSpellCast(
      caster,
      spell.name,
      action.originAction || null
    );

    return true;
  }

  if(!game.over){
    endTurn();
  }

  return true;
};


/* ============================================================
   AUTOMATED / QUICK VOLLEYS USE THE SAME LIGHT + RESULT PACING
   ============================================================ */

r226FireMeteorVolley=async function(
  caster,
  target,
  count,
  spellName="Melf's Minute Meteors"
){
  if(
    !caster?.alive ||
    !target?.alive ||
    count<=0
  ){
    return {
      fired:0,
      hits:0,
      damage:0
    };
  }

  const effect={
    data:{
      casterLevel:
        Number(caster.level) ||
        TEST_SPELL_CASTER_LEVEL
    }
  };

  const targetIds=
    Array.from(
      {length:count},
      ()=>target.id
    );

  const results=
    r227BuildMeteorAttackResults(
      caster,
      targetIds,
      effect
    );

  for(const result of results){
    if(Number.isFinite(result.raw)){
      playNaturalAttackRollSound(
        result.raw
      );
    }
  }

  await r227AnimateMeteorVolley(
    caster,
    results
  );

  let fired=0;
  let hits=0;
  let totalDamage=0;

  for(const result of results){
    if(!result.target){
      continue;
    }

    fired++;

    if(!result.hit){
      await r233PresentMiss(
        caster,
        result.target,
        "Minute Meteor "+(result.index+1)
      );
      continue;
    }

    if(interceptWithMirrorImage(result.target,caster)){
      playMissSound();

      await r233FocusTarget(
        result.target
      );

      setCombatMessage(
        result.target.name+
        "'s Mirror Image absorbs Minute Meteor "+
        (result.index+1)+
        ".",
        R233_RESULT_HOLD_MS,
        R233_RESULT_HOLD_MS
      );

      await waitForCombatActionPause();
      continue;
    }

    hits++;

    const damage=d(4);
    totalDamage+=damage;

    const damageResult=
      await r233ApplySpellDamageBeat(
        caster,
        result.target,
        damage,
        spellName,
        "fire"
      );

    playMagicMissileHitSound(
      result.index
    );

    if(damageResult.killed){
      break;
    }
  }

  return {
    fired,
    hits,
    damage:totalDamage
  };
};


window.AdventurePartyMinuteMeteorLight={
  release:"R233",
  sources:()=>r233MinuteMeteorLights.map(
    source=>({...source})
  ),
  radiusFeet:10,
  color:[118,8,8]
};
