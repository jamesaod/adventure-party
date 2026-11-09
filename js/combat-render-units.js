/* Combat owner: combat-render-units.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

function drawScaleTestSprite(ctx,image,cx,bottomY,drawW,drawH,{shadowWidth=null,shadowHeight=7,nativeFacing="right",facing="right"}={}){
  if(!image?.complete || !image.naturalWidth) return;

  const sw=Math.max(6,shadowWidth ?? drawW);
  ctx.save();
  ctx.globalAlpha=0.48;
  ctx.fillStyle="#090a08";
  ctx.beginPath();
  ctx.ellipse(cx,bottomY-1,sw/2,shadowHeight/2,0,0,Math.PI*2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.translate(cx,bottomY);
  if(facing!==nativeFacing) ctx.scale(-1,1);
  ctx.drawImage(image,-Math.round(drawW/2),-drawH,drawW,drawH);
  ctx.restore();
}

// Shared by GPU outlines and the canvas fallback; extend for future factions here.
const hiddenUnitOutlineColors=Object.freeze({player:'#59aaff',enemy:'#ff5757'});
function hiddenUnitOutlineColor(unit){
  if(isPlayerControlledUnit(unit)||unit.faction==='player')return hiddenUnitOutlineColors.player;
  return hiddenUnitOutlineColors[unit.faction]||hiddenUnitOutlineColors.enemy;
}
const hiddenOutlineMaskCache=new WeakMap();
function drawHiddenUnitOutlines(ordered){
  if(!hiddenOutlineUnits.length)return;
  const buckets=new Map(),cellSize=256;
  for(let index=0;index<ordered.length;index++){
    const actor=ordered[index];let polygons=null,bounds;
    if(actor.tree){const center=hexCenter(actor.tree.x,actor.tree.y),h=activeCombatTerrainTileSet().treeDrawHeight||240;bounds={left:center.x-h/2,right:center.x+h/2,top:center.y-h,bottom:center.y};}
    else if(actor.wall||actor.outlineSolids){const solids=actor.outlineSolids||(typeof explorationWallGroundSolids==='function'?explorationWallGroundSolids(actor.wall):[]);polygons=solids.flatMap(s=>(s.faces||[]).map(f=>f.points.map(p=>screenPointForWorld(p,p.elevation))));const points=polygons.flat();if(!points.length)continue;bounds={left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};}
    else continue;
    const entry={actor,index,polygons,bounds};for(let x=Math.floor(bounds.left/cellSize);x<=Math.floor(bounds.right/cellSize);x++)for(let y=Math.floor(bounds.top/cellSize);y<=Math.floor(bounds.bottom/cellSize);y++){const key=x+','+y;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(entry);}
  }
  for(const unit of hiddenOutlineUnits){
    if(!unit.entity.alive||unit.entity.fled||getUnitEffect(unit.entity,'invisibility')||!shouldRenderUnitUnderPartyVisibility(unit.entity))continue;
    const friendly=isPlayerControlledUnit(unit.entity)||unit.entity.faction==='player';if(!friendly&&!isUnitVisibleToFriendlyParty(unit.entity))continue;const color=hiddenUnitOutlineColor(unit.entity);
    const gpuOutline=typeof combatGpu!=='undefined'&&combatGpu?.unitOutline&&globalThis.adventurePartyDirectUnits?.gpuOutline;
      const liveMask=!gpuOutline&&globalThis.adventurePartyDirectUnits?.liveOutline(unit.image,unit.entity,unit.width,unit.height);
    const pad=Math.ceil(2.6/battlefieldZoom)+2;let frame=gpuOutline?{pad,ring:{width:Math.ceil(unit.width)+pad*2,height:Math.ceil(unit.height)+pad*2}}:hiddenUnitOutlineFrame(liveMask||unit.image,unit.width,unit.height,liveMask?false:unit.flip,color);const left=unit.x-frame.pad,top=unit.y-frame.pad;
    let mask=hiddenOutlineMaskCache.get(unit.entity);if(!mask){mask=document.createElement('canvas');hiddenOutlineMaskCache.set(unit.entity,mask);}if(mask.width!==frame.ring.width||mask.height!==frame.ring.height){mask.width=frame.ring.width;mask.height=frame.ring.height;}const m=mask.getContext('2d');m.setTransform(1,0,0,1,0,0);m.clearRect(0,0,mask.width,mask.height);m.translate(-left,-top);
    const candidates=new Set();for(let x=Math.floor(left/cellSize);x<=Math.floor((left+mask.width)/cellSize);x++)for(let y=Math.floor(top/cellSize);y<=Math.floor((top+mask.height)/cellSize);y++)for(const entry of buckets.get(x+','+y)||[])if(entry.index>unit.index)candidates.add(entry);
    for(const {actor,polygons,bounds} of candidates){
      if(bounds.right<left||bounds.left>left+mask.width||bounds.bottom<top||bounds.top>top+mask.height)continue;if(actor.tree){const center=hexCenter(actor.tree.x,actor.tree.y),h=activeCombatTerrainTileSet().treeDrawHeight||240;
        if(center.x+h/2<left||center.x-h/2>left+mask.width||center.y<top||center.y-h>top+mask.height)continue;
        const frame=actor.tree.outlineFrame;if(frame)m.drawImage(frame.image,frame.sx,frame.sy,frame.sourceTileWidth,frame.sourceTileHeight,frame.drawX,frame.drawY,frame.drawW,frame.drawH);
        else{const old=ctx;try{ctx=m;drawTreeDecoration(actor.tree);}finally{ctx=old;}}
      }else if(actor.wall||actor.outlineSolids){
        m.fillStyle='#fff';for(const polygon of polygons)if(tracePolygonOnContext(m,polygon))m.fill();
      }
    }
    const daylight=Math.max(0,Math.min(1,globalThis.adventurePartySolar?.state?.().daylight??1)),active=game.active?.id===unit.entity.id;
    if(gpuOutline){
      if(globalThis.adventurePartyDirectUnits.gpuOutline(combatGpu,unit.image,unit.entity,{mask,left,top,color,active,daylight,width:unit.width,height:unit.height,pad}))continue;
      frame=hiddenUnitOutlineFrame(unit.image,unit.width,unit.height,unit.flip,color);
    }
    const layer=document.createElement('canvas');layer.width=mask.width;layer.height=mask.height;const t=layer.getContext('2d');t.drawImage(frame.ring,0,0);t.globalCompositeOperation='destination-in';t.drawImage(mask,0,0);

    const backing=document.createElement('canvas');backing.width=mask.width;backing.height=mask.height;const b=backing.getContext('2d');b.drawImage(frame.backing,0,0);b.globalCompositeOperation='destination-in';b.drawImage(mask,0,0);
    ctx.save();ctx.globalAlpha=.45+.4*daylight;ctx.drawImage(backing,left,top);
    ctx.globalAlpha=Math.min(1,(active ? .92 : .78)+daylight*.1);ctx.drawImage(layer,left,top);ctx.restore();
  }
}

function drawSpriteFacing(image,c,drawW,drawH,facing,nativeFacing="right",entity=null,anchor=null){
  if(
    !image ||
    !image.complete ||
    !image.naturalWidth ||
    !image.naturalHeight
  ){
    return;
  }

  if(entity?.walkPresentation){const motion=entity.walkPresentation;
    const from=hexCenter(motion.from.x,motion.from.y),to=hexCenter(motion.to.x,motion.to.y);
    const anchor=hexCenter(entity.x,entity.y);
    c={x:c.x+from.x+(to.x-from.x)*motion.t-anchor.x,y:c.y+from.y+(to.y-from.y)*motion.t-anchor.y};
  }
  ctx.save();
  // Detailed 3D-generated sprites benefit from filtered downscaling; classic
  // pixel art keeps nearest-neighbor pixels. Never resample source assets.
  const sourceWidth=image.naturalWidth || 1;
  const sourceHeight=image.naturalHeight || 1;
  const detailedSource=sourceWidth>drawW*1.35 || sourceHeight>drawH*1.35;
  ctx.imageSmoothingEnabled=!!detailedSource;
  if(detailedSource) ctx.imageSmoothingQuality="high";

  const directionalPoses=unitPoseDefinition(entity)?.directionalSprites;
  const isDirectionalImage=directionalPoses && Object.values(directionalPoses).some(
    frames=>Object.values(frames).some(frame=>frame?.image===image)
  );
  let viewFacing=facing;
  if(entity&&typeof battlefieldRotation==='number'&&battlefieldRotation){const dir=HEX_DIRS[facingDirectionIndex(entity)],v=battlefieldProjectVector(worldPointForHex(dir.x,dir.y));viewFacing=v.x<0?'left':'right';}
  const shouldFlip=!isDirectionalImage && viewFacing!==nativeFacing;
  // Studio captures retain their native alpha and full source resolution.
  // Only legacy pixel-art sprites use the binary-alpha crisp cache.
  const renderSource=isDirectionalImage ? image : (image._crispRenderSource || image);
  const spriteAnchor=anchor || {x:0.5,y:1};

  const enlargeScale=enlargeVisualScale(entity);
  const visualDrawW=Math.max(1,drawW*enlargeScale);
  const visualDrawH=Math.max(1,drawH*enlargeScale);

  if(globalThis.adventurePartySun?.drawingGround){
    const hidden=!!getUnitEffect(entity,"invisibility");
    if(!hidden)globalThis.adventurePartySun.draw(ctx,renderSource,{x:c.x,y:c.y,width:visualDrawW,height:visualDrawH,
      anchorX:Math.round(visualDrawW*spriteAnchor.x)/visualDrawW,
      anchorY:Math.round(visualDrawH*spriteAnchor.y)/visualDrawH,flip:shouldFlip,pose:activeUnitPoseName(entity)});
    ctx.restore();return;
  }
  if(typeof hiddenOutlineCapture!=='undefined'&&hiddenOutlineCapture&&entity&&!getUnitEffect(entity,'invisibility'))hiddenOutlineUnits.push({entity,image:renderSource,
    width:visualDrawW,height:visualDrawH,flip:shouldFlip,index:hiddenOutlineCapture.index,
    x:c.x-Math.round(visualDrawW*spriteAnchor.x),y:c.y-Math.round(visualDrawH*spriteAnchor.y)});
  const gpuSprite=typeof explorationGpuLighting!=='undefined'&&!!explorationGpuLighting;
  const brightness=!gpuSprite&&typeof combatSpriteBrightness==='function'?combatSpriteBrightness(entity):1;
  let spriteFilter=brightness<.999?`${ctx.filter&&ctx.filter!=='none'?ctx.filter+' ':''}brightness(${brightness})`:ctx.filter;
  if(!gpuSprite&&entity&&!entity.alive&&Number.isFinite(entity.deathPresentationStartedAt))spriteFilter=`${spriteFilter&&spriteFilter!=='none'?spriteFilter+' ':''}saturate(0.5)`;
  ctx.translate(c.x,c.y);

  if(shouldFlip){
    ctx.scale(-1,1);
  }

  const invisible=!!getUnitEffect(entity,"invisibility");
  if(invisible){
    ctx.globalAlpha=0.30;
  }

  const mirror=getUnitEffect(entity,"mirror-image");
  const imageCount=Math.max(0,Number(mirror?.data?.images)||0);

  if(imageCount>0){
    const baseX=-Math.round(visualDrawW*spriteAnchor.x);
    const baseY=-Math.round(visualDrawH*spriteAnchor.y);
    const inheritedAlpha=ctx.globalAlpha;

    ctx.save();
    ctx.globalAlpha=inheritedAlpha*0.45;
    if(spriteFilter)ctx.filter=spriteFilter;
    for(const offset of visualMirrorOffsets(Math.min(4,imageCount))){
      try{
        if(!(typeof drawDirectCombatUnit==='function'&&drawDirectCombatUnit(renderSource,entity,{x:c.x+offset.x,y:c.y+offset.y},visualDrawW,visualDrawH,spriteAnchor,ctx.globalAlpha))&&(!gpuSprite||!drawExplorationGpuSprite(renderSource,entity,baseX+offset.x,baseY+offset.y,visualDrawW,visualDrawH)))ctx.drawImage(renderSource,baseX+offset.x,baseY+offset.y,visualDrawW,visualDrawH);
      }catch(error){
        console.error("Mirror Image sprite draw skipped.",error);
      }
    }
    ctx.restore();
  }

  const transitionFx=activeEnlargeTransitionFx(entity);
  const glowFx=transitionFx || activeCastingGlowFx(entity);

  if(glowFx){
    drawCastingGlowSilhouette(
      renderSource,
      visualDrawW,
      visualDrawH,
      glowFx,
      spriteAnchor
    );
  }

  ctx.save();
  if(spriteFilter)ctx.filter=spriteFilter;
  try{
    if(!(typeof drawDirectCombatUnit==='function'&&drawDirectCombatUnit(renderSource,entity,c,visualDrawW,visualDrawH,spriteAnchor,ctx.globalAlpha))&&(!gpuSprite||!drawExplorationGpuSprite(renderSource,entity,-Math.round(visualDrawW*spriteAnchor.x),-Math.round(visualDrawH*spriteAnchor.y),visualDrawW,visualDrawH)))ctx.drawImage(renderSource,-Math.round(visualDrawW*spriteAnchor.x),-Math.round(visualDrawH*spriteAnchor.y),visualDrawW,visualDrawH);
  }catch(error){
    console.error("Sprite draw skipped because the image source is invalid.",error);
  }finally{ctx.restore();}

  drawFlamingSword(renderSource,entity,visualDrawW,visualDrawH,spriteAnchor);
  ctx.restore();
}

function drawFighter(p){
  if(unitPoseDefinition(p)?.spriteLayout) return drawStudioSpriteMob(p);
  const c=hexCenter(p.x,p.y);

  if(game.active==="player"){
    drawActiveHex(p,"player");
  }

  drawHpBar(p,"#94e084");

  const directional=directionalUnitPoseFrame(p);
  const sprite=directional ? directional.image : fighterSprite;
  const assetId=directional?.assetId || "fighter";
  const fighterDims=spriteRenderDimensions(assetId,sprite,26,35);
  const drawW=fighterDims.width;
  const drawH=fighterDims.height;


  drawSpriteFacing(
    sprite,
    c,
    drawW,
    drawH,
    p.facing,
    getSpriteAssetSpec(assetId)?.nativeFacing || "left",
    p,
    runtimeAnchorForAsset(assetId)
  );

}

function drawStudioSpriteMob(unit){
  const frame=directionalUnitPoseFrame(unit);
  const sprite=frame?.image?.complete&&frame.image.naturalWidth?frame.image:
    (unit.type==='fighter'||['ranger','mage','cleric'].includes(unit.type)?fighterSprite:
      unit.type?.startsWith('orc')?orcStandSprite:unit.type?.startsWith('kobold')?koboldSprite:
      unit.type==='juvenile-red-dragon'?juvenileRedDragonStandSprite:fighterSprite);
  if(!sprite?.complete||!sprite.naturalWidth)return;
  const center=unitFootprintScreenCenter(unit);
  if(!unit.alive&&unit.deathWorldOffset){const offset=battlefieldProjectVector(corpsePresentationOffset(unit));center.x+=offset.x;center.y+=offset.y;}
  const dimensions=frame?spriteRenderDimensions(frame.assetId,sprite):
    {width:Math.max(1,Math.round((unitFootprintCellCount(unit)>1?50:32))),
     height:Math.max(1,Math.round((unitFootprintCellCount(unit)>1?54:35)))};
  const friendly=unit.faction==="player";
  if(unit.alive&&game.active===unit.id) drawActiveHex(unit,friendly ? "player" : "#df6b6b");
  if(unit.alive) drawHpBar(unit,friendly ? "#94e084" : "#df6b6b");
  if(!globalThis.adventurePartySun?.drawingGround&&unitFootprintCellCount(unit)>1){
    ctx.save();
    for(const cell of occupiedHexes(unit)){
      if(game?.condition==="wall" && !isHexVisibleToFriendlyParty(cell.x,cell.y)) continue;
      polygonPath(hexScreenVertices(cell.x,cell.y));
      ctx.fillStyle=friendly ? "rgba(121,231,231,0.035)" : "rgba(170,70,46,0.035)";
      ctx.strokeStyle=friendly ? "rgba(121,231,231,0.18)" : "rgba(224,128,88,0.18)";
      ctx.lineWidth=1;
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  drawSpriteFacing(sprite,center,dimensions.width,dimensions.height,
    unit.facing,"right",unit,frame?runtimeAnchorForAsset(frame.assetId):null);
}

function drawKobold(k){
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

  /*
    R110 Kobold art uses the shared unit-pose framework:
      - standing frame for idle, movement, and fleeing
      - action frame for every attack type
      - prone frame for magical sleep, unconsciousness, or canonical prone
      - dead kobolds are not yet rendered with the prone frame
      - R115 swaps in the newer prone kobold art with transparent background
  */
  const standSprite=unitPoseDefinition(k)?.sprites?.stand || koboldSprite;
  const activePoseName=activeUnitPoseName(k);
  const sprite=unitPoseSprite(k,standSprite);

  if(!sprite?.complete || !sprite.naturalWidth){
    return;
  }

  /* R162: explicit per-asset render dimensions replace implicit source-size scaling. */
  const koboldAssetId=pixelAssetIdForUnitPose(k,activePoseName) || "kobold-stand";
  const koboldDims=spriteRenderDimensions(koboldAssetId,sprite,27,28);
  const drawW=koboldDims.width;
  const drawH=koboldDims.height;

  const spriteAnchor={
    x:c.x,
    y:activePoseName==="prone" ? c.y+10 : c.y+3
  };

  drawSpriteFacing(
    sprite,
    spriteAnchor,
    drawW,
    drawH,
    k.facing,
    getSpriteAssetSpec(koboldAssetId)?.nativeFacing || unitPoseNativeFacing(k,"right"),
    k,
    runtimeAnchorForAsset(koboldAssetId)
  );
}

// Death feedback is the animated model and corpse, without a skull overlay.
function drawDeathFx(){}

function drawUnitBarks(){
  if(!game) return;

  const now=performance.now();

  for(const unit of allUnits()){
    if(
      !unit?.alive ||
      unit.fled ||
      !unit.barkText ||
      !Number.isFinite(unit.barkUntil) ||
      now>=unit.barkUntil
    ){
      continue;
    }

    if(game?.condition==="wall" && !isHexVisibleToWallTestObserver(unit.x,unit.y)){
      continue;
    }

    const c=hexCenter(unit.x,unit.y);
    const textValue=unit.barkText;
    const fontSize=14;
    const yOffset=isKoboldUnit(unit) ? 47 : 58;

    const y=Math.round(c.y-yOffset);

    /*
      R125: all white battlefield speech is rendered through the shared
      foreground text helper so it always has a solid black outline.
    */
    drawWhiteBattlefieldText(
      textValue,
      c.x,
      y,
      {fontSize}
    );
  }
}
