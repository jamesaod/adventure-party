async function r227ResolveSelectedMeteorVolley(action,effect){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("melfs-minute-meteors");
  if(!caster?.alive || !effect) return false;

  const targetIds=[...(action.meteorTargetIds || [])];
  if(!targetIds.length) return false;

  pendingAimAction=null;
  exitAimMode(false,false);
  spellCastInProgress=true;
  setUnitActionBanner(caster,"Releasing Minute Meteors");
  faceEntityToward(caster,getUnitById(targetIds[0]) || caster);
  triggerUnitAttackPose(caster);
  breakInvisibility(caster,"releasing Minute Meteors");

  const results=r227BuildMeteorAttackResults(caster,targetIds,effect);

  for(const result of results){
    if(Number.isFinite(result.raw)){
      playNaturalAttackRollSound(result.raw);
    }
  }

  setLastRoll(
    "Minute Meteors: "+
    results.map(result=>{
      if(!result.target) return `#${result.index+1} invalid`;
      if(result.resolution?.automatic){
        return `#${result.index+1} ${result.target.name}: d20 ${result.raw} — ${result.resolution.automatic}`;
      }
      return `#${result.index+1} ${result.target.name}: d20 ${result.raw} `+
        `${formatSignedAdjustment(result.modifier)} = ${result.resolution.modifiedRoll} vs ${result.targetNumber}`;
    }).join("; ")
  );

  await r227AnimateMeteorVolley(caster,results);

  let hits=0;
  let misses=0;
  let imageHits=0;
  let totalDamage=0;
  const damageByTarget=new Map();

  for(const result of results){
    const target=result.target;
    if(!target){
      misses++;
      continue;
    }

    if(!result.hit){
      misses++;
      playMissSound();
      log(
        `${caster.name}'s Minute Meteor misses ${target.name} `+
        `(raw d20 ${result.raw}${result.resolution?.automatic ? ` — ${result.resolution.automatic}` : `, modified ${result.resolution.modifiedRoll} vs ${result.targetNumber}`}).`,
        "system"
      );
      continue;
    }

    if(interceptWithMirrorImage(target,caster)){
      imageHits++;
      playMissSound();
      continue;
    }

    hits++;
    const damage=d(4);
    totalDamage+=damage;
    damageByTarget.set(
      target.id,
      (damageByTarget.get(target.id)||0)+damage
    );
    playMagicMissileHitSound(result.index);
  }

  /* All missiles were already in flight together. Apply the accumulated impact
     to each creature only after the shared flight completes, so assigning more
     than one meteor to the same target does not cause later meteors to vanish
     just because an earlier one would have reduced that target to 0 HP. */
  for(const [targetId,damage] of damageByTarget.entries()){
    const target=getUnitById(targetId);
    if(!target) continue;
    applySpellDamage(
      caster,
      target,
      damage,
      "Melf's Minute Meteors",
      "fire"
    );
  }

  const spent=targetIds.length;
  effect.data.remaining=Math.max(
    0,
    r227MinuteMeteorRemaining(effect)-spent
  );
  effect.data.lastVolleyRound=game.round;
  effect.data.mode="five-per-round-player-targeted";
  effect.detail=
    `${effect.data.remaining} meteor${effect.data.remaining===1?"":"s"} remaining; `+
    "CAST to assign the next volley";

  if(effect.data.remaining<=0){
    removeUnitEffect(caster,"minute-meteors");
  }

  const remaining=Math.max(0,Number(effect.data?.remaining)||0);
  const summary=r227TargetSummary(targetIds);

  setCombatMessage(
    `${spent} Minute Meteor${spent===1?"":"s"} launch together at ${summary}: `+
    `${hits} hit${imageHits ? `, ${imageHits} strike Mirror Images` : ""}`+
    `${misses ? `, ${misses} miss` : ""}; ${totalDamage} damage`+
    `${remaining ? `; ${remaining} remain` : "; all meteors expended"}.`,
    COMBAT_MESSAGE_MIN_HOLD_MS
  );

  log(
    `${caster.name} releases a player-assigned Minute Meteor volley: `+
    `${summary}; ${hits} hit, ${misses} miss, ${imageHits} image hit, `+
    `${totalDamage} total damage; ${remaining} remaining.`,
    "system"
  );

  await waitForCombatActionPause();
  spellCastInProgress=false;
  updateUi();
  draw();

  if(action.fromInitialCast){
    finishTestSpellCast(
      caster,
      spell.name,
      action.originAction || null
    );
    return true;
  }

  if(!game.over){
    endTurn();
  }
  return true;
}

async function r227SelectMinuteMeteorTarget(action,target){
  const caster=spellCasterForAction(action);
  const effect=r227MinuteMeteorEffect(caster);
  if(!caster?.alive || !effect){
    pendingAimAction=null;
    exitAimMode(false,false);
    setCombatMessage("The stored Minute Meteors are no longer available.");
    return false;
  }

  if(!r227ValidMeteorTarget(caster,effect,target)){
    if(!target?.alive || target?.faction===caster.faction){
      setCombatMessage("Minute Meteors require a living hostile creature target.");
    }
    return false;
  }

  const liveAction=(pendingAimAction?.meteorVolley)
    ? pendingAimAction
    : action;

  if(!Array.isArray(liveAction.meteorTargetIds)){
    liveAction.meteorTargetIds=[];
  }

  liveAction.meteorTargetIds.push(target.id);
  const selected=liveAction.meteorTargetIds.length;
  const required=Math.max(
    1,
    Math.min(
      Number(liveAction.meteorVolleyCount)||5,
      r227MinuteMeteorRemaining(effect)
    )
  );

  pendingAimAction=liveAction;

  if(selected<required){
    setCombatMessage(
      `Minute Meteors ${selected}/${required}: ${r227TargetSummary(liveAction.meteorTargetIds)}. `+
      `Select target ${selected+1} of ${required}.`
    );
    updateUi();
    draw();
    return true;
  }

  return await r227ResolveSelectedMeteorVolley(liveAction,effect);
}


