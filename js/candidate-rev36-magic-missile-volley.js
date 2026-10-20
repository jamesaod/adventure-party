/*
  Candidate Rev 36 — Magic Missile multi-target volley
  ====================================================
  One production implementation for battlefield combat and Spell Previewer.

  Player targeting mirrors Melf's Minute Meteors:
  - assign one target per missile;
  - the same target may be selected repeatedly;
  - after all missiles are assigned, the entire volley launches at once.

  Presentation:
  - blue-white magical darts;
  - moving blue illumination and blue particle trails;
  - missiles assigned to the same target fan into separate curved lanes and
    reconverge on the target;
  - all missiles launch and arrive on the same animation beat.
*/

(()=>{
  "use strict";

  let r36VolleyFx=null;
  let r36ImpactFx=[];
  let r36ImpactFrame=null;

  function r36MissileCount(action){
    return magicMissileCountForCasterLevel(
      Math.max(
        1,
        Number(action?.casterLevel) ||
        TEST_SPELL_CASTER_LEVEL
      )
    );
  }

  function r36TargetSummary(targetIds){
    const counts=new Map();

    for(const id of targetIds || []){
      const unit=getUnitById(id);
      const label=unit?.name || id || "Unknown";

      counts.set(
        label,
        (counts.get(label)||0)+1
      );
    }

    return [...counts.entries()]
      .map(([label,count])=>
        count>1
          ? label+" ×"+count
          : label
      )
      .join(", ");
  }

  function r36ValidTarget(caster,action,target){
    if(
      !caster?.alive ||
      !target?.alive ||
      target.fled ||
      target.faction===caster.faction
    ){
      setCombatMessage(
        "Magic Missile requires a living hostile creature target."
      );
      return false;
    }

    const rangeHexes=
      yardsToTacticalHexes(
        magicMissileRangeYards(
          Math.max(
            1,
            Number(action?.casterLevel) ||
            TEST_SPELL_CASTER_LEVEL
          )
        )
      );

    if(unitDistance(caster,target)>rangeHexes){
      setCombatMessage(
        target.name+
        " is out of Magic Missile range ("+
        rangeHexes+
        " hexes)."
      );
      return false;
    }

    if(lineOfSightBlocked(caster,target)){
      setCombatMessage(
        "Line of sight is blocked to "+
        target.name+
        "."
      );
      return false;
    }

    if(
      typeof unitVisibleToObserver==="function" &&
      !unitVisibleToObserver(caster,target)
    ){
      setCombatMessage(
        target.name+
        " is not currently visible to "+
        caster.name+
        "."
      );
      return false;
    }

    return true;
  }

  async function r36SelectTarget(action,target){
    const caster=
      spellCasterForAction(action);

    if(!r36ValidTarget(caster,action,target)){
      return false;
    }

    const live=
      pendingAimAction?.spellId==="magic-missile"
        ? pendingAimAction
        : action;

    if(!Array.isArray(live.magicMissileTargetIds)){
      live.magicMissileTargetIds=[];
    }

    const count=r36MissileCount(live);

    live.magicMissileTargetIds.push(target.id);
    live.magicMissileVolley=true;
    live.magicMissileCount=count;

    const selected=
      live.magicMissileTargetIds.length;

    pendingAimAction=live;

    if(selected<count){
      setUnitActionBanner(
        caster,
        "Assigning Magic Missiles"
      );

      setCombatMessage(
        "Magic Missile "+
        selected+
        "/"+
        count+
        ": "+
        r36TargetSummary(
          live.magicMissileTargetIds
        )+
        ". Select target "+
        (selected+1)+
        " of "+
        count+
        ". Repeat a target to stack missiles."
      );

      updateUi();
      draw();
      return true;
    }

    const completed={
      ...live,
      magicMissileTargetIds:
        [...live.magicMissileTargetIds]
    };

    return await castPreparedCombatSpell(
      completed,
      {x:target.x,y:target.y},
      target
    );
  }

  const r36BaseActivateAimTarget=
    activateAimTarget;

  activateAimTarget=async function(){
    if(
      pendingAimAction?.spellId===
        "magic-missile"
    ){
      const target=
        unitAtHex(
          aimCursor.x,
          aimCursor.y
        );

      return await r36SelectTarget(
        pendingAimAction,
        target
      );
    }

    return await r36BaseActivateAimTarget();
  };


  /* Completion-time prompt: tell the player that each click assigns one dart. */
  if(
    typeof r231CompletionTargetPrompt===
    "function"
  ){
    const r36BaseCompletionTargetPrompt=
      r231CompletionTargetPrompt;

    r231CompletionTargetPrompt=function(
      spell,
      caster
    ){
      if(spell?.id==="magic-missile"){
        const count=
          magicMissileCountForCasterLevel(
            Math.max(
              1,
              Number(caster?.level) ||
              TEST_SPELL_CASTER_LEVEL
            )
          );

        return (
          "Magic Missile is ready: assign missile 1 of "+
          count+
          ". Repeat a target to stack missiles; all missiles launch together."
        );
      }

      return r36BaseCompletionTargetPrompt(
        spell,
        caster
      );
    };
  }


  function r36LaneFor(index,count){
    if(count<=1){
      return 0;
    }

    let lane=
      index-
      (count-1)/2;

    /*
      Odd-numbered groups would otherwise put one missile directly on the
      center line. Give that missile a small curve so every stacked missile
      visibly separates before reconverging.
    */
    if(Math.abs(lane)<0.001){
      lane=0.34;
    }

    return lane;
  }

  function r36QuadraticPoint(
    start,
    control,
    end,
    t
  ){
    const u=1-t;

    return {
      x:
        u*u*start.x+
        2*u*t*control.x+
        t*t*end.x,
      y:
        u*u*start.y+
        2*u*t*control.y+
        t*t*end.y
    };
  }

  function r36QuadraticTangent(
    start,
    control,
    end,
    t
  ){
    return {
      x:
        2*(1-t)*(control.x-start.x)+
        2*t*(end.x-control.x),
      y:
        2*(1-t)*(control.y-start.y)+
        2*t*(end.y-control.y)
    };
  }

  function r36BuildFlight(
    caster,
    targetIds
  ){
    const casterCenter=
      unitFootprintScreenCenter(caster);

    const grouped=new Map();

    targetIds.forEach((id,index)=>{
      if(!grouped.has(id)){
        grouped.set(id,[]);
      }

      grouped.get(id).push(index);
    });

    const missiles=[];
    let maxDistance=0;

    for(
      let globalIndex=0;
      globalIndex<targetIds.length;
      globalIndex++
    ){
      const targetId=targetIds[globalIndex];
      const target=getUnitById(targetId);
      if(!target) continue;

      const targetCenter=
        unitFootprintScreenCenter(target);

      const siblings=
        grouped.get(targetId) || [globalIndex];

      const groupIndex=
        siblings.indexOf(globalIndex);

      const groupCount=
        siblings.length;

      const lane=
        r36LaneFor(
          groupIndex,
          groupCount
        );

      const start={
        x:casterCenter.x,
        y:casterCenter.y-20
      };

      /*
        Every missile in a stacked group ends at the exact same point. Their
        unique control points create the visible split-and-reconverge shape.
      */
      const end={
        x:targetCenter.x,
        y:targetCenter.y-15
      };

      const dx=end.x-start.x;
      const dy=end.y-start.y;
      const length=
        Math.max(
          1,
          Math.hypot(dx,dy)
        );

      maxDistance=
        Math.max(
          maxDistance,
          length
        );

      const nx=-dy/length;
      const ny=dx/length;

      const curveBase=
        groupCount>1
          ? Math.min(
              78,
              26+length*0.12
            )
          : Math.min(
              16,
              5+length*0.025
            );

      const singleBias=
        groupCount===1
          ? (
              globalIndex%2===0
                ? -0.18
                : 0.18
            )
          : lane;

      const control={
        x:
          (start.x+end.x)/2+
          nx*curveBase*singleBias,
        y:
          (start.y+end.y)/2+
          ny*curveBase*singleBias-
          Math.min(
            18,
            length*0.045
          )
      };

      missiles.push({
        index:globalIndex,
        targetId,
        groupIndex,
        groupCount,
        start,
        control,
        end
      });
    }

    return {
      missiles,
      duration:
        Math.max(
          230,
          Math.min(
            430,
            175+maxDistance*0.32
          )
        )
    };
  }

  function r36DrawBlueDart(
    missile,
    t
  ){
    const head=
      r36QuadraticPoint(
        missile.start,
        missile.control,
        missile.end,
        t
      );

    const trailT=
      Math.max(
        0,
        t-0.115
      );

    const tail=
      r36QuadraticPoint(
        missile.start,
        missile.control,
        missile.end,
        trailT
      );

    const tangent=
      r36QuadraticTangent(
        missile.start,
        missile.control,
        missile.end,
        t
      );

    const angle=
      Math.atan2(
        tangent.y,
        tangent.x
      );

    ctx.save();
    ctx.globalCompositeOperation="lighter";

    /*
      Match Fire Arrow / Acid Arrow presentation language, but in cool blue.
      This is a moving screen-space light field centered on the missile head.
    */
    const lightRadius=
      HEX_W*1.25;

    const light=
      ctx.createRadialGradient(
        head.x,
        head.y,
        0,
        head.x,
        head.y,
        lightRadius
      );

    light.addColorStop(
      0,
      "rgba(221,244,255,0.44)"
    );
    light.addColorStop(
      0.22,
      "rgba(99,185,255,0.34)"
    );
    light.addColorStop(
      0.58,
      "rgba(38,101,226,0.18)"
    );
    light.addColorStop(
      1,
      "rgba(13,43,128,0)"
    );

    ctx.fillStyle=light;
    ctx.beginPath();
    ctx.arc(
      head.x,
      head.y,
      lightRadius,
      0,
      Math.PI*2
    );
    ctx.fill();

    const trail=
      ctx.createLinearGradient(
        tail.x,
        tail.y,
        head.x,
        head.y
      );

    trail.addColorStop(
      0,
      "rgba(22,59,165,0)"
    );
    trail.addColorStop(
      0.45,
      "rgba(63,148,255,0.42)"
    );
    trail.addColorStop(
      1,
      "rgba(199,235,255,0.88)"
    );

    ctx.strokeStyle=trail;
    ctx.lineWidth=5;
    ctx.lineCap="round";
    ctx.beginPath();
    ctx.moveTo(tail.x,tail.y);
    ctx.quadraticCurveTo(
      missile.control.x,
      missile.control.y,
      head.x,
      head.y
    );
    ctx.stroke();

    /*
      Pixel motes follow each missile so the effect remains legible at the
      retro render scale.
    */
    const now=performance.now();

    for(let i=0;i<10;i++){
      const q=(i+1)/11;
      const back=
        7+
        q*31;

      const wave=
        Math.sin(
          now*0.012+
          i*1.73+
          missile.index*0.91
        )*
        (1.5+q*3.0);

      const length=
        Math.max(
          1,
          Math.hypot(
            tangent.x,
            tangent.y
          )
        );

      const ux=tangent.x/length;
      const uy=tangent.y/length;
      const nx=-uy;
      const ny=ux;

      const px=
        head.x-
        ux*back+
        nx*wave;

      const py=
        head.y-
        uy*back+
        ny*wave;

      const alpha=
        (1-q)*
        0.72;

      ctx.fillStyle=
        i%3===0
          ? "rgba(220,245,255,"+alpha+")"
          : i%3===1
            ? "rgba(91,179,255,"+alpha+")"
            : "rgba(45,103,232,"+alpha+")";

      const size=
        i%4===0
          ? 2
          : 1;

      ctx.fillRect(
        Math.round(px),
        Math.round(py),
        size,
        size
      );
    }

    /*
      Magical dart head: same narrow projectile read as the elemental arrows,
      but no physical shaft/wood. Everything is blue-white energy.
    */
    ctx.save();
    ctx.translate(
      head.x,
      head.y
    );
    ctx.rotate(angle);

    const aura=
      ctx.createRadialGradient(
        0,0,0,
        0,0,15
      );

    aura.addColorStop(
      0,
      "rgba(245,253,255,0.95)"
    );
    aura.addColorStop(
      0.32,
      "rgba(109,194,255,0.65)"
    );
    aura.addColorStop(
      1,
      "rgba(37,83,222,0)"
    );

    ctx.fillStyle=aura;
    ctx.beginPath();
    ctx.arc(
      0,0,15,
      0,Math.PI*2
    );
    ctx.fill();

    ctx.strokeStyle="#dff5ff";
    ctx.lineWidth=2.4;
    ctx.beginPath();
    ctx.moveTo(-10,0);
    ctx.lineTo(8,0);
    ctx.stroke();

    ctx.fillStyle="#bfe9ff";
    ctx.beginPath();
    ctx.moveTo(11,0);
    ctx.lineTo(4,-3.5);
    ctx.lineTo(4,3.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle="#ffffff";
    ctx.fillRect(-1,-1,4,2);

    ctx.restore();
    ctx.restore();
  }

  function r36DrawImpactFx(){
    if(!r36ImpactFx.length){
      return;
    }

    const now=performance.now();

    r36ImpactFx=
      r36ImpactFx.filter(
        fx=>now<fx.until
      );

    for(const fx of r36ImpactFx){
      const target=
        getUnitById(fx.targetId);

      if(!target){
        continue;
      }

      const center=
        unitFootprintScreenCenter(target);

      const t=
        Math.max(
          0,
          Math.min(
            1,
            (now-fx.started)/
            Math.max(
              1,
              fx.duration
            )
          )
        );

      const fade=1-t;
      const radius=
        7+
        18*t+
        Math.min(
          12,
          (fx.count-1)*3
        );

      ctx.save();
      ctx.globalCompositeOperation="lighter";

      const glow=
        ctx.createRadialGradient(
          center.x,
          center.y-15,
          0,
          center.x,
          center.y-15,
          radius*1.7
        );

      glow.addColorStop(
        0,
        "rgba(247,253,255,"+
        (0.72*fade)+
        ")"
      );
      glow.addColorStop(
        0.35,
        "rgba(92,184,255,"+
        (0.46*fade)+
        ")"
      );
      glow.addColorStop(
        1,
        "rgba(34,78,210,0)"
      );

      ctx.fillStyle=glow;
      ctx.beginPath();
      ctx.arc(
        center.x,
        center.y-15,
        radius*1.7,
        0,
        Math.PI*2
      );
      ctx.fill();

      ctx.strokeStyle=
        "rgba(184,230,255,"+
        (0.82*fade)+
        ")";
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.arc(
        center.x,
        center.y-15,
        radius,
        0,
        Math.PI*2
      );
      ctx.stroke();

      ctx.restore();
    }
  }

  function r36DrawVolleyFx(){
    if(r36VolleyFx){
      const elapsed=
        performance.now()-
        r36VolleyFx.started;

      const t=
        Math.max(
          0,
          Math.min(
            1,
            elapsed/
            Math.max(
              1,
              r36VolleyFx.duration
            )
          )
        );

      for(
        const missile of
        r36VolleyFx.missiles
      ){
        r36DrawBlueDart(
          missile,
          t
        );
      }
    }

    r36DrawImpactFx();
  }

  const r36BaseDrawProjectileFx=
    drawProjectileFx;

  drawProjectileFx=function(){
    r36BaseDrawProjectileFx();

    if(
      typeof spellPreviewVisualsSuppressed===
        "function" &&
      spellPreviewVisualsSuppressed()
    ){
      return;
    }

    r36DrawVolleyFx();
  };

  function r36EnsureImpactLoop(){
    if(
      r36ImpactFrame!==null ||
      !r36ImpactFx.length
    ){
      return;
    }

    const tick=()=>{
      r36ImpactFrame=null;

      if(
        !r36ImpactFx.length ||
        !game ||
        game.over ||
        ![
          "combat",
          "spell-preview"
        ].includes(currentScreen)
      ){
        r36ImpactFx=[];
        return;
      }

      draw();

      if(r36ImpactFx.length){
        r36ImpactFrame=
          requestAnimationFrame(tick);
      }
    };

    r36ImpactFrame=
      requestAnimationFrame(tick);
  }

  function r36StartImpactFx(targetIds){
    const counts=new Map();

    for(const id of targetIds || []){
      counts.set(
        id,
        (counts.get(id)||0)+1
      );
    }

    const now=performance.now();

    r36ImpactFx=
      [...counts.entries()]
        .map(([targetId,count])=>({
          targetId,
          count,
          started:now,
          duration:280,
          until:now+280
        }));

    r36EnsureImpactLoop();
    draw();
  }

  async function r36AnimateVolley(
    caster,
    targetIds
  ){
    const flight=
      r36BuildFlight(
        caster,
        targetIds
      );

    if(!flight.missiles.length){
      return false;
    }

    r36VolleyFx={
      missiles:flight.missiles,
      duration:flight.duration,
      started:performance.now()
    };

    playAttackSound();

    while(true){
      const elapsed=
        performance.now()-
        r36VolleyFx.started;

      draw();

      if(elapsed>=r36VolleyFx.duration){
        break;
      }

      await sleep(16);
    }

    r36VolleyFx=null;
    r36StartImpactFx(targetIds);
    draw();
    return true;
  }


  /*
    Production resolver override.
    Player allocations arrive in action.magicMissileTargetIds. Automated casts
    and callers that provide only one target stack all missiles on that target.
  */
  castMagicMissileFromScroll=
  async function(action,target){
    const caster=
      spellCasterForAction(action);

    const spell=
      getSpellEntry(
        action?.spellId
      );

    if(!caster || !spell){
      return false;
    }

    const missileCount=
      r36MissileCount(action);

    let targetIds=
      Array.isArray(
        action?.magicMissileTargetIds
      )
        ? action.magicMissileTargetIds
            .slice(
              0,
              missileCount
            )
        : [];

    if(
      targetIds.length<
      missileCount
    ){
      if(
        !r36ValidTarget(
          caster,
          action,
          target
        )
      ){
        return false;
      }

      targetIds=
        Array(
          missileCount
        ).fill(target.id);
    }

    const targets=
      targetIds.map(
        id=>getUnitById(id)
      );

    if(
      targets.some(
        unit=>
          !r36ValidTarget(
            caster,
            action,
            unit
          )
      )
    ){
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
    updateUi();

    const firstTarget=
      targets[0] || caster;

    faceEntityToward(
      caster,
      firstTarget
    );

    setUnitActionBanner(
      caster,
      "Casting Magic Missile"
    );

    await r36AnimateVolley(
      caster,
      targetIds
    );

    /*
      Resolve every missile after the shared flight. All missile impact sounds
      are scheduled in this same synchronous beat.
    */
    const damageByTarget=new Map();
    const rollsByTarget=new Map();
    let shielded=0;
    let imageHits=0;
    let actualHits=0;

    for(
      let index=0;
      index<targetIds.length;
      index++
    ){
      const targetId=
        targetIds[index];

      const target=
        getUnitById(targetId);

      if(!target){
        continue;
      }

      if(
        getUnitEffect(
          target,
          "shield"
        )
      ){
        shielded++;
        continue;
      }

      if(
        interceptWithMirrorImage(
          target,
          caster
        )
      ){
        imageHits++;
        continue;
      }

      const damage=
        rollDiceExpression(
          spell.missileDamage
        ).total;

      actualHits++;

      playMagicMissileHitSound(index);

      damageByTarget.set(
        targetId,
        (damageByTarget.get(targetId)||0)+
        damage
      );

      if(!rollsByTarget.has(targetId)){
        rollsByTarget.set(
          targetId,
          []
        );
      }

      rollsByTarget.get(targetId)
        .push(damage);
    }

    /*
      Apply each target's combined missile damage in one synchronous batch.
      This gives one readable floating damage number per creature while all
      target HP changes still happen together.
    */
    const killedTargets=[];

    for(
      const [targetId,damage] of
      damageByTarget.entries()
    ){
      const target=
        getUnitById(targetId);

      if(
        !target?.alive ||
        damage<=0
      ){
        continue;
      }

      target.hp=
        Math.max(
          0,
          target.hp-damage
        );

      onUnitDamaged(
        target,
        damage
      );

      if(target.hp<=0){
        killedTargets.push(target);
      }
    }

    if(action.itemName){
      removeOneInventoryItem(
        caster,
        action.itemName
      );
    }

    updateUi();
    draw();

    const totalDamage=
      [...damageByTarget.values()]
        .reduce(
          (sum,value)=>sum+value,
          0
        );

    const affectedSummary=
      r36TargetSummary(targetIds);

    setCombatMessage(
      "Magic Missile volley: "+
      affectedSummary+
      "; "+
      totalDamage+
      " total damage"+
      (
        shielded
          ? "; "+shielded+
            " shield-negated"
          : ""
      )+
      (
        imageHits
          ? "; "+imageHits+
            " Mirror Image hit"+
            (imageHits===1 ? "" : "s")
          : ""
      )+
      ".",
      COMBAT_MESSAGE_MIN_HOLD_MS
    );

    log(
      caster.name+
      " releases "+
      missileCount+
      " simultaneous Magic Missile"+
      (missileCount===1 ? "" : "s")+
      " at "+
      affectedSummary+
      ": "+
      actualHits+
      " creature hit"+
      (actualHits===1 ? "" : "s")+
      ", "+
      imageHits+
      " image hit"+
      (imageHits===1 ? "" : "s")+
      ", "+
      shielded+
      " shield-negated; "+
      totalDamage+
      " total damage.",
      "good"
    );

    let koboldCasualties=0;

    for(const unit of killedTargets){
      if(!unit.alive){
        continue;
      }

      unit.alive=false;

      playAgonySound(unit);
      playDeathSound(unit);
      triggerDeathFx(unit);

      if(unit.controller==="mob"){
        markEnemyNeutralized(unit);

        if(isKoboldUnit(unit)){
          koboldCasualties++;
        }
      }

      updateUi();
      draw();
      await waitForDeathActionPause();
    }

    if(
      koboldCasualties>0 &&
      activeEnemies().length>0
    ){
      const moraleScheduled=
        scheduleKoboldGroupMoraleCheck(
          {
            casualties:koboldCasualties,
            magicCasualties:koboldCasualties,
            source:"Magic Missile"
          },
          0
        );

      if(moraleScheduled){
        await waitForCombatActionPause();
      }
    }

    await waitForCombatActionPause();

    finishTestSpellCast(
      caster,
      spell.name,
      action
    );

    return true;
  };


  /*
    Keep Previewer Reset/Stop from leaving the custom simultaneous volley or
    impact glow alive after its production run is canceled/reset.
  */
  if(
    typeof spellPreviewClearTransientPresentation===
    "function"
  ){
    const r36BasePreviewClear=
      spellPreviewClearTransientPresentation;

    spellPreviewClearTransientPresentation=
    function(){
      r36VolleyFx=null;
      r36ImpactFx=[];

      if(r36ImpactFrame!==null){
        cancelAnimationFrame(
          r36ImpactFrame
        );
        r36ImpactFrame=null;
      }

      return r36BasePreviewClear();
    };
  }


  window.AdventurePartyMagicMissileVolley={
    release:"Candidate Rev 36",
    active:()=>!!r36VolleyFx,
    impactCount:()=>r36ImpactFx.length,
    targetSummary:r36TargetSummary
  };
})();
