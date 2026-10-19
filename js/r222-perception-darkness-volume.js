/*
  R222 — AUTHORITATIVE PERCEPTION + RADIAL DARKNESS VOLUME
  ========================================================
  Combat rule:
    Position is not perception.

  A unit's physical adjacency, real coordinates, or presence in the unit list
  never grants an automated combatant permission to attack it. Current visual
  perception is resolved through one query that combines invisibility,
  blindness, architecture, fog/cloud/darkness, and multi-hex footprints.

  Presentation rule:
    Darkness remains hex-based for gameplay, but its visible presentation is a
    soft radial volume instead of black-filled tactical tiles.
*/


/* ============================================================
   AUTHORITATIVE UNIT PERCEPTION
   ============================================================ */

function r222ObserverCanUseVision(observer){
  return !!(
    observer?.alive &&
    !observer.fled &&
    !getUnitEffect(observer,"blind") &&
    !getUnitEffect(observer,"sleep") &&
    !getUnitEffect(observer,"unconscious")
  );
}

function r222UnitCurrentlyVisible(observer,target){
  if(!observer || !target) return false;
  if(observer.id===target.id) return true;

  if(
    !r222ObserverCanUseVision(observer) ||
    !target.alive ||
    target.fled
  ){
    return false;
  }

  /*
    Keep the established invisibility / Glitterdust / Detect Invisibility
    subsystem as the special-vision gate. That function intentionally does not
    answer ordinary fog/wall LOS, which is resolved below.
  */
  if(!unitVisibleToObserver(observer,target)){
    return false;
  }

  const sourceCells=
    occupiedHexesAt(
      observer,
      observer.x,
      observer.y
    );

  const targetCells=
    occupiedHexesAt(
      target,
      target.x,
      target.y
    );

  /*
    Multi-hex entities are visible if ANY occupied observer cell can see ANY
    occupied target cell. A one-hex creature standing inside dense fog or
    Darkness cannot see an adjacent outside cell because the shared obscuring
    volume query blocks sight from its source cell.
  */
  for(const sourceCell of sourceCells){
    for(const targetCell of targetCells){
      if(
        !lineOfSightBlockedBetweenHexes(
          sourceCell,
          targetCell
        )
      ){
        return true;
      }
    }
  }

  return false;
}

function r222PerceptionState(observer,target){
  if(!observer || !target){
    return {
      state:"unknown",
      exact:false,
      x:null,
      y:null,
      confidence:0
    };
  }

  if(r222UnitCurrentlyVisible(observer,target)){
    return {
      state:"visible",
      exact:true,
      x:target.x,
      y:target.y,
      confidence:1
    };
  }

  /*
    MOB memory is deliberately consulted only after current sight fails.
    Intelligence determines how long the remembered position remains useful,
    but never reveals the target's current hidden coordinates.
  */
  if(
    observer.controller==="mob" &&
    typeof r220TargetMemoryRecord==="function"
  ){
    const record=
      r220TargetMemoryRecord(
        observer,
        target
      );

    if(record){
      return {
        state:"remembered",
        exact:false,
        x:record.x,
        y:record.y,
        confidence:
          Math.max(
            0,
            Math.min(
              1,
              Number(record.confidence)||0
            )
          )
      };
    }
  }

  return {
    state:"unknown",
    exact:false,
    x:null,
    y:null,
    confidence:0
  };
}

function r222IsAutomatedAttacker(unit){
  if(!unit) return false;

  if(
    unit.controller==="mob" ||
    unit.controller==="npc"
  ){
    return true;
  }

  return !!(
    typeof isQuickCommandUnit==="function" &&
    isQuickCommandUnit(unit)
  );
}


/*
  R220's hazard/memory system asks this function at runtime. Repoint it to the
  authoritative perception query so Intelligence uses honest information.
*/
if(typeof r220MobCanSeeUnit==="function"){
  r220MobCanSeeUnit=
    r222UnitCurrentlyVisible;
}


/*
  Hostile enumeration now means "hostiles this observer can currently see".
  R220 remembered-target pursuit uses its own memory list and therefore remains
  available to MOBs after current LOS is lost.
*/
hostileCombatantsFor=function(unit){
  if(!unit) return [];

  return activeCombatants().filter(other=>
    other.id!==unit.id &&
    other.faction!==unit.faction &&
    r222UnitCurrentlyVisible(unit,other)
  );
};


nearestLivingPartyTarget=function(fromUnit){
  return livingPartyMembers()
    .filter(target=>
      r222UnitCurrentlyVisible(
        fromUnit,
        target
      )
    )
    .slice()
    .sort((a,b)=>
      unitDistance(fromUnit,a)-
        unitDistance(fromUnit,b) ||
      a.id.localeCompare(b.id)
    )[0] || null;
};


/* ============================================================
   ATTACK / REACTION PERCEPTION GATES
   ============================================================ */

const r222BaseCanMeleeAttackTarget=
  canMeleeAttackTarget;

canMeleeAttackTarget=function(attacker,target){
  if(
    !r222BaseCanMeleeAttackTarget(
      attacker,
      target
    )
  ){
    return false;
  }

  if(
    target &&
    attacker?.faction!==target.faction &&
    r222IsAutomatedAttacker(attacker)
  ){
    return r222UnitCurrentlyVisible(
      attacker,
      target
    );
  }

  return true;
};


const r222BaseMobCanMissileAttack=
  mobCanMissileAttack;

mobCanMissileAttack=function(mob,target){
  if(
    !r222UnitCurrentlyVisible(
      mob,
      target
    )
  ){
    return false;
  }

  return r222BaseMobCanMissileAttack(
    mob,
    target
  );
};


const r222BaseUnitCanMakeLeavingHexFreeAttack=
  unitCanMakeLeavingHexFreeAttack;

unitCanMakeLeavingHexFreeAttack=function(
  attacker,
  mover
){
  if(
    !r222BaseUnitCanMakeLeavingHexFreeAttack(
      attacker,
      mover
    )
  ){
    return false;
  }

  /*
    Physical adjacency does not itself reveal that somebody left the hex.
    This closes the free-attack leak for creatures blinded by fog/darkness.
  */
  return r222UnitCurrentlyVisible(
    attacker,
    mover
  );
};


maybeTriggerPlayerGuard=function(mob){
  const guarder=
    livingPartyMembers()
      .filter(unit=>
        isPlayerControlledUnit(unit) &&
        unit.guard &&
        mob?.alive &&
        !mob.fled &&
        mob.faction!==unit.faction &&
        canMeleeReach(unit,mob) &&
        r222UnitCurrentlyVisible(unit,mob) &&
        !wasAdjacentWhenGuardSet(unit,mob)
      )
      .sort(
        (a,b)=>
          a.id.localeCompare(b.id)
      )[0];

  if(!guarder) return false;

  guarder.guard=false;
  guarder.guardBaselineAdjacentIds=[];

  log(
    `GUARD! ${guarder.name} attacks ${mob.name} as it newly enters an adjacent visible hex.`,
    "good"
  );

  setUnitActionBanner(
    guarder,
    `Guard Attack with ${unitActionWeapon(guarder)}`
  );

  attack(guarder,mob);
  updateUi();
  draw();

  return true;
};


/*
  Last line of defense: even if a future AI/reaction routine accidentally hands
  an automated combatant a hidden live target object, the central attack
  resolver refuses to exploit those hidden coordinates.
*/
const r222BaseAttack=attack;

attack=function(attacker,defender,options={}){
  if(
    attacker &&
    defender &&
    attacker.faction!==defender.faction &&
    r222IsAutomatedAttacker(attacker) &&
    !r222UnitCurrentlyVisible(
      attacker,
      defender
    )
  ){
    log(
      `${attacker.name} cannot visually acquire ${defender.name} through the obscuration.`,
      "system"
    );

    return {
      hit:false,
      killed:false,
      damage:0,
      blockedByPerception:true
    };
  }

  return r222BaseAttack(
    attacker,
    defender,
    options
  );
};


/* ============================================================
   DARKNESS PRESENTATION HELPERS
   ============================================================ */

function r222DarknessCenter(effect){
  if(!effect) return null;

  if(
    Number.isFinite(effect.presentationCenter?.x) &&
    Number.isFinite(effect.presentationCenter?.y)
  ){
    return {
      x:effect.presentationCenter.x,
      y:effect.presentationCenter.y
    };
  }

  const cells=
    (effect.cells || [])
      .filter(cell=>
        Number.isFinite(cell?.x) &&
        Number.isFinite(cell?.y)
      );

  if(!cells.length) return null;

  /*
    For the current 7-cell 15-foot tactical footprint, the true center is the
    cell with the minimum summed distance to all other cells. This remains
    robust if the footprint representation changes later.
  */
  const center=
    cells.slice().sort((a,b)=>{
      const scoreA=
        cells.reduce(
          (sum,cell)=>
            sum+hexDistance(a,cell),
          0
        );

      const scoreB=
        cells.reduce(
          (sum,cell)=>
            sum+hexDistance(b,cell),
          0
        );

      return (
        scoreA-scoreB ||
        a.x-b.x ||
        a.y-b.y
      );
    })[0];

  effect.presentationCenter={
    x:center.x,
    y:center.y
  };

  return {
    x:center.x,
    y:center.y
  };
}

function r222DarknessActiveCells(effect){
  return (effect?.cells || [])
    .filter(cell=>
      inside(cell.x,cell.y) &&
      hasEffectiveDarknessAtHex(
        cell.x,
        cell.y
      )
    );
}

function r222ArchitecturalCenterVisible(
  observer,
  x,
  y
){
  if(game?.condition!=="wall"){
    return true;
  }

  const context=
    observerVisibilityContext(observer);

  if(!context) return false;

  return isHexCenterInsideObserverLosCone(
    observer,
    x,
    y,
    context
  );
}

function r222DarknessCellPresentationVisible(
  x,
  y
){
  if(!game || !inside(x,y)) return false;

  const observers=
    friendlyVisibilityObservers();

  if(!observers.length) return true;

  return observers.some(observer=>{
    if(
      observer.x===x &&
      observer.y===y
    ){
      return true;
    }

    if(
      !r222ArchitecturalCenterVisible(
        observer,
        x,
        y
      )
    ){
      return false;
    }

    /*
      If a party member is itself standing in magical obscuration, show the
      local Darkness volume so the player understands the condition, even
      though the unit cannot see through it.
    */
    if(
      hasEffectiveDarknessAtHex(
        observer.x,
        observer.y
      )
    ){
      return true;
    }

    if(hasFogAtHex(observer.x,observer.y)){
      return false;
    }

    const cells=
      hexLineCells(
        observer,
        {x,y}
      );

    /*
      Ignore the destination Darkness cell itself for presentation. Any OTHER
      obscuring volume between observer and destination still hides the effect.
    */
    return !cells.some(
      (cell,index)=>
        index>0 &&
        index<cells.length-1 &&
        hasObscuringMagicAtHex(
          cell.x,
          cell.y
        )
    );
  });
}

function r222DarknessEffectPresentationVisible(
  effect
){
  return r222DarknessActiveCells(effect)
    .some(cell=>
      r222DarknessCellPresentationVisible(
        cell.x,
        cell.y
      )
    );
}

function r222DarknessOpacityFactor(effect){
  const total=
    Math.max(
      1,
      Number(effect?.cells?.length)||1
    );

  const active=
    r222DarknessActiveCells(effect)
      .length;

  return Math.max(
    0,
    Math.min(
      1,
      active/total
    )
  );
}


/*
  Preserve R220's addAreaEffect behavior while attaching presentation metadata
  to new Darkness effects.
*/
const r222BaseAddAreaEffect=
  addAreaEffect;

addAreaEffect=function(effect){
  if(
    effect?.type==="darkness" &&
    Array.isArray(effect.cells) &&
    effect.cells.length
  ){
    const center=
      r222DarknessCenter(effect);

    effect.visualRadiusFeet=
      Number(effect.visualRadiusFeet)||15;

    effect.visualRadiusHexes=
      Number(effect.visualRadiusHexes)||1.5;

    if(center){
      effect.presentationCenter={
        x:center.x,
        y:center.y
      };
    }
  }

  return r222BaseAddAreaEffect(effect);
};


function r222FillRadialEllipse(
  targetCtx,
  centerX,
  centerY,
  radiusX,
  yScale,
  stops
){
  targetCtx.save();
  targetCtx.translate(
    centerX,
    centerY
  );
  targetCtx.scale(
    1,
    yScale
  );

  const gradient=
    targetCtx.createRadialGradient(
      0,
      0,
      0,
      0,
      0,
      radiusX
    );

  for(const stop of stops){
    gradient.addColorStop(
      stop.at,
      stop.color
    );
  }

  targetCtx.fillStyle=gradient;
  targetCtx.beginPath();
  targetCtx.arc(
    0,
    0,
    radiusX,
    0,
    Math.PI*2
  );
  targetCtx.fill();

  targetCtx.restore();
}

function r222DrawDarknessGround(effect){
  if(
    !r222DarknessEffectPresentationVisible(effect)
  ){
    return;
  }

  const center=
    r222DarknessCenter(effect);

  if(!center) return;

  const c=
    hexCenter(
      center.x,
      center.y
    );

  const factor=
    r222DarknessOpacityFactor(effect);

  if(factor<=0) return;

  const radius=
    HEX_W*
    Math.max(
      1.35,
      Number(effect.visualRadiusHexes)||1.5
    );

  r222FillRadialEllipse(
    ctx,
    c.x,
    c.y+5,
    radius,
    0.42,
    [
      {
        at:0,
        color:`rgba(0,0,8,${0.72*factor})`
      },
      {
        at:0.56,
        color:`rgba(2,1,12,${0.58*factor})`
      },
      {
        at:0.82,
        color:`rgba(8,5,20,${0.28*factor})`
      },
      {
        at:1,
        color:"rgba(12,8,24,0)"
      }
    ]
  );
}

function r222DrawDarknessVolume(effect){
  if(
    !r222DarknessEffectPresentationVisible(effect)
  ){
    return;
  }

  const center=
    r222DarknessCenter(effect);

  if(!center) return;

  const c=
    hexCenter(
      center.x,
      center.y
    );

  const factor=
    r222DarknessOpacityFactor(effect);

  if(factor<=0) return;

  const radius=
    HEX_W*
    Math.max(
      1.35,
      Number(effect.visualRadiusHexes)||1.5
    );

  /*
    Main projected sphere. The slightly vertical ellipse reads as a volume in
    the isometric scene instead of a floor decal. The feathered edge avoids any
    hex-shaped or hard circular boundary.
  */
  r222FillRadialEllipse(
    ctx,
    c.x,
    c.y-radius*0.28,
    radius,
    0.78,
    [
      {
        at:0,
        color:`rgba(0,0,5,${0.96*factor})`
      },
      {
        at:0.42,
        color:`rgba(1,0,8,${0.91*factor})`
      },
      {
        at:0.68,
        color:`rgba(5,2,14,${0.77*factor})`
      },
      {
        at:0.86,
        color:`rgba(11,6,24,${0.42*factor})`
      },
      {
        at:1,
        color:"rgba(18,10,30,0)"
      }
    ]
  );

  /*
    A softer upper bloom makes the volume feel spherical rather than like one
    dark projected ellipse.
  */
  r222FillRadialEllipse(
    ctx,
    c.x-radius*0.08,
    c.y-radius*0.68,
    radius*0.68,
    0.70,
    [
      {
        at:0,
        color:`rgba(1,0,8,${0.62*factor})`
      },
      {
        at:0.62,
        color:`rgba(5,2,16,${0.34*factor})`
      },
      {
        at:1,
        color:"rgba(12,8,24,0)"
      }
    ]
  );
}


/* ============================================================
   AREA-EFFECT DRAWING WITHOUT DARKNESS HEX FILLS
   ============================================================ */

drawSpellAreaEffects=function(){
  if(!game?.areaEffects?.length) return;

  for(const effect of game.areaEffects){
    if(
      ![
        "grease",
        "darkness",
        "web",
        "flaming-sphere"
      ].includes(effect.type)
    ){
      continue;
    }

    if(effect.type==="darkness"){
      /*
        Ground presence is radial now. Do not paint the seven logical cells as
        black polygons.
      */
      r222DrawDarknessGround(effect);
      continue;
    }

    for(const cell of effect.cells || []){
      if(!inside(cell.x,cell.y)) continue;

      const top=
        hexScreenVertices(
          cell.x,
          cell.y
        );

      const center=
        hexCenter(
          cell.x,
          cell.y
        );

      if(effect.type==="grease"){
        polygonPath(top);
        ctx.fillStyle=
          "rgba(164,150,75,0.32)";
        ctx.fill();
        ctx.strokeStyle=
          "rgba(230,214,120,0.85)";
        ctx.lineWidth=2;
        ctx.stroke();
        continue;
      }

      if(effect.type==="web"){
        polygonPath(top);
        ctx.fillStyle=
          "rgba(220,225,220,0.10)";
        ctx.fill();
        ctx.strokeStyle=
          "rgba(235,238,232,0.86)";
        ctx.lineWidth=1.3;

        for(let i=0;i<top.length;i++){
          const a=top[i];
          const b=
            top[(i+3)%top.length];

          ctx.beginPath();
          ctx.moveTo(a.x,a.y);
          ctx.lineTo(b.x,b.y);
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(
          center.x,
          center.y,
          7,
          0,
          Math.PI*2
        );
        ctx.stroke();
        continue;
      }

      if(effect.type==="flaming-sphere"){
        const pulse=
          1+
          0.10*
          Math.sin(
            performance.now()*0.012
          );

        ctx.save();
        ctx.globalAlpha=0.94;
        ctx.fillStyle=
          "rgba(255,94,12,0.92)";
        ctx.beginPath();
        ctx.arc(
          center.x,
          center.y-9,
          9*pulse,
          0,
          Math.PI*2
        );
        ctx.fill();

        ctx.fillStyle=
          "rgba(255,211,58,0.92)";
        ctx.beginPath();
        ctx.arc(
          center.x,
          center.y-11,
          5.5*pulse,
          0,
          Math.PI*2
        );
        ctx.fill();

        ctx.strokeStyle=
          "rgba(75,20,3,0.95)";
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.arc(
          center.x,
          center.y-9,
          10*pulse,
          0,
          Math.PI*2
        );
        ctx.stroke();
        ctx.restore();
      }
    }
  }
};


/* ============================================================
   LOS MASK: DARKNESS VISUAL VOLUME OWNS ITS OWN CELLS
   ============================================================ */

drawWallTestLineOfSightMask=function(){
  if(!game) return;

  const architecturalMode=
    game.condition==="wall";

  if(
    !architecturalMode &&
    !hasActiveObscuringLosVolume()
  ){
    return;
  }

  const observers=
    friendlyVisibilityObservers();

  if(!observers.length) return;

  const observerEntries=
    observers
      .map(observer=>({
        observer,
        context:
          architecturalMode
            ? observerVisibilityContext(observer)
            : null
      }))
      .filter(entry=>
        !architecturalMode ||
        !!entry.context
      );

  if(!observerEntries.length) return;

  const maskCanvas=
    drawWallTestLineOfSightMask.maskCanvas ||
    (
      drawWallTestLineOfSightMask.maskCanvas=
        document.createElement("canvas")
    );

  if(
    maskCanvas.width!==canvas.width ||
    maskCanvas.height!==canvas.height
  ){
    maskCanvas.width=canvas.width;
    maskCanvas.height=canvas.height;
  }

  const maskCtx=
    maskCanvas.getContext("2d");

  maskCtx.clearRect(
    0,
    0,
    maskCanvas.width,
    maskCanvas.height
  );

  maskCtx.globalCompositeOperation=
    "source-over";

  maskCtx.fillStyle=
    "rgba(0,0,0,0.70)";

  maskCtx.fillRect(
    0,
    0,
    maskCanvas.width,
    maskCanvas.height
  );

  maskCtx.globalCompositeOperation=
    "destination-out";

  maskCtx.fillStyle=
    "rgba(0,0,0,1)";

  for(const tile of visibleHexes()){
    const visible=
      observerEntries.some(entry=>
        isHexVisibleFromObserver(
          entry.observer,
          tile.x,
          tile.y,
          entry.context
        )
      );

    /*
      Gameplay still says a Darkness cell is opaque. Presentation lets the
      radial magical volume represent that cell instead of the generic 70%
      hex-shaped LOS blackout.
    */
    const darknessOwnsPresentation=
      hasEffectiveDarknessAtHex(
        tile.x,
        tile.y
      ) &&
      r222DarknessCellPresentationVisible(
        tile.x,
        tile.y
      );

    const vertices=
      hexScreenVertices(
        tile.x,
        tile.y
      );

    if(
      visible ||
      darknessOwnsPresentation
    ){
      maskCtx.beginPath();
      maskCtx.moveTo(
        vertices[0].x,
        vertices[0].y
      );

      for(let i=1;i<vertices.length;i++){
        maskCtx.lineTo(
          vertices[i].x,
          vertices[i].y
        );
      }

      maskCtx.closePath();
      maskCtx.fill();
      continue;
    }

    if(
      !architecturalMode ||
      !isArchitecturalBlockedHex(
        tile.x,
        tile.y
      )
    ){
      continue;
    }

    maskCtx.save();

    maskCtx.beginPath();
    maskCtx.moveTo(
      vertices[0].x,
      vertices[0].y
    );

    for(let i=1;i<vertices.length;i++){
      maskCtx.lineTo(
        vertices[i].x,
        vertices[i].y
      );
    }

    maskCtx.closePath();
    maskCtx.clip();

    for(const entry of observerEntries){
      if(
        obscuringVolumeBlocksLineBetweenHexes(
          entry.observer,
          tile
        )
      ){
        continue;
      }

      const visiblePolygon=
        entry.context.polygon.map(point=>
          screenPointForWorld(point)
        );

      if(
        tracePolygonOnContext(
          maskCtx,
          visiblePolygon
        )
      ){
        maskCtx.fill();
      }
    }

    maskCtx.restore();
  }

  maskCtx.globalCompositeOperation=
    "source-over";

  ctx.save();
  ctx.globalCompositeOperation=
    "source-over";

  ctx.drawImage(
    maskCanvas,
    0,
    0
  );

  ctx.restore();
};


/*
  The normal post-LOS foreground pass repaints walls/fog/units. Draw Darkness
  after that pass so it actually obscures creatures inside its volume rather
  than sitting underneath their sprites.
*/
const r222BaseDrawVisibleArchitecturalWallsOverLOS=
  drawVisibleArchitecturalWallsOverLOS;

drawVisibleArchitecturalWallsOverLOS=function(){
  r222BaseDrawVisibleArchitecturalWallsOverLOS();

  for(const effect of game?.areaEffects || []){
    if(effect?.type!=="darkness") continue;
    r222DrawDarknessVolume(effect);
  }
};


/* Public diagnostic hook for perception debugging. */
window.AdventurePartyPerception={
  state:r222PerceptionState,
  currentlyVisible:r222UnitCurrentlyVisible
};
