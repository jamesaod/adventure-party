/* ============================================================
   REPLACE R226 PLAYER AUTO-FIRE, PRESERVE AUTOMATED QUICK/NPC MODE
   ============================================================ */

const r227BaseResolveMinuteMeteorsTurn=r226ResolveMinuteMeteorsTurn;
r226ResolveMinuteMeteorsTurn=async function(actor){
  if(r227PlayerDirectsMeteors(actor)){
    /* Never take over a normal player-controlled turn. */
    return false;
  }
  return await r227BaseResolveMinuteMeteorsTurn(actor);
};

const r227BaseCastMinuteMeteors=r226CastMinuteMeteors;
r226CastMinuteMeteors=async function(action,target){
  const caster=spellCasterForAction(action);

  if(!r227PlayerDirectsMeteors(caster)){
    return await r227BaseCastMinuteMeteors(action,target);
  }

  if(action?.meteorVolley){
    return await r227SelectMinuteMeteorTarget(action,target);
  }

  const existing=r227MinuteMeteorEffect(caster);
  if(existing){
    return r227BeginMinuteMeteorTargeting(caster,existing);
  }

  const spell=getSpellEntry("melfs-minute-meteors");
  const level=Math.max(
    1,
    Number(action?.casterLevel)||
    Number(caster?.level)||
    TEST_SPELL_CASTER_LEVEL
  );

  spellCastInProgress=true;
  if(!commitSpellCast(caster,spell,action)){
    return await finishFailedSpellCommit(caster,action);
  }

  pendingAimAction=null;
  exitAimMode(false,false);
  setUnitActionBanner(caster,"Casting Melf's Minute Meteors");

  const effect=addUnitEffect(caster,{
    id:"minute-meteors",
    name:"Minute Meteors",
    kind:"buff",
    expiresRound:null,
    detail:
      `${level} meteor${level===1?"":"s"} ready; `+
      "assign up to five targets per volley",
    data:{
      sourceUnitId:caster.id,
      casterLevel:level,
      remaining:level,
      lastVolleyRound:null,
      mode:"five-per-round-player-targeted"
    }
  });

  await animateMagicEffectOnUnits(
    [caster],
    "minute-meteors"
  );

  setCombatMessage(
    `${level} Minute Meteor${level===1?" forms":"s form"} around ${caster.name}. `+
    `Assign ${Math.min(5,level)} target${Math.min(5,level)===1?"":"s"} for the first volley.`
  );

  return r227BeginMinuteMeteorTargeting(
    caster,
    effect,
    {fromInitialCast:true,originAction:action}
  );
};


/* ============================================================
   CAST MENU: STORED METEORS ARE A DELIBERATE RELEASE ACTION
   ============================================================ */

const r227BaseRenderSpellCastList=renderSpellCastList;
renderSpellCastList=function(){
  r227BaseRenderSpellCastList();

  const caster=activePlayerControlledUnit() || game?.player;
  if(!r227PlayerDirectsMeteors(caster)) return;

  const effect=r227MinuteMeteorEffect(caster);
  if(!effect) return;

  const remaining=r227MinuteMeteorRemaining(effect);
  if(remaining<=0) return;

  const list=document.getElementById("spellCastList");
  const subtitle=document.getElementById("spellCastSubtitle");
  if(!list) return;

  /* While a stored pool exists, the Melf entry means RELEASE, not consume
     another memorized copy and create a second pool. */
  for(const button of list.querySelectorAll('[data-cast-spell="melfs-minute-meteors"]')){
    button.remove();
  }

  const volley=Math.min(5,remaining);
  const button=document.createElement("button");
  button.className="spell-cast-choice";
  button.type="button";
  button.dataset.castSpell="melfs-minute-meteors";
  button.dataset.minuteMeteorsRelease="true";
  button.innerHTML=
    `<b>Release Minute Meteors — ${remaining} remaining</b>`+
    `<span>Assign ${volley} meteor target${volley===1?"":"s"}; repeated targets allowed</span>`+
    `<span>All ${volley} launch together after the final target is selected</span>`;

  list.prepend(button);

  if(subtitle){
    subtitle.textContent=
      `${subtitle.textContent} Stored Minute Meteors are released manually; they never auto-fire.`;
  }
};

const r227BaseBeginSelectedCombatSpell=beginSelectedCombatSpell;
beginSelectedCombatSpell=function(spellId){
  const caster=activePlayerControlledUnit();
  if(
    spellId==="melfs-minute-meteors" &&
    r227PlayerDirectsMeteors(caster)
  ){
    const effect=r227MinuteMeteorEffect(caster);
    if(effect){
      return r227BeginMinuteMeteorTargeting(caster,effect);
    }
  }
  return r227BaseBeginSelectedCombatSpell(spellId);
};


