/* Combat owner: combat-targeting.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

function spellRangeHexes(spell,casterLevel){
  const level=Math.max(1,Number(casterLevel)||1);

  if(spell?.range?.type==="touch") return 1;
  if(spell?.range?.type==="self") return 0;

  if(Number.isFinite(spell?.range?.fixedHexes)){
    return Math.max(0,Math.floor(spell.range.fixedHexes));
  }

  if(Number.isFinite(spell?.range?.fixedFeet)){
    return Math.max(
      0,
      Math.floor(spell.range.fixedFeet/TACTICAL_FEET_PER_HEX)
    );
  }

  if(Number.isFinite(spell?.range?.fixedYards)){
    return yardsToTacticalHexes(spell.range.fixedYards);
  }

  if(
    Number.isFinite(spell?.range?.baseYards) &&
    Number.isFinite(spell?.range?.yardsPerCasterLevel)
  ){
    return yardsToTacticalHexes(
      spell.range.baseYards+
      spell.range.yardsPerCasterLevel*level
    );
  }

  return 0;
}

function unitsWithinHexRadius(center,radius){
  return allUnits()
    .filter(unit=>
      unit.alive &&
      !unit.fled &&
      hexDistance(unit,center)<=radius
    );
}

function directionVectorForAim(caster,targetHex){
  const from=hexCenter(caster.x,caster.y);
  const to=hexCenter(targetHex.x,targetHex.y);

  return {
    x:to.x-from.x,
    y:to.y-from.y
  };
}

function unitsInDirectionalWedge(caster,targetHex,maxDistance,halfAngleRadians=Math.PI/3){
  const aim=directionVectorForAim(caster,targetHex);
  const aimLen=Math.hypot(aim.x,aim.y);

  if(aimLen<0.001) return [];

  return allUnits()
    .filter(unit=>
      unit.id!==caster.id &&
      unit.alive &&
      !unit.fled &&
      hexDistance(caster,unit)<=maxDistance
    )
    .map(unit=>{
      const from=hexCenter(caster.x,caster.y);
      const to=hexCenter(unit.x,unit.y);
      const vx=to.x-from.x;
      const vy=to.y-from.y;
      const len=Math.hypot(vx,vy) || 1;
      const dot=(aim.x*vx+aim.y*vy)/(aimLen*len);
      const angle=Math.acos(Math.max(-1,Math.min(1,dot)));

      return {
        unit,
        distance:hexDistance(caster,unit),
        angle
      };
    })
    .filter(entry=>entry.angle<=halfAngleRadians)
    .sort((a,b)=>
      a.distance-b.distance ||
      a.angle-b.angle ||
      a.unit.id.localeCompare(b.unit.id)
    )
    .map(entry=>entry.unit);
}

function hexesWithinRadius(center,radius){
  const cells=[];

  for(let x=center.x-radius;x<=center.x+radius;x++){
    for(let y=center.y-radius;y<=center.y+radius;y++){
      if(
        inside(x,y) &&
        hexDistance({x,y},center)<=radius
      ){
        cells.push({x,y});
      }
    }
  }

  return cells;
}

function directionalWedgeCells(caster,targetHex,maxDistance,halfAngleRadians=Math.PI/3){
  const aim=directionVectorForAim(caster,targetHex);
  const aimLen=Math.hypot(aim.x,aim.y);

  if(aimLen<0.001){
    return [];
  }

  const from=hexCenter(caster.x,caster.y);
  const cells=[];

  for(let x=caster.x-maxDistance;x<=caster.x+maxDistance;x++){
    for(let y=caster.y-maxDistance;y<=caster.y+maxDistance;y++){
      if(
        !inside(x,y) ||
        (x===caster.x && y===caster.y) ||
        hexDistance(caster,{x,y})>maxDistance
      ){
        continue;
      }

      const to=hexCenter(x,y);
      const vx=to.x-from.x;
      const vy=to.y-from.y;
      const len=Math.hypot(vx,vy) || 1;
      const dot=(aim.x*vx+aim.y*vy)/(aimLen*len);
      const angle=Math.acos(Math.max(-1,Math.min(1,dot)));

      if(angle<=halfAngleRadians){
        cells.push({
          x,
          y,
          distance:hexDistance(caster,{x,y}),
          angle
        });
      }
    }
  }

  cells.sort((a,b)=>
    a.distance-b.distance ||
    a.angle-b.angle ||
    a.x-b.x ||
    a.y-b.y
  );

  return cells.map(({x,y})=>({x,y}));
}

function livingUnitsInAreaCells(cells){
  const cellKeys=new Set(
    (cells || []).map(cell=>key(cell.x,cell.y))
  );

  /*
    R186: a multi-hex unit is included once when ANY occupied cell intersects
    the area. Several covered body hexes never multiply damage or saving throws.
  */
  return allUnits().filter(unit=>
    unit?.alive &&
    !unit.fled &&
    occupiedHexes(unit).some(cell=>cellKeys.has(key(cell.x,cell.y)))
  );
}

function aimAreaPreviewForAction(action,targetHex){
  if(!action?.spellId || !targetHex || !game?.player){
    return null;
  }

  const spell=getSpellEntry(action.spellId);
  if(!spell){
    return null;
  }

  const caster=spellCasterForAction(action) || activeUnit() || game.player;
  const casterLevel=Math.max(
    1,
    action.casterLevel || TEST_SPELL_CASTER_LEVEL
  );

  let cells=[];
  let tone="control";
  let dangerous=false;

  switch(spell.id){
    case "fireball":
      cells=fireballBlastCells(targetHex);
      tone="damage";
      dangerous=true;
      break;

    case "burning-hands":
      cells=directionalWedgeCells(
        caster,
        targetHex,
        1,
        Math.PI/3
      );
      tone="damage";
      dangerous=true;
      break;

    case "color-spray":
      cells=directionalWedgeCells(
        caster,
        targetHex,
        2,
        Math.PI/3
      );
      tone="control";
      break;

    case "grease":
      cells=inside(targetHex.x,targetHex.y)
        ? [{x:targetHex.x,y:targetHex.y}]
        : [];
      tone="terrain";
      break;

    case "sleep":
      /* R94: fixed symmetric seven-hex footprint: center + six adjacent. */
      cells=hexesWithinRadius(targetHex,1);
      tone="control";
      break;

    case "taunt":
      cells=hexesWithinRadius(targetHex,3);
      tone="control";
      break;

    case "wall-of-fog":
      cells=createWallOfFogCells(
        caster,
        targetHex,
        casterLevel,
        action.wallOfFogOrientationIndex
      ).filter(cell=>inside(cell.x,cell.y));
      tone="fog";
      break;

    default:
      return null;
  }

  const friendlies=dangerous
    ? livingUnitsInAreaCells(cells)
        .filter(unit=>unit.faction===caster.faction)
    : [];

  return {
    spell,
    cells,
    tone,
    dangerous,
    friendlyFireCount:friendlies.length
  };
}

function controlledUnitCanAct(unit=activePlayerControlledUnit()){
  return !!(
    unit &&
    game &&
    !game.over &&
    game.active===unit.id &&
    unit.alive &&
    !unit.fled
  );
}

function moveAimCursor(dx,dy){
  if(!aimMode) return;

  const nx=aimCursor.x+dx;
  const ny=aimCursor.y+dy;

  if(!inside(nx,ny)){
    return;
  }

  aimCursor.x=nx;
  aimCursor.y=ny;

  maybeRecenterCamera(aimCursor);
  updateUi();
  draw();
}

function validCreatureTargetWithinRange(caster,target,spell,casterLevel,allowFriendly=true){
  if(!caster || !target || !target.alive) return false;

  if(!allowFriendly && target.faction===caster.faction){
    return false;
  }

  const range=spellRangeHexes(spell,casterLevel);
  return unitDistance(caster,target)<=range;
}

async function resolveAimAction(){
  if(!aimMode || !game || game.over || pendingAimAction?.targetSubmitted) return false;

  const target=unitAtHex(aimCursor.x,aimCursor.y);

  if(pendingAimAction){
    const action={...pendingAimAction};
    const spell=getSpellEntry(action.spellId);

    if(!spell){
      return false;
    }

    if(
      ["hostile-creature","adjacent-hostile"].includes(spell.targetMode) &&
      (!target || target.faction===game.player.faction)
    ){
      setCombatMessage(`${spell.name} requires a hostile creature target.`);
      return false;
    }

    if(
      ["creature","touch-creature"].includes(spell.targetMode) &&
      !target
    ){
      setCombatMessage(`${spell.name} requires a creature target.`);
      return false;
    }

    // Hide targeting immediately, before asynchronous framing and casting.
    const submittedAction=pendingAimAction;
    const targetHex={x:aimCursor.x,y:aimCursor.y};
    submittedAction.targetSubmitted=true;
    draw();
    try{
      return await castPreparedCombatSpell(action,targetHex,target);
    }finally{
      // Rejected targets retain AIM so the player can choose again.
      if(pendingAimAction===submittedAction){
        delete submittedAction.targetSubmitted;
        draw();
      }
    }
  }

  const actor=activePlayerControlledUnit();
  if(
    actor &&
    target &&
    target.faction!==actor.faction &&
    target.alive &&
    canMeleeReach(actor,target)
  ){
    const contact=occupiedHexes(target).find(cell=>
      hexDistance(actor,cell)===1 &&
      !architecturalWallBlocksStep(actor,cell)
    );

    if(contact){
      exitAimMode(false,false);
      await tryPlayerMove(
        contact.x-actor.x,
        contact.y-actor.y
      );
      return true;
    }
  }

  updateUi();
  draw();
  return false;
}
