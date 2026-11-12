/* Combat owner: combat-session-state.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

function exitCombat(){
  stopBowSounds();globalThis.adventurePartyStopSnowSteps?.();
  document.getElementById('combatEndPrompt')?.remove?.();
  window.AdventurePartyCombatBeats?.clear();
  if(typeof returnFromExplorationCombat==='function'&&returnFromExplorationCombat("retreat"))return;
  if(!returnToStudioFromCombat()) showLauncher();
}

function cancelPendingCombatStart({preserveDraft=false}={}){
  if(!preserveDraft) studioDraftAutoSelect=false;
  if(!pendingCombatStart) return;
  const request=pendingCombatStart;
  request.cancelled=true;
  pendingCombatStart=null;
  if(request.button){
    request.button.disabled=false;
    request.button.textContent=request.buttonLabel;
    request.button.removeAttribute("aria-busy");
  }
}

async function waitForCombatUnitRenders(units){
  await Promise.all(units.map(async unit=>{
    let pending=unit.appearanceRefreshPromise;
    while(pending){
      const result=await pending;
      if(pending!==unit.appearanceRefreshPromise){pending=unit.appearanceRefreshPromise;continue;}
      if(unit.appearanceLoadError)throw Error(`${unit.name||unit.type}: ${unit.appearanceLoadError}`);
      if(!result && !unit.dynamicAppearanceSpriteSetId)throw Error(`Could not render ${unit.name||'unit'}. Please retry.`);
      break;
    }
  }));
}

async function showCombat(condition=selectedCombatCondition){
  if(pendingCombatStart) return false;
  const button=document.getElementById("beginBattleButton");
  const request={screen:currentScreen,cancelled:false,button,buttonLabel:button?.textContent};
  pendingCombatStart=request;
  try{
    if(studioSpriteLoading.state==="pending"){
      if(button){
        button.disabled=true;
        button.textContent="Loading sprites…";
        button.setAttribute("aria-busy","true");
      }
      await studioSpriteLoading.ready;
    }
  }finally{
    if(pendingCombatStart===request){
      pendingCombatStart=null;
      if(button){
        button.disabled=false;
        button.textContent=request.buttonLabel;
        button.removeAttribute("aria-busy");
      }
    }
  }
  if(request.cancelled || currentScreen!==request.screen) return false;
  pendingCombatStart=request;
  const rendering=combatRenderingPanel();
  selectedCombatCondition=condition || "grass";
  globalThis.adventurePartyUiAudio?.transition(currentScreen,'combat','open');
  currentScreen="combat";

  stopTitleMusic();
  launcherScreen.classList.remove("active");
  combatConditionsScreen?.classList.remove("active");
  xpLootScreen?.classList.remove("active");
  pixelScreen.classList.remove("active");
  spellbookScreen.classList.remove("active");
  classbookScreen.classList.remove("active");
  spellPreviewScreen?.classList.remove("active");
  combatScreen.classList.add("active");

  updateAudioIndicators();

  try{
    const started=await startCombatSession({condition:selectedCombatCondition,source:explorationEncounter?'exploration':'combat-test'},{isCurrent:()=>!request.cancelled&&currentScreen==='combat'});
    if(!started){rendering.finish();return false;}
    rendering.finish();
    syncWeatherAudio();
  }catch(error){
    rendering.fail(error);
    console.error("Combat initialization failed:",error);

    const banner=document.getElementById("turnBanner");
    const logBox=document.getElementById("combatLog");

    if(banner){
      banner.textContent="COMBAT INITIALIZATION ERROR";
    }

    if(logBox){
      logBox.innerHTML="";
      const line=document.createElement("div");
      line.className="log-line bad";
      line.textContent="Initialization error: "+(error?.message || String(error));
      logBox.appendChild(line);
    }
  }finally{if(pendingCombatStart===request)pendingCombatStart=null;}
}

function checkPartyDefeat(){
  if(!game || game.over) return false;

  if(livingPartyMembers().length===0){
    game.over=true;
    game.active=null;

    /*
      Candidate rule: a total party defeat does not produce recoverable loot.
      Record the outcome explicitly so future non-wipe defeat/retreat outcomes
      can make their own reward decisions instead of keying only off the title.
    */
    game.partyWipedOut=true;

    scheduleCombatFinish(
      "Defeat",
      "All player-party members have gone down."
    );

    return true;
  }

  return false;
}

function checkCombatVictory(){
  if(!game || game.over) return false;
  // A Studio test with no chosen opponents is a solo inspection sandbox.
  if(isStudioTestCombat() && game.enemies.length===0) return false;

  if(activeEnemies().length===0){
    game.over=true;

    scheduleCombatFinish(
      "Victory",
      "No hostile combatants remain; enemies are dead, have fled, or have changed sides. "+
      livingPartyMembers()
        .map(unit=>unit.name+" "+unit.hp+"/"+unit.maxHp+" HP")
        .join("; ")+"."
    );

    return true;
  }

  return false;
}

function deployConfiguredCombatMobs(condition,player){
  const allies=[],enemies=[];
  let index=0;
  for(const group of readCombatMobRoster())for(let n=0;n<group.count;n++){
    const mob=makeStudioTestMob(group.type,index,{x:0,y:0});
    mob.id='roster-'+group.type+'-'+(++index);
    const friendly=group.faction==='friendly';
    mob.faction=friendly?'player':'enemy';mob.controller=friendly?'player':'mob';
    (friendly?allies:enemies).push(mob);
  }
  const positions=axialDisk({x:0,y:0},17).filter(p=>inside(p.x,p.y)&&!isWall(p.x,p.y));
  // Two compact formations. Ten hexes is the minimum gap between occupied
  // opposing cells, including the player's footprint, rather than ring radii.
  for(const direction of HEX_DIRS){
    const enemyAnchor={x:player.x+direction.x*10,y:player.y+direction.y*10};
    const occupied=new Set(occupiedHexes(player).map(c=>key(c.x,c.y)));
    const friendlyCells=[...occupiedHexes(player)];let valid=true;
    for(const [units,anchor,friendly] of [[allies,player,true],[enemies,enemyAnchor,false]]){
      for(const mob of units){
        const toward=friendly?enemyAnchor:player;
        const candidates=positions.slice().sort((a,b)=>hexDistance(a,anchor)-hexDistance(b,anchor)||a.y-b.y||a.x-b.x);
        const pos=candidates.find(p=>{
          const cells=occupiedHexesAt(mob,p.x,p.y,hexDirectionIndexToward(p,toward));
          return cells.every(c=>inside(c.x,c.y)&&!isWall(c.x,c.y)&&!occupied.has(key(c.x,c.y))&&
            (friendly?hexDistance(c,enemyAnchor)>=10:friendlyCells.every(f=>hexDistance(c,f)>=10)));
        });
        if(!pos){valid=false;break;}
        mob.x=pos.x;mob.y=pos.y;mob.facingHex=hexDirectionIndexToward(pos,toward);
        mob.facing=(toward.x-pos.x)+(toward.y-pos.y)*.5>=0?'right':'left';
        const cells=occupiedHexes(mob);cells.forEach(c=>occupied.add(key(c.x,c.y)));
        if(friendly)friendlyCells.push(...cells);
      }
      if(!valid)break;
    }
    if(valid){lastMobDeployment={direction:'Opposing formations',anchor:enemyAnchor,anchorDistance:10,count:index,condition};return {allies,enemies};}
  }
  throw new Error('Not enough free battlefield space for formations separated by ten hexes.');
}

function newGame(condition=selectedCombatCondition,scenario={}){
  stopBowSounds();globalThis.adventurePartyStopSnowSteps?.();
  document.getElementById('combatEndPrompt')?.remove?.();
  window.AdventurePartyCombatBeats?.clear();
  battlefieldRotation=5;
  if(aiTimer){
    clearTimeout(aiTimer);
    aiTimer=null;
  }


  /*
    R186: configure terrain before encounter placement so a large footprint can
    validate every occupied cell against architectural walls at spawn time.
  */
  if(scenario.source&&scenario.source!=='exploration'){explorationEncounter=null;explorationTerrain=null;}
  configureArchitecturalWalls(typeof configureStandaloneCombatScene==='function'?'grass':condition);
  if(typeof explorationEncounter!=='undefined'&&explorationEncounter)configureExplorationTerrain();
  else if(typeof configureStandaloneCombatScene==='function')configureStandaloneCombatScene(condition);

  const explorationRoster=scenario.roster||(typeof explorationEncounter!=='undefined'&&explorationEncounter?explorationUnits():null);
  const player=explorationRoster?.player || libraryTestPlayer() || (selectedMobEncounter==="studio-kobold" ? makeStudioTestPlayer(condition) : makeFighter());
  if(!explorationRoster&&player.type==="fighter"&&player.name==="Dungeon Crawler Carl"){
    equipCarlBowForCombatTest(player);
    syncFighterEquipment(player);
    applyFighterClassRules(player);
  }
  if(selectedMobEncounter!=="studio-kobold"){
    delete player.studioSpriteTest;
    delete player.studioPoseInspection;
  }
  const configured=explorationRoster || deployConfiguredCombatMobs(condition,player);
  const allies=configured.allies;
  const enemies=configured.enemies;
  const groupKobolds=enemies.filter(isKoboldUnit);
  lastOrcDeployment=null;

  camera.x=player.x;
  camera.y=player.y;

  game=createCombatGame(condition,{player,allies,enemies},{...scenario,source:scenario.source||(explorationEncounter?'exploration':'combat-test'),studioSpriteTest:!scenario.roster&&selectedMobEncounter==='studio-kobold'});

  for(const unit of [player,...allies,...enemies]){
    if(!Object.prototype.hasOwnProperty.call(unit,"heightInches")){
      unit.heightInches=unit.type==="fighter" ? 76 : null;
    }
  }

  if(typeof explorationEncounter!=='undefined'&&explorationEncounter)rememberExplorationCombat("active");
  lastPlayerVisibilityObserverId=null;

  aimMode=false;
  pendingAimAction=null;
  spellCastInProgress=false;
  sweepInProgress=false;
  quickCommandUnitIds.clear();
  quickCommandActive=false;
  quickCommandUnitId=null;
  quickCommandGeneration++;
  quickCommandRunning=false;
  aimCursor.x=player.x;
  aimCursor.y=player.y;

  if(deathFxTimer){
    clearTimeout(deathFxTimer);
    deathFxTimer=null;
  }

  if(unitBarkClearTimer){
    clearTimeout(unitBarkClearTimer);
    unitBarkClearTimer=null;
  }

  if(activityDetectedClearTimer){
    clearTimeout(activityDetectedClearTimer);
    activityDetectedClearTimer=null;
  }
  activityDetectedFx=null;

  deathFx=null;
  projectileFx=null;
  areaDamageFx=null;
  fireballExplosionFx=null;
  dragonBreathFx=null;
  colorSprayFx=null;
  magicEffectFx=[];
  castingGlowFx=[];
  fireDamageFx=[];
  if(transientUnitFxFrame!==null){
    cancelCombatAnimationTick(transientUnitFxFrame);
    transientUnitFxFrame=null;
  }
  deathActionPauseUntil=0;

  combatOpeningSpeechDone=false;
  combatAwaitingStart=false;
  combatStartPending=false;
  if(combatMessageClearTimer){
    clearTimeout(combatMessageClearTimer);
    combatMessageClearTimer=null;
  }

  if(combatMessageFlashTimer){
    clearInterval(combatMessageFlashTimer);
    combatMessageFlashTimer=null;
  }

  combatMessageSequence++;
  combatMessageText="";
  combatMessageTone="normal";
  combatMessageHoldUntil=0;

  ui.combatLog.innerHTML="";
  ui.resultOverlay.classList.remove("show");

  log(typeof explorationEncounter!=='undefined'&&explorationEncounter?`Exploration encounter: ${explorationEncounter.event.name}.`:"Combat stress test initialized.","system");
  log(
    typeof explorationEncounter!=='undefined'&&explorationEncounter ? "Terrain and closed doors imported from the exploration map; walls block movement and sight." : condition==="wall"
      ? "Combat Condition: WALL TEST — enlarged indoor grey-floor building, no indoor trees, solid architectural walls block movement and line of sight; use the open west entrance."
      : "Combat Condition: GRASSY BATTLEFIELD — open-field movement and line of sight.",
    "system"
  );
  log(
    typeof explorationEncounter!=='undefined'&&explorationEncounter ? "Use Retreat to exploration to leave this encounter and preserve survivors." : `Temporary battlefield: ${MAP_WIDTH_HEXES} × ${MAP_HEIGHT_HEXES} hexes. Fleeing units must cross a map edge to escape.`,
    "system"
  );
  log(
    `${player.name} ready: ${player.hp}/${player.maxHp} HP, AC ${player.ac}, THAC0 ${player.thaco}, ${player.weapon}.`,
    "system"
  );

  if(selectedMobEncounter==="large-test"){
    const large=enemies[0];
    log(
      `Juvenile Red Dragon deployed as one combat entity across ${unitFootprintCellCount(large)} occupied hexes; `+
      `${large.maxHp} HP, AC ${large.ac}, THAC0 ${large.thaco}, Move ${large.move}.`,
      "system"
    );
    log(
      "Multi-hex test rules: one initiative slot, one HP pool, one target identity, one save/damage resolution per area effect.",
      "system"
    );
  }else if(selectedMobEncounter==="orcs"){
    log(
      "20-Orc test warband deployed: 18 Orcs, 1 Orc Leader, 1 3rd-level Orc Shaman.",
      "system"
    );
    log(
      "Orcs — AC 6, THAC0 19, Move 9, 1 HD, weapon damage 1d8, Steady morale, XP 15.",
      "system"
    );
    log(
      "Orc Leaders — fixed 8 HP, AC 6, THAC0 19, battle axe 1d8, XP 35.",
      "system"
    );
    log(
      "Orc Shaman — 3rd-level priest, 1d8+2d4 HP, attacks as 2 HD, AC 6, THAC0 19, XP 175.",
      "system"
    );
  }else if(selectedMobEncounter==="studio-kobold"){
    log(`${player.name} is your player-controlled Studio test character. ${enemies.length} opponents and ${allies.length} allies were added through Combat Setup.`,"system");
    log(`The captured model and ${unitFootprintCellCount(player)}-hex footprint follow the test character's movement, facing and action poses.`,"system");
  }else if(selectedMobEncounter!=="custom"){
    log(
      `10 Kobolds deployed: AC 7, THAC0 20, Move 6, 1d4 HP each; dagger only; new dagger sprite set.`,
      "system"
    );

    log(
      `3 Kobold Body Guards deployed: AC 6, THAC0 20, Move 6, 4 HP each; Short Sword 1d6, shield, leather armor; XP 15.`,
      "system"
    );

    log(
      `3 Kobold Slingers deployed: AC 7, THAC0 20, Move 6, 1d4 HP each; Sling with 10 sling bullets; XP 7.`,
      "system"
    );
  }

  if(lastMobDeployment){
    log(
      ["studio-kobold","custom"].includes(selectedMobEncounter)
        ? `Configured roster deployed: ${enemies.length} opponents and ${allies.length} allies.`
        : selectedMobEncounter==="large-test"
        ? `Red Dragon pivot: ${lastMobDeployment.anchor.x},${lastMobDeployment.anchor.y}; 7-hex radius-1 footprint.`
        : selectedMobEncounter==="orcs"
          ? (
              `Orc deployment: ${lastMobDeployment.direction}, `+
              `anchor ${lastMobDeployment.anchorDistance} hexes from Carl, `+
              `cluster radius ${lastMobDeployment.clusterRadius}.`
            )
          : (
              `${selectedMobEncounter==="studio-kobold" ? "Sprite-test" : "Kobold"} deployment: ${lastMobDeployment.direction}, `+
              `anchor ${lastMobDeployment.anchorDistance} hexes from Carl, `+
              `cluster radius ${lastMobDeployment.clusterRadius}.`
            ),
      "system"
    );
  }


  /*
    R65: Carl no longer has opening dialogue.
    The combat screen immediately waits for the player's Space input.
  */
  combatOpeningSpeechDone=true;
  combatAwaitingStart=!scenario.autoStart;
  rotateBattlefield(0);
  // Ordinary battles render their equipped appearance at combat start.
  // A Studio combat test already has an exact 18-frame native battlefield
  // capture. Keep those approved frames unchanged until an actual gear change
  // instead of asynchronously replacing them with a lower-detail render.
  for(const unit of scenario.prepareAppearance===false?[]:[player,...allies,...enemies])if(unit.repositoryMobId&&!unit.studioSpriteTest)markMobAppearanceDirty(unit,{reason:"repository-mob-spawn"});
  if(scenario.prepareAppearance!==false&&!player.studioSpriteTest && typeof markMobAppearanceDirty==="function"){
    markMobAppearanceDirty(player,{reason:"combat-start"});
  }
  document.dispatchEvent(new Event("adventure-party:sprite-state"));

  ui.roundLabel.textContent="ROUND —";
  ui.initiativeLabel.textContent="INIT: —";
  ui.turnBanner.textContent="<Press Space to Begin>";

  setCombatMessage(
    "<Press Space to Begin>",
    0,
    0
  );

  updateUi();
  draw();
}

function collectLootFromSlainEnemies(){
  const items=new Map();
  const add=(name,qty=1)=>{
    const amount=Math.max(0,Number(qty)||0);
    if(!name || amount<=0) return;
    items.set(name,(items.get(name)||0)+amount);
  };

  const slain=(game?.enemies || []).filter(enemy=>!enemy.alive && !enemy.fled);

  for(const enemy of slain){
    if(enemy.weapon) add(enemy.weapon,1);
    if(enemy.rangedWeapon) add(enemy.rangedWeapon,1);
    if(enemy.armorName) add(enemy.armorName,1);
    if(enemy.shieldName) add(enemy.shieldName,1);
    if(enemy.missileAmmoName && Number(enemy.missileAmmoQuantity)>0){
      add(enemy.missileAmmoName,enemy.missileAmmoQuantity);
    }
  }

  return {
    slain,
    fled:(game?.enemies || []).filter(enemy=>enemy.fled),
    items:[...items.entries()]
      .map(([name,qty])=>({name,qty}))
      .sort((a,b)=>a.name.localeCompare(b.name))
  };
}

function scheduleCombatFinish(title,text){
  const combat=game;
  if(combat?.session?.holdResults){combat.session.result={title,text};return;}
  const hasResultBeats=typeof candidateCombatBeatRemaining==='function'&&(candidateCombatBeatRemaining()>0||[...candidateCombatBeatGroups.values()].some(group=>group.gameRef===combat&&group.pending.length));
  if(isStudioTestCombat(combat)&&!hasResultBeats){finishCombat(title,text);return;}
  const finish=()=>{
    if(game!==combat||currentScreen!=="combat")return;
    const remaining=combatActionPauseRemaining();
    if(remaining>0){setTimeout(finish,Math.max(16,remaining));return;}
    finishCombat(title,text);
  };
  // Let synchronous damage/status/death beats flush before scheduling results.
  setTimeout(finish,deathFx?1000:100);
}

function finishCombat(title,text,confirmed=false){
  if(!confirmed&&currentScreen==='combat'&&!game.battleResultAcknowledged){
    game.pendingBattleResult={title,text};
    if(!document.getElementById('combatEndPrompt')){
      const combat=game,prompt=document.createElement('button');prompt.id='combatEndPrompt';prompt.className='combat-action';
      prompt.textContent=`${title} — Press Space to end`;
      prompt.style.cssText='display:block;width:100%;margin:16px 0;padding:14px;white-space:normal;line-height:1.8';
      prompt.onclick=()=>{if(game===combat&&game.pendingBattleResult)finishCombat(title,text,true);};
      document.querySelector('.unit-info-panel').insertBefore(prompt,document.getElementById('combatCompass'));
    }
    ui.turnBanner.textContent=`${title.toUpperCase()} — PRESS SPACE TO END`;
    return;
  }
  document.getElementById('combatEndPrompt')?.remove?.();
  delete game.pendingBattleResult;
  game.battleResultAcknowledged=true;
  game.over=true;
  game.active=null;
  quickCommandUnitIds.clear();
  quickCommandActive=false;
  quickCommandUnitId=null;
  quickCommandGeneration++;
  quickCommandRunning=false;

  if(aiTimer){
    clearTimeout(aiTimer);
    aiTimer=null;
  }

  restoreAllCharmPersonAllegiances();

  if(typeof returnFromExplorationCombat==='function'&&returnFromExplorationCombat(title==="Victory"?"victory":"defeat"))return;
  if(returnToStudioFromCombat()) return;

  let xpAwarded=0;
  let xpText="";

  if(title==="Victory"){
    const fighter=game?.player;
    const baseXp=game.xpPool || 0;
    const bonus=fighter?.stats?.str>=FIGHTER_CLASS.primeRequisiteXpBonusThreshold
      ? Math.round(baseXp*0.10)
      : 0;
    xpAwarded=baseXp+bonus;
    xpText=awardFighterXp(baseXp);
  }

  ui.turnBanner.textContent="COMBAT COMPLETE";
  ui.resultOverlay.classList.remove("show");
  updateUi();
  showXpLootScreen(title,text+xpText,xpAwarded);
}
