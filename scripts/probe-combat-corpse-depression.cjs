const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true});try{
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8276/js/combat-snow-footprints.mjs');
const result=await page.evaluate(async()=>{
 const T=await import('/assets/vendor/three/three.module.min.js'),m=await import('/js/combat-snow-footprints.mjs');
 const renderer=new T.WebGLRenderer();renderer.autoClear=false;
 const bounds=new T.Vector4(-2,-2,4,4),layer=m.createFootprintLayer(renderer,bounds);layer.resize(128,128);
 m.setFootprintCells(new Map([['a',{key:'a',triangles:[{a:{x:-2,y:-2},b:{x:2,y:-2},c:{x:2,y:2}},{a:{x:-2,y:-2},b:{x:2,y:2},c:{x:-2,y:2}}]}]]),()=>.4572);
 const body=new T.Group(),entity={alive:false};for(const [x,z,w,d] of [[0,0,.5,1.5],[.5,-.5,1,.3]]){const mesh=new T.Mesh(new T.BoxGeometry(w,.2,d));mesh.position.set(x,.1,z);body.add(mesh);}
 const matrix=new T.Matrix4().set(1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1);
 let target;const set=renderer.setRenderTarget.bind(renderer);renderer.setRenderTarget=t=>{if(t?.texture===layer.texture)target=t;set(t);};
 const at=(x,y)=>{const pixel=new Uint8Array(4);renderer.readRenderTargetPixels(target,Math.floor((x+2)/4*128),Math.floor((y+2)/4*128),1,1,pixel);return pixel[0];};
 m.pressCorpseIntoSnow(body,entity,matrix);layer.update(0);const first=[at(0,0),at(.6,-.5),at(.6,.5),at(1.5,1.5)];
 if(first.join()!=='255,255,0,0')throw Error('Body silhouette mismatch '+first);
 const pixels=new Uint8Array(128*128*4);renderer.readRenderTargetPixels(target,0,0,128,128,pixels);let banks=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i]===255&&pixels[i+1]!==0)throw Error('Bank inside occupied cut');if(pixels[i]===0&&pixels[i+1]>0)banks++;}if(!banks)throw Error('Missing raised edge field');
 layer.update(30);m.clearSnowFootprints();layer.update(0);if(at(0,0)!==255||!layer.hasHex('a'))throw Error('Snowfall/clear erased occupied depression');
 const revision=m.snowFootprintRevision();m.pressCorpseIntoSnow(body,entity,matrix);if(m.snowFootprintRevision()!==revision)throw Error('Rebaked settled pose');
 entity.alive=true;layer.update(0);if(at(0,0)!==0)throw Error('Revived body leaves occupied mask');
 m.clearCorpseDepressions();layer.dispose();renderer.dispose();return {first,refillBlocked:true,revivalClears:true};
});if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify(result));console.log('PASS actual GPU corpse silhouette, limb gaps, full-depth cut, blocked refill, cached bake and revival cleanup');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
