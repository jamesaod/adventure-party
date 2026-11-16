const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});
 await page.goto('http://127.0.0.1:8276/js/combat-snow-depth.mjs');
 const report=await page.evaluate(async()=>{
  const T=await import('/assets/vendor/three/three.module.min.js'),{createSnowAccumulation}=await import('/js/combat-snow.mjs'),{sampleSnowFootfalls,snowFootprints}=await import('/js/combat-snow-footprints.mjs'),{SNOW_DEPTH_GLSL,SNOW_MAX_METRES}=await import('/js/combat-snow-depth.mjs');
  const renderer=new T.WebGLRenderer({canvas:document.createElement('canvas')});renderer.setSize(64,64);renderer.autoClear=false;renderer.debug.onShaderError=(gl,p,v,f)=>{throw Error(gl.getShaderInfoLog(v)+gl.getShaderInfoLog(f));};
  const snow=createSnowAccumulation(renderer),face={snowEligible:1,snowHex:'0,0',points:[{x:0,y:0},{x:64,y:0},{x:64,y:64},{x:0,y:64}]},view={matrix:[1,0,0,1,0,0],anchor:{x:0,y:0},zoom:1,width:64,height:64};
  const realNow=performance.now.bind(performance);let now=realNow();Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
  globalThis.adventurePartySnow={intensity:6000,showFlakes:false,paused:false,revision:1};snow.scene('probe',[0,0,64,64]);snow.setGround([face]);
  let frames=0;for(;frames<100;frames++){now+=250;snow.begin();snow.collect([face]);snow.end(view);if(snow.coatCoverage.depth>.999&&frames>12)break;}
  if(snow.coatCoverage.second!==1)throw Error('Could not reach powder completion');
  adventurePartySnow.paused=true;
  const group=new T.Group(),foot=new T.Bone(),toe=new T.Bone();foot.name='LeftFoot';toe.position.x=.15;foot.add(toe);group.add(foot);foot.position.y=.05;
  const camera=new T.OrthographicCamera(-1,1,1,-1,.1,100);camera.position.set(0,4,4);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const entity={alive:true},options={x:30,y:32,width:20,height:20,anchor:{x:.5,y:.5},groundMetresScale:[10,10],modelUnitsPerMetre:1,pixelsPerMetre:10};
  for(let i=0;i<4;i++){group.updateMatrixWorld(true);sampleSnowFootfalls(group,entity,{...options,x:30+i,walkSeconds:i*.03},view,camera);}
  if(snowFootprints.length<4||!snowFootprints.some(f=>f.x!==f.fromX))throw Error('No swept foot contacts');
  const center=snowFootprints.at(-1);now+=33;snow.begin();snow.collect([face]);snow.end(view);
  const target=new T.WebGLRenderTarget(512,512,{depthBuffer:false}),scene=new T.Scene(),material=new T.ShaderMaterial({uniforms:{snowAccumulation:{value:snow.texture},tracks:{value:snow.footprintTexture}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D snowAccumulation,tracks;varying vec2 vUv;'+SNOW_DEPTH_GLSL+'void main(){float h=snowPhysicalDepth(texture2D(snowAccumulation,vUv).rgb)/'+SNOW_MAX_METRES+';float cut=texture2D(tracks,vUv).r;gl_FragColor=vec4(h,max(0.,h-cut),cut,1.);}'});
  scene.add(new T.Mesh(new T.PlaneGeometry(2,2),material));renderer.setRenderTarget(target);renderer.render(scene,new T.Camera());const pixel=new Uint8Array(4);renderer.readRenderTargetPixels(target,Math.floor(center.x/64*512),Math.floor(center.y/64*512),1,1,pixel);
  if(!(pixel[2]>20&&pixel[1]<pixel[0]-20))throw Error('GPU track failed to lower snow: '+[...pixel]);
  const before=center.depth;adventurePartySnow.paused=false;for(let i=0;i<10;i++){now+=250;snow.begin();snow.collect([face]);snow.end(view);}if(!(center.depth<before))throw Error('Snow did not refill track');
  Object.defineProperty(performance,'now',{configurable:true,value:realNow});target.dispose();material.dispose();snow.dispose();renderer.dispose();
  return {frames,tracks:snowFootprints.length,gpuHeightPixel:[...pixel],refilled:true};
 });if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify(report));console.log('PASS actual deposited ground, swept foot geometry, GPU depression texture, and snowfall refill');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
