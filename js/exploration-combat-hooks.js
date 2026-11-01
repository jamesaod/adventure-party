/* Loaded after the ordinary engine. Encounters reuse its units, turns and walls. */
const explorationFloorImage=new Image(),explorationWallImage=new Image(),explorationDoorImage=new Image();
const explorationMaterialTiles=new WeakMap();
// Filter to each material's displayed footprint, including anisotropic wall
// reduction, instead of keeping a grainy large source or a blurred fixed mip.
function explorationMaterialTile(image,targetWidth=512,targetHeight=512){
  if(!image.complete||!image.naturalWidth)return null;
  const max=explorationEncounterApi.SCENE_STYLE.materials.maxTilePixels;
  targetWidth=Math.min(max,Math.max(16,Math.ceil(targetWidth)));targetHeight=Math.min(max,Math.max(16,Math.ceil(targetHeight)));
  let cache=explorationMaterialTiles.get(image);if(!cache){cache=new Map();explorationMaterialTiles.set(image,cache);}
  const key=`${targetWidth}:${targetHeight}`;if(cache.has(key))return cache.get(key);
  let tile=image,width=image.naturalWidth,height=image.naturalHeight;
  while(width>targetWidth||height>targetHeight){
    const next=document.createElement('canvas');next.width=Math.max(targetWidth,Math.ceil(width/2));next.height=Math.max(targetHeight,Math.ceil(height/2));
    const target=next.getContext('2d');target.imageSmoothingEnabled=true;target.imageSmoothingQuality='high';target.drawImage(tile,0,0,next.width,next.height);
    tile=next;width=next.width;height=next.height;
  }
  if(cache.size>=16)cache.delete(cache.keys().next().value);cache.set(key,tile);return tile;
}
function explorationMaterialDensity(){return (typeof battlefieldZoom==='number'?battlefieldZoom:1)*(typeof BATTLEFIELD_RENDER_DENSITY==='number'?BATTLEFIELD_RENDER_DENSITY:1);}
// Material helpers extend the shared architectural renderer; gameplay uses its
// existing walls, movement, LOS, lights and depth ordering.
function explorationFloorPatternForView(){
  if(!explorationFloorImage.complete||!explorationFloorImage.naturalWidth)return null;
  const m=explorationEncounterApi.materialMetrics(explorationTerrain),density=explorationMaterialDensity();
  const tile=explorationMaterialTile(explorationFloorImage,m.floorWidth*density,m.floorHeight*density),pattern=ctx.createPattern(tile,'repeat');if(!pattern)return null;
  const origin=screenPointForWorld({x:-explorationTerrain.cellW/2,y:-explorationTerrain.cellH/2}),u=battlefieldProjectVector({x:m.floorWidth,y:0}),v=battlefieldProjectVector({x:0,y:m.floorHeight});
  pattern.setTransform(new DOMMatrix([u.x/tile.width,u.y/tile.width,v.x/tile.height,v.y/tile.height,origin.x,origin.y]));return pattern;
}
function explorationWallPattern(target,wall,height){
  const image=wall.edgeMaterial==='wood'?explorationDoorImage:explorationWallImage;
  if(!image.complete||!image.naturalWidth)return null;
  const m=explorationEncounterApi.materialMetrics(explorationTerrain,height),density=explorationMaterialDensity();
  const tile=explorationMaterialTile(image,m.wallWidth*density,m.wallHeight*density),pattern=target.createPattern(tile,'repeat');if(!pattern)return null;
  const origin=screenPointForWorld(wall.a),worldOrigin=screenPointForWorld({x:0,y:0});
  pattern.setTransform(new DOMMatrix([m.wallWidth/tile.width,0,0,m.wallHeight/tile.height,worldOrigin.x,origin.y-m.wallHeight]));return pattern;
}
// One affine lighting strip per broad face keeps per-hex brightness without
// repeatedly clipping/restoring the texture along internal hex boundaries.
function drawExplorationFaceBands(target,face,fragments,colors,mode){
 const api=explorationEncounterApi;if(face.cap||!api.wallLightBandRuns)return false;
 const neutral=mode==='multiply'?255:0;if(colors.every(c=>c.every(v=>v===neutral)))return true;
 const span=Math.hypot(face.screen[2].x-face.screen[3].x,face.screen[2].y-face.screen[3].y);
 const width=Math.min(2048,Math.max(1,Math.ceil(span*explorationMaterialDensity())));
 const strip=drawExplorationFaceBands.strip||(drawExplorationFaceBands.strip=document.createElement('canvas'));if(strip.width!==width)strip.width=width;if(strip.height!==1)strip.height=1;
 const paint=strip.getContext('2d');paint.globalCompositeOperation='source-over';
 for(const run of api.wallLightBandRuns(face,fragments,width)){paint.fillStyle=`rgb(${colors[run.index].map(v=>Math.round(Math.max(0,Math.min(255,v)))).join(',')})`;paint.fillRect(run.start,0,run.end-run.start,1);}
 const a=face.screen[3],b=face.screen[2],c=face.screen[0];target.save();target.globalCompositeOperation=mode;target.imageSmoothingEnabled=false;
 target.transform((b.x-a.x)/width,(b.y-a.y)/width,c.x-a.x,c.y-a.y,a.x,a.y);target.drawImage(strip,0,0);target.restore();return true;
}
// Project each solid face independently: ground rotates, vertical edges stay vertical.
function drawExplorationSolids(solids,wall,visible=true,cacheOwner=wall){
 const api=explorationEncounterApi,faces=solids.flatMap(s=>s.faces).map(face=>({...face,screen:face.points.map(p=>screenPointForWorld(p,p.elevation))}));
 const all=faces.flatMap(f=>f.screen);if(!all.length)return;
 const left=Math.floor(Math.min(...all.map(p=>p.x)))-2,top=Math.floor(Math.min(...all.map(p=>p.y)))-2,width=Math.ceil(Math.max(...all.map(p=>p.x))-left)+2,height=Math.ceil(Math.max(...all.map(p=>p.y))-top)+2,v=battlefieldViewportBounds();
 if(left+width<v.left||left>v.right||top+height<v.top||top>v.bottom)return;
 const lights=explorationVisualLights(),opened=new Set(explorationEncounter.openDoors),cell=api.SCENE_STYLE.cellMetres,squash=explorationTerrain.cellH/explorationTerrain.cellW;
 const cache=drawExplorationSolids.cache||(drawExplorationSolids.cache=new WeakMap()),key=JSON.stringify([typeof battlefieldRotation==='number'?battlefieldRotation:0,explorationMaterialDensity(),lights,explorationEncounter.openDoors,explorationFloorImage.naturalWidth,explorationWallImage.naturalWidth,explorationDoorImage.naturalWidth]);
 const anchor=screenPointForWorld(solids[0].a),prior=cache.get(cacheOwner);
 if(prior?.key===key){presentExplorationSolids(prior,prior.left+anchor.x-prior.anchor.x,prior.top+anchor.y-prior.anchor.y,visible);return;}
 const layer=document.createElement('canvas');layer.width=width;layer.height=height;const target=layer.getContext('2d');target.translate(-left,-top);target.imageSmoothingEnabled=true;target.imageSmoothingQuality='high';
 // The nearer vertical face covers the far face; top caps finish each solid.
 faces.sort((a,b)=>Math.max(...a.points.map(p=>screenPointForWorld(p).y))-Math.max(...b.points.map(p=>screenPointForWorld(p).y))||Number(a.cap)-Number(b.cap));
 for(const face of faces){
  const points=face.screen;target.save();target.beginPath();target.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))target.lineTo(p.x,p.y);target.closePath();target.clip();
  const image=face.material==='door'||wall?.edgeMaterial==='wood'?explorationDoorImage:explorationWallImage;
  const span=Math.hypot(face.points[1].x-face.points[0].x,(face.points[1].y-face.points[0].y)/squash),h=Math.abs(face.points[3].elevation-face.points[0].elevation);
  if(!face.cap&&span>.001&&h>.001){
   const density=explorationMaterialDensity(),metrics=api.materialMetrics(explorationTerrain),repeat=face.material==='door'?span:metrics.wallWidth;
   const tile=explorationMaterialTile(image,repeat*density,h*density),pattern=tile&&target.createPattern(tile,'repeat');
   if(pattern){const a=points[3],b=points[2];pattern.setTransform(new DOMMatrix([(b.x-a.x)/span*repeat/tile.width,(b.y-a.y)/span*repeat/tile.width,0,h/tile.height,a.x,a.y]));target.fillStyle=pattern;}else target.fillStyle=face.material==='door'?'#855025':'#8a775d';
  }else target.fillStyle=face.material==='door'?'#b3844b':'#9c8867';
  target.fillRect(left,top,width,height);
  const lighting=(api.faceLightFragments?api.faceLightFragments(face,HEX_W,HEX_ROW):[face]).map(fragment=>{
   const n=fragment.points.length,mid=fragment.points.reduce((p,q)=>({x:p.x+q.x/n,y:p.y+q.y/n,h:p.h+q.elevation/n}),{x:0,y:0,h:0});
   const point={x:(explorationEncounter.origin.x+mid.x/explorationTerrain.cellW)*cell,y:mid.h/35*api.SCENE_STYLE.wallMetres,z:(explorationEncounter.origin.z+mid.y/explorationTerrain.cellH)*cell};
   return {...fragment,exposure:explorationSurfaceExposure(point,face.normal,lights,opened)};
  });
  if(!face.cap&&api.wallLightBandRuns){
   drawExplorationFaceBands(target,face,lighting,lighting.map(f=>f.exposure.multiply),'multiply');
   drawExplorationFaceBands(target,face,lighting,lighting.map(f=>f.exposure.boost),'color-dodge');
  }else for(const fragment of lighting){
   target.save();const polygon=fragment.points.map(p=>screenPointForWorld(p,p.elevation));target.beginPath();target.moveTo(polygon[0].x,polygon[0].y);for(const p of polygon.slice(1))target.lineTo(p.x,p.y);target.closePath();target.clip();
   for(const [mode,color] of [['multiply',fragment.exposure.multiply],['color-dodge',fragment.exposure.boost]]){target.globalCompositeOperation=mode;target.fillStyle=`rgb(${color.join(',')})`;target.fillRect(left,top,width,height);}target.restore();
  }
  target.restore();target.beginPath();target.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))target.lineTo(p.x,p.y);target.closePath();target.strokeStyle=face.cap?'#b39a70':'#342b20';target.lineWidth=.6;target.stroke();
 }
 const fragments=faces.flatMap((face,faceIndex)=>api.faceLightFragments?api.faceLightFragments(face,HEX_W,HEX_ROW).map(f=>({...f,faceIndex,screen:f.points.map(p=>screenPointForWorld(p,p.elevation))})):[face]);
 const entry={key,layer,left,top,anchor,faces,fragments};cache.set(cacheOwner,entry);
 presentExplorationSolids(entry,left,top,visible);
}
function explorationTorchAnimation(torch,now=null){
 const api=explorationEncounterApi;if(!api?.torchAnimation)return {intensity:1,height:1,width:1,swayX:0,swayZ:0};
 const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 return api.torchAnimation(now??(typeof performance!=='undefined'?performance.now():0),torch.seed||0,reduced);
}
function explorationRenderLights(){
 const frame=typeof combatLightingFrame==='number'?combatLightingFrame:null;
 if(frame!==null&&explorationRenderLights.frame===frame)return explorationRenderLights.sources;
 const sources=(typeof illuminationSources==='function'?illuminationSources():[]).concat(typeof combatSpellEffectLights==='function'?combatSpellEffectLights():[]);
 explorationRenderLights.frame=frame;explorationRenderLights.sources=sources;return sources;
}
function explorationFloorFragments(tiles){
 const api=explorationEncounterApi;
 if(!api?.floorFragmentIndex||!explorationTerrain?.spaces)return tiles.map(tile=>({point:tile,hex:tile,screen:hexScreenVertices(tile.x,tile.y)}));
 if(explorationFloorFragments.terrain!==explorationTerrain){explorationFloorFragments.terrain=explorationTerrain;explorationFloorFragments.index=api.floorFragmentIndex(explorationTerrain.spaces,HEX_W,HEX_ROW);}
 if(explorationFloorFragments.tiles===tiles)return explorationFloorFragments.projected;
 explorationFloorFragments.tiles=tiles;return explorationFloorFragments.projected=tiles.flatMap(tile=>explorationFloorFragments.index(tile).map(f=>({...f,screen:f.polygon.map(p=>screenPointForWorld(p))})));
}
function explorationFriendlyDistance(point){
 const observers=typeof friendlyVisibilityObservers==='function'?friendlyVisibilityObservers():[game?.player].filter(u=>u?.alive&&!u.fled);
 return observers.length?Math.min(...observers.map(u=>hexDistance(u,point))):0;
}
function explorationVisibilityAtHex(point,sources=null,distancePoint=point){
 const api=explorationEncounterApi;if(!api?.tileDistanceVisibility)return 1;
 const distance=explorationFriendlyDistance(distancePoint);if(distance<api.DISTANCE_VISIBILITY.startHex)return 1;
 const p=explorationTerrain.cellAt(point.x,point.y),ambient=api.ambientLightAt(explorationEncounter.map,p.x,p.z);if(ambient>=100)return 1;
 let light=0;for(const source of sources||explorationRenderLights())light+=illuminationContributionFromSource(source,point.x,point.y)*(source.sourceKind==='torch'?explorationTorchAnimation(source).intensity:1);
 return api.tileDistanceVisibility(distance,ambient,light);
}
function presentExplorationSolids(entry,x,y,visible){
 let layer=entry.layer;
 if(visible){
  const sources=explorationRenderLights(),torches=explorationTerrain.torches||[];
  const shades=(entry.fragments||entry.faces).map(face=>{
   const n=face.points.length,p=face.points.reduce((a,b)=>({x:a.x+b.x/n,y:a.y+b.y/n}),{x:0,y:0}),hex=face.point||{x:p.x/HEX_W-p.y/(2*HEX_ROW),y:p.y/HEX_ROW};
   const visibility=explorationVisibilityAtHex(hex,sources,face.hex||hex);let flicker=0;
   for(const torch of torches){const distance=hexDistance(torch,hex);if(distance<=torch.radiusHexes&&illuminationContributionFromSource(torch,hex.x,hex.y)>0)flicker+=(explorationTorchAnimation(torch).intensity-1)*(1-distance/(torch.radiusHexes+.45));}
   const radiance=typeof explorationSpellRadianceAtHex==='function'?explorationSpellRadianceAtHex(hex,sources):[0,0,0];
   return {face,visibility,radiance,flicker:Math.max(-.15,Math.min(.15,flicker))};
  });
  if(shades.some(s=>s.visibility<1||Math.abs(s.flicker)>.001||s.radiance.some(v=>v>0))){
   layer=entry.present||(entry.present=document.createElement('canvas'));layer.width=entry.layer.width;layer.height=entry.layer.height;const t=layer.getContext('2d');t.drawImage(entry.layer,0,0);t.translate(-entry.left,-entry.top);
   if(explorationEncounterApi.wallLightBandRuns){
    for(const [faceIndex,face] of entry.faces.entries()){
     if(face.cap)continue;
     const group=shades.filter(s=>s.face.faceIndex===faceIndex);if(!group.length)continue;
     t.save();const p=face.screen;t.beginPath();t.moveTo(p[0].x,p[0].y);for(const q of p.slice(1))t.lineTo(q.x,q.y);t.closePath();t.clip();
     t.globalCompositeOperation='source-over';t.drawImage(entry.layer,entry.left,entry.top);
     const fragments=group.map(s=>s.face),multiply=group.map(s=>Array(3).fill(255*s.visibility*(s.flicker<0?1+s.flicker*.6:1))),add=group.map(s=>s.radiance.map((v,i)=>255*v+([255,172,70][i])*Math.max(0,s.flicker)*.2*s.visibility));
     drawExplorationFaceBands(t,face,fragments,multiply,'multiply');drawExplorationFaceBands(t,face,fragments,add,'lighter');t.restore();
    }
   }
   for(const shade of shades){
    if(explorationEncounterApi.wallLightBandRuns&&!shade.face.cap&&shade.face.faceIndex!==undefined)continue;
    t.save();const p=shade.face.screen;t.beginPath();t.moveTo(p[0].x,p[0].y);for(const q of p.slice(1))t.lineTo(q.x,q.y);t.closePath();t.clip();
    // Restore the cached surface under each face: overlapping front/back/cap
    // polygons must not multiply distance darkness more than once.
    t.globalCompositeOperation='source-over';t.drawImage(entry.layer,entry.left,entry.top);
    const darkness=1-shade.visibility;if(darkness>0){t.fillStyle=`rgba(0,0,0,${darkness})`;t.fillRect(entry.left,entry.top,layer.width,layer.height);}
    if(shade.flicker<0){t.fillStyle=`rgba(0,0,0,${-shade.flicker*.6})`;t.fillRect(entry.left,entry.top,layer.width,layer.height);}else if(shade.flicker>0){t.globalCompositeOperation='lighter';t.fillStyle=`rgba(255,172,70,${shade.flicker*.2*shade.visibility})`;t.fillRect(entry.left,entry.top,layer.width,layer.height);}
    if(shade.radiance.some(v=>v>0)){t.globalCompositeOperation='lighter';t.fillStyle=`rgb(${shade.radiance.map(v=>Math.round(Math.min(1,v)*255)).join(',')})`;t.fillRect(entry.left,entry.top,layer.width,layer.height);}
    t.restore();
   }
  }
 }
 if(!visible){
  // Darkness is a color treatment, not transparency: otherwise the floor
  // grid behind a solid rear wall is visible through the masonry.
  if(!entry.hidden){
   const hidden=entry.hidden=document.createElement('canvas');hidden.width=entry.layer.width;hidden.height=entry.layer.height;
   const t=hidden.getContext('2d');t.drawImage(entry.layer,0,0);t.globalCompositeOperation='source-atop';t.fillStyle='rgba(0,0,0,.9)';t.fillRect(0,0,hidden.width,hidden.height);
  }layer=entry.hidden;
 }
 ctx.save();ctx.globalAlpha=1;ctx.drawImage(layer,x,y);ctx.restore();
}
function explorationSpellRadianceAtHex(point,sources=null){
 const api=explorationEncounterApi;if(!api?.spellSurfaceRadiance)return [0,0,0];
 return api.spellSurfaceRadiance(point,sources||explorationRenderLights(),(source,p)=>illuminationContributionFromSource(source,p.x,p.y));
}
// Clip each emitter continuously. A floor sliver remains lit even if its hex
// center is behind a wall; closed doors/windows use the production light mode.
function clipExplorationEmitter(source){
 if(game?.condition!=='wall'||typeof wallTestVisibilityPolygonWorld!=='function')return;
 const polygon=wallTestVisibilityPolygonWorld(source,'light');
 if(polygon?.length&&tracePolygonOnContext(ctx,polygon.map(p=>screenPointForWorld(p))))ctx.clip();
}
function explorationUnblockedContribution(source,point){
 const distance=hexDistance(source,point),radius=Math.max(1,source.radiusHexes||1);
 if(distance>radius||typeof hasObscuringMagicAtHex==='function'&&hasObscuringMagicAtHex(point.x,point.y))return 0;
 return Math.max(0,source.intensity||0)*(1-Math.min(1,distance/(radius+.45))**2);
}
function drawExplorationSpellLighting(tiles){
 if(!explorationTerrain||!explorationEncounterApi?.spellSurfaceRadiance)return;
 const sources=explorationRenderLights().filter(s=>s.sourceKind!=='torch');if(!sources.length)return;
 const fragments=explorationFloorFragments(tiles);
 ctx.save();ctx.globalCompositeOperation='lighter';
 for(const source of sources){
  ctx.save();clipExplorationEmitter(source);
  for(const fragment of fragments){
   const rgb=explorationEncounterApi.spellSurfaceRadiance(fragment.point,[source],(s,p)=>explorationUnblockedContribution(s,p));if(!rgb.some(v=>v>0))continue;
   if(tracePolygonOnContext(ctx,fragment.screen)){ctx.fillStyle=`rgb(${rgb.map(v=>Math.round(Math.min(1,v)*255)).join(',')})`;ctx.fill();}
  }ctx.restore();
 }ctx.restore();
}
function hasAnimatedExplorationTorches(){
 return !!(explorationTerrain&&(explorationTerrain.torches?.length||(game?.areaEffects||[]).some(e=>e.type==='flaming-sphere')))&&!(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
}
function drawExplorationWallPrism(wall){
 if(wall.doorLeaf)return; // The wooden solid owns the closed-door leaf artwork.
 const api=explorationEncounterApi,squash=explorationTerrain.cellH/explorationTerrain.cellW,depth=wall.thickness||3,height=wall.height||35,solids=[];
 const make=(a,b,h=height,bottom=0)=>solids.push(api.solidPrism(a,b,depth,h,bottom,squash));
 const window=(wall.openings||[]).find(o=>o.type==='window');
 if(window){
  const length=Math.hypot(wall.b.x-wall.a.x,wall.b.y-wall.a.y),lo=Math.max(0,window.centerT-window.widthWorld/length/2),hi=Math.min(1,window.centerT+window.widthWorld/length/2),at=t=>({x:wall.a.x+(wall.b.x-wall.a.x)*t,y:wall.a.y+(wall.b.y-wall.a.y)*t}),sill=window.visualSill||10,head=sill+(window.visualHeight||14);
  make(wall.a,at(lo));make(at(hi),wall.b);make(at(lo),at(hi),sill);make(at(lo),at(hi),height,head);
 }else for(const part of wallBlockingSubsegments(wall,'los'))make(part.a,part.b);
 drawExplorationSolids(solids,wall,isArchitecturalWallVisibleToFriendlyParty(wall));
 for(const torch of explorationTerrain.torches||[])if(torch.mountWallId===wall.id&&isHexVisibleToFriendlyParty((torch.visibilityHex||torch).x,(torch.visibilityHex||torch).y)){
  const mount=screenPointForWorld(torch.world),plate=screenPointForWorld(torch.wallPlaneWorld||torch.plateWorld);if(mount.y>=plate.y-.01)drawExplorationTorch(torch);
 }
}
function drawExplorationCombatDoor(door){
 const api=explorationEncounterApi,solid=api.combatDoorSolids(door,explorationTerrain,api.SCENE_STYLE),wall=explorationDoorWall(door);
 drawExplorationSolids([solid.leaf,solid.lintel],wall,isArchitecturalWallVisibleToFriendlyParty(wall),door);
}

function explorationDoorWall(door){
 const {center:c,axis}=door,t=explorationTerrain;
 return {id:door.wallId||`door-${door.x}-${door.z}`,edgeMaterial:door.material,a:axis==='x'?{x:c.x,y:c.y-t.cellH/2}:{x:c.x-t.cellW/2,y:c.y},b:axis==='x'?{x:c.x,y:c.y+t.cellH/2}:{x:c.x+t.cellW/2,y:c.y}};
}
function drawExplorationEdgeWindow(window){
 const style=explorationEncounterApi.SCENE_STYLE,height=style.window.height/style.wallMetres*35,sill=style.window.sill/style.wallMetres*35,span=(window.axis==='x'?explorationTerrain.cellH:explorationTerrain.cellW)*window.width;
 const a={x:window.center.x-(window.axis==='x'?0:span/2),y:window.center.y-(window.axis==='x'?span/2:0)},b={x:window.center.x+(window.axis==='x'?0:span/2),y:window.center.y+(window.axis==='x'?span/2:0)};
 const p=[screenPointForWorld(a,sill),screenPointForWorld(b,sill),screenPointForWorld(b,sill+height),screenPointForWorld(a,sill+height)];
 ctx.save();ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(const point of p.slice(1))ctx.lineTo(point.x,point.y);ctx.closePath();ctx.fillStyle='rgba(105,141,146,.28)';ctx.fill();ctx.strokeStyle='#493b2a';ctx.lineWidth=1.5;ctx.stroke();
 const low=screenPointForWorld(window.center,sill),high=screenPointForWorld(window.center,sill+height);ctx.beginPath();ctx.moveTo(low.x,low.y);ctx.lineTo(high.x,high.y);ctx.stroke();ctx.restore();
}
function queueExplorationDoors(actors){
 for(const window of explorationTerrain.windows||[])if(isArchitecturalWallVisibleToFriendlyParty(explorationDoorWall(window))){const c=screenPointForWorld(window.center);actors.push({sortY:c.y+.3,sortX:c.x,fn:()=>drawExplorationEdgeWindow(window)});}

 for(const door of explorationTerrain.doors||[]){
  const p=explorationEncounterApi.combatDoorSolids(door,explorationTerrain,explorationEncounterApi.SCENE_STYLE),a=screenPointForWorld(p.hinge),b=screenPointForWorld(p.end);
  actors.push({sortY:Math.max(a.y,b.y)+.3,sortX:(a.x+b.x)/2,fn:()=>drawExplorationCombatDoor(door)});
 }
}
function clipExplorationFloor(){
  ctx.beginPath();for(const space of architecturalSpaces){const points=space.polygon.map(p=>screenPointForWorld(p));ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();}ctx.clip();
}
function drawExplorationDarknessVolumes(){
  if(typeof r222DrawDarknessVolume!=='function')return;
  for(const effect of game.areaEffects||[])if(effect?.type==='darkness')r222DrawDarknessVolume(effect);
}
function drawExplorationVisibilityMask(){
  const observers=friendlyVisibilityObservers().map(observer=>({observer,context:observerVisibilityContext(observer)})).filter(e=>e.context);
  const mask=drawExplorationVisibilityMask.canvas||(drawExplorationVisibilityMask.canvas=document.createElement('canvas'));
  const v=battlefieldViewportBounds(),left=Math.floor(v.left)-2,top=Math.floor(v.top)-2,width=Math.ceil(v.right-left)+2,height=Math.ceil(v.bottom-top)+2;
  if(mask.width!==width||mask.height!==height){mask.width=width;mask.height=height;}
  const target=mask.getContext('2d');target.clearRect(0,0,mask.width,mask.height);target.globalCompositeOperation='source-over';target.fillStyle='rgba(8,8,12,0.90)';target.fillRect(0,0,mask.width,mask.height);
  target.save();target.translate(-left,-top);target.globalCompositeOperation='destination-out';target.fillStyle='#000';
  for(const entry of observers)if(tracePolygonOnContext(target,entry.context.polygon.map(point=>screenPointForWorld(point))))target.fill();
  // Obscuring spell volumes retain their tactical visibility behavior.
  if(hasActiveObscuringLosVolume()){
    target.globalCompositeOperation='source-over';target.fillStyle='#08080c';
    for(const tile of visibleHexes())if(observers.every(e=>obscuringVolumeBlocksLineBetweenHexes(e.observer,tile))&&tracePolygonOnContext(target,hexScreenVertices(tile.x,tile.y)))target.fill();
  }
  target.restore();target.globalCompositeOperation='source-over';ctx.drawImage(mask,left,top);
}
// A separate floor-only distance layer. Architecture/creature concealment stays in LOS.
function drawDistanceVisibilityLayer(tiles){
 if(!explorationTerrain||!explorationEncounterApi?.tileDistanceVisibility)return;
 const api=explorationEncounterApi,sources=explorationRenderLights();
 ctx.save();
 // Preserve the separate unseen-room presentation: fade only within party LOS.
 if(game.condition==='wall'){
  ctx.beginPath();for(const observer of friendlyVisibilityObservers()){
   const polygon=observerVisibilityContext(observer)?.polygon;if(!polygon?.length)continue;
   const points=polygon.map(p=>screenPointForWorld(p));ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();
  }ctx.clip();
 }
 for(const fragment of explorationFloorFragments(tiles)){
  const tile=fragment.point,distance=explorationFriendlyDistance(fragment.hex);if(distance<api.DISTANCE_VISIBILITY.startHex)continue;
  const p=explorationTerrain.cellAt(tile.x,tile.y),ambient=api.ambientLightAt(explorationEncounter.map,p.x,p.z);if(ambient>=100)continue;
  const visibility=explorationVisibilityAtHex(tile,sources,fragment.hex);if(visibility>=1)continue;
  if(tracePolygonOnContext(ctx,fragment.screen)){ctx.fillStyle=`rgba(0,0,0,${1-visibility})`;ctx.fill();}
 }
 ctx.restore();
}
// The perspective renderer and this canvas adapter read one authored lighting
// profile, including the party lantern, exact torch mounts and metre falloff.
function explorationVisualLights(){
  const api=explorationEncounterApi,cell=api.SCENE_STYLE.cellMetres,p=worldPointForHex(game.player.x,game.player.y),origin=explorationEncounter.origin;
  const party={x:(origin.x+p.x/explorationTerrain.cellW)*cell,z:(origin.z+p.y/explorationTerrain.cellH)*cell,facing:explorationEncounter.position?.facing||0};
  const lights=api.sceneLights(explorationEncounter.map,party).map((light,index)=>{
   if(light.kind!=='torch')return light;
   const torch=explorationTerrain.torches?.find(t=>t.sourceIndex===index);
   const position=torch?.lightPosition||api.combatTorchLightPlacement?.(light,explorationTerrain,api.SCENE_STYLE).point;
   return position?{...light,...position}:light;
  });

  return lights;
}
function explorationUnitSpriteBrightness(unit){
 const api=explorationEncounterApi;if(!explorationTerrain||!api?.spriteSurfaceBrightness)return 1;
 const world=worldPointForHex(unit.x,unit.y),cell=api.SCENE_STYLE.cellMetres;
 const point={x:(explorationEncounter.origin.x+world.x/explorationTerrain.cellW)*cell,y:0,z:(explorationEncounter.origin.z+world.y/explorationTerrain.cellH)*cell};
 const exposure=explorationSurfaceExposure(point,{x:0,y:1,z:0},explorationVisualLights(),new Set(explorationEncounter.openDoors));
 const sources=explorationRenderLights();
 return api.spriteSurfaceBrightness(exposure,explorationVisibilityAtHex(unit,sources),explorationSpellRadianceAtHex(unit,sources));
}
function explorationSurfaceExposure(point,normal,lights,opened){
  const api=explorationEncounterApi;
  return api.displayExposure(api.surfaceLight(point,normal,lights,(light,p)=>{
    if(typeof architecturalWallBlocksWorldLine==='function'){
      const toWorld=v=>({x:(v.x/api.SCENE_STYLE.cellMetres-explorationEncounter.origin.x)*explorationTerrain.cellW,y:(v.z/api.SCENE_STYLE.cellMetres-explorationEncounter.origin.z)*explorationTerrain.cellH});
      return !architecturalWallBlocksWorldLine(toWorld(light),toWorld(p),'light');
    }
    return api.sceneLightVisible(explorationEncounter.map,opened,light,p);
  },api.ambientForCell(explorationEncounter.map,Math.floor(point.x/api.SCENE_STYLE.cellMetres+.5),Math.floor(point.z/api.SCENE_STYLE.cellMetres+.5))));
}
function drawExplorationIlluminationLayer(){
  const lights=explorationVisualLights(),opened=new Set(explorationEncounter.openDoors),cell=explorationEncounterApi.SCENE_STYLE.cellMetres;
  const mapBounds=explorationTerrain.bounds;
  let b=mapBounds;
  if(explorationTerrain.edgeBased&&typeof camera!=='undefined'){
    // Bake exposure only around the viewport; distant architecture remains in
    // the rules map without allocating a full-map lighting bitmap.
    const v=battlefieldWorldViewport(),origin=explorationEncounter.origin;
    b={left:Math.max(mapBounds.left,Math.floor(origin.x+v.left/explorationTerrain.cellW)-1),right:Math.min(mapBounds.right,Math.ceil(origin.x+v.right/explorationTerrain.cellW)+1),top:Math.max(mapBounds.top,Math.floor(origin.z+v.top/explorationTerrain.cellH)-1),bottom:Math.min(mapBounds.bottom,Math.ceil(origin.z+v.bottom/explorationTerrain.cellH)+1)};
  }
  const left=(b.left-explorationEncounter.origin.x-.5)*explorationTerrain.cellW,top=(b.top-explorationEncounter.origin.z-.5)*explorationTerrain.cellH;
  const spanWidth=(b.right-b.left+1)*explorationTerrain.cellW,spanHeight=(b.bottom-b.top+1)*explorationTerrain.cellH,origin=screenPointForWorld({x:left,y:top});
  // Illumination varies smoothly; keep a bounded screen-space light map.
  // Material textures and architectural silhouettes retain their full detail.
  const sampleWorld=12/(typeof battlefieldZoom==='number'?battlefieldZoom:1);
  const width=Math.ceil(spanWidth/sampleWorld),height=Math.ceil(spanHeight/sampleWorld);
  const cacheKey=JSON.stringify([lights,left,top,width,height,explorationEncounter.scope,explorationEncounter.openDoors]);
  let cache=drawExplorationIlluminationLayer.cache;
  if(!cache||cache.key!==cacheKey){
    const layers=[document.createElement('canvas'),document.createElement('canvas')];for(const c of layers){c.width=width;c.height=height;}
    const contexts=layers.map(c=>c.getContext('2d')),images=contexts.map(c=>c.createImageData(width,height));
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const point={x:(explorationEncounter.origin.x+(left+(x+.5)*spanWidth/width)/explorationTerrain.cellW)*cell,y:0,
        z:(explorationEncounter.origin.z+(top+(y+.5)*spanHeight/height)/explorationTerrain.cellH)*cell};
      const value=explorationSurfaceExposure(point,{x:0,y:1,z:0},lights,opened),index=(y*width+x)*4;
      for(let i=0;i<3;i++){images[0].data[index+i]=value.multiply[i];images[1].data[index+i]=value.boost[i];}images[0].data[index+3]=images[1].data[index+3]=255;
    }
    contexts.forEach((c,i)=>c.putImageData(images[i],0,0));cache={key:cacheKey,layers};drawExplorationIlluminationLayer.cache=cache;
  }
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const u=battlefieldProjectVector({x:spanWidth,y:0}),v=battlefieldProjectVector({x:0,y:spanHeight});
  ctx.transform(u.x/width,u.y/width,v.x/height,v.y/height,origin.x,origin.y);
  ctx.globalCompositeOperation='multiply';ctx.drawImage(cache.layers[0],0,0);
  ctx.globalCompositeOperation='color-dodge';ctx.drawImage(cache.layers[1],0,0);ctx.restore();
}
function shadeExplorationWall(target,wall,height,thickness){
  const api=explorationEncounterApi,cell=api.SCENE_STYLE.cellMetres,lights=explorationVisualLights(),opened=new Set(explorationEncounter.openDoors);
  // Edge-on faces have no broad surface; keep their existing thin boundary.
  if(Math.abs(wall.b.x-wall.a.x)<Math.abs(wall.b.y-wall.a.y))return;
  const a=screenPointForWorld(wall.a),b=screenPointForWorld(wall.b);
  const key=JSON.stringify([lights,explorationEncounter.openDoors,height,explorationTerrain.cellW,explorationTerrain.cellH,explorationEncounter.origin]);
  const wallCache=shadeExplorationWall.cache||(shadeExplorationWall.cache=new WeakMap());
  let cached=wallCache.get(wall);if(!cached||cached.key!==key){cached={key,rows:[]};wallCache.set(wall,cached);}
  target.save();target.lineWidth=thickness;
  for(let y=0;y<height;y++){
    const gradients=[target.createLinearGradient(a.x,0,b.x,0),target.createLinearGradient(a.x,0,b.x,0)];
    for(const [sample,t] of [0,.5,1].entries()){
      const point={x:(explorationEncounter.origin.x+(wall.a.x+(wall.b.x-wall.a.x)*t)/explorationTerrain.cellW)*cell,
        z:(explorationEncounter.origin.z+(wall.a.y+(wall.b.y-wall.a.y)*t)/explorationTerrain.cellH)*cell+.02,y:y/height*api.SCENE_STYLE.wallMetres};
      const row=cached.rows[y]||(cached.rows[y]=[]);
      const value=row[sample]||(row[sample]=explorationSurfaceExposure(point,{x:0,y:0,z:1},lights,opened));
      gradients[0].addColorStop(t,`rgb(${value.multiply.join(',')})`);gradients[1].addColorStop(t,`rgb(${value.boost.join(',')})`);
    }
    for(const [i,mode] of ['multiply','color-dodge'].entries()){
      target.globalCompositeOperation=mode;target.fillStyle=gradients[i];target.fillRect(Math.min(a.x,b.x)-thickness/2,Math.floor(a.y-y-.5),Math.abs(b.x-a.x)+thickness,1);
    }
  }
  target.restore();
}
function drawExplorationTorchFloorGlow(tiles){
 if(!explorationTerrain?.torches?.length)return;
 ctx.save();
 for(const torch of explorationTerrain.torches){
  const a=explorationTorchAnimation(torch),c=screenPointForWorld(torch.lightWorld||torch.world),radius=HEX_W*(torch.radiusHexes||3);
  ctx.save();clipExplorationEmitter(torch);ctx.beginPath();let any=false;
  for(const fragment of explorationFloorFragments(tiles))if(hexDistance(torch,fragment.point)<torch.radiusHexes){const p=fragment.screen;ctx.moveTo(p[0].x,p[0].y);for(const q of p.slice(1))ctx.lineTo(q.x,q.y);ctx.closePath();any=true;}
  if(any){ctx.clip();const glow=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,radius);glow.addColorStop(0,`rgba(255,145,42,${.09*a.intensity})`);glow.addColorStop(1,'rgba(255,145,42,0)');ctx.globalCompositeOperation='lighter';ctx.fillStyle=glow;ctx.fillRect(c.x-radius,c.y-radius,radius*2,radius*2);}ctx.restore();
 }ctx.restore();
}
function drawExplorationTorch(torch){
 const api=explorationEncounterApi,style=api.SCENE_STYLE,scale=style.tacticalWallPixels/style.wallMetres,a=explorationTorchAnimation(torch),world=torch.world||worldPointForHex(torch.x,torch.y),mount=screenPointForWorld(world),top=screenPointForWorld(world,torch.elevation??style.torch.height*scale);
 ctx.save();
 if(torch.attached){
  const wall=torch.plateWorld,dx=torch.dx||0,dz=torch.dz||0,tangent={x:-dz*style.torch.plateWidth/style.cellMetres*explorationTerrain.cellW/2,y:dx*style.torch.plateWidth/style.cellMetres*explorationTerrain.cellH/2};
  const points=[screenPointForWorld({x:wall.x-tangent.x,y:wall.y-tangent.y},21.4),screenPointForWorld({x:wall.x+tangent.x,y:wall.y+tangent.y},21.4),screenPointForWorld({x:wall.x+tangent.x,y:wall.y+tangent.y},16.6),screenPointForWorld({x:wall.x-tangent.x,y:wall.y-tangent.y},16.6)];
  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();ctx.fillStyle='#312923';ctx.fill();ctx.strokeStyle='#75614b';ctx.lineWidth=1;ctx.stroke();
  const plate=screenPointForWorld(wall,17.5),arm=screenPointForWorld(world,17.5);ctx.strokeStyle='#352e26';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(plate.x,plate.y);ctx.lineTo(arm.x,arm.y);ctx.stroke();
 }else{ctx.strokeStyle='#382b1d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(mount.x,mount.y);ctx.lineTo(mount.x,mount.y-17.5);ctx.stroke();}
 ctx.strokeStyle='#34271b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(mount.x,mount.y-style.torch.stemBottom*scale);ctx.lineTo(mount.x,mount.y-(style.torch.stemBottom+style.torch.stemHeight)*scale);ctx.stroke();
 const cup=screenPointForWorld(world,21.7);ctx.fillStyle='#433628';ctx.beginPath();ctx.ellipse(cup.x,cup.y,style.torch.cupRadius*scale,1.2,0,0,Math.PI*2);ctx.fill();
 const sway=battlefieldProjectVector({x:a.swayX/style.cellMetres*explorationTerrain.cellW,y:a.swayZ/style.cellMetres*explorationTerrain.cellH}),x=top.x+sway.x,y=top.y,base=y+2;
 const glow=ctx.createRadialGradient(x,y,0,x,y,8*a.intensity);glow.addColorStop(0,'rgba(255,171,55,.45)');glow.addColorStop(1,'rgba(255,171,55,0)');ctx.fillStyle=glow;ctx.fillRect(x-10,y-10,20,20);
 ctx.fillStyle='#ff982d';ctx.beginPath();ctx.moveTo(top.x-1.8,base);ctx.quadraticCurveTo(x-3*a.width,y-1,x,y-4.2*a.height);ctx.quadraticCurveTo(x+3*a.width,y-1,top.x+1.8,base);ctx.fill();ctx.fillStyle='#fff0a3';ctx.beginPath();ctx.ellipse(top.x,base-1,.8,1.8*a.height,0,0,Math.PI*2);ctx.fill();ctx.restore();
}

function configureExplorationTerrain(){
  const request=explorationEncounter;
  explorationTerrain=explorationEncounterApi.terrainForEncounter(request.map,request.origin,new Set(request.openDoors),HEX_W,HEX_ROW);
  if(explorationTerrain.hexBounds){const b=explorationTerrain.hexBounds;MAP_MIN_X=b.minX;MAP_MAX_X=b.maxX;MAP_MIN_Y=b.minY;MAP_MAX_Y=b.maxY;}
  architecturalWalls=explorationTerrain.walls;
  architecturalSpaces=explorationTerrain.spaces;
  rebuildArchitecturalBlockedHexes();
  walls.clear();
  for(let x=MAP_MIN_X;x<=MAP_MAX_X;x++)for(let y=MAP_MIN_Y;y<=MAP_MAX_Y;y++)if(!explorationTerrain.walkableHex(x,y))walls.add(key(x,y));
  const floor=[];for(let x=MAP_MIN_X;x<=MAP_MAX_X;x++)for(let y=MAP_MIN_Y;y<=MAP_MAX_Y;y++)if(!isWall(x,y))floor.push({x,y,world:worldPointForHex(x,y)});
  explorationTerrain.torches=(request.map.torches||[]).flatMap((t,i)=>{
    const {bounds}=explorationTerrain;if(t.x<bounds.left||t.x>bounds.right||t.z<bounds.top||t.z>bounds.bottom)return [];
    const placement=explorationEncounterApi.torchPlacement(request.map,t),cell=explorationEncounterApi.SCENE_STYLE.cellMetres,world=explorationTerrain.project(placement.x/cell,placement.z/cell),wallPlaneWorld=explorationTerrain.project(placement.wallX/cell,placement.wallZ/cell),plateWorld={x:wallPlaneWorld.x-placement.dx*1.6,y:wallPlaneWorld.y-placement.dz*1.6*explorationTerrain.cellH/explorationTerrain.cellW},sourceWorld=explorationTerrain.project(t.x,t.z),nearest=floor.reduce((best,p)=>!best||Math.hypot(p.world.x-sourceWorld.x,p.world.y-sourceWorld.y)<Math.hypot(best.world.x-sourceWorld.x,best.world.y-sourceWorld.y)?p:best,null);
    if(!nearest||Math.hypot(nearest.world.x-world.x,nearest.world.y-world.y)>HEX_W)return [];
    const mountWall=placement.attached?architecturalWalls.find(w=>{const vx=w.b.x-w.a.x,vy=w.b.y-w.a.y,len=vx*vx+vy*vy,t=len?((wallPlaneWorld.x-w.a.x)*vx+(wallPlaneWorld.y-w.a.y)*vy)/len:-1;return t>=0&&t<=1&&Math.hypot(w.a.x+vx*t-wallPlaneWorld.x,w.a.y+vy*t-wallPlaneWorld.y)<.1;}):null;
    const light=explorationEncounterApi.combatTorchLightPlacement(placement,explorationTerrain,explorationEncounterApi.SCENE_STYLE,mountWall?.thickness||explorationEncounterApi.SCENE_STYLE.tacticalWallThickness,HEX_W,HEX_ROW);
    return [{sourceIndex:i,lightWorld:light.world,lightPosition:light.point,visibilityHex:{x:nearest.x,y:nearest.y},world,wallPlaneWorld,plateWorld,mountWallId:mountWall?.id,attached:placement.attached,dx:placement.dx,dz:placement.dz,seed:placement.seed,elevation:placement.y/explorationEncounterApi.SCENE_STYLE.wallMetres*35,id:'exploration-torch-'+i,sourceKind:'torch',sourceName:'Torch',x:light.hex.x,y:light.hex.y,radiusHexes:3,intensity:1.2,color:[255,166,77]}];
  });
}
function explorationUnits(){
  const request=explorationEncounter,saved=request.previous;
  const player=request.player?structuredClone(request.player):makeFighter();
  player.id='player';player.faction='player';player.controller='player';player.fled=false;
  if(player.hp<=0)throw Error('The exploration test character is defeated. Restart exploration to begin a fresh test.');
  const available=[];
  for(let x=MAP_MIN_X;x<=MAP_MAX_X;x++)for(let y=MAP_MIN_Y;y<=MAP_MAX_Y;y++)if(!isWall(x,y))available.push({x,y});
  const point=explorationTerrain.project(request.position.x,request.position.z);
  const distance=(pos,target)=>{const p=worldPointForHex(pos.x,pos.y);return Math.hypot(p.x-target.x,p.y-target.y);};
  const playerPosition=available.slice().sort((a,b)=>distance(a,point)-distance(b,point)).find(p=>occupiedHexesAt(player,p.x,p.y).every(c=>!isWall(c.x,c.y)));
  if(!playerPosition||distance(playerPosition,point)>HEX_W)throw Error('The party does not fit this terrain conversion. Widen the entrance in the editor.');
  Object.assign(player,playerPosition);
  const occupied=new Set(occupiedHexes(player).map(c=>key(c.x,c.y)));
  // Flood fill uses production wall-transition blocking, not just cell occupancy.
  const reached=new Set([key(player.x,player.y)]),queue=[playerPosition];
  for(let i=0;i<queue.length;i++)for(const [dx,dy] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]){
    const p={x:queue[i].x+dx,y:queue[i].y+dy},k=key(p.x,p.y);
    if(inside(p.x,p.y)&&!isWall(p.x,p.y)&&!reached.has(k)&&!architecturalWallBlocksStep(queue[i],p)){reached.add(k);queue.push(p);}
  }
  const spawn=explorationTerrain.project(request.event.spawnX,request.event.spawnZ);
  const enemies=saved?.enemies?structuredClone(saved.enemies):Array.from({length:request.event.count},(_,i)=>makeLibraryMob(request.event.mobId,i,{x:0,y:0}));
  enemies.forEach((enemy,i)=>{
    enemy.id=`exploration-enemy-${i}`;
    if(!saved){enemy.faction='enemy';enemy.controller='mob';}
    if(!enemy.alive||enemy.fled)return;
    const scaleRatio=(explorationTerrain.scale||1)/(saved?.terrainScale||1);
    const positions=saved?[{x:Math.round(enemy.x*scaleRatio),y:Math.round(enemy.y*scaleRatio)},...available]:available.slice().sort((a,b)=>distance(a,spawn)-distance(b,spawn));
    const p=positions.find(p=>reached.has(key(p.x,p.y))&&occupiedHexesAt(enemy,p.x,p.y,saved?enemy.facingHex:hexDirectionIndexToward(p,playerPosition)).every(c=>inside(c.x,c.y)&&!isWall(c.x,c.y)&&!occupied.has(key(c.x,c.y))));
    if(!p)throw Error('Not enough connected floor space for the encounter. Reduce its count or widen the room.');
    Object.assign(enemy,p);
    if(!saved){enemy.facingHex=hexDirectionIndexToward(p,playerPosition);enemy.facing=(playerPosition.x-enemy.x)+(playerPosition.y-enemy.y)*.5>=0?'right':'left';}
    occupiedHexes(enemy).forEach(c=>occupied.add(key(c.x,c.y)));
  });
  return {player,allies:[],enemies};
}
function rememberExplorationCombat(outcome){
  const request=explorationEncounter,storage=request.test?sessionStorage:localStorage;
  const progress=explorationEncounterApi.readProgress(storage,request.scope);
  // Combat unit records are plain game data; exclude visual caches/DOM objects.
  const snapshot=unit=>JSON.parse(JSON.stringify(unit,(k,v)=>typeof v==='function'||(typeof Node!=='undefined'&&v instanceof Node)?undefined:v));
  const next=explorationEncounterApi.recordOutcome(progress,request.event.id,outcome,snapshot(game.player),game.enemies.map(snapshot));
  next.encounters[request.event.id].origin=request.origin;
  next.encounters[request.event.id].terrainScale=explorationTerrain.scale;
  if(outcome==='victory')next.encounters[request.event.id].loot=collectLootFromSlainEnemies().items;
  storage.setItem(explorationEncounterApi.progressKey(request.scope),JSON.stringify(next));
}
function returnFromExplorationCombat(outcome){
  if(!explorationEncounter)return false;
  try{rememberExplorationCombat(outcome);}catch(error){setCombatMessage('Could not save encounter result: '+error.message);return true;}
  game.over=true;game.active=null;if(aiTimer)clearTimeout(aiTimer);
  const query=new URLSearchParams(explorationEncounter.returnSearch);
  const safe=new URLSearchParams();for(const name of ['test','map','entrance'])if(query.has(name))safe.set(name,query.get(name));safe.set('resumeEncounter','1');
  location.assign('exploration.html?'+safe);return true;
}
// Keep the launcher inaccessible throughout sprite loading and initialization.
async function startExplorationCombat(){
  if(new URLSearchParams(location.search).get('explorationCombat')!=='1')return;
  const panel=document.createElement('section');panel.id='explorationCombatStartup';panel.setAttribute('role','status');panel.style.cssText='position:fixed;inset:0;z-index:100000;background:#10101b;color:#83e7e8;display:grid;place-content:center;gap:20px;padding:30px;text-align:center';
  const heading=document.createElement('h1');heading.textContent='Preparing encounter';const status=document.createElement('p');status.textContent='Loading combat assets and restoring the map encounter…';
  const back=document.createElement('a');back.textContent='Return to exploration';back.href='exploration.html?resumeEncounter=1&v=R238C217';
  const retry=document.createElement('button');retry.textContent='Retry encounter';retry.hidden=true;retry.onclick=()=>{const url=new URL(location.href);url.searchParams.set('gameReload',String(Date.now()));location.replace(url.href);};
  panel.append(heading,status,back,retry);document.body.append(panel);
  const block=event=>{if(!panel.contains(event.target))event.stopImmediatePropagation();};window.addEventListener('keydown',block,true);
  try{
    await window.adventurePartyGameStartup.ready;
    explorationEncounterApi=await import('./exploration-encounters.mjs?v=R238C244');
    const request=JSON.parse(sessionStorage.getItem(explorationEncounterApi.HANDOFF_KEY)||'null');
    if(request){const query=new URLSearchParams(request.returnSearch),safe=new URLSearchParams();for(const name of ['test','map','entrance'])if(query.has(name))safe.set(name,query.get(name));safe.set('resumeEncounter','1');safe.set('v','R238C217');back.href='exploration.html?'+safe;}
    const {validateMap}=await import('./exploration-core.mjs?v=R238C238');
    if(!request?.map||!request.event)throw Error('No encounter handoff is available. Return to the map and enter the encounter again.');validateMap(request.map);
    const issues=explorationEncounterApi.validateEncounters({...request.map,encounters:[request.event]});if(issues.length)throw Error(issues.join(' '));
    if(!window.adventurePartyRepositoryMobs.canTest(request.event.mobId))throw Error('Encounter MOB is unavailable or has incomplete appearance data.');
    const saved=explorationEncounterApi.readProgress(request.test?sessionStorage:localStorage,request.scope);
    request.previous=saved.encounters[request.event.id]||request.previous;request.player=saved.player||request.player;
    explorationEncounter=request;explorationFloorImage.src='assets/textures/exploration/floor.png?v=R238C206';explorationWallImage.src='assets/textures/exploration/wall.png?v=R238C206';
    explorationDoorImage.src='assets/textures/exploration/door.png?v=R238C206';
    await Promise.all([explorationFloorImage.decode(),explorationWallImage.decode(),explorationDoorImage.decode()]);
    selectedMobEncounter='custom';combatMobRoster.length=0;
    const retreat=document.createElement('button');retreat.textContent='Retreat to exploration';retreat.addEventListener('click',()=>returnFromExplorationCombat('retreat'));document.getElementById('returnButton').after(retreat);
    ui.restartButton.disabled=true;ui.restartButton.title='Return to exploration to preserve this encounter.';
    const result=await showCombat('wall');
    if(result===false)throw Error('Encounter startup was interrupted. Retry or return to exploration.');
    if(document.getElementById('turnBanner')?.textContent==='COMBAT INITIALIZATION ERROR')throw Error(document.getElementById('combatLog')?.textContent||'Combat initialization failed.');
    panel.remove();window.removeEventListener('keydown',block,true);
  }catch(error){console.error(error);heading.textContent='Encounter could not start';status.textContent=error.message;retry.hidden=false;}
}
void startExplorationCombat();

function explorationDoorOpeningAllowed(unit){
 return !!(explorationTerrain&&controlledUnitCanAct(unit)&&!combatAwaitingStart&&combatOpeningSpeechDone&&!aimMode&&!classReportOpen&&!characterSheetOpen&&!inventoryOpen&&!spellCastOverlayOpen&&!spellCastInProgress&&!sweepInProgress&&!mobGuardReactionInProgress&&!freeStrikeInProgress&&!isCombatActionPauseActive());
}
function explorationReachableDoors(unit){
 return unit&&explorationTerrain?explorationEncounterApi.doorsInReach(explorationTerrain,unit,(a,b)=>architecturalWallBlocksWorldLine(a,b,'movement')):[];
}
function explorationDoorOccupied(door){
 const wall=explorationDoorWall(door),width=door.width??1,c=door.center;
 const leaf={...wall,blocksMovement:true,a:{x:c.x+(wall.a.x-c.x)*width,y:c.y+(wall.a.y-c.y)*width},b:{x:c.x+(wall.b.x-c.x)*width,y:c.y+(wall.b.y-c.y)*width}};
 return [game.player,...(game.allies||[]),...(game.enemies||[])].filter(unit=>unit?.alive&&!unit.fled).some(unit=>occupiedHexes(unit).some(cell=>wallSegmentCutsHexInterior(leaf,cell.x,cell.y)));
}
function tryExplorationToggleDoor(){
 const unit=activePlayerControlledUnit();if(!explorationDoorOpeningAllowed(unit))return;
 const doors=explorationReachableDoors(unit);
 if(doors.length!==1){log(doors.length?'More than one door is in reach. Step closer to the door you want.':'No door is within reach.','system');return;}
 if(unit.turnMoves+1>unit.move){log('Opening or closing a door requires 1 movement point.','system');return;}
 const door=doors[0];if(door.open&&explorationDoorOccupied(door)){log('Cannot close the door: a unit occupies the doorway.','system');return;}
 const id=door.id||`${door.x},${door.z}`,opened=new Set(explorationEncounter.openDoors);if(door.open)opened.delete(id);else opened.add(id);
 const next=[...opened];
 try{sessionStorage.setItem(explorationEncounterApi.HANDOFF_KEY,JSON.stringify({...explorationEncounter,openDoors:next}));}
 catch(error){log('Could not save the door state: '+error.message,'system');return;}
 explorationEncounter.openDoors=next;unit.turnMoves++;
 if(!unit.fullMove&&unit.turnMoves>unit.halfMove){unit.fullMove=true;log('Door interaction passes the attack threshold; Full Move activates.','system');}
 configureExplorationTerrain();
 if(typeof r220ObserveVisibleTargetsForAllMobs==='function')r220ObserveVisibleTargetsForAllMobs();
 log(`${unit.name} ${door.open?'closes':'opens'} the door (1 movement point; ${unit.turnMoves}/${unit.fullMove?unit.move:unit.halfMove}).`,'system');
 refreshTurnBanner();updateUi();draw();
}
