/*
  R221 — KOBOLD PRONE NORMALIZATION + AMORPHOUS CLOUD TOPS
  ========================================================
  1) All Kobold-family prone poses now use the shared prone sprite's own
     render metadata, anchor treatment, and contact-shadow presentation.
  2) Fog/cloud gameplay remains hex-based, but the rendered upper volume is
     formed from overlapping rounded lobes and neighbor bridges instead of a
     rectangular per-hex column. The bottom footprint remains tactical/hex
     readable while the top silhouette becomes amorphous.
*/

function r221IsKoboldFamily(unit){
  return !!unit && (
    unit.type==="kobold" ||
    unit.type==="kobold-bodyguard" ||
    unit.type==="kobold-slinger"
  );
}


/* ============================================================
   R221 — PRONE POSE NORMALIZATION
   ============================================================ */

const r221BasePixelAssetIdForUnitPose=pixelAssetIdForUnitPose;

pixelAssetIdForUnitPose=function(unit,poseName=null){
  if(!unit) return null;

  const pose=
    poseName ||
    activeUnitPoseName(unit) ||
    "stand";

  /*
    All Kobold-family types use the exact same prone image. They must therefore
    also use the exact same 35 x 18 prone render profile instead of inheriting
    Body Guard/Slinger standing dimensions.
  */
  if(
    pose==="prone" &&
    r221IsKoboldFamily(unit)
  ){
    return "kobold-prone";
  }

  return r221BasePixelAssetIdForUnitPose(
    unit,
    pose
  );
};


const r221BaseShouldUseKoboldPronePose=
  shouldUseKoboldPronePose;

shouldUseKoboldPronePose=function(unit){
  if(!r221IsKoboldFamily(unit)) return false;
  return r221BaseShouldUseKoboldPronePose(unit);
};


drawKobold=function(k){
  const c=hexCenter(k.x,k.y);

  if(game.active===k.id){
    drawActiveHex(
      k,
      "#df6b6b"
    );
  }

  if(k.alive){
    drawHpBar(k,"#df6b6b");
  }

  const standSprite=
    unitPoseDefinition(k)?.sprites?.stand ||
    koboldSprite;

  const activePoseName=
    activeUnitPoseName(k);

  const sprite=
    unitPoseSprite(k,standSprite);

  if(
    !sprite?.complete ||
    !sprite.naturalWidth
  ){
    return;
  }

  /*
    Fail-safe: if the shared prone sprite has actually been selected, force the
    full prone presentation even if a future pose-state caller supplies stale
    metadata. This prevents a prone image from ever receiving standing scale,
    standing anchor, or standing shadow treatment.
  */
  const usingPronePresentation=
    activePoseName==="prone" ||
    sprite===koboldProneSprite ||
    shouldUseKoboldPronePose(k);

  const koboldAssetId=
    usingPronePresentation
      ? "kobold-prone"
      : (
          pixelAssetIdForUnitPose(
            k,
            activePoseName
          ) ||
          "kobold-stand"
        );

  const koboldDims=
    spriteRenderDimensions(
      koboldAssetId,
      sprite,
      27,
      28
    );

  const drawW=koboldDims.width;
  const drawH=koboldDims.height;

  const spriteAnchor={
    x:c.x,
    y:usingPronePresentation
      ? c.y+10
      : c.y+3
  };

  if(usingPronePresentation){
    /*
      Shared prone treatment:
      - 35 x 18 render profile
      - horizontal ground-hugging shadow
      - shared +10px battlefield baseline
    */
    const proneShadowW=
      Math.max(
        10,
        Math.round(drawW*0.46)
      );

    const proneShadowH=
      Math.max(
        2,
        Math.round(drawH*0.12)
      );

    ctx.save();
    ctx.translate(
      c.x,
      spriteAnchor.y
    );
    ctx.fillStyle=
      "rgba(0,0,0,0.46)";
    ctx.beginPath();
    ctx.ellipse(
      0,
      -1,
      proneShadowW,
      proneShadowH,
      0,
      0,
      Math.PI*2
    );
    ctx.fill();
    ctx.restore();
  }else{
    ctx.save();
    ctx.translate(c.x,c.y+3);
    ctx.scale(0.87,0.30);
    ctx.fillStyle=
      "rgba(0,0,0,0.46)";
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      11,
      0,
      Math.PI*2
    );
    ctx.fill();
    ctx.restore();
  }

  drawSpriteFacing(
    sprite,
    spriteAnchor,
    drawW,
    drawH,
    k.facing,
    getSpriteAssetSpec(koboldAssetId)
      ?.nativeFacing ||
      unitPoseNativeFacing(k,"right"),
    k,
    runtimeAnchorForAsset(koboldAssetId)
  );
};


/* ============================================================
   R221 — AMORPHOUS CLOUD GEOMETRY
   ============================================================ */

function r221FogCellKey(cell){
  return key(cell.x,cell.y);
}

function r221FogHash01(x,y,salt=0){
  let n=(
    Math.imul((x|0)+211+salt,73856093) ^
    Math.imul((y|0)-97-salt,19349663) ^
    Math.imul(salt+31,83492791)
  )>>>0;

  n^=n>>>13;
  n=Math.imul(n,1274126177)>>>0;
  n^=n>>>16;

  return n/4294967295;
}

function r221FogEffectCellMap(effect){
  const map=new Map();

  for(const cell of effect?.cells || []){
    if(
      !cell ||
      !Number.isFinite(cell.x) ||
      !Number.isFinite(cell.y)
    ){
      continue;
    }

    map.set(
      r221FogCellKey(cell),
      cell
    );
  }

  return map;
}

function r221FogCellPresentationVisible(cell){
  if(
    !cell ||
    !inside(cell.x,cell.y)
  ){
    return false;
  }

  if(
    game?.condition==="wall" &&
    typeof isFogCellArchitecturallyVisibleToFriendlyParty==="function"
  ){
    return isFogCellArchitecturallyVisibleToFriendlyParty(cell);
  }

  return true;
}

function r221FogNeighbors(effect,cell){
  const map=r221FogEffectCellMap(effect);

  return HEX_DIRS
    .map(dir=>
      map.get(
        key(
          cell.x+dir.x,
          cell.y+dir.y
        )
      )
    )
    .filter(neighbor=>
      !!neighbor &&
      r221FogCellPresentationVisible(neighbor)
    );
}

function r221FogPairOwner(a,b){
  return r221FogCellKey(a)<r221FogCellKey(b);
}

function r221FogDrift(cell,time){
  return (
    Math.sin(
      time*0.0017+
      cell.x*0.61+
      cell.y*0.43
    )*3.0
  );
}

function r221FogBodyGradient(
  targetCtx,
  c,
  height,
  isStinkingCloud
){
  const grad=
    targetCtx.createLinearGradient(
      c.x,
      c.y-height-6,
      c.x,
      c.y+8
    );

  if(isStinkingCloud){
    grad.addColorStop(
      0,
      "rgba(174,199,74,0.68)"
    );
    grad.addColorStop(
      0.42,
      "rgba(102,151,54,0.84)"
    );
    grad.addColorStop(
      0.72,
      "rgba(63,116,43,0.88)"
    );
    grad.addColorStop(
      1,
      "rgba(37,82,42,0.92)"
    );
  }else{
    grad.addColorStop(
      0,
      "rgba(236,241,242,0.60)"
    );
    grad.addColorStop(
      0.45,
      "rgba(214,223,225,0.82)"
    );
    grad.addColorStop(
      1,
      "rgba(188,199,201,0.88)"
    );
  }

  return grad;
}

function r221FogBodyLobes(cell,time){
  const c=hexCenter(cell.x,cell.y);
  const height=HEX_W;
  const drift=r221FogDrift(cell,time);

  /*
    Four overlapping cross-sections replace the old straight fillRect column.
    Their different widths/offsets break the repeated vertical corners while
    maintaining enough overlap to read as a continuous fog volume.
  */
  return [
    {
      x:c.x+drift*0.14,
      y:c.y-height*0.16,
      rx:HEX_W*0.47,
      ry:14
    },
    {
      x:c.x-drift*0.11,
      y:c.y-height*0.38,
      rx:HEX_W*0.44,
      ry:15
    },
    {
      x:c.x+drift*0.20,
      y:c.y-height*0.60,
      rx:HEX_W*0.49,
      ry:15
    },
    {
      x:c.x-drift*0.08,
      y:c.y-height*0.80,
      rx:HEX_W*0.41,
      ry:13
    }
  ];
}

function r221FogBillows(cell,time){
  const c=hexCenter(cell.x,cell.y);
  const height=HEX_W;
  const result=[];

  for(let i=0;i<10;i++){
    const h1=r221FogHash01(
      cell.x,
      cell.y,
      i*3+1
    );
    const h2=r221FogHash01(
      cell.x,
      cell.y,
      i*3+2
    );
    const h3=r221FogHash01(
      cell.x,
      cell.y,
      i*3+3
    );

    const phase=h1*Math.PI*2;
    const sway=
      Math.sin(
        time*0.0019+phase
      )*(2.2+h2*2.4);

    const lift=
      Math.cos(
        time*0.0016+
        phase*1.37
      )*2.0;

    result.push({
      x:
        c.x+
        (h1-0.5)*HEX_W*0.82+
        sway,
      y:
        c.y-
        7-
        h2*(height-10)+
        lift,
      rx:13+h3*11,
      ry:8+h2*7,
      pulse:
        0.72+
        0.18*Math.sin(
          time*0.0022+
          phase*1.7
        ),
      index:i
    });
  }

  return result;
}

function r221FogCapLobes(cell,time){
  const c=hexCenter(cell.x,cell.y);
  const height=HEX_W;
  const drift=r221FogDrift(cell,time);

  const h1=r221FogHash01(
    cell.x,
    cell.y,
    101
  );
  const h2=r221FogHash01(
    cell.x,
    cell.y,
    102
  );

  const bob=
    Math.sin(
      time*0.0021+
      h1*Math.PI*2
    )*2.6;

  /*
    Three overlapping cap lobes replace the old single flat ellipse.
    Their combined contour is rounded and asymmetrical instead of cylindrical.
  */
  return [
    {
      x:c.x-HEX_W*0.18+drift*0.08,
      y:c.y-height+8+bob*0.22,
      rx:HEX_W*(0.28+h1*0.05),
      ry:10+h2*3
    },
    {
      x:c.x+HEX_W*0.16+drift*0.12,
      y:c.y-height+6-bob*0.18,
      rx:HEX_W*(0.30+h2*0.05),
      ry:11+h1*3
    },
    {
      x:c.x+drift*0.04,
      y:c.y-height-1+bob*0.15,
      rx:HEX_W*0.30,
      ry:10
    }
  ];
}

function r221FogBridgeLobes(
  effect,
  cell,
  time
){
  const result=[];
  const c=hexCenter(cell.x,cell.y);
  const height=HEX_W;
  const drift=r221FogDrift(cell,time);

  for(const neighbor of r221FogNeighbors(effect,cell)){
    /*
      Render each connection only once. The bridge geometry ties adjacent cloud
      cells together without doubling opacity on every pair.
    */
    if(!r221FogPairOwner(cell,neighbor)){
      continue;
    }

    const nc=
      hexCenter(
        neighbor.x,
        neighbor.y
      );

    const nDrift=
      r221FogDrift(
        neighbor,
        time
      );

    const topA={
      x:c.x+drift*0.08,
      y:c.y-height+7
    };

    const topB={
      x:nc.x+nDrift*0.08,
      y:nc.y-height+7
    };

    const midA={
      x:c.x+drift*0.12,
      y:c.y-height*0.57
    };

    const midB={
      x:nc.x+nDrift*0.12,
      y:nc.y-height*0.57
    };

    result.push(
      {
        x:(topA.x+topB.x)/2,
        y:(topA.y+topB.y)/2,
        rx:18,
        ry:10
      },
      {
        x:(midA.x+midB.x)/2,
        y:(midA.y+midB.y)/2,
        rx:20,
        ry:12
      }
    );
  }

  return result;
}

function r221TraceEllipse(
  targetCtx,
  ellipse
){
  targetCtx.beginPath();
  targetCtx.ellipse(
    ellipse.x,
    ellipse.y,
    ellipse.rx,
    ellipse.ry,
    0,
    0,
    Math.PI*2
  );
  targetCtx.fill();
}

function r221FogMaskGeometry(
  targetCtx,
  effect,
  cell,
  time,
  offsetX=0,
  offsetY=0
){
  const c=hexCenter(cell.x,cell.y);
  const top=hexScreenVertices(
    cell.x,
    cell.y
  );

  targetCtx.save();
  targetCtx.translate(
    offsetX,
    offsetY
  );
  targetCtx.fillStyle=
    "rgba(0,0,0,1)";

  /* Keep the tactical bottom footprint anchored to the occupied hex. */
  targetCtx.beginPath();
  targetCtx.moveTo(
    top[0].x,
    top[0].y
  );

  for(let i=1;i<top.length;i++){
    targetCtx.lineTo(
      top[i].x,
      top[i].y
    );
  }

  targetCtx.closePath();
  targetCtx.fill();

  for(const lobe of r221FogBodyLobes(cell,time)){
    r221TraceEllipse(
      targetCtx,
      lobe
    );
  }

  for(const puff of r221FogBillows(cell,time)){
    r221TraceEllipse(
      targetCtx,
      puff
    );
  }

  for(const cap of r221FogCapLobes(cell,time)){
    r221TraceEllipse(
      targetCtx,
      cap
    );
  }

  for(const bridge of r221FogBridgeLobes(effect,cell,time)){
    r221TraceEllipse(
      targetCtx,
      bridge
    );
  }

  targetCtx.restore();
}


drawFogVolumeCell=function(cell,effect=null){
  if(
    !cell ||
    !inside(cell.x,cell.y) ||
    !isHexOnBattlefieldScreen(
      cell.x,
      cell.y,
      HEX_W
    )
  ){
    return;
  }

  const c=hexCenter(cell.x,cell.y);
  const top=hexScreenVertices(
    cell.x,
    cell.y
  );
  const height=HEX_W;
  const time=performance.now();

  const isStinkingCloud=
    effect?.spellKind==="stinking-cloud";

  const globalOpacity=
    isStinkingCloud
      ? 0.125
      : 0.5;

  ctx.save();
  ctx.globalAlpha=globalOpacity;

  /*
    Bottom remains a recognizable tactical hex. Above it, rounded overlapping
    cross-sections replace the old rectangular fog column.
  */
  polygonPath(top);
  ctx.fillStyle=
    isStinkingCloud
      ? "rgba(72,112,42,0.88)"
      : "rgba(207,216,218,0.84)";
  ctx.fill();

  ctx.fillStyle=
    r221FogBodyGradient(
      ctx,
      c,
      height,
      isStinkingCloud
    );

  for(const lobe of r221FogBodyLobes(cell,time)){
    r221TraceEllipse(
      ctx,
      lobe
    );
  }

  /*
    Neighbor bridges visually merge connected cloud cells. They do not change
    the actual effect.cells array, LOS rules, saving throws, or movement.
  */
  for(const bridge of r221FogBridgeLobes(effect,cell,time)){
    r221TraceEllipse(
      ctx,
      bridge
    );
  }

  const stinkingPuffColors=[
    [188,205,77],
    [126,170,58],
    [82,139,48],
    [48,101,45]
  ];

  for(const puff of r221FogBillows(cell,time)){
    ctx.beginPath();
    ctx.ellipse(
      puff.x,
      puff.y,
      puff.rx,
      puff.ry,
      0,
      0,
      Math.PI*2
    );

    if(isStinkingCloud){
      const color=
        stinkingPuffColors[
          (
            Math.abs(
              cell.x*31+
              cell.y*17+
              puff.index
            )
          )%
          stinkingPuffColors.length
        ];

      ctx.fillStyle=
        `rgba(${color[0]},${color[1]},${color[2]},${0.80*puff.pulse})`;
    }else{
      ctx.fillStyle=
        puff.index%2
          ? `rgba(225,232,233,${0.72*puff.pulse})`
          : `rgba(197,207,209,${0.77*puff.pulse})`;
    }

    ctx.fill();
  }

  /*
    Multi-lobed cap deliberately avoids any straight horizontal/vertical top
    edge. Individual caps overlap with neighbor bridges into one cloud bank.
  */
  const caps=
    r221FogCapLobes(
      cell,
      time
    );

  for(let i=0;i<caps.length;i++){
    ctx.beginPath();
    ctx.ellipse(
      caps[i].x,
      caps[i].y,
      caps[i].rx,
      caps[i].ry,
      0,
      0,
      Math.PI*2
    );

    ctx.fillStyle=
      isStinkingCloud
        ? (
            i===2
              ? "rgba(202,216,94,0.70)"
              : "rgba(166,194,70,0.64)"
          )
        : (
            i===2
              ? "rgba(244,248,249,0.70)"
              : "rgba(226,234,236,0.63)"
          );

    ctx.fill();
  }

  /*
    The previous straight side-highlight lines reinforced the box/cylinder
    silhouette, so R221 intentionally omits them.
  */

  ctx.restore();
};


drawFogEffectOutline=function(effect){
  if(
    !effect ||
    effect.type!=="fog" ||
    !Array.isArray(effect.cells) ||
    !effect.cells.length
  ){
    return;
  }

  const visible=
    effect.cells.filter(cell=>
      inside(cell.x,cell.y) &&
      isHexOnBattlefieldScreen(
        cell.x,
        cell.y,
        HEX_W
      )
    );

  if(!visible.length) return;

  const time=performance.now();
  const centers=
    visible.map(cell=>
      hexCenter(cell.x,cell.y)
    );

  const minX=
    Math.floor(
      Math.min(
        ...centers.map(c=>c.x)
      )-
      HEX_W*1.45
    );

  const maxX=
    Math.ceil(
      Math.max(
        ...centers.map(c=>c.x)
      )+
      HEX_W*1.45
    );

  const minY=
    Math.floor(
      Math.min(
        ...centers.map(c=>c.y)
      )-
      HEX_W*1.75
    );

  const maxY=
    Math.ceil(
      Math.max(
        ...centers.map(c=>c.y)
      )+
      HEX_W*0.45
    );

  const width=
    Math.max(
      1,
      maxX-minX+1
    );

  const height=
    Math.max(
      1,
      maxY-minY+1
    );

  const bodyCanvas=
    document.createElement("canvas");

  bodyCanvas.width=width;
  bodyCanvas.height=height;

  const bodyCtx=
    bodyCanvas.getContext("2d");

  bodyCtx.imageSmoothingEnabled=false;

  const visibleEffect={
    ...effect,
    cells:visible
  };

  /*
    Build the outline from the SAME rounded geometry used for the cloud body.
    This prevents the outline itself from reintroducing rectangular corners.
  */
  for(const cell of visible){
    r221FogMaskGeometry(
      bodyCtx,
      visibleEffect,
      cell,
      time,
      -minX,
      -minY
    );
  }

  const outlineCanvas=
    document.createElement("canvas");

  outlineCanvas.width=
    bodyCanvas.width;

  outlineCanvas.height=
    bodyCanvas.height;

  const outlineCtx=
    outlineCanvas.getContext("2d");

  outlineCtx.imageSmoothingEnabled=false;

  for(let dy=-2;dy<=2;dy++){
    for(let dx=-2;dx<=2;dx++){
      if(
        dx===0 &&
        dy===0
      ){
        continue;
      }

      if(
        dx*dx+
        dy*dy>
        4
      ){
        continue;
      }

      outlineCtx.drawImage(
        bodyCanvas,
        dx,
        dy
      );
    }
  }

  outlineCtx.globalCompositeOperation=
    "destination-out";

  outlineCtx.drawImage(
    bodyCanvas,
    0,
    0
  );

  outlineCtx.globalCompositeOperation=
    "source-in";

  /*
    Preserve the established current outline colors while changing only the
    silhouette geometry.
  */
  outlineCtx.fillStyle=
    effect.spellKind==="stinking-cloud"
      ? "rgba(27,72,35,1)"
      : "rgba(0,0,0,1)";

  outlineCtx.fillRect(
    0,
    0,
    outlineCanvas.width,
    outlineCanvas.height
  );

  outlineCtx.globalCompositeOperation=
    "source-over";

  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.globalAlpha=0.82;

  ctx.drawImage(
    outlineCanvas,
    minX,
    minY
  );

  ctx.restore();
};
