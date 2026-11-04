/*
  R227 — PLAYER-DIRECTED MELF'S MINUTE METEORS
  ============================================================
  Corrects the R226 five-per-round mode so player-controlled casters are never
  hijacked at turn start. Stored meteors are released deliberately from CAST.
  The player assigns one target per meteor (targets may repeat), up to five per
  round or the number remaining. Once the full volley is assigned, every meteor
  launches simultaneously and the turn ends.
*/

let r227MeteorVolleyFx=null;

const r227MinuteMeteorsSpell=getSpellEntry("melfs-minute-meteors");
if(r227MinuteMeteorsSpell){
  /* Casting creates the stored missiles around the caster; targeting happens
     when the player releases the stored volley. */
  r227MinuteMeteorsSpell.targetMode="self";
  r227MinuteMeteorsSpell.damageSummary=
    "Creates one 1d4 meteor/level; player assigns up to five meteor targets per volley, then all launch together.";
  r227MinuteMeteorsSpell.description=
    "Creates one fiery meteor per caster level. In five-per-round mode, a player-controlled caster chooses one target for each meteor in the volley (the same target may be chosen more than once). After the maximum available targets are assigned, the entire volley launches simultaneously. Stored meteors never auto-fire at turn start.";
}

function r227PlayerDirectsMeteors(caster){
  return !!(
    caster?.alive &&
    isPlayerControlledUnit(caster) &&
    !isQuickCommandUnit(caster)
  );
}

function r227MinuteMeteorEffect(caster){
  return getUnitEffect(caster,"minute-meteors");
}

function r227MinuteMeteorRemaining(effect){
  return Math.max(0,Math.floor(Number(effect?.data?.remaining)||0));
}

function r227MinuteMeteorVolleySize(effect){
  return Math.min(5,r227MinuteMeteorRemaining(effect));
}

function r227MinuteMeteorRangeHexes(effect){
  const spell=getSpellEntry("melfs-minute-meteors");
  const level=Math.max(
    1,
    Number(effect?.data?.casterLevel)||TEST_SPELL_CASTER_LEVEL
  );
  return spellRangeHexes(spell,level);
}

function r227TargetSummary(targetIds){
  const counts=new Map();
  for(const id of targetIds || []){
    const unit=getUnitById(id);
    const name=unit?.name || id || "Unknown";
    counts.set(name,(counts.get(name)||0)+1);
  }
  return [...counts.entries()]
    .map(([name,count])=>count>1 ? `${name} ×${count}` : name)
    .join(", ");
}

function r227BeginMinuteMeteorTargeting(
  caster,
  effect,
  {fromInitialCast=false,originAction=null}={}
){
  if(!caster?.alive || !effect) return false;

  const remaining=r227MinuteMeteorRemaining(effect);
  const volleyCount=r227MinuteMeteorVolleySize(effect);

  if(remaining<=0 || volleyCount<=0){
    removeUnitEffect(caster,"minute-meteors");
    setCombatMessage(`${caster.name} has no Minute Meteors remaining.`);
    return false;
  }

  closeSpellCastOverlay();

  pendingAimAction={
    type:"minute-meteor-volley",
    spellId:"melfs-minute-meteors",
    casterLevel:
      Number(effect.data?.casterLevel)||
      Number(caster.level)||
      TEST_SPELL_CASTER_LEVEL,
    sourceUnitId:caster.id,
    meteorVolley:true,
    meteorTargetIds:[],
    meteorVolleyCount:volleyCount,
    fromInitialCast:!!fromInitialCast,
    originAction:originAction ? {...originAction} : null
  };

  /* The spell itself has already committed. Target assignment is now a player
     input state, not another spell commit. */
  spellCastInProgress=false;
  enterAimMode();
  setUnitActionBanner(caster,"Assigning Minute Meteors");
  setCombatMessage(
    `Minute Meteors: select target 1 of ${volleyCount}. `+
    `Repeat a target to assign it more than one meteor.`
  );
  updateUi();
  draw();
  return true;
}

function r227ValidMeteorTarget(caster,effect,target){
  if(!caster?.alive || !effect || !target?.alive || target.fled) return false;
  if(target.faction===caster.faction) return false;

  if(unitDistance(caster,target)>r227MinuteMeteorRangeHexes(effect)){
    setCombatMessage(`${target.name} is out of Minute Meteor range.`);
    return false;
  }

  if(projectilePathBlocked(caster,target)){
    setCombatMessage(`${target.name} does not have a clear Minute Meteor firing lane.`);
    return false;
  }

  if(
    typeof r222UnitCurrentlyVisible==="function" &&
    !r222UnitCurrentlyVisible(caster,target)
  ){
    setCombatMessage(`${target.name} is not currently visible to ${caster.name}.`);
    return false;
  }

  return true;
}

