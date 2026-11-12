/* All launchers supply scenarios to one combat initializer and render pipeline. */
let combatSessionGeneration=0;
let combatSceneAssets=null;
let combatTestMapFactory=null;
let combatFirTrees=null;
let combatFirTreesLoading=null;
async function prepareCombatSession(){
 await ensureCombatRenderer();
 if(!combatSceneAssets)combatSceneAssets=(async()=>{
  explorationEncounterApi=await import('./exploration-encounters.mjs?v=R238C277');
  combatTestMapFactory=(await import('./combat-test-map.mjs?v=R238C280')).createCombatTestMap;
  // Combat floor detail is deliberately modest; preserve full-resolution source art.
  explorationFloorImage.combatTextureLimit=256;explorationGrassImage.combatTextureLimit=256;
  const sources=[[explorationFloorImage,'assets/textures/exploration/floor.png?v=R238C206'],[explorationWallImage,'assets/textures/exploration/wall.png?v=R238C206'],[explorationDoorImage,'assets/textures/exploration/door.png?v=R238C206'],[explorationGrassImage,explorationEncounterApi.GRASS_TEXTURES.short+'?v=R238C246'],[explorationWoodWallImage,explorationEncounterApi.WOOD_TEXTURES.wall+'?v=R238C274']];
  for(const [id,asset] of Object.entries(explorationEncounterApi.CITY_WALL_TEXTURES))sources.push([explorationCityWallImages[id],asset.src]);
  for(const [id,asset] of Object.entries(explorationEncounterApi.CITY_FLOOR_TEXTURES))sources.push([explorationCityFloorImages[id],asset.src]);
  await Promise.all(sources.map(async([image,url])=>{if(!image.src)image.src=url;await image.decode();}));
 })().catch(error=>{combatSceneAssets=null;throw error;});
 await combatSceneAssets;
 if(studioSpriteLoading.state==='pending')await studioSpriteLoading.ready;
}
async function startCombatSession(scenario,{isCurrent=()=>true}={}){
 const generation=++combatSessionGeneration;
 await prepareCombatSession();
 if(scenario.source==='combat-test' && scenario.condition==='grass'){
  if(!combatFirTreesLoading)combatFirTreesLoading=import('./combat-fir-trees.mjs?v=R238C329')
   .then(module=>module.createCombatFirTrees()).then(trees=>combatFirTrees=trees)
   .catch(error=>{combatFirTreesLoading=null;throw error;});
  await combatFirTreesLoading;
 }
 if(generation!==combatSessionGeneration||!isCurrent())return false;
 newGame(scenario.condition||'grass',scenario);
 initializeFirMovementObstacles();
 const combat=game;
 fitBattleCanvas();
 let timer,rejectStall;
 const heartbeat=()=>{if(timer!==undefined)clearTimeout(timer);timer=setTimeout(()=>rejectStall(Error('Unit rendering stopped making progress. Please retry.')),120000);};
 const stalled=new Promise((_,reject)=>{rejectStall=reject;heartbeat();});
 document.addEventListener('adventure-party:unit-render-progress',heartbeat);
 try{await Promise.race([waitForCombatUnitRenders(allUnits()),stalled]);}
 finally{clearTimeout(timer);document.removeEventListener('adventure-party:unit-render-progress',heartbeat);}
 if(generation!==combatSessionGeneration||game!==combat||!isCurrent())return false;
 if(scenario.autoStart)startRound();
 await presentCombatFrame();
 if(generation!==combatSessionGeneration||game!==combat||!isCurrent())return false;
 canvas.dataset.combatEntry=scenario.source;
 canvas.dataset.combatPipeline='shared';
 return combat;
}
// Combat Test and Previewer author maps, then use the exploration converter.
function configureStandaloneCombatScene(condition){
 const map=combatTestMapFactory(condition),origin={...map.start};
 const request={standalone:true,map,origin,position:origin,openDoors:map.doors.filter(d=>d.initialOpen).map(d=>d.id),scope:'combat-test:'+condition};
 configureCombatMap(request);

}
function combatRenderAmbientAtHex(point){
 if(combatSceneContext?.synthetic)return isIndoorWorldPoint(worldPointForHex(point.x,point.y))?0:100;
 const p=combatSceneTerrain.cellAt(point.x,point.y);return explorationEncounterApi.ambientLightAt(combatSceneContext.map,p.x,p.z);
}

function createCombatGame(condition,{player,allies,enemies},scenario={}){
 const groupKobolds=enemies.filter(isKoboldUnit);
 return {
    round:0,
    over:false,
    // Capture the encounter's route now; later setup selections cannot change it.
    studioSpriteTest:!!scenario.studioSpriteTest,
    session:{source:scenario.source||"combat-test",controlledActorId:scenario.controlledActorId||null,pauseAfterAction:!!scenario.pauseAfterAction,holdResults:!!scenario.holdResults},
    condition,
    player,
    partyStart:{x:player.x,y:player.y},
    allies,
    enemies,
    order:[],
    turnIndex:0,
    active:null,
    xpAwarded:false,
    xpPool:0,
    areaEffects:[],

    /*
      R136 Monstrous Manual Kobold morale applies only to the Kobold encounter.
      Large-MOB test encounters use per-unit morale and do not share this group
      state.
    */
    enemyGroupMorale:groupKobolds.length
      ? {
          id:"kobold-group",
          label:"Kobold group",
          baseMorale:groupKobolds[0]?.morale ?? 9,
          moraleLabel:"Average (8-10)",
          initialCount:groupKobolds.length,
          manualRatioThreshold:1.5,
          manualRatioChecked:false,
          broken:false,
          checks:0
        }
      : null
  };
}
