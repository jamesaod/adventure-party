async function r226CastLightningBolt(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("lightning-bolt");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;
  if(!targetHex || (targetHex.x===caster.x && targetHex.y===caster.y)){
    setCombatMessage("Lightning Bolt requires a direction.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action)) return await finishFailedSpellCommit(caster,action);
  pendingAimAction=null;
  exitAimMode(false,false);
  setUnitActionBanner(caster,"Casting Lightning Bolt");

  const cells=r226StraightLineCells(caster,targetHex,8,{rebound:true});
  const damageDice=Math.min(10,Math.max(1,level));
  const rolled=rollDiceExpression(`${damageDice}d6`).total;
  const occurrences=r226UnitOccurrencesAlongCells(cells);
  const results=[];

  for(const {unit} of occurrences){
    if(!unit.alive) continue;
    const save=rollSpellSave(unit,caster);
    const damage=unitImmuneToDamageType(unit,"lightning")
      ? 0
      : (save.success ? Math.floor(rolled/2) : rolled);
    results.push({unit,save,damage});
  }

  r226LightningFx={points:[{x:caster.x,y:caster.y},...cells],started:performance.now(),duration:650};
  playMagicEffectSound("lightning");
  const until=performance.now()+650;
  while(performance.now()<until){ draw(); await sleep(16); }
  r226LightningFx=null;

  for(const result of results){
    if(result.damage>0) applySpellDamage(caster,result.unit,result.damage,"Lightning Bolt","lightning");
  }

  const rebounded=cells.some(cell=>cell.rebounded);
  setCombatMessage(
    `${caster.name}'s Lightning Bolt deals ${damageDice}d6 = ${rolled} before saves`+
    `${rebounded ? " and rebounds from a solid barrier" : ""}.`,
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function r226FireMeteorVolley(caster,target,count,spellName="Melf's Minute Meteors"){
  if(!caster?.alive || !target?.alive || count<=0) return {fired:0,hits:0,damage:0};
  let fired=0,hits=0,totalDamage=0;
  const level=Math.max(1,Number(caster.level)||TEST_SPELL_CASTER_LEVEL);
  const thaco=Math.max(1,21-Math.ceil(level/3));

  for(let i=0;i<count && target.alive;i++){
    if(projectilePathBlocked(caster,target)) break;
    fired++;
    const raw=d(20);
    const ac=effectiveArmorClassForAttack(caster,target,"small-device-missile");
    const targetNumber=thaco-ac;
    const modifier=2+attackEffectModifier(caster,target);
    const resolution=resolveMissileAttackD20(raw,targetNumber,modifier);
    playNaturalAttackRollSound(raw);
    await animateMagicMissile(caster,target,i,count);

    if(!resolution.hit){ playMissSound(); continue; }
    if(interceptWithMirrorImage(target,caster)){ playMissSound(); continue; }
    hits++;
    const damage=d(4);
    totalDamage+=damage;
    playAttackSound();
    applySpellDamage(caster,target,damage,spellName,"fire");
  }
  return {fired,hits,damage:totalDamage};
}

async function r226CastMinuteMeteors(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("melfs-minute-meteors");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,false)){
    setCombatMessage("Melf's Minute Meteors requires a hostile creature within range.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action)) return await finishFailedSpellCommit(caster,action);
  pendingAimAction=null;
  exitAimMode(false,false);
  setUnitActionBanner(caster,"Casting Melf's Minute Meteors");

  const initial=Math.min(5,level);
  const volley=await r226FireMeteorVolley(caster,target,initial,spell.name);
  const remaining=Math.max(0,level-volley.fired);

  if(remaining>0){
    addUnitEffect(caster,{
      id:"minute-meteors",name:"Minute Meteors",kind:"buff",expiresRound:null,
      detail:`${remaining} meteor${remaining===1?"":"s"} remaining; up to five discharge on the next turn`,
      data:{sourceUnitId:caster.id,casterLevel:level,remaining,lastVolleyRound:game.round}
    });
  }

  setCombatMessage(
    `Minute Meteors: ${volley.fired} fired, ${volley.hits} hit for ${volley.damage} damage${remaining?`; ${remaining} remain`:""}.`,
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function r226ResolveMinuteMeteorsTurn(actor){
  const effect=getUnitEffect(actor,"minute-meteors");
  if(!effect || effect.data.lastVolleyRound===game.round) return false;
  const remaining=Math.max(0,Number(effect.data.remaining)||0);
  if(!remaining){ removeUnitEffect(actor,"minute-meteors"); return false; }

  const meteorSpell=getSpellEntry("melfs-minute-meteors");
  const meteorRange=spellRangeHexes(meteorSpell,Number(effect.data?.casterLevel)||TEST_SPELL_CASTER_LEVEL);
  const target=r226ClosestVisibleHostile(actor,meteorRange);
  if(!target){
    setCombatMessage(`${actor.name} has Minute Meteors ready but no visible hostile target.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    return false;
  }

  effect.data.lastVolleyRound=game.round;
  const volleyCount=Math.min(5,remaining);
  setUnitActionBanner(actor,"Releasing Minute Meteors");
  const volley=await r226FireMeteorVolley(actor,target,volleyCount,"Melf's Minute Meteors");
  effect.data.remaining=Math.max(0,remaining-volley.fired);
  effect.detail=`${effect.data.remaining} meteor${effect.data.remaining===1?"":"s"} remaining`;

  if(effect.data.remaining<=0) removeUnitEffect(actor,"minute-meteors");
  setCombatMessage(
    `${actor.name} releases ${volley.fired} Minute Meteor${volley.fired===1?"":"s"} at ${target.name}.`,
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  if(!game.over) endTurn();
  return true;
}

