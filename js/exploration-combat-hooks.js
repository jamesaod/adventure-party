/* Loaded after the ordinary engine. Encounters reuse its units, turns and walls. */
const explorationFloorImage=new Image();

function configureExplorationTerrain(){
  const request=explorationEncounter;
  explorationTerrain=explorationEncounterApi.terrainForEncounter(request.map,request.origin,new Set(request.openDoors),HEX_W,HEX_ROW);
  architecturalWalls=explorationTerrain.walls;
  architecturalSpaces=explorationTerrain.spaces;
  rebuildArchitecturalBlockedHexes();
  walls.clear();
  for(let x=MAP_MIN_X;x<=MAP_MAX_X;x++)for(let y=MAP_MIN_Y;y<=MAP_MAX_Y;y++)if(!explorationTerrain.walkableHex(x,y))walls.add(key(x,y));
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
window.adventurePartyGameStartup?.ready.then(async()=>{
  if(new URLSearchParams(location.search).get('explorationCombat')!=='1')return;
  try{
    explorationEncounterApi=await import('./exploration-encounters.mjs?v=R238C210');
    const request=JSON.parse(sessionStorage.getItem(explorationEncounterApi.HANDOFF_KEY)||'null');
    const {validateMap}=await import('./exploration-core.mjs?v=R238C206');
    if(!request?.map||!request.event)throw Error('No exploration encounter is ready.');validateMap(request.map);
    const issues=explorationEncounterApi.validateEncounters({...request.map,encounters:[request.event]});if(issues.length)throw Error(issues.join(' '));
    if(!window.adventurePartyRepositoryMobs.canTest(request.event.mobId))throw Error('Encounter MOB is unavailable or has incomplete appearance data.');
    const saved=explorationEncounterApi.readProgress(request.test?sessionStorage:localStorage,request.scope);
    request.previous=saved.encounters[request.event.id]||request.previous;request.player=saved.player||request.player;
    explorationEncounter=request;explorationFloorImage.src='assets/textures/exploration/floor.png?v=R238C206';
    selectedMobEncounter='custom';combatMobRoster.length=0;
    const back=document.createElement('button');back.textContent='Retreat to exploration';back.addEventListener('click',()=>returnFromExplorationCombat('retreat'));document.getElementById('returnButton').after(back);
    ui.restartButton.disabled=true;ui.restartButton.title='Return to exploration to preserve this encounter.';
    await showCombat('wall');
  }catch(error){console.error(error);const errorPanel=document.createElement('p');errorPanel.textContent='Exploration combat could not start: '+error.message;const link=document.createElement('a');link.href='exploration.html?resumeEncounter=1';link.textContent=' Return to exploration';errorPanel.append(link);document.body.prepend(errorPanel);}
});
