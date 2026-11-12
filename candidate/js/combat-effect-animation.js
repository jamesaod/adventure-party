/* Presentation dependencies: playBowReleaseSound/playBowImpactSound in bow-audio.js;
 * presentCombatFrame in the shared scheduler bridge. No independent frame loop.
 */
/* Combat owner: combat-effect-animation.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

// Presentation-only projection using the same solar direction and physical scale as walls.
function combatArrowShadowPoint(screen,elevation=0,wall=null){
  const solar=globalThis.adventurePartySolar?.state?.();
  if(!solar||solar.direction.y<=.00001)return null;
  const style=typeof explorationEncounterApi!=='undefined'?explorationEncounterApi?.SCENE_STYLE:null;
  const terrain=typeof combatSceneTerrain!=='undefined'?combatSceneTerrain:null;
  const cell=style?.cellMetres||3,wallHeight=style?.wallMetres||3.5,wallPixels=style?.tacticalWallPixels||35;
  const cellW=terrain?.cellW||HEX_W*2,cellH=terrain?.cellH||cellW*HEX_ROW/(HEX_W*Math.sqrt(3)/2);
  const origin=screenPointForWorld({x:0,y:0});
  const point=battlefieldProjectVector({x:screen.x-origin.x,y:screen.y+elevation-origin.y},true);
  if(typeof isIndoorWorldPoint==='function'&&isIndoorWorldPoint(point))return null;
  const den=Math.max(solar.direction.y,Math.hypot(solar.direction.x,solar.direction.z)/6);
  const vx=solar.direction.x*cellW/cell,vy=solar.direction.z*cellH/cell,vh=den*wallPixels/wallHeight;
  let travel=elevation/vh;
  if(wall){
    const nx=-(wall.b.y-wall.a.y),ny=wall.b.x-wall.a.x,dot=vx*nx+vy*ny;
    if(Math.abs(dot)<1e-8)return null;
    travel=((point.x-wall.a.x)*nx+(point.y-wall.a.y)*ny)/dot;
    if(travel<0||elevation-vh*travel<0)return null;
  }
  return screenPointForWorld({x:point.x-vx*travel,y:point.y-vy*travel},Math.max(0,elevation-vh*travel));
}

// Shared physical-arrow silhouette for flight and retained impacts.
function drawCombatArrowSilhouette(tail,tip,{tailHeight=16,tipHeight=16,wall=null}={}){
  const visual=globalThis.AdventurePartyArrowVisual;
  function shape(a,b,isShadow){
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
    const ux=dx/length,uy=dy/length,nx=-uy,ny=ux;
    ctx.strokeStyle=isShadow?'rgba(0,0,0,.38)':visual.wood;ctx.lineWidth=visual.shaftWidth;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    ctx.strokeStyle=isShadow?'rgba(0,0,0,.38)':visual.feather;ctx.lineWidth=visual.featherStroke;
    // Long, narrow vanes hug the rear of the shaft instead of flaring into a V.
    ctx.beginPath();
    for(const side of [-1,1]){
      ctx.moveTo(a.x+ux*visual.featherStart+nx*side*(visual.featherWidth-visual.featherStroke)/2,a.y+uy*visual.featherStart+ny*side*(visual.featherWidth-visual.featherStroke)/2);
      ctx.lineTo(a.x+ux*(visual.featherStart+visual.featherLength)+nx*side*(visual.featherWidth-visual.featherStroke)/2,a.y+uy*(visual.featherStart+visual.featherLength)+ny*side*(visual.featherWidth-visual.featherStroke)/2);
    }
    ctx.stroke();
    ctx.fillStyle=isShadow?'rgba(0,0,0,.38)':visual.head;
    ctx.beginPath();ctx.moveTo(b.x+ux*visual.headLength,b.y+uy*visual.headLength);
    ctx.lineTo(b.x+nx*visual.headWidth/2,b.y+ny*visual.headWidth/2);
    ctx.lineTo(b.x-nx*visual.headWidth/2,b.y-ny*visual.headWidth/2);
    ctx.closePath();ctx.fill();
  }
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  if(typeof combatGpu!=='undefined'&&combatGpu?.projectedShadows){if(wall)queueCombatArrowGpuShadow(tail,tip,{tailHeight,tipHeight,wall});}
  else{
    const shadowTail=combatArrowShadowPoint(tail,tailHeight,wall),shadowTip=combatArrowShadowPoint(tip,tipHeight,wall);
    if(shadowTail&&shadowTip){ctx.save();ctx.shadowColor='rgba(0,0,0,.3)';ctx.shadowBlur=1.3;shape(shadowTail,shadowTip,true);ctx.restore();}
  }
  shape(tail,tip,false);ctx.restore();
}

async function animateArrowProjectile(attacker,defender,hit){
  const from=hexCenter(attacker.x,attacker.y);
  const to=hexCenter(defender.x,defender.y);

  const startPoint=attacker.bowReleaseScreenPoint||{x:from.x,y:from.y-16};
  delete attacker.bowReleaseScreenPoint;

  const environmentImpact=defender.environmentImpact||(!hit&&typeof resolveEnvironmentArrow==='function'?resolveEnvironmentArrow(attacker,defender):null);
  const endPoint=environmentImpact?environmentArrowScreen(environmentImpact):hit
    ? {x:to.x,y:to.y-15}
    : arrowMissEndpoint(attacker,defender);

  const distance=Math.hypot(
    endPoint.x-startPoint.x,
    endPoint.y-startPoint.y
  );

  const duration=combatEffectDuration(Math.max(
    130,
    Math.min(300,100+distance*0.22)
  ));

  const bowFlight=playBowReleaseSound(attacker);
  const started=performance.now();

  let ownedFx=null;
  while(true){
    const elapsed=performance.now()-started;
    const t=Math.min(1,elapsed/duration);

    projectileFx=ownedFx={
      kind:"arrow",
      start:startPoint,
      end:endPoint,
      t,
      arcHeight:Math.max(7,Math.min(18,distance*0.035))
    };

    await presentCombatFrame();
    if(projectileFx!==ownedFx){bowFlight?.stop();return {cancelled:true};}

    if(t>=1) break;

  }

  projectileFx=null;
  // Any failed shot, including walls, ground, glass and stray arrows, uses Mud Thud.
  // Successful target contact is confirmed by the resolver after Mirror Image.
  if(!hit)playBowImpactSound(attacker,false);
  if(environmentImpact)await finishEnvironmentArrow(attacker,environmentImpact);
  await presentCombatFrame();
}

async function animateSlingProjectile(attacker,defender,hit){
  const startPoint=slingLaunchPoint(attacker);
  const endPoint=hit
    ? slingImpactPoint(defender)
    : slingMissEndpoint(attacker,defender);

  const distance=Math.hypot(endPoint.x-startPoint.x,endPoint.y-startPoint.y);
  const duration=combatEffectDuration(Math.max(150,Math.min(320,110+distance*0.28)));
  const arcHeight=Math.max(18,Math.min(34,12+distance*0.08));
  const started=performance.now();

  let ownedFx=null;
  while(true){
    const elapsed=performance.now()-started;
    const t=Math.min(1,elapsed/duration);

    projectileFx=ownedFx={
      kind:"rock",
      start:startPoint,
      end:endPoint,
      t,
      arcHeight
    };

    await presentCombatFrame();
    if(projectileFx!==ownedFx)return;

    if(t>=1) break;


  }

  projectileFx=null;
  await presentCombatFrame();
}

async function animateMagicMissile(attacker,defender,index,total){
  const from=hexCenter(attacker.x,attacker.y);
  const to=hexCenter(defender.x,defender.y);
  const sideOffset=(index-(total-1)/2)*5;

  const start={x:from.x+sideOffset,y:from.y-20};
  const end={x:to.x+sideOffset*0.5,y:to.y-15};
  const duration=combatEffectDuration(190);
  const started=performance.now();

  let ownedFx=null;
  while(true){
    const elapsed=performance.now()-started;
    const t=Math.min(1,elapsed/duration);

    projectileFx=ownedFx={lightPath:{from:{x:attacker.x,y:attacker.y},to:{x:defender.x,y:defender.y}},kind:"magic-missile",start,end,t,arcHeight:0};
    await presentCombatFrame();
    if(projectileFx!==ownedFx)return;

    if(t>=1) break;

  }

  projectileFx=null;
  await presentCombatFrame();
}

async function animateElementalArrowProjectile(
  attacker,
  defender,
  kind="flame-arrow",
  index=0,
  total=1
){
  if(!attacker || !defender) return;

  const from=hexCenter(attacker.x,attacker.y);
  const to=hexCenter(defender.x,defender.y);

  const sideOffset=
    (
      index-
      (Math.max(1,total)-1)/2
    )*
    4;

  const start={
    x:from.x+sideOffset,
    y:from.y-20
  };

  const end={
    x:to.x+sideOffset*0.35,
    y:to.y-15
  };

  const distance=
    Math.hypot(
      end.x-start.x,
      end.y-start.y
    );

  const duration=combatEffectDuration(Math.max(
      170,
      Math.min(
        300,
        125+
        distance*0.24
      )
    ));

  const started=performance.now();

  let ownedFx=null;
  while(true){
    const elapsed=
      performance.now()-started;

    const t=
      Math.min(
        1,
        elapsed/duration
      );

    projectileFx=ownedFx={lightPath:{from:{x:attacker.x,y:attacker.y},to:{x:defender.x,y:defender.y}},
      kind,
      start,
      end,
      t,
      arcHeight:0
    };

    await presentCombatFrame();
    if(projectileFx!==ownedFx)return;

    if(t>=1) break;

  }

  projectileFx=null;
  // Only fiery arrows transfer heat; acid arrows share this animation.
  if(kind==="flame-arrow" && typeof combatGpu!=="undefined")combatGpu?.meltSnow?.([defender],1);
  await presentCombatFrame();
}

async function animateFireballProjectile(caster,targetHex){
  const startCenter=hexCenter(caster.x,caster.y);
  const endCenter=hexCenter(targetHex.x,targetHex.y);

  const start={
    x:startCenter.x,
    y:startCenter.y-18
  };

  const end=targetHex.windowImpact
    ? screenPointForWorld(targetHex.windowImpact,15)
    : {x:endCenter.x,y:endCenter.y-7};

  const duration=combatEffectDuration(280);
  const started=performance.now();

  let ownedFx=null;
  while(true){
    const elapsed=performance.now()-started;
    const t=Math.min(1,elapsed/duration);

    projectileFx=ownedFx={lightPath:{from:{x:caster.x,y:caster.y},to:{x:targetHex.x,y:targetHex.y}},
      kind:"fireball",
      start,
      end,
      t,
      arcHeight:0
    };

    await presentCombatFrame();
    if(projectileFx!==ownedFx)return;

    if(t>=1) break;

  }

  projectileFx=null;
  await presentCombatFrame();
}

async function animateFireballExplosion(targetHex,radiusHexes,blastCells=null){
  const duration=combatEffectDuration(820);
  const started=performance.now();
  const radius=Math.max(1,Number(radiusHexes)||1);
  const cells=(blastCells?.length ? blastCells : fireballBlastCells(targetHex))
    .map(cell=>({...cell}));

  addTerrainScorch(cells);
  igniteFirTrees(cells);
  const ownedFx=fireballExplosionFx={
    x:targetHex.x,
    y:targetHex.y,
    radiusHexes:radius,
    cells,
    maxVolumeDistance:Math.max(
      radius,
      ...cells.map(cell=>
        Number.isFinite(cell.volumeDistance)
          ? cell.volumeDistance
          : hexDistance(targetHex,cell)
      )
    ),
    started,
    duration
  };

  while(true){
    const elapsed=performance.now()-started;
    await presentCombatFrame();
    if(fireballExplosionFx!==ownedFx)return;
    if(elapsed>=duration) break;

  }

  fireballExplosionFx=null;
  await presentCombatFrame();
}

async function animateColorSprayEffect(caster,targetHex,cells){
  const duration=combatEffectDuration(1500);
  const started=performance.now();

  const ownedFx=colorSprayFx={
    casterId:caster.id,
    targetHex:{x:targetHex.x,y:targetHex.y},
    cells:(cells || []).map(cell=>({x:cell.x,y:cell.y})),
    started,
    duration
  };

  playColorSpraySound();

  while(true){
    const elapsed=performance.now()-started;
    await presentCombatFrame();
    if(colorSprayFx!==ownedFx)return;
    if(elapsed>=duration) break;

  }

  colorSprayFx=null;
  await presentCombatFrame();
}

async function animateMagicEffectOnUnits(units,kind="generic",options={}){
  const targets=(units || []).filter(unit=>unit?.alive && !unit.fled);
  if(!targets.length) return;

  const staggerMs=combatEffectDuration(Math.min(55,Math.max(24,260/Math.max(1,targets.length))));
  const effectDuration=combatEffectDuration(680);
  const started=performance.now();

  const ownedFx=magicEffectFx=targets.map((unit,index)=>({
    unitId:unit.id,
    kind,
    started:started+index*staggerMs,
    duration:effectDuration,
    soundPlayed:false
  }));

  const totalDuration=effectDuration+(targets.length-1)*staggerMs;

  while(true){
    const now=performance.now();

    magicEffectFx.forEach((fx,index)=>{
      if(!fx.soundPlayed && now>=fx.started){
        fx.soundPlayed=true;
        if(options.playSound!==false){
          playMagicEffectSound(fx.kind,index);
        }
      }
    });

    await presentCombatFrame();
    if(magicEffectFx!==ownedFx)return;
    if(now-started>=totalDuration) break;

  }

  magicEffectFx=[];
  await presentCombatFrame();
}

async function animateSpellSurfaceFlash(cells,color=[255,128,35]){
 const duration=combatEffectDuration(450),started=performance.now();const ownedFx=spellSurfaceFlashFx={cells,started,duration,color};
 try{while(performance.now()-started<duration){await presentCombatFrame();if(spellSurfaceFlashFx!==ownedFx)return;}}
 finally{if(spellSurfaceFlashFx===ownedFx){spellSurfaceFlashFx=null;await presentCombatFrame();}}
}

async function animateDragonBreath(dragon,plan){
  const duration=combatEffectDuration(1050);
  const started=performance.now();
  const source=dragonBreathSourceHex(dragon,plan.target);

  const ownedFx=dragonBreathFx={
    dragonId:dragon.id,
    source,
    directionIndex:source.directionIndex,
    cells:plan.cells.map(cell=>({...cell})),
    rangeHexes:Math.max(1,Number(dragon.breathWeapon?.rangeHexes)||9),
    started,
    duration
  };

  playDragonBreathSound();

  while(true){
    const elapsed=performance.now()-started;
    await presentCombatFrame();
    if(dragonBreathFx!==ownedFx)return;
    if(elapsed>=duration) break;

  }

  dragonBreathFx=null;
  await presentCombatFrame();
}

function drawArrowBloodBurst(burst){
  if(!isHexVisibleToFriendlyParty(burst.hex.x,burst.hex.y))return;
  const age=(performance.now()-burst.started)/1000;ctx.save();
  ctx.fillStyle='#74181b';ctx.globalAlpha=.9;
  ctx.filter='brightness('+Math.max(.08,Math.min(1,combatSpriteBrightness({...burst.hex,alive:true})))+')';
  for(const drop of burst.drops){const flightAge=age-(drop.delay||0);if(drop.settled||flightAge<0||flightAge>=drop.duration)continue;
    const t=flightAge/drop.duration,world={x:burst.origin.x+(drop.end.x-burst.origin.x)*t,y:burst.origin.y+(drop.end.y-burst.origin.y)*t};
    const height=Math.max(0,drop.height+drop.up*flightAge-drop.gravity*flightAge*flightAge/2),p=screenPointForWorld(world,height);
    ctx.beginPath();ctx.ellipse(p.x,p.y,drop.size,drop.size*1.45,0,0,Math.PI*2);ctx.fill();
  }ctx.restore();
}

// Continuous presentation flames. Stable particle phases prevent frame-to-frame popping.
function drawFlowingFlame(x,y,width,height,time,seed=0,alpha=1){
  const phase=time*.001, sway=Math.sin(phase*7+seed)*width*.22;
  ctx.save();ctx.globalAlpha*=alpha;ctx.globalCompositeOperation='lighter';
  const glow=ctx.createRadialGradient(x,y-height*.3,0,x,y-height*.3,height*.8);
  glow.addColorStop(0,'rgba(255,99,8,.17)');glow.addColorStop(1,'rgba(255,50,0,0)');ctx.fillStyle=glow;ctx.fillRect(x-height,y-height*1.3,height*2,height*2);
  for(let i=0;i<3;i++){
    const scale=1-i*.24,h=height*scale*(.88+.12*Math.sin(phase*11+seed)),w=width*scale;
    const gradient=ctx.createLinearGradient(x,y,x,y-h);gradient.addColorStop(0,i===2?'#fff1a3':'#ffb520');gradient.addColorStop(.45,i===2?'#ffb62b':'#f65b08');gradient.addColorStop(1,'rgba(215,35,0,0)');ctx.fillStyle=gradient;
    ctx.beginPath();ctx.moveTo(x-w*.5,y);ctx.bezierCurveTo(x-w,y-h*.4,x+sway-w*.2,y-h*.75,x+sway,y-h);ctx.bezierCurveTo(x+sway+w*.5,y-h*.65,x+w*.7,y-h*.2,x+w*.5,y);ctx.fill();
  }ctx.restore();
}
// One decoded asset, independent positioned voices; only active fires allocate nodes.
const burningTreeAudio={buffer:null,pending:null,failed:false,voices:new Map(),timer:null,next:0};
function syncBurningTreeAudio(){
  const state=burningTreeAudio,now=performance.now();if(now<state.next)return;state.next=now+200;
  const active=currentScreen==='combat'&&audioEnabled&&audioReady&&audioCtx?.state==='running';
  const fires=active?Object.values(game?.firFireStates||{}).filter(f=>f.state==='burning'):[],keys=new Set(fires.map(f=>f.x+','+f.y));
  for(const [key,voice] of state.voices)if(!keys.has(key)){voice.source.stop();voice.source.disconnect();voice.gain.disconnect();voice.pan.disconnect();state.voices.delete(key);}
  if(!fires.length){if(state.timer){clearInterval(state.timer);state.timer=null;}return;}
  if(!state.timer)state.timer=setInterval(syncBurningTreeAudio,250);
  if(!state.buffer){if(!state.pending&&!state.failed)state.pending=fetch('assets/audio/fire-crackling-loop.mp3').then(r=>{if(!r.ok)throw new Error('Fire audio '+r.status);return r.arrayBuffer();}).then(data=>audioCtx.decodeAudioData(data)).then(buffer=>{state.buffer=buffer;state.next=0;syncBurningTreeAudio();}).catch(error=>{state.failed=true;console.warn('Burning-tree audio unavailable',error);}).finally(()=>state.pending=null);return;}
  const listener=(game.session?.controlledActorId&&getUnitById(game.session.controlledActorId))||game.player||getUnitById(game.active),center=listener?hexCenter(listener.x,listener.y):{x:BATTLEFIELD_LOGICAL_WIDTH/2,y:BATTLEFIELD_LOGICAL_HEIGHT/2};
  for(const fire of fires){const key=fire.x+','+fire.y;let voice=state.voices.get(key);if(!voice){const source=audioCtx.createBufferSource(),gain=audioCtx.createGain(),pan=audioCtx.createStereoPanner();source.buffer=state.buffer;source.loop=true;source.connect(gain);gain.connect(pan);pan.connect(sfxGain);gain.gain.value=0;source.start(0,Math.random()*state.buffer.duration);voice={source,gain,pan};state.voices.set(key,voice);}
    const pos=hexCenter(fire.x,fire.y),distance=Math.hypot(pos.x-center.x,pos.y-center.y)/HEX_W;
    voice.gain.gain.setTargetAtTime(.24/(1+distance*distance*.18)/Math.sqrt(Math.max(1,fires.length*.35)),audioCtx.currentTime,.12);
    voice.pan.pan.setTargetAtTime(Math.max(-1,Math.min(1,(pos.x-center.x)/(HEX_W*7))),audioCtx.currentTime,.12);
  }
}
