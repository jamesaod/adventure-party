/* Combat owner: combat-environment-state.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

function initializeFirMovementObstacles(){
  if(game?.session?.source!=='combat-test'||game.condition!=='grass')return;
  game.firSpawnClearance=new Set(allUnits().flatMap(unit=>occupiedHexes(unit)).map(cell=>key(cell.x,cell.y)));
  const tiles=[];
  for(let x=MAP_MIN_X;x<=MAP_MAX_X;x++)for(let y=MAP_MIN_Y;y<=MAP_MAX_Y;y++)if(inside(x,y))tiles.push({x,y});
  game.firBlockedHexes=new Set(visibleTreeDecorations(tiles).map(tree=>key(tree.x,tree.y)));
}

function addTerrainScorch(cells,strength=.75){
  if(!game)return;game.terrainScorch??={};let changed=false;
  for(const cell of cells){if(!inside(cell.x,cell.y))continue;const id=key(cell.x,cell.y),old=game.terrainScorch[id];
    if(!old||old.strength<strength){game.terrainScorch[id]={x:cell.x,y:cell.y,strength};changed=true;}}
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
    game.firFireStates[id]={x:cell.x,y:cell.y,state:'burning',burnUntilRound:game.round+2};addTerrainScorch([cell],.85);}
  ensureTransientUnitFxLoop();
}

function advanceFirFires(){
  for(const fire of Object.values(game.firFireStates||{}))if(fire.state==='burning'){addTerrainScorch([fire],.95);if(game.round>=fire.burnUntilRound)fire.state='burnt';}
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
      intensity:.9*(.85+.15*Math.sin(time*(2+seed*3)+seed*Math.PI*2)),color};
  });
}

function isFirBlockedHex(x,y){return !!game?.firBlockedHexes?.has(key(x,y));}

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
