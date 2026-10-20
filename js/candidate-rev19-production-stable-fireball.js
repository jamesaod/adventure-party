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

  function isConstrainedFireball(fx){
    const cells=
      Array.isArray(fx?.cells)
        ? fx.cells
        : [];

    if(!cells.length){
      return false;
    }

    const environments=
      new Set(
        cells.map(cell=>
          fireballHexEnvironment(cell)
        )
      );

    if(
      environments.size>1 ||
      fireballHexEnvironment({
        x:fx.x,
        y:fx.y
      })==="indoor"
    ){
      return true;
    }

    const radius=
      Math.max(
        1,
        Number(fx.radiusHexes)||1
      );

    const nominal=
      hexesWithinRadius(
        {
          x:fx.x,
          y:fx.y
        },
        radius
      );

    if(cells.length!==nominal.length){
      return true;
    }

    const actualKeys=
      new Set(
        cells.map(cell=>
          key(cell.x,cell.y)
        )
      );

    return nominal.some(cell=>
      !actualKeys.has(
        key(cell.x,cell.y)
      )
    );
  }


  function constrainedFireballTopology(fx){
    const cells=
      Array.isArray(fx?.cells)
        ? fx.cells
            .filter(cell=>
              Number.isFinite(cell?.x) &&
              Number.isFinite(cell?.y)
            )
            .map(cell=>({
              ...cell
            }))
        : [];

    const byKey=
      new Map(
        cells.map(cell=>[
          key(cell.x,cell.y),
          cell
        ])
      );

    const edges=[];
    const seenEdges=new Set();

    for(const cell of cells){
      for(const dir of HEX_DIRS){
        const neighbor=
          byKey.get(
            key(
              cell.x+dir.x,
              cell.y+dir.y
            )
          );

        if(!neighbor){
          continue;
        }

        const aKey=
          key(cell.x,cell.y);

        const bKey=
          key(
            neighbor.x,
            neighbor.y
          );

        const edgeKey=
          aKey<bKey
            ? aKey+"|"+bKey
            : bKey+"|"+aKey;

        if(seenEdges.has(edgeKey)){
          continue;
        }

        seenEdges.add(edgeKey);

        if(
          volumetricStepOpen(
            cell,
            neighbor
          )
        ){
          edges.push({
            a:cell,
            b:neighbor
          });
        }
      }
    }

    return {
      cells,
      edges
    };
  }


  function constrainedCellGrowth(cell,t){
    const distance=
      Math.max(
        0,
        Number(cell?.volumeDistance)||0
      );

    const delay=
      Math.min(
        0.14,
        distance*0.018
      );

    return clamp01(
      (t-delay)/
      Math.max(
        0.001,
        0.24-delay*0.25
      )
    );
  }


  function drawConstrainedBridge(
    edge,
    t,
    fade,
    seed,
    index
  ){
    const a=
      hexCenter(
        edge.a.x,
        edge.a.y
      );

    const b=
      hexCenter(
        edge.b.x,
        edge.b.y
      );

    const growth=
      Math.min(
        constrainedCellGrowth(
          edge.a,
          t
        ),
        constrainedCellGrowth(
          edge.b,
          t
        )
      );

    if(growth<=0.02){
      return;
    }

    const dx=b.x-a.x;
    const dy=b.y-a.y;
    const len=
      Math.max(
        1,
        Math.hypot(dx,dy)
      );

    const nx=-dy/len;
    const ny=dx/len;

    const phase=
      performance.now()*0.011+
      seed*0.00013+
      index*1.83;

    const bend=
      Math.sin(phase)*
      HEX_W*
      0.10;

    const mx=
      (a.x+b.x)/2+
      nx*bend;

    const my=
      (a.y+b.y)/2+
      ny*bend-
      HEX_H*0.14*
      Math.sin(
        phase*0.77
      );

    ctx.save();
    ctx.globalCompositeOperation=
      "source-over";
    ctx.lineCap="round";

    ctx.strokeStyle=
      "rgba(210,55,7,"+
      (0.34*fade*growth)+
      ")";

    ctx.lineWidth=
      HEX_W*
      0.48*
      growth;

    ctx.beginPath();
    ctx.moveTo(a.x,a.y);
    ctx.quadraticCurveTo(
      mx,my,
      b.x,b.y
    );
    ctx.stroke();

    ctx.globalCompositeOperation=
      "lighter";

    ctx.strokeStyle=
      "rgba(255,167,32,"+
      (0.30*fade*growth)+
      ")";

    ctx.lineWidth=
      HEX_W*
      0.24*
      growth;

    ctx.beginPath();
    ctx.moveTo(a.x,a.y);
    ctx.quadraticCurveTo(
      mx,my,
      b.x,b.y
    );
    ctx.stroke();

    ctx.restore();
  }


  function drawConstrainedCellFlame(
    cell,
    t,
    fade,
    seed,
    index
  ){
    const growth=
      constrainedCellGrowth(
        cell,
        t
      );

    if(growth<=0.01){
      return;
    }

    const center=
      hexCenter(
        cell.x,
        cell.y
      );

    const age=
      clamp01(
        (
          t-
          Math.min(
            0.14,
            (
              Number(
                cell.volumeDistance
              )||0
            )*0.018
          )
        )/
        0.84
      );

    const environment=
      cell.volumeEnvironment ||
      fireballHexEnvironment(cell);

    const lobeCount=
      environment==="indoor"
        ? 5
        : 6;

    for(let lobe=0;lobe<lobeCount;lobe++){
      const h1=
        Math.sin(
          seed*0.00017+
          index*5.31+
          lobe*9.73
        )*0.5+0.5;

      const h2=
        Math.sin(
          seed*0.00029+
          index*7.11+
          lobe*4.17
        )*0.5+0.5;

      const phase=
        performance.now()*
        (
          0.007+
          lobe*0.0007
        )+
        index*1.17+
        lobe*2.03;

      const rise=
        (
          3+
          18*age*
          PROFILE.buoyancy
        )*
        (
          0.55+
          h1*0.60
        );

      const sway=
        Math.sin(phase)*
        HEX_W*
        (
          0.045+
          age*0.055
        );

      const ox=
        (
          h1-0.5
        )*
        HEX_W*
        0.42+
        sway;

      const oy=
        (
          h2-0.5
        )*
        HEX_H*
        0.22-
        rise;

      const radius=
        HEX_W*
        (
          0.30+
          h2*0.13+
          age*0.06
        )*
        (
          0.60+
          growth*0.50
        );

      const heat=
        clamp01(
          0.96-
          age*0.48-
          Math.abs(h1-0.5)*0.18+
          Math.sin(
            phase*1.8
          )*0.045
        );

      const rgb=
        heatColor(
          0.28+
          heat*0.72
        );

      ctx.save();
      ctx.translate(
        center.x+ox,
        center.y+oy
      );

      ctx.scale(
        1,
        1.12+
        age*0.50+
        h1*0.18
      );

      const gradient=
        ctx.createRadialGradient(
          -radius*0.10,
          -radius*0.12,
          0,
          0,0,
          radius
        );

      gradient.addColorStop(
        0,
        "rgba(255,247,189,"+
        Math.min(
          0.94,
          0.70*fade*growth
        )+
        ")"
      );

      gradient.addColorStop(
        0.30,
        "rgba("+
        rgb[0]+","+
        rgb[1]+","+
        rgb[2]+","+
        (0.58*fade*growth)+
        ")"
      );

      gradient.addColorStop(
        0.68,
        "rgba(222,66,7,"+
        (0.34*fade*growth)+
        ")"
      );

      gradient.addColorStop(
        1,
        "rgba(110,15,3,0)"
      );

      ctx.fillStyle=gradient;
      ctx.beginPath();
      ctx.arc(
        0,0,radius,
        0,Math.PI*2
      );
      ctx.fill();

      ctx.restore();
    }

    /*
      A small per-cell emissive core reinforces local volume without turning
      the whole constrained blast into one central spotlight.
    */
    const coreStrength=
      Math.pow(
        Math.max(0,1-t),
        1.20
      )*
      growth*
      fade;

    drawFireLight(
      center.x,
      center.y-
      HEX_H*0.12,
      HEX_W*0.72,
      0.34*
      PROFILE.glow*
      coreStrength
    );
  }


  function drawConstrainedEmbers(
    topology,
    t,
    fade,
    seed
  ){
    if(!topology.cells.length){
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation=
      "lighter";

    const particlesPerCell=5;

    for(
      let cellIndex=0;
      cellIndex<topology.cells.length;
      cellIndex++
    ){
      const cell=
        topology.cells[cellIndex];

      const growth=
        constrainedCellGrowth(
          cell,
          t
        );

      if(growth<=0.04){
        continue;
      }

      const center=
        hexCenter(
          cell.x,
          cell.y
        );

      for(
        let p=0;
        p<particlesPerCell;
        p++
      ){
        const h1=
          Math.sin(
            seed*0.00031+
            cellIndex*8.71+
            p*13.37
          )*0.5+0.5;

        const h2=
          Math.sin(
            seed*0.00019+
            cellIndex*3.97+
            p*7.23
          )*0.5+0.5;

        const born=
          0.10+
          h1*0.30;

        if(t<born){
          continue;
        }

        const local=
          clamp01(
            (t-born)/
            Math.max(
              0.01,
              1-born
            )
          );

        const angle=
          h2*Math.PI*2;

        const radial=
          HEX_W*
          (
            0.10+
            local*
            (
              0.35+
              h1*0.55
            )
          );

        const x=
          center.x+
          Math.cos(angle)*
          radial;

        const y=
          center.y+
          Math.sin(angle)*
          radial*0.55-
          local*
          HEX_H*
          (
            0.35+
            h2*0.65
          );

        const alpha=
          Math.pow(
            1-local,
            1.4
          )*
          fade*
          0.72;

        ctx.fillStyle=
          p%2===0
            ? "rgba(255,225,106,"+
              alpha+
              ")"
            : "rgba(255,106,13,"+
              alpha+
              ")";

        const size=
          p===0
            ? 2
            : 1;

        ctx.fillRect(
          Math.round(x),
          Math.round(y),
          size,
          size
        );
      }
    }

    ctx.restore();
  }


  function drawConstrainedFireballExplosion(fx){
    const state=
      stateFor(fx);

    const now=
      performance.now();

    const elapsed=
      Math.max(
        0,
        now-fx.started
      );

    const duration=
      Math.max(
        1,
        Number(fx.duration)||820
      );

    const t=
      clamp01(
        elapsed/duration
      );

    const fade=
      t<0.76
        ? 1
        : clamp01(
            1-
            (t-0.76)/0.24
          );

    const topology=
      constrainedFireballTopology(fx);

    if(!topology.cells.length){
      return;
    }

    drawIgnitionFlash(
      hexCenter(
        fx.x,
        fx.y
      ),
      elapsed,
      HEX_W*2.1
    );

    /*
      Broad fiery illumination follows the actual occupied topology. There is
      no rectangular field or tactical mask in this renderer.
    */
    const lightDecay=
      Math.pow(
        Math.max(0,1-t),
        1.35
      )*
      fade;

    if(lightDecay>0.002){
      for(
        let index=0;
        index<topology.cells.length;
        index++
      ){
        const cell=
          topology.cells[index];

        const growth=
          constrainedCellGrowth(
            cell,
            t
          );

        if(growth<=0.02){
          continue;
        }

        const center=
          hexCenter(
            cell.x,
            cell.y
          );

        drawFireLight(
          center.x,
          center.y,
          HEX_W*
          (
            0.82+
            growth*0.16
          ),
          PROFILE.glow*
          lightDecay*
          growth*
          0.30
        );
      }
    }

    for(
      let index=0;
      index<topology.edges.length;
      index++
    ){
      drawConstrainedBridge(
        topology.edges[index],
        t,
        fade,
        state.seed,
        index
      );
    }

    for(
      let index=0;
      index<topology.cells.length;
      index++
    ){
      drawConstrainedCellFlame(
        topology.cells[index],
        t,
        fade,
        state.seed,
        index
      );
    }

    drawConstrainedEmbers(
      topology,
      t,
      fade,
      state.seed
    );
  }


  function renderStableFireballExplosion(fx){
    if(!fx) return;

    if(isConstrainedFireball(fx)){
      drawConstrainedFireballExplosion(fx);
      return;
    }

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
    release:"Candidate Rev 25",
    renderer:"Hybrid: Stable Fluids open / topology-aware constrained",
    profile:{...PROFILE}
  };
})();
