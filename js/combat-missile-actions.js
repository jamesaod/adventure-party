/* Missile action owner. Classic-script module while engine services remain global.
 * Public admission: longbowAttack/slingAttack in adventure-party.js.
 * Explicit order: result context -> magic protection -> physical hit/miss resolver.
 * Projectile/VFX, equipment, LOS and environment impact services remain shared.
 * Preserve existing protected-shot costs and sling return values in this extraction.
 */
async function resolveLongbowAction(attacker,defender){
  return window.AdventurePartyCombatResults.physical(resolveProtectedLongbow,attacker,defender);
}
async function resolveSlingAction(attacker,defender){
  return window.AdventurePartyCombatResults.physical(resolveProtectedSling,attacker,defender);
}

function r226NormalMissileProtected(defender){
  return !!getUnitEffect(defender,"protection-from-normal-missiles");
}

async function r226ProtectedLongbowMiss(attacker,defender,reason){
  if(!attacker?.alive || !defender?.alive) return {hit:false,killed:false,damage:0};
  await focusRangedAttacker(attacker);
  attacker.weaponInHand="ranged";
  faceEntityToward(attacker,defender);
  triggerUnitAttackPose(attacker);
  breakInvisibility(attacker,"making a Longbow attack");
  playMissSound();
  await animateArrowProjectile(attacker,defender,false);
  await focusRangedMissTarget(defender);
  setCombatMessage(reason,COMBAT_MESSAGE_MIN_HOLD_MS);
  log(reason,"system");
  return {hit:false,killed:false,damage:0,blockedByMagic:true};
}

async function resolveProtectedLongbow(attacker,defender){
  if(r226NormalMissileProtected(defender)){
    return await r226ProtectedLongbowMiss(
      attacker,defender,
      `${defender.name}'s Protection From Normal Missiles turns aside the arrow.`
    );
  }
  if(r226LineCrossesWindWall(attacker,defender)){
    return await r226ProtectedLongbowMiss(
      attacker,defender,
      `The arrow is deflected by the Wind Wall before it can reach ${defender.name}.`
    );
  }
  return await resolveLongbowHit(attacker,defender);
}

async function r226ProtectedSlingMiss(attacker,defender){
  if(Number.isFinite(attacker.missileAmmoQuantity) && attacker.missileAmmoQuantity<=0){
    setCombatMessage(`${attacker.name} is out of sling bullets.`);
    return false;
  }
  if(projectilePathBlocked(attacker,defender)) return await resolveSlingHit(attacker,defender);

  await focusRangedAttacker(attacker);
  setUnitActionBanner(attacker,"Preparing Sling");
  playSlingWindupSound();
  await sleep(300);

  attacker.weaponInHand="ranged";
  triggerUnitAttackPose(attacker);
  playSlingReleaseSound();
  breakInvisibility(attacker,"making a Sling attack");

  if(Number.isFinite(attacker.missileAmmoQuantity)){
    attacker.missileAmmoQuantity=Math.max(0,attacker.missileAmmoQuantity-1);
  }
  await animateSlingProjectile(attacker,defender,false);
  await focusRangedMissTarget(defender);
  playMissSound();
  setCombatMessage(`${defender.name}'s Protection From Normal Missiles turns aside the sling shot.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  log(`${attacker.name}'s sling missile is negated by Protection From Normal Missiles.`,"system");
  updateUi();
  return false;
}

async function resolveProtectedSling(attacker,defender){
  if(r226NormalMissileProtected(defender)){
    return await r226ProtectedSlingMiss(attacker,defender);
  }
  return await resolveSlingHit(attacker,defender);
}



async function resolveLongbowHit(attacker,defender){
  if(
    game.over ||
    !attacker?.alive ||
    !defender?.alive
  ){
    return {hit:false,killed:false,damage:0};
  }

  if(projectilePathBlocked(attacker,defender)){
    setCombatMessage(`${attacker.name} does not have a clear firing lane.`);
    return {hit:false,killed:false,damage:0,blockedByObstacle:true};
  }

  const range=longbowRangeBand(attacker,defender);

  if(range.penalty===null){
    return {hit:false,killed:false,damage:0,outOfRange:true};
  }

  if(Number.isFinite(attacker.missileAmmoQuantity)&&attacker.missileAmmoQuantity<=0)return {hit:false,killed:false,damage:0,outOfAmmo:true};

  const position=
    attackPositionData(attacker,defender);

  await focusRangedAttacker(attacker);

  attacker.weaponInHand="ranged";
  setUnitActionBanner(attacker,`Firing ${attacker.rangedWeapon || "Longbow"} — ${position.label}`);

  updateFacingForStep(
    attacker,
    defender.x-attacker.x,
    defender.y-attacker.y
  );

  await prepareUnitAttackWindup(attacker);
  if(!consumeMissileAmmo(attacker))return {hit:false,killed:false,damage:0,outOfAmmo:true};
  triggerUnitAttackPose(attacker);
  updateUi();

  breakInvisibility(attacker,"making a missile attack");

  /* R97: do not play the successful-hit transient until the roll is known to hit. */
  const rawRoll=d(20);

  const dexMissileAdjustment=
    dexterityAdjustments(attacker.stats?.dex ?? 10).missile;

  const totalAttackBonus=
    (attacker.missileAttackBonus||0)+
    dexMissileAdjustment+
    range.penalty+
    attackEffectModifier(attacker,defender);

  const targetArmorClass=effectiveArmorClassForAttack(
    attacker,
    defender,
    "small-device-missile"
  );

  const targetNumber=
    attacker.thaco-targetArmorClass;

  const resolution=resolveMissileAttackD20(
    rawRoll,
    targetNumber,
    totalAttackBonus
  );

  attacker.environmentMissileRoll={rawRoll,targetNumber,modifiedRoll:resolution.modifiedRoll};
  playNaturalAttackRollSound(rawRoll);

  setLastRoll(
    `${attacker.name} longbow [${position.label}]: RAW d20 ${rawRoll}`+
    (
      resolution.automatic
        ? ` — ${resolution.automatic} (modifiers ignored); `
        : ` ${formatSignedAdjustment(totalAttackBonus)} = ${resolution.modifiedRoll} vs target ${targetNumber}; `
    )+
    `${range.band} ${range.distance} hexes`
  );

  if(resolution.hit){
    /* Confirmed Longbow hit: retain the existing successful-hit sound. */
    playAttackSound();
  }

  await animateArrowProjectile(
    attacker,
    defender,
    resolution.hit
  );

  if(!resolution.hit){
    await focusRangedMissTarget(defender);

    playMissSound();
    if(rawRoll===1){
      setCriticalRollNotification(
        attacker,
        defender,
        rawRoll
      );
    }

    log(
      `${attacker.name} fires at ${defender.name} from ${position.label}: `+
      `${resolution.automatic ? "automatic miss." : `modified ${resolution.modifiedRoll} vs ${targetNumber}, miss.`}`,
      "system"
    );

    flashAttack(attacker,defender,false);

    return {
      hit:false,
      killed:false,
      damage:0,
      criticalMiss:rawRoll===1,
      attackSector:position.label,
      attackPosition:position
    };
  }

  if(interceptWithMirrorImage(defender,attacker)){
    playMissSound();
    setCombatMessage(`${defender.name}'s Mirror Image is struck by the arrow.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    flashAttack(attacker,defender,false);
    return {hit:false,killed:false,damage:0,mirrorImage:true};
  }

  const bow=getMissileCatalogEntry(attacker.missileCatalogId||"bow-long");
  const damageExpression=damageExpressionForSize(
    bow,
    defender
  );

  const damageRoll=rollDiceExpression(
    damageExpression
  );

  const damage=Math.max(1,damageRoll.total+physicalDamageEffectModifier(attacker,"missile"));

  window.AdventurePartyCombatResults?.physicalHit?.(attacker,defender,damage);

  defender.hp=Math.max(
    0,
    defender.hp-damage
  );
  onUnitDamaged(defender,damage);

  await focusDamagedTargetIfOffscreen(defender,120,true);

  if(rawRoll===20){
    setCriticalRollNotification(
      attacker,
      defender,
      rawRoll,
      damage,
      false
    );
  }else{
    setCombatMessage(
      `${attacker.name} damages ${defender.name} for ${damage} damage`,
      COMBAT_MESSAGE_MIN_HOLD_MS,
      COMBAT_MESSAGE_DISPLAY_MS,
      defender.id==="player" ? "player-damage" : "normal"
    );
  }

  log(
    `${attacker.name} hits ${defender.name} from ${position.label} with ${attacker.rangedWeapon || "Longbow"} for ${damage} damage (${damageExpression}).`,
    "good"
  );

  flashAttack(attacker,defender,true);

  if(defender.hp<=0){
    defender.alive=false;

    if(rawRoll===20){
      setCriticalRollNotification(
        attacker,
        defender,
        rawRoll,
        damage,
        true
      );
    }else{
      setCombatMessage(
        `${defender.name} goes down and is dying`,
        COMBAT_MESSAGE_MIN_HOLD_MS,
        COMBAT_MESSAGE_DISPLAY_MS,
        defender.id==="player" ? "player-damage" : "normal"
      );
    }

    playAgonySound(defender);
    playDeathSound(defender);
    triggerDeathFx(defender);

    markEnemyNeutralized(defender);

    if(
      isKoboldUnit(defender) &&
      activeEnemies().length>0
    ){
      scheduleKoboldGroupMoraleCheck({
        casualties:1,
        magicCasualties:0,
        source:"Longbow"
      });
    }

    log(
      `${defender.name} is brought down by ${attacker.name}.`,
      "good"
    );

    updateUi();
    draw();

    if(checkCombatVictory()){
      return {
        hit:true,
        killed:true,
        damage
      };
    }

    return {
      hit:true,
      killed:true,
      damage
    };
  }

  updateUi();
  draw();

  return {
    hit:true,
    killed:false,
    damage
  };
}

async function resolveSlingHit(attacker,defender){
  if(game.over || !attacker.alive || !defender.alive) return false;

  if(Number.isFinite(attacker.missileAmmoQuantity) && attacker.missileAmmoQuantity<=0){
    setCombatMessage(`${attacker.name} is out of sling bullets.`);
    log(`${attacker.name} has no sling bullets remaining.`,"system");
    return false;
  }

  if(projectilePathBlocked(attacker,defender)){
    setCombatMessage(`${attacker.name} does not have a clear firing lane.`);
    return;
  }

  const range=slingRangeBand(attacker,defender);

  if(range.penalty===null){
    return;
  }

  const position=
    attackPositionData(attacker,defender);

  await focusRangedAttacker(attacker);

  setUnitActionBanner(attacker,`Preparing Sling — ${position.label}`);

  // Wind Up remains silent; the release SFX plays on the Attack frame.
  draw();

  /* Let the player hear/see the sling wind-up before release. */
  await sleep(430);

  if(game.over || !attacker.alive || !defender.alive) return;

  attacker.weaponInHand="ranged";
  setUnitActionBanner(attacker,"Firing Sling");

  await prepareUnitAttackWindup(attacker);
  triggerUnitAttackPose(attacker);
  playSlingReleaseSound();

  if(Number.isFinite(attacker.missileAmmoQuantity)){
    consumeMissileAmmo(attacker);
    updateUi();
  }

  breakInvisibility(attacker,"making a Sling attack");

  /* Roll the physical attack die BEFORE applying any modifier. */
  const rawRoll=d(20);

  const dexMissileAdjustment=
    attacker.stats?.dex !== undefined
      ? dexterityAdjustments(attacker.stats.dex).missile
      : 0;

  const totalAttackBonus=
    (attacker.missileAttackBonus||0)+
    dexMissileAdjustment+
    range.penalty+
    attackEffectModifier(attacker,defender);

  /* THAC0/AC target before range, Dexterity, or other attack modifiers. */
  const targetArmorClass=effectiveArmorClassForAttack(
    attacker,
    defender,
    "small-device-missile"
  );

  const targetNumber=
    attacker.thaco-targetArmorClass;

  const resolution=resolveMissileAttackD20(
    rawRoll,
    targetNumber,
    totalAttackBonus
  );

  playNaturalAttackRollSound(rawRoll);

  const hit=resolution.hit;

  setLastRoll(
    `${attacker.name} sling [${position.label}]: RAW d20 ${rawRoll}`+
    (
      resolution.automatic
        ? ` — ${resolution.automatic} (modifiers ignored); `
        : ` ${formatSignedAdjustment(totalAttackBonus)} = ${resolution.modifiedRoll} vs target ${targetNumber}; `
    )+
    `${range.band} ${range.distance} hexes `+
    `(range ${formatSignedAdjustment(range.penalty)}`+
    `${dexMissileAdjustment ? `, DEX missile ${formatSignedAdjustment(dexMissileAdjustment)}` : ""})`
  );

  await animateSlingProjectile(attacker,defender,hit);

  if(!hit){
    await focusRangedMissTarget(defender);

    playMissSound();
    if(rawRoll===1){
      setCriticalRollNotification(
        attacker,
        defender,
        rawRoll
      );
    }

    log(
      `${attacker.name} slings a ${attacker.missileAmmoCatalogId==="sling-bullet" ? "bullet" : "stone"} at ${defender.name} from ${position.label}, ${range.distance} hexes: `+
      `${resolution.automatic ? `raw d20 ${rawRoll}, automatic miss.` : `raw d20 ${rawRoll}, modified ${resolution.modifiedRoll} vs ${targetNumber}, miss.`}`,
      "bad"
    );

    flashAttack(attacker,defender,false);
    refreshTurnBanner();

    if(rawRoll===1){
      await waitForCombatActionPause();
    }

    return;
  }

  if(interceptWithMirrorImage(defender,attacker)){
    playMissSound();
    setCombatMessage(`${defender.name}'s Mirror Image is struck by the sling shot.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    flashAttack(attacker,defender,false);
    return;
  }

  playRockImpactSound();

  const damageExpression=missileDamageExpression(attacker,defender);
  const damageRoll=rollDiceExpression(damageExpression);
  const damage=Math.max(1,damageRoll.total+physicalDamageEffectModifier(attacker,"missile"));

  window.AdventurePartyCombatResults?.physicalHit?.(attacker,defender,damage);
  defender.hp=Math.max(0,defender.hp-damage);
  onUnitDamaged(defender,damage);

  await focusDamagedTargetIfOffscreen(defender,120,true);

  if(rawRoll===20){
    setCriticalRollNotification(
      attacker,
      defender,
      rawRoll,
      damage,
      false
    );
  }else{
    setCombatMessage(
      `${attacker.name} damages ${defender.name} for ${damage} damage`,
      COMBAT_MESSAGE_MIN_HOLD_MS,
      COMBAT_MESSAGE_DISPLAY_MS,
      defender.id==="player" ? "player-damage" : "normal"
    );
  }

  log(
    `${attacker.name} slings a ${attacker.missileAmmoCatalogId==="sling-bullet" ? "bullet" : "stone"} at ${defender.name} from ${position.label}, ${range.distance} hexes `+
    `(${range.band}) and hits for ${damage} damage (${damageExpression}).`,
    "bad"
  );

  flashAttack(attacker,defender,true);

  if(defender.hp<=0){
    defender.alive=false;

    if(rawRoll===20){
      setCriticalRollNotification(
        attacker,
        defender,
        rawRoll,
        damage,
        true
      );
    }else{
      setCombatMessage(
        `${defender.name} goes down and is dying`,
        COMBAT_MESSAGE_MIN_HOLD_MS,
        COMBAT_MESSAGE_DISPLAY_MS,
        defender.id==="player" ? "player-damage" : "normal"
      );
    }

    playAgonySound(defender);
    playDeathSound(defender);
    triggerDeathFx(defender);

    log(`${defender.name} is slain by a ${attacker.missileAmmoCatalogId==="sling-bullet" ? "sling bullet" : "sling stone"}.`,"bad");

    updateUi();
    draw();

    if(defender.faction==="player"){
      if(defender.id==="player"){
        ui.turnBanner.textContent="DUNGEON CRAWLER CARL FALLEN";
      }

      checkPartyDefeat();
    }

    await waitForCombatActionPause();
    return;
  }

  updateUi();
  refreshTurnBanner();
}
