const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));await page.goto('http://127.0.0.1:8276/js/combat-unit-snow-occlusion.mjs');
 const result=await page.evaluate(async()=>{
  const T=await import('/assets/vendor/three/three.module.min.js'),{installUnitSnowOcclusion,bindUnitSnowOcclusion}=await import('/js/combat-unit-snow-occlusion.mjs');
  const renderer=new T.WebGLRenderer({canvas:document.createElement('canvas')});renderer.setSize(64,64);renderer.setClearColor(0,0);renderer.debug.onShaderError=(g,p,v,f)=>{throw Error(g.getShaderInfoLog(v)+g.getShaderInfoLog(f));};
  const texture=data=>{const t=new T.DataTexture(new Uint8Array(data),1,1);t.needsUpdate=true;return t;},coats=texture([0,0,0,255]),tracks=texture([0,0,0,255]);
  const surface={texture:coats,tracks,bounds:new T.Vector4(-10,-10,20,20)},matrix=new T.Matrix4(),target=new T.WebGLRenderTarget(64,64),scene=new T.Scene(),camera=new T.OrthographicCamera(-.5,.5,.9,-.3,.1,10);camera.position.z=2;camera.updateMatrixWorld();
  const {configureSnowShelter}=await import('/js/combat-snow-shelter.mjs');const results=[];
  for(const skinned of [false,true]){
   const geometry=new T.BoxGeometry(.12,.5,.1);geometry.translate(0,.25,0);const m=new T.MeshBasicMaterial({color:0xff0000});installUnitSnowOcclusion(m);let mesh,bone;
   if(skinned){const n=geometry.attributes.position.count;geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(n*4),4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(Array.from({length:n*4},(_,i)=>i%4?0:1),4));mesh=new T.SkinnedMesh(geometry,m);bone=new T.Bone();mesh.add(bone);mesh.bind(new T.Skeleton([bone]));}else mesh=new T.Mesh(geometry,m);
   scene.add(mesh);const count=(channels,cut=0,enabled=true)=>{coats.image.data.set([...channels,0]);coats.needsUpdate=true;tracks.image.data[0]=cut;tracks.needsUpdate=true;bindUnitSnowOcclusion(m,surface,matrix,1,enabled);renderer.setRenderTarget(target);renderer.render(scene,camera);const pixels=new Uint8Array(64*64*4);renderer.readRenderTargetPixels(target,0,0,64,64,pixels);let n=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>200)n++;return n;};
   const base=count([0,0,0]),three=count([255,0,0]),six=count([255,255,0]),nine=count([255,255,255]),trail=count([255,255,255],255),disabled=count([255,255,255],0,false);
   if(!(base>three&&three>six&&six>nine&&nine>0&&trail===base&&disabled===base))throw Error('Burial/track test failed '+JSON.stringify({base,three,six,nine,trail,disabled}));
   if(bone){bone.position.y=.3;const lifted=count([255,255,255]);if(lifted<nine*1.5)throw Error('Lifted animated foot remains buried');}
   if(bone)bone.position.y=0;configureSnowShelter([{x:0,y:0}],[-10,-10,20,20],5);const sheltered=count([255,255,255]);if(sheltered!==base)throw Error('Fir shelter must expose feet at bare trunk '+sheltered+' vs '+base);configureSnowShelter([],[-10,-10,20,20],5);results.push({skinned,base,three,six,nine,trail,sheltered});scene.remove(mesh);geometry.dispose();m.dispose();
  }
  // A shallow corpse must stay buried even after its own snow cap grows.
  const {prepareCorpseSnow}=await import('/js/combat-corpse-snow.mjs');
  const body=new T.Mesh(new T.BoxGeometry(.3,.12,.3),new T.MeshStandardMaterial({color:0xffffff}));body.geometry.translate(0,.06,0);
  installUnitSnowOcclusion(body.material);const root=new T.Group();root.add(body);prepareCorpseSnow(root,{alive:false},{value:3});
  const cap=root.children.find(m=>m.userData.corpseSnowShell);cap.visible=false;
  body.material.userData.corpseSnowMetres.value=1;bindUnitSnowOcclusion(body.material,surface,matrix,1,true);
  coats.image.data.set([255,255,255,0]);coats.needsUpdate=true;tracks.image.data[0]=0;tracks.needsUpdate=true;
  scene.add(root);renderer.setRenderTarget(target);renderer.render(scene,camera);const corpsePixels=new Uint8Array(64*64*4);renderer.readRenderTargetPixels(target,0,0,64,64,corpsePixels);
  if(corpsePixels.some((v,i)=>i%4===3&&v>0))throw Error('Body rose above the snow');
  cap.visible=true;bindUnitSnowOcclusion(cap.material,surface,matrix,1,true);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,64,64,corpsePixels);if(!corpsePixels.some((v,i)=>i%4===3&&v>0))throw Error('Independent snow cap missing');
  scene.remove(root);body.geometry.dispose();body.material.dispose();
  renderer.dispose();coats.dispose();tracks.dispose();target.dispose();return results;
 });if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify(result));console.log('PASS real GPU static/skinned burial at 6/12/18 inches, lifted feet, trail openings and disabled/indoor path');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
