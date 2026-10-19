/* ============================================================
   RADIUS INVISIBILITY
   ============================================================ */

function r226CleanupRadiusInvisibility(){
  if(!game) return;
  for(const unit of allUnits()){
    const invis=getUnitEffect(unit,"invisibility");
    const sourceId=invis?.data?.radiusSourceUnitId;
    if(!sourceId || unit.id===sourceId) continue;
    const source=getUnitById(sourceId);
    if(!source?.alive || source.fled || unitDistance(source,unit)>1){
      removeUnitEffect(unit,"invisibility");
      log(`${unit.name} leaves the Invisibility 10' Radius and becomes visible.`,"system");
    }
  }
}

const r226BaseBreakInvisibility=breakInvisibility;
breakInvisibility=function(unit,reason="hostile action"){
  const invis=getUnitEffect(unit,"invisibility");
  const radiusSourceId=invis?.data?.radiusSourceUnitId;

  if(radiusSourceId && unit?.id===radiusSourceId){
    const recipients=allUnits().filter(other=>
      getUnitEffect(other,"invisibility")?.data?.radiusSourceUnitId===radiusSourceId
    );
    let any=false;
    for(const recipient of recipients){
      any=removeUnitEffect(recipient,"invisibility") || any;
    }
    removeUnitEffect(unit,"invisibility-10-radius");
    if(any) log(`${unit.name}'s hostile action collapses the shared Invisibility 10' Radius.`,"system");
    return any;
  }

  return r226BaseBreakInvisibility(unit,reason);
};


/* ============================================================
   LEVEL 3 CAST RESOLUTION
   ============================================================ */

async function r226CastBlink(action){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("blink");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action)) return await finishFailedSpellCommit(caster,action);
  pendingAimAction=null;
  exitAimMode(false,false);

  addUnitEffect(caster,{
    id:"blink",name:"Blink",kind:"buff",expiresRound:game.round+level,
    detail:"Randomly shifts 1 hex at the start of each turn",
    data:{sourceUnitId:caster.id,casterLevel:level,lastBlinkRound:null}
  });
  await animateMagicEffectOnUnits([caster],"generic");
  setCombatMessage(`${caster.name} begins blinking between the Prime and Ethereal planes.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function r226ResolveBlinkAtTurnStart(actor){
  const effect=getUnitEffect(actor,"blink");
  if(!effect || effect.data.lastBlinkRound===game.round) return false;
  effect.data.lastBlinkRound=game.round;

  const start=Math.max(0,d(6)-1);
  for(let offset=0;offset<6;offset++){
    const dir=HEX_DIRS[(start+offset)%6];
    const next={x:actor.x+dir.x,y:actor.y+dir.y};
    if(
      !inside(next.x,next.y) || isWall(next.x,next.y) ||
      architecturalWallBlocksStep(actor,next) || occupiedByAnyUnit(next.x,next.y,actor.id)
    ) continue;

    const from={x:actor.x,y:actor.y};
    actor.x=next.x;
    actor.y=next.y;
    updateFacingForStep(actor,dir.x,dir.y);
    maybeRecenterCamera(actor);
    setUnitActionBanner(actor,"Blink");
    setCombatMessage(`${actor.name} blinks from ${from.x},${from.y} to ${next.x},${next.y}.`,500,500);
    playMagicEffectSound("blink");
    draw();
    await sleep(140);
    return true;
  }

  log(`${actor.name}'s Blink finds no legal adjacent destination this round.`,"system");
  return false;
}

async function r226CastDispelMagic(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("dispel-magic");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Dispel Magic center is out of range.");
    return false;
  }
  if(lineOfSightBlockedBetweenHexes(caster,targetHex)){
    setCombatMessage("Line of sight is blocked to that hex.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action)) return await finishFailedSpellCommit(caster,action);
  pendingAimAction=null;
  exitAimMode(false,false);

  const cells=hexesWithinRadius(targetHex,1);
  const cellKeys=new Set(cells.map(cell=>key(cell.x,cell.y)));
  let dispelled=0;
  const touchedUnits=[];

  for(const unit of livingUnitsInAreaCells(cells)){
    let unitChanged=false;
    const effects=[...(unit.buffs||[]),...(unit.debuffs||[])];
    for(const effect of effects){
      if(!r226CanDispelUnitEffect(effect)) continue;
      const success=r226IsOwnMagic(caster,effect)
        ? true
        : r226DispelRoll(caster,r226CasterLevelForEffect(effect)).success;
      if(success && removeUnitEffect(unit,effect.id)){
        dispelled++;
        unitChanged=true;
        log(`Dispel Magic ends ${r226EffectDescription(effect)} on ${unit.name}.`,"system");
      }
    }
    if(unitChanged) touchedUnits.push(unit);
  }

  const retainedAreas=[];
  for(const effect of game.areaEffects || []){
    const overlaps=(effect.cells||[]).some(cell=>cellKeys.has(key(cell.x,cell.y)));
    if(!overlaps){ retainedAreas.push(effect); continue; }
    const success=r226IsOwnMagic(caster,effect)
      ? true
      : r226DispelRoll(caster,r226CasterLevelForEffect(effect)).success;
    if(success){
      dispelled++;
      log(`Dispel Magic ends ${r226EffectDescription(effect)}.`,"system");
    }else{
      retainedAreas.push(effect);
    }
  }
  game.areaEffects=retainedAreas;

  game.r226WindWalls=r226ActiveWindWalls().filter(wall=>{
    const overlaps=(wall.cells||[]).some(cell=>cellKeys.has(key(cell.x,cell.y)));
    if(!overlaps) return true;
    const success=r226IsOwnMagic(caster,wall)
      ? true
      : r226DispelRoll(caster,r226CasterLevelForEffect(wall)).success;
    if(success){ dispelled++; return false; }
    return true;
  });

  if(Array.isArray(game.hypnoticPatternVisuals)){
    game.hypnoticPatternVisuals=game.hypnoticPatternVisuals.filter(visual=>{
      const overlaps=(visual.cells||[]).some(cell=>cellKeys.has(key(cell.x,cell.y)));
      if(!overlaps) return true;
      const success=r226IsOwnMagic(caster,visual)
        ? true
        : r226DispelRoll(caster,r226CasterLevelForEffect(visual)).success;
      if(success){ dispelled++; return false; }
      return true;
    });
  }

  cleanupAreaBoundStatuses();
  r226CleanupRadiusInvisibility();
  if(touchedUnits.length) await animateMagicEffectOnUnits(touchedUnits,"generic");
  playMagicEffectSound("dispel");
  setCombatMessage(
    dispelled
      ? `Dispel Magic ends ${dispelled} magical effect${dispelled===1?"":"s"}.`
      : "Dispel Magic finds no effect it can end.",
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function r226CastFlameArrow(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("flame-arrow");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,false)){
    setCombatMessage("Flame Arrow requires a hostile creature within range.");
    return false;
  }
  if(projectilePathBlocked(caster,target)){
    setCombatMessage("Flame Arrow does not have a clear firing lane.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action)) return await finishFailedSpellCommit(caster,action);
  pendingAimAction=null;
  exitAimMode(false,false);
  setUnitActionBanner(caster,"Casting Flame Arrow");

  const bolts=Math.max(1,Math.floor(level/5));
  let hits=0;
  let totalDamage=0;

  for(let i=0;i<bolts && target.alive;i++){
    const raw=d(20);
    const thaco=Math.max(1,21-Math.ceil(level/3));
    const targetAC=effectiveArmorClassForAttack(caster,target,"small-device-missile");
    const targetNumber=thaco-targetAC;
    const modifier=attackEffectModifier(caster,target);
    const resolution=resolveMissileAttackD20(raw,targetNumber,modifier);
    playNaturalAttackRollSound(raw);
    await animateMagicMissile(caster,target,i,bolts);

    if(!resolution.hit){
      playMissSound();
      continue;
    }
    if(interceptWithMirrorImage(target,caster)){
      playMissSound();
      continue;
    }

    hits++;
    const piercing=d(6);
    const fireRoll=rollDiceExpression("4d6").total;
    const save=rollSpellSave(target,caster);
    const fire=unitImmuneToDamageType(target,"fire")
      ? 0
      : (save.success ? Math.floor(fireRoll/2) : fireRoll);
    const damage=piercing+fire;
    totalDamage+=damage;
    const result=applySpellDamage(caster,target,damage,"Flame Arrow","magic");
    if(fire>0) registerElementalDamageFx(target,"fire",fire);
    playAttackSound();
    if(result.killed) break;
  }

  setCombatMessage(
    hits
      ? `Flame Arrow: ${hits}/${bolts} bolt${bolts===1?"":"s"} hit for ${totalDamage} total damage.`
      : `Flame Arrow: ${bolts} fiery bolt${bolts===1?"":"s"} miss.`,
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

