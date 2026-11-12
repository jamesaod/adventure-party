const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});
 await page.goto('http://127.0.0.1:8276/index.html');await page.waitForFunction(()=>typeof showCombat==='function');
 const results=await page.evaluate(async()=>{
  const results=[];
  for(const mode of ['grass','wall']){
   await showCombat(mode);await new Promise(r=>setTimeout(r,500));
   const oldCtx=ctx,oldRotation=battlefieldRotation,oldCamera={...camera};
   try{for(let angle=0;angle<6;angle++)for(const pan of [0,1]){
    battlefieldRotation=angle;camera.x=oldCamera.x+pan;
    const surfaces=combatSceneTerrain.spaces;
    const images=[];
    for(const cached of [false,true]){
     const canvas=document.createElement('canvas');canvas.width=540;canvas.height=300;const target=canvas.getContext('2d',{willReadFrequently:true});target.scale(.5,.5);ctx=target;
     if(cached)clipExplorationFloor();else{target.beginPath();for(const s of surfaces){const points=s.polygon.map(p=>screenPointForWorld(p));target.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))target.lineTo(p.x,p.y);target.closePath();}target.clip();}
     target.fillStyle='#fff';target.fillRect(0,0,1080,600);images.push(target.getImageData(0,0,540,300).data);
    }
    if(images[0].some((v,i)=>v!==images[1][i]))throw Error('Clip pixels differ '+mode+' '+angle+' '+pan);
   }}finally{ctx=oldCtx;battlefieldRotation=oldRotation;camera.x=oldCamera.x;camera.y=oldCamera.y;}
   for(let i=0;i<4;i++)await presentCombatFrame();results.push(mode+': 12 pixel-exact clip comparisons and live frame rendering');
  }return results;
 });if(errors.length)throw Error(errors.join('\n'));console.log(results.join('\n'));console.log('PASS no rendering errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
