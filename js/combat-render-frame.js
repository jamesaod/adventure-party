// Ray-marched local fog volumes: shared 3D noise, bounded count, no LOS changes.
let forestMistEnabled=false,forestMistState=null;
function forestMistActive(){return forestMistEnabled&&game?.condition==='grass'&&game?.session?.source==='combat-test';}
function queueForestMist(actors,tiles){
 if(!forestMistActive()||!combatGpu)return;
 const revision=[combatGpu.unitWaterSurface?.revision,game.testTrees?.length].join(':');
 if(forestMistState?.game!==game||forestMistState.revision!==revision){
  const patches=[];
  for(let x=MAP_MIN_X;x<=MAP_MAX_X;x+=2)for(let y=MAP_MIN_Y;y<=MAP_MAX_Y;y+=2){
   if(!inside(x,y))continue;const p=worldPointForHex(x,y),water=combatGpu.streamSample?.(p.x,p.y),river=water?.depth>.015;
   const woodland=(game.testTrees||[]).some(t=>hexDistance(t,{x,y})<=3);
   if(!river&&(!woodland||terrainRand(x,y,8301)>.24))continue;
   patches.push({x,y,p,river,seed:terrainRand(x,y,8302),rank:terrainRand(x,y,8303)+(river?1:0)});
  }
  patches.sort((a,b)=>b.rank-a.rank);forestMistState={game,revision,patches:patches.filter((p,i,list)=>list.slice(0,i).every(q=>hexDistance(p,q)>=3)).slice(0,12)};
 }
 const now=performance.now()/1000,solar=globalThis.adventurePartySolar?.state?.();
 const lights=(prepareCombatProjectedShadows.sources||[]).slice(0,4).map(l=>({x:l.vector[0],y:l.vector[2],z:l.vector[1],color:(l.source?.color||[255,190,110]).map(v=>v/255*Math.min(4,l.power||1))}));
 for(const patch of forestMistState.patches){
  if(!isHexOnBattlefieldScreen(patch.x,patch.y,HEX_W*4)||!isHexVisibleToFriendlyParty(patch.x,patch.y))continue;
  const c=hexCenter(patch.x,patch.y);
  actors.push({sortY:c.y+HEX_H*.5,sortX:c.x,gpuScenery:true,fn:()=>combatGpu.fogVolume({x:patch.p.x,y:patch.p.y,radius:3.2+patch.seed,height:patch.river?2.1:2.8,density:patch.river?.65:.4,time:now,solar,lights})});
 }
}

/* Combat owner: combat-render-frame.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

let groundCoverAnimation=null;
function hasEnvironmentAnimation(){return (game?.boulders||[]).some(r=>r.impactAt&&performance.now()-r.impactAt<3000)||forestMistActive()||combatGpu?.puddleEffectsActive?.()||(!!game?.testTrees?.length&&globalThis.adventurePartyTreeMotion?.active())||treeFallEntries().some(({state})=>!oakDebrisSettled(state))||combatGpu?.groundCover?.active||(globalThis.adventurePartySeasons?.getSeason()==='fall'&&game?.testTrees?.length&&combatFirTrees?.fallingLeafCount>0);}
function ensureGroundCoverAnimation(){
 if(groundCoverAnimation!==null||!hasEnvironmentAnimation()||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 groundCoverAnimation=requestCombatAnimationTick(()=>{groundCoverAnimation=null;if(currentScreen==='combat'&&game&&!game.over&&hasEnvironmentAnimation()){draw();ensureGroundCoverAnimation();}});
}
function deathPresentationActive(unit){return !!unit&&!unit.alive&&Number.isFinite(unit.deathPresentationStartedAt);}

function draw(){
  const explorationTerrain=typeof combatSceneTerrain==='undefined'?globalThis.explorationTerrain:combatSceneTerrain||globalThis.explorationTerrain;
  if(typeof combatFrames!=="undefined"&&combatFrames&&!combatFrames.rendering){combatFrames.request();return;}
  combatLightingFrame++;
  if(!game) return;
  const profile=globalThis.adventurePartyCombatPerformance;
  const timed=(name,fn)=>profile?profile.measure(name,fn):fn();
  profile?.begin();let finishSection=profile?.start('frameSetup')||(()=>{});
  game.treeMotionTime=performance.now()/1000;
  updateTreeEnvironment(performance.now());
  if(typeof updateCombatBoulderCarriers==='function')updateCombatBoulderCarriers();
  updateComputerCameraFollow();

  ensureFogAnimationLoop();
  syncBurningTreeAudio();
  ensureTransientUnitFxLoop();

  const tiles=visibleHexes();

  finishSection();
  if(combatGpu){
    if(!combatGpu.available)return;
    const p=screenPointForWorld({x:0,y:0}),u=battlefieldProjectVector({x:1,y:0}),v=battlefieldProjectVector({x:0,y:1});
    if(!combatGpu.begin({profileStarted:!!profile,width:BATTLEFIELD_LOGICAL_WIDTH,height:BATTLEFIELD_LOGICAL_HEIGHT,zoom:battlefieldZoom,anchor:battlefieldZoomAnchor(),matrix:[u.x,u.y,v.x,v.y,p.x,p.y]}))return;
    if(typeof prepareExplorationGpuLighting==="function")timed('lightingSetup',()=>prepareExplorationGpuLighting());
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
  timed('shadowSetup',()=>prepareCombatProjectedShadows(tiles));
  timed('terrain',()=>{drawFloor();drawWallTestFloorPlan();});
  if(explorationTerrain){ctx.save();clipExplorationFloor();}
  timed('shadowDraw',()=>drawArchitecturalWallShadows());
  if(explorationTerrain){ctx.restore();ctx.save();clipExplorationFloor();drawWallTestLineOfSightMask();ctx.restore();}

  /*
    R197: outline the union silhouette once before wall bodies enter the shared
    depth queue. Units/fog can still correctly cover the outline afterward.
  */
  finishSection=profile?.start('sceneQueue')||(()=>{});
  const sceneWalls=architecturalWalls;
  if(!explorationTerrain){drawArchitecturalWallShapeOutline(sceneWalls);drawArchitecturalWallTopOutline(sceneWalls);}

  drawSpellAreaEffects();

  const actors=[];
 if(typeof queueCombatBoulders==='function')queueCombatBoulders(actors);
  queueForestMist(actors,tiles);
  // Keep lethal targets visible while their queued death beat is pending;
  // only that beat changes their standing body to falling/prone scenery.
  for(const corpse of [game.player,...(game.allies||[]),...(game.enemies||[])])if(corpse&&deathPresentationActive(corpse)&&!corpse.fled&&shouldRenderUnitUnderPartyVisibility(corpse)){
    const p=unitDepthSortPoint(corpse);
    actors.push({sortY:p.y-.5,sortX:p.x,unit:true,groundCorpse:globalThis.adventurePartyCorpseProgress?.(corpse)>=1,groundRadius:{x:HEX_W*.6*(corpse.corpseDropInPlace?Math.max(1,(corpse.heightInches||144)/72):1),y:HEX_H*.6*(corpse.corpseDropInPlace?Math.max(1,(corpse.heightInches||144)/72):1)},entity:corpse,fn:()=>drawStudioSpriteMob(corpse)});
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

  finishSection();finishSection=profile?.start('unitShadows')||(()=>{});
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

  finishSection();finishSection=profile?.start('actorOrdering')||(()=>{});
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
  finishSection();
  const cover=combatGpu?.groundCover,puddleMovers=[];
  if(cover){
    finishSection=profile?.start('coverInputs')||(()=>{});
    const origin=screenPointForWorld({x:0,y:0});
    const movers=outlineActors.filter(a=>a.unit&&a.entity).map(a=>{const p=unitDepthSortPoint(a.entity),w=battlefieldProjectVector({x:p.x-origin.x,y:p.y-origin.y},true);{const direction=HEX_DIRS[facingDirectionIndex(a.entity)],forward=worldPointForHex(direction.x,direction.y);puddleMovers.push({entity:a.entity,corpse:!!a.groundCorpse,scale:enlargeVisualScale(a.entity),x:w.x,y:w.y,heading:Math.atan2(forward.y/.568329,forward.x)});}return [w.x,w.y,a.groundCorpse?.85:.40,a.groundCorpse?.94:.62];});
    const spreadingCrowns=outlineActors.filter(a=>adventurePartyTreeEnvironment.isBroadleaf(a.tree)).map(a=>{
      const center=hexCenter(a.tree.x,a.tree.y),radius=combatTreeCollision(a.tree.tileIndex,globalThis.adventurePartySeasons?.getSeason()||'summer').canopyRadius*(tileSet.treeDrawHeight||240)*treeSizeScale(a.tree)/210;
      return {x:center.x,y:center.y,sortY:a.sortY,rx:radius,ry:radius*.568329};
    });
    const treeExclusions=[];
    for(const tree of game.firDecorations?.values()||[]){const profile=adventurePartyTreeEnvironment.treeExclusionProfile(tree);if(profile.radius>0)treeExclusions.push({...worldPointForHex(tree.x,tree.y),width:HEX_W,row:HEX_ROW,species:tree.species,...profile});}
    const fallenLeaves=oakGroundLeafDeposits(tileSet);
    finishSection();
    timed('groundCover',()=>cover.prepare(movers,outlineActors.filter(a=>a.groundCorpse&&a.entity),spreadingCrowns,treeExclusions,fallenLeaves,treeWoodPressure().capsules,treeWoodPressure().strength));ensureGroundCoverAnimation();
  }
  timed('waterEffects',()=>combatGpu?.drawPuddles?.(puddleMovers));ensureGroundCoverAnimation();
  let leafSortCursor=-1e9;
  hiddenOutlineUnits=[];
  for(let actorIndex=0;actorIndex<outlineActors.length;actorIndex++){
    const actor=outlineActors[actorIndex];drawOakAirborneLeaves(tileSet,leafSortCursor,actor.sortY);leafSortCursor=actor.sortY;if(cover)timed('groundCover',()=>cover.drawUntil(actor.sortY));hiddenOutlineCapture=actor.unit?{index:actorIndex}:null;
    if(combatGpu&&!actor.gpuScenery)combatGpu.prepareOverlay();
    timed('actorDispatch',()=>{if(actor.wrapWeb&&hasWeb)drawMobWithWeb(actor.entity,actor.fn);else actor.fn();});
  }

  drawOakAirborneLeaves(tileSet,leafSortCursor,1e9);
  if(cover)timed('groundCover',()=>cover.drawUntil(Infinity));
  hiddenOutlineCapture=null;
  if(combatGpu)combatGpu.prepareOverlay();
  finishSection=profile?.start('foregroundFx')||(()=>{});
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
  finishSection();finishSection=profile?.start('visibilityOverlays')||(()=>{});

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
  finishSection();
  timed('hiddenOutlines',()=>drawHiddenUnitOutlines(outlineActors));

  /* R170 weather is battlefield-only; UI text remains above it. */
  timed('weatherVfx',()=>drawWeatherVfx(performance.now()));
  finishSection=profile?.start('hudLabels')||(()=>{});

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
  for(const unit of allUnits())if(unit?.alive&&!unit.fled&&shouldRenderUnitUnderPartyVisibility(unit))drawHpBar(unit,unit.faction==="player"?"#94e084":"#df6b6b",true);
  drawUnitBarks();
  drawActivityDetectedFx();
  drawAimFriendlyFireWarning();
  if(currentScreen==="spell-preview"&&typeof spellPreviewDrawDevelopmentLabels==="function")spellPreviewDrawDevelopmentLabels();
  ctx.restore();
  finishSection();finishSection=profile?.start('diagnostics')||(()=>{});
  if(globalThis.adventurePartyShowPerformance===true){
  // Screen-space diagnostics: actual battlefield frames, not pose sample rate.
  ctx.save();ctx.setTransform(BATTLEFIELD_RENDER_DENSITY,0,0,BATTLEFIELD_RENDER_DENSITY,0,0);
  const measured=typeof combatFrames!=='undefined'?combatFrames?.diagnostics().recentFps:0;
  ctx.font='12px monospace';ctx.textAlign='left';ctx.textBaseline='bottom';
  ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(7,BATTLEFIELD_LOGICAL_HEIGHT-29,globalThis.adventurePartyPerformanceMode==='fps'?90:205,23);
  ctx.fillStyle='#d5f5dd';ctx.fillText('FPS '+(measured?measured.toFixed(1):'—')+(globalThis.adventurePartyPerformanceMode==='fps'?'':' | Models uncapped'),12,BATTLEFIELD_LOGICAL_HEIGHT-10);
  if(globalThis.adventurePartyPerformanceMode!=='fps')globalThis.drawCombatPerformanceChart?.(ctx,BATTLEFIELD_LOGICAL_WIDTH);
  ctx.restore();
  }
  finishSection();
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


document.getElementById('forestMistToggle')?.addEventListener('change',event=>{forestMistEnabled=event.target.checked;if(game){draw();ensureGroundCoverAnimation();}});
