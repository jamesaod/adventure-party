/*
  Candidate Rev 19 — Production Stable-Fluids Fireball renderer.
  Uses the approved Rev 18 Fireball-lab settings without changing spell rules.
*/
(()=>{
  "use strict";

  const core=window.AdventurePartyStableFireCore;
  if(!core){
    console.error("Candidate Rev 19 Stable Fire core missing.");
    return;
  }

  const {
    PROFILE,
    StableFireField,
    clamp01,
    heatColor,
    makeParticles
  }=core;

  const stateByFx=new WeakMap();
  const baseDrawFireballExplosionFx=drawFireballExplosionFx;

  function createState(fx){
    const seed=
      (
        Math.floor(
          Math.random()*0xffffffff
        )>>>0
      ) || 217;

    const distortionCanvas=
      document.createElement("canvas");

    const field=
      new StableFireField(seed);

    /*
      Rev 23: production Fireball is shaped entirely by the resolved blast
      volume. Remove the core class' generic central plume before injecting the
      tactical-volume sources.
    */
    field.clear();

    const rect=
      blastRect(fx);

    const volumeSources=
      buildBlastVolumeSources(
        fx,
        rect
      );

    /*
      Seed the hot field across the complete resolved Fireball volume on frame
      zero. The original central plume remains, but every affected tactical hex
      now contributes overlapping hot gas to the same simulation.
    */
    field.injectSources(
      volumeSources,
      1.0
    );

    return {
      seed,
      field,
      volumeSources,
      rect,
      particles:makeParticles(
        seed^0x9e3779b9,
        230
      ),
      lastStepAt:performance.now(),
      distortionCanvas,
      distortionCtx:
        distortionCanvas.getContext("2d"),
      bodyCanvas:
        document.createElement("canvas"),
      bodyCtx:null,
      maskCanvas:
        document.createElement("canvas"),
      maskCtx:null,
      lightCanvas:
        document.createElement("canvas"),
      lightCtx:null
    };
  }

  function stateFor(fx){
    let state=stateByFx.get(fx);

    if(!state){
      state=createState(fx);
      stateByFx.set(fx,state);
    }

    return state;
  }

  function blastRect(fx){
    const center=hexCenter(fx.x,fx.y);

    const spread=Math.max(
      1,
      Number(fx.maxVolumeDistance)||
      Number(fx.radiusHexes)||
      1
    );

    const width=Math.max(
      HEX_W*2.6,
      (spread*2+1)*HEX_W*0.92
    );

    const height=Math.max(
      HEX_H*2.5,
      width*0.72
    );

    return {
      center,
      x:center.x-width/2,
      y:center.y-height*0.76,
      w:width,
      h:height
    };
  }


  function buildBlastVolumeSources(fx,rect){
    const cells=
      Array.isArray(fx?.cells) &&
      fx.cells.length
        ? fx.cells
        : [
            {
              x:fx.x,
              y:fx.y,
              volumeDistance:0
            }
          ];

    const targetCenter=
      hexCenter(
        fx.x,
        fx.y
      );

    const maxDistance=
      Math.max(
        1,
        Number(
          fx.maxVolumeDistance
        ) ||
        Math.max(
          ...cells.map(cell=>
            Number.isFinite(
              cell.volumeDistance
            )
              ? Number(
                  cell.volumeDistance
                )
              : hexDistance(
                  {x:fx.x,y:fx.y},
                  cell
                )
          )
        )
      );

    /*
      A source ellipse is about one tactical hex wide in simulation space.
      Adjacent sources overlap enough to form continuous fire even through
      long indoor flood-fill shapes and narrow doorway spills.
    */
    const radiusX=
      Math.max(
        2.5,
        (
          HEX_W/
          Math.max(1,rect.w)
        )*
        PROFILE.w*
        0.42
      );

    const radiusY=
      Math.max(
        2.1,
        (
          HEX_H/
          Math.max(1,rect.h)
        )*
        PROFILE.h*
        0.44
      );

    return cells.map((cell,index)=>{
      const center=
        hexCenter(
          cell.x,
          cell.y
        );

      const gx=
        (
          (center.x-rect.x)/
          Math.max(1,rect.w)
        )*
        (PROFILE.w-1);

      const gy=
        (
          (center.y-rect.y)/
          Math.max(1,rect.h)
        )*
        (PROFILE.h-1);

      const distance=
        Number.isFinite(
          cell.volumeDistance
        )
          ? Number(
              cell.volumeDistance
            )
          : hexDistance(
              {x:fx.x,y:fx.y},
              cell
            );

      const distanceNorm=
        clamp01(
          distance/
          maxDistance
        );

      const dx=
        center.x-
        targetCenter.x;

      const dy=
        center.y-
        targetCenter.y;

      const length=
        Math.max(
          1,
          Math.hypot(dx,dy)
        );

      /*
        Outer volume cells remain nearly as hot/dense as the core. Fireball is
        an instantaneous volume-filling detonation, not a small flame source
        that slowly diffuses outward.
      */
      const variation=
        Math.sin(
          index*2.61+
          fx.x*0.73+
          fx.y*1.37
        );

      const heat=
        0.76-
        distanceNorm*0.10+
        variation*0.055;

      const density=
        0.58-
        distanceNorm*0.08+
        variation*0.045;

      const outward=
        1.45+
        (1-distanceNorm)*1.55;

      const jitter=
        (
          Math.sin(
            index*2.17+
            fx.x*0.71+
            fx.y*1.13
          )
        )*
        0.18;

      return {
        x:gx,
        y:gy,
        radiusX:
          radiusX*
          (
            0.96+
            (index%3)*0.045
          ),
        radiusY:
          radiusY*
          (
            0.94+
            (index%2)*0.08
          ),
        heat,
        density,
        velocityX:
          dx/length*
          outward+
          jitter,
        velocityY:
          dy/length*
          outward*
          0.48-
          0.82*
          PROFILE.buoyancy,
        strength:1
      };
    });
  }


  function prepareSoftBlastMask(state,fx,rect){
    const width=Math.max(2,Math.ceil(rect.w));
    const height=Math.max(2,Math.ceil(rect.h));

    if(
      state.maskCanvas.width!==width ||
      state.maskCanvas.height!==height
    ){
      state.maskCanvas.width=width;
      state.maskCanvas.height=height;
      state.maskCtx=
        state.maskCanvas.getContext("2d");
    }

    const maskCtx=state.maskCtx;
    if(!maskCtx) return null;

    maskCtx.clearRect(0,0,width,height);
    maskCtx.save();
    maskCtx.globalCompositeOperation="lighter";

    const cells=
      Array.isArray(fx?.cells) &&
      fx.cells.length
        ? fx.cells
        : [{x:fx.x,y:fx.y}];

    /*
      Each tactical cell contributes a soft, vertically stretched flame-volume
      lobe. Neighboring lobes overlap into one continuous mask, so walls and
      terrain still shape the blast without exposing hard hex/rectangle edges.
    */
    for(let index=0;index<cells.length;index++){
      const cell=cells[index];

      if(
        !Number.isFinite(cell.x) ||
        !Number.isFinite(cell.y)
      ){
        continue;
      }

      const center=
        hexCenter(cell.x,cell.y);

      const localX=
        center.x-rect.x;

      const localY=
        center.y-rect.y-
        HEX_H*0.30;

      const radius=
        HEX_W*
        (
          0.68+
          (index%3)*0.035
        );

      maskCtx.save();
      maskCtx.translate(localX,localY);
      maskCtx.scale(
        1.0,
        1.42+
        (index%2)*0.08
      );

      const gradient=
        maskCtx.createRadialGradient(
          0,0,0,
          0,0,radius
        );

      gradient.addColorStop(
        0,
        "rgba(255,255,255,0.98)"
      );
      gradient.addColorStop(
        0.42,
        "rgba(255,255,255,0.88)"
      );
      gradient.addColorStop(
        0.76,
        "rgba(255,255,255,0.48)"
      );
      gradient.addColorStop(
        1,
        "rgba(255,255,255,0)"
      );

      maskCtx.fillStyle=gradient;
      maskCtx.beginPath();
      maskCtx.arc(
        0,0,radius,
        0,Math.PI*2
      );
      maskCtx.fill();

      maskCtx.restore();
    }

    maskCtx.restore();
    return state.maskCanvas;
  }


  function drawSoftFluidBody(
    state,
    fx,
    rect,
    fade
  ){
    const width=Math.max(2,Math.ceil(rect.w));
    const height=Math.max(2,Math.ceil(rect.h));

    if(
      state.bodyCanvas.width!==width ||
      state.bodyCanvas.height!==height
    ){
      state.bodyCanvas.width=width;
      state.bodyCanvas.height=height;
      state.bodyCtx=
        state.bodyCanvas.getContext("2d");
    }

    const bodyCtx=state.bodyCtx;
    const mask=
      prepareSoftBlastMask(
        state,
        fx,
        rect
      );

    if(!bodyCtx || !mask){
      return;
    }

    bodyCtx.clearRect(0,0,width,height);
    bodyCtx.save();
    bodyCtx.imageSmoothingEnabled=true;

    bodyCtx.drawImage(
      state.field.image,
      0,0,width,height
    );

    bodyCtx.globalCompositeOperation=
      "destination-in";

    bodyCtx.drawImage(
      mask,
      0,0,width,height
    );

    bodyCtx.restore();

    /*
      Source-over carries the actual fire color on bright grass/stone.
      A very small additive second pass restores emissive punch without
      bleaching the whole affected volume.
    */
    ctx.save();
    ctx.imageSmoothingEnabled=true;
    ctx.globalCompositeOperation="source-over";
    /*
      Rev 24: 50% stronger main flame-body opacity.
      0.80 -> 1.20 before clamping to the Canvas alpha ceiling.
    */
    ctx.globalAlpha=
      Math.min(
        1,
        1.20*fade
      );

    ctx.drawImage(
      state.bodyCanvas,
      rect.x,
      rect.y,
      rect.w,
      rect.h
    );

    ctx.globalCompositeOperation="lighter";
    ctx.globalAlpha=
      Math.min(
        0.20,
        0.15*fade
      );

    ctx.drawImage(
      state.bodyCanvas,
      rect.x,
      rect.y,
      rect.w,
      rect.h
    );

    ctx.restore();
  }


  function drawFieryVolumeIllumination(
    state,
    fx,
    rect,
    t,
    fade
  ){
    const mask=
      prepareSoftBlastMask(
        state,
        fx,
        rect
      );

    if(!mask){
      return;
    }

    const width=
      Math.max(
        2,
        Math.ceil(rect.w)
      );

    const height=
      Math.max(
        2,
        Math.ceil(rect.h)
      );

    if(
      state.lightCanvas.width!==width ||
      state.lightCanvas.height!==height
    ){
      state.lightCanvas.width=width;
      state.lightCanvas.height=height;
      state.lightCtx=
        state.lightCanvas.getContext("2d");
    }

    const lightCtx=
      state.lightCtx;

    if(!lightCtx){
      return;
    }

    lightCtx.clearRect(
      0,0,width,height
    );

    lightCtx.drawImage(
      mask,
      0,0,width,height
    );

    lightCtx.globalCompositeOperation=
      "source-in";

    const tint=
      lightCtx.createRadialGradient(
        width*0.50,
        height*0.56,
        0,
        width*0.50,
        height*0.56,
        Math.max(
          width,
          height
        )*0.72
      );

    tint.addColorStop(
      0,
      "rgba(255,252,210,1)"
    );

    tint.addColorStop(
      0.28,
      "rgba(255,190,58,0.98)"
    );

    tint.addColorStop(
      0.62,
      "rgba(244,91,13,0.90)"
    );

    tint.addColorStop(
      1,
      "rgba(165,28,5,0.58)"
    );

    lightCtx.fillStyle=tint;
    lightCtx.fillRect(
      0,0,width,height
    );

    lightCtx.globalCompositeOperation=
      "source-over";

    /*
      Strong fiery illumination starts near peak intensity and continuously
      decays through the blast lifetime. Keep it volume-shaped so illumination
      follows wall/terrain-constrained Fireballs instead of reading as a single
      circular spotlight.
    */
    const decay=
      Math.pow(
        Math.max(
          0,
          1-t
        ),
        1.35
      );

    const illumination=
      PROFILE.glow*
      decay*
      fade;

    if(illumination<=0.002){
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation="lighter";

    /*
      Broad warm light cast onto terrain/units around the complete blast.
    */
    ctx.filter=
      "blur("+
      Math.max(
        12,
        Math.round(
          Math.min(
            rect.w,
            rect.h
          )*0.15
        )
      )+
      "px)";

    ctx.globalAlpha=
      Math.min(
        0.62,
        0.18*
        illumination
      );

    ctx.drawImage(
      state.lightCanvas,
      rect.x,
      rect.y,
      rect.w,
      rect.h
    );

    /*
      Tighter yellow-orange fiery glow hugs the visible flame volume.
    */
    ctx.filter=
      "blur("+
      Math.max(
        6,
        Math.round(
          Math.min(
            rect.w,
            rect.h
          )*0.065
        )
      )+
      "px)";

    ctx.globalAlpha=
      Math.min(
        0.48,
        0.14*
        illumination
      );

    ctx.drawImage(
      state.lightCanvas,
      rect.x,
      rect.y,
      rect.w,
      rect.h
    );

    ctx.filter="none";
    ctx.restore();
  }


  function clipToBlastColumns(fx,rect){
    if(!Array.isArray(fx.cells) || !fx.cells.length){
      return;
    }

    ctx.beginPath();

    const rise=Math.max(
      HEX_H*1.4,
      rect.h*0.72
    );

    for(const cell of fx.cells){
      if(
        !Number.isFinite(cell.x) ||
        !Number.isFinite(cell.y)
      ){
        continue;
      }

      const vertices=
        hexScreenVertices(
          cell.x,
          cell.y
        );

      if(vertices?.length){
        ctx.moveTo(vertices[0].x,vertices[0].y);

        for(let i=1;i<vertices.length;i++){
          ctx.lineTo(
            vertices[i].x,
            vertices[i].y
          );
        }

        ctx.closePath();
      }

      const center=
        hexCenter(
          cell.x,
          cell.y
        );

      ctx.rect(
        center.x-HEX_W*0.48,
        center.y-rise,
        HEX_W*0.96,
        rise+HEX_H*0.54
      );
    }

    ctx.clip();
  }

  function drawFireLight(x,y,radius,strength){
    if(strength<=0.002) return;

    ctx.save();
    ctx.globalCompositeOperation="lighter";

    const glow=
      ctx.createRadialGradient(
        x,y,0,
        x,y,radius
      );

    glow.addColorStop(
      0,
      "rgba(255,249,211,"+
      Math.min(0.88,0.34*strength)+
      ")"
    );

    glow.addColorStop(
      0.22,
      "rgba(255,186,64,"+
      Math.min(0.65,0.22*strength)+
      ")"
    );

    glow.addColorStop(
      0.60,
      "rgba(240,84,15,"+
      Math.min(0.36,0.095*strength)+
      ")"
    );

    glow.addColorStop(
      1,
      "rgba(180,35,7,0)"
    );

    ctx.fillStyle=glow;
    ctx.beginPath();
    ctx.arc(
      x,y,radius,
      0,Math.PI*2
    );
    ctx.fill();

    ctx.restore();
  }

  function drawHeatDistortion(state,rect,intensity,now){
    if(!PROFILE.distortion || intensity<=0.01){
      return;
    }

    const sx=Math.max(0,Math.floor(rect.x));
    const sy=Math.max(0,Math.floor(rect.y));
    const sw=Math.min(
      ctx.canvas.width-sx,
      Math.ceil(rect.w)
    );
    const sh=Math.min(
      ctx.canvas.height-sy,
      Math.ceil(rect.h)
    );

    if(sw<=2 || sh<=2) return;

    const copy=state.distortionCanvas;
    if(copy.width!==sw || copy.height!==sh){
      copy.width=sw;
      copy.height=sh;
    }

    const copyCtx=
      state.distortionCtx ||
      copy.getContext("2d");

    if(!copyCtx) return;

    try{
      copyCtx.clearRect(0,0,sw,sh);

      copyCtx.drawImage(
        ctx.canvas,
        sx,sy,sw,sh,
        0,0,sw,sh
      );

      ctx.save();
      ctx.globalAlpha=
        Math.min(
          0.52,
          0.30*intensity
        );

      for(let y=0;y<sh;y+=5){
        const offset=
          Math.sin(
            now*0.018+
            y*0.16
          )*
          2.2*
          intensity;

        ctx.drawImage(
          copy,
          0,y,sw,5,
          sx+offset,
          sy+y,
          sw,5
        );
      }

      ctx.restore();
    }catch(_error){
      // Decorative only.
    }
  }

  function drawParticles(state,center,t,fade,scale){
    ctx.save();
    ctx.globalCompositeOperation="lighter";

    const count=
      Math.min(
        state.particles.length,
        Math.round(
          115*PROFILE.embers
        )
      );

    for(let i=0;i<count;i++){
      const part=state.particles[i];
      if(t<part.born) continue;

      const local=clamp01(
        (t-part.born)/
        Math.max(0.01,1-part.born)
      );

      if(local>=1) continue;

      const fast=part.ember ? 0.76 : 1.34;

      const radial=
        scale*
        (
          0.16+
          local*
          0.70*
          part.speed*
          fast
        );

      const gravity=
        part.ember
          ? -scale*0.22*local*part.lift
          : scale*0.16*local*local;

      const x=
        center.x+
        Math.cos(part.angle)*radial;

      const y=
        center.y+
        Math.sin(part.angle)*radial*0.55+
        gravity;

      const heat=clamp01(
        1-
        local*
        (part.ember ? 0.76 : 1.04)
      );

      const rgb=
        heatColor(
          0.34+
          heat*0.64
        );

      const alpha=
        Math.pow(1-local,1.2)*
        (part.ember ? 0.78 : 0.94)*
        fade;

      if(part.ember){
        ctx.fillStyle=
          "rgba("+
          rgb[0]+","+
          rgb[1]+","+
          rgb[2]+","+
          alpha+
          ")";

        ctx.fillRect(
          Math.round(x),
          Math.round(y),
          part.size,
          part.size
        );
      }else{
        const tail=4+part.size*2;

        ctx.strokeStyle=
          "rgba("+
          rgb[0]+","+
          rgb[1]+","+
          rgb[2]+","+
          (alpha*0.76)+
          ")";

        ctx.lineWidth=
          Math.max(
            1,
            part.size*0.65
          );

        ctx.beginPath();
        ctx.moveTo(x,y);
        ctx.lineTo(
          x-
          Math.cos(part.angle)*tail,
          y-
          Math.sin(part.angle)*tail*0.55
        );
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawIgnitionFlash(center,elapsed,scale){
    if(elapsed>125) return;

    const t=clamp01(elapsed/125);
    const flash=Math.sin(Math.PI*t);

    drawFireLight(
      center.x,
      center.y,
      scale*0.62,
      1.9*flash
    );

    ctx.save();
    ctx.globalCompositeOperation="lighter";
    ctx.fillStyle=
      "rgba(255,255,244,"+
      (0.28*flash)+
      ")";
    ctx.fillRect(
      0,
      0,
      ctx.canvas.width,
      ctx.canvas.height
    );
    ctx.restore();
  }

  function renderStableFireballExplosion(fx){
    if(!fx) return;

    try{
      const state=stateFor(fx);
      const now=performance.now();
      const elapsed=Math.max(0,now-fx.started);
      const duration=Math.max(
        1,
        Number(fx.duration)||820
      );
      const t=clamp01(elapsed/duration);
      const fade=
        t<0.76
          ? 1
          : clamp01(
              1-
              (t-0.76)/0.24
            );

      const delta=Math.min(
        0.048,
        Math.max(
          0,
          (now-state.lastStepAt)/1000
        )
      );

      state.lastStepAt=now;

      if(delta>0){
        const simulated=delta*1.42;
        const steps=Math.max(
          1,
          Math.ceil(simulated/0.016)
        );
        const stepDt=simulated/steps;

        for(let i=0;i<steps;i++){
          state.field.step(stepDt);
        }
      }

      /*
        For the first half of the visual beat, keep feeding diminishing heat
        and density into every resolved blast hex. This makes confined-space
        and terrain-shaped Fireballs visibly occupy their full affected volume
        instead of collapsing back toward the detonation center.
      */
      if(
        t<0.52 &&
        state.volumeSources?.length
      ){
        const sustain=
          1-
          t/0.52;

        state.field.injectSources(
          state.volumeSources,
          0.035+
          sustain*0.085
        );
      }

      const rect=
        state.rect ||
        blastRect(fx);

      drawHeatDistortion(
        state,
        rect,
        fade*PROFILE.glow*0.16,
        now
      );

      const info=
        state.field.updateImage();

      const heatX=
        rect.x+
        info.heatCenter.x*
        rect.w;

      const heatY=
        rect.y+
        info.heatCenter.y*
        rect.h;

      drawIgnitionFlash(
        rect.center,
        elapsed,
        Math.min(rect.w,rect.h)
      );

      drawFieryVolumeIllumination(
        state,
        fx,
        rect,
        t,
        fade
      );

      drawSoftFluidBody(
        state,
        fx,
        rect,
        fade
      );

      const hotGlowDecay=
        Math.pow(
          Math.max(
            0,
            1-t
          ),
          1.05
        );

      /*
        White-yellow core glow rides the hottest part of the simulation and
        decays more slowly than the broad terrain illumination.
      */
      drawFireLight(
        heatX,
        heatY,
        Math.max(
          HEX_W*1.20,
          Math.min(rect.w,rect.h)*0.50
        ),
        info.hottest*
        PROFILE.glow*
        fade*
        hotGlowDecay*
        0.78
      );

      drawParticles(
        state,
        rect.center,
        t,
        fade,
        Math.max(
          HEX_W,
          rect.w*0.46
        )
      );
    }catch(error){
      console.error(
        "Candidate Rev 19 Stable-Fluids Fireball failed:",
        error
      );
      baseDrawFireballExplosionFx();
    }
  }


  function renderStableFireballProjectile(fx){
    if(
      !fx ||
      fx.kind!=="fireball"
    ){
      return;
    }

    const start=fx.start;
    const end=fx.end;
    const t=clamp01(fx.t);

    const x=
      start.x+
      (end.x-start.x)*t;

    const y=
      start.y+
      (end.y-start.y)*t;

    const dx=end.x-start.x;
    const dy=end.y-start.y;
    const length=Math.max(1,Math.hypot(dx,dy));
    const ux=dx/length;
    const uy=dy/length;
    const nx=-uy;
    const ny=ux;

    ctx.save();
    ctx.globalCompositeOperation="lighter";
    ctx.lineCap="round";

    /*
      Lab-style turbulent flame tail: several overlapping curved hot channels
      instead of the previous chain of opaque circular puffs.
    */
    for(let strand=0;strand<4;strand++){
      const strandOffset=(strand-1.5)*2.6;

      ctx.beginPath();

      for(let step=0;step<=9;step++){
        const q=step/9;
        const back=
          8+
          q*34;

        const wave=
          Math.sin(
            performance.now()*0.018+
            strand*1.7+
            step*0.92
          )*
          (
            1.4+
            q*3.2
          );

        const px=
          x-
          ux*back+
          nx*(
            strandOffset+
            wave
          );

        const py=
          y-
          uy*back+
          ny*(
            strandOffset+
            wave
          );

        if(step===0){
          ctx.moveTo(px,py);
        }else{
          ctx.lineTo(px,py);
        }
      }

      const alpha=
        0.18+
        strand*0.045;

      ctx.strokeStyle=
        strand<2
          ? "rgba(255,91,12,"+alpha+")"
          : "rgba(255,184,44,"+alpha+")";

      ctx.lineWidth=
        7.5-
        strand*1.15;

      ctx.stroke();
    }

    /*
      White-hot head with a temperature ramp. This deliberately matches the
      laboratory projectile rather than the legacy lobe glyph.
    */
    const core=
      ctx.createRadialGradient(
        x,y,0,
        x,y,19
      );

    core.addColorStop(
      0,
      "rgba(255,255,240,1)"
    );

    core.addColorStop(
      0.17,
      "rgba(255,239,128,0.98)"
    );

    core.addColorStop(
      0.46,
      "rgba(255,135,23,0.90)"
    );

    core.addColorStop(
      0.76,
      "rgba(220,56,7,0.58)"
    );

    core.addColorStop(
      1,
      "rgba(150,20,4,0)"
    );

    ctx.fillStyle=core;
    ctx.beginPath();
    ctx.arc(
      x,y,19,
      0,Math.PI*2
    );
    ctx.fill();

    drawFireLight(
      x,
      y,
      64,
      0.62*PROFILE.glow
    );

    /*
      Detached sparks peel away from the tail.
    */
    for(let i=0;i<18;i++){
      const q=i/18;
      const phase=
        performance.now()*0.008+
        i*2.13;

      const back=
        10+
        q*38;

      const side=
        Math.sin(phase)*
        (
          3+
          q*8
        );

      const px=
        x-
        ux*back+
        nx*side;

      const py=
        y-
        uy*back+
        ny*side-
        q*q*8;

      const heat=
        1-q*0.72;

      const rgb=
        heatColor(
          0.35+
          heat*0.62
        );

      const alpha=
        0.18+
        heat*0.48;

      ctx.fillStyle=
        "rgba("+
        rgb[0]+","+
        rgb[1]+","+
        rgb[2]+","+
        alpha+
        ")";

      const size=
        i%5===0
          ? 2
          : 1;

      ctx.fillRect(
        Math.round(px),
        Math.round(py),
        size,
        size
      );
    }

    ctx.restore();
  }


  /*
    Rev 20 production hook:
    suppress the canonical legacy Fireball render layers while base draw() runs,
    then render the approved projectile/explosion explicitly as a final VFX pass.
    This guarantees the production path cannot silently fall back to the old
    lobe renderer because of earlier wrapper/capture order.
  */
  const baseDraw=draw;

  draw=function(){
    const savedExplosion=
      fireballExplosionFx;

    const savedProjectile=
      projectileFx &&
      projectileFx.kind==="fireball"
        ? projectileFx
        : null;

    if(savedExplosion){
      fireballExplosionFx=null;
    }

    if(savedProjectile){
      projectileFx=null;
    }

    try{
      baseDraw();
    }finally{
      if(savedExplosion){
        fireballExplosionFx=
          savedExplosion;
      }

      if(savedProjectile){
        projectileFx=
          savedProjectile;
      }
    }

    if(savedExplosion){
      renderStableFireballExplosion(
        savedExplosion
      );
    }

    if(savedProjectile){
      renderStableFireballProjectile(
        savedProjectile
      );
    }
  };


  /*
    Keep the named renderer hook aligned for tools/preview paths that call it
    directly instead of running through the full battlefield draw.
  */
  drawFireballExplosionFx=function(){
    if(fireballExplosionFx){
      renderStableFireballExplosion(
        fireballExplosionFx
      );
    }
  };


  window.AdventurePartyProductionFireballVfx={
    release:"Candidate Rev 24",
    renderer:"Stable Fluids — high-opacity fiery illumination",
    profile:{...PROFILE}
  };
})();
