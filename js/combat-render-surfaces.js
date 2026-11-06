/* Combat owner: combat-render-surfaces.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

function drawTerrainScorch(cacheOnly=false){
  const marks=Object.values(game.terrainScorch||{});if(!marks.length)return;
  let cache=game.scorchCache;
  if(!cache){
    const points=marks.map(mark=>({...worldPointForHex(mark.x,mark.y),strength:mark.strength}));
    const rx=HEX_W*.88,ry=HEX_ROW*1.65,left=Math.min(...points.map(p=>p.x))-rx,top=Math.min(...points.map(p=>p.y))-ry;
    const spanX=Math.max(...points.map(p=>p.x))+rx-left,spanY=Math.max(...points.map(p=>p.y))+ry-top;
    const step=Math.max(2,spanX/1024,spanY/1024),width=Math.ceil(spanX/step),height=Math.ceil(spanY/step);
    const image=document.createElement('canvas');image.width=width;image.height=height;
    const context=image.getContext('2d'),pixels=context.createImageData(width,height);
    const buckets=new Map(),bucketSize=HEX_W*2;
    for(const point of points)for(let bx=Math.floor((point.x-rx)/bucketSize);bx<=Math.floor((point.x+rx)/bucketSize);bx++)for(let by=Math.floor((point.y-ry)/bucketSize);by<=Math.floor((point.y+ry)/bucketSize);by++){
      const id=bx+':'+by;if(!buckets.has(id))buckets.set(id,[]);buckets.get(id).push(point);}
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const wx=left+(x+.5)*step,wy=top+(y+.5)*step,noise=scorchNoise(wx,wy,13)*.65+scorchNoise(wx,wy,4)*.35;
      let cover=0;for(const point of buckets.get(Math.floor(wx/bucketSize)+':'+Math.floor(wy/bucketSize))||[]){
        const distance=Math.hypot((wx-point.x)/rx,(wy-point.y)/ry),edge=Math.max(0,Math.min(1,(1-distance+(noise-.5)*.38)/.52));
        cover=Math.max(cover,edge*edge*(3-2*edge)*point.strength);}
      if(cover<=0)continue;
      let kind='grass';if(combatSceneTerrain&&combatSceneContext){const t=combatSceneTerrain,origin=combatSceneContext.origin;
        kind=explorationEncounterApi.surfaceAt(combatSceneContext.map,{x:origin.x+wx/t.cellW,z:origin.z+wy/t.cellH}).ground;}
      const color=kind==='stone'?[16,17,18]:kind==='dirt'?[28,20,14]:kind==='wood'?[18,12,8]:[17,18,11];
      const index=(y*width+x)*4;pixels.data[index]=color[0];pixels.data[index+1]=color[1];pixels.data[index+2]=color[2];pixels.data[index+3]=Math.round(cover*(.68+noise*.24)*255);
    }
    context.putImageData(pixels,0,0);cache=game.scorchCache={image,left,top,spanX:width*step,spanY:height*step};
  }
  if(cacheOnly)return cache;
  // The GPU floor applies this albedo layer before local-light shading.
  if(typeof explorationGpuLighting!=='undefined'&&explorationGpuLighting)return;
  const origin=screenPointForWorld({x:cache.left,y:cache.top}),u=battlefieldProjectVector({x:cache.spanX,y:0}),v=battlefieldProjectVector({x:0,y:cache.spanY});
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.transform(u.x/cache.image.width,u.y/cache.image.width,v.x/cache.image.height,v.y/cache.image.height,origin.x,origin.y);ctx.drawImage(cache.image,0,0);ctx.restore();
}

function drawTreeGroundShadow(decoration){
  const tileSet=activeCombatTerrainTileSet();
  drawFirContactShadow(decoration,tileSet);
  if(directFirRendering()){
    const shadow=liveFirTreeRender(tileSet,decoration,{host:combatGpu,ground:true}).shadow;if(!shadow)return;
    const center=hexCenter(decoration.x,decoration.y),scale=tileSet.treeDrawHeight/210,left=center.x+shadow.left*scale,top=center.y+shadow.top*scale,width=shadow.width*scale,height=shadow.height*scale;
    const faces=explorationFloorFragments(visibleHexes()).filter(fragment=>{const p=hexCenter(fragment.point.x,fragment.point.y);return p.x>=left-HEX_W&&p.x<=left+width+HEX_W&&p.y>=top-HEX_ROW&&p.y<=top+height+HEX_ROW;}).map(fragment=>({points:fragment.polygon,uv:fragment.polygon.map(point=>{const p=screenPointForWorld(point);return[(p.x-left)/width,1-(p.y-top)/height];})}));
    combatGpu.surface(faces,shadow.texture,{opacity:shadow.opacity,sunShadow:true});return;
  }
  const live=liveFirTreeRender(tileSet,decoration);
  if(live){
    if(live.shadow){
      const c=hexCenter(decoration.x,decoration.y),shadow=live.shadow,scale=tileSet.treeDrawHeight/210;
      ctx.save();ctx.globalAlpha=shadow.opacity;ctx.imageSmoothingEnabled=true;
      ctx.drawImage(shadow.image,c.x+shadow.left*scale,c.y+shadow.top*scale,shadow.width*scale,shadow.height*scale);
      ctx.restore();
    }
    return;
  }
  const image=TERRAIN_TREE_SHADOW_IMAGES.get(tileSet.id);
  if(!image?.complete || !image.naturalWidth)return;
  const c=hexCenter(decoration.x,decoration.y);
  const size=tileSet.treeDrawHeight;
  ctx.save();
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(image,treeRotationFrame(tileSet,decoration)*512,decoration.tileIndex*512,512,512,
    c.x-size/2,c.y-448*size/512,size,size);
  ctx.restore();
}

function drawTreeDecoration(decoration){
  const tileSet=activeCombatTerrainTileSet();
  if(directFirRendering()){
    const center=hexCenter(decoration.x,decoration.y),height=tileSet.treeDrawHeight||240;
    liveFirTreeRender(tileSet,decoration,{host:combatGpu,center,scale:height/210});
    const burnt=game.firFireStates?.[key(decoration.x,decoration.y)]?.state==='burnt';
    const image=burnt?combatFirTrees.silhouette(decoration.tileIndex,treeRotationFrame(tileSet,decoration),true):TERRAIN_TREE_IMAGES.get(tileSet.id);
    decoration.outlineFrame={image,sx:burnt?0:treeRotationFrame(tileSet,decoration)*384,sy:burnt?0:decoration.tileIndex*512,sourceTileWidth:384,sourceTileHeight:512,drawX:center.x-height*.375,drawY:center.y-height*.875,drawW:height*.75,drawH:height};return;
  }
  const live=liveFirTreeRender(tileSet,decoration);
  const image=live?.body || TERRAIN_TREE_IMAGES.get(tileSet.id);

  if(
    !decoration ||
    (!live && (!image?.complete || image.naturalWidth<=0))
  ){
    return;
  }

  const c=hexCenter(decoration.x,decoration.y);
  const drawH=tileSet.treeDrawHeight || 86;
  const drawW=Math.max(
    1,
    Math.round(
      drawH*
      ((tileSet.treeSourceTileWidth || 192)/(tileSet.treeSourceTileHeight || 216))
    )
  );

  const sourceColumn=tileSet.treeRotationFrames
    ? treeRotationFrame(tileSet,decoration)
    : decoration.tileIndex % (tileSet.treeColumns || 1);
  const sourceRow=tileSet.treeRotationFrames ? decoration.tileIndex
    : Math.floor(decoration.tileIndex/(tileSet.treeColumns || 1));

  const sourceTileWidth=tileSet.treeSourceTileWidth || 192;
  const sourceTileHeight=tileSet.treeSourceTileHeight || 216;
  const sx=live?0:sourceColumn*sourceTileWidth;
  const sy=live?0:sourceRow*sourceTileHeight;

  // Every view uses the same trunk anchor at the exact hex center.
  const sourceBaseX=tileSet.treeBaseAnchorX ?? (sourceTileWidth/2);
  const sourceBaseY=tileSet.treeBaseAnchorY ?? sourceTileHeight;
  const scaleX=drawW/sourceTileWidth;
  const scaleY=drawH/sourceTileHeight;
  const drawX=c.x-sourceBaseX*scaleX;
  const drawY=c.y-sourceBaseY*scaleY;

  ctx.save();
  if(!tileSet.treeShadowSheetSrc){
    ctx.translate(c.x,c.y+1);
    ctx.scale(1.06,0.34);
    ctx.fillStyle="rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.arc(0,0,26,0,Math.PI*2);
    ctx.fill();
  }
  ctx.restore();

  decoration.outlineFrame={image,sx,sy,sourceTileWidth,sourceTileHeight,drawX:Math.round(drawX),drawY:Math.round(drawY),drawW,drawH};
  ctx.save();
  ctx.imageSmoothingEnabled=!!tileSet.treeRotationFrames;
  ctx.drawImage(
    image,
    sx,
    sy,
    sourceTileWidth,
    sourceTileHeight,
    Math.round(drawX),
    Math.round(drawY),
    drawW,
    drawH
  );
  ctx.restore();

}

function drawScaleTestHex(ctx,cx,cy,w=122,h=92){
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx-w/2,cy);
  ctx.lineTo(cx-w/4,cy-h/2);
  ctx.lineTo(cx+w/4,cy-h/2);
  ctx.lineTo(cx+w/2,cy);
  ctx.lineTo(cx+w/4,cy+h/2);
  ctx.lineTo(cx-w/4,cy+h/2);
  ctx.closePath();
  ctx.fillStyle="#40543a";
  ctx.fill();
  ctx.strokeStyle="#17281f";
  ctx.lineWidth=3;
  ctx.stroke();

  /* restrained terrain pixels for scale context */
  ctx.fillStyle="#526a45";
  for(const [ox,oy] of [[-34,-9],[31,-21],[-16,27],[38,18],[7,-31]]){
    ctx.fillRect(Math.round(cx+ox),Math.round(cy+oy),3,5);
    ctx.fillRect(Math.round(cx+ox+3),Math.round(cy+oy+2),2,3);
  }
  ctx.restore();
}

function drawArchitecturalFloorRegions(){
  const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
  if(!architecturalSpaces.length) return;

  for(const space of architecturalSpaces){
    if(space.environment!=="indoor" || !space.polygon?.length) continue;

    const points=space.polygon.map(point=>screenPointForWorld(point));
    if(points.length<3) continue;

    ctx.save();

    if(!tracePolygonOnContext(ctx,points)){
      ctx.restore();
      continue;
    }

    /*
      R204: indoor floors use PamNawi's CC BY 4.0 handpainted stone texture.
      The texture is continuous across tactical hexes; hex geometry is an
      overlay and does not define the material seams.
    */
    if(explorationTerrain){ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";}
    const floorPattern=explorationTerrain?explorationFloorPatternForView(space.ground==='grass'):stoneFloorPatternForCurrentView();
    ctx.fillStyle=
      floorPattern ||
      space.floorColor ||
      "#66686d";
    ctx.fill();

    /*
      A neutral veil serves standalone indoor maps; exploration uses a warm
      multiplicative ambient tint that retains source stone contrast.
    */
    ctx.clip();
    if(!explorationTerrain){
      ctx.globalAlpha=0.10;ctx.fillStyle="#9a9ca2";
      ctx.fillRect(0,0,BATTLEFIELD_LOGICAL_WIDTH,BATTLEFIELD_LOGICAL_HEIGHT);
    }

    ctx.restore();
  }
}

function drawDoorwayThresholds(){
  if(game?.condition!=="wall") return;

  ctx.save();
  ctx.lineJoin="miter";

  for(const wall of architecturalWalls){
    for(const opening of wall.openings || []){
      if(opening.type!=="doorway") continue;

      const worldPolygon=
        doorwayThresholdWorldPolygon(wall,opening);
      if(worldPolygon.length<3) continue;

      const screenPolygon=worldPolygon.map(point=>
        screenPointForWorld(point)
      );

      if(!tracePolygonOnContext(ctx,screenPolygon)) continue;

      /*
        Fill only: an outside stroke would make the threshold wider than the
        wall slab it is meant to match.
      */
      ctx.fillStyle="#414348";
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawWallTestFloorPlan(){
  if(typeof combatSceneTerrain!=="undefined"&&combatSceneTerrain)return;
  /*
    R205: doorway gaps get a dark-grey threshold across the complete wall
    depth. This is presentation-only: movement/LOS/projectile opening mechanics
    remain defined by the authored doorway gap itself.
  */
  drawDoorwayThresholds();
}

function drawArchitecturalWallShadows(){
  const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
  if((typeof explorationTerrain!=="undefined"&&explorationTerrain) || !architecturalWalls.length) return; // Indoor encounters have torchlight, not the test sun.

  ctx.save();
  ctx.lineJoin="miter";
  ctx.lineCap="square";

  for(const wall of architecturalWalls){
    for(const blocker of wallBlockingSubsegments(wall,"movement")){
      const a=screenPointForWorld(blocker.a);
      const b=screenPointForWorld(blocker.b);
      const height=Math.max(1,Number(wall.height)||35);
      const sx=height*ARCHITECTURAL_WALL_SHADOW.xPerHeight;
      const sy=height*ARCHITECTURAL_WALL_SHADOW.yPerHeight;

      ctx.fillStyle=ARCHITECTURAL_WALL_SHADOW.fill;
      ctx.beginPath();
      ctx.moveTo(a.x,a.y);
      ctx.lineTo(b.x,b.y);
      ctx.lineTo(b.x+sx,b.y+sy);
      ctx.lineTo(a.x+sx,a.y+sy);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle=ARCHITECTURAL_WALL_SHADOW.farEdge;
      ctx.lineWidth=Math.max(2,(wall.thickness||9)*0.65);
      ctx.beginPath();
      ctx.moveTo(a.x+sx,a.y+sy);
      ctx.lineTo(b.x+sx,b.y+sy);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawWallOpeningOnLayer(layerCtx,wall,opening){
  const asset=processedWallOpeningAsset(opening?.type);
  const metrics=wallOpeningScreenMetrics(wall,opening);
  if(!asset || !metrics) return false;

  layerCtx.save();
  layerCtx.imageSmoothingEnabled=false;
  layerCtx.globalCompositeOperation="source-over";
  layerCtx.drawImage(
    asset.display,
    metrics.x,
    metrics.y,
    metrics.width,
    metrics.height
  );
  layerCtx.restore();
  return true;
}

function drawArchitecturalWallShapeOutline(wallsToOutline=architecturalWalls){
  const walls=(wallsToOutline || []).filter(Boolean);
  if(!walls.length) return;

  const mask=document.createElement("canvas");
  mask.width=BATTLEFIELD_LOGICAL_WIDTH;
  mask.height=BATTLEFIELD_LOGICAL_HEIGHT;
  const mctx=mask.getContext("2d");
  mctx.imageSmoothingEnabled=false;
  mctx.lineCap="square";
  mctx.lineJoin="miter";
  mctx.strokeStyle="rgba(255,255,255,1)";

  for(const wall of walls){
    const height=Math.max(1,Math.round(wall.height || 35));
    const thickness=Math.max(3,Number(wall.thickness)||9);

    mctx.lineWidth=thickness;

    for(const solid of wallBlockingSubsegments(wall,"movement")){
      const a=screenPointForWorld(solid.a);
      const b=screenPointForWorld(solid.b);

      for(let z=0;z<=height;z++){
        mctx.beginPath();
        mctx.moveTo(a.x,a.y-z);
        mctx.lineTo(b.x,b.y-z);
        mctx.stroke();
      }
    }
  }

  const outline=document.createElement("canvas");
  outline.width=mask.width;
  outline.height=mask.height;
  const octx=outline.getContext("2d");
  octx.imageSmoothingEnabled=false;

  /* Two-pixel dilation of the complete union silhouette. */
  for(let dy=-2;dy<=2;dy++){
    for(let dx=-2;dx<=2;dx++){
      if(dx===0 && dy===0) continue;
      if((dx*dx)+(dy*dy)>4) continue;
      octx.drawImage(mask,dx,dy);
    }
  }

  /* Keep only pixels OUTSIDE the original wall structure. */
  octx.globalCompositeOperation="destination-out";
  octx.drawImage(mask,0,0);
  octx.globalCompositeOperation="source-over";

  octx.globalCompositeOperation="source-in";
  octx.fillStyle="#050507";
  octx.fillRect(0,0,outline.width,outline.height);
  octx.globalCompositeOperation="source-over";

  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.globalAlpha=1;
  ctx.drawImage(outline,0,0);
  ctx.restore();
}

function drawArchitecturalWallTopOutline(wallsToOutline=architecturalWalls){
  const walls=(wallsToOutline || []).filter(Boolean);
  if(!walls.length) return;

  /*
    R206: rasterize only the upward-facing cap strokes into one shared mask.
    The resulting 2 px outline follows the union of connected top surfaces
    rather than outlining every authored wall segment independently.
  */
  const mask=document.createElement("canvas");
  mask.width=BATTLEFIELD_LOGICAL_WIDTH;
  mask.height=BATTLEFIELD_LOGICAL_HEIGHT;

  const mctx=mask.getContext("2d");
  mctx.imageSmoothingEnabled=false;
  mctx.lineCap="square";
  mctx.lineJoin="miter";
  mctx.strokeStyle="rgba(255,255,255,1)";

  for(const wall of walls){
    const height=Math.max(1,Math.round(wall.height || 35));
    const thickness=Math.max(3,Number(wall.thickness)||9);
    mctx.lineWidth=thickness;

    for(const solid of wallBlockingSubsegments(wall,"movement")){
      const a=screenPointForWorld(solid.a,height);
      const b=screenPointForWorld(solid.b,height);

      mctx.beginPath();
      mctx.moveTo(a.x,a.y);
      mctx.lineTo(b.x,b.y);
      mctx.stroke();
    }
  }

  const outline=document.createElement("canvas");
  outline.width=mask.width;
  outline.height=mask.height;
  const octx=outline.getContext("2d");
  octx.imageSmoothingEnabled=false;

  for(let dy=-2;dy<=2;dy++){
    for(let dx=-2;dx<=2;dx++){
      if(dx===0 && dy===0) continue;
      if((dx*dx)+(dy*dy)>4) continue;
      octx.drawImage(mask,dx,dy);
    }
  }

  octx.globalCompositeOperation="destination-out";
  octx.drawImage(mask,0,0);
  octx.globalCompositeOperation="source-over";

  octx.globalCompositeOperation="source-in";
  octx.fillStyle="#050507";
  octx.fillRect(0,0,outline.width,outline.height);
  octx.globalCompositeOperation="source-over";

  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.globalAlpha=1;
  ctx.drawImage(outline,0,0);
  ctx.restore();
}

function drawArchitecturalWallSegment(wall){
  if(typeof combatSceneTerrain!=='undefined'&&combatSceneTerrain)return drawExplorationWallPrism(wall);
  const height=Math.max(1,Math.round(wall.height || 35));
  const thickness=Math.max(3,wall.thickness || 9);
  const capColor=wall.material==="old-wood" ? "#716b61" : wall.material==="exploration-stone" ? "#8a775d" : "#888b92";
  const solidSegments=wallBlockingSubsegments(wall,"movement");

  const layer=document.createElement("canvas");
  layer.width=BATTLEFIELD_LOGICAL_WIDTH;
  layer.height=BATTLEFIELD_LOGICAL_HEIGHT;
  const lctx=layer.getContext("2d");
  lctx.imageSmoothingEnabled=false;
  lctx.lineCap="square";
  lctx.lineJoin="miter";

  if(wall.material==="exploration-stone"){lctx.imageSmoothingEnabled=true;lctx.imageSmoothingQuality="high";}
  let wallPaint=wall.material==="exploration-stone" ? (explorationWallPattern(lctx,wall,height)||"#756d5e") : "#555860";

  if(wall.material==="old-wood"){
    const woodPattern=oldWoodWallPatternForWall(
      lctx,
      wall,
      height,
      thickness
    );
    if(woodPattern){
      wallPaint=woodPattern;
    }
  }

  /*
    Doorways remain genuine gaps between wall subsegments. Windows are carved
    later as apertures so their glass/lattice plane can live at wall mid-depth.
  */
  lctx.strokeStyle=wallPaint;
  lctx.lineWidth=thickness;

  for(const solid of solidSegments){
    const a=screenPointForWorld(solid.a);
    const b=screenPointForWorld(solid.b);

    for(let z=0;z<height;z++){
      lctx.beginPath();
      lctx.moveTo(a.x,a.y-z);
      lctx.lineTo(b.x,b.y-z);
      lctx.stroke();
    }
  }

  if(wall.material==="exploration-stone"){
    shadeExplorationWall(lctx,wall,height,thickness);
  }

  /*
    R200 source-facing wall light:
    each contribution paints only the half-thickness face on the same side of
    the wall centerline as its source. The opposite face remains unchanged.
  */
  const lightContributions=wall.material==="exploration-stone"?[]:architecturalWallLightContributions(wall);
  const visibleFaceSide=architecturalVisibleWallFaceSide(wall);

  for(const contribution of lightContributions){
    /*
      R204: a hidden/back face may be lit physically, but it must not brighten
      the visible front face. This rejects sources on the opposite side of the
      wall before any glow is painted into the wall layer.
    */
    if(
      visibleFaceSide===0 ||
      contribution.faceSide!==visibleFaceSide
    ){
      continue;
    }
    const source=contribution.source;
    const sourceScreen=hexCenter(source.x,source.y);
    const sourceLift=source.sourceKind==="unit" ? 20 : 5;
    const radiusPx=
      (Math.max(1,Number(source.radiusHexes)||1)+0.55)*HEX_W;
    const color=source.color || [255,244,188];
    /*
      R207: soften visible wall-face illumination by a further 50%.
      Terrain/floor illumination is intentionally unchanged.
    */
    const strength=
      Math.max(0,Math.min(1.35,contribution.intensity))*0.25;

    const gradient=lctx.createRadialGradient(
      sourceScreen.x,
      sourceScreen.y-sourceLift,
      2,
      sourceScreen.x,
      sourceScreen.y-sourceLift,
      radiusPx
    );

    gradient.addColorStop(
      0,
      `rgba(${color[0]},${color[1]},${color[2]},${0.42*strength})`
    );
    gradient.addColorStop(
      0.52,
      `rgba(${color[0]},${color[1]},${color[2]},${0.24*strength})`
    );
    gradient.addColorStop(
      1,
      `rgba(${color[0]},${color[1]},${color[2]},0)`
    );

    const normal=contribution.wallNormal || {x:0,y:0};
    const side=contribution.faceSide || 1;
    const faceWidth=Math.max(1,thickness*0.50);
    const faceOffset=thickness*0.25;
    const offsetX=normal.x*side*faceOffset;
    const offsetY=normal.y*side*faceOffset;

    lctx.save();
    lctx.globalCompositeOperation="lighter";
    lctx.strokeStyle=gradient;
    lctx.lineWidth=faceWidth;

    for(const solid of solidSegments){
      const a=screenPointForWorld({
        x:solid.a.x+offsetX,
        y:solid.a.y+offsetY
      });
      const b=screenPointForWorld({
        x:solid.b.x+offsetX,
        y:solid.b.y+offsetY
      });

      for(let z=2;z<height-1;z++){
        lctx.beginPath();
        lctx.moveTo(a.x,a.y-z);
        lctx.lineTo(b.x,b.y-z);
        lctx.stroke();
      }
    }

    lctx.restore();
  }

  /*
    R202: repeating material belongs only on vertical wall faces.
    The wall top is a separate flat cap surface and must not inherit the wood
    boards/pattern from the vertical sprite.
  */
  lctx.strokeStyle=capColor;
  lctx.lineWidth=thickness;

  for(const solid of solidSegments){
    const a=screenPointForWorld(solid.a);
    const b=screenPointForWorld(solid.b);
    lctx.beginPath();
    lctx.moveTo(a.x,a.y-height);
    lctx.lineTo(b.x,b.y-height);
    lctx.stroke();
  }

  /*
    Only projectable north/south windows receive a visible aperture + window
    plane. East/west window planes are edge-on in this camera and therefore
    intentionally produce no face-on texture or cutout artifact.
  */
  for(const opening of wall.openings || []){
    if(opening.type!=="window") continue;
    cutWallOpeningFromLayer(lctx,wall,opening);
  }

  for(const opening of wall.openings || []){
    if(opening.type!=="window") continue;
    drawWallOpeningOnLayer(lctx,wall,opening);
  }

  /*
    R202 internal/joined corner readability:
    a dark vertical seam marks connected 90-degree wall joints. This restores
    the depth cue the union-outline pass intentionally removed from connected
    masonry while keeping ordinary straight wall segments seamless.
  */
  lctx.save();
  lctx.strokeStyle="#050507";
  lctx.lineWidth=2;
  lctx.lineCap="butt";

  for(const corner of architecturalCornerSeamPoints(wall)){
    const point=screenPointForWorld(corner);
    lctx.beginPath();
    lctx.moveTo(point.x,point.y-height);
    lctx.lineTo(point.x,point.y);
    lctx.stroke();
  }

  lctx.restore();

  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(layer,0,0);
  ctx.restore();
}

function drawTerrainIlluminationLayer(tiles){
  if(!game) return;

  const sources=illuminationSources().concat(combatSpellEffectLights());
  if(!sources.length) return;

  const lightCanvas=
    drawTerrainIlluminationLayer.lightCanvas ||
    (drawTerrainIlluminationLayer.lightCanvas=document.createElement("canvas"));

  if(
    lightCanvas.width!==BATTLEFIELD_LOGICAL_WIDTH ||
    lightCanvas.height!==BATTLEFIELD_LOGICAL_HEIGHT
  ){
    lightCanvas.width=BATTLEFIELD_LOGICAL_WIDTH;
    lightCanvas.height=BATTLEFIELD_LOGICAL_HEIGHT;
  }

  const lightCtx=lightCanvas.getContext("2d");
  lightCtx.imageSmoothingEnabled=false;

  for(const source of sources){
    const center=hexCenter(source.x,source.y);
    const radiusHexes=Math.max(1,Number(source.radiusHexes)||1);
    const screenRadius=(radiusHexes+0.70)*HEX_W;
    const color=source.color || [255,244,188];
    const sourceAlpha=0.18*Math.min(1.25,source.intensity||1);

    /*
      Preserve the established open-field renderer exactly. R202's hard
      shadow-volume method is architectural/Wall-Test-only.
    */
    if(game.condition!=="wall"){
      const gradient=ctx.createRadialGradient(
        center.x,
        center.y-4,
        2,
        center.x,
        center.y-4,
        screenRadius
      );

      gradient.addColorStop(
        0,
        `rgba(${color[0]},${color[1]},${color[2]},${sourceAlpha})`
      );
      gradient.addColorStop(
        0.48,
        `rgba(${color[0]},${color[1]},${color[2]},${sourceAlpha*0.72})`
      );
      gradient.addColorStop(
        1,
        `rgba(${color[0]},${color[1]},${color[2]},0)`
      );

      for(const tile of tiles){
        const contribution=illuminationContributionFromSource(
          source,
          tile.x,
          tile.y
        );
        if(contribution<=0) continue;

        const top=hexScreenVertices(tile.x,tile.y);
        const tileCenter=hexCenter(tile.x,tile.y);

        ctx.save();
        polygonPath(top);
        ctx.clip();
        ctx.globalCompositeOperation="lighter";
        ctx.globalAlpha=Math.min(1,0.58+contribution*0.42);
        ctx.fillStyle=gradient;
        ctx.fillRect(
          tileCenter.x-HEX_W/2-2,
          tileCenter.y-HEX_H/2-2,
          HEX_W+4,
          HEX_H+4
        );
        ctx.restore();
      }

      continue;
    }

    lightCtx.clearRect(0,0,lightCanvas.width,lightCanvas.height);
    lightCtx.globalCompositeOperation="source-over";
    lightCtx.globalAlpha=1;

    const gradient=lightCtx.createRadialGradient(
      center.x,
      center.y-4,
      2,
      center.x,
      center.y-4,
      screenRadius
    );

    gradient.addColorStop(
      0,
      `rgba(${color[0]},${color[1]},${color[2]},${sourceAlpha})`
    );
    gradient.addColorStop(
      0.48,
      `rgba(${color[0]},${color[1]},${color[2]},${sourceAlpha*0.72})`
    );
    gradient.addColorStop(
      1,
      `rgba(${color[0]},${color[1]},${color[2]},0)`
    );

    /*
      Wall Test begins with one continuous light field. Solid architecture then
      removes authoritative hard shadow volumes from it. This is deliberately
      independent of whole-hex reachability, which was the source of the bleed.
    */
    lightCtx.fillStyle=gradient;
    lightCtx.fillRect(
      center.x-screenRadius,
      center.y-screenRadius-4,
      screenRadius*2,
      screenRadius*2
    );

    const sourceWorld=worldPointForHex(source.x,source.y);

    lightCtx.save();
    lightCtx.globalCompositeOperation="destination-out";
    lightCtx.globalAlpha=1;
    lightCtx.fillStyle="rgba(0,0,0,1)";

    for(const wall of architecturalWalls){
      for(const blocker of wallBlockingSubsegments(wall,"light")){
        const shadowWorld=
          architecturalLightShadowPolygonWorld(sourceWorld,blocker);
        if(shadowWorld.length<3) continue;

        const shadowScreen=shadowWorld.map(point=>
          screenPointForWorld(point)
        );

        if(tracePolygonOnContext(lightCtx,shadowScreen)){
          lightCtx.fill();
        }
      }
    }

    lightCtx.restore();

    ctx.save();
    ctx.globalCompositeOperation="lighter";
    ctx.globalAlpha=1;
    ctx.drawImage(lightCanvas,0,0);
    ctx.restore();
  }
}

function drawWallTestLineOfSightMask(){
  if(game?.condition!=="wall") return;

  const contexts=friendlyVisibilityObservers()
    .map(observer=>observerVisibilityContext(observer))
    .filter(Boolean);

  if(!contexts.length) return;

  const maskCanvas=drawWallTestLineOfSightMask.maskCanvas ||
    (drawWallTestLineOfSightMask.maskCanvas=document.createElement("canvas"));

  const v=battlefieldViewportBounds(),left=Math.floor(v.left)-2,top=Math.floor(v.top)-2;
  const width=Math.ceil(v.right-left)+2,height=Math.ceil(v.bottom-top)+2;
  if(maskCanvas.width!==width || maskCanvas.height!==height){maskCanvas.width=width;maskCanvas.height=height;}

  const maskCtx=maskCanvas.getContext("2d");
  maskCtx.clearRect(0,0,maskCanvas.width,maskCanvas.height);
  maskCtx.globalCompositeOperation="source-over";

  /* Fully unseen terrain remains readable at 70% black. */
  maskCtx.fillStyle="rgba(0,0,0,0.70)";
  maskCtx.fillRect(0,0,maskCanvas.width,maskCanvas.height);

  /*
    R215: visibility is no longer painted as a smooth polygon through tactical
    cells. The continuous LOS polygon decides only whether a HEX CENTER is in
    sight. Every qualifying hex is then punched completely out of the blackout.
  */
  maskCtx.save();maskCtx.translate(-left,-top);
  maskCtx.globalCompositeOperation="destination-out";
  maskCtx.fillStyle="rgba(0,0,0,1)";

  for(const tile of visibleHexes()){
    const visible=contexts.some(context=>
      isHexVisibleFromObserver(
        context.observer,
        tile.x,
        tile.y,
        context
      )
    );

    if(!visible) continue;

    const vertices=hexScreenVertices(tile.x,tile.y);
    maskCtx.beginPath();
    maskCtx.moveTo(vertices[0].x,vertices[0].y);

    for(let i=1;i<vertices.length;i++){
      maskCtx.lineTo(vertices[i].x,vertices[i].y);
    }

    maskCtx.closePath();
    maskCtx.fill();
  }

  maskCtx.globalCompositeOperation="source-over";

  ctx.save();
  ctx.globalCompositeOperation="source-over";
  maskCtx.restore();ctx.drawImage(maskCanvas,left,top);
  ctx.restore();
}

function drawVisibleArchitecturalWallsOverLOS(){
  const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
  if(game?.condition!=="wall" || !architecturalWalls.length) return;

  /*
    R154: the post-LOS foreground repaint uses one shared isometric depth queue
    for visible masonry, units, and Wall of Fog. R153 fog participated in the
    primary actor sort, but the later masonry repaint ignored fog and therefore
    forced every visible wall on top of it. Fog now retains the same depth
    relationship in the final pass: fog closer to the viewer can cover masonry,
    while masonry closer to the viewer still covers fog.
  */
  const foreground=[];
  const visibleWalls=architecturalWalls.filter(
    wall=>isArchitecturalWallVisibleToFriendlyParty(wall)
  );

  /*
    R197: repeat the same exterior-only union outline after the LOS blackout,
    but only for architecture currently visible to the party.
  */
  drawArchitecturalWallShapeOutline(visibleWalls);
  drawArchitecturalWallTopOutline(visibleWalls);

  for(const wall of visibleWalls){
    const a=screenPointForWorld(wall.a);
    const b=screenPointForWorld(wall.b);
    foreground.push({
      sortY:Math.max(a.y,b.y)+0.25,
      sortX:(a.x+b.x)/2,
      wall,
      fn:()=>drawArchitecturalWallSegment(wall)
    });
  }

  /* Repaint only fog cells not hidden from the party by solid architecture. */
  for(const effect of game.areaEffects || []){
    if(effect.type!=="fog") continue;

    const visibleFogCells=(effect.cells || []).filter(cell=>
      inside(cell.x,cell.y) &&
      isHexOnBattlefieldScreen(cell.x,cell.y,HEX_W) &&
      isFogCellArchitecturallyVisibleToFriendlyParty(cell)
    );

    let outlineSortY=-Infinity;
    let outlineSortX=0;

    for(const cell of visibleFogCells){
      const c=hexCenter(cell.x,cell.y);
      const sortY=c.y+0.5;
      outlineSortY=Math.max(outlineSortY,sortY);
      outlineSortX=c.x;
      foreground.push({
        sortY,
        sortX:c.x,
        fn:()=>drawFogVolumeCell(cell,effect)
      });
    }

    if(visibleFogCells.length && Number.isFinite(outlineSortY)){
      const visibleEffect={...effect,cells:visibleFogCells};
      foreground.push({
        sortY:outlineSortY+0.02,
        sortX:outlineSortX,
        fn:()=>drawFogEffectOutline(visibleEffect)
      });
    }
  }

  if(game.player?.alive && !game.player.fled){
    const c=unitDepthSortPoint(game.player);
    foreground.push({sortY:c.y,sortX:c.x,fn:()=>drawFighter(game.player)});
  }

  for(const ally of game.allies || []){
    if(!ally?.alive || ally.fled) continue;
    const c=unitDepthSortPoint(ally);
    foreground.push({
      sortY:c.y,
      sortX:c.x,
      fn:()=>ally.type==="mage" ? drawFriendlyMage(ally) : drawFriendlyArcher(ally)
    });
  }

  for(const enemy of game.enemies || []){
    if(!enemy?.alive || enemy.fled) continue;
    if(!shouldRenderUnitUnderPartyVisibility(enemy)) continue;

    const depth=unitDepthSortPoint(enemy);
    foreground.push({
      sortY:depth.y,
      sortX:depth.x,
      fn:()=>
        unitPoseDefinition(enemy)?.spriteLayout
          ? drawStudioSpriteMob(enemy)
          : enemy.species==="orc"
          ? drawOrc(enemy)
          : enemy.type==="juvenile-red-dragon"
            ? drawLargeTestMob(enemy)
            : drawKobold(enemy)
    });
  }

  foreground.sort((a,b)=>a.sortY-b.sortY || a.sortX-b.sortX);

  for(const item of foreground){
    item.fn();
  }
}

function drawHexFill(x,y){
  const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
  if(explorationTerrain)return; // Exact room polygons supply the floor, never whole boundary hexes.
  const top=hexScreenVertices(x,y);
  const c=hexCenter(x,y);
  const tileSet=activeCombatTerrainTileSet();
  const image=TERRAIN_TILESET_IMAGES.get(tileSet.id);

  ctx.save();
  polygonPath(top);
  ctx.clip();

  /* Safe fallback while a terrain sheet is loading. */
  ctx.fillStyle=tileSet.background || "#4d613e";
  ctx.fillRect(
    c.x-HEX_W/2,
    c.y-HEX_H/2,
    HEX_W,
    HEX_H
  );

  if(
    image?.complete &&
    image.naturalWidth>0
  ){
    const tileIndex=chooseTerrainTileIndex(
      tileSet,
      x,
      y
    );

    const sourceColumn=
      tileIndex % tileSet.columns;

    const sourceRow=
      Math.floor(tileIndex/tileSet.columns);

    const sx=
      sourceColumn*tileSet.sourceTileWidth;

    const sy=
      sourceRow*tileSet.sourceTileHeight;

    /*
      The source sheet uses the same pointy-top hex orientation as
      the battlefield. Scaling to HEX_W/HEX_H intentionally flattens
      it to the game's existing isometric tactical proportions.
    */
    ctx.imageSmoothingEnabled=true;

    ctx.drawImage(
      image,
      sx,
      sy,
      tileSet.sourceTileWidth,
      tileSet.sourceTileHeight,
      c.x-HEX_W/2-0.6,
      c.y-HEX_H/2-0.6,
      HEX_W+1.2,
      HEX_H+1.2
    );
  }

  ctx.restore();
}

function drawHexGridLine(x,y){
  const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
  if(explorationTerrain){polygonPath(hexScreenVertices(x,y));ctx.strokeStyle="rgba(35,29,22,0.28)";ctx.lineWidth=1;ctx.stroke();return;}
  const top=hexScreenVertices(x,y);
  const tileSet=activeCombatTerrainTileSet();
  const outdoorStroke=
    tileSet.gridStroke ||
    "rgba(38,91,42,0.78)";

  polygonPath(top);
  ctx.strokeStyle=outdoorStroke;
  ctx.lineWidth=1.5;
  ctx.stroke();

  if(game?.condition!=="wall" || !architecturalSpaces.length){
    return;
  }

  /*
    R206: only border portions lying over indoor floor are repainted black.
    Outdoor portions remain the terrain's normal green.
  */
  for(const space of architecturalSpaces){
    if(space.environment!=="indoor" || !space.polygon?.length) continue;

    const points=space.polygon.map(point=>screenPointForWorld(point));
    if(points.length<3) continue;

    ctx.save();
    if(tracePolygonOnContext(ctx,points)){
      ctx.clip();
      polygonPath(top);
      ctx.strokeStyle="#050507";
      ctx.lineWidth=1.5;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawFloor(){
  const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
  const tileSet=activeCombatTerrainTileSet();

  ctx.fillStyle="#08080c";
  if(!(explorationTerrain&&combatGpu))ctx.fillRect(0,0,BATTLEFIELD_LOGICAL_WIDTH,BATTLEFIELD_LOGICAL_HEIGHT);

  const tiles=visibleHexes();

  for(const tile of tiles){
    drawHexFill(tile.x,tile.y);
  }

  if(explorationTerrain)drawExplorationBlackoutFloor();

  /* R123: continuous indoor floors overlay and split the outdoor hex textures. */
  if(explorationTerrain&&combatGpu)drawExplorationGpuFloor(tiles);
  else drawArchitecturalFloorRegions();

  if(explorationTerrain&&combatGpu)combatGpu.prepareOverlay();
  if(explorationTerrain){ctx.save();clipExplorationFloor();}

  drawTerrainScorch();

  /* R195: dynamic light sources brighten terrain before grid/UI overlays. */
  if(explorationTerrain){if(!combatGpu)drawExplorationIlluminationLayer();}else drawTerrainIlluminationLayer(tiles);
  if(explorationTerrain){drawExplorationTorchFloorGlow(tiles);drawDistanceVisibilityLayer(tiles);drawExplorationSpellLighting(tiles);}

  for(const tile of tiles){
    drawHexGridLine(tile.x,tile.y);
  }

  if(typeof drawEnvironmentGroundArrows==='function')drawEnvironmentGroundArrows();

  for(const cell of hoverHighlightCells()){
    const top=hexScreenVertices(cell.x,cell.y);

    polygonPath(top);
    ctx.fillStyle="rgba(229,205,131,0.10)";
    ctx.fill();

    ctx.strokeStyle="#a69c6d";
    ctx.lineWidth=1.5;
    ctx.stroke();
  }

  if(aimMode){
    drawAimAreaPreview();

    const top=hexScreenVertices(aimCursor.x,aimCursor.y);

    polygonPath(top);
    ctx.fillStyle="rgba(121,231,231,0.16)";
    ctx.fill();

    ctx.strokeStyle=typeof environmentAimBlocked==='function'&&environmentAimBlocked()?"#ff635b":"#fff19a";
    ctx.lineWidth=3;
    ctx.stroke();

    const c=hexCenter(aimCursor.x,aimCursor.y);
    ctx.strokeStyle="#79e7e7";
    ctx.lineWidth=2;

    ctx.beginPath();
    ctx.moveTo(c.x-9,c.y);
    ctx.lineTo(c.x+9,c.y);
    ctx.moveTo(c.x,c.y-6);
    ctx.lineTo(c.x,c.y+6);
    ctx.stroke();
  }
  if(explorationTerrain)ctx.restore();
}

function drawActiveHex(entity,color){
  if(globalThis.adventurePartySun?.drawingGround)return;
  for(const cell of occupiedHexes(entity)){
    const top=hexScreenVertices(cell.x,cell.y);

    polygonPath(top);
    ctx.fillStyle=color==="player"
      ? "rgba(121,231,231,0.10)"
      : "rgba(223,107,107,0.10)";
    ctx.fill();

    ctx.strokeStyle=color==="player" ? "#79e7e7" : color;
    ctx.lineWidth=3;
    ctx.stroke();
  }
}

// Rebuild small per-hex stamps only when droplets settle, never each animation frame.
function drawCombatBloodStains(){
  drawCombatDeathPools();
  const state=game?.bloodState;if(!state?.stains.length)return;
  if(!state.cache||state.cache.revision!==state.revision){
    const groups=new Map();
    for(const stain of state.stains){const id=stain.hex.x+':'+stain.hex.y;let group=groups.get(id);
      if(!group){const center=worldPointForHex(stain.hex.x,stain.hex.y),image=document.createElement('canvas');image.width=128;image.height=128;
        group={image,hex:stain.hex,left:center.x-HEX_W/2,top:center.y-HEX_ROW};groups.set(id,group);}
      const c=group.image.getContext('2d'),sx=128/HEX_W,sy=128/(HEX_ROW*2),x=(stain.point.x-group.left)*sx,y=(stain.point.y-group.top)*sy;
      c.fillStyle=stain.seed<.5?'rgba(83,13,17,.82)':'rgba(111,22,24,.78)';
      const flecks=stain.ground==='grass'?4:2;
      for(let i=0;i<flecks;i++){const angle=stain.seed*37+i*2.4,r=i?stain.size:0;c.beginPath();c.ellipse(x+Math.cos(angle)*r*sx,y+Math.sin(angle)*r*sy,stain.size*sx*(i?.35:.8),stain.size*sy*(i?.65:.5),angle,0,Math.PI*2);c.fill();}
    }state.cache={revision:state.revision,groups:[...groups.values()]};
  }
  ctx.save();
  // Continuous party LOS also clips partial hexes alongside walls.
  if(typeof friendlyVisibilityObservers==='function'&&typeof observerVisibilityContext==='function'){
    const polygons=friendlyVisibilityObservers().map(observer=>observerVisibilityContext(observer)?.polygon).filter(Boolean);
    if(polygons.length){ctx.beginPath();for(const polygon of polygons){const points=polygon.map(p=>screenPointForWorld(p));ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();}ctx.clip();}
  }
  for(const group of state.cache.groups){if(!isHexVisibleToFriendlyParty(group.hex.x,group.hex.y))continue;
    const origin=screenPointForWorld({x:group.left,y:group.top}),u=battlefieldProjectVector({x:HEX_W,y:0}),v=battlefieldProjectVector({x:0,y:HEX_ROW*2});
    ctx.save();ctx.filter='brightness('+Math.max(.08,Math.min(1,combatSpriteBrightness({...group.hex,alive:true})))+')';
    ctx.transform(u.x/128,u.y/128,v.x/128,v.y/128,origin.x,origin.y);ctx.drawImage(group.image,0,0);ctx.restore();
  }ctx.restore();
}

function drawCombatDeathPools(){
 const now=performance.now();
 for(const pool of game?.bloodState?.pools||[]){
  if(now<pool.started||!isHexVisibleToFriendlyParty(pool.hex.x,pool.hex.y))continue;
  const growth=Math.sqrt(Math.min(1,(now-pool.started)/3000));
  const points=pool.contour.map(p=>screenPointForWorld({x:pool.origin.x+(p.x-pool.origin.x)*growth,y:pool.origin.y+(p.y-pool.origin.y)*growth}));
  ctx.save();ctx.filter='brightness('+Math.max(.08,Math.min(1,combatSpriteBrightness({...pool.hex,alive:true})))+')';
  if(typeof tracePolygonOnContext==='function'&&tracePolygonOnContext(ctx,points)){ctx.fillStyle='rgba(83,8,13,.85)';ctx.fill();}
  ctx.restore();
 }
}

// Low fir boughs occlude the ground beneath them independently of solar direction.
function drawFirContactShadow(tree,tileSet){
  if(!tileSet.treeSheetSrc?.includes('/treeit-firs/'))return;
  if(game.firFireStates?.[key(tree.x,tree.y)]?.state==='burnt')return;
  let image=drawFirContactShadow.image;
  if(!image){image=document.createElement('canvas');image.width=image.height=128;
    const brush=image.getContext('2d'),gradient=brush.createRadialGradient(64,64,0,64,64,64);
    gradient.addColorStop(0,'rgba(0,0,0,.48)');gradient.addColorStop(.22,'rgba(0,0,0,.35)');
    gradient.addColorStop(.6,'rgba(0,0,0,.14)');gradient.addColorStop(1,'rgba(0,0,0,0)');
    brush.fillStyle=gradient;brush.fillRect(0,0,128,128);drawFirContactShadow.image=image;
  }
  const center=worldPointForHex(tree.x,tree.y),rx=HEX_W*.75,ry=rx*HEX_ROW/(HEX_W*Math.sqrt(3)/2);
  const left=center.x-rx,top=center.y-ry;
  if(combatGpu&&combatSceneTerrain){
    const tiles=visibleHexes().filter(hex=>{const p=worldPointForHex(hex.x,hex.y);return Math.abs(p.x-center.x)<rx+HEX_W&&Math.abs(p.y-center.y)<ry+HEX_ROW*2;});
    const faces=explorationFloorFragments(tiles).map(fragment=>clipFirContactPolygon(fragment.polygon,left,top,left+rx*2,top+ry*2)).filter(points=>points.length>=3).map(points=>({points,uv:points.map(p=>[Math.max(0,Math.min(1,(p.x-left)/(rx*2))),Math.max(0,Math.min(1,1-(p.y-top)/(ry*2)))])}));
    combatGpu.surface(faces,image,{sunShadow:(globalThis.adventurePartySolar?.state()?.daylight||0)>.1});return;
  }
  const origin=screenPointForWorld({x:left,y:top}),u=battlefieldProjectVector({x:rx*2,y:0}),v=battlefieldProjectVector({x:0,y:ry*2});
  ctx.save();ctx.transform(u.x/128,u.y/128,v.x/128,v.y/128,origin.x,origin.y);ctx.drawImage(image,0,0);ctx.restore();
}

// Clip the receiver geometry to the stamp: floor materials repeat UVs by default.
function clipFirContactPolygon(points,left,top,right,bottom){
  for(const [axis,bound,sign] of [['x',left,1],['x',right,-1],['y',top,1],['y',bottom,-1]]){
    const result=[];if(!points.length)break;
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],insideA=(a[axis]-bound)*sign>=0,insideB=(b[axis]-bound)*sign>=0;
      if(insideA)result.push(a);
      if(insideA!==insideB){const t=(bound-a[axis])/(b[axis]-a[axis]);result.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
    }points=result;
  }return points.map(p=>({x:Math.max(left,Math.min(right,p.x)),y:Math.max(top,Math.min(bottom,p.y))}));
}
