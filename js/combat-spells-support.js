/* Combat owner: combat-spells-support.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

async function castArmorSpell(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("armor");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,true)){
    setCombatMessage("Armor requires self or an adjacent creature.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,getSpellEntry(action?.spellId),action,1800,target)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  let acValue=6;

  if(target.stats?.dex!==undefined){
    acValue+=dexterityAdjustments(target.stats.dex).defensive;
  }

  if(target.ac<=acValue){
    setCombatMessage(`${target.name} already has AC ${target.ac}; Armor provides no improvement.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  }else{
    addUnitEffect(target,{
      id:"armor-spell",
      name:"Armor",
      kind:"buff",
      detail:`Magical AC ${acValue}; collapses after >${8+level} cumulative damage`,
      data:{
        casterLevel:level,
        acValue,
        damageLimit:8+level,
        damageTaken:0
      }
    });

    setCombatMessage(`${target.name} gains Armor (AC ${acValue}).`,COMBAT_MESSAGE_MIN_HOLD_MS);
  }

  await waitForCombatActionPause();
  finishTestSpellCast(caster,"Armor",action);
  return true;
}

async function castShieldSpell(action){
  const caster=spellCasterForAction(action);
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  spellCastInProgress=true;
  if(!commitSpellCast(caster,getSpellEntry(action?.spellId),action)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  addUnitEffect(caster,{
    id:"shield",
    name:"Shield",
    kind:"buff",
    expiresRound:game.round+5*level,
    detail:"Frontal: negates Magic Missile; AC 3 vs arrows/bolts/bullets; AC 4 vs other attacks; +1 saves",
    data:{casterLevel:level}
  });

  setCombatMessage(`${caster.name} raises a shimmering Shield.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,"Shield",action);
  return true;
}

async function castChillTouchSpell(action){
  const caster=spellCasterForAction(action);
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;
  const rounds=3+level;

  spellCastInProgress=true;
  if(!commitSpellCast(caster,getSpellEntry(action?.spellId),action)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  addUnitEffect(caster,{
    id:"chill-touch",
    name:"Chill Touch",
    kind:"buff",
    expiresRound:game.round+rounds,
    detail:`Melee hits can add 1d4 damage and Strength loss; ${rounds} rounds`,
    data:{casterLevel:level}
  });

  setCombatMessage(`${caster.name}'s hand glows with Chill Touch.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,"Chill Touch",action);
  return true;
}

async function castEnlargeSpell(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("enlarge");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,true)){
    setCombatMessage("Enlarge target is out of range.");
    return false;
  }

  if(lineOfSightBlocked(caster,target)){
    setCombatMessage("Line of sight is blocked to that target.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,getSpellEntry(action?.spellId),action,1800,target)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  if(target.faction!==caster.faction){
    const save=rollSpellSave(target,caster);

    if(save.success){
      setCombatMessage(`${target.name} resists Enlarge.`,COMBAT_MESSAGE_MIN_HOLD_MS);
      await waitForCombatActionPause();
      finishTestSpellCast(caster,"Enlarge",action);
      return true;
    }
  }

  const multiplier=1+(0.10*level);
  const priorScale=enlargeVisualScale(target);

  addUnitEffect(target,{
    id:"enlarge",
    name:"Enlarged",
    kind:"buff",
    expiresRound:game.round+5*level,
    detail:`Size ${Math.round(multiplier*100)}%; weapon base damage ×${multiplier.toFixed(1)}`,
    data:{
      casterLevel:level,
      damageMultiplier:multiplier,
      sizeMultiplier:multiplier
    }
  });

  /*
    R193: visual scale follows the same percentage as the spell's size increase.
    Occupied hexes, pathfinding, melee reach, and collision footprint are not
    changed by this presentation-only sprite scaling.
  */
  triggerEnlargeTransition(
    target,
    Math.max(1,priorScale),
    multiplier,
    multiplier>=priorScale ? "grow" : "shrink",
    1000
  );

  setCombatMessage(`${target.name} grows to ${Math.round(multiplier*100)}% normal size.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,"Enlarge",action);
  return true;
}

async function castProtectionFromEvilSpell(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("protection-from-evil");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,true)){
    setCombatMessage("Protection From Evil requires self or an adjacent creature.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,getSpellEntry(action?.spellId),action,1800,target)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  addUnitEffect(target,{
    id:"protection-from-evil",
    name:"Protection From Evil",
    kind:"buff",
    expiresRound:game.round+2*level,
    detail:"Evil attackers −2 to hit; +2 saves against their attacks",
    data:{casterLevel:level}
  });

  setCombatMessage(`${target.name} gains Protection From Evil.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,"Protection From Evil",action);
  return true;
}

async function castLightSpell(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("light");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;
  const durationRounds=10*level;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,true)){
    setCombatMessage("Light target is out of range.");
    return false;
  }

  if(lineOfSightBlocked(caster,target)){
    setCombatMessage("Line of sight is blocked to that target.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,getSpellEntry(action?.spellId),action,1800,target)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  if(target.faction===caster.faction){
    addUnitEffect(target,{
      id:"light",
      name:"Light",
      kind:"buff",
      expiresRound:game.round+durationRounds,
      detail:"20-foot illumination radius",
      data:makeLightSpellEffectData(level)
    });

    playMagicEffectSound("light");
    setCombatMessage(
      `${target.name} shines with magical Light.`,
      COMBAT_MESSAGE_MIN_HOLD_MS
    );
  }else{
    const save=rollSpellSave(target,caster);

    if(save.success){
      const source=addStaticLightSpellSource(caster,target,level);
      playMagicEffectSound("light");

      setCombatMessage(
        `${target.name} saves; Light forms behind it and illuminates the area.`,
        COMBAT_MESSAGE_MIN_HOLD_MS
      );

      if(source){
        ensurePersistentStatusFxLoop();
      }
    }else{
      applyBlindEffect(target,durationRounds,"Light");
      addUnitEffect(target,{
        id:"light",
        name:"Light",
        kind:"debuff",
        expiresRound:game.round+durationRounds,
        detail:"20-foot illumination radius; centered on the eyes",
        data:makeLightSpellEffectData(level)
      });

      playMagicEffectSound("light");
      setCombatMessage(
        `${target.name} is blinded and illuminated by Light.`,
        COMBAT_MESSAGE_MIN_HOLD_MS
      );
    }
  }

  ensurePersistentStatusFxLoop();
  await waitForCombatActionPause();
  finishTestSpellCast(caster,"Light",action);
  return true;
}

async function castBlurSpell(action){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("blur");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;
  const rounds=3+level;

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  addUnitEffect(caster,{
    id:"blur",
    name:"Blur",
    kind:"buff",
    expiresRound:game.round+rounds,
    detail:"First attack by each attacker −4; later attacks −2; +1 vs direct magic",
    data:{attackers:{}}
  });

  playMagicEffectSound("blur");
  setCombatMessage(`${caster.name}'s outline blurs and shifts.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castContinualLightSpell(action,targetHex,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("continual-light");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Continual Light target is out of range.");
    return false;
  }
  if(lineOfSightBlockedBetweenHexes(caster,targetHex)){
    setCombatMessage("Line of sight is blocked to that hex.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action,1800,targetHex)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  const lightData={
    ...makeLightSpellEffectData(level),
    illuminationRadiusHexes:6,
    illuminationIntensity:1.15
  };

  if(target?.alive){
    if(target.faction===caster.faction){
      addUnitEffect(target,{
        id:"continual-light",
        name:"Continual Light",
        kind:"buff",
        expiresRound:null,
        detail:"Permanent magical light; 60-foot illumination radius",
        data:lightData
      });
      setCombatMessage(`${target.name} shines with Continual Light.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    }else{
      const save=rollSpellSave(target,caster);
      if(save.success){
        addAreaEffect({
          id:`continual-light:${Date.now()}`,
          type:"illumination",
          sourceName:"Continual Light",
          x:targetHex.x,
          y:targetHex.y,
          radiusHexes:6,
          intensity:1.15,
          color:[255,248,190],
          expiresRound:null,
          sourceUnitId:caster.id
        });
        setCombatMessage(`${target.name} saves; Continual Light remains at the target point.`,COMBAT_MESSAGE_MIN_HOLD_MS);
      }else{
        applyBlindEffect(target,null,"Continual Light");
        addUnitEffect(target,{
          id:"continual-light",
          name:"Continual Light",
          kind:"debuff",
          expiresRound:null,
          detail:"Permanent magical light centered on the eyes",
          data:lightData
        });
        setCombatMessage(`${target.name} is blinded by Continual Light!`,COMBAT_MESSAGE_MIN_HOLD_MS);
      }
    }
  }else{
    addAreaEffect({
      id:`continual-light:${Date.now()}`,
      type:"illumination",
      sourceName:"Continual Light",
      x:targetHex.x,
      y:targetHex.y,
      radiusHexes:6,
      intensity:1.15,
      color:[255,248,190],
      expiresRound:null,
      sourceUnitId:caster.id
    });
    setCombatMessage("Continual Light anchors to the battlefield.",COMBAT_MESSAGE_MIN_HOLD_MS);
  }

  playMagicEffectSound("light");
  ensurePersistentStatusFxLoop();
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castDetectInvisibilitySpell(action){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("detect-invisibility");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;
  const rounds=5*level;
  const rangeHexes=yardsToTacticalHexes(10*level);

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  addUnitEffect(caster,{
    id:"detect-invisibility",
    name:"Detect Invisibility",
    kind:"buff",
    expiresRound:game.round+rounds,
    detail:`Detect invisible creatures within ${rangeHexes} hexes`,
    data:{rangeHexes}
  });

  playMagicEffectSound("detect");
  setCombatMessage(`${caster.name} can perceive invisible creatures.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castFlamingSphereSpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("flaming-sphere");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Flaming Sphere target is out of range.");
    return false;
  }
  if(lineOfSightBlockedBetweenHexes(caster,targetHex)){
    setCombatMessage("Line of sight is blocked to that hex.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action,1800,targetHex)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  const effect=addAreaEffect({
    id:`flaming-sphere:${Date.now()}`,
    type:"flaming-sphere",
    name:"Flaming Sphere",
    cells:[{x:targetHex.x,y:targetHex.y}],
    expiresRound:game.round+level,
    sourceUnitId:caster.id
  });

  resolveFlamingSphereExposure(effect,caster);
  playFireballExplosionSound();
  setCombatMessage("A Flaming Sphere rolls into being.",COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castInvisibilitySpell(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("invisibility");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,true)){
    setCombatMessage("Invisibility requires self or an adjacent creature.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action,1800,target)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  addUnitEffect(target,{
    id:"invisibility",
    name:"Invisible",
    kind:"buff",
    expiresRound:null,
    detail:"Cannot normally be seen or targeted; hostile action ends the effect",
    data:{sourceUnitId:caster.id}
  });

  playMagicEffectSound("invisibility");
  setCombatMessage(`${target.name} fades from sight.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castMirrorImageSpell(action){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("mirror-image");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;
  const images=Math.min(8,d(4)+Math.floor(level/3));

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  addUnitEffect(caster,{
    id:"mirror-image",
    name:"Mirror Image",
    kind:"buff",
    expiresRound:game.round+3*level,
    detail:`${images} images remaining`,
    data:{images}
  });

  playMagicEffectSound("mirror-image");
  setCombatMessage(`${images} Mirror Images surround ${caster.name}.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castSpectralHandSpell(action){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("spectral-hand");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;
  const reserve=Math.min(d(4),Math.max(0,(caster.hp||1)-1));
  const rangeHexes=yardsToTacticalHexes(30+5*level);

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  if(reserve>0){
    caster.hp=Math.max(1,caster.hp-reserve);
  }

  addUnitEffect(caster,{
    id:"spectral-hand",
    name:"Spectral Hand",
    kind:"buff",
    expiresRound:game.round+2*level,
    detail:`Touch attacks to ${rangeHexes} hexes at +2; ${reserve} HP reserved`,
    data:{rangeHexes,reservedHp:reserve,casterLevel:level}
  });

  playMagicEffectSound("spectral-hand");
  setCombatMessage("A ghostly Spectral Hand forms beside the caster.",COMBAT_MESSAGE_MIN_HOLD_MS);
  updateUi();
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castStrengthSpell(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("strength");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,true)){
    setCombatMessage("Strength requires self or an adjacent creature.");
    return false;
  }

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action,1800,target)){ return await finishFailedSpellCommit(caster,action); }
  pendingAimAction=null;
  exitAimMode(false,false);

  const group=String(target.classGroup||target.className||"Wizard").toLowerCase();
  const die=group.includes("warrior") || group.includes("fighter") || group.includes("ranger")
    ? 8
    : group.includes("priest") || group.includes("cleric") || group.includes("rogue") || group.includes("thief")
      ? 6
      : 4;
  const rawGain=d(die);
  const base=Math.max(1,Number(target.stats?.str)||10);
  const gain=Math.max(0,Math.min(rawGain,18-base));

  addUnitEffect(target,{
    id:"strength-spell",
    name:"Strength",
    kind:"buff",
    expiresRound:game.round+60*level,
    detail:`Strength ${base} → ${base+gain} (+${gain})`,
    data:{strengthGain:gain,rawGain,die}
  });

  playMagicEffectSound("strength");
  setCombatMessage(
    gain>0
      ? `${target.name}'s Strength rises by ${gain}.`
      : `${target.name} is already at the tactical Strength cap.`,
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  finishTestSpellCast(caster,spell.name,action);
  return true;
}

async function castPriestCombatSpell(action,hex,target){
 const caster=spellCasterForAction(action),spell=getSpellEntry(action.spellId);
 if(!caster?.alive||!spell)return false;
 const friendly=target?.faction===caster.faction;
 const self=spell.targetMode==='self';
 if(!self){
   if(!target?.alive){setCombatMessage('A living target is required.');return false;}
   if(unitDistance(caster,target)>6){setCombatMessage('Target is out of range.');return false;}
   if(lineOfSightBlocked(caster,target)){setCombatMessage('Line of sight is blocked.');return false;}
   if(spell.targetMode==='touch-creature'&&unitDistance(caster,target)>1){
     setCombatMessage('Touch spell: move adjacent first.');return false;
   }
   if(spell.targetMode==='hostile-creature'&&friendly)return false;
 }
 spellCastInProgress=true;
 if(!commitSpellCast(caster,spell,action,1800,target)){
   return await finishFailedSpellCommit(caster,action);
 }
 pendingAimAction=null;exitAimMode(false,false);
 const round=game.round,level=caster.level;
 const effect=(unit,id,name,kind='buff',duration=level,data={})=>
   addUnitEffect(unit,{id,name,kind,expiresRound:round+Math.max(1,duration),data});
 switch(spell.kind){
   case 'heal':{
     if(!friendly)break;
     target.hp=Math.min(target.maxHp,target.hp+d(8));
     break;
   }
   case 'remove-fear':
     if(friendly){removeUnitEffect(target,'fear');removeUnitEffect(target,'spook');
       if(target.fleeing)setMoraleFleeing(target,false);}
     break;
   case 'remove-paralysis':
     if(friendly){for(const id of ['hold-person','paralysis','held'])removeUnitEffect(target,id);}
     break;
   case 'dispel':
     for(const e of [...(target.buffs||[]),...(target.debuffs||[])])
       if(e?.id&&!['unconscious','prone'].includes(e.id))removeUnitEffect(target,e.id);
     break;
   case 'command':
   case 'hold':{
     if(rollSpellSave(target,caster).success)break;
     effect(target,spell.id,spell.name,'debuff',spell.kind==='command'?1:Math.max(1,Math.floor(level/2)),
       {disabledActionsRemaining:1});
     break;
   }
   case 'hammer':{
     const hit=d(20)>=Math.max(2,Number(target.ac||10));
     if(hit){target.hp-=d(4)+1;if(target.hp<=0){target.hp=0;target.alive=false;}}
     break;
   }
   case 'light':effect(target,'light','Light', 'buff',10*level);break;
   case 'silence':effect(target,'silence','Silenced','debuff',2*level);break;
   case 'aid':{
     if(!friendly)break;
     const temp=d(8);target.hp=Math.min(target.maxHp+temp,target.hp+temp);
     effect(target,'priest-aid','Aid','buff',level,{temporaryHp:temp});break;
   }
   case 'buff':{
     if(!friendly&&!self)break;
     const units=self?[caster,...(game.allies||[]).filter(u=>u.alive&&u.faction===caster.faction)]:[target];
     for(const unit of units)effect(unit,spell.id,spell.name,'buff',level);
     break;
   }
 }
 setCombatMessage(`${caster.name} casts ${spell.name}.`,COMBAT_MESSAGE_MIN_HOLD_MS);
 await waitForCombatActionPause();
 finishTestSpellCast(caster,spell.name,action);
 return true;
}
