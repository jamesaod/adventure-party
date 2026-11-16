/*
  R217 — SHARED OBSCURING-VOLUME LOS
  ==================================
  Wall of Fog, Fog Cloud, Stinking Cloud, and effective magical Darkness now
  share one center-to-center tactical visibility rule.

  Core abstraction:
  - A creature can see its own tactical hex even while inside an obscurer.
  - If the observer's source hex is obscured, normal sight cannot leave that
    hex. This models AD&D fog visibility of only a few feet on a 10-foot grid.
  - From outside an obscurer, a line that enters an obscuring hex stops there.
    A creature in that hex is therefore not visible from outside.
  - Architecture is still solved by the R215 center-in-LOS-polygon rule.
  - R216's wall-bisected-hex presentation exception remains rendering-only.
  - Fog presentation is independent of gameplay LOS: the visible cloud volume
    is repainted after the blackout even though it blocks sight through itself.
*/

function obscuringVolumeAtHex(x,y){
  if(!game || !inside(x,y)) return null;

  const fog=(game.areaEffects || []).find(effect=>
    effect?.type==="fog" &&
    effect?.obscuresLOS!==false &&
    areaEffectContains(effect,x,y)
  );

  if(fog){
    return {
      kind:"fog",
      effect: fog,
      spellKind: fog.spellKind || "wall-of-fog",
      name: fog.name || "Fog"
    };
  }

  if(hasEffectiveDarknessAtHex(x,y)){
    return {
      kind:"darkness",
      effect:null,
      spellKind:"darkness",
      name:"Darkness"
    };
  }

  return null;
}

function hasObscuringMagicAtHex(x,y){
  return !!obscuringVolumeAtHex(x,y);
}

function hasActiveObscuringLosVolume(){
  if(!game) return false;

  if(
    (game.areaEffects || []).some(effect=>
      effect?.type==="fog" &&
      effect?.obscuresLOS!==false &&
      Array.isArray(effect.cells) &&
      effect.cells.length
    )
  ){
    return true;
  }

  return (game.areaEffects || []).some(effect=>
    effect?.type==="darkness" &&
    Array.isArray(effect.cells) &&
    effect.cells.some(cell=>hasEffectiveDarknessAtHex(cell.x,cell.y))
  );
}

function obscuringVolumeBlocksLineBetweenHexes(source,target){
  if(!source || !target) return true;

  if(source.x===target.x && source.y===target.y){
    return false;
  }

  /*
    A unit standing in dense fog/darkness can orient within its own 10-foot
    tactical cell, but cannot acquire a normal-vision target outside it.
  */
  if(obscuringVolumeAtHex(source.x,source.y)){
    return true;
  }

  const cells=hexLineCells(source,target);

  /*
    Index 0 is the unobscured source cell. Any later obscuring cell terminates
    the centerline, including the destination cell itself. Thus the cloud can
    be seen as scenery, but a creature standing inside it cannot be seen.
  */
  return cells.some((cell,index)=>
    index>0 &&
    !!obscuringVolumeAtHex(cell.x,cell.y)
  );
}

/*
  Compatibility name retained for the R215 visibility callers. It now delegates
  to the shared obscuring-volume rule instead of implementing a second fog rule.
*/
function fogBlocksVisibilityToHex(observer,x,y){
  return obscuringVolumeBlocksLineBetweenHexes(
    observer,
    {x,y}
  );
}

function lineOfSightBlockedBetweenHexes(source,target){
  if(!source || !target) return true;

  if(architecturalWallBlocksLOS(source,target)){
    return true;
  }

  return obscuringVolumeBlocksLineBetweenHexes(source,target);
}

function lightBlockedBetweenHexes(source,target){
  if(!source || !target) return true;

  if(
    architecturalWallBlocksWorldLine(
      worldPointForHex(source.x,source.y),
      worldPointForHex(target.x,target.y),
      "light"
    )
  ){
    return true;
  }

  return obscuringVolumeBlocksLineBetweenHexes(source,target);
}

function projectilePathBlockedBetweenHexes(source,target){
  if(!source || !target) return true;

  if(
    architecturalWallBlocksWorldLine(
      worldPointForHex(source.x,source.y),
      worldPointForHex(target.x,target.y),
      "projectile"
    )
  ){
    return true;
  }

  /*
    The combat abstraction requires a clear firing lane. Dense magical
    obscuration therefore blocks missile/projectile targeting at the same
    centerline point where it blocks normal sight.
  */
  return obscuringVolumeBlocksLineBetweenHexes(source,target);
}

function isHexVisibleFromObserver(observer,x,y,context=null){
  if(!observer || !inside(x,y)) return false;

  if(observer.x===x && observer.y===y){
    return true;
  }

  /*
    R215 architectural visibility still uses only the destination hex center.
    On maps without architecture there is no architectural LOS gate.
  */
  if(
    game?.condition==="wall" &&
    !isHexCenterInsideObserverLosCone(observer,x,y,context)
  ){
    return false;
  }

  return !obscuringVolumeBlocksLineBetweenHexes(
    observer,
    {x,y}
  );
}

function isHexVisibleToFriendlyParty(x,y){
  if(!game || !inside(x,y)) return false;

  const observers=friendlyVisibilityObservers();
  if(!observers.length) return true;

  return observers.some(observer=>{
    const context=
      game.condition==="wall"
        ? observerVisibilityContext(observer)
        : null;

    if(game.condition==="wall" && !context){
      return false;
    }

    return isHexVisibleFromObserver(
      observer,
      x,
      y,
      context
    );
  });
}

function isUnitVisibleToFriendlyParty(unit){
  if(!unit) return false;
  if(isFriendlyCombatUnit(unit)) return true;

  const observers=friendlyVisibilityObservers();
  if(!observers.length) return true;

  if(
    getUnitEffect(unit,"invisibility") &&
    !observers.some(observer=>unitVisibleToObserver(observer,unit))
  ){
    return false;
  }

  /*
    Multi-hex entities remain all-or-nothing: if any occupied hex center is
    visible from any friendly observer, render the whole entity.
  */
  return observers.some(observer=>{
    const context=
      game?.condition==="wall"
        ? observerVisibilityContext(observer)
        : null;

    if(game?.condition==="wall" && !context){
      return false;
    }

    return occupiedHexes(unit).some(cell=>
      isHexVisibleFromObserver(
        observer,
        cell.x,
        cell.y,
        context
      )
    );
  });
}

function shouldRenderUnitUnderPartyVisibility(unit){
  return !game || isUnitVisibleToFriendlyParty(unit);
}

/*
  R217 generalizes the tactical blackout pass. Indoors it combines R215/R216
  architecture with obscuring volumes. Outdoors it remains completely inert
  until an obscuring volume exists, so an ordinary open battlefield is
  unchanged.
*/
function drawWallTestLineOfSightMask(){
  if(!game) return;

  const architecturalMode=game.condition==="wall";
  if(!architecturalMode && !hasActiveObscuringLosVolume()){
    return;
  }

  const observers=friendlyVisibilityObservers();
  if(!observers.length) return;

  const observerEntries=observers
    .map(observer=>({
      observer,
      context: architecturalMode
        ? observerVisibilityContext(observer)
        : null
    }))
    .filter(entry=>!architecturalMode || !!entry.context);

  if(!observerEntries.length) return;

  const maskCanvas=drawWallTestLineOfSightMask.maskCanvas ||
    (drawWallTestLineOfSightMask.maskCanvas=document.createElement("canvas"));

  if(maskCanvas.width!==canvas.width || maskCanvas.height!==canvas.height){
    maskCanvas.width=canvas.width;
    maskCanvas.height=canvas.height;
  }

  const maskCtx=maskCanvas.getContext("2d");
  maskCtx.clearRect(0,0,maskCanvas.width,maskCanvas.height);
  maskCtx.globalCompositeOperation="source-over";

  maskCtx.fillStyle="rgba(0,0,0,0.70)";
  maskCtx.fillRect(0,0,maskCanvas.width,maskCanvas.height);

  maskCtx.globalCompositeOperation="destination-out";
  maskCtx.fillStyle="rgba(0,0,0,1)";

  for(const tile of visibleHexes()){
    const visible=observerEntries.some(entry=>
      isHexVisibleFromObserver(
        entry.observer,
        tile.x,
        tile.y,
        entry.context
      )
    );

    const vertices=hexScreenVertices(tile.x,tile.y);

    if(visible){
      maskCtx.beginPath();
      maskCtx.moveTo(vertices[0].x,vertices[0].y);

      for(let i=1;i<vertices.length;i++){
        maskCtx.lineTo(vertices[i].x,vertices[i].y);
      }

      maskCtx.closePath();
      maskCtx.fill();
      continue;
    }

    /*
      Preserve R216 exactly: only a non-passable wall-bisected boundary cell may
      receive partial architectural carving. Obscuring magic never gets this
      exception; it remains binary by tactical centerline.
    */
    if(
      !architecturalMode ||
      !isArchitecturalBlockedHex(tile.x,tile.y)
    ){
      continue;
    }

    maskCtx.save();

    maskCtx.beginPath();
    maskCtx.moveTo(vertices[0].x,vertices[0].y);
    for(let i=1;i<vertices.length;i++){
      maskCtx.lineTo(vertices[i].x,vertices[i].y);
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

      const visiblePolygon=entry.context.polygon.map(point=>
        screenPointForWorld(point)
      );

      if(tracePolygonOnContext(maskCtx,visiblePolygon)){
        maskCtx.fill();
      }
    }

    maskCtx.restore();
  }

  maskCtx.globalCompositeOperation="source-over";

  ctx.save();
  ctx.globalCompositeOperation="source-over";
  ctx.drawImage(maskCanvas,0,0);
  ctx.restore();
}

/*
  Fog must remain visible even though the gameplay query treats its occupied
  hex as opaque. The existing post-LOS depth queue is therefore generalized to
  open battlefields whenever fog is active.
*/
function drawVisibleArchitecturalWallsOverLOS(){
  if(!game) return;

  const architecturalMode=game.condition==="wall";
  const activeFog=(game.areaEffects || []).some(
    effect=>effect?.type==="fog" && Array.isArray(effect.cells) && effect.cells.length
  );

  if(!architecturalMode && !activeFog){
    return;
  }

  const foreground=[];
  const visibleWalls=architecturalMode
    ? architecturalWalls.filter(
        wall=>isArchitecturalWallVisibleToFriendlyParty(wall)
      )
    : [];

  if(architecturalMode){
    drawArchitecturalWallShapeOutline(visibleWalls);
    drawArchitecturalWallTopOutline(visibleWalls);
  }

  for(const wall of visibleWalls){
    const a=screenPointForWorld(wall.a);
    const b=screenPointForWorld(wall.b);
    foreground.push({
      sortY:Math.max(a.y,b.y)+0.25,
      sortX:(a.x+b.x)/2,
      fn:()=>drawArchitecturalWallSegment(wall)
    });
  }

  /*
    Presentation visibility deliberately ignores the cloud's own opacity.
    Architecture may hide a cloud; the cloud may not hide itself.
  */
  for(const effect of game.areaEffects || []){
    if(effect?.type!=="fog") continue;

    const visibleFogCells=(effect.cells || []).filter(cell=>
      inside(cell.x,cell.y) &&
      isHexOnBattlefieldScreen(cell.x,cell.y,HEX_W) &&
      (
        !architecturalMode ||
        isFogCellArchitecturallyVisibleToFriendlyParty(cell)
      )
    );

    let outlineSortY=-Infinity;
    let outlineSortX=0;

    for(const cell of visibleFogCells){
      const c=hexCenter(cell.x,cell.y);
      const sortY=c.y+0.5;
      outlineSortY=Math.max(outlineSortY,sortY);
      outlineSortX=c.x;

      foreground.push({
        sortY,
        sortX:c.x,
        fn:()=>drawFogVolumeCell(cell,effect)
      });
    }

    if(visibleFogCells.length && Number.isFinite(outlineSortY)){
      const visibleEffect={...effect,cells:visibleFogCells};
      foreground.push({
        sortY:outlineSortY+0.02,
        sortX:outlineSortX,
        fn:()=>drawFogEffectOutline(visibleEffect)
      });
    }
  }

  /*
    Party members remain represented even while personally engulfed; enemy
    rendering follows the authoritative party visibility query.
  */
  if(game.player?.alive && !game.player.fled){
    const c=hexCenter(game.player.x,game.player.y);
    foreground.push({
      sortY:c.y,
      sortX:c.x,
      fn:()=>drawFighter(game.player)
    });
  }

  for(const ally of game.allies || []){
    if(!ally?.alive || ally.fled) continue;

    const c=hexCenter(ally.x,ally.y);
    foreground.push({
      sortY:c.y,
      sortX:c.x,
      fn:()=>ally.type==="mage"
        ? drawFriendlyMage(ally)
        : drawFriendlyArcher(ally)
    });
  }

  for(const enemy of game.enemies || []){
    if(!enemy?.alive || enemy.fled) continue;
    if(!shouldRenderUnitUnderPartyVisibility(enemy)) continue;

    const depth=unitDepthSortPoint(enemy);
    foreground.push({
      sortY:depth.y,
      sortX:depth.x,
      fn:()=>
        enemy.type==="orc"
          ? drawOrc(enemy)
          : enemy.type==="juvenile-red-dragon"
            ? drawLargeTestMob(enemy)
            : drawKobold(enemy)
    });
  }

  foreground.sort(
    (a,b)=>a.sortY-b.sortY || a.sortX-b.sortX
  );

  for(const item of foreground){
    item.fn();
  }
}
