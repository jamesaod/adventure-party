const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text());});
 await page.route('**/snow-water-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Snow water check</title>'}));await page.goto('http://127.0.0.1:8276/snow-water-fixture');
 console.log(await page.evaluate(async()=>{
  const THREE=await import('/assets/vendor/three/three.module.min.js'),{createSnowAccumulation}=await import('/js/combat-snow.mjs?v=water1');
  const renderer=new THREE.WebGLRenderer();renderer.autoClear=false;const snow=createSnowAccumulation(renderer);
  snow.scene('water-check',[0,0,256,256]);snow.setGround([{grass:true,snowEligible:1,snowHex:'0,0',points:[{x:0,y:0},{x:256,y:0},{x:256,y:256},{x:0,y:256}]}]);
  const source={revision:1,level:.08,threshold:(x,y)=>x<64?-Infinity:y<128?.04:Infinity};snow.setWaterSource(()=>source);
  const view={matrix:[1,0,0,1,0,0],anchor:{x:0,y:0},zoom:1,width:256,height:256};globalThis.adventurePartySnow={revision:1,paused:true,intensity:0,fillRequested:true};
  const scene=new THREE.Scene(),camera=new THREE.Camera(),target=new THREE.WebGLRenderTarget(512,512,{depthBuffer:false}),material=new THREE.ShaderMaterial({uniforms:{map:{value:snow.texture}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D map;varying vec2 v;void main(){gl_FragColor=texture2D(map,v);}'});scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
  function tick(){snow.begin();snow.end(view);}
  function read(x,y){renderer.setRenderTarget(target);renderer.render(scene,camera);const p=new Uint8Array(4);renderer.readRenderTargetPixels(target,x*2,y*2,1,1,p);renderer.setRenderTarget(null);return [...p];}
  function check(label,x,y,wet){const p=read(x,y);if(wet?p.some(v=>v!==0):p[0]===0)throw Error(label+': '+p);}
  tick();check('stream fill',32,200,true);check('puddle fill',200,32,true);check('dry fill',200,200,false);
  source.level=0;tick();check('receded puddle',200,32,true);
  adventurePartySnow.depthAdjustments=[6];tick();check('dry puddle depth',200,32,false);check('stream depth',32,200,true);
  source.level=.08;tick();check('flooded snow',200,32,true);check('dry retained',200,200,false);
  adventurePartySnow.revision++;adventurePartySnow.paused=false;adventurePartySnow.intensity=1;adventurePartySnow.showFlakes=false;
  for(let i=0;i<16;i++){await new Promise(r=>setTimeout(r,260));tick();}
  check('stream snowfall',32,200,true);check('puddle snowfall',200,32,true);
  renderer.setRenderTarget(target);renderer.render(scene,camera);const pixels=new Uint8Array(512*512*4);renderer.readRenderTargetPixels(target,0,0,512,512,pixels);let dry=0;for(let y=0;y<512;y++)for(let x=0;x<512;x++){const v=pixels[(y*512+x)*4];if(x<128||y<256){if(v)throw Error('Snowfall on water texel '+x+','+y);}else dry+=v;}if(!dry)throw Error('No dry ground snowfall');
  snow.dispose();renderer.dispose();return 'PASS GPU fill, manual depth, receding/rising puddles, natural snowfall and dry banks';
 }));
 await page.goto('http://127.0.0.1:8276/terrain-lab.html?grassCanopy=1&v=water1');await page.waitForFunction(()=>!document.querySelector('#controls').disabled,null,{timeout:90000});
 await page.getByRole('button',{name:'Full cover',exact:true}).click();await page.waitForTimeout(1500);console.log('Live lab:',await page.locator('#status').textContent());
 const frame=page.frames().find(f=>f.url().includes('terrainLab=1'));console.log(await frame.evaluate(()=>{let wet=0,dry=0;for(let y=-2048;y<=2048;y+=16)for(let x=-2048;x<=2048;x+=16){const water=combatGpu.unitGroundSample(x,y).water,snow=combatGpu.snowGroundSample(x,y);if(water>.005){wet++;if(snow.some(v=>v>0))throw Error('Live water has snow at '+x+','+y+' water='+water+' snow='+snow);}else if(snow[0]>0)dry++;}if(!wet||!dry)throw Error('Missing wet/dry samples');return {wet,dry};}));if(errors.length)throw Error(errors.join('\n'));console.log('PASS live lab shader compilation and water exclusion');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});





