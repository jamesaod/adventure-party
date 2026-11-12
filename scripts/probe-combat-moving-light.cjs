const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});
 await page.goto('http://127.0.0.1:8276/index.html');await page.waitForFunction(()=>typeof showCombat==='function');await page.evaluate(()=>showCombat('grass'));await page.waitForFunction(()=>game?.player&&combatSceneTerrain);
 const rows=await page.evaluate(async()=>{
  const u=game.player;u.inventory=[{equipped:true,catalogItemId:'flaming-sword-5',qty:1}];const from={x:u.x,y:u.y},to={x:u.x+1,y:u.y-1},rows=[];
  for(const rotation of [0,2,5]){battlefieldRotation=rotation;for(const t of [0,.25,.5,.75,1]){
   u.walkPresentation={from,to,t,seconds:t};await presentCombatFrame();
   const source=explorationRenderLights().find(s=>s.unitId===u.id),gpu=explorationGpuLighting.lights.find(s=>s.unitId===u.id),rule=illuminationSources().find(s=>s.unitId===u.id);
   if(!source||!gpu||Math.abs(source.x-(from.x+t))>1e-8||Math.abs(source.y-(from.y-t))>1e-8||rule.x!==from.x||rule.y!==from.y)throw Error('Light detached from moving holder');
   rows.push({rotation,t,x:source.x,y:source.y,gpuX:gpu.x,gpuY:gpu.y});
  }}return rows;
 });if(errors.length)throw Error(errors.join('\n'));console.log('PASS 15 live rendered movement positions across three camera rotations; GPU follows visual source; no rendering errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
