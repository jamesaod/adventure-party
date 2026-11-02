/* All launchers supply scenarios to one combat initializer and render pipeline. */
let combatSessionGeneration=0;
let combatSceneAssets=null;
async function prepareCombatSession(){
 await ensureCombatRenderer();
 if(!combatSceneAssets)combatSceneAssets=(async()=>{
  explorationEncounterApi=await import('./exploration-encounters.mjs?v=R238C259');
  const sources=[[explorationFloorImage,'assets/textures/exploration/floor.png?v=R238C206'],[explorationWallImage,'assets/textures/exploration/wall.png?v=R238C206'],[explorationDoorImage,'assets/textures/exploration/door.png?v=R238C206'],[explorationGrassImage,explorationEncounterApi.GRASS_TEXTURES.short+'?v=R238C246']];
  await Promise.all(sources.map(async([image,url])=>{if(!image.src)image.src=url;await image.decode();}));
 })().catch(error=>{combatSceneAssets=null;throw error;});
 await combatSceneAssets;
 if(studioSpriteLoading.state==='pending')await studioSpriteLoading.ready;
}
async function startCombatSession(scenario,{isCurrent=()=>true}={}){
 const generation=++combatSessionGeneration;
 await prepareCombatSession();
 if(generation!==combatSessionGeneration||!isCurrent())return false;
 newGame(scenario.condition||'grass',scenario);
 const combat=game;
 fitBattleCanvas();
 let timer;
 try{await Promise.race([waitForCombatUnitRenders(allUnits()),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Unit rendering timed out. Please retry.')),120000);})]);}
 finally{clearTimeout(timer);}
 if(generation!==combatSessionGeneration||game!==combat||!isCurrent())return false;
 if(scenario.autoStart)startRound();
 await presentCombatFrame();
 if(generation!==combatSessionGeneration||game!==combat||!isCurrent())return false;
 canvas.dataset.combatEntry=scenario.source;
 canvas.dataset.combatPipeline='shared';
 return combat;
}
// Renderer-only adapter for legacy test layouts. CPU walls, bounds, LOS and
// deployment remain authoritative; this does not replace their rules geometry.
function configureStandaloneCombatScene(condition){
 const cellW=HEX_W*2,cellH=HEX_ROW*2/(Math.sqrt(3)/2),project=(x,z)=>({x:x*cellW,y:z*cellH});
 const corners=[[MAP_MIN_X,MAP_MIN_Y],[MAP_MAX_X,MAP_MIN_Y],[MAP_MAX_X,MAP_MAX_Y],[MAP_MIN_X,MAP_MAX_Y]].map(([x,y])=>worldPointForHex(x,y));
 const bounds={left:Math.floor(Math.min(...corners.map(p=>p.x))/cellW)-1,right:Math.ceil(Math.max(...corners.map(p=>p.x))/cellW)+1,top:Math.floor(Math.min(...corners.map(p=>p.y))/cellH)-1,bottom:Math.ceil(Math.max(...corners.map(p=>p.y))/cellH)+1};
 const left=(bounds.left-.5)*cellW,right=(bounds.right+.5)*cellW,top=(bounds.top-.5)*cellH,bottom=(bounds.bottom+.5)*cellH,spaces=[];
 const rect=(l,t,r,b)=>{if(r>l&&b>t)spaces.push({polygon:[{x:l,y:t},{x:r,y:t},{x:r,y:b},{x:l,y:b}]});};
 if(condition==='wall'){
  const room=WALL_TEST_ROOM;
  rect(left,top,room.left,bottom);rect(room.right,top,right,bottom);rect(room.left,top,room.right,room.top);rect(room.left,room.bottom,room.right,bottom);rect(room.left,room.top,room.right,room.bottom);
 }else rect(left,top,right,bottom);
 combatSceneContext={synthetic:true,source:condition,origin:{x:0,z:0},openDoors:[],scope:'standalone:'+condition,map:{version:2,width:bounds.right-bounds.left+1,height:bounds.bottom-bounds.top+1,grid:[],torches:[]}};
 combatSceneTerrain={bounds,spaces,cellW,cellH,project,scale:2,torches:[],doors:[],windows:[],edgeBased:true,cellAt:(q,s)=>({x:Math.floor((q+s/2)/2+.5),z:Math.floor(s*HEX_ROW/cellH+.5)})};
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
