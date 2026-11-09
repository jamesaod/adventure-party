/* Combat owner: combat-render-frame.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

function draw(){
  const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
  if(typeof combatFrames!=="undefined"&&combatFrames&&!combatFrames.rendering){combatFrames.request();return;}
  combatLightingFrame++;
  if(!game) return;

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
  prepareCombatProjectedShadows(tiles);
  drawFloor();
  drawWallTestFloorPlan();
  if(explorationTerrain){ctx.save();clipExplorationFloor();}
  drawArchitecturalWallShadows();
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
  for(const corpse of [game.player,...(game.allies||[]),...(game.enemies||[])])if(corpse&&!corpse.alive&&!corpse.fled&&shouldRenderUnitUnderPartyVisibility(corpse)){
    const p=unitDepthSortPoint(corpse);
    actors.push({sortY:p.y-.5,sortX:p.x,unit:true,entity:corpse,fn:()=>drawStudioSpriteMob(corpse)});
  }
  const treeDecorations=visibleTreeDecorations(tiles);
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

  if(game.player.alive){
    const c=unitDepthSortPoint(game.player);
    actors.push({
      sortY:c.y,
      sortX:c.x,
      unit:true,entity:game.player,
      fn:()=>drawFighter(game.player)
    });
  }

  for(const ally of game.allies || []){
    if(!ally.alive || ally.fled) continue;

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
    if(!enemy.alive || enemy.fled) continue;
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
  combatGpu?.projectedShadows?.flush();

  actors.sort(
    (a,b)=>a.sortY-b.sortY || a.sortX-b.sortX
  );

  const hasWeb=game.areaEffects?.some(effect=>effect.type==="web");
  if(!hasWeb&&typeof clearRaisedWeb==="function")clearRaisedWeb();
  const outlineActors=explorationTerrain?explorationEncounterApi.orderSurfaceActors(actors,screenPointForWorld,u=>worldPointForHex(u.x,u.y)):actors;
  hiddenOutlineUnits=[];
  for(let actorIndex=0;actorIndex<outlineActors.length;actorIndex++){
    const actor=outlineActors[actorIndex];hiddenOutlineCapture=actor.unit?{index:actorIndex}:null;
    if(combatGpu&&!actor.gpuScenery)combatGpu.prepareOverlay();
    if(actor.wrapWeb&&hasWeb)drawMobWithWeb(actor.entity,actor.fn);
    else actor.fn();
  }

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
  drawHiddenUnitOutlines(outlineActors);

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
  // Screen-space diagnostics: actual battlefield frames, not pose sample rate.
  ctx.save();ctx.setTransform(BATTLEFIELD_RENDER_DENSITY,0,0,BATTLEFIELD_RENDER_DENSITY,0,0);
  const measured=typeof combatFrames!=='undefined'?combatFrames?.diagnostics().recentFps:0;
  ctx.font='12px monospace';ctx.textAlign='left';ctx.textBaseline='bottom';
  ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(7,BATTLEFIELD_LOGICAL_HEIGHT-29,205,23);
  ctx.fillStyle='#d5f5dd';ctx.fillText('FPS '+(measured?measured.toFixed(1):'—')+' | Models 30 FPS',12,BATTLEFIELD_LOGICAL_HEIGHT-10);
  ctx.restore();
  if(combatGpu)combatGpu.end();
}
