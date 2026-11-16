/*
  Candidate Rev 38 — placeholder spell SFX + Grease VFX
  =====================================================
  Procedural Web Audio placeholders for:
    - Tasha's Hideous Laughter
    - Taunt
    - Scare
    - Fog Cloud
    - Wall of Fog
    - Grease
    - Stinking Cloud comic gas accent

  Grease also receives a persistent animated oily-surface VFX.

  These are development placeholders only. They use the shared SFX bus and
  production spell paths so combat and the Spell Previewer stay aligned.
*/

(()=>{
  "use strict";

  const R38_MODULE_ID=
    "candidate-rev38-placeholder-spell-sfx-grease-vfx";

  let greaseFrame=null;

  function r38ScheduleTone({
    type="sine",
    startHz=440,
    endHz=220,
    delay=0,
    duration=0.35,
    gain=0.06,
    attack=0.012,
    filterType=null,
    filterHz=1200,
    filterQ=0.8,
    detune=0
  }={}){
    if(!audioCtx || !audioReady) return;

    const start=
      audioCtx.currentTime+
      Math.max(0,delay);

    const osc=
      audioCtx.createOscillator();

    const amp=
      audioCtx.createGain();

    let destination=amp;

    osc.type=type;
    osc.detune.setValueAtTime(detune,start);
    osc.frequency.setValueAtTime(
      Math.max(20,startHz),
      start
    );
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20,endHz),
      start+Math.max(0.02,duration)
    );

    if(filterType){
      const filter=
        audioCtx.createBiquadFilter();

      filter.type=filterType;
      filter.frequency.setValueAtTime(
        Math.max(30,filterHz),
        start
      );
      filter.Q.setValueAtTime(
        Math.max(0.01,filterQ),
        start
      );

      osc.connect(filter);
      filter.connect(amp);
      destination=null;
    }

    if(destination){
      osc.connect(amp);
    }

    amp.gain.setValueAtTime(
      0.0001,
      start
    );
    amp.gain.exponentialRampToValueAtTime(
      Math.max(0.0002,gain),
      start+Math.max(0.004,attack)
    );
    amp.gain.exponentialRampToValueAtTime(
      0.0001,
      start+duration
    );

    amp.connect(sfxGain);

    osc.start(start);
    osc.stop(start+duration+0.03);
  }


  function r38PlayLaughterSound(index=0){
    queueSfx(()=>{
      const variation=
        1+
        ((index%5)-2)*0.025;

      const pulses=[
        {delay:0.00,hz:315,dur:0.13},
        {delay:0.15,hz:355,dur:0.12},
        {delay:0.30,hz:292,dur:0.14},
        {delay:0.47,hz:382,dur:0.17}
      ];

      for(
        let i=0;
        i<pulses.length;
        i++
      ){
        const p=pulses[i];

        r38ScheduleTone({
          type:
            i%2
              ? "triangle"
              : "sawtooth",
          startHz:p.hz*variation,
          endHz:
            p.hz*
            (i%2 ? 1.22 : 0.86)*
            variation,
          delay:p.delay,
          duration:p.dur,
          gain:
            i===pulses.length-1
              ? 0.060
              : 0.052,
          attack:0.012,
          filterType:"bandpass",
          filterHz:
            900+
            i*115,
          filterQ:1.25
        });

        noiseVoice(
          p.dur*0.72,
          0.020,
          "bandpass",
          1450+i*120,
          1.0,
          p.delay+0.008
        );
      }
    });
  }


  function r38PlayTauntSound(){
    queueSfx(()=>{
      /*
        Two short rough "jeer/growl" bursts. Deliberately non-verbal so this
        remains a lightweight placeholder and does not imply recorded speech.
      */
      r38ScheduleTone({
        type:"sawtooth",
        startHz:235,
        endHz:112,
        delay:0,
        duration:0.24,
        gain:0.082,
        attack:0.006,
        filterType:"bandpass",
        filterHz:690,
        filterQ:1.15
      });

      r38ScheduleTone({
        type:"square",
        startHz:188,
        endHz:92,
        delay:0.20,
        duration:0.20,
        gain:0.055,
        attack:0.006,
        filterType:"lowpass",
        filterHz:720,
        filterQ:0.7
      });

      noiseVoice(
        0.11,
        0.045,
        "bandpass",
        820,
        0.85,
        0.02
      );
      noiseVoice(
        0.09,
        0.035,
        "bandpass",
        620,
        0.75,
        0.22
      );
    });
  }


  function r38PlayScareSound(){
    queueSfx(()=>{
      /*
        Dissonant upward stinger followed by a low falling body and airy scrape.
      */
      r38ScheduleTone({
        type:"triangle",
        startHz:510,
        endHz:1280,
        delay:0,
        duration:0.46,
        gain:0.060,
        attack:0.012,
        filterType:"bandpass",
        filterHz:1450,
        filterQ:1.1
      });

      r38ScheduleTone({
        type:"sine",
        startHz:152,
        endHz:58,
        delay:0.13,
        duration:0.55,
        gain:0.070,
        attack:0.035,
        filterType:"lowpass",
        filterHz:410,
        filterQ:0.6
      });

      r38ScheduleTone({
        type:"triangle",
        startHz:765,
        endHz:430,
        delay:0.06,
        duration:0.42,
        gain:0.032,
        attack:0.02,
        filterType:"bandpass",
        filterHz:1180,
        filterQ:1.4,
        detune:-19
      });

      noiseVoice(
        0.58,
        0.042,
        "highpass",
        1800,
        0.6,
        0.03
      );
    });
  }


  function r38PlayFogCloudSound(){
    queueSfx(()=>{
      /*
        Soft, broad mist expansion: filtered air plus a quiet low body.
      */
      noiseVoice(
        0.92,
        0.055,
        "bandpass",
        760,
        0.55,
        0
      );
      noiseVoice(
        0.72,
        0.026,
        "highpass",
        1800,
        0.5,
        0.15
      );

      r38ScheduleTone({
        type:"sine",
        startHz:118,
        endHz:74,
        delay:0,
        duration:0.88,
        gain:0.042,
        attack:0.08,
        filterType:"lowpass",
        filterHz:280,
        filterQ:0.55
      });
    });
  }


  function r38PlayWallOfFogSound(){
    queueSfx(()=>{
      /*
        Longer lateral "whoosh" than Fog Cloud, suggesting a wall forming
        across the battlefield.
      */
      noiseVoice(
        1.18,
        0.060,
        "bandpass",
        920,
        0.45,
        0
      );
      noiseVoice(
        0.98,
        0.042,
        "bandpass",
        1250,
        0.65,
        0.12
      );
      noiseVoice(
        0.55,
        0.025,
        "highpass",
        2500,
        0.5,
        0.30
      );

      r38ScheduleTone({
        type:"sine",
        startHz:132,
        endHz:66,
        delay:0.02,
        duration:1.12,
        gain:0.050,
        attack:0.09,
        filterType:"lowpass",
        filterHz:330,
        filterQ:0.55
      });
    });
  }


  function r38PlayGreaseSound(){
    queueSfx(()=>{
      /*
        Wet magical "splat/slick" cue: low pitch drop with short damp noise.
      */
      r38ScheduleTone({
        type:"triangle",
        startHz:205,
        endHz:58,
        delay:0,
        duration:0.36,
        gain:0.075,
        attack:0.006,
        filterType:"lowpass",
        filterHz:460,
        filterQ:0.85
      });

      r38ScheduleTone({
        type:"sine",
        startHz:134,
        endHz:86,
        delay:0.17,
        duration:0.22,
        gain:0.044,
        attack:0.008,
        filterType:"bandpass",
        filterHz:310,
        filterQ:0.8
      });

      noiseVoice(
        0.19,
        0.062,
        "lowpass",
        780,
        0.55,
        0.015
      );
      noiseVoice(
        0.14,
        0.034,
        "bandpass",
        1180,
        0.85,
        0.17
      );
    });
  }


  function r38PlayStinkingCloudFartSound(){
    queueSfx(()=>{
      /*
        Intentionally comic QA placeholder. Keep it low, brief, and tucked
        under the existing magical Stinking Cloud swell.
      */
      const base=
        audioCtx.currentTime+
        0.11;

      const osc=
        audioCtx.createOscillator();
      const wobble=
        audioCtx.createOscillator();
      const wobbleGain=
        audioCtx.createGain();
      const filter=
        audioCtx.createBiquadFilter();
      const gain=
        audioCtx.createGain();

      osc.type="sawtooth";
      osc.frequency.setValueAtTime(
        122,
        base
      );
      osc.frequency.exponentialRampToValueAtTime(
        61,
        base+0.48
      );

      wobble.type="sine";
      wobble.frequency.setValueAtTime(
        17,
        base
      );
      wobble.frequency.exponentialRampToValueAtTime(
        10,
        base+0.46
      );

      wobbleGain.gain.setValueAtTime(
        15,
        base
      );
      wobbleGain.gain.exponentialRampToValueAtTime(
        5,
        base+0.46
      );

      wobble.connect(wobbleGain);
      wobbleGain.connect(
        osc.frequency
      );

      filter.type="lowpass";
      filter.frequency.setValueAtTime(
        420,
        base
      );
      filter.frequency.exponentialRampToValueAtTime(
        230,
        base+0.48
      );
      filter.Q.setValueAtTime(
        0.9,
        base
      );

      gain.gain.setValueAtTime(
        0.0001,
        base
      );
      gain.gain.exponentialRampToValueAtTime(
        0.078,
        base+0.018
      );
      gain.gain.setValueAtTime(
        0.060,
        base+0.22
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        base+0.50
      );

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(sfxGain);

      osc.start(base);
      wobble.start(base);
      osc.stop(base+0.52);
      wobble.stop(base+0.52);

      noiseVoice(
        0.18,
        0.042,
        "bandpass",
        360,
        0.75,
        0.13
      );
      noiseVoice(
        0.10,
        0.030,
        "bandpass",
        520,
        0.70,
        0.34
      );
    });
  }


  /*
    Route signature placeholder spell sounds through the existing production
    magic-effect entry point. All other effect kinds retain the prior audio.
  */
  const r38BasePlayMagicEffectSound=
    playMagicEffectSound;

  playMagicEffectSound=function(
    kind="generic",
    index=0
  ){
    switch(kind){
      case "laughter":
        return r38PlayLaughterSound(index);
      case "taunt":
        return r38PlayTauntSound();
      case "scare":
      case "fear":
        return r38PlayScareSound();
      case "fog-cloud":
        return r38PlayFogCloudSound();
      case "wall-of-fog":
        return r38PlayWallOfFogSound();
      case "grease":
        return r38PlayGreaseSound();
      default:
        return r38BasePlayMagicEffectSound(
          kind,
          index
        );
    }
  };


  /*
    Preserve the established magical Stinking Cloud cast sound, then layer the
    intentionally comic low gas accent beneath it.
  */
  const r38BaseStinkingCloudCastSound=
    playStinkingCloudCastSound;

  playStinkingCloudCastSound=function(){
    r38BaseStinkingCloudCastSound();
    r38PlayStinkingCloudFartSound();
  };


  /* ==========================================================
     GREASE PERSISTENT VFX
     ========================================================== */

  function r38Hash01(a,b,c){
    let n=(
      Math.imul((a|0)+4099,73856093) ^
      Math.imul((b|0)-8191,19349663) ^
      Math.imul((c|0)+131,83492791)
    )>>>0;

    n^=n>>>13;
    n=Math.imul(
      n,
      1274126177
    )>>>0;
    n^=n>>>16;

    return n/4294967295;
  }


  function r38DrawGreaseCell(
    cell,
    effect
  ){
    if(
      !cell ||
      !inside(cell.x,cell.y)
    ){
      return;
    }

    const vertices=
      hexScreenVertices(
        cell.x,
        cell.y
      );

    const center=
      hexCenter(
        cell.x,
        cell.y
      );

    const now=
      performance.now();

    const phase=
      now*0.0016+
      cell.x*0.71+
      cell.y*0.53;

    ctx.save();

    /*
      Clip every animated component to the tactical hex. The base engine's old
      faint ochre wash remains underneath; this pass supplies the readable oil.
    */
    polygonPath(vertices);
    ctx.clip();

    const drift=
      Math.sin(phase)*
      HEX_W*0.16;

    const surface=
      ctx.createLinearGradient(
        center.x-HEX_W*0.55+drift,
        center.y-HEX_H*0.18,
        center.x+HEX_W*0.55+drift,
        center.y+HEX_H*0.20
      );

    surface.addColorStop(
      0,
      "rgba(39,35,19,0.54)"
    );
    surface.addColorStop(
      0.34,
      "rgba(90,82,34,0.48)"
    );
    surface.addColorStop(
      0.54,
      "rgba(181,165,73,0.38)"
    );
    surface.addColorStop(
      0.68,
      "rgba(71,66,31,0.52)"
    );
    surface.addColorStop(
      1,
      "rgba(31,30,19,0.58)"
    );

    ctx.fillStyle=surface;
    ctx.fillRect(
      center.x-HEX_W*0.60,
      center.y-HEX_H*0.42,
      HEX_W*1.20,
      HEX_H*0.84
    );

    /*
      Moving narrow specular streaks make the surface unmistakably slick.
    */
    ctx.globalCompositeOperation=
      "lighter";

    for(let i=0;i<6;i++){
      const seed=
        r38Hash01(
          cell.x,
          cell.y,
          i
        );

      const q=
        (
          seed+
          now*0.00020*
          (0.65+i*0.09)
        )%1;

      const px=
        center.x+
        (q-0.5)*
        HEX_W*0.92;

      const py=
        center.y+
        (seed-0.5)*
        HEX_H*0.46+
        Math.sin(
          phase+
          i*1.7
        )*
        2.2;

      const alpha=
        0.12+
        0.13*
        (
          0.5+
          0.5*
          Math.sin(
            phase*1.4+
            i*1.3
          )
        );

      ctx.strokeStyle=
        "rgba(238,225,139,"+
        alpha+
        ")";

      ctx.lineWidth=
        i%3===0
          ? 2
          : 1;

      ctx.beginPath();
      ctx.moveTo(
        px-9,
        py+2
      );
      ctx.quadraticCurveTo(
        px,
        py-3,
        px+11,
        py
      );
      ctx.stroke();
    }

    /*
      Small rising/dissolving bubbles add motion without reading as water.
    */
    ctx.globalCompositeOperation=
      "source-over";

    for(let i=0;i<5;i++){
      const seed=
        r38Hash01(
          cell.x+17,
          cell.y-11,
          i+23
        );

      const cycle=
        (
          seed+
          now*0.00036*
          (0.72+i*0.11)
        )%1;

      const px=
        center.x+
        (seed-0.5)*
        HEX_W*0.62;

      const py=
        center.y+
        HEX_H*0.16-
        cycle*
        HEX_H*0.32;

      const radius=
        1.6+
        (1-cycle)*
        2.0;

      const alpha=
        0.28*
        (1-cycle);

      ctx.strokeStyle=
        "rgba(223,205,112,"+
        alpha+
        ")";

      ctx.lineWidth=1;
      ctx.beginPath();
      ctx.arc(
        px,
        py,
        radius,
        0,
        Math.PI*2
      );
      ctx.stroke();
    }

    ctx.restore();

    /*
      Strong but restrained perimeter so the affected tactical hex is readable
      against both indoor floors and outdoor grass.
    */
    ctx.save();
    polygonPath(vertices);
    ctx.strokeStyle=
      "rgba(208,190,91,0.72)";
    ctx.lineWidth=1.5;
    ctx.stroke();
    ctx.restore();
  }


  function r38DrawGreaseVfx(){
    if(
      !game?.areaEffects?.length
    ){
      return;
    }

    if(
      typeof spellPreviewVisualsSuppressed===
        "function" &&
      spellPreviewVisualsSuppressed()
    ){
      return;
    }

    for(
      const effect of
      game.areaEffects
    ){
      if(effect?.type!=="grease"){
        continue;
      }

      for(
        const cell of
        effect.cells || []
      ){
        r38DrawGreaseCell(
          cell,
          effect
        );
      }
    }
  }


  const r38BaseDrawSpellAreaEffects=
    drawSpellAreaEffects;

  drawSpellAreaEffects=function(){
    r38BaseDrawSpellAreaEffects();
    r38DrawGreaseVfx();
  };


  function r38HasGrease(){
    return !!(
      game?.areaEffects?.some(
        effect=>
          effect?.type==="grease"
      )
    );
  }


  function r38GreaseTick(){
    greaseFrame=null;

    if(
      !game ||
      game.over ||
      ![
        "combat",
        "spell-preview"
      ].includes(currentScreen) ||
      !r38HasGrease()
    ){
      return;
    }

    draw();

    greaseFrame=
      requestAnimationFrame(
        r38GreaseTick
      );
  }


  function r38EnsureGreaseLoop(){
    if(
      greaseFrame!==null ||
      !r38HasGrease()
    ){
      return;
    }

    greaseFrame=
      requestAnimationFrame(
        r38GreaseTick
      );
  }


  const r38BaseAddAreaEffect=
    addAreaEffect;

  addAreaEffect=function(effectSpec){
    const effect=
      r38BaseAddAreaEffect(
        effectSpec
      );

    if(effect?.type==="grease"){
      r38EnsureGreaseLoop();
    }

    return effect;
  };


  if(
    typeof spellPreviewClearTransientPresentation===
      "function"
  ){
    const r38BasePreviewClear=
      spellPreviewClearTransientPresentation;

    spellPreviewClearTransientPresentation=
    function(){
      if(greaseFrame!==null){
        cancelAnimationFrame(
          greaseFrame
        );
        greaseFrame=null;
      }

      return r38BasePreviewClear();
    };
  }


  window.AdventurePartyPlaceholderSpellSfx={
    release:"Candidate Rev 38",
    moduleId:R38_MODULE_ID,
    laughter:r38PlayLaughterSound,
    taunt:r38PlayTauntSound,
    scare:r38PlayScareSound,
    fogCloud:r38PlayFogCloudSound,
    wallOfFog:r38PlayWallOfFogSound,
    grease:r38PlayGreaseSound,
    stinkingCloudGas:r38PlayStinkingCloudFartSound
  };

  window.AdventurePartyGreaseVfx={
    release:"Candidate Rev 38",
    active:()=>r38HasGrease(),
    ensure:r38EnsureGreaseLoop
  };
})();
