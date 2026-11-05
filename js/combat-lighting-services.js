/* Combat owner: combat-lighting-services.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

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
