/* Combat owner: combat-effect-animation.js. Classic-script boundary; shared engine state and
 * service dependencies are documented in docs/COMBAT_ARCHITECTURE.md.
 * Extracted without changing rule or presentation bodies. */

// Shared physical-arrow silhouette for flight and retained impacts.
function drawCombatArrowSilhouette(tail,tip,{shadow=true}={}){
  const dx=tip.x-tail.x,dy=tip.y-tail.y,length=Math.hypot(dx,dy)||1;
  const ux=dx/length,uy=dy/length,nx=-uy,ny=ux;
  function shape(offsetX,offsetY,isShadow){
    ctx.strokeStyle=isShadow?'rgba(0,0,0,.38)':'#080808';
    ctx.lineWidth=isShadow?2.3:1.7;
    ctx.beginPath();ctx.moveTo(tail.x+offsetX,tail.y+offsetY);
    ctx.lineTo(tip.x+offsetX,tip.y+offsetY);ctx.stroke();
    ctx.strokeStyle=isShadow?'rgba(0,0,0,.38)':'#ffffff';ctx.lineWidth=1.5;
    ctx.beginPath();
    for(const side of [-1,1]){
      ctx.moveTo(tail.x+ux*5+offsetX,tail.y+uy*5+offsetY);
      ctx.lineTo(tail.x+nx*side*2.6+offsetX,tail.y+ny*side*2.6+offsetY);
    }
    ctx.stroke();
  }
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  if(shadow){ctx.save();ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=2;shape(2,3,true);ctx.restore();}
  shape(0,0,false);ctx.restore();
}

async function animateArrowProjectile(attacker,defender,hit){
  const from=hexCenter(attacker.x,attacker.y);
  const to=hexCenter(defender.x,defender.y);

  const startPoint={
    x:from.x,
    y:from.y-16
  };

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
    if(projectileFx!==ownedFx)return;

    if(t>=1) break;

  }

  projectileFx=null;
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
