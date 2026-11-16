/*
  Candidate Rev 31 — Shocking Grasp electrical presentation
  ----------------------------------------------------------
  Adds a compact hand-to-target electrical discharge for Shocking Grasp while
  reusing the approved production Lightning Bolt electrical sample.

  This file is presentation-only. Spell attack rolls, Mirror Image behavior,
  damage, targeting, Spectral Hand rules, and turn timing remain in the
  production spell resolver.
*/
(()=>{
  "use strict";

  let shockingGraspFx=null;

  const baseDrawProjectileFx=
    drawProjectileFx;

  function clamp01(value){
    return Math.max(
      0,
      Math.min(1,value)
    );
  }

  function hash01(a,b,c=0){
    let n=(
      Math.imul((a|0)+101,73856093) ^
      Math.imul((b|0)-211,19349663) ^
      Math.imul((c|0)+37,83492791)
    )>>>0;

    n^=n>>>13;
    n=Math.imul(n,1274126177)>>>0;
    n^=n>>>16;

    return (n>>>0)/4294967295;
  }

  function shockEnvelope(elapsed,duration){
    const pulses=[
      {center:42,width:34,strength:1.00},
      {center:148,width:42,strength:0.80},
      {center:262,width:54,strength:0.58}
    ];

    let intensity=0;

    for(const pulse of pulses){
      const d=
        (elapsed-pulse.center)/
        pulse.width;

      intensity=
        Math.max(
          intensity,
          pulse.strength*
          Math.exp(-d*d)
        );
    }

    const tail=
      elapsed<duration
        ? 0.12*
          Math.pow(
            1-elapsed/duration,
            1.3
          )
        : 0;

    return clamp01(
      Math.max(
        intensity,
        tail
      )
    );
  }

  function electricalPoint(
    start,
    end,
    t,
    seed,
    amplitude
  ){
    const dx=end.x-start.x;
    const dy=end.y-start.y;
    const length=
      Math.max(
        1,
        Math.hypot(dx,dy)
      );

    const nx=-dy/length;
    const ny=dx/length;

    const taper=
      Math.sin(
        Math.PI*t
      );

    const noise=
      (
        hash01(
          seed,
          Math.round(t*97),
          19
        )-
        0.5
      )*
      2;

    return {
      x:
        start.x+
        dx*t+
        nx*
        noise*
        amplitude*
        taper,
      y:
        start.y+
        dy*t+
        ny*
        noise*
        amplitude*
        taper
    };
  }

  function traceElectricalArc(
    start,
    end,
    intensity,
    seed,
    {
      amplitude=8,
      segmentCount=8,
      alphaScale=1
    }={}
  ){
    const points=[
      start
    ];

    for(
      let index=1;
      index<segmentCount;
      index++
    ){
      points.push(
        electricalPoint(
          start,
          end,
          index/segmentCount,
          seed+index*17,
          amplitude
        )
      );
    }

    points.push(end);

    const passes=[
      {
        width:10,
        stroke:
          "rgba(58,104,255,"+
          (0.055*intensity*alphaScale)+
          ")"
      },
      {
        width:5.2,
        stroke:
          "rgba(92,166,255,"+
          (0.18*intensity*alphaScale)+
          ")"
      },
      {
        width:2.5,
        stroke:
          "rgba(190,230,255,"+
          (0.58*intensity*alphaScale)+
          ")"
      },
      {
        width:1.0,
        stroke:
          "rgba(255,255,255,"+
          (0.96*intensity*alphaScale)+
          ")"
      }
    ];

    for(const pass of passes){
      ctx.strokeStyle=pass.stroke;
      ctx.lineWidth=pass.width;
      ctx.beginPath();

      points.forEach(
        (point,index)=>{
          if(index===0){
            ctx.moveTo(
              point.x,
              point.y
            );
          }else{
            ctx.lineTo(
              point.x,
              point.y
            );
          }
        }
      );

      ctx.stroke();
    }
  }

  function drawLocalizedGlow(
    center,
    intensity,
    radius,
    {
      core=0.60,
      middle=0.30
    }={}
  ){
    const gradient=
      ctx.createRadialGradient(
        center.x,
        center.y,
        0,
        center.x,
        center.y,
        radius
      );

    gradient.addColorStop(
      0,
      "rgba(248,253,255,"+
      Math.min(
        0.92,
        core*intensity
      )+
      ")"
    );

    gradient.addColorStop(
      0.34,
      "rgba(164,216,255,"+
      Math.min(
        0.68,
        middle*intensity
      )+
      ")"
    );

    gradient.addColorStop(
      0.72,
      "rgba(77,136,255,"+
      Math.min(
        0.34,
        0.13*intensity
      )+
      ")"
    );

    gradient.addColorStop(
      1,
      "rgba(52,92,240,0)"
    );

    ctx.fillStyle=gradient;
    ctx.beginPath();
    ctx.arc(
      center.x,
      center.y,
      radius,
      0,
      Math.PI*2
    );
    ctx.fill();
  }

  function drawTargetMicroArcs(
    center,
    intensity,
    elapsed
  ){
    const rayCount=8;

    for(
      let index=0;
      index<rayCount;
      index++
    ){
      const angle=
        index*
        Math.PI*2/
        rayCount+
        elapsed*0.012+
        (
          hash01(
            index,
            Math.floor(elapsed/45),
            41
          )-
          0.5
        )*
        0.45;

      const inner=
        5+
        (index%3);

      const outer=
        16+
        (index%4)*3+
        intensity*7;

      const start={
        x:
          center.x+
          Math.cos(angle)*
          inner,
        y:
          center.y+
          Math.sin(angle)*
          inner
      };

      const end={
        x:
          center.x+
          Math.cos(angle)*
          outer,
        y:
          center.y+
          Math.sin(angle)*
          outer
      };

      traceElectricalArc(
        start,
        end,
        intensity,
        900+index*67+
        Math.floor(elapsed/45)*13,
        {
          amplitude:3.5,
          segmentCount:3,
          alphaScale:0.72
        }
      );
    }
  }

  function drawShockingGraspFx(){
    if(!shockingGraspFx){
      return;
    }

    if(
      typeof spellPreviewVisualsSuppressed==="function" &&
      spellPreviewVisualsSuppressed()
    ){
      return;
    }

    const caster=
      getUnitById(
        shockingGraspFx.casterId
      );

    const target=
      getUnitById(
        shockingGraspFx.targetId
      );

    if(
      !caster ||
      !target
    ){
      return;
    }

    const elapsed=
      Math.max(
        0,
        performance.now()-
        shockingGraspFx.started
      );

    const duration=
      Math.max(
        1,
        shockingGraspFx.duration
      );

    if(elapsed>=duration){
      return;
    }

    const intensity=
      shockEnvelope(
        elapsed,
        duration
      );

    if(intensity<=0.002){
      return;
    }

    const casterCenter=
      hexCenter(
        caster.x,
        caster.y
      );

    const targetCenter=
      hexCenter(
        target.x,
        target.y
      );

    const dx=
      targetCenter.x-
      casterCenter.x;

    const direction=
      dx>=0
        ? 1
        : -1;

    const start={
      x:
        casterCenter.x+
        direction*12,
      y:
        casterCenter.y-23
    };

    const end={
      x:targetCenter.x,
      y:targetCenter.y-20
    };

    ctx.save();
    ctx.globalCompositeOperation="lighter";
    ctx.lineCap="round";
    ctx.lineJoin="round";

    /*
      Tight local illumination: the charged hand flashes first, while the
      victim gets the stronger electrical bloom on contact.
    */
    drawLocalizedGlow(
      start,
      intensity,
      30,
      {
        core:0.44,
        middle:0.22
      }
    );

    drawLocalizedGlow(
      end,
      intensity,
      Math.max(
        48,
        HEX_W*0.88
      ),
      {
        core:0.72,
        middle:0.36
      }
    );

    /*
      Main discharge plus two weaker return paths. Each restrike uses a slightly
      different seed so the touch feels alive rather than like a static line.
    */
    const frame=
      Math.floor(
        elapsed/45
      );

    traceElectricalArc(
      start,
      end,
      intensity,
      200+
      frame*31,
      {
        amplitude:
          shockingGraspFx.throughHand
            ? 12
            : 7,
        segmentCount:
          shockingGraspFx.throughHand
            ? 10
            : 7,
        alphaScale:1
      }
    );

    traceElectricalArc(
      {
        x:start.x,
        y:start.y+3
      },
      {
        x:end.x-2,
        y:end.y+4
      },
      intensity,
      500+
      frame*43,
      {
        amplitude:
          shockingGraspFx.throughHand
            ? 10
            : 6,
        segmentCount:
          shockingGraspFx.throughHand
            ? 9
            : 6,
        alphaScale:0.52
      }
    );

    traceElectricalArc(
      {
        x:start.x,
        y:start.y-2
      },
      {
        x:end.x+3,
        y:end.y-3
      },
      intensity,
      700+
      frame*59,
      {
        amplitude:
          shockingGraspFx.throughHand
            ? 9
            : 5,
        segmentCount:
          shockingGraspFx.throughHand
            ? 8
            : 6,
        alphaScale:0.36
      }
    );

    drawTargetMicroArcs(
      end,
      intensity,
      elapsed
    );

    /*
      A few hard pixel sparks keep the contact readable beside the pixel-art
      units without turning the whole effect into a soft bloom.
    */
    for(let index=0;index<18;index++){
      const angle=
        hash01(
          index,
          frame,
          73
        )*
        Math.PI*2;

      const radius=
        8+
        hash01(
          index,
          frame,
          97
        )*
        24;

      const x=
        end.x+
        Math.cos(angle)*
        radius;

      const y=
        end.y+
        Math.sin(angle)*
        radius;

      const alpha=
        (
          0.38+
          hash01(
            index,
            frame,
            119
          )*
          0.55
        )*
        intensity;

      ctx.fillStyle=
        index%3===0
          ? "rgba(255,255,255,"+alpha+")"
          : index%3===1
            ? "rgba(183,229,255,"+alpha+")"
            : "rgba(89,154,255,"+alpha+")";

      const size=
        index%7===0
          ? 2
          : 1;

      ctx.fillRect(
        Math.round(x),
        Math.round(y),
        size,
        size
      );
    }

    ctx.restore();
  }

  drawProjectileFx=function(){
    baseDrawProjectileFx();
    drawShockingGraspFx();
  };

  async function play(
    caster,
    target,
    {
      throughHand=false
    }={}
  ){
    if(
      !caster?.id ||
      !target?.id
    ){
      return false;
    }

    const duration=420;
    const started=
      performance.now();

    shockingGraspFx={
      casterId:caster.id,
      targetId:target.id,
      throughHand:!!throughHand,
      started,
      duration
    };

    /*
      Reuse the reviewed production Lightning Bolt electrical sample. The
      Previewer queueSfx gate automatically honors VFX-only mode.
    */
    playMagicEffectSound(
      "lightning"
    );

    while(
      performance.now()-
      started<
      duration
    ){
      draw();
      await sleep(16);
    }

    shockingGraspFx=null;
    draw();
    return true;
  }

  function clear(){
    shockingGraspFx=null;
  }

  /*
    Ensure the Spell Effects Previewer can immediately clear an in-flight
    Shocking Grasp when Reset/Stop is used.
  */
  if(
    typeof spellPreviewClearTransientPresentation==="function"
  ){
    const baseSpellPreviewClearTransientPresentation=
      spellPreviewClearTransientPresentation;

    spellPreviewClearTransientPresentation=function(){
      const result=
        baseSpellPreviewClearTransientPresentation();
      clear();
      return result;
    };
  }

  window.AdventurePartyShockingGraspFx={
    release:"Candidate Rev 31",
    play,
    clear,
    active:()=>(
      shockingGraspFx
        ? {...shockingGraspFx}
        : null
    )
  };
})();
