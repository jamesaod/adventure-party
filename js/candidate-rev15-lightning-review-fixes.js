/*
  Rev 15 queue — Lightning Bolt review fixes
  -------------------------------------------
  Kept on the development branch until the user's remaining Lightning Bolt
  review changes are collected.

  1) Clear the persistent completion-target AIM prompt as soon as Lightning
     Bolt resolution begins.
  2) Suppress the universal Pool of Radiance casting cue for Lightning Bolt
     only. The existing lightning-effect cue remains in place until the
     replacement lightning/shock asset is selected.
*/
(()=>{
  "use strict";

  let suppressLightningUniversalCastCue=false;

  const basePor07CastingSound=playPor07CastingSound;
  playPor07CastingSound=function(){
    if(suppressLightningUniversalCastCue){
      return;
    }
    return basePor07CastingSound();
  };

  const baseCommitSpellCast=commitSpellCast;
  commitSpellCast=function(caster,spell,action){
    const suppress=spell?.id==="lightning-bolt";

    if(!suppress){
      return baseCommitSpellCast(caster,spell,action);
    }

    suppressLightningUniversalCastCue=true;
    try{
      return baseCommitSpellCast(caster,spell,action);
    }finally{
      suppressLightningUniversalCastCue=false;
    }
  };

  const baseLightningBoltCast=r226CastLightningBolt;
  r226CastLightningBolt=async function(action,targetHex){
    /*
      R231 target-at-completion prompts use displayMs=0 intentionally, making
      them persistent while AIM is active. Once the player commits the target,
      that instruction has served its purpose and must be removed before the
      production casting/VFX sequence begins.
    */
    clearCombatMessage();

    return await baseLightningBoltCast(
      action,
      targetHex
    );
  };

  window.AdventurePartyLightningReviewFixes={
    queued:true,
    clearPersistentAimPrompt:true,
    suppressUniversalCastingCue:true,
    suppressExistingLightningEffectCue:false
  };
})();
