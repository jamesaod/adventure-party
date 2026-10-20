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

  function createState(){
    const seed=
      (
        Math.floor(
          Math.random()*0xffffffff
        )>>>0
      ) || 217;

    const distortionCanvas=
      document.createElement("canvas");

    return {
      seed,
      field:new StableFireField(seed),
      particles:makeParticles(
        seed^0x9e3779b9,
        230
      ),
      lastStepAt:performance.now(),
      distortionCanvas,
      distortionCtx:
        distortionCanvas.getContext("2d")
    };
  }

  function stateFor(fx){
    let state=stateByFx.get(fx);

    if(!state){
      state=createState();
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

  drawFireballExplosionFx=function(){
    const fx=fireballExplosionFx;
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

      const rect=blastRect(fx);

      drawHeatDistortion(
        state,
        rect,
        fade*PROFILE.glow*0.38,
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

      ctx.save();
      clipToBlastColumns(fx,rect);
      ctx.globalCompositeOperation="lighter";
      ctx.globalAlpha=Math.min(1,0.96*fade);
      ctx.imageSmoothingEnabled=true;

      ctx.drawImage(
        state.field.image,
        rect.x,
        rect.y,
        rect.w,
        rect.h
      );

      ctx.restore();

      drawFireLight(
        heatX,
        heatY,
        Math.max(
          HEX_W*1.25,
          Math.min(rect.w,rect.h)*0.58
        ),
        info.hottest*
        PROFILE.glow*
        fade
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
  };

  window.AdventurePartyProductionFireballVfx={
    release:"Candidate Rev 19",
    renderer:"Stable Fluids",
    profile:{...PROFILE}
  };
})();
