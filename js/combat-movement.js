/* Combat owner: combat-movement.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

function unitFootprintDefinition(unit){
  return unitPoseDefinition(unit)?.spriteLayout || STUDIO_FOOTPRINTS.get(unit?.footprintId) ||
    UNIT_FOOTPRINTS[unit?.footprintId] || UNIT_FOOTPRINTS.single;
}

function rotateAxialOffset(offset,steps=0){
  let x=Number(offset?.x)||0;
  let y=Number(offset?.y)||0;
  const count=((Math.round(steps)%6)+6)%6;
  // Facing indices turn E -> NE -> NW, so axial rotation is counterclockwise.
  for(let i=0;i<count;i++) [x,y]=[x+y,-x];
  return {x:x||0,y:y||0};
}

function footprintOffsetsForFacing(unit,facingHex=facingDirectionIndex(unit)){
  const footprint=unitFootprintDefinition(unit);
  if(!footprint.rotates){
    return footprint.offsets.map(offset=>({...offset}));
  }

  return footprint.offsets.map(offset=>
    rotateAxialOffset(offset,facingHex)
  );
}

function occupiedHexesAt(
  unit,
  x=unit?.x,
  y=unit?.y,
  facingHex=facingDirectionIndex(unit)
){
  if(!Number.isFinite(x) || !Number.isFinite(y)) return [];

  return footprintOffsetsForFacing(unit,facingHex).map(offset=>({
    x:x+offset.x,
    y:y+offset.y
  }));
}

function occupiedHexes(unit){
  return occupiedHexesAt(unit);
}

function unitOccupiesHex(unit,x,y){
  return !!unit && occupiedHexes(unit).some(cell=>
    cell.x===x && cell.y===y
  );
}

function unitFootprintCellCount(unit){
  return unitFootprintDefinition(unit).offsets.length;
}

function unitDistance(a,b){
  if(!a || !b) return Infinity;
  const aCells=occupiedHexesAt(a,a.x,a.y);
  const bCells=occupiedHexesAt(b,b.x,b.y);
  let best=Infinity;

  for(const ac of aCells){
    for(const bc of bCells){
      best=Math.min(best,hexDistance(ac,bc));
    }
  }

  return best;
}

function unitDistanceAt(unit,x,y,target){
  if(!unit || !target) return Infinity;
  const sourceCells=occupiedHexesAt(unit,x,y);
  const targetCells=occupiedHexesAt(target,target.x,target.y);
  let best=Infinity;

  for(const source of sourceCells){
    for(const destination of targetCells){
      best=Math.min(best,hexDistance(source,destination));
    }
  }

  return best;
}

function canUnitStandAt(unit,x,y,facingHex=facingDirectionIndex(unit)){
  if(!unit) return false;

  for(const cell of occupiedHexesAt(unit,x,y,facingHex)){
    if(!inside(cell.x,cell.y) || isWall(cell.x,cell.y) || isFirBlockedHex(cell.x,cell.y)){
      return false;
    }

    if(occupiedByAnyUnit(cell.x,cell.y,unit.id)){
      return false;
    }
  }

  return true;
}

function canUnitRotateAt(unit,x,y,toFacing,fromFacing=facingDirectionIndex(unit)){
  const footprint=unitFootprintDefinition(unit);
  if(!footprint.rotates || fromFacing===toFacing) return true;
  const forward=((toFacing-fromFacing)%6+6)%6;
  const backward=6-forward;
  const directions=forward===backward ? [1,-1] : [forward<backward ? 1 : -1];
  return directions.some(direction=>{
    let previous=((fromFacing%6)+6)%6;
    const count=direction===1 ? forward : backward;
    for(let step=1;step<=count;step++){
      const facing=((previous+direction)%6+6)%6;
      if(!canUnitStandAt(unit,x,y,facing)) return false;
      const from=occupiedHexesAt(unit,x,y,previous);
      const to=occupiedHexesAt(unit,x,y,facing);
      if(from.some((cell,index)=>architecturalWallBlocksStep(cell,to[index]))) return false;
      previous=facing;
    }
    return true;
  });
}

function unitTransitionBlocked(unit,from,to,facingHex=null){
  if(!unit || !from || !to) return true;
  const rotates=unitFootprintDefinition(unit).rotates;
  const fromFacing=Number.isInteger(from.facingHex) ? from.facingHex : facingDirectionIndex(unit);
  const destinationFacing=Number.isInteger(facingHex) ? facingHex
    : rotates && (from.x!==to.x || from.y!==to.y) ? hexDirectionIndexToward(from,to)
    : fromFacing;
  if(!canUnitStandAt(unit,to.x,to.y,destinationFacing)) return true;
  if(rotates && !canUnitRotateAt(unit,from.x,from.y,destinationFacing,fromFacing)) return true;

  const sourceCells=occupiedHexesAt(unit,from.x,from.y,destinationFacing);
  const targetCells=occupiedHexesAt(unit,to.x,to.y,destinationFacing);
  return sourceCells.some((cell,index)=>architecturalWallBlocksStep(cell,targetCells[index]));
}

function pathToNearestRangedFiringHex(unit,{avoidThreatened=true}={}){
  if(!unit?.alive || unit.fled || !unit.rangedWeapon) return null;
  if(unitFootprintDefinition(unit).rotates){
    const result=searchRotatingFootprintPath(unit,unit,{
      goal:proxy=>!(avoidThreatened && rangedAiPositionThreatened(proxy,proxy)) && bestRangedAiTargetFrom(proxy,proxy)
    });
    if(!result.value) return null;
    const end=result.path[result.path.length-1];
    return {path:result.path,target:result.value,firingHex:{x:end.x,y:end.y},
      distance:unitDistance({...unit,...end},result.value)};
  }

  const targets=rangedAiOpponents(unit);
  if(!targets.length) return null;

  const start={x:unit.x,y:unit.y};
  const queue=[start];
  const seen=new Set([key(start.x,start.y)]);
  const came=new Map();

  const reconstruct=(end)=>{
    const path=[];
    let cur={x:end.x,y:end.y};

    while(cur){
      path.push(cur);
      if(cur.x===start.x && cur.y===start.y) break;
      cur=came.get(key(cur.x,cur.y)) || null;
    }

    path.reverse();
    return path;
  };

  while(queue.length){
    const cur=queue.shift();
    const threatened=avoidThreatened && rangedAiPositionThreatened(unit,cur);
    const target=!threatened ? bestRangedAiTargetFrom(unit,cur) : null;

    if(target){
      return {
        path:reconstruct(cur),
        target,
        firingHex:{x:cur.x,y:cur.y},
        distance:unitDistanceAt(unit,cur.x,cur.y,target)
      };
    }

    const dirs=[...HEX_DIRS].sort((a,b)=>{
      const na={x:cur.x+a.x,y:cur.y+a.y};
      const nb={x:cur.x+b.x,y:cur.y+b.y};
      const da=Math.min(...targets.map(target=>unitDistanceAt(unit,na.x,na.y,target)));
      const db=Math.min(...targets.map(target=>unitDistanceAt(unit,nb.x,nb.y,target)));
      return da-db || a.x-b.x || a.y-b.y;
    });

    for(const dir of dirs){
      const next={x:cur.x+dir.x,y:cur.y+dir.y};
      const nk=key(next.x,next.y);

      if(seen.has(nk)) continue;
      if(unitTransitionBlocked(unit,cur,next)) continue;

      seen.add(nk);
      came.set(nk,{x:cur.x,y:cur.y});
      queue.push(next);
    }
  }

  return null;
}

async function animateAiAlongPath(unit,path,maxSteps){
  if(!unit || !Array.isArray(path) || path.length<2) return 0;

  const steps=Math.min(
    Math.max(0,Number(maxSteps)||0),
    path.length-1
  );

  let index=1;
  await animateEntitySteps(
    unit,
    steps,
    ()=>path[index++] || null,
    105
  );

  return steps;
}

async function tryPlayerMove(dx,dy){
  const p=activePlayerControlledUnit();
  if(
    game.over || !p || game.active!==p.id || !p.alive ||
    sweepInProgress || mobGuardReactionInProgress || freeStrikeInProgress ||
    isCombatActionPauseActive()
  ) return;

  const nx=p.x+dx;
  const ny=p.y+dy;
  const moveCost=1;

  if(isWall(nx,ny) || architecturalWallBlocksStep(p,{x:nx,y:ny})){ log("Movement blocked by wall.","system"); return; }

  const enemy=enemyAtHex(nx,ny);
  if(enemy){
    if(p.fullMove){ log("A full move forfeits the melee attack this round.","system"); return; }
    if(p.turnMoves>p.halfMove){ log("You have moved too far to attack this round.","system"); return; }

    updateFacingForStep(p,dx,dy);

    if(p.id==="player" && isSweepEligibleTarget(enemy) && canUseSweep()){
      await performSweep(enemy);
      return;
    }

    const result=await attack(p,enemy);
    if(result?.killed || result?.criticalMiss) await waitForCombatActionPause();
    if(!game.over) finishPlayerAttackAction();
    return;
  }

  if(occupiedByAnyUnit(nx,ny,p.id)){ log("That hex is occupied.","system"); return; }
  if(unitTransitionBlocked(p,p,{x:nx,y:ny})){
    log("Movement blocked: the complete footprint cannot turn or fit there.","system");
    return;
  }

  if(!p.fullMove && p.turnMoves+moveCost>p.halfMove){
    if(p.turnMoves+moveCost>p.move){log(`Not enough movement remaining (${moveCost} required).`,"system");return;}
    p.fullMove=true;
    log(`Movement passes the attack threshold; Full Move activates automatically (${p.move} hex maximum).`,"system");
  }

  const maxMove=p.fullMove ? p.move : p.halfMove;
  if(p.turnMoves+moveCost>maxMove){ log(`Not enough movement remaining (${moveCost} required, ${Math.max(0,maxMove-p.turnMoves)} left).`,"system"); return; }

  const canLeave=await performLeavingHexFreeAttacks(p,{x:nx,y:ny});
  if(!canLeave){
    if(!game.over && !p.alive) endTurn();
    return;
  }

  // A multi-hex free-strike attacker may have turned into the destination.
  if(unitTransitionBlocked(p,p,{x:nx,y:ny})){
    log("Movement blocked: the footprint no longer fits after the reaction.","system");
    return;
  }
  updateFacingForStep(p,dx,dy);
  setUnitActionBanner(p,"Moving");
  p.x=nx; p.y=ny; p.turnMoves+=moveCost;
  maybeRecenterCamera(p);
  playMoveSound();
  log(`${p.name} moves to hex ${nx},${ny} (${p.turnMoves}/${maxMove}).`);
  updateUi(); draw();

  const areaResult=await resolvePersistentAreaMovementStep(p);
  if(areaResult.haltMovement){
    setUnitActionBanner(p,"Affected by Area Spell");
    if(!game.over) endTurn();
    return;
  }

  await triggerMobGuardsAgainst(p);
  if(game.over || !p.alive) return;

  if(p.turnMoves>=maxMove && p.fullMove){
    log("Full movement complete.","system");
    endTurn();
  }
}

function chooseFullMove(){
  const p=activePlayerControlledUnit();
  if(game.over || !p || isCombatActionPauseActive()) return;
  if(p.turnMoves>0){ log("Choose full move before moving.","system"); return; }
  p.fullMove=true;
  log(`${p.name} selects Full Move: up to ${p.move} hexes; no melee attack this turn.`,"system");
  updateUi();
}

function passableForPath(x,y,mover,target){
  if(!mover){
    return !isWall(x,y) && !isFirBlockedHex(x,y) && !occupiedByAnyUnit(x,y,null);
  }

  /*
    R186: pathfinding validates the mover's COMPLETE destination footprint.
    Target cells require no special case because overlap with the target's
    footprint is rejected by canUnitStandAt().
  */
  return canUnitStandAt(mover,x,y);
}

function searchRotatingFootprintPath(mover,start,{goal=null,score=null,maxSteps=Infinity}={}){
  const first={x:start.x,y:start.y,facingHex:facingDirectionIndex(mover),steps:0};
  const nodeKey=node=>`${node.x},${node.y},${node.facingHex}`;
  const queue=[first];
  const seen=new Set([nodeKey(first)]);
  const parents=new Map();
  let best=first;
  let bestScore=score ? score({...mover,...first}) : Infinity;
  let value=null;
  for(let cursor=0;cursor<queue.length && cursor<24000;cursor++){
    const current=queue[cursor];
    const proxy={...mover,...current};
    const match=goal?.(proxy);
    if(match){ best=current; value=match; break; }
    if(score){
      const distance=score(proxy);
      if(distance<bestScore){ bestScore=distance; best=current; }
    }
    if(current.steps>=maxSteps) continue;
    for(let facing=0;facing<HEX_DIRS.length;facing++){
      const dir=HEX_DIRS[facing];
      const next={x:current.x+dir.x,y:current.y+dir.y,facingHex:facing,steps:current.steps+1};
      const id=nodeKey(next);
      if(seen.has(id) || unitTransitionBlocked(mover,current,next,facing)) continue;
      seen.add(id);
      parents.set(id,current);
      queue.push(next);
    }
  }
  const path=[];
  for(let current=best;current;current=parents.get(nodeKey(current))){
    path.push({x:current.x,y:current.y,facingHex:current.facingHex});
  }
  return {path:path.reverse(),value};
}

function pathToAdjacent(start,target,mover){
  if(mover && unitFootprintDefinition(mover).rotates){
    return searchRotatingFootprintPath(mover,start,{goal:proxy=>canMeleeReach(proxy,target)}).path;
  }
  if(canMeleeReach(start,target)){
    return [{x:start.x,y:start.y}];
  }

  const queue=[{x:start.x,y:start.y}];
  const came=new Map();
  const seen=new Set([key(start.x,start.y)]);

  let end=null;
  let guard=0;

  while(queue.length && guard<3000){
    guard++;
    const cur=queue.shift();
    const curMover=mover ? {...mover,x:cur.x,y:cur.y} : cur;

    if(canMeleeReach(curMover,target)){
      end=cur;
      break;
    }

    const dirs=[...HEX_DIRS].sort((a,b)=>{
      if(mover){
        const da=unitDistanceAt(mover,cur.x+a.x,cur.y+a.y,target);
        const db=unitDistanceAt(mover,cur.x+b.x,cur.y+b.y,target);
        return da-db;
      }

      const da=hexDistance({x:cur.x+a.x,y:cur.y+a.y},target);
      const db=hexDistance({x:cur.x+b.x,y:cur.y+b.y},target);
      return da-db;
    });

    for(const dir of dirs){
      const nx=cur.x+dir.x;
      const ny=cur.y+dir.y;
      const k=key(nx,ny);
      const next={x:nx,y:ny};

      if(seen.has(k)) continue;
      if(mover && unitTransitionBlocked(mover,cur,next)) continue;
      if(!passableForPath(nx,ny,mover,target)) continue;

      seen.add(k);
      came.set(k,cur);
      queue.push(next);
    }
  }

  if(!end){
    return [{x:start.x,y:start.y}];
  }

  const path=[];
  let cur=end;

  while(cur){
    path.push(cur);
    const prev=came.get(key(cur.x,cur.y));
    if(!prev) break;
    cur=prev;
  }

  path.reverse();
  return path;
}

function mobPathToPartyTarget(mob,target){
  if(!mob || !target) return null;

  if(canMeleeReach(mob,target)){
    return [{x:mob.x,y:mob.y}];
  }

  const path=pathToAdjacent(mob,target,mob);

  return path && path.length>1
    ? path
    : null;
}

function pathToHex(start,target,mover){
  if(mover && unitFootprintDefinition(mover).rotates){
    return searchRotatingFootprintPath(mover,start,{goal:proxy=>proxy.x===target.x && proxy.y===target.y}).path;
  }
  if(start.x===target.x && start.y===target.y){
    return [{x:start.x,y:start.y}];
  }

  if(mover && !canUnitStandAt(mover,target.x,target.y)){
    return [{x:start.x,y:start.y}];
  }

  if(!mover && occupiedByAnyUnit(target.x,target.y,null)){
    return [{x:start.x,y:start.y}];
  }

  const queue=[{x:start.x,y:start.y}];
  const came=new Map();
  const seen=new Set([key(start.x,start.y)]);

  let end=null;
  let guard=0;

  while(queue.length && guard<4000){
    guard++;
    const cur=queue.shift();

    if(cur.x===target.x && cur.y===target.y){
      end=cur;
      break;
    }

    const dirs=[...HEX_DIRS].sort((a,b)=>{
      const da=hexDistance(
        {x:cur.x+a.x,y:cur.y+a.y},
        target
      );
      const db=hexDistance(
        {x:cur.x+b.x,y:cur.y+b.y},
        target
      );
      return da-db;
    });

    for(const dir of dirs){
      const nx=cur.x+dir.x;
      const ny=cur.y+dir.y;
      const nk=key(nx,ny);
      const next={x:nx,y:ny};

      if(seen.has(nk)) continue;

      if(mover){
        if(unitTransitionBlocked(mover,cur,next)) continue;
      }else{
        if(isWall(nx,ny)) continue;
        if(architecturalWallBlocksStep(cur,next)) continue;
        if(occupiedByAnyUnit(nx,ny,null)) continue;
      }

      seen.add(nk);
      came.set(nk,cur);
      queue.push(next);
    }
  }

  if(!end){
    return [{x:start.x,y:start.y}];
  }

  const path=[];
  let cur=end;

  while(cur){
    path.push(cur);
    const prev=came.get(key(cur.x,cur.y));
    if(!prev) break;
    cur=prev;
  }

  path.reverse();
  return path;
}

function pathToClosestReachable(start,target,mover,maxSteps){
  if(mover && unitFootprintDefinition(mover).rotates){
    return searchRotatingFootprintPath(mover,start,{
      score:proxy=>approachDistanceAt(proxy,proxy.x,proxy.y,target),maxSteps
    }).path;
  }
  const startNode={
    x:start.x,
    y:start.y,
    steps:0
  };

  const queue=[startNode];
  const came=new Map();
  const seen=new Set([key(start.x,start.y)]);

  let best=startNode;
  let bestDistance=mover
    ? approachDistanceAt(mover,startNode.x,startNode.y,target)
    : hexDistance(startNode,target);

  while(queue.length){
    const cur=queue.shift();

    if(cur.steps>=maxSteps) continue;

    const dirs=[...HEX_DIRS].sort((a,b)=>{
      const da=mover
        ? approachDistanceAt(mover,cur.x+a.x,cur.y+a.y,target)
        : hexDistance({x:cur.x+a.x,y:cur.y+a.y},target);
      const db=mover
        ? approachDistanceAt(mover,cur.x+b.x,cur.y+b.y,target)
        : hexDistance({x:cur.x+b.x,y:cur.y+b.y},target);
      return da-db;
    });

    for(const dir of dirs){
      const nx=cur.x+dir.x;
      const ny=cur.y+dir.y;
      const nk=key(nx,ny);
      const next={x:nx,y:ny};

      if(seen.has(nk)) continue;

      if(mover){
        if(unitTransitionBlocked(mover,cur,next)) continue;
      }else{
        if(isWall(nx,ny)) continue;
        if(architecturalWallBlocksStep(cur,next)) continue;
        if(occupiedByAnyUnit(nx,ny,null)) continue;
      }

      const steps=cur.steps+1;
      const node={x:nx,y:ny,steps};

      seen.add(nk);
      came.set(nk,{x:cur.x,y:cur.y});
      queue.push(node);

      const distance=mover
        ? approachDistanceAt(mover,nx,ny,target)
        : hexDistance(node,target);

      if(
        distance<bestDistance ||
        (
          distance===bestDistance &&
          best.steps===0 &&
          steps>0
        ) ||
        (
          distance===bestDistance &&
          best.steps>0 &&
          steps<best.steps
        )
      ){
        best=node;
        bestDistance=distance;
      }
    }
  }

  if(best.x===start.x && best.y===start.y){
    return [{x:start.x,y:start.y}];
  }

  const path=[];
  let cur={x:best.x,y:best.y};

  while(cur){
    path.push(cur);

    if(cur.x===start.x && cur.y===start.y){
      break;
    }

    cur=came.get(key(cur.x,cur.y)) || null;
  }

  path.reverse();
  return path;
}

function clickPathStep(targetHex){
  const p=activePlayerControlledUnit();
  if(game?.over || !p || game?.active!==p.id || !p.alive || aimMode || isCombatActionPauseActive()) return;

  if(targetHex.x===p.x && targetHex.y===p.y) return;
  const clickedEnemy=enemyAtHex(targetHex.x,targetHex.y);
  let path;

  if(clickedEnemy){
    if(canMeleeReach(p,clickedEnemy)){
      const contact=occupiedHexes(clickedEnemy).find(cell=>
        hexDistance(p,cell)===1 &&
        !architecturalWallBlocksStep(p,cell)
      );

      if(contact){
        tryPlayerMove(contact.x-p.x,contact.y-p.y);
      }
      return;
    }
    path=pathToAdjacent(p,clickedEnemy,p);
  }else{
    path=pathToHex(p,targetHex,p);
  }

  if(!path || path.length<2){ log("No path to that hex.","system"); return; }
  const next=path[1];
  const dx=next.x-p.x;
  const dy=next.y-p.y;
  if(!HEX_DIRS.some(dir=>dir.x===dx && dir.y===dy)){
    log("Pathfinding could not produce a legal next step.","system");
    return;
  }
  tryPlayerMove(dx,dy);
}

function fleeStep(unit,threat){
  /*
    R72 fleeing:
    reaching an edge is not enough. A unit escapes only when it has
    another movement point and attempts to step from an edge hex to
    an out-of-bounds coordinate.
  */
  if(isMapEdgeHex(unit.x,unit.y)){
    const escapeOptions=HEX_DIRS
      .map(dir=>({
        x:unit.x+dir.x,
        y:unit.y+dir.y,
        escape:true
      }))
      .filter(pos=>!inside(pos.x,pos.y))
      .map(pos=>({
        ...pos,
        distance:threat
          ? hexDistance(pos,threat)
          : 0
      }))
      .sort((a,b)=>
        b.distance-a.distance ||
        a.x-b.x ||
        a.y-b.y
      );

    if(escapeOptions.length){
      return escapeOptions[0];
    }
  }

  const options=HEX_DIRS
    .map(dir=>({
      x:unit.x+dir.x,
      y:unit.y+dir.y
    }))
    .filter(pos=>
      inside(pos.x,pos.y) &&
      !unitTransitionBlocked(unit,unit,pos)
    )
    .map(pos=>({
      ...pos,
      distance:threat
        ? unitDistanceAt(unit,pos.x,pos.y,threat)
        : 0
    }));

  options.sort((a,b)=>
    b.distance-a.distance ||
    a.x-b.x ||
    a.y-b.y
  );

  return options[0] || null;
}

async function animateEntitySteps(entity,steps,stepProvider,delay=145){
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
      /*
        The edge-crossing attempt is itself leaving a threatened hex,
        so resolve free strikes before the unit disappears.
      */
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
        showActivityDetectedFx(entity,Math.max(280,delay+120));
        refreshTurnBanner();
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

    if(!next.escape && unitTransitionBlocked(entity,entity,next)){
      return false;
    }

    const canLeave=await performLeavingHexFreeAttacks(
      entity,
      next
    );

    if(!canLeave){
      return false;
    }

    // Reactions can rotate another multi-hex creature into the planned path.
    if(unitTransitionBlocked(entity,entity,next)) return false;
    const mode=mobMovementPresentationMode(entity,next,senseContext);

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
      showActivityDetectedFx(entity,Math.max(280,delay+120));
      refreshTurnBanner();
      playMoveSound();
      draw();
    }
    /* mode === "silent": state advances immediately with no camera, sound, draw, or delay. */

    const areaResult=await resolvePersistentAreaMovementStep(entity);
    if(areaResult.haltMovement){
      return false;
    }

    if(entity.controller==="mob" && await maybeTriggerPlayerGuard(entity)){
      await sleep(Math.max(240,combatActionPauseRemaining()));

      if(game.over || !entity.alive){
        return false;
      }
    }

    /*
      R209: MOB Guard reactions are allegiance-driven. This is normally a
      no-op for enemy-on-enemy movement, but lets former allies react when a
      charmed MOB enters their Guard range (and vice versa).
    */
    if(entity.controller==="mob"){
      await triggerMobGuardsAgainst(entity);
      if(game.over || !entity.alive){
        return false;
      }
    }

    if(mode!=="silent"){
      await sleep(delay);
    }
  }

  return true;
}

async function animateMobAlongPath(mob,path,maxSteps){
  const steps=Math.min(maxSteps,Math.max(0,path.length-1));
  const senseContext=createHiddenMobMovementSenseContext();

  for(let i=1;i<=steps;i++){
    if(game.over || !mob.alive || mob.fled) return false;

    if(unitTransitionBlocked(mob,mob,path[i])) return false;

    const canLeave=await performLeavingHexFreeAttacks(
      mob,
      path[i]
    );

    if(!canLeave){
      return false;
    }

    // Reactions can rotate another multi-hex creature into the planned path.
    if(unitTransitionBlocked(mob,mob,path[i])) return false;
    const mode=mobMovementPresentationMode(mob,path[i],senseContext);

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
    /* mode === "silent": consume hidden steps immediately and invisibly. */

    const areaResult=await resolvePersistentAreaMovementStep(mob);
    if(areaResult.haltMovement){
      return false;
    }

    if(await maybeTriggerPlayerGuard(mob)){
      await sleep(Math.max(240,combatActionPauseRemaining()));

      if(game.over) return false;
      if(!mob.alive) return false;
    }

    await triggerMobGuardsAgainst(mob);
    if(game.over || !mob.alive) return false;

    if(mode!=="silent"){
      await sleep(105);
    }
  }

  return true;
}

function rangedRetreatStep(unit,threat){
  const options=HEX_DIRS
    .map(dir=>({x:unit.x+dir.x,y:unit.y+dir.y}))
    .filter(pos=>
      inside(pos.x,pos.y) &&
      !unitTransitionBlocked(unit,unit,pos)
    )
    .map(pos=>({
      ...pos,
      distance:threat ? unitDistanceAt(unit,pos.x,pos.y,threat) : 0
    }))
    .sort((a,b)=>b.distance-a.distance || a.x-b.x || a.y-b.y);
  return options[0] || null;
}
