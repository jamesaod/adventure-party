/*
  Candidate Rev 14 — Production DBM Lightning Bolt VFX
  ----------------------------------------------------
  Promotes the approved dielectric-breakdown look from Candidate Rev 13 into
  the production Lightning Bolt presentation while preserving R232/R233 spell
  geometry, reflection, damage, saves, timing, targeting, and audio.

  Approved visual profile:
    eta: 1.75
    field: 80 x 45
    solver sweeps: 10
    cell jitter: 0.38
    glow: 1.65
    seed: randomized once per cast

  The DBM tree is generated once per cast and transformed onto every tactical
  ray segment. Three jitter variants of the same topology provide rapid return
  strokes without re-solving the field. Strong additive path and impact
  illumination makes the discharge light the battlefield.
*/
(()=>{
  "use strict";

  const PROFILE=Object.freeze({
    eta:1.75,
    fieldWidth:80,
    fieldHeight:45,
    solverSweeps:10,
    cellJitter:0.38,
    glow:1.65,
    maxGrowthSteps:900,
    targetRadius:2,
    restrikeCenters:[14,104,188],
    restrikeWidths:[34,26,24],
    restrikeStrength:[1.0,0.78,0.60]
  });

  let lastGenerationMs=0;
  let lastSeed=0;

  const baseDrawLightningTraceFx=r232DrawLightningTraceFx;

  function clamp(value,min,max){
    return Math.min(max,Math.max(min,value));
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

  function indexOf(x,y,w){
    return y*w+x;
  }

  function neighbors4(x,y,w,h){
    const out=[];
    if(x>0) out.push([x-1,y]);
    if(x+1<w) out.push([x+1,y]);
    if(y>0) out.push([x,y-1]);
    if(y+1<h) out.push([x,y+1]);
    return out;
  }

  function generateDbmTree(seed){
    const started=performance.now();
    const w=PROFILE.fieldWidth;
    const h=PROFILE.fieldHeight;
    const rng=mulberry32(seed);

    const state=new Uint8Array(w*h);
    const phi=new Float32Array(w*h);
    const nodes=[];

    const start={
      x:2,
      y:Math.floor(h*0.5)
    };

    const target={
      x:w-3,
      y:Math.floor(h*0.5)
    };

    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        phi[indexOf(x,y,w)]=x/(w-1);
      }
    }

    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        if(
          Math.hypot(
            x-target.x,
            y-target.y
          )<=PROFILE.targetRadius
        ){
          const k=indexOf(x,y,w);
          state[k]=2;
          phi[k]=1;
        }
      }
    }

    nodes.push({
      x:start.x,
      y:start.y,
      parent:-1,
      children:[],
      order:0
    });

    const rootKey=indexOf(start.x,start.y,w);
    state[rootKey]=1;
    phi[rootKey]=0;

    const frontier=new Map();

    function addFrontierFrom(parentIndex){
      const parent=nodes[parentIndex];

      for(
        const pair of
        neighbors4(parent.x,parent.y,w,h)
      ){
        const nx=pair[0];
        const ny=pair[1];
        const k=indexOf(nx,ny,w);

        if(state[k]===1){
          continue;
        }

        const existing=frontier.get(k);

        if(
          !existing ||
          nodes[existing.parent].order<
          parent.order
        ){
          frontier.set(k,{
            x:nx,
            y:ny,
            k,
            parent:parentIndex
          });
        }
      }
    }

    addFrontierFrom(0);

    function solvePotential(){
      for(
        let pass=0;
        pass<PROFILE.solverSweeps;
        pass++
      ){
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

            if(x>0){
              sum+=phi[k-1];
              count++;
            }

            if(x+1<w){
              sum+=phi[k+1];
              count++;
            }

            if(y>0){
              sum+=phi[k-w];
              count++;
            }

            if(y+1<h){
              sum+=phi[k+w];
              count++;
            }

            if(count){
              phi[k]=sum/count;
            }
          }
        }
      }
    }

    function chooseGrowth(){
      const candidates=[...frontier.values()];

      if(!candidates.length){
        return null;
      }

      const weights=new Float64Array(
        candidates.length
      );

      let total=0;

      for(
        let index=0;
        index<candidates.length;
        index++
      ){
        const candidate=candidates[index];

        const potential=
          clamp(
            phi[candidate.k],
            0,
            1
          );

        const weight=
          Math.pow(
            Math.max(0.0000001,potential),
            PROFILE.eta
          );

        weights[index]=weight;
        total+=weight;
      }

      if(!(total>0)){
        return candidates[
          Math.floor(
            rng()*candidates.length
          )
        ];
      }

      let pick=rng()*total;

      for(
        let index=0;
        index<candidates.length;
        index++
      ){
        pick-=weights[index];

        if(pick<=0){
          return candidates[index];
        }
      }

      return candidates[
        candidates.length-1
      ];
    }

    let terminal=-1;
    let stopReason="max-steps";

    for(
      let step=1;
      step<=PROFILE.maxGrowthSteps;
      step++
    ){
      solvePotential();

      const chosen=chooseGrowth();

      if(!chosen){
        stopReason="no-frontier";
        break;
      }

      const previousState=state[chosen.k];

      frontier.delete(chosen.k);

      const nodeIndex=nodes.length;

      nodes.push({
        x:chosen.x,
        y:chosen.y,
        parent:chosen.parent,
        children:[],
        order:step
      });

      nodes[chosen.parent]
        .children
        .push(nodeIndex);

      state[chosen.k]=1;
      phi[chosen.k]=0;

      addFrontierFrom(nodeIndex);

      if(
        previousState===2 ||
        Math.hypot(
          chosen.x-target.x,
          chosen.y-target.y
        )<=PROFILE.targetRadius
      ){
        terminal=nodeIndex;
        stopReason="target";
        break;
      }
    }

    if(terminal<0){
      let best=0;
      let bestDistance=Infinity;

      for(
        let index=0;
        index<nodes.length;
        index++
      ){
        const node=nodes[index];

        const distance=
          Math.hypot(
            node.x-target.x,
            node.y-target.y
          );

        if(distance<bestDistance){
          bestDistance=distance;
          best=index;
        }
      }

      terminal=best;
    }

    const mainSet=new Set();

    for(
      let nodeIndex=terminal;
      nodeIndex>=0;
      nodeIndex=nodes[nodeIndex].parent
    ){
      mainSet.add(nodeIndex);

      if(nodes[nodeIndex].parent<0){
        break;
      }
    }

    function deepestPathFrom(rootIndex){
      let best=[];

      function walk(nodeIndex,path){
        const next=path.concat(nodeIndex);
        const children=nodes[nodeIndex].children;

        if(!children.length){
          if(next.length>best.length){
            best=next;
          }
          return;
        }

        for(const child of children){
          walk(child,next);
        }
      }

      walk(rootIndex,[]);
      return best;
    }

    const secondarySet=new Set();

    for(const mainIndex of mainSet){
      for(
        const child of
        nodes[mainIndex].children
      ){
        if(mainSet.has(child)){
          continue;
        }

        const path=
          deepestPathFrom(child);

        for(const nodeIndex of path){
          secondarySet.add(nodeIndex);
        }
      }
    }

    const variants=[];

    for(let variant=0;variant<3;variant++){
      const vrng=
        mulberry32(
          (
            seed+
            (variant+1)*0x51f15e2d
          )>>>0
        );

      variants.push(
        nodes.map((node,nodeIndex)=>{
          const pinned=
            nodeIndex===0 ||
            nodeIndex===terminal;

          const jitter=
            pinned
              ? 0
              : PROFILE.cellJitter;

          return {
            x:
              node.x+
              (vrng()*2-1)*jitter,
            y:
              node.y+
              (vrng()*2-1)*jitter
          };
        })
      );
    }

    lastGenerationMs=
      performance.now()-started;

    lastSeed=seed;

    return {
      w,
      h,
      start,
      target,
      nodes,
      mainSet,
      secondarySet,
      terminal,
      stopReason,
      variants,
      seed
    };
  }

  function ensureFxState(fx){
    if(fx.r14Dbm){
      return fx.r14Dbm;
    }

    const seed=
      (
        Math.floor(
          Math.random()*0xffffffff
        )>>>0
      ) || 1;

    const tree=
      generateDbmTree(seed);

    fx.r14Dbm={
      tree,
      seed
    };

    return fx.r14Dbm;
  }

  function edgeClass(tree,childIndex){
    if(tree.mainSet.has(childIndex)){
      return "main";
    }

    if(tree.secondarySet.has(childIndex)){
      return "secondary";
    }

    return "side";
  }

  function pulseValue(
    elapsed,
    center,
    width,
    strength
  ){
    const d=(elapsed-center)/width;
    return strength*Math.exp(-d*d);
  }

  function lightningEnvelope(elapsed,duration){
    let best=0;
    let variant=0;

    for(
      let index=0;
      index<
        PROFILE.restrikeCenters.length;
      index++
    ){
      const value=
        pulseValue(
          elapsed,
          PROFILE.restrikeCenters[index],
          PROFILE.restrikeWidths[index],
          PROFILE.restrikeStrength[index]
        );

      if(value>best){
        best=value;
        variant=index;
      }
    }

    const tail=
      elapsed<duration
        ? 0.16*
          Math.pow(
            1-elapsed/duration,
            1.25
          )
        : 0;

    return {
      intensity:
        clamp(
          Math.max(best,tail),
          0,
          1
        ),
      variant
    };
  }

  function transformedPoint(
    tree,
    point,
    nodeIndex,
    from,
    to,
    segmentIndex
  ){
    if(nodeIndex===0){
      return {
        x:from.x,
        y:from.y-10
      };
    }

    if(nodeIndex===tree.terminal){
      return {
        x:to.x,
        y:to.y-10
      };
    }

    const dx=to.x-from.x;
    const dy=to.y-from.y;

    const length=
      Math.max(
        1,
        Math.hypot(dx,dy)
      );

    const nx=-dy/length;
    const ny=dx/length;

    const denominator=
      Math.max(
        1,
        tree.target.x-tree.start.x
      );

    const u=
      (
        point.x-tree.start.x
      )/denominator;

    const v=
      (
        point.y-tree.start.y
      )/
      Math.max(
        1,
        tree.h*0.5
      );

    const perpendicularScale=
      Math.min(
        24,
        Math.max(
          8,
          length*0.13
        )
      );

    const mirror=
      (
        (
          tree.seed+
          segmentIndex*31
        )&1
      )
        ? -1
        : 1;

    return {
      x:
        from.x+
        dx*u+
        nx*v*
        perpendicularScale*
        mirror,
      y:
        from.y+
        dy*u+
        ny*v*
        perpendicularScale*
        mirror-
        10
    };
  }

  function edgeVisible(
    tree,
    childIndex,
    cls,
    variant
  ){
    if(cls==="main"){
      return true;
    }

    const hash=
      (
        Math.imul(
          childIndex+1,
          1103515245
        )+
        Math.imul(
          variant+1,
          12345
        )+
        tree.seed
      )>>>0;

    const sample=
      (hash&0xffff)/0xffff;

    if(cls==="secondary"){
      return sample<0.90;
    }

    return sample<
      (
        variant===0
          ? 0.72
          : variant===1
            ? 0.58
            : 0.64
      );
  }

  function drawLightningHexLight(
    cell,
    intensity,
    {
      centerBoost=1,
      edgeAlpha=0.10,
      coreAlpha=0.42
    }={}
  ){
    if(
      !cell ||
      !Number.isFinite(cell.x) ||
      !Number.isFinite(cell.y) ||
      intensity<=0.002 ||
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

    ctx.save();

    polygonPath(vertices);
    ctx.clip();

    const radius=
      Math.max(
        HEX_W*0.62,
        HEX_H*0.78
      );

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
      "rgba(245,252,255,"+
      Math.min(
        0.95,
        coreAlpha*
        centerBoost*
        intensity
      )+
      ")"
    );

    gradient.addColorStop(
      0.34,
      "rgba(175,222,255,"+
      Math.min(
        0.78,
        0.24*
        centerBoost*
        intensity
      )+
      ")"
    );

    gradient.addColorStop(
      0.76,
      "rgba(90,160,255,"+
      Math.min(
        0.52,
        edgeAlpha*
        centerBoost*
        intensity
      )+
      ")"
    );

    gradient.addColorStop(
      1,
      "rgba(65,120,245,0)"
    );

    ctx.fillStyle=gradient;
    ctx.fillRect(
      center.x-HEX_W,
      center.y-HEX_H,
      HEX_W*2,
      HEX_H*2
    );

    ctx.restore();
  }


  function drawIllumination(
    fx,
    intensity
  ){
    if(
      intensity<=0.002 ||
      !Array.isArray(fx?.segments) ||
      !fx.segments.length
    ){
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation="lighter";

    /*
      Rev 19: retain the tactical hex lighting introduced in Rev 18, but restore
      the screen-wide electrical return-stroke flash from the earlier Lightning
      Bolt presentation. The flash follows the existing restrike envelope, so it
      snaps on each discharge rather than becoming a steady blue wash.
    */
    ctx.fillStyle=
      "rgba(190,225,255,"+
      Math.min(
        0.16,
        0.068*intensity
      )+
      ")";

    ctx.fillRect(
      0,
      0,
      ctx.canvas.width,
      ctx.canvas.height
    );

    /*
      Rev 18: lighting now follows the tactical grid instead of painting a
      broad continuous wash. Every traversed bolt hex receives one tight
      blue-white illumination footprint.
    */
    const pathCells=[];
    const seen=new Set();

    const firstSegment=
      fx.segments[0];

    if(firstSegment?.fromWorld){
      const originCell=
        r232WorldToHex(
          firstSegment.fromWorld
        );

      if(
        originCell &&
        inside(
          originCell.x,
          originCell.y
        )
      ){
        const originKey=
          key(
            originCell.x,
            originCell.y
          );

        seen.add(originKey);
        pathCells.push(originCell);
      }
    }

    for(const segment of fx.segments){
      for(const cell of segment.cells || []){
        const cellKey=
          key(
            cell.x,
            cell.y
          );

        if(seen.has(cellKey)){
          continue;
        }

        seen.add(cellKey);
        pathCells.push({
          x:cell.x,
          y:cell.y
        });
      }
    }

    for(const cell of pathCells){
      drawLightningHexLight(
        cell,
        intensity,
        {
          centerBoost:1.00,
          edgeAlpha:0.12,
          coreAlpha:0.44
        }
      );
    }

    /*
      Add a radius-1 / seven-hex illumination cluster at the true final
      terminus. Prefer the final sampled tactical cell so wall/tree endpoints
      stay on the gameplay side of the collision boundary.
    */
    const lastSegment=
      fx.segments[
        fx.segments.length-1
      ];

    let terminalCell=null;

    if(lastSegment?.cells?.length){
      const lastCell=
        lastSegment.cells[
          lastSegment.cells.length-1
        ];

      terminalCell={
        x:lastCell.x,
        y:lastCell.y
      };
    }else if(lastSegment?.toWorld){
      const fallback=
        r232WorldToHex(
          lastSegment.toWorld
        );

      if(
        fallback &&
        inside(
          fallback.x,
          fallback.y
        )
      ){
        terminalCell=fallback;
      }
    }

    if(terminalCell){
      /*
        Rev 19: one broad terminal flash, centered on the true terminal hex.
        Its falloff reaches across the six adjacent hexes naturally; this is
        intentionally NOT seven individually illuminated tiles.
      */
      const center=
        hexCenter(
          terminalCell.x,
          terminalCell.y
        );

      const radius=
        Math.max(
          HEX_W*1.72,
          HEX_H*2.20
        );

      const terminalGlow=
        ctx.createRadialGradient(
          center.x,
          center.y,
          0,
          center.x,
          center.y,
          radius
        );

      terminalGlow.addColorStop(
        0,
        "rgba(250,254,255,"+
        Math.min(
          0.98,
          0.82*intensity
        )+
        ")"
      );

      terminalGlow.addColorStop(
        0.20,
        "rgba(200,234,255,"+
        Math.min(
          0.82,
          0.54*intensity
        )+
        ")"
      );

      terminalGlow.addColorStop(
        0.55,
        "rgba(110,178,255,"+
        Math.min(
          0.58,
          0.30*intensity
        )+
        ")"
      );

      terminalGlow.addColorStop(
        0.82,
        "rgba(78,132,255,"+
        Math.min(
          0.30,
          0.13*intensity
        )+
        ")"
      );

      terminalGlow.addColorStop(
        1,
        "rgba(65,112,245,0)"
      );

      ctx.fillStyle=terminalGlow;
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

    ctx.restore();
  }

  function drawDbmTreeOnSegment(
    tree,
    segment,
    segmentIndex,
    variant,
    intensity
  ){
    const from=
      screenPointForWorld(
        segment.fromWorld
      );

    const to=
      screenPointForWorld(
        segment.toWorld
      );

    const points=
      tree.variants[
        variant%
        tree.variants.length
      ];

    /*
      Transform every node only once for this segment/frame, then batch all
      edges of a brightness class into one Canvas path. This keeps the DBM tree
      visually dense without issuing hundreds of individual stroke() calls.
    */
    const screenPoints=
      points.map(
        (point,nodeIndex)=>
          transformedPoint(
            tree,
            point,
            nodeIndex,
            from,
            to,
            segmentIndex
          )
      );

    const classStyle={
      side:{
        width:0.70,
        corona:0.20,
        core:0.32
      },
      secondary:{
        width:1.00,
        corona:0.42,
        core:0.67
      },
      main:{
        width:1.42,
        corona:0.74,
        core:1.00
      }
    };

    const classes=[
      "side",
      "secondary",
      "main"
    ];

    const passes=[
      {
        width:9.5*PROFILE.glow,
        color:
          (style)=>
            "rgba(55,105,255,"+
            (
              0.050*
              style.corona*
              intensity
            )+
            ")"
      },
      {
        width:5.3*PROFILE.glow,
        color:
          (style)=>
            "rgba(85,155,255,"+
            (
              0.13*
              style.corona*
              intensity
            )+
            ")"
      },
      {
        width:2.7*PROFILE.glow,
        color:
          (style)=>
            "rgba(170,220,255,"+
            (
              0.42*
              style.corona*
              intensity
            )+
            ")"
      },
      {
        width:1.0,
        color:
          (style)=>
            "rgba(250,253,255,"+
            (
              0.98*
              style.core*
              intensity
            )+
            ")"
      }
    ];

    for(const pass of passes){
      for(const cls of classes){
        const style=
          classStyle[cls];

        ctx.beginPath();

        let hasEdge=false;

        for(
          let childIndex=1;
          childIndex<tree.nodes.length;
          childIndex++
        ){
          const child=
            tree.nodes[childIndex];

          const parent=
            tree.nodes[child.parent];

          if(
            !parent ||
            edgeClass(
              tree,
              childIndex
            )!==cls ||
            !edgeVisible(
              tree,
              childIndex,
              cls,
              variant
            )
          ){
            continue;
          }

          const a=
            screenPoints[child.parent];

          const b=
            screenPoints[childIndex];

          ctx.moveTo(a.x,a.y);
          ctx.lineTo(b.x,b.y);
          hasEdge=true;
        }

        if(!hasEdge){
          continue;
        }

        ctx.strokeStyle=
          pass.color(style);

        ctx.lineWidth=
          Math.max(
            0.45,
            pass.width*
            style.width
          );

        ctx.stroke();
      }
    }
  }

  function drawEnhancedImpact(
    collision,
    intensity,
    time
  ){
    if(
      !collision?.pointWorld ||
      intensity<=0.002
    ){
      return;
    }

    const point=
      screenPointForWorld(
        collision.pointWorld
      );

    const pulse=
      0.72+
      0.28*
      Math.sin(
        time*42+
        point.x*0.04+
        point.y*0.03
      );

    ctx.save();
    ctx.globalCompositeOperation="lighter";

    const flash=
      ctx.createRadialGradient(
        point.x,
        point.y-10,
        0,
        point.x,
        point.y-10,
        34
      );

    flash.addColorStop(
      0,
      "rgba(255,255,255,"+
      (0.96*intensity)+
      ")"
    );

    flash.addColorStop(
      0.18,
      "rgba(205,236,255,"+
      (0.68*intensity)+
      ")"
    );

    flash.addColorStop(
      0.52,
      "rgba(95,165,255,"+
      (0.28*intensity)+
      ")"
    );

    flash.addColorStop(
      1,
      "rgba(70,110,255,0)"
    );

    ctx.fillStyle=flash;

    ctx.beginPath();
    ctx.arc(
      point.x,
      point.y-10,
      34,
      0,
      Math.PI*2
    );
    ctx.fill();

    const rays=
      collision.type==="tree"
        ? 10
        : 8;

    for(let index=0;index<rays;index++){
      const angle=
        (
          index/rays
        )*Math.PI*2+
        time*1.9+
        Math.sin(index*8.37)*0.19;

      const inner=3;
      const outer=
        10+
        11*pulse+
        (index%3)*4;

      ctx.strokeStyle=
        index%2
          ? "rgba(205,235,255,"+
            (0.78*intensity)+
            ")"
          : "rgba(255,255,255,"+
            (0.93*intensity)+
            ")";

      ctx.lineWidth=
        index%2
          ? 1.0
          : 1.5;

      ctx.beginPath();
      ctx.moveTo(
        point.x+
        Math.cos(angle)*inner,
        point.y-10+
        Math.sin(angle)*inner
      );
      ctx.lineTo(
        point.x+
        Math.cos(angle)*outer,
        point.y-10+
        Math.sin(angle)*outer
      );
      ctx.stroke();
    }

    if(collision.type==="tree"){
      ctx.fillStyle=
        "rgba(255,208,126,"+
        (0.80*intensity)+
        ")";

      for(let index=0;index<7;index++){
        const angle=
          time*2.1+
          index*Math.PI*2/7;

        const radius=
          7+
          index*1.7;

        ctx.fillRect(
          Math.round(
            point.x+
            Math.cos(angle)*radius
          ),
          Math.round(
            point.y-10+
            Math.sin(angle)*radius
          ),
          index%3===0 ? 2 : 1,
          index%3===0 ? 2 : 1
        );
      }
    }

    ctx.restore();
  }

  r232DrawLightningTraceFx=function(fx){
    if(
      !fx?.r232Trace ||
      !Array.isArray(fx.segments) ||
      !fx.segments.length
    ){
      return;
    }

    let state=null;

    try{
      state=ensureFxState(fx);
    }catch(error){
      console.error(
        "Candidate Rev 14 DBM lightning generation failed:",
        error
      );

      baseDrawLightningTraceFx(fx);
      return;
    }

    const elapsed=
      Math.max(
        0,
        performance.now()-fx.started
      );

    const duration=
      Math.max(
        1,
        Number(fx.duration)||650
      );

    const envelope=
      lightningEnvelope(
        elapsed,
        duration
      );

    const intensity=
      envelope.intensity;

    if(intensity<=0.001){
      return;
    }

    drawIllumination(
      fx,
      intensity
    );

    ctx.save();
    ctx.globalCompositeOperation="lighter";
    ctx.lineCap="round";
    ctx.lineJoin="round";

    for(
      let segmentIndex=0;
      segmentIndex<fx.segments.length;
      segmentIndex++
    ){
      drawDbmTreeOnSegment(
        state.tree,
        fx.segments[segmentIndex],
        segmentIndex,
        envelope.variant,
        intensity
      );
    }

    ctx.restore();

    const time=
      performance.now()/1000;

    for(
      const collision of
      fx.collisions || []
    ){
      drawEnhancedImpact(
        collision,
        intensity,
        time
      );
    }
  };

  window.AdventurePartyDbmLightningProduction={
    release:"Candidate Rev 14",
    profile:{...PROFILE},
    getLastGeneration:()=>({
      seed:lastSeed,
      generationMs:lastGenerationMs
    }),
    generateTestTree:(seed=141)=>
      generateDbmTree(
        Number(seed)>>>0
      )
  };
})();
