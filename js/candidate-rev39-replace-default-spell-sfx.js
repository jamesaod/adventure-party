/*
  Candidate Rev 39 — custom spell SFX replace generic defaults
  =============================================================
  Candidate Rev 38 introduced signature procedural placeholder sounds for:
    - Tasha's Hideous Laughter
    - Taunt
    - Scare
    - Fog Cloud
    - Wall of Fog
    - Grease
    - Stinking Cloud

  Those sounds are replacements, not layers. This module suppresses the two
  engine-wide placeholder cues for those spells:
    - POR SFX #07 universal casting cue
    - DQK SFX #02 generic "spell effect takes hold" cue

  Spell-specific secondary reactions remain intact (for example Stinking Cloud
  cough/gag feedback).
*/

(()=>{
  "use strict";

  const R39_MODULE_ID=
    "candidate-rev39-replace-default-spell-sfx";

  const R39_REPLACEMENT_SPELL_IDS=
    new Set([
      "tashas-hideous-laughter",
      "taunt",
      "scare",
      "fog-cloud",
      "wall-of-fog",
      "grease",
      "stinking-cloud"
    ]);

  const R39_REPLACEMENT_AFFECT_IDS=
    new Set([
      "hideous-laughter",
      "taunt",
      "scare",
      "nauseated"
    ]);

  let r39SuppressPorCastDepth=0;
  let r39SuppressDqkAffectDepth=0;


  function r39SpellReplacesDefaultSfx(
    spellId
  ){
    return R39_REPLACEMENT_SPELL_IDS.has(
      String(spellId || "")
    );
  }


  function r39EffectReplacesDefaultAffectSfx(
    effectSpec
  ){
    if(!effectSpec){
      return false;
    }

    const id=
      String(
        effectSpec.id || ""
      );

    if(
      R39_REPLACEMENT_AFFECT_IDS.has(id)
    ){
      return true;
    }

    /*
      Grease's failed-save condition is represented by the generic "prone"
      debuff, so use the recorded source name to distinguish it from ordinary
      knockdowns that should still retain their established feedback.
    */
    if(
      id==="prone" &&
      String(
        effectSpec.data?.sourceName ||
        effectSpec.data?.source ||
        ""
      )==="Grease"
    ){
      return true;
    }

    return false;
  }


  /* ==========================================================
     POR #07 — UNIVERSAL CAST CUE REPLACEMENT
     ========================================================== */

  const r39BasePlayPor07CastingSound=
    playPor07CastingSound;

  playPor07CastingSound=function(){
    if(r39SuppressPorCastDepth>0){
      return false;
    }

    return r39BasePlayPor07CastingSound();
  };


  /*
    The final commitSpellCast wrapper knows which spell is resolving. Keep the
    suppression flag active while the earlier R225/R230 wrapper chain runs so
    any attempted universal POR #07 playback becomes a no-op.
  */
  const r39BaseCommitSpellCast=
    commitSpellCast;

  commitSpellCast=function(
    caster,
    spell,
    action,
    durationMs=1800
  ){
    const suppress=
      r39SpellReplacesDefaultSfx(
        spell?.id ||
        action?.spellId
      );

    if(suppress){
      r39SuppressPorCastDepth++;
    }

    try{
      return r39BaseCommitSpellCast(
        caster,
        spell,
        action,
        durationMs
      );
    }finally{
      if(suppress){
        r39SuppressPorCastDepth=
          Math.max(
            0,
            r39SuppressPorCastDepth-1
          );
      }
    }
  };


  /*
    The Spell Previewer has its own explicit pre-cast POR #07 button-path via
    window.AdventurePartyCastingSound.play(). Suppress that preview harness cue
    for the replacement spells as well.
  */
  if(
    window.AdventurePartyCastingSound &&
    typeof window.AdventurePartyCastingSound.play===
      "function"
  ){
    const r39BasePreviewCastingSoundPlay=
      window.AdventurePartyCastingSound.play;

    window.AdventurePartyCastingSound.play=
    function(){
      const previewSpellId=
        (
          typeof spellPreviewSelectedId!==
            "undefined"
        )
          ? spellPreviewSelectedId
          : null;

      if(
        currentScreen==="spell-preview" &&
        r39SpellReplacesDefaultSfx(
          previewSpellId
        )
      ){
        return false;
      }

      return r39BasePreviewCastingSoundPlay();
    };
  }


  /* ==========================================================
     DQK #02 — GENERIC SUCCESSFUL SPELL-AFFECT REPLACEMENT
     ========================================================== */

  const r39BasePlayDqkSpellAffectSound=
    playDqkSpellAffectSound;

  playDqkSpellAffectSound=function(){
    if(r39SuppressDqkAffectDepth>0){
      return false;
    }

    return r39BasePlayDqkSpellAffectSound();
  };


  /*
    Candidate Rev 10 detects hostile debuffs inside its addUnitEffect wrapper
    and calls the global DQK #02 player. Wrap the final addUnitEffect chain and
    hold suppression only around effects owned by the new custom-sound spells.
  */
  const r39BaseAddUnitEffect=
    addUnitEffect;

  addUnitEffect=function(
    unit,
    effectSpec
  ){
    const suppress=
      r39EffectReplacesDefaultAffectSfx(
        effectSpec
      );

    if(suppress){
      r39SuppressDqkAffectDepth++;
    }

    try{
      return r39BaseAddUnitEffect(
        unit,
        effectSpec
      );
    }finally{
      if(suppress){
        r39SuppressDqkAffectDepth=
          Math.max(
            0,
            r39SuppressDqkAffectDepth-1
          );
      }
    }
  };


  window.AdventurePartySpellSfxReplacement={
    release:"Candidate Rev 39",
    moduleId:R39_MODULE_ID,
    replacementSpellIds:
      [...R39_REPLACEMENT_SPELL_IDS],
    replacementAffectIds:
      [...R39_REPLACEMENT_AFFECT_IDS],
    suppresses:{
      universalPorCast:7,
      genericDqkSpellAffect:2
    },
    state:()=>({
      porCastSuppressionDepth:
        r39SuppressPorCastDepth,
      dqkAffectSuppressionDepth:
        r39SuppressDqkAffectDepth
    })
  };
})();
