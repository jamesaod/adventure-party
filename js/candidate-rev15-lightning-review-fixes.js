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

  const LIGHTNING_BOLT_SFX=Object.freeze({
    url:"assets/audio/sfx/spells/mixkit-futuristic-electricity-sparks-2598.wav",
    gain:0.90
  });

  let lightningRawBuffer=null;
  let lightningDecodedBuffer=null;
  let lightningDecodedContext=null;
  let lightningDecodePromise=null;

  function primeLightningBoltSfx(){
    if(lightningRawBuffer) return;

    fetch(LIGHTNING_BOLT_SFX.url)
      .then(response=>{
        if(!response.ok){
          throw new Error(
            "Lightning Bolt SFX failed to load: HTTP "+response.status
          );
        }
        return response.arrayBuffer();
      })
      .then(buffer=>{
        lightningRawBuffer=buffer;
      })
      .catch(error=>{
        console.error(error);
      });
  }

  function decodedLightningBoltSfx(){
    if(!audioCtx || !audioReady){
      return Promise.resolve(null);
    }

    if(
      lightningDecodedBuffer &&
      lightningDecodedContext===audioCtx
    ){
      return Promise.resolve(
        lightningDecodedBuffer
      );
    }

    if(lightningDecodePromise){
      return lightningDecodePromise;
    }

    const acquire=
      lightningRawBuffer
        ? Promise.resolve(lightningRawBuffer)
        : fetch(LIGHTNING_BOLT_SFX.url)
            .then(response=>{
              if(!response.ok){
                throw new Error(
                  "Lightning Bolt SFX failed to load: HTTP "+response.status
                );
              }
              return response.arrayBuffer();
            })
            .then(buffer=>{
              lightningRawBuffer=buffer;
              return buffer;
            });

    lightningDecodePromise=
      acquire
        .then(buffer=>
          audioCtx.decodeAudioData(
            buffer.slice(0)
          )
        )
        .then(decoded=>{
          lightningDecodedBuffer=decoded;
          lightningDecodedContext=audioCtx;
          lightningDecodePromise=null;
          return decoded;
        })
        .catch(error=>{
          lightningDecodePromise=null;
          console.error(error);
          return null;
        });

    return lightningDecodePromise;
  }

  function playLightningBoltSample(){
    queueSfx(()=>{
      decodedLightningBoltSfx()
        .then(buffer=>{
          if(
            !buffer ||
            !audioCtx ||
            !audioReady ||
            !sfxGain
          ){
            return;
          }

          const source=
            audioCtx.createBufferSource();

          const gain=
            audioCtx.createGain();

          source.buffer=buffer;

          gain.gain.setValueAtTime(
            LIGHTNING_BOLT_SFX.gain,
            audioCtx.currentTime
          );

          source.connect(gain);
          gain.connect(sfxGain);
          source.start();
        });
    });

    return true;
  }

  const baseMagicEffectSound=
    playMagicEffectSound;

  playMagicEffectSound=function(kind="generic",index=0){
    if(kind==="lightning"){
      return playLightningBoltSample();
    }

    return baseMagicEffectSound(
      kind,
      index
    );
  };

  primeLightningBoltSfx();

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
    suppressExistingLightningEffectCue:true,
    replacementSfx:LIGHTNING_BOLT_SFX.url
  };
})();
