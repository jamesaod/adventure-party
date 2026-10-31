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
  const origin=screenPointForWorld({x:0,y:0});
  pattern.setTransform(new DOMMatrix([m.floorWidth/tile.width,0,0,m.floorHeight/tile.height,origin.x-explorationTerrain.cellW/2,origin.y-explorationTerrain.cellH/2]));return pattern;
}
function explorationWallPattern(target,wall,height){
  const image=wall.edgeMaterial==='wood'?explorationDoorImage:explorationWallImage;
  if(!image.complete||!image.naturalWidth)return null;
  const m=explorationEncounterApi.materialMetrics(explorationTerrain,height),density=explorationMaterialDensity();
  const tile=explorationMaterialTile(image,m.wallWidth*density,m.wallHeight*density),pattern=target.createPattern(tile,'repeat');if(!pattern)return null;
  const origin=screenPointForWorld(wall.a),worldOrigin=screenPointForWorld({x:0,y:0});
  pattern.setTransform(new DOMMatrix([m.wallWidth/tile.width,0,0,m.wallHeight/tile.height,worldOrigin.x,origin.y-m.wallHeight]));return pattern;
}
function drawExplorationCombatDoor(door){
  const api=explorationEncounterApi,p=api.combatDoorPresentation(door,explorationTerrain),base=screenPointForWorld(p.base),density=explorationMaterialDensity();
  const tile=explorationMaterialTile(explorationDoorImage,p.width*density,p.height*density);if(!tile)return;
  const lights=explorationVisualLights(),cell=api.SCENE_STYLE.cellMetres;
  const observer=game.player?worldPointForHex(game.player.x,game.player.y):door.center;
  const side=Math.sign(door.axis==='x'?observer.x-door.center.x:observer.y-door.center.y)||1;
  const normal=door.axis==='x'?{x:side,y:0,z:0}:{x:0,y:0,z:side};
  const point={x:(explorationEncounter.origin.x+door.center.x/explorationTerrain.cellW)*cell+normal.x*.02,z:(explorationEncounter.origin.z+door.center.y/explorationTerrain.cellH)*cell+normal.z*.02,y:api.SCENE_STYLE.door.height/2};
  const exposure=explorationSurfaceExposure(point,normal,lights,new Set(explorationEncounter.openDoors));
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const wall=explorationDoorWall(door),frame=api.combatDoorFrame(door,explorationTerrain);
  // These are filled masonry surfaces, not an outline laid over the floor.
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.fillStyle=explorationWallPattern(ctx,wall,35)||'#8a775d';ctx.strokeStyle='#392c20';ctx.lineWidth=1;
  for(const polygon of frame.polygons){
    const points=polygon.map(point=>screenPointForWorld(point));ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    for(const point of points.slice(1))ctx.lineTo(point.x,point.y);ctx.closePath();ctx.fill();
    ctx.save();ctx.clip();
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),left=Math.min(...xs),top=Math.min(...ys);
    for(const [mode,color] of [['multiply',exposure.multiply],['color-dodge',exposure.boost]]){ctx.globalCompositeOperation=mode;ctx.fillStyle=`rgb(${color.join(',')})`;ctx.fillRect(left,top,Math.max(...xs)-left,Math.max(...ys)-top);}
    ctx.restore();ctx.stroke();
  }
  const a=screenPointForWorld(frame.a),b=screenPointForWorld(frame.b);
  ctx.strokeStyle='#b09a70';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  if(door.edgeId&&Math.abs(p.vx)<.001){ctx.strokeStyle='#855025';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(base.x,base.y-p.height/2);ctx.lineTo(base.x+p.vx,base.y+p.vy-p.height/2);ctx.stroke();ctx.restore();return;}
  ctx.transform(p.vx/p.width,p.vy/p.width,0,1,base.x,base.y-p.height);
  ctx.drawImage(tile,0,0,p.width,p.height);
  for(const [mode,color] of [['multiply',exposure.multiply],['color-dodge',exposure.boost]]){ctx.globalCompositeOperation=mode;ctx.fillStyle=`rgb(${color.join(',')})`;ctx.fillRect(0,0,p.width,p.height);}
  ctx.globalCompositeOperation='source-over';ctx.strokeStyle='#392c20';ctx.lineWidth=1.5;ctx.strokeRect(0,0,p.width,p.height);ctx.restore();
}
function explorationDoorWall(door){
 const {center:c,axis}=door,t=explorationTerrain;
 return {id:door.wallId||`door-${door.x}-${door.z}`,edgeMaterial:door.material,a:axis==='x'?{x:c.x,y:c.y-t.cellH/2}:{x:c.x-t.cellW/2,y:c.y},b:axis==='x'?{x:c.x,y:c.y+t.cellH/2}:{x:c.x+t.cellW/2,y:c.y}};
}
function drawExplorationEdgeWindow(window){
 const c=screenPointForWorld(window.center),style=explorationEncounterApi.SCENE_STYLE,width=18,height=style.window.height/style.wallMetres*35,sill=style.window.sill/style.wallMetres*35;
 ctx.save();ctx.transform(1,.3,0,1,c.x-width/2,c.y-sill-height);ctx.fillStyle='#698d92';ctx.globalAlpha=.85;ctx.fillRect(0,0,width,height);ctx.globalAlpha=1;ctx.strokeStyle='#493b2a';ctx.lineWidth=2;ctx.strokeRect(0,0,width,height);ctx.beginPath();ctx.moveTo(width/2,0);ctx.lineTo(width/2,height);ctx.moveTo(0,height/2);ctx.lineTo(width,height/2);ctx.stroke();ctx.restore();
}
function queueExplorationDoors(actors){
 for(const window of explorationTerrain.windows||[])if(window.axis==='x'&&isArchitecturalWallVisibleToFriendlyParty(explorationDoorWall(window))){const c=screenPointForWorld(window.center);actors.push({sortY:c.y+.3,sortX:c.x,fn:()=>drawExplorationEdgeWindow(window)});}

 for(const door of explorationTerrain.doors||[]){
  const wall=explorationDoorWall(door);if(!isArchitecturalWallVisibleToFriendlyParty(wall))continue;
  const p=explorationEncounterApi.combatDoorPresentation(door,explorationTerrain),base=screenPointForWorld(p.base);
  actors.push({sortY:Math.max(base.y,base.y+p.vy)+.3,sortX:base.x+p.vx/2,fn:()=>drawExplorationCombatDoor(door)});
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
  if(mask.width!==BATTLEFIELD_LOGICAL_WIDTH||mask.height!==BATTLEFIELD_LOGICAL_HEIGHT){mask.width=BATTLEFIELD_LOGICAL_WIDTH;mask.height=BATTLEFIELD_LOGICAL_HEIGHT;}
  const target=mask.getContext('2d');target.clearRect(0,0,mask.width,mask.height);target.globalCompositeOperation='source-over';target.fillStyle='#08080c';target.fillRect(0,0,mask.width,mask.height);
  target.globalCompositeOperation='destination-out';target.fillStyle='#000';
  for(const entry of observers)if(tracePolygonOnContext(target,entry.context.polygon.map(point=>screenPointForWorld(point))))target.fill();
  // Obscuring spell volumes retain their tactical visibility behavior.
  if(hasActiveObscuringLosVolume()){
    target.globalCompositeOperation='source-over';target.fillStyle='#08080c';
    for(const tile of visibleHexes())if(observers.every(e=>obscuringVolumeBlocksLineBetweenHexes(e.observer,tile))&&tracePolygonOnContext(target,hexScreenVertices(tile.x,tile.y)))target.fill();
  }
  target.globalCompositeOperation='source-over';ctx.drawImage(mask,0,0);
}
// The perspective renderer and this canvas adapter read one authored lighting
// profile, including the party lantern, exact torch mounts and metre falloff.
function explorationVisualLights(){
  const api=explorationEncounterApi,cell=api.SCENE_STYLE.cellMetres,p=worldPointForHex(game.player.x,game.player.y),origin=explorationEncounter.origin;
  const party={x:(origin.x+p.x/explorationTerrain.cellW)*cell,z:(origin.z+p.y/explorationTerrain.cellH)*cell,facing:explorationEncounter.position?.facing||0};
  const lights=api.sceneLights(explorationEncounter.map,party);
  for(const source of illuminationSources())if(source.sourceKind!=='torch'){
    const world=worldPointForHex(source.x,source.y),c=source.color||[255,244,188];
    lights.push({x:(origin.x+world.x/explorationTerrain.cellW)*cell,z:(origin.z+world.y/explorationTerrain.cellH)*cell,y:api.SCENE_STYLE.lantern.height,
      color:(c[0]<<16)|(c[1]<<8)|c[2],intensity:(source.intensity||1)*api.SCENE_STYLE.lantern.intensity,range:source.radiusHexes*HEX_W/explorationTerrain.cellW*cell,decay:api.SCENE_STYLE.lantern.decay});
  }
  return lights;
}
function explorationSurfaceExposure(point,normal,lights,opened){
  const api=explorationEncounterApi;
  return api.displayExposure(api.surfaceLight(point,normal,lights,(light,p)=>{
    if(typeof architecturalWallBlocksWorldLine==='function'){
      const toWorld=v=>({x:(v.x/api.SCENE_STYLE.cellMetres-explorationEncounter.origin.x)*explorationTerrain.cellW,y:(v.z/api.SCENE_STYLE.cellMetres-explorationEncounter.origin.z)*explorationTerrain.cellH});
      return !architecturalWallBlocksWorldLine(toWorld(light),toWorld(p),'light');
    }
    return api.sceneLightVisible(explorationEncounter.map,opened,light,p);
  }));
}
function drawExplorationIlluminationLayer(){
  const lights=explorationVisualLights(),opened=new Set(explorationEncounter.openDoors),cell=explorationEncounterApi.SCENE_STYLE.cellMetres,b=explorationTerrain.bounds;
  const left=(b.left-explorationEncounter.origin.x-.5)*explorationTerrain.cellW,top=(b.top-explorationEncounter.origin.z-.5)*explorationTerrain.cellH;
  const spanWidth=(b.right-b.left+1)*explorationTerrain.cellW,spanHeight=(b.bottom-b.top+1)*explorationTerrain.cellH,origin=screenPointForWorld({x:left,y:top});
  const width=Math.ceil(spanWidth/6),height=Math.ceil(spanHeight/6);
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
  ctx.globalCompositeOperation='multiply';ctx.drawImage(cache.layers[0],origin.x,origin.y,spanWidth,spanHeight);
  ctx.globalCompositeOperation='color-dodge';ctx.drawImage(cache.layers[1],origin.x,origin.y,spanWidth,spanHeight);ctx.restore();
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
function drawExplorationTorch(torch){
  const c=hexCenter(torch.x,torch.y);ctx.save();
  ctx.strokeStyle='#38251b';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(c.x,c.y-23);ctx.stroke();
  ctx.fillStyle='#ff9c31';ctx.beginPath();ctx.moveTo(c.x-4,c.y-22);ctx.quadraticCurveTo(c.x-6,c.y-28,c.x+1,c.y-34);ctx.quadraticCurveTo(c.x+6,c.y-25,c.x+4,c.y-22);ctx.fill();
  ctx.fillStyle='#ffe9a0';ctx.beginPath();ctx.ellipse(c.x,c.y-24,2,4,0,0,Math.PI*2);ctx.fill();ctx.restore();
}

function configureExplorationTerrain(){
  const request=explorationEncounter;
  explorationTerrain=explorationEncounterApi.terrainForEncounter(request.map,request.origin,new Set(request.openDoors),HEX_W,HEX_ROW);
  architecturalWalls=explorationTerrain.walls;
  architecturalSpaces=explorationTerrain.spaces;
  rebuildArchitecturalBlockedHexes();
  walls.clear();
  for(let x=MAP_MIN_X;x<=MAP_MAX_X;x++)for(let y=MAP_MIN_Y;y<=MAP_MAX_Y;y++)if(!explorationTerrain.walkableHex(x,y))walls.add(key(x,y));
  const floor=[];for(let x=MAP_MIN_X;x<=MAP_MAX_X;x++)for(let y=MAP_MIN_Y;y<=MAP_MAX_Y;y++)if(!isWall(x,y))floor.push({x,y,world:worldPointForHex(x,y)});
  explorationTerrain.torches=(request.map.torches||[]).flatMap((t,i)=>{
    const {bounds}=explorationTerrain;if(t.x<bounds.left||t.x>bounds.right||t.z<bounds.top||t.z>bounds.bottom)return [];
    const world=explorationTerrain.project(t.x,t.z),nearest=floor.reduce((best,p)=>!best||Math.hypot(p.world.x-world.x,p.world.y-world.y)<Math.hypot(best.world.x-world.x,best.world.y-world.y)?p:best,null);
    if(!nearest||Math.hypot(nearest.world.x-world.x,nearest.world.y-world.y)>HEX_W)return [];
    return [{id:'exploration-torch-'+i,sourceKind:'torch',sourceName:'Torch',x:nearest.x,y:nearest.y,radiusHexes:3,intensity:1.2,color:[255,166,77]}];
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
    const p=positions.find(p=>reached.has(key(p.x,p.y))&&occupiedHexesAt(enemy,p.x,p.y).every(c=>inside(c.x,c.y)&&!isWall(c.x,c.y)&&!occupied.has(key(c.x,c.y))));
    if(!p)throw Error('Not enough connected floor space for the encounter. Reduce its count or widen the room.');
    Object.assign(enemy,p);occupiedHexes(enemy).forEach(c=>occupied.add(key(c.x,c.y)));
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
    explorationEncounterApi=await import('./exploration-encounters.mjs?v=R238C231');
    const request=JSON.parse(sessionStorage.getItem(explorationEncounterApi.HANDOFF_KEY)||'null');
    if(request){const query=new URLSearchParams(request.returnSearch),safe=new URLSearchParams();for(const name of ['test','map','entrance'])if(query.has(name))safe.set(name,query.get(name));safe.set('resumeEncounter','1');safe.set('v','R238C217');back.href='exploration.html?'+safe;}
    const {validateMap}=await import('./exploration-core.mjs?v=R238C231');
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

let explorationDoorCrossingBusy=false;
function explorationDoorRoutes(unit){
  if(!unit||!explorationTerrain||!explorationEncounterApi)return [];
  return explorationEncounterApi.doorwayCrossings(explorationTerrain,unit,
    p=>canUnitStandAt(unit,p.x,p.y)&&!unitTransitionBlocked(unit,unit,p),
    (a,b)=>architecturalWallBlocksWorldLine(a,b,'movement'));
}
async function tryExplorationDoorCrossing(){
  if(explorationDoorCrossingBusy||aimMode||classReportOpen||characterSheetOpen||inventoryOpen||spellCastOverlayOpen||spellCastInProgress)return;
  const unit=activePlayerControlledUnit(),routes=explorationDoorRoutes(unit);
  if(!routes.length){log('No open doorway crossing is available here. Use Open Door [O] beside a closed doorway.','system');return;}
  if(routes.length!==1){log('More than one doorway is in reach. Step closer to the doorway you want.','system');return;}
  explorationDoorCrossingBusy=true;
  try{await tryPlayerMove(routes[0].to.x-unit.x,routes[0].to.y-unit.y,{doorCrossing:routes[0]});}
  finally{explorationDoorCrossingBusy=false;updateUi();}
}

function explorationDoorOpeningAllowed(unit){
 return !!(explorationTerrain&&controlledUnitCanAct(unit)&&!combatAwaitingStart&&combatOpeningSpeechDone&&!explorationDoorCrossingBusy&&!aimMode&&!classReportOpen&&!characterSheetOpen&&!inventoryOpen&&!spellCastOverlayOpen&&!spellCastInProgress&&!sweepInProgress&&!mobGuardReactionInProgress&&!freeStrikeInProgress&&!isCombatActionPauseActive());
}
function explorationClosedDoors(unit){
 return unit&&explorationTerrain?explorationEncounterApi.closedDoorsInReach(explorationTerrain,unit,(a,b)=>architecturalWallBlocksWorldLine(a,b,'movement')):[];
}
function tryExplorationOpenDoor(){
 const unit=activePlayerControlledUnit();if(!explorationDoorOpeningAllowed(unit))return;
 const doors=explorationClosedDoors(unit);
 if(doors.length!==1){log(doors.length?'More than one closed door is in reach. Step closer to the door you want.':'No closed door is within reach.','system');return;}
 if(unit.turnMoves+1>unit.move){log('Opening a door requires 1 movement point.','system');return;}
 const door=doors[0],id=door.id||`${door.x},${door.z}`,opened=[...new Set([...explorationEncounter.openDoors,id])];
 // Save before altering rules state so storage failure cannot silently lose it.
 try{sessionStorage.setItem(explorationEncounterApi.HANDOFF_KEY,JSON.stringify({...explorationEncounter,openDoors:opened}));}
 catch(error){log('Could not save the opened door: '+error.message,'system');return;}
 explorationEncounter.openDoors=opened;
 unit.turnMoves++;
 if(!unit.fullMove&&unit.turnMoves>unit.halfMove){unit.fullMove=true;log('Opening the door passes the attack threshold; Full Move activates.','system');}
 configureExplorationTerrain();
 if(typeof r220ObserveVisibleTargetsForAllMobs==='function')r220ObserveVisibleTargetsForAllMobs();
 log(`${unit.name} opens the door (1 movement point; ${unit.turnMoves}/${unit.fullMove?unit.move:unit.halfMove}).`,'system');
 refreshTurnBanner();updateUi();draw();
}
