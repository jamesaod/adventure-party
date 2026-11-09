/* Shared combat turn/initiative owner. Preserve existing status, result-hold,
 * player/AI and session-pause ordering. Casting records remain lifecycle-owned. */
function rollInitiative(){
  return castingInitiativeSlots(applyInitiativeEffects(rollUnitInitiative()));
}

function rollUnitInitiative(){
  const rolls=[];

  for(const unit of allUnits()){
    if(!unit.alive || unit.fled || game.session?.controlledActorId&&unit.id!==game.session.controlledActorId) continue;

    rolls.push({
      id:unit.id,
      roll:d(10),
      tie:d(10)
    });
  }

  rolls.sort((a,b)=>
    a.roll-b.roll ||
    a.tie-b.tie ||
    a.id.localeCompare(b.id)
  );

  return rolls;
}

function applyInitiativeEffects(rolls){
  for(const entry of rolls){
    const unit=getUnitById(entry.id);
    if(getUnitEffect(unit,"haste")) entry.roll=Math.max(0,entry.roll-2);
  }
  rolls.sort((a,b)=>a.roll-b.roll || a.tie-b.tie || a.id.localeCompare(b.id));
  return rolls;
}

// Initiative handoffs have their own ownership. aiTimer is shared with AI and
// status presentation, so losing/replacing that timer must not strand a slot.
function scheduleCombatTurnHandoff(delay){
  const combat=game,round=combat.round,index=combat.turnIndex;
  const previous=combat.turnHandoff;
  if(previous){clearTimeout(previous.timer);clearTimeout(previous.recovery);}
  const handoff={round,index,timer:null,recovery:null,running:false};
  combat.turnHandoff=handoff;
  const current=()=>game===combat&&!combat.over&&combat.turnHandoff===handoff&&
    combat.round===round&&combat.turnIndex===index&&!combat.active&&!combat.session?.pauseAfterAction;
  const run=async(recovered=false)=>{
    if(!current()||handoff.running)return;
    handoff.running=true;
    clearTimeout(handoff.timer);clearTimeout(handoff.recovery);
    if(aiTimer===handoff.timer)aiTimer=null;
    if(recovered){
      combat.turnRecovery={round,index,reason:'initiative handoff timer did not complete'};
      console.warn('Recovered idle combat initiative',combat.turnRecovery);
    }
    try{await beginTurn();}
    catch(error){console.error('Combat initiative handoff failed',{round,index},error);}
    finally{
      handoff.running=false;
      // Only an orphaned, unchanged slot can retry. Never replay an active turn.
      if(current())handoff.recovery=setTimeout(()=>run(true),2000);
    }
  };
  const wait=Math.max(16,Number.isFinite(delay)?delay:180);
  handoff.timer=setTimeout(()=>run(false),wait);
  handoff.recovery=setTimeout(()=>run(true),wait+2000);
  aiTimer=handoff.timer;
}

async function beginTurn(){
  if(
    game &&
    !game.over &&
    game.turnIndex<game.order.length
  ){
    const slotId=game.order[game.turnIndex];
    const record=r230CastingStore()[slotId];

    if(record){
      return await r230ResolveCastingCompletion(record);
    }
  }

  return await beginUnitTurn();
}

async function beginUnitTurn(){
  if(game.over) return;

  const holdRemaining=combatActionPauseRemaining();
  if(holdRemaining>0){
    scheduleCombatTurnHandoff(holdRemaining);
    return;
  }

  if(game.turnIndex>=game.order.length){
    startRound();
    return;
  }

  const actorId=game.order[game.turnIndex];
  const actor=getUnitById(actorId);

  if(!actor || !actor.alive || actor.fled){
    game.turnIndex++;
    beginTurn();
    return;
  }

  game.active=actorId;
  if(typeof beginCombatResultTurn==="function")beginCombatResultTurn(actorId);

  /*
    R137: an unseen hostile no longer gives away its position merely by becoming
    the active initiative actor. Camera focus is earned by LOS or a successful
    party Listen check during movement.
  */
  if(actor.controller!=="mob" || mobPositionVisibleToFriendlyParty(actor)){
    centerCameraOn(actor);
  }

  refreshTurnBanner();
  updateUi();
  draw();

  if(await handleTurnControlEffects(actor)) return;

  if(isPlayerControlledUnit(actor)){
    if(actor.guard){
      actor.guard=false;
      actor.guardBaselineAdjacentIds=[];
      log(`${actor.name}'s unused Guard stance expires as the next action begins.`,"system");
    }

    actor.turnMoves=0;
    actor.fullMove=false;
    if(!Number.isFinite(actor.attacksThisRound)) actor.attacksThisRound=1;
    if(!Number.isFinite(actor.attacksRemaining)) actor.attacksRemaining=actor.attacksThisRound;

    log(`${actor.name} is active under player control. ${activeEnemies().length} hostile units remain in combat.`,"system");

    syncQuickCommandState(actor.id);
    if(isQuickCommandUnit(actor)){
      const token=quickCommandGeneration;
      aiTimer=setTimeout(()=>{ aiTimer=null; runQuickCommandPlayerTurn(token); },220);
    }
    return;
  }

  if(actor.controller==="mob" && actor.guard){
    actor.guard=false;
    actor.guardBaselineAdjacentIds=[];
    log(`${actor.name}'s unused MOB Guard expires as its next turn begins.`,"system");
  }

  aiTimer=setTimeout(()=>{
    aiTimer=null;
    if(actor.controller==="npc"){
      if(actor.type==="mage") friendlyMageTurn(actor);
      else friendlyNpcTurn(actor);
    }else{
      mobTurn(actor);
    }
  },260);
}

function endTurn(){
  if(game.over) return;

  game.turnIndex++;
  game.active=null;
  updateUi();
  draw();

  if(game.session?.pauseAfterAction){game.session.actionComplete=true;return;}
  const delay=Math.max(
    180,
    combatActionPauseRemaining()
  );

  scheduleCombatTurnHandoff(delay);
}

/* Combat owner: combat-turn-flow.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

function startRound(){
  if(game.over) return;

  game.round++;
  advanceFirFires();
  expireTimedUnitEffects();
  game.player.turnMoves=0;
  game.player.fullMove=false;
  game.player.waitedThisRound=false;
  game.player.sweepUsedThisRound=false;
  sweepInProgress=false;
  game.player.attacksThisRound=game.player.repositoryMobId?repositoryAttacksThisRound(game.player,game.round):game.player.type==="fighter" ? fighterAttacksThisRound(game.player,game.round) : 1;
  game.player.shotsThisRound=game.player.missileRateOfFire || 1;
  game.player.shotsRemaining=game.player.shotsThisRound;
  game.player.attacksRemaining=game.player.attacksThisRound;

  for(const ally of game.allies || []){
    if(!ally.alive || ally.fled) continue;

    if(isPlayerControlledUnit(ally)){
      ally.turnMoves=0;
      ally.fullMove=false;
      ally.waitedThisRound=false;
      ally.attacksThisRound=ally.repositoryMobId?repositoryAttacksThisRound(ally,game.round):ally.type==="fighter" ? fighterAttacksThisRound(ally,game.round) : 1;
      ally.attacksRemaining=ally.attacksThisRound;
    }

    ally.shotsThisRound=ally.missileRateOfFire || 1;
    ally.shotsRemaining=ally.shotsThisRound;
  }

  const rolls=rollInitiative();
  game.order=rolls.map(entry=>entry.id);
  game.turnIndex=0;

  const fighterRoll=rolls.find(entry=>entry.id==="player")?.roll ?? "—";
  const firstUnit=getUnitById(game.order[0]);

  ui.roundLabel.textContent=`ROUND ${game.round}`;
  ui.initiativeLabel.textContent=
    `INIT: PLAYER ${fighterRoll} / ${activeEnemies().length} MOBS`;

  log(
    `Round ${game.round}: ${game.order.length} initiative slots. `+
    `${firstUnit?.name || "Unknown"} acts first. `+
    `${game.player.name} attacks this round: ${game.player.attacksThisRound}.`,
    "system"
  );

  beginTurn();
}
