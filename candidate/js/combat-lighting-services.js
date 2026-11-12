/* Combat owner: combat-lighting-services.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

let directMotionFramePending=false;
// Character presentation only; the map ambient and sun/local-light sources stay unchanged.
const COMBAT_UNIT_AMBIENT_MULTIPLIER=1.5;
function requestDirectMotionFrame(){
  if(directMotionFramePending)return;
  directMotionFramePending=true;
  const session=game;
  requestCombatAnimationTick(()=>{directMotionFramePending=false;if(game===session&&currentScreen==='combat')draw();});
}

function drawDirectCombatUnit(image,entity,center,width,height,anchor,opacity){
  const direct=globalThis.adventurePartyDirectUnits;
  if(!direct||!entity||!combatSceneTerrain||!combatGpu)return false;
  const scale=combatShadowScale(),motion=entity.walkPresentation,t=motion?Math.max(0,Math.min(1,motion.t)):0;
  const world=motion?worldPointForHex(motion.from.x+(motion.to.x-motion.from.x)*t,motion.from.y+(motion.to.y-motion.from.y)*t):worldPointForHex(entity.x,entity.y);
  if(!entity.alive&&entity.deathWorldOffset){const offset=corpsePresentationOffset(entity);world.x+=offset.x;world.y+=offset.y;}
  const position=[world.x/scale[0],0,world.y/scale[2]];
  const localLights=(prepareCombatProjectedShadows.sources||[]).filter(source=>{
    if(Math.hypot(source.vector[0]-position[0],source.vector[2]-position[2])>=source.range)return false;
    if(source.source&&!illuminationSourceReachesHex(source.source,entity.x,entity.y))return false;
    return !worldLineBlockedByOtherArchitecturalWalls({x:source.vector[0]*scale[0],y:source.vector[2]*scale[2]},world,null);
  }).map(source=>({position:source.vector.slice(0,3).map((v,i)=>v-position[i]),range:source.range,
    intensity:source.power*12,color:(source.source?.color||[255,192,110]).map(v=>v/255)}))
    .sort((a,b)=>b.intensity/(1+b.position.reduce((n,v)=>n+v*v,0))-a.intensity/(1+a.position.reduce((n,v)=>n+v*v,0))).slice(0,4);
  let snowGroundLight=null;
  if(!entity.alive&&explorationGpuLighting&&direct.corpseSnowAmount?.(entity)>0){
    const point=explorationGpuPoint(world),exposure=explorationSurfaceExposure({x:point[0],y:0,z:point[2]},{x:0,y:1,z:0},explorationVisualLights(),new Set(combatSceneContext.openDoors));
    const visibility=explorationVisibilityAtHex(entity,[]);
    snowGroundLight=exposure.multiply.map((v,i)=>Math.max(.01**(1/2.2),v/Math.max(.0001,255-exposure.boost[i]))*visibility);
  }
  return direct.draw(combatGpu,image,{x:center.x,y:center.y,width,height,anchor,opacity,
    entity,equipmentEffects:!getUnitEffect(entity,'invisibility'),snowGroundLight,requestMotionFrame:requestDirectMotionFrame,walkSeconds:entity.walkPresentation?.seconds,rotation:battlefieldRotation*Math.PI/3,pixelsPerMetre:scale[1],groundMetresScale:[scale[0],scale[2]],localLights,
    solar:globalThis.adventurePartySolar?.state?.(),outdoor:!isIndoorWorldPoint(world),
    ambientPercent:combatRenderAmbientAtHex(entity)*COMBAT_UNIT_AMBIENT_MULTIPLIER,saturation:1});
}

function firTreeLocalLights(tree){
  const terrain=combatSceneTerrain,encounter=combatSceneContext,api=explorationEncounterApi;
  const origin=worldPointForHex(tree.x,tree.y),angle=battlefieldRotation*Math.PI/3,c=Math.cos(angle),s=Math.sin(angle);
  const units=210/(activeCombatTerrainTileSet().treeDrawHeight||240),cell=api.SCENE_STYLE.cellMetres;
  const metresToUnits=terrain.cellW/cell*units;
  const treePoint={x:(encounter.origin.x+origin.x/terrain.cellW)*cell,z:(encounter.origin.z+origin.y/terrain.cellH)*cell};
  const physical=explorationVisualLights().map(light=>{
    const distance=Math.hypot(light.x-treePoint.x,light.z-treePoint.z);
    if(distance>light.range)return null;
    const x=(light.x-treePoint.x)*metresToUnits,z=(light.z-treePoint.z)*metresToUnits;
    const hex={x:(light.x/cell-encounter.origin.x)*terrain.cellW,y:(light.z/cell-encounter.origin.z)*terrain.cellH};
    const fractional=api.worldHex(hex,HEX_W,HEX_ROW),source={x:Math.round(fractional.x),y:Math.round(fractional.y)};
    if(source&&!illuminationSourceReachesHex({x:source.x,y:source.y,radiusHexes:light.range/cell*2,intensity:1},tree.x,tree.y))return null;
    return {x:c*x-s*z,z:s*x+c*z,height:light.y*metresToUnits,radius:light.range*metresToUnits,
      intensity:light.intensity*Math.pow(metresToUnits,light.decay||2),decay:light.decay||2,
      color:[(light.color>>16)&255,(light.color>>8)&255,light.color&255].map(value=>value/255),strength:light.intensity/Math.pow(Math.max(1,distance),light.decay||2)};
  }).filter(Boolean);
  const magical=explorationRenderLights().filter(light=>light.sourceKind!=='torch').map(source=>{
    const strength=illuminationContributionFromSource(source,tree.x,tree.y);if(strength<=0)return null;
    const point=worldPointForHex(source.x,source.y),x=(point.x-origin.x)*units,z=(point.y-origin.y)*units*HEX_W*Math.sqrt(3)/2/HEX_ROW;
    const decay=api.SCENE_STYLE.lantern.decay,spellHeight=(source.sourceKind==='spell-fx'?2.2:1.9)*metresToUnits;
    return {x:c*x-s*z,z:s*x+c*z,height:spellHeight,radius:(source.radiusHexes||1)*HEX_W*units,intensity:(source.intensity||0)*api.SCENE_STYLE.lantern.intensity*Math.pow(metresToUnits,decay),decay,
      color:(source.color||[255,192,110]).map(value=>value/255),strength};
  }).filter(Boolean);
  return physical.concat(magical).sort((a,b)=>b.strength-a.strength).slice(0,4);
}

function architecturalWallLightContributions(wall){
  if(!wall || !game) return [];

  const dx=wall.b.x-wall.a.x;
  const dy=wall.b.y-wall.a.y;
  const len=Math.hypot(dx,dy)||1;
  const normalX=-dy/len;
  const normalY=dx/len;
  const contributions=[];

  for(const source of illuminationSources().concat(combatSpellEffectLights())){
    const sourceWorld=worldPointForHex(source.x,source.y);
    const nearest=closestPointOnWorldSegment(
      sourceWorld,
      wall.a,
      wall.b
    );

    const vx=sourceWorld.x-nearest.x;
    const vy=sourceWorld.y-nearest.y;
    const distance=Math.hypot(vx,vy);
    const radiusWorld=
      (Math.max(1,Number(source.radiusHexes)||1)+0.45)*HEX_W;

    if(distance>radiusWorld) continue;

    const invDistance=distance>0.0001 ? 1/distance : 0;
    const towardX=distance>0.0001 ? vx*invDistance : normalX;
    const towardY=distance>0.0001 ? vy*invDistance : normalY;

    /*
      R200: retain the angular falloff, but also keep the SIGN of the wall
      normal. The sign identifies the physical half of the wall slab facing
      the light source. Rendering uses that value so one source can never
      brighten the opposite face of the same wall.
    */
    const signedFaceAlignment=
      normalX*towardX+
      normalY*towardY;
    const faceAlignment=Math.abs(signedFaceAlignment);

    if(faceAlignment<0.15) continue;

    if(
      worldLineBlockedByOtherArchitecturalWalls(
        sourceWorld,
        nearest,
        wall.id
      )
    ){
      continue;
    }

    const normalized=Math.max(
      0,
      Math.min(1,distance/radiusWorld)
    );
    const falloff=1-(normalized*normalized);
    const intensity=Math.max(
      0,
      Number(source.intensity)||0
    )*falloff*Math.pow(faceAlignment,0.72);

    if(intensity<=0.01) continue;

    contributions.push({
      source,
      intensity,
      faceAlignment,
      faceSide:signedFaceAlignment>=0 ? 1 : -1,
      wallNormal:{x:normalX,y:normalY},
      nearest
    });
  }

  return contributions;
}

function ambientIlluminationLevel(){
  return game?.condition==="wall"
    ? ILLUMINATION_RULES.indoorAmbient
    : ILLUMINATION_RULES.outdoorAmbient;
}

function illuminationAreaEffects(){
  return (game?.areaEffects || []).filter(
    effect=>effect?.type==="illumination"
  );
}

function combatSpellEffectLights(){
 const api=globalThis.adventurePartySurfaceLighting||(typeof explorationEncounterApi!=='undefined'?explorationEncounterApi:null);
 if(!api?.spellEffectLightSources)return [];
 if(combatSpellEffectLights.frame===combatLightingFrame)return combatSpellEffectLights.sources;
 combatSpellEffectLights.frame=combatLightingFrame;
 const lightning=typeof r226LightningFx!=='undefined'?r226LightningFx:null;
 const lightningFx=lightning?{...lightning,points:lightning.points||lightning.segments?.flatMap(s=>[s.fromWorld,s.toWorld].map(p=>api.worldHex(p,HEX_W,HEX_ROW)))}:null;
 return combatSpellEffectLights.sources=api.spellEffectLightSources({projectileFx,spellSurfaceFlashFx,volleyLights:globalThis.AdventurePartyMagicMissileVolley?.surfaceLights?.()||[],fireballExplosionFx,castingGlowFx,fireDamageFx,magicEffectFx,colorSprayFx,dragonBreathFx,lightningFx,shockingGraspFx:globalThis.AdventurePartyShockingGraspFx?.active?.(),areaEffects:game?.areaEffects,hypnoticPatterns:typeof r224HypnoticVisualStore==='function'?r224HypnoticVisualStore():[]},performance.now(),getUnitById);
}

function illuminationSources(){
  if(!game) return [];

  const sources=typeof explorationTerrain!=="undefined"&&explorationTerrain ? [...(explorationTerrain.torches||[])] : [];

  sources.push(...firFireLightSources());
  for(const unit of allUnits()){
    if(!unit?.alive || unit.fled) continue;

    const itemEnvironment={now:performance.now(),daylight:globalThis.adventurePartySolar?.state?.().daylight||0,
      indoor:typeof isIndoorWorldPoint==='function'&&typeof worldPointForHex==='function'?isIndoorWorldPoint(worldPointForHex(unit.x,unit.y)):game?.condition==='wall'};
    sources.push(...(globalThis.AdventurePartyItemLighting?.sources(unit,itemEnvironment)||[]));
    const effect=
      getUnitEffect(unit,"continual-light") ||
      getUnitEffect(unit,"light");
    if(!effect) continue;

    sources.push({
      id:`unit-light:${unit.id}`,
      sourceKind:"unit",
      sourceName:effect.name || "Light",
      unitId:unit.id,
      x:unit.x,
      y:unit.y,
      radiusHexes:Math.max(
        1,
        Number(effect.data?.illuminationRadiusHexes) ||
        ILLUMINATION_RULES.lightSpellRadiusHexes
      ),
      intensity:Math.max(
        0,
        Number(effect.data?.illuminationIntensity) ||
        ILLUMINATION_RULES.lightSpellIntensity
      ),
      color:Array.isArray(effect.data?.lightColor)
        ? effect.data.lightColor
        : [255,244,188]
    });
  }

  for(const effect of illuminationAreaEffects()){
    if(!inside(effect.x,effect.y)) continue;

    sources.push({
      id:effect.id || `area-light:${effect.x},${effect.y}`,
      sourceKind:"area",
      sourceName:effect.sourceName || "Light",
      x:effect.x,
      y:effect.y,
      radiusHexes:Math.max(
        1,
        Number(effect.radiusHexes) ||
        ILLUMINATION_RULES.lightSpellRadiusHexes
      ),
      intensity:Math.max(
        0,
        Number(effect.intensity) ||
        ILLUMINATION_RULES.lightSpellIntensity
      ),
      color:Array.isArray(effect.color)
        ? effect.color
        : [255,244,188]
    });
  }

  return sources;
}

function illuminationSourceReachesHex(source,x,y){
  if(!source || !inside(x,y)) return false;

  const distance=hexDistance(
    {x:source.x,y:source.y},
    {x,y}
  );

  if(distance>source.radiusHexes) return false;

  if(
    game?.condition==="wall" &&
    lightBlockedBetweenHexes(
      {x:source.x,y:source.y},
      {x,y}
    )
  ){
    return false;
  }

  return true;
}

function illuminationContributionFromSource(source,x,y){
  if(!illuminationSourceReachesHex(source,x,y)) return 0;

  const distance=hexDistance(
    {x:source.x,y:source.y},
    {x,y}
  );
  const radius=Math.max(1,Number(source.radiusHexes)||1);

  /* Smooth radial falloff: center 100%, edge remains visibly illuminated. */
  const normalized=Math.max(0,Math.min(1,distance/(radius+0.45)));
  const falloff=1-(normalized*normalized);

  return Math.max(0,Number(source.intensity)||0)*falloff;
}

function dynamicIlluminationAtHex(x,y){
  let total=0;

  for(const source of illuminationSources()){
    total+=illuminationContributionFromSource(source,x,y);
  }

  return Math.max(0,Math.min(1.5,total));
}

function illuminationAtHex(x,y){
  if(hasEffectiveDarknessAtHex(x,y)){
    return 0;
  }

  const ambient=typeof explorationTerrain!=='undefined'&&explorationTerrain&&typeof explorationAmbientIlluminationAtHex==='function'?explorationAmbientIlluminationAtHex(x,y):ambientIlluminationLevel();
  const dynamic=dynamicIlluminationAtHex(x,y);

  return Math.max(
    0,
    Math.min(1,ambient+(1-ambient)*Math.min(1,dynamic))
  );
}

function isHexIlluminated(x,y){
  return illuminationAtHex(x,y)>=ILLUMINATION_RULES.illuminatedThreshold;
}

function architecturalLightShadowPolygonWorld(sourceWorld,blocker){
  if(!sourceWorld || !blocker) return [];

  const vertices=architecturalWallWorldVertices(blocker);
  if(vertices.length<3) return [];

  /*
    R202: extrude every wall-rectangle vertex directly away from the point
    light. The convex hull of the wall plus those far points is a conservative
    geometric shadow volume. Because wallBlockingSubsegments("light") splits
    around doors and windows, those openings naturally remain unshadowed.
  */
  const extrusionDistance=Math.max(
    BATTLEFIELD_LOGICAL_WIDTH,
    BATTLEFIELD_LOGICAL_HEIGHT,
    HEX_W*VIEW_RADIUS*3
  )*3;

  const farPoints=vertices.map(vertex=>{
    const dx=vertex.x-sourceWorld.x;
    const dy=vertex.y-sourceWorld.y;
    const len=Math.hypot(dx,dy)||1;

    return {
      x:vertex.x+(dx/len)*extrusionDistance,
      y:vertex.y+(dy/len)*extrusionDistance
    };
  });

  return convexHullWorldPoints(
    vertices.concat(farPoints)
  );
}

function combatSpriteBrightness(unit){
 const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
 if(!unit||!game)return 1;
 if(explorationTerrain&&typeof explorationUnitSpriteBrightness==='function')return explorationUnitSpriteBrightness(unit);
 return Math.max(.02,Math.min(1,illuminationAtHex(unit.x,unit.y)));
}
// Shared projected-shadow adapters: physical metres in, GPU projection out.
function combatShadowScale(){
 const t=combatSceneTerrain,s=explorationEncounterApi.SCENE_STYLE;
 return [t.cellW/s.cellMetres,s.tacticalWallPixels/s.wallMetres,t.cellH/s.cellMetres];
}
function combatShadowWorld(screen,height=0){
 const origin=screenPointForWorld({x:0,y:0}),p=battlefieldProjectVector({x:screen.x-origin.x,y:screen.y+height-origin.y},true),scale=combatShadowScale();
 return [p.x/scale[0],height/scale[1],p.y/scale[2]];
}
function prepareCombatProjectedShadows(tiles){
 if(!combatGpu?.projectedShadows||!combatSceneTerrain)return;
 const scale=combatShadowScale(),bounds=battlefieldWorldViewport(),observers=friendlyVisibilityObservers();
 const signature=[typeof denseFogGeometry==='function'?denseFogGeometry()?.key:'',bounds.left.toFixed(1),bounds.top.toFixed(1),bounds.right.toFixed(1),bounds.bottom.toFixed(1),...observers.map(u=>u.id+':'+u.x+':'+u.y)].join('|');
 let cache=prepareCombatProjectedShadows.cache;
 if(!cache||cache.game!==game||cache.terrain!==combatSceneTerrain||cache.walls!==architecturalWalls||cache.signature!==signature){
  const image=document.createElement('canvas');image.width=image.height=512;const m=image.getContext('2d');
  const width=Math.max(1,bounds.right-bounds.left),height=Math.max(1,bounds.bottom-bounds.top);
  const path=polygon=>{if(!polygon?.length)return;const convert=p=>({x:(p.x-bounds.left)/width*512,y:(p.y-bounds.top)/height*512});const first=convert(polygon[0]);m.moveTo(first.x,first.y);for(const p of polygon.slice(1)){const q=convert(p);m.lineTo(q.x,q.y);}m.closePath();};
  const polygons=observers.map(u=>observerVisibilityContext(u)?.polygon).filter(Boolean);
  if(polygons.length){m.beginPath();polygons.forEach(path);m.clip();}
  m.fillStyle='#fff';
  const allowed=tiles.filter(h=>isHexVisibleToFriendlyParty(h.x,h.y)&&(!combatSceneTerrain.isRenderableHex||combatSceneTerrain.isRenderableHex(h.x,h.y)));
  for(const fragment of explorationFloorFragments(allowed)){
    const hex=fragment.hex||fragment.point,center=worldPointForHex(hex.x,hex.y);
    const polygon=fragment.polygon||[[0,-HEX_H/2],[HEX_W/2,-HEX_H/4],[HEX_W/2,HEX_H/4],[0,HEX_H/2],[-HEX_W/2,HEX_H/4],[-HEX_W/2,-HEX_H/4]].map(([x,y])=>({x:center.x+x,y:center.y+y}));
    const indoor=isIndoorWorldPoint(center),c=combatSceneContext,t=combatSceneTerrain;
    const ambient=explorationEncounterApi.ambientLightAt?.(c.map,Math.floor(c.origin.x+center.x/t.cellW),Math.floor(c.origin.z+center.y/t.cellH))??(indoor?0:100);
    m.fillStyle='rgb('+(indoor?0:255)+','+Math.round(Math.min(1000,ambient)/1000*255)+',0)';m.beginPath();path(polygon);m.fill();
  }
  cache=prepareCombatProjectedShadows.cache={game,terrain:combatSceneTerrain,walls:architecturalWalls,signature,image,
   bounds:[bounds.left/scale[0],bounds.top/scale[2],width/scale[0],height/scale[2]]};
 }
 combatGpu.projectedShadows.receiver(cache);
 const sources=[],cell=explorationEncounterApi.SCENE_STYLE.cellMetres,c=combatSceneContext;
 if(c){for(const [index,l] of explorationVisualLights().entries()){
  if(!(l.intensity>0))continue;
  sources.push({id:'scene:'+index,vector:[l.x-c.origin.x*cell,l.y||1.9,l.z-c.origin.z*cell,1],range:l.range||8,power:Math.min(1,l.intensity/6),ownerId:l.kind==='lantern'?((game.session?.controlledActorId&&getUnitById(game.session.controlledActorId))||game.player)?.id:null});
 }}
 for(const [index,l] of explorationRenderLights().entries()){
  if(l.sourceKind==='torch'||!(l.intensity>0))continue;
  const p=worldPointForHex(l.x,l.y);sources.push({id:'effect:'+(l.id||index),vector:[p.x/scale[0]+(l.visualOffsetMetres?.x||0),(l.heightMetres||(l.sourceKind==='tree-fire'?2.5:2.2))+(l.visualOffsetMetres?.y||0),p.y/scale[2]+(l.visualOffsetMetres?.z||0),1],range:(l.radiusHexes||3)*HEX_W/scale[0],power:Math.min(12,l.intensity*(l.sourceKind==='spell-fx'?4:1)),ownerId:l.unitId||null,source:l});
 }
 prepareCombatProjectedShadows.sources=sources;
 combatGpu.projectedShadows.lighting({solar:globalThis.adventurePartySolar?.state?.(),sources});
 globalThis.adventurePartyGpuShadows={unit:queueCombatUnitGpuShadow};
}
function combatShadowBackground(outdoor,ambientPercent,solar){
 const sky=outdoor?(solar?.sky??1):1;
 return Math.max(0,ambientPercent)/100*sky*2+(outdoor?12*(solar?.daylight||0):0);
}
function combatLocalShadowOpacity(strength,background){
 // A light removes only its own share of illumination behind a caster.
 // Below eight percent of the background, its shadow is visually negligible.
 const contrast=Math.max(0,(strength-background*.08)/(strength+background+.1));
 return Math.min(.3,contrast*.3);
}
function combatShadowLights(point,casterId=null){
 const scale=combatShadowScale(),world={x:point[0]*scale[0],y:point[2]*scale[2]},hex=environmentHex(world),lights=[];
 const sun=globalThis.adventurePartySolar?.state?.(),outdoor=!isIndoorWorldPoint(world);
 let ambient=outdoor?100:0;
 if(typeof combatSceneContext!=='undefined'&&combatSceneContext&&typeof explorationEncounterApi?.ambientLightAt==='function'){
  const c=combatSceneContext,t=combatSceneTerrain;
  ambient=explorationEncounterApi.ambientLightAt(c.map,Math.floor(c.origin.x+world.x/t.cellW),Math.floor(c.origin.z+world.y/t.cellH));
 }
 const background=combatShadowBackground(outdoor,ambient,sun);
 if(sun?.direction.y>.00001&&outdoor)lights.push({id:'sun',vector:[sun.direction.x,sun.direction.y,sun.direction.z,0],opacity:.32*sun.daylight});
 const candidates=[];
 for(const l of prepareCombatProjectedShadows.sources||[]){
  if(casterId&&l.ownerId===casterId)continue;
  const distance=Math.hypot(point[0]-l.vector[0],point[2]-l.vector[2]);if(distance>=l.range)continue;
  if(l.source&&!illuminationSourceReachesHex(l.source,hex.x,hex.y))continue;
  const lightWorld={x:l.vector[0]*scale[0],y:l.vector[2]*scale[2]};
  if(worldLineBlockedByOtherArchitecturalWalls(lightWorld,world,null))continue;
  const strength=l.power*Math.pow(1-distance/l.range,2),opacity=combatLocalShadowOpacity(strength,background);if(opacity<.012)continue;
  candidates.push({...l,opacity,strength});
 }
 return lights.concat(candidates.sort((a,b)=>b.strength-a.strength).slice(0,2));
}
function queueCombatUnitGpuShadow(image,options){
 if(!combatGpu?.projectedShadows||!combatSceneTerrain)return false;
 const unit=globalThis.adventurePartySun?.caster;
 if(!unit||getUnitEffect(unit,'invisibility')||!shouldRenderUnitUnderPartyVisibility(unit))return true;
 if(options.modelShadow&&combatGpu.projectedShadows.modelGeometry){
  const scale=combatShadowScale(),capture=options.modelShadow;
  const {x,y,width,height,anchorX=.5,anchorY=1,flip=false}=options;
  if(capture.gpu&&combatGpu.projectedShadows.queueModel){
   const convert=(u,v,rise)=>{const point=combatShadowWorld({x:x+(u-anchorX)*width*(flip?-1:1),y:y+(v-anchorY)*height},0);point[1]=rise*height/scale[1];return point;};
   const o=convert(0,0,0),a=convert(1,0,0),b=convert(0,1,0),c=convert(0,0,1);
   const transform=[...a.map((v,i)=>v-o[i]),0,...b.map((v,i)=>v-o[i]),0,...c.map((v,i)=>v-o[i]),0,...o,1];
   const world=worldPointForHex(unit.x,unit.y),origin=[world.x/scale[0],0,world.y/scale[2]];
   for(const light of combatShadowLights(origin,unit.id))combatGpu.projectedShadows.queueModel({capture,transform,light,scale,opacity:light.opacity});
   return true;
  }
  const points=[],uv=[];
  for(let i=0;i<capture.positions.length;i+=3){
   const u=capture.positions[i],v=capture.positions[i+1],rise=capture.positions[i+2]*height;
   const ground=combatShadowWorld({x:x+(u-anchorX)*width*(flip?-1:1),y:y+(v-anchorY)*height},0);
   ground[1]=Math.max(0,rise/scale[1]);points.push(ground);uv.push([.5,.5]);
  }
  const geometry=combatGpu.projectedShadows.modelGeometry({points,uv,indices:capture.indices});
  const world=worldPointForHex(unit.x,unit.y),origin=[world.x/scale[0],0,world.y/scale[2]];
  for(const light of combatShadowLights(origin,unit.id))combatGpu.projectedShadows.queue({...geometry,light,scale,opacity:light.opacity,softness:0});
  return true;
 }
 if(!image)return false;
 const scale=combatShadowScale(),{x,y,width,height,anchorX=.5,anchorY=1,flip=false,pose,footLine}=options;
 const points=[],uv=[],indices=[],cols=8,rows=12,line=footLine||{slope:0,intercept:image.height};
 for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
  const u=col/cols,v=row/rows,px=u*image.width,foot=(line.slope*px+line.intercept),baseline=(foot/image.height-anchorY)*height;
  const elevation=pose==='prone'?.6:Math.max(0,(foot/image.height-v)*height);
  const ground=combatShadowWorld({x:x+(u-anchorX)*width*(flip?-1:1),y:y+baseline},0);
  if(pose==='prone')ground[2]+=(v-anchorY)*height/scale[2]*.35;
  ground[1]=elevation/scale[1];points.push(ground);uv.push([u,1-v]);
 }
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const i=row*(cols+1)+col;indices.push(i,i+1,i+cols+2,i,i+cols+2,i+cols+1);}
 const origin=combatShadowWorld({x,y});
 const casterHeight=Math.max(...points.map(p=>p[1]));
 for(const light of combatShadowLights(origin,unit.id))combatGpu.projectedShadows.queue({points,uv,indices,image,light,scale,opacity:light.opacity,softness:1.2,silhouetteAnchor:[origin[0],0,origin[2],casterHeight]});
 return true;
}
function queueCombatArrowGpuShadow(tail,tip,{tailHeight=16,tipHeight=16,wall=null}={}){
 if(!combatGpu?.projectedShadows||!combatSceneTerrain)return false;
 let image=queueCombatArrowGpuShadow.image;
 if(!image){image=document.createElement('canvas');image.width=64;image.height=16;const c=image.getContext('2d');c.strokeStyle='#fff';c.lineWidth=5;c.beginPath();c.moveTo(2,8);c.lineTo(62,8);c.stroke();c.lineWidth=4;c.beginPath();c.moveTo(2,5);c.lineTo(16,5);c.moveTo(2,11);c.lineTo(16,11);c.stroke();queueCombatArrowGpuShadow.image=image;}
 const dx=tip.x-tail.x,dy=tip.y-tail.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,points=[],uv=[],indices=[],scale=combatShadowScale();
 for(let i=0;i<=8;i++)for(const side of [-1,1]){const t=i/8;points.push(combatShadowWorld({x:tail.x+dx*t+nx*side*1.4,y:tail.y+dy*t+ny*side*1.4},tailHeight+(tipHeight-tailHeight)*t));uv.push([t,side<0?0:1]);}
 for(let i=0;i<8;i++){const n=i*2;indices.push(n,n+1,n+3,n,n+3,n+2);}
 let receiver=null,plane=[0,1,0,0];
 if(wall){const ax=wall.a.x/scale[0],az=wall.a.y/scale[2],bx=wall.b.x/scale[0],bz=wall.b.y/scale[2],length=Math.hypot(bx-ax,bz-az)||1,nx=-(bz-az)/length,nz=(bx-ax)/length;
  plane=[nx,0,nz,-nx*ax-nz*az];receiver={id:wall.id,span:[ax,az,bx,bz],height:3.5};}
 for(const light of combatShadowLights(points[8]))combatGpu.projectedShadows.queue({points,uv,indices,image,light,scale,plane,wall:receiver,opacity:Math.min(.7,light.opacity*1.5),softness:.35});
 if(wall)combatGpu.projectedShadows.flush();return true;
}
function queueFlyingArrowGpuShadow(){
 const fx=projectileFx;if(!fx||!['arrow','flame-arrow','acid-arrow'].includes(fx.kind))return;
 const {start,end,t}=fx,arc=Math.sin(Math.PI*t)*(fx.arcHeight||0),x=start.x+(end.x-start.x)*t,y=start.y+(end.y-start.y)*t-arc,angle=Math.atan2(end.y-start.y,end.x-start.x);
 queueCombatArrowGpuShadow({x:x-Math.cos(angle)*9,y:y-Math.sin(angle)*9},{x:x+Math.cos(angle)*9,y:y+Math.sin(angle)*9},{tailHeight:16+arc,tipHeight:16+arc});
}

// Derive floor contacts from the same cropped sprite, anchor and mirroring used
// by drawSpriteFacing. Keep anatomical volume; fit only its stance and root.
function fitCombatShadowFeet(image,options,yaw,height){
 const {x,y,width,anchorX=.5,anchorY=1,flip=false,footLine}=options;
 const screenHeight=options.height,contacts=footLine.contacts.slice(0,2);
 if(contacts.length===1)contacts.push(contacts[0]);
 const world=contacts.map(p=>combatShadowWorld({x:x+(p.x/image.width-anchorX)*width*(flip?-1:1),y:y+(p.y/image.height-anchorY)*screenHeight},0));
 const origin=[(world[0][0]+world[1][0])/2,0,(world[0][2]+world[1][2])/2],c=Math.cos(yaw),s=Math.sin(yaw),scale=height/1.8;
 const feet=world.map(p=>{const dx=p[0]-origin[0],dz=p[2]-origin[2];return [(dx*c-dz*s)/scale,(dx*s+dz*c)/scale];}).sort((a,b)=>a[0]-b[0]);
 return {origin,feet,world};
}

