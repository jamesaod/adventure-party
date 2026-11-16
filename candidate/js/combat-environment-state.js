// Heat is encounter state, measured in combat rounds rather than effect duration.
function warmCombatGround(cells){
 if(!game)return;game.groundHeat??={};
 for(const cell of cells){if(!inside(cell.x,cell.y))continue;const id=key(cell.x,cell.y);
  const old=game.groundHeat[id],wet=typeof combatGpu!=='undefined'&&(combatGpu?.snowAmount?.(cell.x,cell.y)||0)>0;
  game.groundHeat[id]={x:cell.x,y:cell.y,untilRound:(game.round||0)+3,steamUntil:wet?performance.now()+8000:old?.steamUntil||0};
 }
 ensureTransientUnitFxLoop();
}
function warmFirGround(fire){
 const cells=[];for(let x=fire.x-2;x<=fire.x+2;x++)for(let y=fire.y-2;y<=fire.y+2;y++)if(hexDistance(fire,{x,y})<=1)cells.push({x,y});
 warmCombatGround(cells);
}
function expireCombatGroundHeat(){
 for(const [id,heat] of Object.entries(game?.groundHeat||{}))if((game.round||0)>=heat.untilRound)delete game.groundHeat[id];
}
function combatGroundHeat(){return Object.values(game?.groundHeat||{}).filter(heat=>(game.round||0)<heat.untilRound);}
function updateGroundSteam(now=performance.now()){
 for(const heat of combatGroundHeat())if((combatGpu?.snowAmount?.(heat.x,heat.y)||0)>0)heat.steamUntil=now+8000;
}
function drawGroundSteam(){
 const now=performance.now();for(const heat of combatGroundHeat()){


  if(now>=heat.steamUntil||!isHexVisibleToFriendlyParty(heat.x,heat.y))continue;
  const p=hexCenter(heat.x,heat.y);
  combatGpu?.burnSmoke?.({x:p.x,y:p.y,width:HEX_W*.85,height:HEX_W*.7,age:now/1000,fade:Math.min(.45,(heat.steamUntil-now)/8000),seed:heat.x*7+heat.y*13,steam:true});
 }
}

/* Combat owner: combat-environment-state.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

function initializeFirMovementObstacles(){
  if(game?.session?.source!=='combat-test'||game.condition!=='grass')return;
  game.firSpawnClearance=new Set(allUnits().flatMap(unit=>occupiedHexes(unit)).map(cell=>key(cell.x,cell.y)));
  const tiles=[];
  for(let x=MAP_MIN_X;x<=MAP_MAX_X;x++)for(let y=MAP_MIN_Y;y<=MAP_MAX_Y;y++)if(inside(x,y))tiles.push({x,y});
  game.firDecorations=new Map(visibleTreeDecorations(tiles).map(tree=>[key(tree.x,tree.y),tree]));
  // Replace one existing dry, unoccupied tree near the party; keep its obstacle.
  const anchor=allUnits()[0]||{x:0,y:0};
  const candidates=[...game.firDecorations.values()].filter(t=>hexDistance(t,anchor)>=4);
  candidates.sort((a,b)=>hexDistance(a,anchor)-hexDistance(b,anchor)||a.x-b.x||a.y-b.y);
  game.treeFalls=new Map();game.treeFallRevision=0;game.godTreeTool=false;canvas.style.cursor='';const godButton=document.getElementById('godTreeTool');if(godButton){godButton.textContent='GOD TOOL';godButton.setAttribute('aria-pressed','false');}const godStatus=document.getElementById('godTreeStatus');if(godStatus)godStatus.textContent='';
  const oak=candidates[0];const mapleSites=oak?tiles.filter(t=>hexDistance(t,oak)>=4&&hexDistance(t,oak)<=6&&allUnits().every(u=>hexDistance(t,u)>=3)&&(!combatSceneTerrain?.walkableHex||combatSceneTerrain.walkableHex(t.x,t.y))&&(!combatSceneTerrain?.isRenderableHex||combatSceneTerrain.isRenderableHex(t.x,t.y))&&(()=>{const p=worldPointForHex(t.x,t.y);return !combatGpu?.streamSample||combatGpu.streamSample(p.x,p.y).depth<.025;})()).sort((a,b)=>hexDistance(a,oak)-hexDistance(b,oak)||hexDistance(a,anchor)-hexDistance(b,anchor)||a.y-b.y||a.x-b.x):[];const maple=mapleSites[0];
  game.testTrees=[];if(oak){Object.assign(oak,{species:'white-oak',tileIndex:5});game.testTrees.push(oak);}if(maple){Object.assign(maple,{species:'sugar-maple',tileIndex:11});game.testTrees.push(maple);}
  // All catalog specimens coexist for side-by-side appearance and performance tests.
  for(const [catalogVariant,tileIndex] of [['tall',17],['broad',23],['beech',29],['birch',35]]){
   const sites=tiles.filter(t=>game.testTrees.every(other=>hexDistance(t,other)>=4)&&allUnits().every(u=>hexDistance(t,u)>=3)&&(!combatSceneTerrain?.walkableHex||combatSceneTerrain.walkableHex(t.x,t.y))&&(!combatSceneTerrain?.isRenderableHex||combatSceneTerrain.isRenderableHex(t.x,t.y))&&(()=>{const p=worldPointForHex(t.x,t.y);return !combatGpu?.streamSample||combatGpu.streamSample(p.x,p.y).depth<.025;})()).sort((a,b)=>hexDistance(a,anchor)-hexDistance(b,anchor)||hexDistance(a,oak)-hexDistance(b,oak)||a.y-b.y||a.x-b.x);
   if(sites[0])game.testTrees.push({...sites[0],species:catalogVariant==='birch'?'sweet-birch':catalogVariant==='beech'?'american-beech':'sugar-maple',catalogVariant,tileIndex});
  }
  const loaded=combatFirTrees?.loadedFamilyIds;
  if(loaded)game.testTrees=game.testTrees.filter(t=>loaded.includes(t.catalogVariant==='tall'?'sugar-maple-tall':t.catalogVariant==='broad'?'sugar-maple-broad':t.species));
  game.oakTestTree=game.testTrees.find(t=>t.species==='white-oak');game.mapleTestTree=game.testTrees.find(t=>t.tileIndex===11);game.oakFallTest=null;
  // Test-scene placement only: fir models and procedural placement remain preserved.
  game.firDecorations=new Map(game.testTrees.map(t=>[key(t.x,t.y),t]));
  game.firBlockedHexes=new Set(game.firDecorations.keys());
}

function addTerrainScorch(cells,strength=.75){
  if(typeof combatGpu!=="undefined")combatGpu?.meltSnow?.(cells,1);
  if(!game)return;game.terrainScorch??={};let changed=false;
  for(const cell of cells){if(!inside(cell.x,cell.y))continue;const id=key(cell.x,cell.y),old=game.terrainScorch[id];
    if(!old||old.strength<strength){game.terrainScorch[id]={x:cell.x,y:cell.y,strength};changed=true;if(typeof queueBurnSmoke==="function")queueBurnSmoke(cell,false);}}
  if(changed){game.scorchRevision=(game.scorchRevision||0)+1;game.scorchCache=null;}
}

function scorchNoise(x,y,scale){
  const px=x/scale,py=y/scale,ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
  const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),rand=(a,b)=>terrainRand(a,b,5913);
  return (rand(ix,iy)*(1-u)+rand(ix+1,iy)*u)*(1-v)+(rand(ix,iy+1)*(1-u)+rand(ix+1,iy+1)*u)*v;
}

function igniteFirTrees(cells){
  if(!game?.firBlockedHexes)return;
  game.firFireStates??={};
  for(const cell of cells){const id=key(cell.x,cell.y);if(!game.firBlockedHexes.has(id)||game.firFireStates[id])continue;
    game.firFireStates[id]={x:cell.x,y:cell.y,state:'burning',burnUntilRound:game.round+2};warmFirGround(game.firFireStates[id]);addTerrainScorch([cell],.85);}
  ensureTransientUnitFxLoop();
}

function advanceFirFires(){
  for(const fire of Object.values(game.firFireStates||{}))if(fire.state==='burning'){warmFirGround(fire);addTerrainScorch([fire],.95);if(game.round>=fire.burnUntilRound)fire.state='burnt';}
  expireCombatGroundHeat();
}

function firFireLightSources(){
  const time=performance.now()/1000,palette=[[255,30,10],[255,225,65],[255,115,25]];
  return Object.values(game?.firFireStates||{}).filter(fire=>fire.state==='burning').map(fire=>{
    const seed=terrainRand(fire.x,fire.y,1291),weights=palette.map((_,i)=>{
      const phase=terrainRand(fire.x,fire.y,1292+i)*Math.PI*2,frequency=.8+terrainRand(fire.x,fire.y,1298+i)*2.4;
      return Math.pow(.5+.5*Math.sin(time*frequency+phase),2)+.02;
    }),total=weights.reduce((a,b)=>a+b,0);
    const color=[0,1,2].map(channel=>Math.round(palette.reduce((sum,rgb,i)=>sum+rgb[channel]*weights[i],0)/total));
    return {...fire,id:'fir-fire:'+key(fire.x,fire.y),sourceKind:'tree-fire',radiusHexes:4,
      intensity:3.6*(.85+.15*Math.sin(time*(2+seed*3)+seed*Math.PI*2)),color};
  });
}

function isFirBlockedHex(x,y){return !!game?.firBlockedHexes?.has(key(x,y))||treeFallEntries().some(({state})=>(oakDebrisSettled(state)?state.blockedHexes:state.reservedHexes)?.has(key(x,y)));}

function wallOpeningCenterT(wall,opening){
  if(!wall || !opening) return 0.5;

  if(
    opening.centerHex &&
    Number.isFinite(opening.centerHex.x) &&
    Number.isFinite(opening.centerHex.y)
  ){
    const point=worldPointForHex(
      opening.centerHex.x,
      opening.centerHex.y
    );
    const dx=wall.b.x-wall.a.x;
    const dy=wall.b.y-wall.a.y;
    const len2=(dx*dx)+(dy*dy);

    if(len2>0.000001){
      return Math.max(
        0,
        Math.min(
          1,
          (
            ((point.x-wall.a.x)*dx)+
            ((point.y-wall.a.y)*dy)
          )/len2
        )
      );
    }
  }

  return Math.max(
    0,
    Math.min(1,Number(opening.centerT)||0.5)
  );
}

function wallOpeningPassesMode(opening,mode){
  if(!opening) return false;

  if(opening.type==="doorway"){
    return true;
  }

  if(opening.type==="window"){
    /*
      R201: glass transmits sight and light, but does not transmit projectiles.
      Movement and physical volumetric propagation remain blocked as before.
    */
    return mode==="los" || mode==="light" || (opening.broken&&mode==="projectile");
  }

  return false;
}

function wallBlockingSubsegments(wall,mode="movement"){
  if(!wall) return [];
  if(mode==='movement'&&wall.doorwayJamb){
    const dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y,length=Math.hypot(dx,dy)||1,start=wall.doorwayTrimStart||0,end=wall.doorwayTrimEnd||0;
    wall={...wall,a:{x:wall.a.x+dx*start/length,y:wall.a.y+dy*start/length},b:{x:wall.b.x-dx*end/length,y:wall.b.y-dy*end/length}};
  }

  const sightLike=
    mode==="los" ||
    mode==="light" ||
    mode==="projectile";

  const blocks=
    sightLike
      ? wall.blocksLOS
      : mode==="volume"
        ? wall.blocksVolume!==false
        : wall.blocksMovement;

  if(!blocks) return [];

  const length=architecturalWallLength(wall);
  if(length<=0.0001) return [];

  const passIntervals=(wall.openings || [])
    .filter(opening=>wallOpeningPassesMode(opening,mode))
    .map(opening=>{
      const passWidth=
        opening.type==="window"
          ? Math.max(
              1,
              Number(opening.glassWidthWorld) ||
              Number(opening.widthWorld) ||
              1
            )
          : Math.max(1,Number(opening.widthWorld)||1);

      const half=passWidth/(2*length);
      const center=wallOpeningCenterT(wall,opening);

      return {
        start:Math.max(0,center-half),
        end:Math.min(1,center+half)
      };
    })
    .sort((a,b)=>a.start-b.start);

  if(!passIntervals.length) return [wall];

  const merged=[];
  for(const interval of passIntervals){
    const last=merged[merged.length-1];
    if(last && interval.start<=last.end){
      last.end=Math.max(last.end,interval.end);
    }else{
      merged.push({...interval});
    }
  }

  const segments=[];
  let cursor=0;

  for(const interval of merged){
    if(interval.start>cursor+0.0001){
      segments.push({
        ...wall,
        id:`${wall.id}:block:${mode}:${segments.length}`,
        parentWallId:wall.id,
        openings:[],
        a:architecturalWallPointAt(wall,cursor),
        b:architecturalWallPointAt(wall,interval.start)
      });
    }
    cursor=Math.max(cursor,interval.end);
  }

  if(cursor<1-0.0001){
    segments.push({
      ...wall,
      id:`${wall.id}:block:${mode}:${segments.length}`,
      parentWallId:wall.id,
      openings:[],
      a:architecturalWallPointAt(wall,cursor),
      b:architecturalWallPointAt(wall,1)
    });
  }

  return segments;
}

function wallSegmentCutsHexInterior(wall,x,y){
  if(!wall?.blocksMovement) return false;

  // Open door jambs use portal centerline clearance. Expanding their ends
  // into whole blocked hex cores can seal a narrow opening between hex rows.
  if(wall.doorwayJamb)return pointOnSegment(wall.a,wall.b,worldPointForHex(x,y));
  const vertices=architecturalHexCoreVertices(x,y);

  if(
    pointInConvexPolygon(wall.a,vertices) ||
    pointInConvexPolygon(wall.b,vertices)
  ){
    return true;
  }

  for(let i=0;i<vertices.length;i++){
    if(
      segmentsIntersect(
        wall.a,
        wall.b,
        vertices[i],
        vertices[(i+1)%vertices.length]
      )
    ){
      return true;
    }
  }

  return false;
}

function rebuildArchitecturalBlockedHexes(){
  if(typeof architecturalWallBlocksWorldLine==='function')architecturalWallBlocksWorldLine.cache=null;
  if(typeof wallTestVisibilityPolygonWorld==='function')wallTestVisibilityPolygonWorld.cache=null;
  architecturalBlockedHexes.clear();
  if(!architecturalWalls.length) return;

  // Each segment can intersect only nearby hex cores. Expanding the map
  // must not turn this into a full map-by-wall Cartesian scan.
  const radiusX=HEX_W/2*ARCHITECTURAL_HEX_CORE_SCALE,radiusY=HEX_H/2*ARCHITECTURAL_HEX_CORE_SCALE;
  for(const wall of architecturalWalls)for(const segment of wallBlockingSubsegments(wall,"movement")){
    const minWorldX=Math.min(segment.a.x,segment.b.x)-radiusX-0.001,maxWorldX=Math.max(segment.a.x,segment.b.x)+radiusX+0.001;
    const minRow=Math.max(MAP_MIN_Y,Math.ceil((Math.min(segment.a.y,segment.b.y)-radiusY-0.001)/HEX_ROW));
    const maxRow=Math.min(MAP_MAX_Y,Math.floor((Math.max(segment.a.y,segment.b.y)+radiusY+0.001)/HEX_ROW));
    for(let y=minRow;y<=maxRow;y++){
      const minX=Math.max(MAP_MIN_X,Math.ceil(minWorldX/HEX_W-y/2)),maxX=Math.min(MAP_MAX_X,Math.floor(maxWorldX/HEX_W-y/2));
      for(let x=minX;x<=maxX;x++)if(wallSegmentCutsHexInterior(segment,x,y))architecturalBlockedHexes.add(key(x,y));
    }
  }
}

function isArchitecturalBlockedHex(x,y){
  return architecturalBlockedHexes.has(key(x,y));
}

function architecturalWallBlocksWorldLine(a,b,mode="movement"){
  if(!architecturalWalls.length) return false;

  // Geometry is stable between terrain rebuilds. Index mode-specific blocking
  // segments once instead of allocating/scanning every wall for each light ray.
  let cache=architecturalWallBlocksWorldLine.cache;
  if(!cache||cache.walls!==architecturalWalls){cache={walls:architecturalWalls,modes:new Map()};architecturalWallBlocksWorldLine.cache=cache;}
  let index=cache.modes.get(mode);
  const size=128,epsilon=.0001;
  if(!index){
    index=new Map();cache.modes.set(mode,index);
    for(const wall of architecturalWalls)for(const segment of wallBlockingSubsegments(wall,mode)){
      const minX=Math.floor((Math.min(segment.a.x,segment.b.x)-epsilon)/size),maxX=Math.floor((Math.max(segment.a.x,segment.b.x)+epsilon)/size);
      const minY=Math.floor((Math.min(segment.a.y,segment.b.y)-epsilon)/size),maxY=Math.floor((Math.max(segment.a.y,segment.b.y)+epsilon)/size);
      for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){const key=x+','+y;let bucket=index.get(key);if(!bucket){bucket=[];index.set(key,bucket);}bucket.push(segment);}
    }
  }
  const minX=Math.floor((Math.min(a.x,b.x)-epsilon)/size),maxX=Math.floor((Math.max(a.x,b.x)+epsilon)/size),minY=Math.floor((Math.min(a.y,b.y)-epsilon)/size),maxY=Math.floor((Math.max(a.y,b.y)+epsilon)/size),seen=new Set();
  for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++)for(const segment of index.get(x+','+y)||[]){
    if(seen.has(segment))continue;seen.add(segment);if(segmentsIntersect(a,b,segment.a,segment.b))return true;
  }
  return false;
}

function architecturalWallBlocksStep(from,to){
  if(!from || !to || !architecturalWalls.length) return false;

  /* R122: a wall-bisected destination hex is never a legal standing space. */
  if(isArchitecturalBlockedHex(to.x,to.y)) return true;

  return architecturalWallBlocksWorldLine(
    worldPointForHex(from.x,from.y),
    worldPointForHex(to.x,to.y),
    "movement"
  );
}

function architecturalWallBlocksLOS(source,target){
  if(!source || !target || !architecturalWalls.length) return false;
  return architecturalWallBlocksWorldLine(
    worldPointForHex(source.x,source.y),
    worldPointForHex(target.x,target.y),
    "los"
  );
}

function burnWebCells(cells,sourceName="fire"){
  if(!game || !Array.isArray(cells) || !cells.length) return 0;
  const burnedKeys=new Set(cells.map(cell=>key(cell.x,cell.y)));
  let removedCells=0;

  for(const effect of webEffects()){
    const before=(effect.cells || []).length;
    effect.cells=(effect.cells || []).filter(cell=>!burnedKeys.has(key(cell.x,cell.y)));
    removedCells+=before-effect.cells.length;
  }

  game.areaEffects=(game.areaEffects || []).filter(effect=>
    effect.type!=="web" || (effect.cells || []).length>0
  );

  if(removedCells>0){
    for(const unit of allUnits()){
      if(
        getUnitEffect(unit,"webbed") &&
        !occupiedHexes(unit).some(cell=>webEffectAtHex(cell.x,cell.y))
      ){
        removeUnitEffect(unit,"webbed");
      }
    }
    log(`${sourceName} burns away ${removedCells} web hex${removedCells===1 ? "" : "es"}.`,"system");
    draw();
  }

  return removedCells;
}

function igniteWebAtUnit(unit,sourceName="fire"){
  if(!unit) return 0;
  return burnWebCells(occupiedHexes(unit),sourceName);
}

// Encounter-local arrow blood. Particle trajectories are fixed at impact; drops disappear on landing.
function combatBloodState(){return game.bloodState||(game.bloodState={bursts:[],stains:[],pools:[],revision:0,cache:null});}
function settleCombatBlood(now=performance.now()){
  if(!game?.bloodState)return false;const state=game.bloodState;
  // Clear ground marks from older live encounter state as well as new drops.
  state.stains.length=0;state.pools??=[];state.pools.length=0;state.cache=null;
  for(const burst of state.bursts)for(const drop of burst.drops){
    if(now>=burst.started+((drop.delay||0)+drop.duration)*1000)drop.settled=true;
  }
  state.bursts=state.bursts.filter(burst=>burst.drops.some(drop=>!drop.settled));
  return state.bursts.length>0;
}
function sampleArrowBloodOffset(){
  const direction=Math.random()*Math.PI*2;
  // Beta(1,3) radial distribution: p(r) falls quadratically to zero at 1.5 hexes.
  const radius=HEX_W*1.5*(1-Math.cbrt(1-Math.random()));
  return {x:Math.cos(direction)*radius,y:Math.sin(direction)*radius};
}
function corpseMotionProgress(unit,now=performance.now()){
  if(!Number.isFinite(unit?.deathPresentationStartedAt))return 0;
  const t=Math.max(0,Math.min(1,(now-unit.deathPresentationStartedAt)/(unit.deathAnimationDurationMs||1000)));
  return t*t*(3-2*t);
}
function corpsePresentationOffset(unit){
  const t=corpseMotionProgress(unit),offset=unit.deathWorldOffset||{x:0,y:0};
  return {x:offset.x*t,y:offset.y*t};
}
globalThis.adventurePartyCorpseProgress=corpseMotionProgress;
function sampleCorpseOffset(unit){
  const center=worldPointForHex(unit.x,unit.y),vertices=architecturalHexCoreVertices(unit.x,unit.y,1);
  for(let attempt=0;attempt<12;attempt++){
    const side=Math.floor(Math.random()*6),a=vertices[side],b=vertices[(side+1)%6],radius=.5*Math.sqrt(Math.random()),mix=Math.random();
    const offset={x:radius*((1-mix)*(a.x-center.x)+mix*(b.x-center.x)),y:radius*((1-mix)*(a.y-center.y)+mix*(b.y-center.y))};
    const end={x:center.x+offset.x,y:center.y+offset.y},hit=environmentRayHit(center,end),t=hit?Math.max(0,hit.t-.03):1;
    const point={x:center.x+offset.x*t,y:center.y+offset.y*t};
    if(combatSceneTerrain?.isRenderablePoint&&!combatSceneTerrain.isRenderablePoint(point))continue;
    return {x:offset.x*t,y:offset.y*t};
  }
  return {x:0,y:0};
}
function startArrowBlood(attacker,target,damage,{death=false}={}){
  if(!game||!(damage>0)||!attacker||!target||target.fireDeath)return;
  const state=combatBloodState(),origin=worldPointForHex(target.x,target.y),squash=environmentSquash();
  if(death&&target.deathWorldOffset){origin.x+=target.deathWorldOffset.x;origin.y+=target.deathWorldOffset.y;}
  const drops=[];
  settleCombatBlood();
  // Settle oldest bursts before recycling their bounded animation slots.
  if(state.bursts.length>=16)settleCombatBlood(Math.max(...state.bursts.map(b=>b.started+Math.max(...b.drops.map(d=>(d.delay||0)+d.duration))*1000+1)));
  for(let i=0,count=(8+Math.floor(Math.random()*5))*(death?4:1);i<count;i++){
    const offset=sampleArrowBloodOffset(),up=8+Math.random()*14,height=12,gravity=120;
    const duration=(up+Math.sqrt(up*up+2*gravity*height))/gravity;
    let end={x:origin.x+offset.x,y:origin.y+offset.y*squash};
    const wall=environmentRayHit(origin,end);if(wall){const t=Math.max(0,wall.t-.025);end={x:origin.x+(end.x-origin.x)*t,y:origin.y+(end.y-origin.y)*t};}
    const hex=environmentHex(end),lands=inside(hex.x,hex.y)&&(!combatSceneTerrain?.isRenderableHex||combatSceneTerrain.isRenderableHex(hex.x,hex.y));
    let ground='stone';if(combatSceneTerrain&&combatSceneContext){const t=combatSceneTerrain,c=combatSceneContext;ground=explorationEncounterApi.surfaceAt(c.map,{x:c.origin.x+end.x/t.cellW,z:c.origin.z+end.y/t.cellH}).ground;}
    drops.push({end,hex,lands,duration,delay:death?3*duration*i/(count-1):0,up,height,gravity,size:.65+Math.random()*.8,seed:Math.random(),ground,settled:false});
  }
  const started=performance.now();state.bursts.push({origin,hex:{x:target.x,y:target.y},started,drops});
  ensureTransientUnitFxLoop();draw();
}

// Presentation only: smoke never changes visibility or targeting rules.
function queueBurnSmoke(source,unit=false,started=performance.now()){
 if(!game)return;game.burnSmoke??=[];const id=unit?'unit:'+source.id:'ground:'+source.x+','+source.y;
 game.burnSmoke=game.burnSmoke.filter(fx=>performance.now()<fx.started+fx.duration&&fx.id!==id);
 game.burnSmoke.push({id,unitId:unit?source.id:null,x:source.x,y:source.y,started,duration:unit?6500:9000,seed:Math.random()*20});
 if(game.burnSmoke.length>48)game.burnSmoke.splice(0,game.burnSmoke.length-48);
 ensureTransientUnitFxLoop();
}
function drawBurnSmoke(){
 if(!game?.burnSmoke)return;const now=performance.now();game.burnSmoke=game.burnSmoke.filter(fx=>now<fx.started+fx.duration);
 for(const fx of game.burnSmoke){const t=(now-fx.started)/fx.duration;if(t<0)continue;const unit=fx.unitId?getUnitById(fx.unitId):null;
 if(fx.unitId&&(!unit||unit.fled||!shouldRenderUnitUnderPartyVisibility(unit)))continue;
 if(!unit&&!isHexVisibleToFriendlyParty(fx.x,fx.y))continue;
 const p=unit?unitFootprintScreenCenter(unit):hexCenter(fx.x,fx.y);
 combatGpu?.burnSmoke?.({x:p.x,y:p.y,width:unit?48:HEX_W,height:unit?85:HEX_W*1.2,age:(now-fx.started)/1000,fade:Math.min(1,t*5,(1-t)*3),seed:fx.seed});
 }
}

// Movement-only debris geometry. No changes to visual LOS or cover.
function oakPointSegmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/Math.max(1e-9,dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
function oakWorldPoint(cell){const p=worldPointForHex(cell.x,cell.y);return {x:p.x,y:p.y/.568329};}
function oakCapsuleHitsCell(capsules,cell){const p=oakWorldPoint(cell);return capsules.some(c=>oakPointSegmentDistance(p,c.a,c.b)<=c.radius+HEX_W*.28);}
function oakBlockedCells(capsules){const out=new Set();for(let x=MAP_MIN_X;x<=MAP_MAX_X;x++)for(let y=MAP_MIN_Y;y<=MAP_MAX_Y;y++)if(inside(x,y)&&oakCapsuleHitsCell(capsules,{x,y}))out.add(key(x,y));return out;}
function prepareOakFallNavigation(oak=game.oakTestTree){
 if(allUnits().some(u=>u.walkPresentation))return null;
 const tileSet=activeCombatTerrainTileSet(),scale=(tileSet.treeDrawHeight||240)/210,origin=oakWorldPoint(oak),sourceYaw=(terrainHash(oak.x+7901,oak.y-5107)%(tileSet.treeRotationFrames||1))*Math.PI/6;
 const occupied=allUnits().filter(u=>u.alive&&!u.fled).flatMap(occupiedHexes),order=[0,1,2,3,4,5];for(let i=5;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 for(const direction of order){const d=HEX_DIRS[direction],point=oakWorldPoint({x:oak.x+d.x,y:oak.y+d.y}),fallYaw=Math.atan2(point.x-origin.x,point.y-origin.y),delta=sourceYaw-fallYaw,c=Math.cos(fallYaw),s=Math.sin(fallYaw);
 const project=(x,z)=>({x:origin.x+(c*x+s*z)*scale,y:origin.y+(-s*x+c*z)*scale});
 const capsules=combatTreeCollision(oak.tileIndex,globalThis.adventurePartySeasons?.getSeason()||'summer',delta).capsules.map(p=>({piece:p.piece,a:project(p.ax,p.az),b:project(p.bx,p.bz),radius:p.radius*scale}));
 const extent=Math.max(...capsules.flatMap(p=>[Math.hypot(p.a.x-origin.x,p.a.y-origin.y),Math.hypot(p.b.x-origin.x,p.b.y-origin.y)]));
 const reservation=capsules.concat({piece:'fall-sweep',a:origin,b:project(0,extent/scale),radius:combatTreeCollision(oak.tileIndex,globalThis.adventurePartySeasons?.getSeason()||'summer',delta).canopyRadius*scale*.65});
 if(occupied.some(cell=>oakCapsuleHitsCell(reservation,cell)))continue;
 return {direction,fallYaw,localFallYaw:delta,obstacleCapsules:capsules,reservationCapsules:reservation,blockedHexes:oakBlockedCells(capsules),reservedHexes:oakBlockedCells(reservation)};
 }return null;
}
function oakDebrisBlocksStep(from,to){
 const capsules=treeFallEntries().flatMap(({state})=>(oakDebrisSettled(state)?state.obstacleCapsules:state.reservationCapsules)||[]);if(!capsules.length)return false;
 const a=oakWorldPoint(from),b=oakWorldPoint(to);
 function cross(p,q,r){return (q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);}
 return capsules.some(c=>{const u=cross(a,b,c.a),v=cross(a,b,c.b),w=cross(c.a,c.b,a),z=cross(c.a,c.b,b);const intersects=u*v<0&&w*z<0;
 const distance=intersects?0:Math.min(oakPointSegmentDistance(a,c.a,c.b),oakPointSegmentDistance(b,c.a,c.b),oakPointSegmentDistance(c.a,a,b),oakPointSegmentDistance(c.b,a,b));return distance<=c.radius+HEX_W*.23;});
}

function oakDebrisSettled(state){return !!state&&performance.now()-state.startedAt>=6000;}

function treeFallEntries(){if(game?.treeFalls)return [...game.treeFalls.values()];return game?.oakFallTest?[{tree:game.oakTestTree,state:game.oakFallTest}]:[];}
function treeFallFor(tree){return game?.treeFalls?.get(key(tree.x,tree.y))?.state||(game?.oakTestTree?.x===tree.x&&game?.oakTestTree?.y===tree.y?game.oakFallTest:null);}
function treeWoodPressure(){const entries=treeFallEntries().filter(({state})=>performance.now()-state.startedAt>=2600),signature=entries.map(({tree})=>key(tree.x,tree.y)).join('|');if(game.treeWoodSignature!==signature){game.treeWoodSignature=signature;game.treeWoodCapsules=entries.flatMap(({tree,state})=>state.obstacleCapsules.map(c=>({...c,fallGroup:key(tree.x,tree.y)})));}return {capsules:game.treeWoodCapsules||null,strength:entries.length?Math.max(...entries.map(({state})=>Math.min(1,(performance.now()-state.startedAt-2600)/1400))):0};}

// State updates run before presentation, including for offscreen trees.
function updateTreeEnvironment(now=performance.now()){
 for(const {tree,state} of treeFallEntries()){
  state.renderNow=now;state.settled=now-state.startedAt>=6000;
  state.leafWind??=Math.max(0,Math.min(1,globalThis.getWeatherSnapshot?.()?.amounts?.wind??0));
  const variant=combatFirTrees?.seasonalVariant(tree.tileIndex);
  if(variant!==undefined&&state.preparedVariant!==variant){
   state.leafDeposits=combatFirTrees.prepareFallState(tree.tileIndex,state);
   state.preparedVariant=variant;
  }
 }
}
