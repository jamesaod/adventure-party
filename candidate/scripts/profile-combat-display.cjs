const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),headless:true,args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],optionalAssetMisses=[];
  page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()!=='error')return;const url=m.location().url||'';if(m.text().includes('404')&&/\/assets\/(prepared-combat|combat-units)\/direct-v1-mob-appearance-v1-[a-f0-9]{8}\.json\.gz$/.test(url)){optionalAssetMisses.push(url);return;}errors.push(m.text());});
  await page.addInitScript(()=>{let seed=322;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});await page.goto(new URL('index.html',process.env.GAME_BASE_URL||'http://127.0.0.1:8276/').href);
  await page.waitForFunction(()=>typeof showCombat==='function',{},{timeout:60000});
  await page.evaluate(()=>showCombat('grass'));
  await page.waitForFunction(()=>typeof game!=='undefined'&&game?.player&&combatSceneTerrain,{},{timeout:60000});
  await page.waitForFunction(()=>{const f=directionalUnitPoseFrame(game.player);return f?.image?.complete&&f.image.naturalWidth&&globalThis.adventurePartyDirectUnits;},{},{timeout:60000});
  console.log('Loaded',await page.evaluate(()=>({player:game.player.type,enemies:game.enemies.map(e=>e.type),screen:currentScreen})));
  const client=await page.context().newCDPSession(page);if(process.env.CPU_PROFILE){await client.send('Profiler.enable');await client.send('Profiler.start');}const report=await page.evaluate(async()=>{
   const {directUnitFrame,sampleDirectPose}=await import('./js/combat-direct-units.mjs');
   const {snapshotGpuCaster}=await import('./js/combat-gpu-casters.mjs');
   const source=game.player,frame=directUnitFrame(directionalUnitPoseFrame(source).image);
   if(!frame)throw Error('Player does not have a direct model');
   const triangles=s=>s.parts.reduce((n,p)=>n+p.groups.reduce((sum,g)=>sum+g.count/3,0),0);
   const live=sampleDirectPose(frame,source,undefined,performance.now(),100);
   const liveShadow=triangles(snapshotGpuCaster(live.asset.group,live.asset.camera));
   const corpse={...source,id:'profile-corpse',alive:false,deathPresentationStartedAt:performance.now()-30000,deathAnimationDurationMs:1000,deathWorldOffset:{x:0,y:0},deathRotationDelta:0};
   const deadFrame=directUnitFrame(directionalUnitPoseFrame(corpse).image);
   const started=performance.now(),deadPose=sampleDirectPose(deadFrame,corpse,undefined,performance.now(),100),bakeMs=performance.now()-started;
   const deadShadow=triangles(snapshotGpuCaster(deadPose.asset.group,deadPose.asset.camera));
   // Isolated encounter: same visible model, camera, terrain and count in each case.
   const original={enemies:game.enemies,allies:game.allies};game.enemies=[];
   const bodies=Array.from({length:12},(_,i)=>({...source,id:'profile-'+i,controller:'player',x:source.x+(i%4)-2,y:source.y+Math.floor(i/4)+1,walkPresentation:undefined,effects:[]}));
   game.allies=bodies;game.active=source.id;game.over=false;
   async function sample(dead){
    for(const e of bodies){e.alive=!dead;if(dead){e.deathPresentationStartedAt=performance.now()-30000;e.deathAnimationDurationMs=1000;e.deathWorldOffset={x:0,y:0};e.deathRotationDelta=0;}}
    for(let i=0;i<35;i++)await presentCombatFrame();
    const samples=[];
    for(let i=0;i<100;i++){await presentCombatFrame();samples.push(adventurePartyCombatPerformance.snapshot());}
    const counters={},cpu={};for(const s of samples){for(const [k,v] of Object.entries(s.counters))counters[k]=(counters[k]||0)+v/samples.length;for(const [k,v] of Object.entries(s.cpuMs))cpu[k]=(cpu[k]||0)+v/samples.length;}
    return {counters,cpu,gpu:globalThis.adventurePartyGpuPerformance?.snapshot()};
   }
   const alive=await sample(false),dead=await sample(true);
   const checks=[];
   const snow=await import('./js/combat-corpse-snow.mjs');
   async function changed(label,change){
    change();await presentCombatFrame();const refreshed=adventurePartyCombatPerformance.snapshot().counters;
    await presentCombatFrame();const reused=adventurePartyCombatPerformance.snapshot().counters;
    checks.push({label,misses:refreshed.corpseImageCacheMisses||0,hits:reused.corpseImageCacheHits||0});
   }
   const keys=new Set(bodies.map(e=>e.x+','+e.y));
   await changed('snow accumulation',()=>snow.advanceCorpseSnow(keys,.4));
   await changed('second corpse coat',()=>snow.advanceCorpseSnow(keys,.8));
   await changed('corpse snow depth',()=>snow.advanceCorpseSnow(keys,1.3));
   await changed('snow melting',()=>snow.meltCorpseSnow([...keys],.5));
   await changed('snow cleared',()=>snow.resetCorpseSnow());
   const realDraw=adventurePartyDirectUnits.draw;
   await changed('lighting changed',()=>{adventurePartyDirectUnits.draw=(gpu,image,o)=>realDraw(gpu,image,{...o,ambientPercent:o.ambientPercent*.7});});
   adventurePartyDirectUnits.draw=realDraw;
   await changed('camera rotated',()=>{battlefieldRotation=(battlefieldRotation+1)%6;});
   await changed('camera zoomed',()=>{battlefieldZoom*=.9;});
   game.enemies=original.enemies;game.allies=original.allies;
   return {model:source.type,liveShadow,deadShadow,bakeMs,alive,dead,checks,cache:combatGpu.diagnostics().corpseImageCache};
  });
  if(process.env.CPU_PROFILE){const {profile}=await client.send('Profiler.stop');fs.writeFileSync(process.env.CPU_PROFILE,JSON.stringify(profile));}report.errors=errors;report.optionalAssetMisses=optionalAssetMisses;const output=process.argv[2]||'.local/corpse-profile.json';fs.mkdirSync(require('node:path').dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify({model:report.model,liveShadow:report.liveShadow,deadShadow:report.deadShadow,bakeMs:report.bakeMs,aliveCpu:report.alive.cpu,deadCpu:report.dead.cpu,deadCounts:report.dead.counters,checks:report.checks,cache:report.cache,errors}));
  if(errors.length||report.checks.some(c=>!c.misses||!c.hits)||Math.round(report.dead.counters.corpseImageCacheHits||0)<12||report.cache.bytes>report.cache.maxBytes)throw Error('Corpse integration validation failed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

