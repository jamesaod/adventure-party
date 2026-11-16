const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
(async()=>{const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true});try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8276/js/combat-ground-cover.mjs');
const result=await page.evaluate(async()=>{
 const T=await import('/assets/vendor/three/three.module.min.js'),{createGroundCover}=await import('/js/combat-ground-cover.mjs');
 const renderer=new T.WebGLRenderer({canvas:document.createElement('canvas'),antialias:false});renderer.setSize(256,256);renderer.setClearColor(0,0);renderer.autoClear=false;renderer.debug.onShaderError=(g,p,v,f)=>{throw Error(g.getShaderInfoLog(v)+g.getShaderInfoLog(f));};
 const tex=data=>{const t=new T.DataTexture(new Uint8Array(data),1,1);t.needsUpdate=true;return t;},coats=tex([0,0,0,0]),tracks=tex([0,0,0,0]),white=tex([255,255,255,255]),black=tex([0,0,0,255]),dark=tex([40,40,40,255]);
 const snow={texture:coats,footprintTexture:tracks,bounds:new T.Vector4(0,0,256,256)},scene=new T.Scene(),camera=new T.OrthographicCamera(0,256,0,256,-1,1),target=new T.WebGLRenderTarget(256,256),texture=t=>t;
 const cover=createGroundCover({tuning:{canopyEnabled:true,snowPress:true,wind:0},snow,texture,flush(){},markBackdrop(){},paint(mesh){scene.add(mesh);renderer.render(scene,camera);scene.remove(mesh);}});

 const face={grass:true,grassUnit:128/3,grassSquash:1,snowEligible:1,points:[{x:20,y:20},{x:236,y:20},{x:236,y:236},{x:20,y:236}]};
 function frame(channels,cut=0,light=white,zoom=1,movers=[]){coats.image.data.set(channels);coats.needsUpdate=true;tracks.image.data[0]=cut;tracks.needsUpdate=true;cover.begin({width:256,height:256,matrix:[1,0,0,1,0,0],anchor:{x:128,y:128},zoom});cover.collect([face],{lightMap:{layers:[light,black],left:0,top:0,spanWidth:256,spanHeight:256}});cover.prepare(movers);renderer.setRenderTarget(target);renderer.clear();cover.drawUntil(128);const first=cover.diagnostics().triangles;cover.drawUntil(Infinity);const total=cover.diagnostics().triangles;cover.drawUntil(Infinity);if(total!==cover.diagnostics().triangles)throw Error('Duplicate draw');if(!(first>0&&total>first))throw Error('Ordered interval batching');const pixels=new Uint8Array(256*256*4);renderer.readRenderTargetPixels(target,0,0,256,256,pixels);let count=0,brightness=0,signature=2166136261;for(const v of pixels)signature=Math.imul(signature^v,16777619)>>>0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>20){count++;brightness+=pixels[i]+pixels[i+1]+pixels[i+2];}return {count,brightness,triangles:total,signature};}
 const dry=frame([0,0,0,0]),dim=frame([0,0,0,0],0,dark),shallow=frame([255,0,0,0]),deep=frame([255,255,255,255]),cut=frame([255,255,255,255],255),low=frame([0,0,0,0],0,white,.7),near=frame([0,0,0,0],0,white,1.6);
 if(!(cover.diagnostics().canopyInstances>0))throw Error('No canopy blades rendered');
 if(!(dry.count>100&&dim.brightness<dry.brightness*.3&&shallow.count<dry.count&&deep.count<shallow.count&&cut.count>deep.count))throw Error(JSON.stringify({dry,dim,shallow,deep,cut,low}));
 const restored=frame([0,0,0,0]);if(restored.signature!==dry.signature)throw Error('Grass did not recover after snow cleared');
 if(cut.signature===dry.signature)throw Error('Footprints restored upright grass instead of exposing flattened blades');
 cover.setTuning({snowPress:false});const unpressed=frame([255,255,255,255],255);
 if(unpressed.signature!==dry.signature)throw Error('Pressure-off control did not preserve original geometry/shading');
 cover.setTuning({snowPress:true});const pressedAgain=frame([255,255,255,255],255);
 if(pressedAgain.signature!==cut.signature)throw Error('Pressure toggle was not reversible');
 if(pressedAgain.triangles!==unpressed.triangles)throw Error('Pressure changed geometry budget');
 cover.setTuning({wind:3});const windyPressed=frame([255,255,255,255],255);
 if(windyPressed.signature!==pressedAgain.signature)throw Error('Full snow load did not suppress wind');
 cover.setTuning({wind:0,height:2});const tallDry=frame([0,0,0,0]),tallBuried=frame([255,255,255,255]);
 if(tallBuried.count>tallDry.count*.01)throw Error('Tall grass protrudes through full snow');
 cover.setTuning({height:.4});
 frame([0,0,0,0]);frame([0,0,0,0]);if(!cover.diagnostics().layoutReused)throw Error('Stable layout was rebuilt');
 face.visibility=.5;frame([0,0,0,0]);if(cover.diagnostics().layoutReused)throw Error('Visibility edit missed');
 face.points[0].x+=1;frame([0,0,0,0]);if(cover.diagnostics().layoutReused)throw Error('Geometry edit missed');
 cover.scene('new-scene');frame([0,0,0,0]);if(cover.diagnostics().layoutReused)throw Error('Scene invalidation missed');
 cover.dispose();renderer.dispose();for(const t of [coats,tracks,white,black,dark,target])t.dispose();return {dry,dim,shallow,deep,cut,low};
});if(errors.length)throw Error(errors.join('\n'));console.log(result);console.log('PASS canopy grass GPU drawing, local exposure, burial, track exposure, depth intervals, zoom views, snow compression, footprint retention, melt recovery and pressure toggle');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
