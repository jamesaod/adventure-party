/*
  Candidate Rev 17 — Fireball VFX Laboratory
  ------------------------------------------
  Development-only comparison bench for three Fireball rendering approaches:

    1) Stable Fluids (default)
       Small CPU 2D velocity/temperature/density field using semi-Lagrangian
       advection, pressure projection, buoyancy, and vorticity confinement.

    2) Procedural / Noise
       Coherent animated flame lobes with heat-based color, sparks/embers,
       smoke transition, illumination, and subtle heat shimmer.

    3) Volumetric Explosion
       One expanding irregular hot volume with noise-deformed silhouette,
       sub-explosions, shockwave, sparks, illumination, and cooling.

  Production Fireball mechanics and VFX are intentionally unchanged.
*/
(()=>{
  "use strict";

  const IDS={
    canvas:"fireballVfxLabCanvas",
    renderer:"fireballVfxLabRenderer",
    play:"fireballVfxLabPlay",
    restart:"fireballVfxLabRestart",
    reroll:"fireballVfxLabReroll",
    resolution:"fireballVfxLabResolution",
    turbulence:"fireballVfxLabTurbulence",
    buoyancy:"fireballVfxLabBuoyancy",
    cooling:"fireballVfxLabCooling",
    glow:"fireballVfxLabGlow",
    embers:"fireballVfxLabEmbers",
    smoke:"fireballVfxLabSmoke",
    distortion:"fireballVfxLabDistortion",
    seed:"fireballVfxLabSeed",
    status:"fireballVfxLabStatus",
    stats:"fireballVfxLabStats"
  };

  const PROJECTILE_MS=430;
  const EXPLOSION_MS=1250;
  const TOTAL_MS=PROJECTILE_MS+EXPLOSION_MS;

  const HEAT_STOPS=[
    [0.00,[84,10,4]],
    [0.18,[145,24,5]],
    [0.38,[222,56,7]],
    [0.58,[255,121,15]],
    [0.76,[255,190,49]],
    [0.90,[255,232,124]],
    [1.00,[255,252,224]]
  ];

  let state=null;
  let raf=0;
  let lastFrameAt=0;
  let avgFrameMs=0;

  function el(id){
    return document.getElementById(id);
  }

  function clamp(value,min,max){
    return Math.min(max,Math.max(min,Number(value)||0));
  }

  function clamp01(value){
    return clamp(value,0,1);
  }

  function lerp(a,b,t){
    return a+(b-a)*t;
  }

  function smoothstep(a,b,x){
    const t=clamp01((x-a)/Math.max(0.00001,b-a));
    return t*t*(3-2*t);
  }

  function hash32(value){
    let x=value|0;
    x=Math.imul(x^(x>>>16),0x45d9f3b);
    x=Math.imul(x^(x>>>16),0x45d9f3b);
    return (x^(x>>>16))>>>0;
  }

  function hash01(value){
    return hash32(value)/4294967295;
  }

  function mulberry32(seed){
    let s=seed|0;
    return ()=>{
      s|=0;
      s=(s+0x6D2B79F5)|0;
      let t=Math.imul(s^(s>>>15),1|s);
      t=(t+Math.imul(t^(t>>>7),61|t))^t;
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }

  function readNumber(id,fallback){
    const node=el(id);
    const value=Number(node?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function params(){
    const resolution=String(el(IDS.resolution)?.value||"56x36");
    const match=resolution.match(/^(\d+)x(\d+)$/);
    return {
      renderer:String(el(IDS.renderer)?.value||"fluid"),
      w:match ? Number(match[1]) : 56,
      h:match ? Number(match[2]) : 36,
      turbulence:clamp(readNumber(IDS.turbulence,0.78),0,1.5),
      buoyancy:clamp(readNumber(IDS.buoyancy,0.88),0,1.6),
      cooling:clamp(readNumber(IDS.cooling,0.93),0.80,0.995),
      glow:clamp(readNumber(IDS.glow,1.20),0.2,2.5),
      embers:clamp(readNumber(IDS.embers,1.00),0,2.0),
      smoke:clamp(readNumber(IDS.smoke,0.38),0,1.25),
      distortion:!!el(IDS.distortion)?.checked,
      seed:(Math.round(readNumber(IDS.seed,217))>>>0)||217
    };
  }

  function heatColor(heat){
    const h=clamp01(heat);
    let a=HEAT_STOPS[0];
    let b=HEAT_STOPS[HEAT_STOPS.length-1];
    for(let i=0;i<HEAT_STOPS.length-1;i++){
      if(h>=HEAT_STOPS[i][0] && h<=HEAT_STOPS[i+1][0]){
        a=HEAT_STOPS[i];
        b=HEAT_STOPS[i+1];
        break;
      }
    }
    const t=(h-a[0])/Math.max(0.00001,b[0]-a[0]);
    return [
      Math.round(lerp(a[1][0],b[1][0],t)),
      Math.round(lerp(a[1][1],b[1][1],t)),
      Math.round(lerp(a[1][2],b[1][2],t))
    ];
  }

  class StableFireField{
    constructor(w,h,seed){
      this.w=w;
      this.h=h;
      this.n=w*h;
      this.seed=seed>>>0;
      this.u=new Float32Array(this.n);
      this.v=new Float32Array(this.n);
      this.u0=new Float32Array(this.n);
      this.v0=new Float32Array(this.n);
      this.temp=new Float32Array(this.n);
      this.temp0=new Float32Array(this.n);
      this.dens=new Float32Array(this.n);
      this.dens0=new Float32Array(this.n);
      this.div=new Float32Array(this.n);
      this.p=new Float32Array(this.n);
      this.curl=new Float32Array(this.n);
      this.image=document.createElement("canvas");
      this.image.width=w;
      this.image.height=h;
      this.imageCtx=this.image.getContext("2d");
      this.imageData=this.imageCtx.createImageData(w,h);
      this.age=0;
      this.reset();
    }

    idx(x,y){
      return x+y*this.w;
    }

    reset(){
      this.u.fill(0);
      this.v.fill(0);
      this.u0.fill(0);
      this.v0.fill(0);
      this.temp.fill(0);
      this.temp0.fill(0);
      this.dens.fill(0);
      this.dens0.fill(0);
      this.div.fill(0);
      this.p.fill(0);
      this.curl.fill(0);
      this.age=0;

      const rng=mulberry32(this.seed);
      const cx=this.w*0.48;
      const cy=this.h*0.60;
      const rx=this.w*0.16;
      const ry=this.h*0.22;

      for(let y=1;y<this.h-1;y++){
        for(let x=1;x<this.w-1;x++){
          const dx=(x-cx)/rx;
          const dy=(y-cy)/ry;
          const r=Math.hypot(dx,dy);
          if(r>1.05) continue;

          const k=this.idx(x,y);
          const hot=Math.pow(Math.max(0,1-r),0.42);
          const angle=Math.atan2(y-cy,x-cx);
          const radial=1.5+3.2*hot;

          this.temp[k]=clamp01(0.55+hot*0.65+rng()*0.12);
          this.dens[k]=clamp01(0.25+hot*0.85+rng()*0.10);
          this.u[k]=Math.cos(angle)*radial*(0.55+rng()*0.45);
          this.v[k]=Math.sin(angle)*radial*(0.55+rng()*0.45)-1.25*hot;
        }
      }
    }

    copy(dst,src){
      dst.set(src);
    }

    boundary(field){
      const w=this.w;
      const h=this.h;
      for(let x=1;x<w-1;x++){
        field[this.idx(x,0)]=field[this.idx(x,1)];
        field[this.idx(x,h-1)]=field[this.idx(x,h-2)];
      }
      for(let y=1;y<h-1;y++){
        field[this.idx(0,y)]=field[this.idx(1,y)];
        field[this.idx(w-1,y)]=field[this.idx(w-2,y)];
      }
    }

    project(iterations=9){
      const w=this.w;
      const h=this.h;
      const u=this.u;
      const v=this.v;
      const p=this.p;
      const div=this.div;

      p.fill(0);

      for(let y=1;y<h-1;y++){
        for(let x=1;x<w-1;x++){
          const k=this.idx(x,y);
          div[k]=-
            0.5*(
              u[this.idx(x+1,y)]-
              u[this.idx(x-1,y)]+
              v[this.idx(x,y+1)]-
              v[this.idx(x,y-1)]
            );
        }
      }

      for(let n=0;n<iterations;n++){
        for(let y=1;y<h-1;y++){
          for(let x=1;x<w-1;x++){
            const k=this.idx(x,y);
            p[k]=(
              div[k]+
              p[this.idx(x-1,y)]+
              p[this.idx(x+1,y)]+
              p[this.idx(x,y-1)]+
              p[this.idx(x,y+1)]
            )*0.25;
          }
        }
        this.boundary(p);
      }

      for(let y=1;y<h-1;y++){
        for(let x=1;x<w-1;x++){
          const k=this.idx(x,y);
          u[k]-=
            0.5*(
              p[this.idx(x+1,y)]-
              p[this.idx(x-1,y)]
            );
          v[k]-=
            0.5*(
              p[this.idx(x,y+1)]-
              p[this.idx(x,y-1)]
            );
        }
      }

      this.boundary(u);
      this.boundary(v);
    }

    advect(dst,src,u,v,dt,scale=1){
      const w=this.w;
      const h=this.h;
      const dtX=dt*w*scale;
      const dtY=dt*h*scale;

      for(let y=1;y<h-1;y++){
        for(let x=1;x<w-1;x++){
          const k=this.idx(x,y);
          let px=x-dtX*u[k];
          let py=y-dtY*v[k];

          px=clamp(px,0.5,w-1.5);
          py=clamp(py,0.5,h-1.5);

          const x0=Math.floor(px);
          const y0=Math.floor(py);
          const x1=x0+1;
          const y1=y0+1;
          const sx=px-x0;
          const sy=py-y0;

          const a=lerp(
            src[this.idx(x0,y0)],
            src[this.idx(x1,y0)],
            sx
          );
          const b=lerp(
            src[this.idx(x0,y1)],
            src[this.idx(x1,y1)],
            sx
          );
          dst[k]=lerp(a,b,sy);
        }
      }
      this.boundary(dst);
    }

    applyVorticity(dt,strength){
      const w=this.w;
      const h=this.h;

      for(let y=1;y<h-1;y++){
        for(let x=1;x<w-1;x++){
          const k=this.idx(x,y);
          this.curl[k]=
            0.5*(
              this.v[this.idx(x+1,y)]-
              this.v[this.idx(x-1,y)]-
              this.u[this.idx(x,y+1)]+
              this.u[this.idx(x,y-1)]
            );
        }
      }

      for(let y=2;y<h-2;y++){
        for(let x=2;x<w-2;x++){
          const k=this.idx(x,y);
          let nx=
            Math.abs(this.curl[this.idx(x+1,y)])-
            Math.abs(this.curl[this.idx(x-1,y)]);
          let ny=
            Math.abs(this.curl[this.idx(x,y+1)])-
            Math.abs(this.curl[this.idx(x,y-1)]);
          const len=Math.hypot(nx,ny)+0.0001;
          nx/=len;
          ny/=len;
          const vort=this.curl[k]*strength;
          this.u[k]+=ny*vort*dt;
          this.v[k]-=nx*vort*dt;
        }
      }
    }

    step(dt,p){
      const stepDt=Math.min(0.032,Math.max(0.008,dt));
      this.age+=stepDt;

      const w=this.w;
      const h=this.h;

      for(let y=1;y<h-1;y++){
        for(let x=1;x<w-1;x++){
          const k=this.idx(x,y);
          const heat=this.temp[k];

          this.v[k]-=
            heat*
            p.buoyancy*
            1.72*
            stepDt;

          const phase=
            this.age*3.3+
            x*0.37+
            y*0.21+
            this.seed*0.0001;

          this.u[k]+=
            Math.sin(phase)*
            heat*
            p.turbulence*
            0.18*
            stepDt;
        }
      }

      this.applyVorticity(
        stepDt,
        2.8*p.turbulence
      );

      this.project(8);

      this.copy(this.u0,this.u);
      this.copy(this.v0,this.v);

      this.advect(
        this.u,
        this.u0,
        this.u0,
        this.v0,
        stepDt,
        0.31
      );
      this.advect(
        this.v,
        this.v0,
        this.u0,
        this.v0,
        stepDt,
        0.31
      );

      this.project(8);

      this.copy(this.temp0,this.temp);
      this.copy(this.dens0,this.dens);

      this.advect(
        this.temp,
        this.temp0,
        this.u,
        this.v,
        stepDt,
        0.34
      );
      this.advect(
        this.dens,
        this.dens0,
        this.u,
        this.v,
        stepDt,
        0.34
      );

      const cool=
        Math.pow(
          p.cooling,
          stepDt*60
        );
      const diss=
        Math.pow(
          0.972,
          stepDt*60
        );

      for(let i=0;i<this.n;i++){
        this.temp[i]*=cool;
        this.dens[i]*=diss;

        if(this.temp[i]<0.002){
          this.temp[i]=0;
        }
        if(this.dens[i]<0.002){
          this.dens[i]=0;
        }
      }
    }

    render(ctx,rect,p,explosionT){
      const data=this.imageData.data;
      let hottest=0;
      let weightedX=0;
      let weightedY=0;
      let totalHeat=0;

      for(let y=0;y<this.h;y++){
        for(let x=0;x<this.w;x++){
          const k=this.idx(x,y);
          const heat=clamp01(this.temp[k]);
          const density=clamp01(this.dens[k]);
          const o=k*4;

          hottest=Math.max(hottest,heat);

          if(heat>0.18){
            totalHeat+=heat;
            weightedX+=x*heat;
            weightedY+=y*heat;
          }

          if(heat>0.03){
            const rgb=heatColor(
              Math.pow(heat,0.72)
            );
            data[o]=rgb[0];
            data[o+1]=rgb[1];
            data[o+2]=rgb[2];
            data[o+3]=
              Math.round(
                255*
                clamp01(
                  density*
                  (0.42+heat*0.78)
                )
              );
          }else{
            const smokeAlpha=
              density*
              p.smoke*
              smoothstep(0.02,0.22,density)*
              (1-smoothstep(0.02,0.18,heat));
            data[o]=58;
            data[o+1]=52;
            data[o+2]=54;
            data[o+3]=
              Math.round(
                180*
                clamp01(smokeAlpha)
              );
          }
        }
      }

      this.imageCtx.putImageData(
        this.imageData,
        0,
        0
      );

      ctx.save();
      ctx.globalCompositeOperation="lighter";
      ctx.imageSmoothingEnabled=true;
      ctx.globalAlpha=
        clamp01(
          1.15-
          explosionT*0.35
        );
      ctx.drawImage(
        this.image,
        rect.x,
        rect.y,
        rect.w,
        rect.h
      );
      ctx.restore();

      if(totalHeat>0){
        const hx=
          rect.x+
          (
            weightedX/
            totalHeat/
            Math.max(1,this.w-1)
          )*
          rect.w;
        const hy=
          rect.y+
          (
            weightedY/
            totalHeat/
            Math.max(1,this.h-1)
          )*
          rect.h;

        drawFireLight(
          ctx,
          hx,
          hy,
          Math.min(rect.w,rect.h)*0.55,
          hottest*
          p.glow*
          (1-explosionT*0.32)
        );
      }
    }
  }

  function makeParticles(seed,count){
    const rng=mulberry32(seed);
    const out=[];
    for(let i=0;i<count;i++){
      const angle=rng()*Math.PI*2;
      const speed=0.4+rng()*1.35;
      const ember=rng()<0.62;
      out.push({
        angle,
        speed,
        ember,
        phase:rng()*Math.PI*2,
        size:rng()<0.14 ? 3 : (rng()<0.48 ? 2 : 1),
        lift:0.45+rng()*1.2,
        born:rng()*0.22
      });
    }
    return out;
  }

  function newState(){
    const p=params();
    return {
      p,
      seed:p.seed,
      started:performance.now(),
      playing:false,
      pausedAt:0,
      fluid:new StableFireField(
        p.w,
        p.h,
        p.seed
      ),
      sparks:makeParticles(
        p.seed^0x9e3779b9,
        180
      ),
      lobes:makeParticles(
        p.seed^0x243f6a88,
        74
      )
    };
  }

  function resetState(playing=false){
    if(raf){
      cancelAnimationFrame(raf);
      raf=0;
    }
    state=newState();
    state.playing=playing;
    state.started=performance.now();
    lastFrameAt=performance.now();
    avgFrameMs=0;

    if(playing){
      setStatus("Playing Fireball VFX sequence…","playing");
      raf=requestAnimationFrame(frame);
    }else{
      drawFrame(0);
      setStatus("Fireball VFX lab ready.","ready");
    }
  }

  function setStatus(text,stateName="ready"){
    const node=el(IDS.status);
    if(!node) return;
    node.textContent=text;
    node.dataset.state=stateName;
  }

  function updateReadouts(){
    document.querySelectorAll("[data-fireball-vfx-output]").forEach(output=>{
      const source=el(
        output.getAttribute(
          "data-fireball-vfx-output"
        )
      );
      if(!source) return;
      let value=source.value;
      const unit=output.getAttribute("data-unit")||"";
      if(
        source.type==="range" &&
        String(source.step).includes(".")
      ){
        value=Number(value).toFixed(2);
      }
      output.textContent=value+unit;
    });
  }

  function canvasSize(canvas){
    const w=Math.max(280,canvas.clientWidth||360);
    const h=Math.max(190,canvas.clientHeight||220);
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const pw=Math.round(w*dpr);
    const ph=Math.round(h*dpr);
    if(canvas.width!==pw || canvas.height!==ph){
      canvas.width=pw;
      canvas.height=ph;
    }
    return {w,h,dpr};
  }

  function drawBackdrop(ctx,w,h){
    ctx.fillStyle="#050407";
    ctx.fillRect(0,0,w,h);

    ctx.strokeStyle="rgba(120,135,140,0.10)";
    ctx.lineWidth=1;

    const step=22;
    for(let x=0;x<=w;x+=step){
      ctx.beginPath();
      ctx.moveTo(x,0);
      ctx.lineTo(x,h);
      ctx.stroke();
    }
    for(let y=0;y<=h;y+=step){
      ctx.beginPath();
      ctx.moveTo(0,y);
      ctx.lineTo(w,y);
      ctx.stroke();
    }

    const groundY=h*0.74;
    ctx.strokeStyle="rgba(185,175,145,0.20)";
    ctx.beginPath();
    ctx.moveTo(0,groundY);
    ctx.lineTo(w,groundY);
    ctx.stroke();
  }

  function projectilePoint(w,h,t){
    const start={x:w*0.10,y:h*0.62};
    const end={x:w*0.50,y:h*0.52};
    const arc=Math.sin(Math.PI*t)*h*0.11;
    return {
      x:lerp(start.x,end.x,t),
      y:lerp(start.y,end.y,t)-arc,
      start,
      end
    };
  }

  function drawProjectile(ctx,w,h,t,p){
    const point=projectilePoint(w,h,t);
    const dx=point.end.x-point.start.x;
    const dy=point.end.y-point.start.y;

    ctx.save();
    ctx.globalCompositeOperation="lighter";

    for(let i=8;i>=1;i--){
      const tt=Math.max(0,t-i*0.035);
      const tail=projectilePoint(w,h,tt);
      const heat=1-i/10;
      const rgb=heatColor(0.42+heat*0.48);
      const radius=2.5+(9-i)*0.72;
      ctx.fillStyle=
        "rgba("+rgb[0]+","+rgb[1]+","+rgb[2]+","+
        (0.22+heat*0.08)+")";
      ctx.beginPath();
      ctx.arc(tail.x,tail.y,radius,0,Math.PI*2);
      ctx.fill();
    }

    const core=
      ctx.createRadialGradient(
        point.x,
        point.y,
        0,
        point.x,
        point.y,
        18
      );
    core.addColorStop(0,"rgba(255,255,238,1)");
    core.addColorStop(0.18,"rgba(255,236,125,0.98)");
    core.addColorStop(0.48,"rgba(255,126,20,0.82)");
    core.addColorStop(1,"rgba(175,28,5,0)");
    ctx.fillStyle=core;
    ctx.beginPath();
    ctx.arc(point.x,point.y,18,0,Math.PI*2);
    ctx.fill();

    drawFireLight(
      ctx,
      point.x,
      point.y,
      58,
      0.42*p.glow
    );

    ctx.restore();
  }

  function drawFireLight(ctx,x,y,radius,strength){
    if(strength<=0) return;

    ctx.save();
    ctx.globalCompositeOperation="lighter";
    const g=ctx.createRadialGradient(
      x,y,0,
      x,y,radius
    );
    g.addColorStop(
      0,
      "rgba(255,245,190,"+
      (0.28*strength)+")"
    );
    g.addColorStop(
      0.20,
      "rgba(255,176,58,"+
      (0.17*strength)+")"
    );
    g.addColorStop(
      0.62,
      "rgba(236,78,14,"+
      (0.065*strength)+")"
    );
    g.addColorStop(1,"rgba(180,36,6,0)");
    ctx.fillStyle=g;
    ctx.beginPath();
    ctx.arc(x,y,radius,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  function drawHeatDistortion(ctx,canvas,x,y,w,h,time,strength){
    if(!strength || w<4 || h<4) return;
    const sx=Math.max(0,Math.floor(x));
    const sy=Math.max(0,Math.floor(y));
    const sw=Math.min(canvas.width-sx,Math.ceil(w));
    const sh=Math.min(canvas.height-sy,Math.ceil(h));
    if(sw<=0 || sh<=0) return;

    try{
      const copy=document.createElement("canvas");
      copy.width=sw;
      copy.height=sh;
      const c=copy.getContext("2d");
      c.drawImage(
        canvas,
        sx,sy,sw,sh,
        0,0,sw,sh
      );

      ctx.save();
      ctx.globalAlpha=0.55;
      for(let yy=0;yy<sh;yy+=5){
        const offset=
          Math.sin(
            time*0.018+
            yy*0.16
          )*
          2.2*
          strength;
        ctx.drawImage(
          copy,
          0,yy,sw,5,
          sx+offset,sy+yy,sw,5
        );
      }
      ctx.restore();
    }catch(_error){
      // Distortion is optional; never let it break the lab.
    }
  }

  function drawSparks(ctx,cx,cy,t,p,particles){
    ctx.save();
    ctx.globalCompositeOperation="lighter";

    const count=
      Math.min(
        particles.length,
        Math.round(
          115*p.embers
        )
      );

    for(let i=0;i<count;i++){
      const part=particles[i];
      if(t<part.born) continue;
      const local=clamp01(
        (t-part.born)/
        Math.max(0.01,1-part.born)
      );
      if(local>=1) continue;

      const fast=part.ember ? 0.72 : 1.28;
      const radial=
        (
          22+
          96*local*
          part.speed*
          fast
        );
      const gravity=
        part.ember
          ? -24*local*part.lift
          : 25*local*local;
      const x=
        cx+
        Math.cos(part.angle)*radial;
      const y=
        cy+
        Math.sin(part.angle)*radial*0.56+
        gravity;

      const heat=
        clamp01(
          1-local*
          (part.ember ? 0.78 : 1.04)
        );
      const rgb=heatColor(
        0.34+heat*0.64
      );
      const alpha=
        Math.pow(1-local,1.2)*
        (part.ember ? 0.75 : 0.92);

      ctx.fillStyle=
        "rgba("+rgb[0]+","+rgb[1]+","+rgb[2]+","+alpha+")";

      if(part.ember){
        ctx.fillRect(
          Math.round(x),
          Math.round(y),
          part.size,
          part.size
        );
      }else{
        const tail=4+part.size*2;
        ctx.strokeStyle=
          "rgba("+rgb[0]+","+rgb[1]+","+rgb[2]+","+
          (alpha*0.75)+")";
        ctx.lineWidth=Math.max(1,part.size*0.65);
        ctx.beginPath();
        ctx.moveTo(x,y);
        ctx.lineTo(
          x-Math.cos(part.angle)*tail,
          y-Math.sin(part.angle)*tail*0.56
        );
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawSmoke(ctx,cx,cy,t,p,seed){
    if(p.smoke<=0) return;

    ctx.save();
    const count=Math.round(18*p.smoke);
    for(let i=0;i<count;i++){
      const born=0.20+hash01(seed+i*71)*0.38;
      if(t<born) continue;
      const local=clamp01((t-born)/(1-born));
      const angle=hash01(seed+i*97+13)*Math.PI*2;
      const radial=
        8+
        local*
        (24+hash01(seed+i*109+31)*32);
      const rise=
        local*
        (28+hash01(seed+i*127+7)*42);
      const x=
        cx+
        Math.cos(angle)*radial;
      const y=
        cy+
        Math.sin(angle)*radial*0.45-
        rise;
      const radius=
        8+
        local*17+
        hash01(seed+i*149)*7;
      const alpha=
        p.smoke*
        0.11*
        Math.sin(Math.PI*local);

      const g=ctx.createRadialGradient(
        x,y,0,
        x,y,radius
      );
      g.addColorStop(
        0,
        "rgba(72,64,62,"+alpha+")"
      );
      g.addColorStop(
        0.55,
        "rgba(52,48,49,"+(alpha*0.55)+")"
      );
      g.addColorStop(
        1,
        "rgba(28,27,31,0)"
      );
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.arc(x,y,radius,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawProceduralExplosion(ctx,cx,cy,t,p,seed,lobes){
    const growth=
      1-Math.pow(1-clamp01(t/0.34),2.6);
    const cool=clamp01((t-0.18)/0.82);
    const fade=
      t<0.70
        ? 1
        : 1-(t-0.70)/0.30;

    if(fade<=0) return;

    ctx.save();
    ctx.globalCompositeOperation="lighter";

    const count=58;
    for(let i=0;i<count;i++){
      const part=lobes[i%lobes.length];
      const radialSeed=hash01(seed+i*43);
      const angle=
        part.angle+
        Math.sin(t*10+part.phase)*0.18*p.turbulence;
      const radial=
        growth*
        (
          15+
          radialSeed*55
        );
      const rise=
        Math.pow(t,1.4)*
        (
          4+
          radialSeed*34*p.buoyancy
        );
      const x=
        cx+
        Math.cos(angle)*radial;
      const y=
        cy+
        Math.sin(angle)*radial*0.60-
        rise;
      const size=
        (
          10+
          hash01(seed+i*89+5)*22
        )*
        (
          0.50+
          growth*0.75
        );
      const edge=
        clamp01(radial/75);
      const heat=
        clamp01(
          1-
          cool*0.74-
          edge*0.28+
          Math.sin(
            t*14+
            part.phase
          )*0.06
        );
      const rgb=heatColor(
        0.20+heat*0.80
      );
      const alpha=
        fade*
        (0.14+heat*0.21);

      const g=ctx.createRadialGradient(
        x-size*0.12,
        y-size*0.12,
        0,
        x,y,size
      );
      g.addColorStop(
        0,
        "rgba("+rgb[0]+","+rgb[1]+","+rgb[2]+","+Math.min(1,alpha*2.4)+")"
      );
      g.addColorStop(
        0.42,
        "rgba("+rgb[0]+","+rgb[1]+","+rgb[2]+","+alpha+")"
      );
      g.addColorStop(
        1,
        "rgba("+Math.max(70,rgb[0]-90)+",24,6,0)"
      );
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.arc(x,y,size,0,Math.PI*2);
      ctx.fill();
    }

    ctx.restore();

    drawFireLight(
      ctx,
      cx,
      cy-15*t*p.buoyancy,
      105,
      fade*
      p.glow*
      (1-cool*0.35)
    );

    drawSparks(
      ctx,cx,cy,t,p,state.sparks
    );
    drawSmoke(
      ctx,cx,cy,t,p,seed
    );
  }

  function drawVolumetricExplosion(ctx,cx,cy,t,p,seed){
    const growth=
      1-Math.pow(
        1-clamp01(t/0.28),
        3.1
      );
    const cool=clamp01((t-0.12)/0.88);
    const fade=
      t<0.76
        ? 1
        : 1-(t-0.76)/0.24;
    if(fade<=0) return;

    ctx.save();
    ctx.globalCompositeOperation="lighter";

    if(t<0.13){
      const flash=
        Math.sin(
          Math.PI*
          clamp01(t/0.13)
        );
      const g=ctx.createRadialGradient(
        cx,cy,0,
        cx,cy,58+growth*40
      );
      g.addColorStop(
        0,
        "rgba(255,255,244,"+
        (0.72*flash)+")"
      );
      g.addColorStop(
        0.25,
        "rgba(255,220,104,"+
        (0.45*flash)+")"
      );
      g.addColorStop(1,"rgba(255,70,8,0)");
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.arc(
        cx,cy,58+growth*40,
        0,Math.PI*2
      );
      ctx.fill();
    }

    const points=54;
    const radius=
      18+
      growth*67;
    ctx.beginPath();
    for(let i=0;i<points;i++){
      const angle=i/points*Math.PI*2;
      const n1=
        Math.sin(
          angle*3+
          t*4.4+
          seed*0.001
        );
      const n2=
        Math.sin(
          angle*7-
          t*7.2+
          seed*0.003
        );
      const n3=
        Math.sin(
          angle*13+
          t*11.3
        );
      const noisy=
        radius*
        (
          1+
          (
            n1*0.11+
            n2*0.055+
            n3*0.028
          )*
          p.turbulence
        );
      const lift=
        Math.max(
          0,
          Math.sin(angle)
        )*
        17*
        t*
        p.buoyancy;
      const x=
        cx+
        Math.cos(angle)*noisy;
      const y=
        cy+
        Math.sin(angle)*noisy*0.68-
        lift-
        t*18*p.buoyancy;
      if(i===0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    }
    ctx.closePath();

    const grad=ctx.createRadialGradient(
      cx-10,
      cy-12-t*10,
      2,
      cx,
      cy-t*12,
      radius*1.15
    );
    grad.addColorStop(
      0,
      "rgba(255,254,225,"+
      (0.90*fade)+")"
    );
    grad.addColorStop(
      0.25,
      "rgba(255,221,92,"+
      (0.82*fade)+")"
    );
    grad.addColorStop(
      0.55,
      "rgba(255,117,14,"+
      (0.72*fade)+")"
    );
    grad.addColorStop(
      0.82,
      "rgba(201,42,5,"+
      (0.44*fade)+")"
    );
    grad.addColorStop(
      1,
      "rgba(90,13,4,0)"
    );
    ctx.fillStyle=grad;
    ctx.fill();

    for(let sub=0;sub<4;sub++){
      const born=0.08+sub*0.055;
      if(t<born) continue;
      const local=clamp01((t-born)/0.48);
      const angle=
        hash01(seed+sub*211)*Math.PI*2;
      const sr=
        12+
        local*
        (
          19+
          hash01(seed+sub*317)*16
        );
      const x=
        cx+
        Math.cos(angle)*
        radius*
        (0.18+sub*0.10);
      const y=
        cy+
        Math.sin(angle)*
        radius*
        0.36-
        local*18*p.buoyancy;
      const sg=ctx.createRadialGradient(
        x,y,0,
        x,y,sr
      );
      sg.addColorStop(
        0,
        "rgba(255,253,220,"+
        ((1-local)*0.62*fade)+")"
      );
      sg.addColorStop(
        0.45,
        "rgba(255,153,28,"+
        ((1-local)*0.42*fade)+")"
      );
      sg.addColorStop(1,"rgba(190,35,5,0)");
      ctx.fillStyle=sg;
      ctx.beginPath();
      ctx.arc(x,y,sr,0,Math.PI*2);
      ctx.fill();
    }

    if(t<0.38){
      const ringT=clamp01(t/0.38);
      ctx.strokeStyle=
        "rgba(255,206,104,"+
        ((1-ringT)*0.42)+")";
      ctx.lineWidth=2.4;
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy,
        12+ringT*105,
        6+ringT*46,
        0,
        0,
        Math.PI*2
      );
      ctx.stroke();
    }

    ctx.restore();

    drawFireLight(
      ctx,
      cx,
      cy-t*16*p.buoyancy,
      122,
      p.glow*
      fade*
      (1-cool*0.30)
    );

    drawSparks(
      ctx,cx,cy,t,p,state.sparks
    );
    drawSmoke(
      ctx,cx,cy,t,p,seed^0x83d1
    );
  }

  function drawStableFluidExplosion(ctx,canvas,w,h,t,p){
    if(!state?.fluid) return;

    const rect={
      x:w*0.24,
      y:h*0.18,
      w:w*0.52,
      h:h*0.62
    };

    state.fluid.render(
      ctx,
      rect,
      p,
      t
    );

    const cx=w*0.50;
    const cy=h*0.52;

    drawSparks(
      ctx,cx,cy,t,p,state.sparks
    );

    if(t>0.22){
      drawSmoke(
        ctx,cx,cy,t,p,state.seed^0x7193
      );
    }

    if(p.distortion){
      drawHeatDistortion(
        ctx,
        canvas,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        performance.now(),
        0.55*
        (1-t)*
        p.glow
      );
    }
  }

  function drawFrame(elapsed){
    const canvas=el(IDS.canvas);
    if(!canvas || !state) return;

    const ctx=canvas.getContext("2d");
    const size=canvasSize(canvas);
    ctx.setTransform(
      size.dpr,0,0,size.dpr,0,0
    );

    drawBackdrop(
      ctx,
      size.w,
      size.h
    );

    const p=state.p;

    if(elapsed<PROJECTILE_MS){
      drawProjectile(
        ctx,
        size.w,
        size.h,
        clamp01(elapsed/PROJECTILE_MS),
        p
      );
      return;
    }

    const explosionElapsed=
      elapsed-PROJECTILE_MS;
    const t=
      clamp01(
        explosionElapsed/
        EXPLOSION_MS
      );
    const cx=size.w*0.50;
    const cy=size.h*0.52;

    if(p.distortion && p.renderer!=="fluid"){
      drawHeatDistortion(
        ctx,
        canvas,
        cx-95,
        cy-82,
        190,
        154,
        performance.now(),
        0.32*
        (1-t)*
        p.glow
      );
    }

    switch(p.renderer){
      case "noise":
        drawProceduralExplosion(
          ctx,cx,cy,t,p,
          state.seed,
          state.lobes
        );
        break;

      case "volume":
        drawVolumetricExplosion(
          ctx,cx,cy,t,p,
          state.seed
        );
        break;

      case "fluid":
      default:
        drawStableFluidExplosion(
          ctx,
          canvas,
          size.w,
          size.h,
          t,
          p
        );
        break;
    }
  }

  function frame(now){
    raf=0;

    if(
      !state?.playing ||
      currentScreen!=="spell-preview"
    ){
      return;
    }

    const elapsed=
      now-state.started;
    const dt=
      Math.min(
        0.040,
        Math.max(
          0.008,
          (now-lastFrameAt)/1000
        )
      );
    lastFrameAt=now;

    const frameMs=dt*1000;
    avgFrameMs=
      avgFrameMs===0
        ? frameMs
        : avgFrameMs*0.90+frameMs*0.10;

    if(
      elapsed>=PROJECTILE_MS &&
      elapsed<=TOTAL_MS &&
      state.p.renderer==="fluid"
    ){
      state.fluid.step(
        dt,
        state.p
      );
    }

    drawFrame(
      Math.min(
        TOTAL_MS,
        elapsed
      )
    );

    updateStats(elapsed);

    if(elapsed<TOTAL_MS){
      raf=requestAnimationFrame(frame);
    }else{
      state.playing=false;
      setStatus(
        "Fireball VFX sequence complete.",
        "ready"
      );
    }
  }

  function updateStats(elapsed=0){
    const node=el(IDS.stats);
    if(!node || !state) return;
    const p=state.p;
    const label=
      p.renderer==="fluid"
        ? "Stable Fluids"
        : p.renderer==="noise"
          ? "Procedural / Noise"
          : "Volumetric Explosion";

    node.textContent=
      label+
      " · "+
      p.w+"×"+p.h+
      " grid · "+
      Math.round(
        clamp(
          elapsed,
          0,
          TOTAL_MS
        )
      )+
      " ms · "+
      avgFrameMs.toFixed(1)+
      " ms/frame";
  }

  function play(){
    resetState(true);
  }

  function restart(){
    resetState(false);
  }

  function reroll(){
    const seedNode=el(IDS.seed);
    if(seedNode){
      seedNode.value=
        String(
          (
            (Number(seedNode.value)||0)+1
          )>>>0
        );
    }
    updateReadouts();
    resetState(false);
  }

  function wire(){
    if(!el(IDS.canvas)) return;

    document.querySelectorAll(
      "[data-fireball-vfx-control]"
    ).forEach(node=>{
      node.addEventListener(
        "input",
        updateReadouts
      );
      node.addEventListener(
        "change",
        ()=>{
          updateReadouts();
          resetState(false);
        }
      );
    });

    el(IDS.renderer)?.addEventListener(
      "change",
      ()=>resetState(false)
    );
    el(IDS.resolution)?.addEventListener(
      "change",
      ()=>resetState(false)
    );
    el(IDS.distortion)?.addEventListener(
      "change",
      ()=>resetState(false)
    );
    el(IDS.seed)?.addEventListener(
      "change",
      ()=>resetState(false)
    );

    el(IDS.play)?.addEventListener(
      "click",
      play
    );
    el(IDS.restart)?.addEventListener(
      "click",
      restart
    );
    el(IDS.reroll)?.addEventListener(
      "click",
      reroll
    );

    updateReadouts();
    resetState(false);
  }

  window.AdventurePartyFireballVfxLab={
    release:"Candidate Rev 17",
    play,
    restart,
    reroll,
    getState:()=>state,
    renderers:[
      "fluid",
      "noise",
      "volume"
    ]
  };

  if(document.readyState==="loading"){
    document.addEventListener(
      "DOMContentLoaded",
      wire,
      {once:true}
    );
  }else{
    wire();
  }
})();
