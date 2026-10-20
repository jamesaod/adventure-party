/*
  Candidate Rev 13 — Dielectric Breakdown Lightning VFX Laboratory
  -----------------------------------------------------------------
  Development-only 2D visual prototype derived from the growth model described
  in Kim & Lin, "Fast Animation of Lightning Using an Adaptive Mesh" (TVCG 2007).

  This first browser trial intentionally evaluates the visible DBM result before
  porting the paper's quadtree/ICCG acceleration:
    - solve Laplace's equation on a small 2D field;
    - grow one neighboring cell with probability proportional to phi^eta;
    - preserve a parent tree for main / secondary / side channel classification;
    - jitter graph vertices inside their cells to suppress grid artifacts;
    - render thin channels with class-dependent luminance and additive glow.

  Production Lightning Bolt geometry, damage, reflection, and spell audio are
  not modified by this module.
*/
(()=>{
  "use strict";

  const IDS={
    canvas:"adaptiveLightningLabCanvas",
    eta:"adaptiveLightningEta",
    resolution:"adaptiveLightningResolution",
    iterations:"adaptiveLightningIterations",
    jitter:"adaptiveLightningJitter",
    glow:"adaptiveLightningGlow",
    seed:"adaptiveLightningSeed",
    generate:"adaptiveLightningGenerate",
    animate:"adaptiveLightningAnimate",
    reroll:"adaptiveLightningReroll",
    grid:"adaptiveLightningShowGrid",
    status:"adaptiveLightningStatus",
    stats:"adaptiveLightningStats"
  };

  let lastResult=null;
  let animationFrame=0;
  let animationStart=0;
  let animationDuration=900;

  function el(id){ return document.getElementById(id); }
  function clamp(v,a,b){ return Math.min(b,Math.max(a,v)); }

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
    return Number.isFinite(value)?value:fallback;
  }

  function parseResolution(){
    const raw=String(el(IDS.resolution)?.value||"64x36");
    const match=raw.match(/^(\d+)x(\d+)$/);
    if(!match) return {w:64,h:36};
    return {
      w:clamp(Number(match[1])||64,32,96),
      h:clamp(Number(match[2])||36,20,60)
    };
  }

  function indexOf(x,y,w){ return y*w+x; }

  function neighbors4(x,y,w,h){
    const out=[];
    if(x>0) out.push([x-1,y]);
    if(x+1<w) out.push([x+1,y]);
    if(y>0) out.push([x,y-1]);
    if(y+1<h) out.push([x,y+1]);
    return out;
  }

  function buildSimulation(){
    const t0=performance.now();
    const {w,h}=parseResolution();
    const eta=clamp(readNumber(IDS.eta,1.8),1,4);
    const sweeps=Math.round(clamp(readNumber(IDS.iterations,14),4,50));
    const jitter=clamp(readNumber(IDS.jitter,0.38),0,0.48);
    const glow=clamp(readNumber(IDS.glow,1),0.25,2.5);
    const seed=(Math.round(readNumber(IDS.seed,137))|0) || 137;
    const rng=mulberry32(seed);

    // 0 = free dielectric, 1 = lightning channel, 2 = target electrode.
    const state=new Uint8Array(w*h);
    const phi=new Float32Array(w*h);
    const nodes=[];
    const nodeAt=new Int32Array(w*h);
    nodeAt.fill(-1);

    const start={x:2,y:Math.floor(h*0.5)};
    const target={
      x:w-3,
      y:Math.floor(h*0.5)
    };
    const targetRadius=Math.max(1,Math.round(h*0.045));

    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        // A linear field is a useful initial guess; the relaxation sweeps then
        // converge it toward the current channel / electrode boundary.
        phi[indexOf(x,y,w)]=x/(w-1);
      }
    }

    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        if(Math.hypot(x-target.x,y-target.y)<=targetRadius){
          state[indexOf(x,y,w)]=2;
          phi[indexOf(x,y,w)]=1;
        }
      }
    }

    const root={
      x:start.x,
      y:start.y,
      parent:-1,
      children:[],
      order:0
    };
    nodes.push(root);
    state[indexOf(start.x,start.y,w)]=1;
    phi[indexOf(start.x,start.y,w)]=0;
    nodeAt[indexOf(start.x,start.y,w)]=0;

    function solvePotential(){
      /*
        Browser-size relaxation solve of ∇²φ = 0. The paper uses PCG/ICCG and
        then accelerates it with an adaptive mesh. For visual evaluation on a
        tiny 2D field, in-place Gauss-Seidel relaxation is intentionally used.
        Channel cells remain φ=0 and the target electrode φ=1.
      */
      for(let pass=0;pass<sweeps;pass++){
        for(let y=0;y<h;y++){
          for(let x=0;x<w;x++){
            const k=indexOf(x,y,w);
            if(state[k]===1){
              phi[k]=0;
              continue;
            }
            if(state[k]===2){
              phi[k]=1;
              continue;
            }

            let sum=0;
            let count=0;
            if(x>0){ sum+=phi[k-1]; count++; }
            if(x+1<w){ sum+=phi[k+1]; count++; }
            if(y>0){ sum+=phi[k-w]; count++; }
            if(y+1<h){ sum+=phi[k+w]; count++; }
            if(count) phi[k]=sum/count;
          }
        }
      }
    }

    function frontier(){
      const map=new Map();
      for(let ni=0;ni<nodes.length;ni++){
        const n=nodes[ni];
        for(const [nx,ny] of neighbors4(n.x,n.y,w,h)){
          const k=indexOf(nx,ny,w);
          if(state[k]===1) continue;

          const key=k;
          const existing=map.get(key);
          if(!existing || nodes[existing.parent].order<n.order){
            map.set(key,{x:nx,y:ny,k,parent:ni});
          }
        }
      }
      return [...map.values()];
    }

    function chooseGrowth(candidates){
      let total=0;
      const weights=new Float64Array(candidates.length);

      for(let i=0;i<candidates.length;i++){
        const c=candidates[i];
        // Paper Eq. 2: p_i = phi_i^eta / sum(phi_j^eta).
        const potential=clamp(phi[c.k],0,1);
        const weight=Math.pow(Math.max(1e-7,potential),eta);
        weights[i]=weight;
        total+=weight;
      }

      if(!(total>0)) return candidates[Math.floor(rng()*candidates.length)];

      let r=rng()*total;
      for(let i=0;i<candidates.length;i++){
        r-=weights[i];
        if(r<=0) return candidates[i];
      }
      return candidates[candidates.length-1];
    }

    let terminal=-1;
    let stopped="max-steps";
    const maxSteps=Math.round(w*h*0.62);

    for(let step=1;step<=maxSteps;step++){
      solvePotential();
      const candidates=frontier();
      if(!candidates.length){
        stopped="no-frontier";
        break;
      }

      const chosen=chooseGrowth(candidates);
      const chosenState=state[chosen.k];

      const node={
        x:chosen.x,
        y:chosen.y,
        parent:chosen.parent,
        children:[],
        order:step
      };
      const nodeIndex=nodes.length;
      nodes.push(node);
      nodes[chosen.parent].children.push(nodeIndex);
      nodeAt[chosen.k]=nodeIndex;

      state[chosen.k]=1;
      phi[chosen.k]=0;

      // Reaching the positive electrode terminates the stepped leader.
      if(chosenState===2 || Math.hypot(chosen.x-target.x,chosen.y-target.y)<=targetRadius){
        terminal=nodeIndex;
        stopped="target";
        break;
      }
    }

    if(terminal<0){
      // If the stochastic front exhausted the budget, select the grown node
      // nearest the electrode so the classification/render still has a trunk.
      let best=0;
      let bestDist=Infinity;
      for(let i=0;i<nodes.length;i++){
        const d=Math.hypot(nodes[i].x-target.x,nodes[i].y-target.y);
        if(d<bestDist){ bestDist=d; best=i; }
      }
      terminal=best;
    }

    const mainSet=new Set();
    for(let n=terminal;n>=0;n=nodes[n].parent){
      mainSet.add(n);
      if(nodes[n].parent<0) break;
    }

    function deepestPathFrom(rootIndex){
      let best=[];
      function walk(idx,path){
        const next=[...path,idx];
        const children=nodes[idx].children;
        if(!children.length){
          if(next.length>best.length) best=next;
          return;
        }
        for(const child of children) walk(child,next);
      }
      walk(rootIndex,[]);
      return best;
    }

    const secondarySet=new Set();
    for(const mainIndex of mainSet){
      for(const child of nodes[mainIndex].children){
        if(mainSet.has(child)) continue;
        const path=deepestPathFrom(child);
        for(const idx of path) secondarySet.add(idx);
      }
    }

    const visualPoints=nodes.map((n,i)=>{
      const endpoint=i===0 || i===terminal;
      const j=endpoint?0:jitter;
      return {
        x:n.x+(rng()*2-1)*j,
        y:n.y+(rng()*2-1)*j
      };
    });

    const t1=performance.now();

    return {
      w,h,eta,sweeps,jitter,glow,seed,
      nodes,visualPoints,
      mainSet,secondarySet,
      terminal,stopped,
      target,targetRadius,
      elapsedMs:t1-t0
    };
  }

  function classifyEdge(result,childIndex){
    if(result.mainSet.has(childIndex)) return "main";
    if(result.secondarySet.has(childIndex)) return "secondary";
    return "side";
  }

  function drawResult(result,progress=1){
    const canvas=el(IDS.canvas);
    if(!canvas || !result) return;
    const ctx=canvas.getContext("2d");
    if(!ctx) return;

    const cssW=canvas.clientWidth||360;
    const cssH=canvas.clientHeight||210;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const pixelW=Math.max(1,Math.round(cssW*dpr));
    const pixelH=Math.max(1,Math.round(cssH*dpr));
    if(canvas.width!==pixelW || canvas.height!==pixelH){
      canvas.width=pixelW;
      canvas.height=pixelH;
    }

    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,cssW,cssH);
    ctx.fillStyle="#02040a";
    ctx.fillRect(0,0,cssW,cssH);

    const margin=13;
    const sx=(cssW-margin*2)/(result.w-1);
    const sy=(cssH-margin*2)/(result.h-1);
    const tx=x=>margin+x*sx;
    const ty=y=>margin+y*sy;

    if(el(IDS.grid)?.checked){
      ctx.save();
      ctx.strokeStyle="rgba(120,155,190,0.065)";
      ctx.lineWidth=1;
      for(let x=0;x<result.w;x+=4){
        ctx.beginPath();
        ctx.moveTo(tx(x),margin);
        ctx.lineTo(tx(x),cssH-margin);
        ctx.stroke();
      }
      for(let y=0;y<result.h;y+=4){
        ctx.beginPath();
        ctx.moveTo(margin,ty(y));
        ctx.lineTo(cssW-margin,ty(y));
        ctx.stroke();
      }
      ctx.restore();
    }

    // Positive electrode / destination.
    const ex=tx(result.target.x);
    const ey=ty(result.target.y);
    const er=Math.max(4,result.targetRadius*Math.min(sx,sy)*1.5);
    const electrode=ctx.createRadialGradient(ex,ey,0,ex,ey,er*3.2);
    electrode.addColorStop(0,"rgba(255,255,255,0.95)");
    electrode.addColorStop(0.2,"rgba(175,220,255,0.60)");
    electrode.addColorStop(1,"rgba(65,100,220,0)");
    ctx.fillStyle=electrode;
    ctx.beginPath();
    ctx.arc(ex,ey,er*3.2,0,Math.PI*2);
    ctx.fill();

    const maxOrder=Math.max(1,result.nodes.length-1);
    const visibleOrder=Math.floor(maxOrder*clamp(progress,0,1));

    const classes={
      side:{width:0.75,blue:0.20,core:0.36},
      secondary:{width:1.05,blue:0.40,core:0.70},
      main:{width:1.35,blue:0.68,core:1.0}
    };

    function strokePass(pass){
      ctx.beginPath();
      let started=false;
      for(let i=1;i<result.nodes.length;i++){
        const n=result.nodes[i];
        if(n.order>visibleOrder) continue;
        const parent=result.nodes[n.parent];
        if(!parent || parent.order>visibleOrder) continue;

        const cls=classifyEdge(result,i);
        const style=classes[cls];
        const a=result.visualPoints[n.parent];
        const b=result.visualPoints[i];

        ctx.moveTo(tx(a.x),ty(a.y));
        ctx.lineTo(tx(b.x),ty(b.y));
        started=true;

        // Stroke independently when brightness class changes.
        if(started){
          ctx.strokeStyle=pass.color(style);
          ctx.lineWidth=pass.width(style);
          ctx.stroke();
          ctx.beginPath();
          started=false;
        }
      }
    }

    ctx.save();
    ctx.globalCompositeOperation="lighter";
    ctx.lineCap="round";
    ctx.lineJoin="round";

    // Paper-style thin plasma graph with class-dependent luminance, rendered
    // as practical Canvas glow passes instead of an HDR APSF convolution.
    const glow=result.glow;
    strokePass({
      width:s=>s.width*(7.5*glow),
      color:s=>`rgba(55,105,255,${0.08*s.blue})`
    });
    strokePass({
      width:s=>s.width*(4.2*glow),
      color:s=>`rgba(85,155,255,${0.15*s.blue})`
    });
    strokePass({
      width:s=>s.width*(2.1*glow),
      color:s=>`rgba(165,215,255,${0.34*s.blue})`
    });
    strokePass({
      width:s=>s.width,
      color:s=>`rgba(245,251,255,${0.92*s.core})`
    });
    ctx.restore();

    // Origin flare.
    const origin=result.visualPoints[0];
    const ox=tx(origin.x), oy=ty(origin.y);
    const flare=ctx.createRadialGradient(ox,oy,0,ox,oy,14*glow);
    flare.addColorStop(0,"rgba(255,255,255,0.92)");
    flare.addColorStop(0.3,"rgba(145,200,255,0.42)");
    flare.addColorStop(1,"rgba(60,90,220,0)");
    ctx.fillStyle=flare;
    ctx.beginPath();
    ctx.arc(ox,oy,14*glow,0,Math.PI*2);
    ctx.fill();
  }

  function updateReadouts(){
    document.querySelectorAll("[data-adaptive-lightning-output]").forEach(out=>{
      const id=out.getAttribute("data-adaptive-lightning-output");
      const source=el(id);
      if(!source) return;
      let value=source.value;
      const unit=out.getAttribute("data-unit")||"";
      if(id===IDS.eta || id===IDS.jitter || id===IDS.glow){
        value=Number(value).toFixed(2);
      }
      out.textContent=value+unit;
    });
  }

  function setStatus(text,state="ready"){
    const n=el(IDS.status);
    if(!n) return;
    n.textContent=text;
    n.dataset.state=state;
  }

  function updateStats(result){
    const n=el(IDS.stats);
    if(!n || !result) return;
    n.textContent=
      `${result.nodes.length} growth cells · η ${result.eta.toFixed(2)} · `+
      `${result.w}×${result.h} field · ${result.elapsedMs.toFixed(1)} ms · ${result.stopped}`;
  }

  function generate(){
    if(animationFrame){
      cancelAnimationFrame(animationFrame);
      animationFrame=0;
    }
    setStatus("Solving potential field and growing dielectric breakdown…","working");
    // Yield one paint so the status is visible before the synchronous prototype.
    requestAnimationFrame(()=>{
      try{
        lastResult=buildSimulation();
        drawResult(lastResult,1);
        updateStats(lastResult);
        setStatus(
          lastResult.stopped==="target"
            ? "Stepped leader reached the target electrode."
            : "Growth budget ended; showing nearest-terminal tree.",
          "ready"
        );
      }catch(error){
        console.error(error);
        setStatus("DBM generation failed: "+String(error?.message||error),"off");
      }
    });
  }

  function animate(){
    if(!lastResult){
      generate();
      return;
    }
    if(animationFrame) cancelAnimationFrame(animationFrame);
    animationStart=performance.now();

    const frame=()=>{
      const t=clamp((performance.now()-animationStart)/animationDuration,0,1);
      // Ease-out roughly mimics a leader that accelerates toward connection.
      const progress=1-Math.pow(1-t,2.2);
      drawResult(lastResult,progress);
      if(t<1){
        animationFrame=requestAnimationFrame(frame);
      }else{
        animationFrame=0;
        setStatus("Growth animation complete.","ready");
      }
    };

    setStatus("Animating stored stepped-leader growth…","working");
    animationFrame=requestAnimationFrame(frame);
  }

  function reroll(){
    const seedNode=el(IDS.seed);
    if(seedNode){
      seedNode.value=String(((Number(seedNode.value)||0)+1)>>>0);
    }
    updateReadouts();
    generate();
  }

  function wire(){
    if(!el(IDS.canvas)) return;

    [IDS.eta,IDS.iterations,IDS.jitter,IDS.glow].forEach(id=>{
      el(id)?.addEventListener("input",updateReadouts);
    });

    el(IDS.grid)?.addEventListener("change",()=>{
      if(lastResult) drawResult(lastResult,1);
    });

    el(IDS.generate)?.addEventListener("click",generate);
    el(IDS.animate)?.addEventListener("click",animate);
    el(IDS.reroll)?.addEventListener("click",reroll);

    el(IDS.resolution)?.addEventListener("change",generate);
    el(IDS.seed)?.addEventListener("change",generate);

    updateReadouts();
    generate();
  }

  window.AdventurePartyAdaptiveLightningLab={
    generate,
    animate,
    reroll,
    getLastResult:()=>lastResult
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",wire,{once:true});
  }else{
    wire();
  }
})();
