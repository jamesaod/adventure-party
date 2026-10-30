/* Loaded after the ordinary engine. Encounters reuse its units, turns and walls. */
let explorationCombatScenery=[];
const explorationFloorImage=new Image(),explorationWallImage=new Image();
const explorationMaterialTiles=new WeakMap();
function explorationMaterialTile(image){
  if(!image.complete||!image.naturalWidth)return null;
  if(explorationMaterialTiles.has(image))return explorationMaterialTiles.get(image);
  // Prefilter once before the pixel-art battlefield samples a small repeat.
  // Progressive reduction removes high-frequency grain instead of aliasing it.
  let tile=image,width=image.naturalWidth,height=image.naturalHeight;
  while(width>64||height>64){
    const next=document.createElement('canvas');next.width=Math.max(64,Math.ceil(width/2));next.height=Math.max(64,Math.ceil(height/2));
    const target=next.getContext('2d');target.imageSmoothingEnabled=true;target.imageSmoothingQuality='high';target.drawImage(tile,0,0,next.width,next.height);
    tile=next;width=next.width;height=next.height;
  }
  explorationMaterialTiles.set(image,tile);return tile;
}
// Material helpers extend the shared architectural renderer; gameplay uses its
// existing walls, movement, LOS, lights and depth ordering.
function explorationFloorPatternForView(){
  if(!explorationFloorImage.complete||!explorationFloorImage.naturalWidth)return null;
  const tile=explorationMaterialTile(explorationFloorImage),pattern=ctx.createPattern(tile,'repeat');if(!pattern)return null;
  const origin=screenPointForWorld({x:0,y:0});
  pattern.setTransform(new DOMMatrix([explorationTerrain.cellW/tile.width,0,0,explorationTerrain.cellH/tile.height,origin.x-explorationTerrain.cellW/2,origin.y-explorationTerrain.cellH/2]));return pattern;
}
function explorationWallPattern(target,wall,height){
  if(!explorationWallImage.complete||!explorationWallImage.naturalWidth)return null;
  const tile=explorationMaterialTile(explorationWallImage),pattern=target.createPattern(tile,'repeat');if(!pattern)return null;
  const origin=screenPointForWorld(wall.a);
  pattern.setTransform(new DOMMatrix([explorationTerrain.cellW/tile.width,0,0,height/tile.height,origin.x,origin.y-height]));return pattern;
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
  if(!observers.length)return;
  const mask=drawExplorationVisibilityMask.canvas||(drawExplorationVisibilityMask.canvas=document.createElement('canvas'));
  if(mask.width!==BATTLEFIELD_LOGICAL_WIDTH||mask.height!==BATTLEFIELD_LOGICAL_HEIGHT){mask.width=BATTLEFIELD_LOGICAL_WIDTH;mask.height=BATTLEFIELD_LOGICAL_HEIGHT;}
  const target=mask.getContext('2d');target.clearRect(0,0,mask.width,mask.height);target.globalCompositeOperation='source-over';target.fillStyle='rgba(0,0,0,0.33)';target.fillRect(0,0,mask.width,mask.height);
  target.globalCompositeOperation='destination-out';target.fillStyle='#000';
  for(const entry of observers)if(tracePolygonOnContext(target,entry.context.polygon.map(screenPointForWorld)))target.fill();
  // Obscuring spell volumes retain their tactical visibility behavior.
  if(hasActiveObscuringLosVolume()){
    target.globalCompositeOperation='source-over';target.fillStyle='rgba(0,0,0,0.33)';
    for(const tile of visibleHexes())if(observers.every(e=>obscuringVolumeBlocksLineBetweenHexes(e.observer,tile))&&tracePolygonOnContext(target,hexScreenVertices(tile.x,tile.y)))target.fill();
  }
  target.globalCompositeOperation='source-over';ctx.drawImage(mask,0,0);
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
    const positions=saved?[{x:enemy.x,y:enemy.y},...available]:available.slice().sort((a,b)=>distance(a,spawn)-distance(b,spawn));
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
    explorationEncounterApi=await import('./exploration-encounters.mjs?v=R238C217');
    const request=JSON.parse(sessionStorage.getItem(explorationEncounterApi.HANDOFF_KEY)||'null');
    if(request){const query=new URLSearchParams(request.returnSearch),safe=new URLSearchParams();for(const name of ['test','map','entrance'])if(query.has(name))safe.set(name,query.get(name));safe.set('resumeEncounter','1');safe.set('v','R238C217');back.href='exploration.html?'+safe;}
    const {validateMap}=await import('./exploration-core.mjs?v=R238C211');
    if(!request?.map||!request.event)throw Error('No encounter handoff is available. Return to the map and enter the encounter again.');validateMap(request.map);
    const issues=explorationEncounterApi.validateEncounters({...request.map,encounters:[request.event]});if(issues.length)throw Error(issues.join(' '));
    if(!window.adventurePartyRepositoryMobs.canTest(request.event.mobId))throw Error('Encounter MOB is unavailable or has incomplete appearance data.');
    const saved=explorationEncounterApi.readProgress(request.test?sessionStorage:localStorage,request.scope);
    request.previous=saved.encounters[request.event.id]||request.previous;request.player=saved.player||request.player;
    explorationEncounter=request;explorationFloorImage.src='assets/textures/exploration/floor.png?v=R238C206';explorationWallImage.src='assets/textures/exploration/wall.png?v=R238C206';
    await Promise.all([explorationFloorImage.decode(),explorationWallImage.decode()]);
    const sceneryModule=await import('./exploration-combat-scenery.mjs?v=R238C216');
    const terrain=explorationEncounterApi.terrainForEncounter(request.map,request.origin,new Set(request.openDoors));
    explorationCombatScenery=await sceneryModule.createCombatScenery(request.map,terrain,new Set(request.openDoors));
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
