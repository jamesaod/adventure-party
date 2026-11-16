/* ============================================================
   TURN-CONTROL EXTENSIONS
   ============================================================ */

const r226BaseHandleTurnControlEffects=handleTurnControlEffects;
handleTurnControlEffects=async function(actor){
  if(!actor?.alive) return false;

  if(getUnitEffect(actor,"held-person") || getUnitEffect(actor,"held-undead")){
    return skipTurnForSpellStatus(actor,"Held",`${actor.name} is magically held and cannot act.`);
  }

  const baseHandled=await r226BaseHandleTurnControlEffects(actor);
  if(baseHandled) return true;

  await r226ResolveBlinkAtTurnStart(actor);
  r226CleanupRadiusInvisibility();
  r226PreparePlayerAttackRate(actor);

  if(await r226ResolveMinuteMeteorsTurn(actor)) return true;
  return false;
};


/* ============================================================
   CAST DISPATCH + AIM PREVIEW
   ============================================================ */

const r226BaseCastPreparedCombatSpell=castPreparedCombatSpell;
castPreparedCombatSpell=async function(action,targetHex,targetUnit){
  switch(action?.spellId){
    case "blink": return await r226CastBlink(action);
    case "dispel-magic": return await r226CastDispelMagic(action,targetHex);
    case "flame-arrow": return await r226CastFlameArrow(action,targetUnit);
    case "gust-of-wind": return await r226CastGustOfWind(action,targetHex);
    case "haste": return await r226CastHaste(action,targetHex);
    case "hold-person": return await r226CastHoldPerson(action,targetHex);
    case "hold-undead": return await r226CastHoldUndead(action,targetHex);
    case "infravision": return await r226CastInfravision(action,targetUnit);
    case "invisibility-10-radius": return await r226CastInvisibilityRadius(action,targetUnit);
    case "lightning-bolt": return await r226CastLightningBolt(action,targetHex);
    case "melfs-minute-meteors": return await r226CastMinuteMeteors(action,targetUnit);
    case "protection-from-evil-10-radius": return await r226CastProtectionRadius(action,targetUnit);
    case "protection-from-normal-missiles": return await r226CastProtectionMissiles(action,targetUnit);
    case "slow": return await r226CastSlow(action,targetHex);
    case "vampiric-touch": return await r226CastVampiricTouch(action,targetUnit);
    case "wind-wall": return await r226CastWindWall(action,targetHex);
    default:
      return await r226BaseCastPreparedCombatSpell(action,targetHex,targetUnit);
  }
};

const r226BaseTestSpellTargetPrompt=testSpellTargetPrompt;
testSpellTargetPrompt=function(spell){
  if(spell?.id==="vampiric-touch") return "AIM at an adjacent hostile creature for the touch attack";
  if(spell?.id==="wind-wall") return "AIM at the desired wall center; orientation is perpendicular to the caster-to-target line";
  if(["lightning-bolt","gust-of-wind"].includes(spell?.id)) return "AIM in the desired line direction";
  return r226BaseTestSpellTargetPrompt(spell);
};

const r226BaseAimAreaPreviewForAction=aimAreaPreviewForAction;
aimAreaPreviewForAction=function(action,targetHex){
  const spell=getSpellEntry(action?.spellId);
  const caster=spellCasterForAction(action) || activeUnit() || game?.player;
  const level=Math.max(1,action?.casterLevel || TEST_SPELL_CASTER_LEVEL);
  if(!spell || !caster || !targetHex) return r226BaseAimAreaPreviewForAction(action,targetHex);

  if(["dispel-magic","hold-person","hold-undead"].includes(spell.id)){
    return {spell,cells:hexesWithinRadius(targetHex,1),tone:"control",dangerous:false,friendlyFireCount:0};
  }
  if(["haste","slow"].includes(spell.id)){
    return {spell,cells:hexesWithinRadius(targetHex,2),tone:spell.id==="haste"?"control":"control",dangerous:false,friendlyFireCount:0};
  }
  if(spell.id==="lightning-bolt"){
    const cells=r226StraightLineCells(caster,targetHex,8,{rebound:true});
    const friendlies=livingUnitsInAreaCells(cells).filter(unit=>unit.faction===caster.faction);
    return {spell,cells,tone:"damage",dangerous:true,friendlyFireCount:friendlies.length};
  }
  if(spell.id==="gust-of-wind"){
    return {spell,cells:r226StraightLineCells(caster,targetHex,level*3),tone:"control",dangerous:false,friendlyFireCount:0};
  }
  if(spell.id==="wind-wall"){
    return {spell,cells:r226WindWallCells(caster,targetHex,level),tone:"fog",dangerous:false,friendlyFireCount:0};
  }

  return r226BaseAimAreaPreviewForAction(action,targetHex);
};


/* ============================================================
   WIND WALL VS NEW GASEOUS EFFECTS
   ============================================================ */

const r226BaseAddAreaEffect=addAreaEffect;
addAreaEffect=function(effect){
  if(effect && Array.isArray(effect.cells) && r226ActiveWindWalls().length){
    const gaseous=(
      effect.type==="fog" || effect.type==="stinking-cloud" ||
      effect.spellKind==="stinking-cloud" || effect.spellKind==="fog-cloud"
    );
    if(gaseous){
      const wallKeys=new Set(r226ActiveWindWalls().flatMap(wall=>wall.cells.map(cell=>key(cell.x,cell.y))));
      effect.cells=effect.cells.filter(cell=>!wallKeys.has(key(cell.x,cell.y)));
      if(!effect.cells.length){
        log(`${effect.name || "The cloud"} cannot form through the Wind Wall.`,"system");
        return effect;
      }
    }
  }
  return r226BaseAddAreaEffect(effect);
};


/* ============================================================
   R226 PRESENTATION / VFX
   ============================================================ */

