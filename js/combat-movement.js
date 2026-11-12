// Tactical selection is contextual; movement remains authoritative on integer hexes.
let clickMovementRunning=false;
function combatManualTurnActive(){
 const p=activePlayerControlledUnit();
 return !!(game&&!game.over&&game.round>0&&p?.alive&&!p.fled&&game.active===p.id&&!isQuickCommandUnit(p)&&!quickCommandRunning);
}
function combatMovementSelectionActive(){
 const p=activePlayerControlledUnit();
 return !!(combatManualTurnActive()&&hoverHex&&!aimMode&&!clickMovementRunning&&!p.walkPresentation&&!isCombatActionPauseActive());
}
function combatTacticalGridVisible(){return combatManualTurnActive()&&(!!(aimMode&&!pendingAimAction?.targetSubmitted)||combatMovementSelectionActive());}
function combatReachableMovement(unit){
 const budget=Math.max(0,Math.floor((unit.move||0)-(unit.turnMoves||0)));
 const signature=[unit.id,unit.x,unit.y,unit.facingHex,budget,...allUnits().map(u=>[u.id,u.x,u.y,u.facingHex,u.alive,u.fled].join(':'))].join('|');
 const cache=combatReachableMovement.cache;
 if(cache&&cache.game===game&&cache.signature===signature&&cache.walls===architecturalWalls)return cache.cells;
 const start={x:unit.x,y:unit.y,facingHex:facingDirectionIndex(unit),steps:0,parent:null},queue=[start],cells=new Map(),seen=new Set();
 const rotates=unitFootprintDefinition(unit).rotates;
 for(let i=0;i<queue.length&&i<24000;i++){
  const node=queue[i],id=key(node.x,node.y);if(!cells.has(id))cells.set(id,node);
  if(node.steps>=budget)continue;
  for(let facing=0;facing<HEX_DIRS.length;facing++){
   const d=HEX_DIRS[facing],next={x:node.x+d.x,y:node.y+d.y,facingHex:rotates?facing:node.facingHex,steps:node.steps+1,parent:node};
   const state=key(next.x,next.y)+':'+next.facingHex;
   if(seen.has(state)||unitTransitionBlocked(unit,node,next,next.facingHex))continue;
   seen.add(state);queue.push(next);
  }
 }
 combatReachableMovement.cache={game,signature,walls:architecturalWalls,cells};return cells;
}
function roundedMovementHex(p){
 let x=Math.round(p.x),y=Math.round(p.y),z=Math.round(-p.x-p.y);
 const a=Math.abs(x-p.x),b=Math.abs(y-p.y),c=Math.abs(z+p.x+p.y);
 if(a>b&&a>c)x=-y-z;else if(b>c)y=-x-z;return {x,y};
}
function sampleCombatWalkCurve(c,t){
 const u=1-t;return {x:u*u*u*c[0].x+3*u*u*t*c[1].x+3*u*t*t*c[2].x+t*t*t*c[3].x,y:u*u*u*c[0].y+3*u*u*t*c[1].y+3*u*t*t*c[2].y+t*t*t*c[3].y};
}
function combatWalkCurveClear(unit,curve,facing){
 // Sweep a small body disk for every occupied footprint cell. Sample in the
 // uncompressed ground plane; also test wall crossings between samples.
 const offsets=footprintOffsetsForFacing(unit,facing),radius=.23;
 let previous=null;
 for(let i=0;i<=24;i++){
  const p=sampleCombatWalkCurve(curve,i/24);
  for(const o of offsets)for(let k=0;k<9;k++){
   const angle=k*Math.PI/4,dy=k===8?0:Math.sin(angle)*radius/.8660254,dx=k===8?0:Math.cos(angle)*radius-dy/2;
   const q={x:p.x+o.x+dx,y:p.y+o.y+dy},cell=roundedMovementHex(q);
   if(!inside(cell.x,cell.y)||isWall(cell.x,cell.y)||isFirBlockedHex(cell.x,cell.y)||occupiedByAnyUnit(cell.x,cell.y,unit.id))return false;
   if(architecturalWallBlocksWorldLine(worldPointForHex(p.x+o.x,p.y+o.y),worldPointForHex(q.x,q.y),'movement'))return false;
   if(previous&&architecturalWallBlocksWorldLine(worldPointForHex(previous.x+o.x+dx,previous.y+o.y+dy),worldPointForHex(q.x,q.y),'movement'))return false;
  }
  previous=p;
 }
 return true;
}
function prepareCombatWalkPath(unit,path,maxSteps=path.length-1){
 const route=path.slice(0,Math.max(0,maxSteps)+1).map(p=>({...p}));
 if(route.length<2)return route;
 // Rounding is conservative for rotating large footprints: preserve their
 // validated turn locations until a continuous turning footprint is available.
 const rotating=unitFootprintDefinition(unit).rotates;
 for(const strength of (rotating?[0]:[.18,.09,0])){
  const points=route.map((p,i)=>i&&i<route.length-1?{x:p.x+strength*(route[i-1].x+route[i+1].x-2*p.x),y:p.y+strength*(route[i-1].y+route[i+1].y-2*p.y)}:{x:p.x,y:p.y});
  let clear=true;
  for(let i=1;i<route.length;i++){
   const a=points[i-1],b=points[i],prev=points[Math.max(0,i-2)],next=points[Math.min(points.length-1,i+1)];
   const c=strength?[a,{x:a.x+(b.x-prev.x)/6,y:a.y+(b.y-prev.y)/6},{x:b.x-(next.x-a.x)/6,y:b.y-(next.y-a.y)/6},b]:[a,{x:a.x+(b.x-a.x)/3,y:a.y+(b.y-a.y)/3},{x:a.x+2*(b.x-a.x)/3,y:a.y+2*(b.y-a.y)/3},b];
   route[i].walkCurve=c;
   if(strength&&!combatWalkCurveClear(unit,c,route[i].facingHex??facingDirectionIndex(unit))){clear=false;break;}
  }
  if(clear)return route;
 }
 return route;
}

function prepareCombatReactiveWalkStep(unit,next,more){
 if(next.walkCurve)return next;
 const m=unit.walkPresentation,t=m?.t||0;
 const start=m?{x:m.from.x+(m.to.x-m.from.x)*t,y:m.from.y+(m.to.y-m.from.y)*t}:{x:unit.x,y:unit.y};
 const dx=next.x-unit.x,dy=next.y-unit.y;
 for(const amount of (unitFootprintDefinition(unit).rotates?[0]:[.08,0])){
  const end={x:next.x+(more?-dy*amount:0),y:next.y+(more?dx*amount:0)};
  const curve=[start,{x:start.x+(end.x-start.x)/3,y:start.y+(end.y-start.y)/3},{x:start.x+(end.x-start.x)*2/3,y:start.y+(end.y-start.y)*2/3},end];
  if(combatWalkCurveClear(unit,curve,facingDirectionIndex(unit)))return {...next,walkCurve:curve};
 }
 return next;
}

// Reversible walk experiment: ?walkTest=1. Rules remain integer-hex based.
async function presentWalkTestStep(unit,to,keepPose=false){
  if(new URLSearchParams(location.search).get('walkTest')==='0')return true;
  const session=game,now=performance.now(),duration=650;
  const chain=unit.walkStepClock;
  // Carry scheduler overshoot across adjacent steps instead of restarting at t=0.
  // A reaction/other real pause starts a fresh segment, never a catch-up jump.
  const continuing=keepPose && chain && chain.session===session &&
    chain.x===unit.x && chain.y===unit.y && now-chain.completedAt<80;
  const started=continuing ? chain.deadline : now;
  const previous=unit.walkCycleSeconds||0;
  let curve=to.walkCurve;
  if(curve&&!combatWalkCurveClear(unit,curve,facingDirectionIndex(unit)))curve=null;
  globalThis.adventurePartyWalkBusy=true;
  try{
    while(game===session&&!game.over&&unit.alive&&!unit.fled){
      const elapsed=Math.min(duration,Math.max(0,performance.now()-started));
      const t=elapsed/duration,point=curve?sampleCombatWalkCurve(curve,t):null;
      unit.walkPresentation={from:point||{x:unit.x,y:unit.y},to:point||{x:to.x,y:to.y},t,seconds:previous+elapsed/1000};
      // Intermediate centers are rule checkpoints, not extra held render frames.
      if(keepPose && elapsed>=duration)break;
      await presentCombatFrame();
      if(elapsed>=duration)break;
    }
    unit.walkCycleSeconds=previous+duration/1000;
    if(keepPose)unit.walkStepClock={session,x:to.x,y:to.y,deadline:started+duration,completedAt:performance.now()};
    return game===session&&!game.over&&unit.alive&&!unit.fled;
  }finally{if(!keepPose){delete unit.walkPresentation;delete unit.walkStepClock;}globalThis.adventurePartyWalkBusy=false;}
}

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

  path=prepareCombatWalkPath(unit,path,steps);
  let index=1;
  await animateEntitySteps(
    unit,
    steps,
    ()=>path[index++] || null,
    105
  );

  return steps;
}

// Held keyboard movement uses the same continuous segment clock as AI paths.
let heldCombatMove=null,keyboardCombatMoveRunning=false;
async function beginKeyboardCombatMove(code,dx,dy){
  if(clickMovementRunning)return;
  heldCombatMove={code,dx,dy};
  if(keyboardCombatMoveRunning)return;
  const unit=activePlayerControlledUnit(),session=game;
  if(!unit)return;
  keyboardCombatMoveRunning=true;
  try{
    while(heldCombatMove && game===session && !game.over && game.active===unit.id && unit.alive){
      const direction=heldCombatMove,x=unit.x,y=unit.y;
      await tryPlayerMove(direction.dx,direction.dy,{continuous:true});
      if(unit.x===x && unit.y===y)break;
    }
  }finally{
    heldCombatMove=null;keyboardCombatMoveRunning=false;
    delete unit.walkPresentation;delete unit.walkStepClock;
    draw();
  }
}
function releaseKeyboardCombatMove(code){if(!code || heldCombatMove?.code===code)heldCombatMove=null;}

async function tryPlayerMove(dx,dy,{continuous=false,walkCurve=null}={}){
  const p=activePlayerControlledUnit();
  if(
    game.over || !p || game.active!==p.id || !p.alive || (p.walkPresentation && !continuous) ||
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
  if(!await presentWalkTestStep(p,{x:nx,y:ny,walkCurve},continuous))return;
  if(!p.alive||game.over)return;
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

async function clickPathStep(targetHex){
 const p=activePlayerControlledUnit(),session=game;
 if(game?.over||!p||game.active!==p.id||!p.alive||aimMode||clickMovementRunning||p.walkPresentation||isCombatActionPauseActive())return;
 const enemy=enemyAtHex(targetHex.x,targetHex.y);
 if(enemy&&canMeleeReach(p,enemy)){
  const contact=occupiedHexes(enemy).find(c=>hexDistance(p,c)===1&&!architecturalWallBlocksStep(p,c));
  if(contact)await tryPlayerMove(contact.x-p.x,contact.y-p.y);return;
 }
 // Use exactly the same bounded search as the green movement overlay.
 combatReachableMovement.cache=null;
 const node=combatReachableMovement(p).get(key(targetHex.x,targetHex.y));
 if(!node||!node.steps){if(!node)log('That destination is outside your available movement or blocked.','system');return;}
 const path=[];for(let n=node;n;n=n.parent)path.push({x:n.x,y:n.y,facingHex:n.facingHex});path.reverse();
 const route=prepareCombatWalkPath(p,path);
 clickMovementRunning=true;
 try{
  for(const next of route.slice(1)){
   if(game!==session||game.over||game.active!==p.id||!p.alive||p.fled||aimMode)break;
   if(unitTransitionBlocked(p,p,next,next.facingHex))break;
   const x=p.x,y=p.y;
   await tryPlayerMove(next.x-x,next.y-y,{continuous:true,walkCurve:next.walkCurve});
   if(p.x!==next.x||p.y!==next.y)break;
  }
 }finally{clickMovementRunning=false;delete p.walkPresentation;delete p.walkStepClock;combatReachableMovement.cache=null;draw();}
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
  try{
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

    if(mode==='visible'&&!await presentWalkTestStep(entity,prepareCombatReactiveWalkStep(entity,next,i<steps-1),true))return false;
    if(!entity.alive||game.over)return false;
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

    // No extra NPC inter-hex pause.
  }

  return true;
}finally{delete entity.walkPresentation;delete entity.walkStepClock;}
}

async function animateMobAlongPath(mob,path,maxSteps){
  path=prepareCombatWalkPath(mob,path,maxSteps);
  try{
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

    if(mode==='visible'&&!await presentWalkTestStep(mob,path[i],true))return false;
    if(!mob.alive||game.over)return false;
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

    // No extra NPC inter-hex pause.
  }

  return true;
}finally{delete mob.walkPresentation;delete mob.walkStepClock;}
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
