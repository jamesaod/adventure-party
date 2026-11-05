/* Prepared spell action owner (classic-script module using shared engine services).
 * Public environmental admission remains castPreparedCombatSpell.
 * Explicit call order: sound context -> caster focus -> completion cleanup ->
 * casting context -> extended/core dispatch -> existing per-spell resolver.
 * Scheduled non-interactive completion intentionally enters dispatchPreparedSpellEffect
 * directly, as before: do not restart casting, focus or completion-target selection.
 */
async function resolvePreparedSpellAction(
  action,
  targetHex,
  targetUnit
){
  const previous=
    candidateRev10ResolvingSpellId;

  candidateRev10ResolvingSpellId=
    action?.spellId || null;

  try{
    return await resolveSpellCasterFocus(
      action,
      targetHex,
      targetUnit
    );
  }finally{
    candidateRev10ResolvingSpellId=
      previous;
  }
}

async function resolveSpellCasterFocus(
  action,
  targetHex,
  targetUnit
){
  const caster=
    spellCasterForAction(action);

  if(
    r233IsCombatSpellAction(action) &&
    caster?.alive &&
    !action.r233SkipCasterFocus
  ){
    await r233FocusCaster(
      caster,
      action.spellId
    );
  }

  return await resolveSpellCompletionTarget(
    action,
    targetHex,
    targetUnit
  );
}

async function resolveSpellCompletionTarget(
  action,
  targetHex,
  targetUnit
){
  const completionTargeting=
    !!action?.r231CompletionTargeting;

  const token=
    action?.r231CastingToken || null;

  const caster=
    completionTargeting
      ? spellCasterForAction(action)
      : null;

  const resolved=
    await resolveSpellCastContext(
      action,
      targetHex,
      targetUnit
    );

  /*
    A false result means range/LOS/target validation rejected this choice before
    the spell was committed. Keep AIM active and let the player choose again.
  */
  if(
    completionTargeting &&
    resolved
  ){
    r231CleanupCompletionRecord(
      token,
      caster
    );
  }

  return resolved;
}

async function resolveSpellCastContext(
  action,
  targetHex,
  targetUnit
){
  if(action?.r230Completing){
    return await dispatchPreparedSpellEffect(
      action,
      targetHex,
      targetUnit
    );
  }

  const previousContext=r230CastContext;

  r230CastContext={
    action,
    targetHex:targetHex
      ? {x:targetHex.x,y:targetHex.y}
      : null,
    targetUnitId:targetUnit?.id || null
  };

  try{
    return await dispatchPreparedSpellEffect(
      action,
      targetHex,
      targetUnit
    );
  }finally{
    r230CastContext=previousContext;
  }
}

async function dispatchPreparedSpellEffect(action,targetHex,targetUnit){
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
      return await dispatchCoreSpellEffect(action,targetHex,targetUnit);
  }
}

async function dispatchCoreSpellEffect(action,targetHex,targetUnit){
  const spell=getSpellEntry(action?.spellId);
  if(!spell) return false;

  action={...action,castTargetHex:targetHex};
  if(action?.type==='priest-spell')return castPriestCombatSpell(action,targetHex,targetUnit);
  switch(spell.id){
    case "magic-missile": return await castMagicMissileFromScroll(action,targetUnit);
    case "armor": return await castArmorSpell(action,targetUnit);
    case "burning-hands": return await castBurningHandsSpell(action,targetHex);
    case "charm-person": return await castCharmPersonSpell(action,targetUnit);
    case "chill-touch": return await castChillTouchSpell(action);
    case "color-spray": return await castColorSpraySpell(action,targetHex);
    case "enlarge": return await castEnlargeSpell(action,targetUnit);
    case "grease": return await castGreaseSpell(action,targetHex);
    case "light": return await castLightSpell(action,targetUnit);
    case "protection-from-evil": return await castProtectionFromEvilSpell(action,targetUnit);
    case "shield": return await castShieldSpell(action);
    case "shocking-grasp": return await castShockingGraspSpell(action,targetUnit);
    case "sleep": return await castSleepSpell(action,targetHex);
    case "spook": return await castSpookSpell(action,targetUnit);
    case "taunt": return await castTauntSpell(action,targetUnit);
    case "wall-of-fog": return await castWallOfFogSpell(action,targetHex);

    case "blindness": return await castBlindnessSpell(action,targetUnit);
    case "blur": return await castBlurSpell(action);
    case "continual-light": return await castContinualLightSpell(action,targetHex,targetUnit);
    case "darkness-15-radius": return await castDarknessSpell(action,targetHex);
    case "deafness": return await castDeafnessSpell(action,targetUnit);
    case "detect-invisibility": return await castDetectInvisibilitySpell(action);
    case "flaming-sphere": return await castFlamingSphereSpell(action,targetHex);
    case "fog-cloud": return await castFogCloudSpell(action,targetHex);
    case "glitterdust": return await castGlitterdustSpell(action,targetHex);
    case "hypnotic-pattern": return await castHypnoticPatternSpell(action,targetHex);
    case "invisibility": return await castInvisibilitySpell(action,targetUnit);
    case "melfs-acid-arrow": return await castMelfsAcidArrowSpell(action,targetUnit);
    case "mirror-image": return await castMirrorImageSpell(action);
    case "pyrotechnics": return await castPyrotechnicsSpell(action,targetHex);
    case "ray-of-enfeeblement": return await castRayOfEnfeeblementSpell(action,targetUnit);
    case "scare": return await castScareSpell(action,targetHex);
    case "spectral-hand": return await castSpectralHandSpell(action);
    case "stinking-cloud": return await castStinkingCloudSpell(action,targetHex);
    case "strength": return await castStrengthSpell(action,targetUnit);
    case "tashas-hideous-laughter": return await castTashasHideousLaughterSpell(action,targetHex);
    case "web": return await castWebSpell(action,targetHex);

    case "fireball": return await castFireballFromScroll(action,targetHex);
  }

  return false;
}
