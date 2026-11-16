async function r226CastGustOfWind(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("gust-of-wind");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;
  if(!targetHex || (targetHex.x===caster.x && targetHex.y===caster.y)){
    setCombatMessage("Gust of Wind requires a direction.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action)) return await finishFailedSpellCommit(caster,action);
  pendingAimAction=null;
  exitAimMode(false,false);

  const cells=r226StraightLineCells(caster,targetHex,Math.max(1,level*3));
  r226DisperseGasCells(cells,"Gust of Wind");
  const affected=livingUnitsInAreaCells(cells).filter(unit=>unit.id!==caster.id);

  for(const unit of affected){
    const size=r226UnitSizeRank(unit);
    let moveMultiplier=size<=2 ? 0 : size===3 ? 0.5 : 1;
    if(unit.flying && size<=1) moveMultiplier=0.5;
    addUnitEffect(unit,{
      id:"gust-wind",name:"Gust of Wind",kind:"debuff",
      expiresRound:game.round+2,
      detail:moveMultiplier===0 ? "Cannot advance against the gust" : "Movement impeded by the gust",
      data:{sourceUnitId:caster.id,casterLevel:level,moveMultiplier}
    });
  }

  r226GustFx={
    points:[{x:caster.x,y:caster.y},...cells],
    started:performance.now(),duration:520
  };
  const until=performance.now()+520;
  while(performance.now()<until){ draw(); await sleep(16); }
  r226GustFx=null;
  draw();

  setCombatMessage(
    `Gust of Wind tears through ${cells.length} hex${cells.length===1?"":"es"}${affected.length?` and buffets ${affected.length} creature${affected.length===1?"":"s"}`:""}.`,
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function r226CastHaste(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("haste");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Haste center is out of range.");
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

  const cells=hexesWithinRadius(targetHex,2);
  const targets=livingUnitsInAreaCells(cells)
    .filter(unit=>unit.faction===caster.faction)
    .sort((a,b)=>hexDistance(a,targetHex)-hexDistance(b,targetHex))
    .slice(0,level);

  for(const unit of targets){
    removeUnitEffect(unit,"slow");
    addUnitEffect(unit,{
      id:"haste",name:"Haste",kind:"buff",
      expiresRound:game.round+3+level,
      detail:"2× movement and attack rate; −2 initiative",
      data:{sourceUnitId:caster.id,casterLevel:level}
    });
  }
  if(targets.length) await animateMagicEffectOnUnits(targets,"haste");
  setCombatMessage(`Haste accelerates ${targets.length} friendly creature${targets.length===1?"":"s"}.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function r226CastHoldPerson(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("hold-person");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Hold Person center is out of range.");
    return false;
  }
  if(lineOfSightBlockedBetweenHexes(caster,targetHex)){
    setCombatMessage("Line of sight is blocked to that hex.");
    return false;
  }

  const candidates=livingUnitsInAreaCells(hexesWithinRadius(targetHex,1))
    .filter(unit=>unit.faction!==caster.faction && r226IsHumanoidPerson(unit))
    .sort((a,b)=>hexDistance(a,targetHex)-hexDistance(b,targetHex) || spellHitDiceValue(a)-spellHitDiceValue(b))
    .slice(0,4);

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action)) return await finishFailedSpellCommit(caster,action);
  pendingAimAction=null;
  exitAimMode(false,false);

  const savePenalty=candidates.length<=1 ? -3 : candidates.length===2 ? -1 : 0;
  const held=[];
  for(const unit of candidates){
    const save=rollSpellSave(unit,caster,savePenalty);
    if(save.success) continue;
    addUnitEffect(unit,{
      id:"held-person",name:"Held",kind:"debuff",
      expiresRound:game.round+2*level,
      detail:"Held by Hold Person; cannot act",
      data:{sourceUnitId:caster.id,casterLevel:level}
    });
    held.push(unit);
  }
  if(held.length) await animateMagicEffectOnUnits(held,"hold");
  setCombatMessage(
    held.length
      ? `Hold Person freezes ${held.map(unit=>unit.name).join(", ")}.`
      : "No eligible humanoid is held.",
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function r226CastHoldUndead(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("hold-undead");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Hold Undead center is out of range.");
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

  const maxTargets=d(3);
  const holdDuration=d(4)+level;
  const candidates=livingUnitsInAreaCells(hexesWithinRadius(targetHex,1))
    .filter(unit=>unit.faction!==caster.faction && isUndeadUnit(unit))
    .sort((a,b)=>spellHitDiceValue(a)-spellHitDiceValue(b));

  let hdBudget=level;
  const held=[];
  for(const unit of candidates){
    if(held.length>=maxTargets) break;
    const hd=spellHitDiceValue(unit);
    if(hd>hdBudget) continue;
    const mindless=unit.mindless===true || /skeleton|zombie|ghoul/i.test(String(unit.name||""));
    const save=mindless ? {success:false} : rollSpellSave(unit,caster);
    if(save.success) continue;
    hdBudget-=hd;
    addUnitEffect(unit,{
      id:"held-undead",name:"Held Undead",kind:"debuff",
      expiresRound:game.round+holdDuration,
      detail:"Held by necromantic binding; cannot act",
      data:{sourceUnitId:caster.id,casterLevel:level}
    });
    held.push(unit);
  }
  if(held.length) await animateMagicEffectOnUnits(held,"hold");
  setCombatMessage(
    held.length ? `Hold Undead binds ${held.map(unit=>unit.name).join(", ")}.` : "No undead are held.",
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function r226CastInfravision(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("infravision");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;
  if(!validCreatureTargetWithinRange(caster,target,spell,level,true)){
    setCombatMessage("Infravision requires self or an adjacent creature.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action)) return await finishFailedSpellCommit(caster,action);
  pendingAimAction=null;
  exitAimMode(false,false);

  addUnitEffect(target,{
    id:"infravision",name:"Infravision",kind:"buff",
    expiresRound:game.round+(2+level)*60,
    detail:"60-foot infravision in normal darkness",
    data:{sourceUnitId:caster.id,casterLevel:level,rangeFeet:60}
  });
  await animateMagicEffectOnUnits([target],"infravision");
  setCombatMessage(`${target.name} gains 60-foot Infravision.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function r226CastInvisibilityRadius(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("invisibility-10-radius");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;
  if(!validCreatureTargetWithinRange(caster,target,spell,level,true)){
    setCombatMessage("Invisibility, 10' Radius requires self or an adjacent creature.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action)) return await finishFailedSpellCommit(caster,action);
  pendingAimAction=null;
  exitAimMode(false,false);

  const recipients=allUnits().filter(unit=>
    unit?.alive && !unit.fled && unitDistance(target,unit)<=1
  );
  for(const unit of recipients){
    addUnitEffect(unit,{
      id:"invisibility",name:"Invisible",kind:"buff",expiresRound:null,
      detail:"Invisible under 10-foot-radius veil; leaving radius or hostile action can end it",
      data:{
        sourceUnitId:caster.id,
        casterLevel:level,
        radiusSourceUnitId:target.id,
        radiusSpell:true
      }
    });
  }
  addUnitEffect(target,{
    id:"invisibility-10-radius",name:"Invisibility 10' Radius",kind:"buff",expiresRound:null,
    detail:"Carries a 10-foot-radius invisibility veil",
    data:{sourceUnitId:caster.id,casterLevel:level}
  });
  playMagicEffectSound("invisibility");
  setCombatMessage(`${recipients.length} creature${recipients.length===1?"":"s"} vanish inside ${target.name}'s 10-foot veil.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

