async function r226CastProtectionRadius(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("protection-from-evil-10-radius");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;
  if(!validCreatureTargetWithinRange(caster,target,spell,level,true)){
    setCombatMessage("Protection From Evil, 10' Radius requires self or an adjacent creature.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action)) return await finishFailedSpellCommit(caster,action);
  pendingAimAction=null;
  exitAimMode(false,false);

  addUnitEffect(target,{
    id:"protection-from-evil-radius",name:"Protection From Evil 10' Radius",kind:"buff",
    expiresRound:game.round+2*level,
    detail:"10-foot aura: evil attackers −2 to hit; +2 saves against evil sources",
    data:{sourceUnitId:caster.id,casterLevel:level,radiusHexes:1}
  });
  await animateMagicEffectOnUnits([target],"protection");
  setCombatMessage(`${target.name} carries a 10-foot Protection From Evil aura.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function r226CastProtectionMissiles(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("protection-from-normal-missiles");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;
  if(!validCreatureTargetWithinRange(caster,target,spell,level,true)){
    setCombatMessage("Protection From Normal Missiles requires self or an adjacent creature.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action)) return await finishFailedSpellCommit(caster,action);
  pendingAimAction=null;
  exitAimMode(false,false);

  addUnitEffect(target,{
    id:"protection-from-normal-missiles",name:"Protection From Normal Missiles",kind:"buff",
    expiresRound:game.round+10*level,
    detail:"Ordinary arrows and sling missiles cannot harm this creature",
    data:{sourceUnitId:caster.id,casterLevel:level}
  });
  await animateMagicEffectOnUnits([target],"protection");
  setCombatMessage(`${target.name} is warded against normal missiles.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function r226CastSlow(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("slow");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;
  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Slow center is out of range.");
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

  const targets=livingUnitsInAreaCells(hexesWithinRadius(targetHex,2))
    .filter(unit=>unit.faction!==caster.faction)
    .sort((a,b)=>hexDistance(a,targetHex)-hexDistance(b,targetHex))
    .slice(0,level);
  const slowed=[];

  for(const unit of targets){
    const save=rollSpellSave(unit,caster,-4);
    if(save.success) continue;
    removeUnitEffect(unit,"haste");
    addUnitEffect(unit,{
      id:"slow",name:"Slow",kind:"debuff",
      expiresRound:game.round+3+level,
      detail:"½ movement/attack rate; −4 attacks; +4 AC penalty",
      data:{sourceUnitId:caster.id,casterLevel:level,attackUsedRound:null}
    });
    slowed.push(unit);
  }
  if(slowed.length) await animateMagicEffectOnUnits(slowed,"slow");
  setCombatMessage(
    slowed.length ? `Slow grips ${slowed.length} hostile creature${slowed.length===1?"":"s"}.` : "All targets resist Slow.",
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function r226CastVampiricTouch(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("vampiric-touch");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;
  if(!target?.alive || target.faction===caster.faction || !canMeleeReach(caster,target)){
    setCombatMessage("Vampiric Touch requires an adjacent hostile creature.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action)) return await finishFailedSpellCommit(caster,action);
  pendingAimAction=null;
  exitAimMode(false,false);
  setUnitActionBanner(caster,"Vampiric Touch");

  if(isUndeadUnit(target)){
    setCombatMessage(`${target.name} is undead and unaffected by Vampiric Touch.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    await waitForCombatActionPause();
    finishTestSpellCast(caster,spell.name,action);
    return true;
  }

  const attackRoll=r226SpellTouchAttack(caster,target,0);
  if(!attackRoll.hit){
    playMissSound();
    setCombatMessage("Vampiric Touch misses.",COMBAT_MESSAGE_MIN_HOLD_MS);
    await waitForCombatActionPause();
    finishTestSpellCast(caster,spell.name,action);
    return true;
  }

  const dice=Math.min(6,Math.max(1,Math.floor(level/2)));
  const damage=rollDiceExpression(`${dice}d6`).total;
  const result=applySpellDamage(caster,target,damage,"Vampiric Touch","magic");
  const before=caster.hp;
  caster.hp+=damage;
  const temp=Math.max(0,caster.hp-(caster.maxHp||caster.hp));
  if(temp>0){
    addUnitEffect(caster,{
      id:"vampiric-vitality",name:"Vampiric Vitality",kind:"buff",expiresRound:null,
      detail:`${temp} temporary hit point${temp===1?"":"s"} above normal maximum`,
      data:{sourceUnitId:caster.id,casterLevel:level,tempHp:temp}
    });
  }
  await animateMagicEffectOnUnits([caster],"vampiric");
  playAttackSound();
  setCombatMessage(
    `${caster.name} drains ${damage} hit points from ${target.name} and rises from ${before} to ${caster.hp} HP.`,
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  if(result.killed) await waitForCombatActionPause();
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function r226CastWindWall(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("wind-wall");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;
  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Wind Wall center is out of range.");
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

  const cells=r226WindWallCells(caster,targetHex,level);
  const wall={
    id:`wind-wall:${Date.now()}`,type:"wind-wall",name:"Wind Wall",
    sourceUnitId:caster.id,cells,expiresRound:game.round+level,
    data:{sourceUnitId:caster.id,casterLevel:level},shotsByAttacker:{}
  };
  r226ActiveWindWalls().push(wall);
  r226DisperseGasCells(cells,"Wind Wall");
  queueMicrotask(()=>ensurePersistentStatusFxLoop());

  setCombatMessage(`Wind Wall rises across ${cells.length} hex${cells.length===1?"":"es"}.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}


