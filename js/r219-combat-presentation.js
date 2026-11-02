/*
  R219 — SPELL FOCUS, VISIBLE AI PACING, STINKING CLOUD TRANSPARENCY
  ==================================================================
  Presentation changes only:
  1) Camera focus follows units as spell effects resolve on them.
  2) Automated movement takes twice as long per visible step while the mover
     is in party LOS. Heard-but-unseen movement keeps its old timing; fully
     unseen movement remains immediate.
  3) Stinking Cloud uses 0.125 global body alpha: 75% less opaque than the
     original 0.50 fog body alpha. Its green footprint outline is unchanged.
*/

function r219FocusSpellAffectedUnit(unit){
  if(
    !game ||
    currentScreen!=="combat" ||
    !unit ||
    !Number.isFinite(unit.x) ||
    !Number.isFinite(unit.y)
  ){
    return false;
  }

  centerCameraOn(unit);
  hoverHex=null;
  draw();
  return true;
}

/*
  Targeted buffs/debuffs that are applied during active spell resolution now
  focus their recipient immediately. This catches spells such as Armor, Light,
  Strength, Invisibility, Ray of Enfeeblement, etc., including self-targeted
  effects without adding special camera code to every spell caster.
*/
const r219BaseAddUnitEffect=addUnitEffect;
addUnitEffect=function(unit,effectSpec){
  const applied=r219BaseAddUnitEffect(unit,effectSpec);

  if(applied && spellCastInProgress){
    r219FocusSpellAffectedUnit(unit);
  }

  return applied;
};

/* Persistent area spells present each unit's save/result while centered. */
const r219BasePresentPersistentAreaSave=presentPersistentAreaSave;
presentPersistentAreaSave=async function(unit,effect,save,saveLabel){
  r219FocusSpellAffectedUnit(unit);
  return await r219BasePresentPersistentAreaSave(
    unit,
    effect,
    save,
    saveLabel
  );
};

const r219BasePresentPersistentAreaFailure=presentPersistentAreaFailure;
presentPersistentAreaFailure=async function(unit,message){
  r219FocusSpellAffectedUnit(unit);
  return await r219BasePresentPersistentAreaFailure(
    unit,
    message
  );
};

/* Direct spell damage belongs visually to the victim, including later DoT. */
const r219BaseApplySpellDamage=applySpellDamage;
applySpellDamage=function(source,target,damage,sourceName,damageType="magic"){
  r219FocusSpellAffectedUnit(target);
  return r219BaseApplySpellDamage(
    source,
    target,
    damage,
    sourceName,
    damageType
  );
};

/* Sequential area-damage result cards also center their current victim. */
const r219BaseShowAreaEffectUnitResolution=showAreaEffectUnitResolution;
showAreaEffectUnitResolution=async function(options={}){
  r219FocusSpellAffectedUnit(options.unit);
  return await r219BaseShowAreaEffectUnitResolution(options);
};

/*
  Shared magical application VFX:
  retain the existing staggered effect timing, but as each target's effect
  actually begins, center the battlefield on that target before drawing that
  frame. A modest 140 ms minimum stagger makes multi-target camera handoff
  readable without turning area spells into a long serial animation.
*/
animateMagicEffectOnUnits=async function(units,kind="generic",options={}){
  const targets=(units || []).filter(unit=>unit?.alive && !unit.fled);
  if(!targets.length) return;

  const staggerMs=Math.min(
    240,
    Math.max(140,720/Math.max(1,targets.length))
  );
  const effectDuration=680;
  const started=performance.now();

  magicEffectFx=targets.map((unit,index)=>({
    unitId:unit.id,
    kind,
    started:started+index*staggerMs,
    duration:effectDuration,
    soundPlayed:false,
    cameraFocused:false
  }));

  const totalDuration=
    effectDuration+
    (targets.length-1)*staggerMs;

  while(true){
    const now=performance.now();

    magicEffectFx.forEach((fx,index)=>{
      if(now<fx.started) return;

      const unit=getUnitById(fx.unitId);

      if(!fx.cameraFocused){
        fx.cameraFocused=true;
        if(unit){
          r219FocusSpellAffectedUnit(unit);
        }
      }

      if(!fx.soundPlayed){
        fx.soundPlayed=true;
        if(options.playSound!==false){
          playMagicEffectSound(fx.kind,index);
        }
      }
    });

    draw();

    if(now-started>=totalDuration){
      break;
    }

    await sleep(16);
  }

  magicEffectFx=[];
  draw();
};


/* ============================================================
   R219 — VISIBLE AUTOMATED MOVEMENT AT HALF SPEED
   ============================================================ */

function r219AutomatedStepDelay(mode,baseDelay){
  const delay=Math.max(0,Number(baseDelay)||0);

  /*
    "visible" means the movement destination is currently inside party LOS.
    "heard" means a Listen check detected off-LOS movement and keeps the old
    timing. "silent" movement remains immediate and does not leak information.
  */
  return mode==="visible"
    ? delay*2
    : delay;
}

animateEntitySteps=async function(entity,steps,stepProvider,delay=145){
  const senseContext=createHiddenMobMovementSenseContext();

  for(let i=0;i<steps;i++){
    if(
      game.over ||
      !entity.alive ||
      entity.fled
    ){
      return false;
    }

    const next=stepProvider();

    if(!next){
      return false;
    }

    if(next.escape){
      const canLeave=await performLeavingHexFreeAttacks(
        entity,
        next
      );

      if(!canLeave){
        return false;
      }

      const mode=mobMovementPresentationMode(
        entity,
        {x:entity.x,y:entity.y},
        senseContext
      );

      updateFacingForStep(
        entity,
        next.x-entity.x,
        next.y-entity.y
      );

      if(mode!=="silent"){
        setUnitActionBanner(entity,"Escaping");
      }

      if(mode==="heard"){
        centerCameraOn(entity);
        senseContext.centered=true;
        showActivityDetectedFx(
          entity,
          Math.max(280,delay+120)
        );
        refreshTurnBanner();
      }

      /*
        Give a visible automated unit the same doubled movement beat before it
        leaves the battlefield completely.
      */
      if(mode==="visible"){
        draw();
        await sleep(r219AutomatedStepDelay(mode,delay));
      }

      entity.fled=true;

      if(entity.fleeing){
        setMoraleFleeing(entity,false);
      }

      entity.guard=false;
      entity.guardBaselineAdjacentIds=[];

      if(entity.controller==="mob"){
        markEnemyNeutralized(entity);
      }

      if(mode!=="silent"){
        playMoveSound();
        log(
          `${entity.name} moves past the battlefield edge and escapes combat.`,
          "good"
        );
        updateUi();
        draw();
      }

      if(entity.faction==="player"){
        checkPartyDefeat();
      }else{
        checkCombatVictory();
      }

      return true;
    }

    if(unitTransitionBlocked(entity,entity,next)){
      return false;
    }

    const canLeave=await performLeavingHexFreeAttacks(
      entity,
      next
    );

    if(!canLeave){
      return false;
    }

    const mode=
      mobMovementPresentationMode(entity,next,senseContext);

    updateFacingForStep(
      entity,
      next.x-entity.x,
      next.y-entity.y
    );

    if(mode!=="silent"){
      setUnitActionBanner(
        entity,
        entity.fleeing || getUnitEffect(entity,"spook")
          ? "Fleeing"
          : "Moving"
      );
    }

    entity.x=next.x;
    entity.y=next.y;

    if(mode==="visible"){
      clearActivityDetectedFxForUnit(entity);

      if(senseContext.wasHidden){
        centerCameraOn(entity);
        senseContext.centered=true;
      }else{
        maybeRecenterCamera(entity);
      }

      playMoveSound();
      draw();
    }else if(mode==="heard"){
      if(!senseContext.centered){
        centerCameraOn(entity);
        senseContext.centered=true;
      }else{
        maybeRecenterCamera(entity);
      }

      showActivityDetectedFx(
        entity,
        Math.max(280,delay+120)
      );
      refreshTurnBanner();
      playMoveSound();
      draw();
    }

    const areaResult=
      await resolvePersistentAreaMovementStep(entity);

    if(areaResult.haltMovement){
      return false;
    }

    if(
      entity.controller==="mob" &&
      maybeTriggerPlayerGuard(entity)
    ){
      await sleep(
        Math.max(240,combatActionPauseRemaining())
      );

      if(game.over || !entity.alive){
        return false;
      }
    }

    if(entity.controller==="mob"){
      await triggerMobGuardsAgainst(entity);

      if(game.over || !entity.alive){
        return false;
      }
    }

    if(mode!=="silent"){
      await sleep(
        r219AutomatedStepDelay(mode,delay)
      );
    }
  }

  return true;
};

animateMobAlongPath=async function(mob,path,maxSteps){
  const steps=
    Math.min(maxSteps,Math.max(0,path.length-1));

  const senseContext=createHiddenMobMovementSenseContext();

  for(let i=1;i<=steps;i++){
    if(game.over || !mob.alive || mob.fled){
      return false;
    }

    if(unitTransitionBlocked(mob,mob,path[i])){
      return false;
    }

    const canLeave=await performLeavingHexFreeAttacks(
      mob,
      path[i]
    );

    if(!canLeave){
      return false;
    }

    const mode=
      mobMovementPresentationMode(
        mob,
        path[i],
        senseContext
      );

    updateFacingForStep(
      mob,
      path[i].x-mob.x,
      path[i].y-mob.y
    );

    if(mode!=="silent"){
      setUnitActionBanner(mob,"Moving");
    }

    mob.x=path[i].x;
    mob.y=path[i].y;

    if(mode==="visible"){
      clearActivityDetectedFxForUnit(mob);

      if(senseContext.wasHidden){
        centerCameraOn(mob);
        senseContext.centered=true;
      }else{
        maybeRecenterCamera(mob);
      }

      playMoveSound();
      draw();
    }else if(mode==="heard"){
      if(!senseContext.centered){
        centerCameraOn(mob);
        senseContext.centered=true;
      }else{
        maybeRecenterCamera(mob);
      }

      showActivityDetectedFx(mob,400);
      refreshTurnBanner();
      playMoveSound();
      draw();
    }

    const areaResult=
      await resolvePersistentAreaMovementStep(mob);

    if(areaResult.haltMovement){
      return false;
    }

    if(maybeTriggerPlayerGuard(mob)){
      await sleep(
        Math.max(240,combatActionPauseRemaining())
      );

      if(game.over || !mob.alive){
        return false;
      }
    }

    await triggerMobGuardsAgainst(mob);

    if(game.over || !mob.alive){
      return false;
    }

    if(mode!=="silent"){
      await sleep(
        r219AutomatedStepDelay(mode,105)
      );
    }
  }

  return true;
};


/* ============================================================
   R219 — STINKING CLOUD AT 75% LOWER OPACITY
   ============================================================ */

drawFogVolumeCell=function(cell,effect=null){
  if(
    !cell ||
    !inside(cell.x,cell.y) ||
    !isHexOnBattlefieldScreen(cell.x,cell.y,HEX_W)
  ){
    return;
  }

  const c=hexCenter(cell.x,cell.y);
  const height=HEX_W;
  const top=hexScreenVertices(cell.x,cell.y);
  const time=performance.now();
  const seedBase=
    (Math.abs(cell.x*73856093 ^ cell.y*19349663)>>>0);
  const isStinkingCloud=
    effect?.spellKind==="stinking-cloud";

  ctx.save();

  /*
    Original fog body alpha was 0.50.
    75% less opaque => retain 25% of that opacity:
      0.50 * 0.25 = 0.125.

    Normal Wall of Fog / Fog Cloud remains 0.50.
  */
  ctx.globalAlpha=
    isStinkingCloud
      ? 0.125
      : 0.5;

  polygonPath(top);

  ctx.fillStyle=isStinkingCloud
    ? "rgba(72,112,42,0.88)"
    : "rgba(207,216,218,0.84)";
  ctx.fill();

  const drift=
    Math.sin(
      (time*0.0017)+
      (cell.x*0.61)+
      (cell.y*0.43)
    )*3.0;

  const grad=
    ctx.createLinearGradient(
      c.x,
      c.y-height-4,
      c.x,
      c.y+7
    );

  if(isStinkingCloud){
    grad.addColorStop(
      0,
      "rgba(174,199,74,0.68)"
    );
    grad.addColorStop(
      0.42,
      "rgba(102,151,54,0.84)"
    );
    grad.addColorStop(
      0.72,
      "rgba(63,116,43,0.88)"
    );
    grad.addColorStop(
      1,
      "rgba(37,82,42,0.92)"
    );
  }else{
    grad.addColorStop(
      0,
      "rgba(236,241,242,0.60)"
    );
    grad.addColorStop(
      0.45,
      "rgba(214,223,225,0.82)"
    );
    grad.addColorStop(
      1,
      "rgba(188,199,201,0.88)"
    );
  }

  ctx.fillStyle=grad;
  ctx.fillRect(
    c.x-HEX_W*0.48+drift*0.18,
    c.y-height-2,
    HEX_W*0.96,
    height+10
  );

  const stinkingPuffColors=[
    [188,205,77],
    [126,170,58],
    [82,139,48],
    [48,101,45]
  ];

  for(let i=0;i<8;i++){
    const a=
      ((seedBase+i*2654435761)>>>0);

    const fx=((a & 1023)/1023)-0.5;
    const fy=(((a>>>10)&1023)/1023);
    const rx=16+((a>>>20)&7);
    const ry=9+((a>>>23)&7);
    const phase=(a & 255)*0.023;
    const sway=
      Math.sin(time*0.0021+phase)*4.0;
    const lift=
      Math.cos(time*0.0018+phase*1.7)*2.3;
    const px=
      c.x+fx*HEX_W*0.70+sway;
    const py=
      c.y-8-fy*(height-12)+lift;
    const alphaPulse=
      0.73+
      0.17*Math.sin(
        time*0.0024+phase*2.1
      );

    ctx.beginPath();
    ctx.ellipse(
      px,
      py,
      rx,
      ry,
      0,
      0,
      Math.PI*2
    );

    if(isStinkingCloud){
      const puff=
        stinkingPuffColors[
          (seedBase+i)%
          stinkingPuffColors.length
        ];

      ctx.fillStyle=
        `rgba(${puff[0]},${puff[1]},${puff[2]},${0.80*alphaPulse})`;
    }else{
      ctx.fillStyle=
        i%2
          ? `rgba(225,232,233,${0.74*alphaPulse})`
          : `rgba(197,207,209,${0.78*alphaPulse})`;
    }

    ctx.fill();
  }

  const capBob=
    Math.sin(
      time*0.0022+
      seedBase*0.000002
    )*3;

  ctx.beginPath();
  ctx.ellipse(
    c.x+drift*0.14,
    c.y-height+5+capBob*0.28,
    HEX_W*0.42,
    12,
    0,
    0,
    Math.PI*2
  );

  ctx.fillStyle=isStinkingCloud
    ? "rgba(202,216,94,0.72)"
    : "rgba(242,246,247,0.68)";
  ctx.fill();

  ctx.strokeStyle=isStinkingCloud
    ? "rgba(156,190,73,0.58)"
    : "rgba(236,242,243,0.52)";
  ctx.lineWidth=1.2;

  ctx.beginPath();
  ctx.moveTo(
    c.x-HEX_W*0.42+drift*0.12,
    c.y-height+8
  );
  ctx.lineTo(
    c.x-HEX_W*0.42+drift*0.12,
    c.y-2
  );
  ctx.moveTo(
    c.x+HEX_W*0.42+drift*0.12,
    c.y-height+8
  );
  ctx.lineTo(
    c.x+HEX_W*0.42+drift*0.12,
    c.y-2
  );
  ctx.stroke();

  ctx.restore();
};
