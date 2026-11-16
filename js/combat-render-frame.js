/* Combat owner: combat-render-frame.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

let groundCoverAnimation=null;
function hasEnvironmentAnimation(){return combatGpu?.puddleEffectsActive?.()||(!!game?.testTrees?.length&&globalThis.adventurePartyTreeMotion?.active())||treeFallEntries().some(({state})=>!oakDebrisSettled(state))||combatGpu?.groundCover?.active||(globalThis.adventurePartySeasons?.getSeason()==='fall'&&game?.testTrees?.length&&combatFirTrees?.fallingLeafCount>0);}
function ensureGroundCoverAnimation(){
 if(groundCoverAnimation!==null||!hasEnvironmentAnimation()||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 groundCoverAnimation=requestCombatAnimationTick(()=>{groundCoverAnimation=null;if(currentScreen==='combat'&&game&&!game.over&&hasEnvironmentAnimation()){draw();ensureGroundCoverAnimation();}});
}
function deathPresentationActive(unit){return !!unit&&!unit.alive&&Number.isFinite(unit.deathPresentationStartedAt);}

function draw(){
  const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
  if(typeof combatFrames!=="undefined"&&combatFrames&&!combatFrames.rendering){combatFrames.request();return;}
  combatLightingFrame++;
  if(!game) return;game.treeMotionTime=performance.now()/1000;
  updateTreeEnvironment(performance.now());
  updateComputerCameraFollow();

  ensureFogAnimationLoop();
  syncBurningTreeAudio();
  ensureTransientUnitFxLoop();

  const tiles=visibleHexes();

  if(combatGpu){
    if(!combatGpu.available)return;
    const p=screenPointForWorld({x:0,y:0}),u=battlefieldProjectVector({x:1,y:0}),v=battlefieldProjectVector({x:0,y:1});
    if(!combatGpu.begin({width:BATTLEFIELD_LOGICAL_WIDTH,height:BATTLEFIELD_LOGICAL_HEIGHT,zoom:battlefieldZoom,anchor:battlefieldZoomAnchor(),matrix:[u.x,u.y,v.x,v.y,p.x,p.y]}))return;
    if(typeof prepareExplorationGpuLighting==="function")prepareExplorationGpuLighting();
  }
  // Clear in physical canvas coordinates before installing the view transform.
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle="#08080c";
  if(!(explorationTerrain&&combatGpu))ctx.fillRect(0,0,canvas.width,canvas.height);
  const anchor=battlefieldZoomAnchor();
  const density=BATTLEFIELD_RENDER_DENSITY;
  ctx.setTransform(
    density*battlefieldZoom,0,0,density*battlefieldZoom,
    density*anchor.x*(1-battlefieldZoom),
    density*anchor.y*(1-battlefieldZoom)
  );
  canvas.dataset.treeRenderer=directFirRendering()?'direct-mesh':'cached-images';
  const profile=globalThis.adventurePartyCombatPerformance;
  const timed=(name,fn)=>profile?profile.measure(name,fn):fn();
  timed('shadowSetup',()=>prepareCombatProjectedShadows(tiles));
  timed('terrain',()=>{drawFloor();drawWallTestFloorPlan();});
  if(explorationTerrain){ctx.save();clipExplorationFloor();}
  timed('shadowDraw',()=>drawArchitecturalWallShadows());
  if(explorationTerrain){ctx.restore();ctx.save();clipExplorationFloor();drawWallTestLineOfSightMask();ctx.restore();}

  /*
    R197: outline the union silhouette once before wall bodies enter the shared
    depth queue. Units/fog can still correctly cover the outline afterward.
  */
  const sceneWalls=architecturalWalls;
  if(!explorationTerrain){drawArchitecturalWallShapeOutline(sceneWalls);drawArchitecturalWallTopOutline(sceneWalls);}

  drawSpellAreaEffects();

  const actors=[];
  // Keep lethal targets visible while their queued death beat is pending;
  // only that beat changes their standing body to falling/prone scenery.
  for(const corpse of [game.player,...(game.allies||[]),...(game.enemies||[])])if(corpse&&deathPresentationActive(corpse)&&!corpse.fled&&shouldRenderUnitUnderPartyVisibility(corpse)){
    const p=unitDepthSortPoint(corpse);
    actors.push({sortY:p.y-.5,sortX:p.x,unit:true,groundCorpse:globalThis.adventurePartyCorpseProgress?.(corpse)>=1,groundRadius:{x:HEX_W*.6,y:HEX_H*.6},entity:corpse,fn:()=>drawStudioSpriteMob(corpse)});
  }
  const treeDecorations=visibleTreeDecorations(tiles);
  const firContacts=[];
  for(const tree of treeDecorations)drawFirContactShadow(tree,activeCombatTerrainTileSet(),firContacts);
  if(combatGpu&&firContacts.length)combatGpu.surface(firContacts,drawFirContactShadow.image,{category:'Fir contact',contactScale:combatShadowScale()});
  for(const tree of treeDecorations)drawTreeGroundShadow(tree);
  const tileSet=activeCombatTerrainTileSet();

  if(explorationTerrain)for(const torch of explorationTerrain.torches||[]){
    if(torch.mountWallId||!isHexVisibleToFriendlyParty((torch.visibilityHex||torch).x,(torch.visibilityHex||torch).y))continue;
    const c=screenPointForWorld(torch.world||worldPointForHex(torch.x,torch.y));
    actors.push({sortY:c.y+.4,sortX:c.x,fn:()=>drawExplorationTorch(torch)});
  }

  if(explorationTerrain)queueExplorationDoors(actors);
  if(typeof queueCombatEnvironmentActors==='function')queueCombatEnvironmentActors(actors);
  for(const wall of sceneWalls){
    const a=screenPointForWorld(wall.a);
    const b=screenPointForWorld(wall.b);
    actors.push({
      sortY:Math.max(a.y,b.y)+0.25,
      sortX:(a.x+b.x)/2,
      wall,gpuScenery:!!explorationTerrain,
      fn:()=>drawArchitecturalWallSegment(wall)
    });
  }

  for(const tree of treeDecorations){
    const c=hexCenter(tree.x,tree.y);
    const sortOffset=tree.occupied
      ? (tileSet.treeOccupiedSortOffset ?? -0.25)
      : (tileSet.treeBaseSortOffset ?? 3);

    actors.push({
      sortY:c.y+sortOffset,
      sortX:c.x,
      tree,gpuScenery:directFirRendering(),fn:()=>drawTreeDecoration(tree)
    });
  }

  /*
    R94 volumetric fog participates in the same isometric depth ordering as
    units and trees. Off-map/off-screen fog cells are not rendered, so a wall
    that logically continues beyond the battlefield does not reveal map bounds
    or terrain detail outside the visible play space.
  */
  for(const effect of game.areaEffects || []){
    if(effect.type!=="fog") continue;

    let fogFrontSortY=-Infinity;
    let fogFrontSortX=0;

    for(const cell of effect.cells || []){
      if(
        !inside(cell.x,cell.y) ||
        !isHexOnBattlefieldScreen(cell.x,cell.y,HEX_W)
      ){
        continue;
      }

      const c=hexCenter(cell.x,cell.y);
      fogFrontSortY=Math.max(fogFrontSortY,c.y+0.5);
      fogFrontSortX=c.x;
      actors.push({
        sortY:c.y+0.5,
        sortX:c.x,
        fn:()=>drawFogVolumeCell(cell,effect)
      });
    }

    if(Number.isFinite(fogFrontSortY)){
      actors.push({
        sortY:fogFrontSortY+0.02,
        sortX:fogFrontSortX,
        fn:()=>drawFogEffectOutline(effect)
      });
    }
  }

  if(!deathPresentationActive(game.player)){
    const c=unitDepthSortPoint(game.player);
    actors.push({
      sortY:c.y,
      sortX:c.x,
      unit:true,entity:game.player,
      fn:()=>drawFighter(game.player)
    });
  }

  for(const ally of game.allies || []){
    if(deathPresentationActive(ally) || ally.fled) continue;

    const c=unitDepthSortPoint(ally);

    actors.push({
      sortY:c.y,
      sortX:c.x,
      unit:true,entity:ally,
      fn:()=>
        ally.type==="mage"
          ? drawFriendlyMage(ally)
          : drawFriendlyArcher(ally)
    });
  }

  for(const enemy of game.enemies){
    if(deathPresentationActive(enemy) || enemy.fled) continue;
    if(!shouldRenderUnitUnderPartyVisibility(enemy)) continue;

    const depth=unitDepthSortPoint(enemy);

    actors.push({
      sortY:depth.y,
      sortX:depth.x,
      unit:true,entity:enemy,wrapWeb:true,
      fn:()=>
        unitPoseDefinition(enemy)?.spriteLayout
          ? drawStudioSpriteMob(enemy)
          : enemy.species==="orc"
          ? drawOrc(enemy)
          : enemy.type==="juvenile-red-dragon"
            ? drawLargeTestMob(enemy)
            : drawKobold(enemy)
    });
  }

  if(explorationTerrain?.isRenderableHex)for(let i=actors.length-1;i>=0;i--)if(actors[i].unit&&actors[i].entity&&!explorationTerrain.isRenderableHex(actors[i].entity.x,actors[i].entity.y))actors.splice(i,1);

  // Project all visible unit shadows onto terrain before walls, trees, units
  // and fog. Long evening shadows must never paint over another character.
  if(globalThis.adventurePartySun){
    if(explorationTerrain){ctx.save();clipExplorationFloor();}
    globalThis.adventurePartySun.drawingGround=true;
    try{for(const actor of actors)if(actor.unit){globalThis.adventurePartySun.caster=actor.entity;actor.fn();}}
    finally{globalThis.adventurePartySun.caster=null;globalThis.adventurePartySun.drawingGround=false;if(explorationTerrain)ctx.restore();}
  }

  queueFlyingArrowGpuShadow();
  if(combatGpu?.flushProjectedShadows)combatGpu.flushProjectedShadows();else combatGpu?.projectedShadows?.flush();

  actors.sort(
    (a,b)=>{
      // Same-row foliage must not exchange painter order due to tiny
      // camera-projection rounding differences between adjacent roots.
      const depth=a.sortY-b.sortY;
      return Math.abs(depth)>1e-6?depth:a.sortX-b.sortX;
    }
  );

  const hasWeb=game.areaEffects?.some(effect=>effect.type==="web");
  if(!hasWeb&&typeof clearRaisedWeb==="function")clearRaisedWeb();
  const orderActors=explorationTerrain?explorationEncounterApi.orderSurfaceActors:combatGpu?.orderSurfaceActors;
  const outlineActors=orderActors?orderActors(actors,screenPointForWorld,u=>worldPointForHex(u.x,u.y),unitDepthSortPoint):actors;
  const cover=combatGpu?.groundCover,puddleMovers=[];
  if(cover){
    const origin=screenPointForWorld({x:0,y:0});
    const movers=outlineActors.filter(a=>a.unit&&a.entity).map(a=>{const p=unitDepthSortPoint(a.entity),w=battlefieldProjectVector({x:p.x-origin.x,y:p.y-origin.y},true);if(!a.groundCorpse){const direction=HEX_DIRS[facingDirectionIndex(a.entity)],forward=worldPointForHex(direction.x,direction.y);puddleMovers.push({entity:a.entity,x:w.x,y:w.y,heading:Math.atan2(forward.y/.568329,forward.x)});}return [w.x,w.y,a.groundCorpse?.85:.40,a.groundCorpse?.94:.62];});
    const spreadingCrowns=outlineActors.filter(a=>adventurePartyTreeEnvironment.isBroadleaf(a.tree)).map(a=>{
      const center=hexCenter(a.tree.x,a.tree.y),radius=combatTreeCollision(a.tree.tileIndex,globalThis.adventurePartySeasons?.getSeason()||'summer').canopyRadius*(tileSet.treeDrawHeight||240)*treeSizeScale(a.tree)/210;
      return {x:center.x,y:center.y,sortY:a.sortY,rx:radius,ry:radius*.568329};
    });
    const treeExclusions=[];
    for(const tree of game.firDecorations?.values()||[]){const profile=adventurePartyTreeEnvironment.treeExclusionProfile(tree);if(profile.radius>0)treeExclusions.push({...worldPointForHex(tree.x,tree.y),width:HEX_W,row:HEX_ROW,species:tree.species,...profile});}
    const fallenLeaves=oakGroundLeafDeposits(tileSet);
    timed('groundCover',()=>cover.prepare(movers,outlineActors.filter(a=>a.groundCorpse&&a.entity),spreadingCrowns,treeExclusions,fallenLeaves,treeWoodPressure().capsules,treeWoodPressure().strength));ensureGroundCoverAnimation();
  }
  combatGpu?.drawPuddles?.(puddleMovers);ensureGroundCoverAnimation();
  let leafSortCursor=-1e9;
  hiddenOutlineUnits=[];
  for(let actorIndex=0;actorIndex<outlineActors.length;actorIndex++){
    const actor=outlineActors[actorIndex];drawOakAirborneLeaves(tileSet,leafSortCursor,actor.sortY);leafSortCursor=actor.sortY;if(cover)timed('groundCover',()=>cover.drawUntil(actor.sortY));hiddenOutlineCapture=actor.unit?{index:actorIndex}:null;
    if(combatGpu&&!actor.gpuScenery)combatGpu.prepareOverlay();
    if(actor.wrapWeb&&hasWeb)drawMobWithWeb(actor.entity,actor.fn);
    else actor.fn();
  }

  drawOakAirborneLeaves(tileSet,leafSortCursor,1e9);
  if(cover)timed('groundCover',()=>cover.drawUntil(Infinity));
  hiddenOutlineCapture=null;
  if(combatGpu)combatGpu.prepareOverlay();
  drawPersistentLightSpellFx();
  drawPersistentShieldSpellFx();
  drawPersistentSleepStatusFx();
  drawPersistentUnconsciousStatusFx();
  drawPersistentConfusionStatusFx();
  drawPersistentTauntStatusFx();
  drawPersistentCharmStatusFx();
  drawColorSprayFx();
  drawMagicEffectFx();
  drawAreaDamageFx();
  drawDragonBreathFx();
  drawFireballExplosionFx();
  drawFireDamageFx();

  drawProjectileFx();

  /*
    R215: blackout is binary by tactical hex. The center point determines LOS;
    a visible center reveals the complete hex, while an unseen center leaves the
    complete hex darkened. UI/message/text passes remain above the LOS mask.
  */
  if(!explorationTerrain)drawWallTestLineOfSightMask();

  /*
    R133: visible masonry is repainted after the LOS overlay. The darkness
    therefore begins behind the occluding wall face instead of drawing its
    diagonal shadow across the front of a wall the party can actually see.
  */
  if(explorationTerrain)drawExplorationDarknessVolumes();
  else drawVisibleArchitecturalWallsOverLOS();
  timed('hiddenOutlines',()=>drawHiddenUnitOutlines(outlineActors));

  /* R170 weather is battlefield-only; UI text remains above it. */
  drawWeatherVfx(performance.now());

  /*
    R185: the one-second death marker is tactical foreground feedback rather
    than physical scenery. Draw it after the post-LOS masonry repaint so a
    directly adjacent north wall cannot hide the skull-and-crossbones marker.
    drawDeathFx() still performs its own wall-test visibility check.
  */
  // Death skull overlay removed; retain animated corpses.
  drawCombatMessageBox();

  /*
    R125: white battlefield text is a dedicated final foreground pass.
    Speech/incantations and friendly-fire warnings are therefore never
    painted beneath other battlefield labels or effects.
  */
  drawUnitBarks();
  drawActivityDetectedFx();
  drawAimFriendlyFireWarning();
  if(currentScreen==="spell-preview"&&typeof spellPreviewDrawDevelopmentLabels==="function")spellPreviewDrawDevelopmentLabels();
  ctx.restore();
  if(globalThis.adventurePartyShowPerformance!==false){
  // Screen-space diagnostics: actual battlefield frames, not pose sample rate.
  ctx.save();ctx.setTransform(BATTLEFIELD_RENDER_DENSITY,0,0,BATTLEFIELD_RENDER_DENSITY,0,0);
  const measured=typeof combatFrames!=='undefined'?combatFrames?.diagnostics().recentFps:0;
  ctx.font='12px monospace';ctx.textAlign='left';ctx.textBaseline='bottom';
  ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(7,BATTLEFIELD_LOGICAL_HEIGHT-29,globalThis.adventurePartyPerformanceMode==='fps'?90:205,23);
  ctx.fillStyle='#d5f5dd';ctx.fillText('FPS '+(measured?measured.toFixed(1):'—')+(globalThis.adventurePartyPerformanceMode==='fps'?'':' | Models uncapped'),12,BATTLEFIELD_LOGICAL_HEIGHT-10);
  if(globalThis.adventurePartyPerformanceMode!=='fps')globalThis.drawCombatPerformanceChart?.(ctx,BATTLEFIELD_LOGICAL_WIDTH);
  ctx.restore();
  }
  if(typeof prepareCombatTerrainAhead==='function')timed('terrainAhead',()=>prepareCombatTerrainAhead());
  if(combatGpu)combatGpu.end();
}

// The landed pool is stable world data; birth/landing visibility remains on GPU.
function treeGroundLeafDeposits(tileSet,state,oak){
 if(!state?.leafDeposits||!oak)return null;
 if(state.worldLeafSource!==state.leafDeposits){const center=worldPointForHex(oak.x,oak.y),yaw=state.fallYaw??(terrainHash(oak.x+7901,oak.y-5107)%(tileSet.treeRotationFrames||1))*Math.PI/6,c=Math.cos(yaw),s=Math.sin(yaw),scale=(tileSet.treeDrawHeight||240)/210;

 state.worldLeafSource=state.leafDeposits;state.worldLeafDeposits=[];
 if(state.leafDeposits.length){
 const points=state.leafDeposits.map(p=>({x:center.x+(c*p.x+s*p.z)*scale,y:center.y+(-s*p.x+c*p.z)*scale*.568329}));
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys),cx=(left+right)/2,cy=(top+bottom)/2,rx=(right-left)/2,ry=(bottom-top)/2,step=(128/3)*.18;
 const hash=(x,y,salt)=>{const v=Math.sin(x*127.1+y*311.7+salt*74.7)*43758.5453123;return v-Math.floor(v);};
 for(let gx=Math.floor(left/step);gx<=Math.ceil(right/step);gx++)for(let gy=Math.floor(top/(step*.568329));gy<=Math.ceil(bottom/(step*.568329));gy++){
 const x=(gx+hash(gx,gy,1))*step,y=(gy+hash(gx,gy,2))*step*.568329,dx=(x-cx)/Math.max(1,rx),dy=(y-cy)/Math.max(1,ry),angle=Math.atan2(dy,dx),edge=1+.10*Math.sin(angle*5)+.06*Math.sin(angle*9+1.7),d=Math.hypot(dx,dy)/edge;
 const density=.84*Math.max(0,Math.min(1,(1-d)/.32));if(hash(gx,gy,3)>density)continue;
 state.worldLeafDeposits.push({x,y,seed:hash(gx,gy,4),type:oak.species==='sweet-birch'?7:oak.species==='american-beech'?6:oak.species==='sugar-maple'?5:4,field:state.startedAt/1000+2.8+hash(gx,gy,5)*2.9,key:'fallen-patch:'+oak.x+','+oak.y+':'+gx+','+gy});
 }
 }
 }
 return state.worldLeafDeposits;
}
function drawTreeAirborneLeaves(tileSet,low,high,state,oak){
 if(!state||!oak||state.settled||globalThis.adventurePartySeasons?.getSeason()==='winter'||!directFirRendering())return;
 const tree={...oak},center=hexCenter(oak.x,oak.y),scale=(tileSet.treeDrawHeight||240)/210;
 liveFirTreeRender(tileSet,tree,{host:combatGpu,center,scale,particlesOnly:true,low,high});
}

function oakGroundLeafDeposits(tileSet){const sources=treeFallEntries().map(({tree,state})=>treeGroundLeafDeposits(tileSet,state,tree)).filter(Boolean);if(!game.allLeafSources||sources.length!==game.allLeafSources.length||sources.some((s,i)=>s!==game.allLeafSources[i])){game.allLeafSources=sources;game.allTreeLeafDeposits=sources.flat();}return game.allTreeLeafDeposits;}
function drawOakAirborneLeaves(tileSet,low,high){for(const {tree,state} of treeFallEntries())drawTreeAirborneLeaves(tileSet,low,high,state,tree);}

