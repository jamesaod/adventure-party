/*
  R232 — REFLECTED LIGHTNING GEOMETRY
  ===================================
  Lightning Bolt now traces in a true top-down tactical metric instead of the
  projected isometric screen metric. The resulting ray is projected back to
  the battlefield for rendering.

  Reflectors:
    - architectural solid wall/projectile subsegments
    - legacy solid wall hexes
    - outdoor tree trunks
    - optional future custom reflectors

  The bolt conserves its original 8-hex / 80-foot tactical range across every
  reflection. A hard reflection cap prevents pathological infinite loops.
*/

const R232_LIGHTNING_RANGE_HEXES=8;
const R232_LIGHTNING_MAX_REFLECTIONS=8;
const R232_LIGHTNING_EPS=0.08;
const R232_LIGHTNING_PUSH=0.35;
const R232_TREE_TRUNK_RADIUS=HEX_W*0.14;
const R232_METRIC_Y_SCALE=
  (HEX_W*Math.sqrt(3)/2)/HEX_ROW;


function r232WorldToMetric(point){
  return {
    x:Number(point?.x)||0,
    y:(Number(point?.y)||0)*R232_METRIC_Y_SCALE
  };
}


function r232MetricToWorld(point){
  return {
    x:Number(point?.x)||0,
    y:(Number(point?.y)||0)/R232_METRIC_Y_SCALE
  };
}


function r232MetricForHex(x,y){
  return r232WorldToMetric(
    worldPointForHex(x,y)
  );
}


function r232MetricLength(vector){
  return Math.hypot(
    Number(vector?.x)||0,
    Number(vector?.y)||0
  );
}


function r232Normalize(vector){
  const length=r232MetricLength(vector);
  if(length<=0.000001){
    return {x:0,y:0};
  }

  return {
    x:vector.x/length,
    y:vector.y/length
  };
}


function r232Dot(a,b){
  return a.x*b.x+a.y*b.y;
}


function r232Cross(a,b){
  return a.x*b.y-a.y*b.x;
}


function r232Add(a,b,scale=1){
  return {
    x:a.x+b.x*scale,
    y:a.y+b.y*scale
  };
}


function r232Subtract(a,b){
  return {
    x:a.x-b.x,
    y:a.y-b.y
  };
}


function r232ReflectDirection(direction,normal){
  const n=r232Normalize(normal);
  const dot=r232Dot(direction,n);

  return r232Normalize({
    x:direction.x-2*dot*n.x,
    y:direction.y-2*dot*n.y
  });
}


function r232WorldHexVertices(x,y){
  const c=worldPointForHex(x,y);

  return [
    {x:c.x,         y:c.y-HEX_H/2},
    {x:c.x+HEX_W/2, y:c.y-HEX_H/4},
    {x:c.x+HEX_W/2, y:c.y+HEX_H/4},
    {x:c.x,         y:c.y+HEX_H/2},
    {x:c.x-HEX_W/2, y:c.y+HEX_H/4},
    {x:c.x-HEX_W/2, y:c.y-HEX_H/4}
  ];
}


function r232AllTreeDecorations(){
  const tileSet=activeCombatTerrainTileSet();

  if(
    !tileSet?.treeSheetSrc ||
    !tileSet?.treeCoverageRatio
  ){
    return [];
  }

  const decorationsByKey=new Map();

  /*
    Include a one-hex seed margin because a deterministic cluster seeded just
    outside the finite map can place a tree inside the battlefield.
  */
  for(let x=MAP_MIN_X-1;x<=MAP_MAX_X+1;x++){
    for(let y=MAP_MIN_Y-1;y<=MAP_MAX_Y+1;y++){
      const seed=terrainTreeSeedDefinition(
        tileSet,
        x,
        y
      );

      if(!seed) continue;

      const cluster=
        terrainTreeClusterPositions(
          tileSet,
          seed
        );

      cluster.forEach((position,index)=>{
        if(!inside(position.x,position.y)){
          return;
        }

        if(
          isIndoorWorldPoint(
            worldPointForHex(
              position.x,
              position.y
            )
          )
        ){
          return;
        }

        const positionKey=
          key(position.x,position.y);

        const decoration={
          x:position.x,
          y:position.y,
          tileIndex:
            (seed.variantBase+index*7) %
            treeVariantCount(tileSet),
          rank:seed.priority+index/100
        };

        const existing=
          decorationsByKey.get(positionKey);

        if(
          !existing ||
          decoration.rank<existing.rank
        ){
          decorationsByKey.set(
            positionKey,
            decoration
          );
        }
      });
    }
  }

  return [...decorationsByKey.values()];
}


function r232ArchitecturalReflectors(){
  const reflectors=[];

  for(const wall of architecturalWalls || []){
    /*
      Projectile mode keeps doorways open but treats window/glass spans as
      solid, matching the engine's existing projectile collision behavior.
    */
    for(
      const segment of
      wallBlockingSubsegments(
        wall,
        "projectile"
      )
    ){
      reflectors.push({
        id:
          "architectural:"+
          String(segment.id || wall.id),
        type:"wall",
        shape:"segment",
        a:r232WorldToMetric(segment.a),
        b:r232WorldToMetric(segment.b),
        source:segment
      });
    }
  }

  return reflectors;
}


function r232LegacyHexWallReflectors(){
  const reflectors=[];

  for(const wallKey of walls){
    const parts=String(wallKey)
      .split(",")
      .map(Number);

    const x=parts[0];
    const y=parts[1];

    if(
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !inside(x,y)
    ){
      continue;
    }

    const vertices=
      r232WorldHexVertices(x,y)
        .map(r232WorldToMetric);

    for(let index=0;index<vertices.length;index++){
      reflectors.push({
        id:
          "hex-wall:"+
          wallKey+
          ":"+
          index,
        type:"solid",
        shape:"segment",
        a:vertices[index],
        b:vertices[(index+1)%vertices.length],
        source:{x,y}
      });
    }
  }

  return reflectors;
}


function r232TreeReflectors(){
  return r232AllTreeDecorations()
    .map(tree=>({
      id:"tree:"+key(tree.x,tree.y),
      type:"tree",
      shape:"circle",
      center:r232MetricForHex(
        tree.x,
        tree.y
      ),
      radius:R232_TREE_TRUNK_RADIUS,
      source:tree
    }));
}


function r232CustomReflectors(){
  const items=
    Array.isArray(game?.r232LightningReflectors)
      ? game.r232LightningReflectors
      : [];

  const reflectors=[];

  for(const item of items){
    if(
      item?.shape==="segment" &&
      item.a &&
      item.b
    ){
      reflectors.push({
        ...item,
        id:
          String(
            item.id ||
            "custom-segment:"+
            reflectors.length
          ),
        type:item.type || "solid",
        a:r232WorldToMetric(item.a),
        b:r232WorldToMetric(item.b)
      });
      continue;
    }

    if(
      item?.shape==="circle" &&
      item.center &&
      Number(item.radius)>0
    ){
      reflectors.push({
        ...item,
        id:
          String(
            item.id ||
            "custom-circle:"+
            reflectors.length
          ),
        type:item.type || "solid",
        center:r232WorldToMetric(item.center),
        radius:Number(item.radius)
      });
    }
  }

  return reflectors;
}


function r232LightningReflectors(){
  return [
    ...r232ArchitecturalReflectors(),
    ...r232LegacyHexWallReflectors(),
    ...r232TreeReflectors(),
    ...r232CustomReflectors()
  ];
}


function r232RaySegmentIntersection(
  origin,
  direction,
  maxDistance,
  reflector
){
  const segmentVector=
    r232Subtract(
      reflector.b,
      reflector.a
    );

  const denominator=
    r232Cross(
      direction,
      segmentVector
    );

  if(Math.abs(denominator)<0.000001){
    return null;
  }

  const delta=
    r232Subtract(
      reflector.a,
      origin
    );

  const distance=
    r232Cross(
      delta,
      segmentVector
    )/denominator;

  const segmentT=
    r232Cross(
      delta,
      direction
    )/denominator;

  if(
    distance<=R232_LIGHTNING_EPS ||
    distance>maxDistance+R232_LIGHTNING_EPS ||
    segmentT<-0.0001 ||
    segmentT>1.0001
  ){
    return null;
  }

  const point=
    r232Add(
      origin,
      direction,
      distance
    );

  const rawNormal={
    x:-segmentVector.y,
    y:segmentVector.x
  };

  let normal=
    r232Normalize(rawNormal);

  if(r232Dot(normal,direction)>0){
    normal={
      x:-normal.x,
      y:-normal.y
    };
  }

  return {
    distance,
    point,
    normal,
    reflector
  };
}


function r232RayCircleIntersection(
  origin,
  direction,
  maxDistance,
  reflector
){
  const offset=
    r232Subtract(
      origin,
      reflector.center
    );

  const projection=
    r232Dot(
      offset,
      direction
    );

  const c=
    r232Dot(offset,offset)-
    reflector.radius*reflector.radius;

  const discriminant=
    projection*projection-c;

  if(discriminant<0){
    return null;
  }

  const root=
    Math.sqrt(
      Math.max(0,discriminant)
    );

  let distance=
    -projection-root;

  if(distance<=R232_LIGHTNING_EPS){
    distance=-projection+root;
  }

  if(
    distance<=R232_LIGHTNING_EPS ||
    distance>maxDistance+R232_LIGHTNING_EPS
  ){
    return null;
  }

  const point=
    r232Add(
      origin,
      direction,
      distance
    );

  let normal=
    r232Normalize(
      r232Subtract(
        point,
        reflector.center
      )
    );

  if(r232Dot(normal,direction)>0){
    normal={
      x:-normal.x,
      y:-normal.y
    };
  }

  return {
    distance,
    point,
    normal,
    reflector
  };
}


function r232NearestLightningCollision(
  origin,
  direction,
  maxDistance,
  reflectors,
  {
    ignoreId=null,
    firstSegment=false
  }={}
){
  let nearest=null;

  for(const reflector of reflectors){
    if(!reflector || reflector.id===ignoreId){
      continue;
    }

    if(
      firstSegment &&
      reflector.type==="tree" &&
      reflector.shape==="circle" &&
      r232MetricLength(
        r232Subtract(
          origin,
          reflector.center
        )
      )<=reflector.radius*1.03
    ){
      /*
        Trees are decorative/non-blocking for unit placement in the current
        terrain system. If a caster happens to share a tree hex, do not make the
        bolt instantly collide with the trunk it starts inside.
      */
      continue;
    }

    let hit=null;

    if(reflector.shape==="segment"){
      hit=r232RaySegmentIntersection(
        origin,
        direction,
        maxDistance,
        reflector
      );
    }else if(reflector.shape==="circle"){
      hit=r232RayCircleIntersection(
        origin,
        direction,
        maxDistance,
        reflector
      );
    }

    if(
      hit &&
      (
        !nearest ||
        hit.distance<nearest.distance
      )
    ){
      nearest=hit;
    }
  }

  return nearest;
}


function r232WorldToHex(point){
  const r=
    point.y/HEX_ROW;

  const q=
    (
      point.x-
      r*(HEX_W/2)
    )/HEX_W;

  return roundAxial(q,r);
}


function r232CellsForTraceSegment(
  segment,
  segmentIndex,
  caster
){
  const cells=[];
  const seenConsecutive=[];
  const length=Math.max(
    0.001,
    Number(segment?.length)||0
  );

  const steps=Math.max(
    2,
    Math.ceil(
      length/(HEX_W/14)
    )
  );

  const casterCells=
    segmentIndex===0 && caster
      ? new Set(
          occupiedHexes(caster)
            .map(cell=>key(cell.x,cell.y))
        )
      : null;

  let lastKey=null;

  for(let index=0;index<=steps;index++){
    const t=index/steps;

    const metricPoint={
      x:
        segment.fromMetric.x+
        (segment.toMetric.x-segment.fromMetric.x)*t,
      y:
        segment.fromMetric.y+
        (segment.toMetric.y-segment.fromMetric.y)*t
    };

    const worldPoint=
      r232MetricToWorld(metricPoint);

    const cell=
      r232WorldToHex(worldPoint);

    if(!inside(cell.x,cell.y)){
      continue;
    }

    const cellKey=key(cell.x,cell.y);

    if(
      casterCells?.has(cellKey)
    ){
      continue;
    }

    if(cellKey===lastKey){
      continue;
    }

    lastKey=cellKey;
    seenConsecutive.push(cellKey);

    cells.push({
      x:cell.x,
      y:cell.y,
      traceSegmentIndex:segmentIndex,
      rebounded:segmentIndex>0
    });
  }

  return cells;
}


function r232TraceLightningBolt(
  caster,
  targetHex,
  {
    rangeHexes=R232_LIGHTNING_RANGE_HEXES,
    maxReflections=R232_LIGHTNING_MAX_REFLECTIONS
  }={}
){
  if(
    !caster ||
    !targetHex ||
    (
      caster.x===targetHex.x &&
      caster.y===targetHex.y
    )
  ){
    return {
      segments:[],
      cells:[],
      collisions:[],
      reflections:0,
      totalDistance:0,
      maxDistance:0
    };
  }

  const origin=
    r232MetricForHex(
      caster.x,
      caster.y
    );

  const aim=
    r232MetricForHex(
      targetHex.x,
      targetHex.y
    );

  let direction=
    r232Normalize(
      r232Subtract(
        aim,
        origin
      )
    );

  const maxDistance=
    Math.max(
      1,
      Number(rangeHexes)||
      R232_LIGHTNING_RANGE_HEXES
    )*HEX_W;

  let remaining=maxDistance;
  let cursor={...origin};
  let ignoreId=null;
  let reflectionCount=0;
  let travelled=0;

  const reflectors=
    r232LightningReflectors();

  const segments=[];
  const collisions=[];

  while(
    remaining>R232_LIGHTNING_EPS &&
    r232MetricLength(direction)>0.5
  ){
    const hit=
      r232NearestLightningCollision(
        cursor,
        direction,
        remaining,
        reflectors,
        {
          ignoreId,
          firstSegment:
            segments.length===0
        }
      );

    if(!hit){
      const end=
        r232Add(
          cursor,
          direction,
          remaining
        );

      segments.push({
        fromMetric:{...cursor},
        toMetric:end,
        fromWorld:r232MetricToWorld(cursor),
        toWorld:r232MetricToWorld(end),
        length:remaining,
        collision:null
      });

      travelled+=remaining;
      remaining=0;
      break;
    }

    const end={...hit.point};

    const collision={
      id:hit.reflector.id,
      type:hit.reflector.type,
      shape:hit.reflector.shape,
      pointMetric:{...hit.point},
      pointWorld:r232MetricToWorld(hit.point),
      normalMetric:{...hit.normal},
      source:hit.reflector.source || null
    };

    segments.push({
      fromMetric:{...cursor},
      toMetric:end,
      fromWorld:r232MetricToWorld(cursor),
      toWorld:{...collision.pointWorld},
      length:hit.distance,
      collision
    });

    collisions.push(collision);

    travelled+=hit.distance;
    remaining-=hit.distance;

    reflectionCount++;

    if(
      reflectionCount>=maxReflections ||
      remaining<=R232_LIGHTNING_EPS
    ){
      remaining=0;
      break;
    }

    direction=
      r232ReflectDirection(
        direction,
        hit.normal
      );

    ignoreId=hit.reflector.id;

    const pushDistance=
      Math.min(
        R232_LIGHTNING_PUSH,
        Math.max(0,remaining)
      );

    cursor=
      r232Add(
        hit.point,
        direction,
        pushDistance
      );

    remaining-=pushDistance;
    travelled+=pushDistance;
  }

  const cells=[];

  segments.forEach((segment,index)=>{
    const segmentCells=
      r232CellsForTraceSegment(
        segment,
        index,
        caster
      );

    segment.cells=segmentCells;
    cells.push(...segmentCells);
  });

  return {
    segments,
    cells,
    collisions,
    reflections:collisions.length,
    totalDistance:travelled,
    maxDistance
  };
}


function r232UnitOccurrencesAlongTrace(
  trace,
  caster=null
){
  const result=[];

  for(
    let segmentIndex=0;
    segmentIndex<(trace?.segments || []).length;
    segmentIndex++
  ){
    const segment=
      trace.segments[segmentIndex];

    const seen=new Set();

    for(const cell of segment.cells || []){
      const unit=
        unitAtHex(
          cell.x,
          cell.y
        );

      if(
        !unit?.alive ||
        unit.fled ||
        seen.has(unit.id)
      ){
        continue;
      }

      if(
        segmentIndex===0 &&
        caster?.id===unit.id
      ){
        continue;
      }

      seen.add(unit.id);

      result.push({
        unit,
        cell,
        segmentIndex
      });
    }
  }

  return result;
}


window.AdventurePartyLightningReflection={
  release:"R232",
  trace:(caster,targetHex)=>
    r232TraceLightningBolt(
      caster,
      targetHex
    ),
  reflectors:()=>r232LightningReflectors()
    .map(item=>({
      id:item.id,
      type:item.type,
      shape:item.shape,
      source:item.source || null
    })),
  treeCount:()=>r232AllTreeDecorations().length
};
