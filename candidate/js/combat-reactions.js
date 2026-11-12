/* Combat owner: combat-reactions.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

function unitCanMakeLeavingHexFreeAttack(attacker,mover){
  if(
    !attacker ||
    !mover ||
    !attacker.alive ||
    attacker.fled ||
    attacker.fleeing ||
    attacker.faction===mover.faction ||
    unitHasRangedWeaponInHand(attacker) ||
    getUnitEffect(attacker,"sleep") ||
    getUnitEffect(attacker,"unconscious") ||
    getUnitEffect(attacker,"stunned")
  ){
    return false;
  }

  const reach=Math.max(
    1,
    Number(attacker.meleeRange)||1
  );

  return reach===1
    ? canMeleeReach(attacker,mover)
    : unitDistance(attacker,mover)<=reach;
}

function movementLeavesMeleeReach(attacker,mover,destination){
  if(!destination||!Number.isFinite(destination.x)||!Number.isFinite(destination.y))return false;
  if(destination.x===mover.x&&destination.y===mover.y)return false;
  if(destination.escape)return true;
  const projected={...mover,x:destination.x,y:destination.y};
  if(unitFootprintDefinition(mover).rotates)projected.facingHex=hexDirectionIndexToward(mover,destination);
  return unitDistance(attacker,projected)>Math.max(1,Number(attacker.meleeRange)||1);
}

function leavingHexFreeAttackers(mover,destination){
  if(!game || !mover) return [];

  return allUnits()
    .filter(unit=>
      unit.id!==mover.id &&
      unitCanMakeLeavingHexFreeAttack(unit,mover) &&
      movementLeavesMeleeReach(unit,mover,destination)
    )
    .sort((a,b)=>a.id.localeCompare(b.id));
}

async function performLeavingHexFreeAttacks(mover,destination){
  if(
    !game ||
    game.over ||
    !mover?.alive ||
    freeStrikeInProgress
  ){
    return !!(
      mover?.alive &&
      !mover?.fled &&
      !game?.over
    );
  }

  const attackers=leavingHexFreeAttackers(mover,destination);

  if(!attackers.length){
    return true;
  }

  freeStrikeInProgress=true;

  try{
    for(const attacker of attackers){
      if(
        game.over ||
        !mover.alive ||
        mover.fled
      ){
        break;
      }

      if(!unitCanMakeLeavingHexFreeAttack(attacker,mover)||!movementLeavesMeleeReach(attacker,mover,destination)){
        continue;
      }

      log(
        `${mover.name} leaves melee reach — ${attacker.name} gets a free attack.`,
        attacker.faction==="player" ? "good" : "bad"
      );

      const result=await attack(
        attacker,
        mover,
        {
          actionLabel:
            `Free Attack with ${unitActionWeapon(attacker)}`
        }
      );

      updateUi();
      draw();

      /*
        This reaction does not consume the attacker's normal initiative
        action. Keep only a short beat so the reaction still reads as
        immediate.
      */
      if(result?.killed){
        await waitForCombatActionPause();
        break;
      }

      await sleep(result?.hit ? 220 : 140);
    }
  }finally{
    freeStrikeInProgress=false;
  }

  if(!game.over){
    refreshTurnBanner();
    updateUi();
    draw();
  }

  return !!(
    mover.alive &&
    !mover.fled &&
    !game.over
  );
}

function adjacentHostileIdsFor(unit){
  if(!game || !unit) return [];

  return hostileCombatantsFor(unit)
    .filter(other=>canMeleeReach(unit,other))
    .map(other=>other.id);
}

function wasAdjacentWhenGuardSet(guardUnit,otherUnit){
  return !!(
    guardUnit &&
    otherUnit &&
    Array.isArray(guardUnit.guardBaselineAdjacentIds) &&
    guardUnit.guardBaselineAdjacentIds.includes(otherUnit.id)
  );
}

function chooseGuard(){
  const p=activePlayerControlledUnit();
  if(game.over || !p || isCombatActionPauseActive()) return;

  exitAimMode(false);
  if(p.turnMoves>0 || p.fullMove){
    log(`Guard requires ${p.name} to hold position; it cannot be chosen after moving.`,"system");
    updateUi(); draw(); return;
  }

  p.guard=true;
  p.guardRound=game.round;
  p.guardBaselineAdjacentIds=adjacentHostileIdsFor(p);
  setUnitActionBanner(p,"Guarding");
  log(
    p.guardBaselineAdjacentIds.length
      ? `${p.name} guards: enemies already adjacent do not trigger Guard; the first new enemy entering melee range will be attacked.`
      : `${p.name} guards: the first new enemy entering melee range will be attacked.`,
    "good"
  );
  refreshTurnBanner(); updateUi(); draw();
  endTurn();
}

async function maybeTriggerPlayerGuard(mob){
  const guarder=livingPartyMembers()
    .filter(unit=>
      isPlayerControlledUnit(unit) &&
      unit.guard &&
      mob?.alive && !mob.fled &&
      mob.faction!==unit.faction &&
      canMeleeReach(unit,mob) &&
      !wasAdjacentWhenGuardSet(unit,mob)
    )
    .sort((a,b)=>a.id.localeCompare(b.id))[0];

  if(!guarder) return false;

  guarder.guard=false;
  guarder.guardBaselineAdjacentIds=[];
  log(`GUARD! ${guarder.name} attacks ${mob.name} as it newly enters an adjacent hex.`,"good");
  setUnitActionBanner(guarder,`Guard Attack with ${unitActionWeapon(guarder)}`);
  await attack(guarder,mob);
  updateUi(); draw();
  return true;
}

function canMobGuard(mob){
  return !!(
    mob &&
    mob.controller==="mob" &&
    mob.alive &&
    !mob.fled &&
    !mob.fleeing &&
    mob.weapon &&
    (mob.meleeRange||1)>=1
  );
}

function enterMobGuard(mob,reason="cannot make an attack"){
  if(!canMobGuard(mob)) return false;

  mob.guard=true;
  mob.guardRound=game.round;
  mob.guardBaselineAdjacentIds=adjacentHostileIdsFor(mob);

  setUnitActionBanner(mob,"Guarding");

  log(
    `${mob.name} fills the closest available position and GUARDS (${reason}); `+
    `only a newly adjacent enemy can trigger the reaction.`,
    "system"
  );

  updateUi();
  draw();
  return true;
}

async function triggerMobGuardsAgainst(target){
  if(
    !game ||
    game.over ||
    !target?.alive ||
    mobGuardReactionInProgress
  ){
    return;
  }

  const guards=activeCombatants()
    .filter(mob=>
      mob.controller==="mob" &&
      mob.guard &&
      mob.faction!==target.faction &&
      canMobGuard(mob) &&
      !wasAdjacentWhenGuardSet(mob,target) &&
      canMeleeAttackTarget(mob,target)
    )
    .sort((a,b)=>a.id.localeCompare(b.id));

  if(!guards.length) return;

  mobGuardReactionInProgress=true;

  try{
    for(const mob of guards){
      if(game.over || !target.alive) break;
      if(!mob.alive || mob.fled || !mob.guard) continue;

      mob.guard=false;
      mob.guardBaselineAdjacentIds=[];

      log(
        `MOB GUARD! ${mob.name} attacks ${target.name} as the target newly enters an adjacent hex.`,
        "bad"
      );

      setUnitActionBanner(
        mob,
        `Guard Attack with ${unitActionWeapon(mob)}`
      );

      const result=await attack(mob,target);
      updateUi();
      draw();

      if(result?.hit){
        await waitForCombatActionPause();

        if(result?.killed){
          break;
        }
      }else{
        await sleep(160);
      }
    }
  }finally{
    mobGuardReactionInProgress=false;
  }

  if(!game.over){
    refreshTurnBanner();
    updateUi();
    draw();
  }
}
