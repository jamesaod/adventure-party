/*
  Candidate Rev 19 — Stable-Fluids Fireball core
  Shared bounded CPU fire field promoted from the Fireball VFX laboratory.
*/
(()=>{
  "use strict";

  const PROFILE=Object.freeze({
    w:64,
    h:40,
    turbulence:1.50,
    buoyancy:1.60,
    cooling:0.99,
    glow:2.50,
    embers:2.00,
    smoke:1.25,
    distortion:true
  });

  const STOPS=[
    [0.00,[84,10,4]],
    [0.18,[145,24,5]],
    [0.38,[222,56,7]],
    [0.58,[255,121,15]],
    [0.76,[255,190,49]],
    [0.90,[255,232,124]],
    [1.00,[255,252,224]]
  ];

  const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0));
  const clamp01=v=>clamp(v,0,1);
  const lerp=(a,b,t)=>a+(b-a)*t;

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

  function heatColor(heat){
    const h=clamp01(heat);
    let a=STOPS[0];
    let b=STOPS[STOPS.length-1];

    for(let i=0;i<STOPS.length-1;i++){
      if(h>=STOPS[i][0] && h<=STOPS[i+1][0]){
        a=STOPS[i];
        b=STOPS[i+1];
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
    constructor(seed){
      this.w=PROFILE.w;
      this.h=PROFILE.h;
      this.n=this.w*this.h;
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
      this.pressure=new Float32Array(this.n);
      this.curl=new Float32Array(this.n);

      this.image=document.createElement("canvas");
      this.image.width=this.w;
      this.image.height=this.h;
      this.imageCtx=this.image.getContext("2d");
      this.imageData=this.imageCtx.createImageData(this.w,this.h);

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
      this.pressure.fill(0);
      this.curl.fill(0);
      this.age=0;

      const rng=mulberry32(this.seed);
      const cx=this.w*0.50;
      const cy=this.h*0.62;
      const rx=this.w*0.145;
      const ry=this.h*0.19;

      for(let y=1;y<this.h-1;y++){
        for(let x=1;x<this.w-1;x++){
          const dx=(x-cx)/rx;
          const dy=(y-cy)/ry;
          const r=Math.hypot(dx,dy);
          if(r>1.08) continue;

          const k=this.idx(x,y);
          const hot=Math.pow(Math.max(0,1-r),0.38);
          const angle=Math.atan2(dy,dx);
          const radial=2.0+4.9*hot;

          this.temp[k]=clamp01(0.58+hot*0.60+rng()*0.12);
          this.dens[k]=clamp01(0.28+hot*0.88+rng()*0.10);
          this.u[k]=Math.cos(angle)*radial*(0.70+rng()*0.42);
          this.v[k]=Math.sin(angle)*radial*(0.70+rng()*0.42)-1.55*hot;
        }
      }
    }


    /*
      Rev 21: inject one bounded heat/density/velocity source into the fluid
      field. Production Fireball uses this to seed the simulation from every
      actually affected tactical hex rather than from one central plume.
    */
    injectSource({
      x,
      y,
      radiusX=4,
      radiusY=4,
      heat=1,
      density=1,
      velocityX=0,
      velocityY=0,
      strength=1
    }={}){
      const cx=clamp(Number(x)||0,1,this.w-2);
      const cy=clamp(Number(y)||0,1,this.h-2);
      const rx=Math.max(0.75,Number(radiusX)||4);
      const ry=Math.max(0.75,Number(radiusY)||4);
      const scalar=Math.max(0,Number(strength)||0);

      const minX=Math.max(1,Math.floor(cx-rx));
      const maxX=Math.min(this.w-2,Math.ceil(cx+rx));
      const minY=Math.max(1,Math.floor(cy-ry));
      const maxY=Math.min(this.h-2,Math.ceil(cy+ry));

      for(let gy=minY;gy<=maxY;gy++){
        for(let gx=minX;gx<=maxX;gx++){
          const dx=(gx-cx)/rx;
          const dy=(gy-cy)/ry;
          const r2=dx*dx+dy*dy;

          if(r2>1){
            continue;
          }

          /*
            Smooth, broad splat. The square-root shoulder deliberately keeps
            neighboring hex sources overlapping so the affected Fireball volume
            reads as one continuous hot mass rather than isolated puffs.
          */
          const weight=
            Math.pow(
              Math.max(0,1-r2),
              0.85
            )*
            scalar;

          const k=this.idx(gx,gy);

          /*
            Rev 22: sources no longer add heat/density on top of an already-hot
            cell. Repeated overlapping blast-cell splats now take the strongest
            local contribution instead. This preserves full-volume coverage
            without saturating the field to opaque white.
          */
          this.temp[k]=clamp01(
            Math.max(
              this.temp[k],
              (Number(heat)||0)*
              weight
            )
          );

          this.dens[k]=clamp01(
            Math.max(
              this.dens[k],
              (Number(density)||0)*
              weight
            )
          );

          this.u[k]+=
            (Number(velocityX)||0)*
            weight;

          this.v[k]+=
            (Number(velocityY)||0)*
            weight;
        }
      }
    }


    injectSources(sources,strength=1){
      for(const source of sources || []){
        this.injectSource({
          ...source,
          strength:
            Math.max(
              0,
              Number(strength)||0
            )*
            Math.max(
              0,
              Number(source?.strength ?? 1)
            )
        });
      }
    }

    clear(){
      this.u.fill(0);
      this.v.fill(0);
      this.u0.fill(0);
      this.v0.fill(0);
      this.temp.fill(0);
      this.temp0.fill(0);
      this.dens.fill(0);
      this.dens0.fill(0);
      this.div.fill(0);
      this.pressure.fill(0);
      this.curl.fill(0);
      this.age=0;
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

    project(iterations=8){
      const w=this.w;
      const h=this.h;
      const p=this.pressure;
      const div=this.div;
      p.fill(0);

      for(let y=1;y<h-1;y++){
        for(let x=1;x<w-1;x++){
          const k=this.idx(x,y);
          div[k]=-0.5*(
            this.u[this.idx(x+1,y)]-
            this.u[this.idx(x-1,y)]+
            this.v[this.idx(x,y+1)]-
            this.v[this.idx(x,y-1)]
          );
        }
      }

      for(let pass=0;pass<iterations;pass++){
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
          this.u[k]-=0.5*(
            p[this.idx(x+1,y)]-
            p[this.idx(x-1,y)]
          );
          this.v[k]-=0.5*(
            p[this.idx(x,y+1)]-
            p[this.idx(x,y-1)]
          );
        }
      }

      this.boundary(this.u);
      this.boundary(this.v);
    }

    advect(dst,src,u,v,dt,scale){
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

          const top=lerp(
            src[this.idx(x0,y0)],
            src[this.idx(x1,y0)],
            sx
          );
          const bottom=lerp(
            src[this.idx(x0,y1)],
            src[this.idx(x1,y1)],
            sx
          );

          dst[k]=lerp(top,bottom,sy);
        }
      }

      this.boundary(dst);
    }

    applyVorticity(dt){
      const w=this.w;
      const h=this.h;

      for(let y=1;y<h-1;y++){
        for(let x=1;x<w-1;x++){
          const k=this.idx(x,y);
          this.curl[k]=0.5*(
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

          const vort=this.curl[k]*PROFILE.turbulence*2.8;
          this.u[k]+=ny*vort*dt;
          this.v[k]-=nx*vort*dt;
        }
      }
    }

    step(dt){
      const stepDt=Math.min(0.030,Math.max(0.006,dt));
      this.age+=stepDt;

      for(let y=1;y<this.h-1;y++){
        for(let x=1;x<this.w-1;x++){
          const k=this.idx(x,y);
          const heat=this.temp[k];

          this.v[k]-=
            heat*
            PROFILE.buoyancy*
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
            PROFILE.turbulence*
            0.18*
            stepDt;
        }
      }

      this.applyVorticity(stepDt);
      this.project(8);

      this.u0.set(this.u);
      this.v0.set(this.v);

      this.advect(this.u,this.u0,this.u0,this.v0,stepDt,0.31);
      this.advect(this.v,this.v0,this.u0,this.v0,stepDt,0.31);

      this.project(8);

      this.temp0.set(this.temp);
      this.dens0.set(this.dens);

      this.advect(this.temp,this.temp0,this.u,this.v,stepDt,0.34);
      this.advect(this.dens,this.dens0,this.u,this.v,stepDt,0.34);

      const cool=Math.pow(PROFILE.cooling,stepDt*10);
      const diss=Math.pow(0.972,stepDt*20);

      for(let i=0;i<this.n;i++){
        this.temp[i]*=cool;
        this.dens[i]*=diss;
        if(this.temp[i]<0.002) this.temp[i]=0;
        if(this.dens[i]<0.002) this.dens[i]=0;
      }
    }

    updateImage(){
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

          if(heat>0.16){
            totalHeat+=heat;
            weightedX+=x*heat;
            weightedY+=y*heat;
          }

          if(heat>0.025){
            const rgb=heatColor(Math.pow(heat,0.72));
            data[o]=rgb[0];
            data[o+1]=rgb[1];
            data[o+2]=rgb[2];
            data[o+3]=Math.round(
              255*
              clamp01(
                density*(0.44+heat*0.82)
              )
            );
          }else{
            const smokeAlpha=
              density*
              PROFILE.smoke*
              (1-clamp01(heat/0.18));

            data[o]=64;
            data[o+1]=55;
            data[o+2]=53;
            data[o+3]=Math.round(
              145*
              clamp01(smokeAlpha)
            );
          }
        }
      }

      this.imageCtx.putImageData(this.imageData,0,0);

      return {
        hottest,
        heatCenter:
          totalHeat>0
            ? {
                x:weightedX/totalHeat/Math.max(1,this.w-1),
                y:weightedY/totalHeat/Math.max(1,this.h-1)
              }
            : {x:0.5,y:0.5}
      };
    }
  }

  function makeParticles(seed,count=230){
    const rng=mulberry32(seed);
    const particles=[];

    for(let i=0;i<count;i++){
      particles.push({
        angle:rng()*Math.PI*2,
        speed:0.46+rng()*1.42,
        ember:rng()<0.68,
        size:rng()<0.12 ? 3 : (rng()<0.48 ? 2 : 1),
        lift:0.42+rng()*1.26,
        born:rng()*0.23
      });
    }

    return particles;
  }

  window.AdventurePartyStableFireCore={
    PROFILE,
    StableFireField,
    clamp,
    clamp01,
    lerp,
    heatColor,
    mulberry32,
    makeParticles
  };
})();
