/* Combat owner: combat-visibility.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

function hexLineCells(a,b){
  const distance=hexDistance(a,b);
  if(distance<=0) return [{x:a.x,y:a.y}];

  const cells=[];

  for(let i=0;i<=distance;i++){
    const t=i/distance;
    cells.push(
      cubeRound(
        a.x+(b.x-a.x)*t,
        a.y+(b.y-a.y)*t
      )
    );
  }

  return cells.filter((cell,index,array)=>
    index===0 ||
    cell.x!==array[index-1].x ||
    cell.y!==array[index-1].y
  );
}

function lineOfSightBlockedBetweenHexes(source,target){
  if(architecturalWallBlocksLOS(source,target)){
    return true;
  }

  const cells=hexLineCells(source,target);

  return cells.some((cell,index)=>
    index>0 &&
    hasObscuringMagicAtHex(cell.x,cell.y)
  );
}

function lightBlockedBetweenHexes(source,target){
  if(!source || !target) return true;

  if(
    architecturalWallBlocksWorldLine(
      worldPointForHex(source.x,source.y),
      worldPointForHex(target.x,target.y),
      "light"
    )
  ){
    return true;
  }

  const cells=hexLineCells(source,target);
  return cells.some((cell,index)=>
    index>0 &&
    hasObscuringMagicAtHex(cell.x,cell.y)
  );
}

function lineOfSightBlocked(source,target){
  if(!source || !target) return false;

  if(
    source?.id &&
    target?.id &&
    !unitVisibleToObserver(source,target)
  ){
    return true;
  }

  const sourceCells=occupiedHexesAt(source,source.x,source.y);
  const targetCells=occupiedHexesAt(target,target.x,target.y);

  for(const sourceCell of sourceCells){
    for(const targetCell of targetCells){
      if(!lineOfSightBlockedBetweenHexes(sourceCell,targetCell)){
        return false;
      }
    }
  }

  return true;
}

function projectilePathBlockedBetweenHexes(source,target){
  if(!source || !target) return true;

  if(
    architecturalWallBlocksWorldLine(
      worldPointForHex(source.x,source.y),
      worldPointForHex(target.x,target.y),
      "projectile"
    )
  ){
    return true;
  }

  const cells=hexLineCells(source,target);
  return cells.some((cell,index)=>
    index>0 &&
    hasObscuringMagicAtHex(cell.x,cell.y)
  );
}

function projectilePathBlocked(source,target){
  if(!source || !target) return false;

  if(
    source?.id &&
    target?.id &&
    !unitVisibleToObserver(source,target)
  ){
    return true;
  }

  const sourceCells=occupiedHexesAt(source,source.x,source.y);
  const targetCells=occupiedHexesAt(target,target.x,target.y);

  for(const sourceCell of sourceCells){
    for(const targetCell of targetCells){
      if(!projectilePathBlockedBetweenHexes(sourceCell,targetCell)){
        return false;
      }
    }
  }

  return true;
}

function friendlyVisibilityObservers(){
  if(!game) return [];

  return [game.player,...(game.allies || [])]
    .filter(unit=>unit && unit.alive && !unit.fled);
}

function wallTestVisibilityObserver(){
  if(!game || game.condition!=="wall") return null;
  return friendlyVisibilityObservers()[0] || null;
}

function isFriendlyCombatUnit(unit){
  if(!unit || !game) return false;
  return unit.faction===game.player.faction;
}

function pointInSimplePolygon(point,vertices,eps=0.0001){
  if(!point || !Array.isArray(vertices) || vertices.length<3) return false;

  /*
    Visibility polygons are ordered angularly around the observer and can be
    concave. Use an even/odd point-in-polygon test rather than the convex-only
    helper used by architectural floor regions.
  */
  let inside=false;

  for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
    const a=vertices[j];
    const b=vertices[i];

    if(pointOnSegment(a,b,point,eps)){
      return true;
    }

    const crosses=
      ((a.y>point.y)!==(b.y>point.y)) &&
      (
        point.x <
        ((b.x-a.x)*(point.y-a.y))/((b.y-a.y)||Number.EPSILON)+a.x
      );

    if(crosses) inside=!inside;
  }

  return inside;
}

function observerVisibilityContext(observer){
  if(!observer || game?.condition!=="wall") return null;

  const polygon=wallTestVisibilityPolygonWorld(observer);
  if(polygon.length<3) return null;

  return {
    observer,
    origin:worldPointForHex(observer.x,observer.y),
    polygon
  };
}

function isHexCenterInsideObserverLosCone(observer,x,y,context=null){
  if(!observer || !inside(x,y)) return false;
  if(observer.x===x && observer.y===y) return true;

  const resolved=
    context?.observer===observer
      ? context
      : observerVisibilityContext(observer);

  if(!resolved?.polygon?.length) return false;

  return pointInSimplePolygon(
    worldPointForHex(x,y),
    resolved.polygon
  );
}

function visibilityWorldBounds(){
  const v=battlefieldWorldViewport(),margin=140,left=v.left-margin,right=v.right+margin,top=v.top-margin,bottom=v.bottom+margin;
  return {left,right,top,bottom,corners:[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}]};
}

function visibilitySegments(mode="los",fogPolygons=[]){
  const bounds=visibilityWorldBounds();
  const segments=[];

  for(const wall of architecturalWalls){
    for(const blocker of wallBlockingSubsegments(wall,mode)){
      const polygon=architecturalWallWorldVertices(blocker);
      for(const segment of wallPolygonSegments(polygon)){
        segments.push({
          ...segment,
          isWall:true,
          wallId:wall.id
        });
      }
    }
  }

  for(const polygon of fogPolygons)segments.push(...wallPolygonSegments(polygon));

  for(const segment of wallPolygonSegments(bounds.corners)){
    segments.push({...segment,isBoundary:true});
  }

  return {segments,bounds};
}

function cross2d(a,b){
  return (a.x*b.y)-(a.y*b.x);
}

function raySegmentIntersection(origin,angle,segment,direction=null){
  const r=direction||{x:Math.cos(angle),y:Math.sin(angle)};
  const s={x:segment.b.x-segment.a.x,y:segment.b.y-segment.a.y};
  const qp={x:segment.a.x-origin.x,y:segment.a.y-origin.y};
  const denom=cross2d(r,s);

  if(Math.abs(denom)<0.0000001) return null;

  const t=cross2d(qp,s)/denom;
  const u=cross2d(qp,r)/denom;

  if(t<0 || u<0 || u>1) return null;

  return {
    x:origin.x+(r.x*t),
    y:origin.y+(r.y*t),
    t,
    isWall:!!segment.isWall,
    wallId:segment.wallId || null,
    isBoundary:!!segment.isBoundary
  };
}

function castVisibilityRay(origin,angle,segments){
  // Walk only spatial buckets touched by the ray, stopping at the nearest hit.
  // The exact existing intersection resolver still decides every hit.
  const size=128,epsilon=.000001;
  const caches=castVisibilityRay.cache||(castVisibilityRay.cache=new WeakMap());
  let index=caches.get(segments);
  if(!index){
    index={cells:new Map(),left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};caches.set(segments,index);
    for(const segment of segments){
      const left=Math.min(segment.a.x,segment.b.x)-epsilon,right=Math.max(segment.a.x,segment.b.x)+epsilon,top=Math.min(segment.a.y,segment.b.y)-epsilon,bottom=Math.max(segment.a.y,segment.b.y)+epsilon;
      index.left=Math.min(index.left,left);index.right=Math.max(index.right,right);index.top=Math.min(index.top,top);index.bottom=Math.max(index.bottom,bottom);
      for(let x=Math.floor(left/size);x<=Math.floor(right/size);x++)for(let y=Math.floor(top/size);y<=Math.floor(bottom/size);y++){
        const key=x+','+y;let bucket=index.cells.get(key);if(!bucket){bucket=[];index.cells.set(key,bucket);}bucket.push(segment);
      }
    }
  }
  if(!segments.length)return null;
  const direction={x:Math.cos(angle),y:Math.sin(angle)};
  let enter=0,exit=Infinity;
  for(const [axis,min,max] of [['x',index.left,index.right],['y',index.top,index.bottom]]){
    const v=direction[axis],p=origin[axis];
    if(Math.abs(v)<1e-12){if(p<min||p>max)return null;continue;}
    const a=(min-p)/v,b=(max-p)/v;enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
  }
  if(exit<enter)return null;
  const sx=Math.abs(direction.x)<1e-12?0:Math.sign(direction.x),sy=Math.abs(direction.y)<1e-12?0:Math.sign(direction.y);
  let x=Math.floor((origin.x+direction.x*(enter+epsilon))/size),y=Math.floor((origin.y+direction.y*(enter+epsilon))/size);
  let tx=sx?((sx>0?(x+1)*size:x*size)-origin.x)/direction.x:Infinity,ty=sy?((sy>0?(y+1)*size:y*size)-origin.y)/direction.y:Infinity;
  const dx=sx?size/Math.abs(direction.x):Infinity,dy=sy?size/Math.abs(direction.y):Infinity,seen=new Set();
  let best=null,t=enter;
  while(t<=exit+epsilon&&(!best||t<=best.t+epsilon)){
    for(const segment of index.cells.get(x+','+y)||[]){
      if(seen.has(segment))continue;seen.add(segment);
      const hit=raySegmentIntersection(origin,angle,segment,direction);if(hit&&(!best||hit.t<best.t))best=hit;
    }
    const next=Math.min(tx,ty);if(!Number.isFinite(next))break;
    if(tx<=next+1e-10){x+=sx;tx+=dx;}if(ty<=next+1e-10){y+=sy;ty+=dy;}t=next;
  }
  return best;
}

function wallTestVisibilityPolygonWorld(observer,mode="los"){
  if(!observer || game?.condition!=="wall") return [];

  let cache=wallTestVisibilityPolygonWorld.cache;
  if(!cache||cache.walls!==architecturalWalls){cache={walls:architecturalWalls,observers:new WeakMap()};wallTestVisibilityPolygonWorld.cache=cache;}
  const fog=mode==="los"&&typeof denseFogGeometry==="function"?denseFogGeometry():null;
  if(fog?.cells.has(observer.x+","+observer.y))return architecturalHexCoreVertices(observer.x,observer.y,1);
  const cacheKey=[observer.x,observer.y,camera.x,camera.y,BATTLEFIELD_LOGICAL_WIDTH,BATTLEFIELD_LOGICAL_HEIGHT,battlefieldZoom,battlefieldRotation,mode,fog?.key].join(':');
  const cached=cache.observers.get(observer);if(cached?.key===cacheKey)return cached.polygon;
  const origin=worldPointForHex(observer.x,observer.y);
  const fogPolygons=fog?.polygons||[];
  const {segments,bounds}=visibilitySegments(mode,fogPolygons);
  const epsilon=0.00018;
  const vertices=[];

  for(const wall of architecturalWalls){
    for(const blocker of wallBlockingSubsegments(wall,mode)){
      vertices.push(...architecturalWallWorldVertices(blocker));
    }
  }
  for(const polygon of fogPolygons)vertices.push(...polygon);
  vertices.push(...bounds.corners);

  const angles=[];
  for(const vertex of vertices){
    const base=Math.atan2(vertex.y-origin.y,vertex.x-origin.x);
    angles.push(base-epsilon,base,base+epsilon);
  }

  angles.push(-Math.PI,-Math.PI/2,0,Math.PI/2,Math.PI);

  const hits=[];
  for(const angle of angles){
    const hit=castVisibilityRay(origin,angle,segments);
    if(!hit) continue;
    hits.push({angle,...hit});
  }

  hits.sort((a,b)=>a.angle-b.angle);

  const polygon=[];
  for(const hit of hits){
    const prev=polygon[polygon.length-1];
    if(prev && Math.hypot(prev.x-hit.x,prev.y-hit.y)<0.45){
      continue;
    }
    polygon.push({
      x:hit.x,
      y:hit.y,
      isWall:!!hit.isWall,
      wallId:hit.wallId || null,
      isBoundary:!!hit.isBoundary
    });
  }

  if(
    polygon.length>2 &&
    Math.hypot(
      polygon[0].x-polygon[polygon.length-1].x,
      polygon[0].y-polygon[polygon.length-1].y
    )<0.45
  ){
    polygon.pop();
  }

  cache.observers.set(observer,{key:cacheKey,polygon});
  return polygon;
}

function fogBlocksVisibilityToHex(observer,x,y){
  const cells=hexLineCells(observer,{x,y});
  return cells.some((cell,index)=>
    index>0 && hasObscuringMagicAtHex(cell.x,cell.y)
  );
}

function isHexVisibleFromObserver(observer,x,y,context=null){
  if(!observer || !inside(x,y)) return false;
  if(observer.x===x && observer.y===y) return true;

  /*
    R215: the center of the tactical hex is the sole architectural LOS sample.
    Obscuring magic is then applied along that same center-to-center path.
  */
  if(!isHexCenterInsideObserverLosCone(observer,x,y,context)){
    return false;
  }

  if(fogBlocksVisibilityToHex(observer,x,y)){
    return false;
  }

  return true;
}

function isHexVisibleToFriendlyParty(x,y){
  if(game?.condition!=="wall") return true;

  const contexts=friendlyVisibilityObservers()
    .map(observer=>observerVisibilityContext(observer))
    .filter(Boolean);

  if(!contexts.length) return true;

  return contexts.some(context=>
    isHexVisibleFromObserver(
      context.observer,
      x,
      y,
      context
    )
  );
}

function isUnitVisibleToFriendlyParty(unit){
  const scene=typeof combatSceneTerrain==='undefined'?null:combatSceneTerrain;if(unit&&scene?.isRenderableHex&&!scene.isRenderableHex(unit.x,unit.y))return false;
  if(!unit) return false;
  if(isFriendlyCombatUnit(unit)) return true;

  const observers=friendlyVisibilityObservers();
  if(!observers.length) return true;

  if(
    getUnitEffect(unit,"invisibility") &&
    !observers.some(observer=>unitVisibleToObserver(observer,unit))
  ){
    return false;
  }

  if(game?.condition!=="wall") return true;

  const contexts=observers
    .map(observer=>observerVisibilityContext(observer))
    .filter(Boolean);

  /*
    A multi-hex creature is visible if the center of any occupied tactical hex
    is visible to any friendly observer. Rendering remains entity-wide once
    detected; individual sprite fragments are never clipped by the LOS cone.
  */
  return contexts.some(context=>
    occupiedHexes(unit).some(cell=>
      isHexVisibleFromObserver(
        context.observer,
        cell.x,
        cell.y,
        context
      )
    )
  );
}

function shouldRenderUnitUnderPartyVisibility(unit){
  const scene=typeof combatSceneTerrain==='undefined'?null:combatSceneTerrain;if(unit&&scene?.isRenderableHex&&!scene.isRenderableHex(unit.x,unit.y))return false;
  return game?.condition!=="wall" || isUnitVisibleToFriendlyParty(unit);
}

function mobPositionVisibleToFriendlyParty(mob,x=mob?.x,y=mob?.y){
  if(!mob) return true;
  if(game?.condition!=="wall") return true;

  return isUnitVisibleToFriendlyParty({...mob,x,y});
}

function isHexVisibleToWallTestObserver(x,y){
  return isHexVisibleToFriendlyParty(x,y);
}

function worldLineBlockedByOtherArchitecturalWalls(a,b,ignoredWallId){
  for(const wall of architecturalWalls){
    if(wall.id===ignoredWallId) continue;

    for(const blocker of wallBlockingSubsegments(wall,"los")){
      const polygon=architecturalWallWorldVertices(blocker);
      for(const segment of wallPolygonSegments(polygon)){
        if(segmentsIntersect(a,b,segment.a,segment.b)){
          return true;
        }
      }
    }
  }
  return false;
}

function isArchitecturalWallVisibleToFriendlyParty(wall){
  if(game?.condition!=="wall") return true;
  const observers=friendlyVisibilityObservers();
  if(!observers.length) return false;

  /* Sample away from joined endpoints so a neighboring corner wall does not
     falsely hide the wall face we are testing. */
  const samples=[0.16,0.50,0.84].map(t=>({
    x:wall.a.x+(wall.b.x-wall.a.x)*t,
    y:wall.a.y+(wall.b.y-wall.a.y)*t
  }));

  return observers.some(observer=>{
    const eye=worldPointForHex(observer.x,observer.y);
    return samples.some(sample=>
      !worldLineBlockedByOtherArchitecturalWalls(eye,sample,wall.id)
    );
  });
}

function isFogCellArchitecturallyVisibleToFriendlyParty(cell){
  if(!cell || !inside(cell.x,cell.y)) return false;
  if(game?.condition!=="wall") return true;

  const contexts=friendlyVisibilityObservers()
    .map(observer=>observerVisibilityContext(observer))
    .filter(Boolean);

  if(!contexts.length) return false;

  /*
    Fog must remain drawable as a foreground volume even though it blocks
    gameplay sight into/through its own hex. Therefore this presentation test
    uses the same R215 center-in-LOS-cone rule but intentionally ignores the
    fog self-obscuration check.
  */
  return contexts.some(context=>
    isHexCenterInsideObserverLosCone(
      context.observer,
      cell.x,
      cell.y,
      context
    )
  );
}
