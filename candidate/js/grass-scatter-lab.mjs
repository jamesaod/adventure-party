import {solarState,weatherSolarState} from './solar-clock.mjs?v=R238C380';
import {GLTFLoader} from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
import * as T from '../assets/vendor/three/three.module.min.js';
import {createGroundCover,GROUND_COVER_DEFAULTS,coverField} from './combat-ground-cover.mjs?v=tree-snow-grains1';
const specs=[['height','Blade height',.25,3,.05,1],['width','Blade width',.25,3,.05,1],['spread','Clump spread',.25,2,.05,1],['bend','Blade bend',0,3,.05,1],['tufts','Tufts per cell',1,8,1,3],['wind','Wind strength',0,3,.05,1],['brightness','Leaf brightness',.5,1.6,.05,1],['dry','Dry color mix',0,1,.05,.65],['light','Light level',.1,1,.05,1],['zoom','Zoom',.5,3,.05,1.5]];
specs.push(['patchCoverage','Worn patch coverage',0,1,.05,.25],['patchSize','Patch size (metres)',.5,8,.1,3.4],['patchSoftness','Patch edge softness',.02,.5,.02,.4],['patchWear','Wear / bare soil',0,1,.05,1],['soilRelief','Soil bump strength',-3,3,.1,-1.8]);
for(const spec of specs)if(spec[0] in GROUND_COVER_DEFAULTS)spec[5]=GROUND_COVER_DEFAULTS[spec[0]];
const values=Object.fromEntries(specs.map(s=>[s[0],s[5]])),defaults={...values},controls=document.querySelector('#controls');
for(const [key,label,min,max,step,value] of specs){const row=document.createElement('label');row.htmlFor=key;row.textContent=label;const out=document.createElement('output');out.id=key+'Value';out.textContent=value;row.append(out);const slider=document.createElement('input');Object.assign(slider,{id:key,type:'range',min,max,step,value});slider.addEventListener('input',()=>{values[key]=+slider.value;out.textContent=slider.value;schedule();});controls.append(row,slider);}
const noon=weatherSolarState(solarState(12),{type:'clear'}),noonGain=Math.pow(noon.sky,1/2.2);
globalThis.adventurePartySolar={state:()=>noon};
const canvas=document.querySelector('#view'),host=document.querySelector('#viewport'),renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.autoClear=false;renderer.setClearColor(0x40512b,1);
const scene=new T.Scene(),camera=new T.OrthographicCamera(0,1,0,1,-1,1),tex=rgba=>{const t=new T.DataTexture(new Uint8Array(rgba),1,1);t.needsUpdate=true;return t;},zero=tex([0,0,0,0]),light=tex([255,255,255,255]),black=tex([0,0,0,255]);
let cover,timer,dirty=true,w=1,h=1;
// GPU queries are polled asynchronously: never wait for the GPU or call finish().
const gl=renderer.getContext(),gpuTimer=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pendingQueries=[];
let gpuMs=null,lastFrame=0,lastReport=0,cpuSamples=[],frameSamples=[],gpuSamples=[];
renderer.info.autoReset=false;
function pollGpu(){if(!gpuTimer)return;const disjoint=gl.getParameter(gpuTimer.GPU_DISJOINT_EXT);if(disjoint){for(const q of pendingQueries)gl.deleteQuery(q);pendingQueries.length=0;gpuMs=null;gpuSamples=[];return;}
 while(pendingQueries.length&&gl.getQueryParameter(pendingQueries[0],gl.QUERY_RESULT_AVAILABLE)){const q=pendingQueries.shift();gpuMs=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;gpuSamples.push(gpuMs);if(gpuSamples.length>60)gpuSamples.shift();gl.deleteQuery(q);}}
const average=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
document.addEventListener('visibilitychange',()=>{lastFrame=0;frameSamples=[];});

const orcScene=new T.Scene(),orcCamera=new T.OrthographicCamera(-1,1,1,-1,.01,100);
const orcAmbient=new T.HemisphereLight(0xdce8ff,0x655a43,.65*noon.sky),orcSun=new T.DirectionalLight(0xfff1d7,2.2);orcSun.position.set(noon.direction.x,noon.direction.y,noon.direction.z);orcScene.add(orcAmbient,orcSun);
let orcModel;
new GLTFLoader().load('assets/workshop-units/orc-warrior/e02aea9d2b721ee67f1fb8c9b794b2812aa3c450dd9bfacfdce81ed79ba91335.glb',g=>{
 orcModel=g.scene;orcModel.updateMatrixWorld(true);const box=new T.Box3().setFromObject(orcModel),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());const scale=1.8288/size.y;
 orcModel.scale.multiplyScalar(scale);orcModel.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);orcModel.rotation.y=.4;orcScene.add(orcModel);dirty=true;
},undefined,e=>{document.querySelector('#status').textContent='Orc model failed to load.';console.error(e);});
document.querySelector('#orc').addEventListener('change',()=>{dirty=true;});
function drawOrc(){if(!orcModel||!document.querySelector('#orc').checked)return;const pixelsPerMetre=128/3*values.zoom;orcCamera.left=-w/2/pixelsPerMetre;orcCamera.right=w/2/pixelsPerMetre;orcCamera.top=h/2/pixelsPerMetre;orcCamera.bottom=-h/2/pixelsPerMetre;orcCamera.position.set(0,5.68329,8.228);orcCamera.lookAt(0,0,0);orcCamera.updateProjectionMatrix();orcAmbient.intensity=.65*noon.sky*values.light;orcSun.intensity=2.2*noon.daylight*values.light;
 const tone=renderer.toneMapping,exposure=renderer.toneMappingExposure;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.clearDepth();renderer.render(orcScene,orcCamera);renderer.toneMapping=tone;renderer.toneMappingExposure=exposure;}

// Same three-metre repeating grass artwork and normal detail as the battlefield.
const loader=new T.TextureLoader(),groundUniforms={pixelRatio:{value:renderer.getPixelRatio()},artwork:{value:null},normalMap:{value:null},resolution:{value:new T.Vector2(1,1)},viewZoom:{value:1},lightLevel:{value:1}};
const wearSize=512,wearData=new Uint8Array(wearSize*wearSize),wearTexture=new T.DataTexture(wearData,wearSize,wearSize,T.RedFormat);wearTexture.minFilter=wearTexture.magFilter=T.LinearFilter;wearTexture.needsUpdate=true;
Object.assign(groundUniforms,{wearMap:{value:wearTexture},wearBounds:{value:new T.Vector4()},soilMap:{value:null},soilRelief:{value:1}});
function buildWear(){const bounds=groundUniforms.wearBounds.value;bounds.set(-w,-h,w*3,h*3);const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 for(let y=0;y<wearSize;y++)for(let x=0;x<wearSize;x++){const wx=bounds.x+(x+.5)/wearSize*bounds.z,wy=bounds.y+(y+.5)/wearSize*bounds.w;
 const mx=wx/(128/3)/values.patchSize,my=wy/(128/3*.568329)/values.patchSize;
 const n=.8*coverField(mx*4,my*4)+.2*coverField(mx*19+80,my*19-30),threshold=.85-values.patchCoverage*.7;
 wearData[y*wearSize+x]=values.patchCoverage===0?0:Math.round(255*values.patchWear*smooth((n-threshold)/values.patchSoftness+.5));}
 wearTexture.needsUpdate=true;groundUniforms.soilRelief.value=values.soilRelief;
 return (x,y)=>{const fx=(x-bounds.x)/bounds.z*wearSize-.5,fy=(y-bounds.y)/bounds.w*wearSize-.5,ix=Math.floor(fx),iy=Math.floor(fy),u=fx-ix,v=fy-iy;
 const at=(a,b)=>wearData[Math.max(0,Math.min(wearSize-1,b))*wearSize+Math.max(0,Math.min(wearSize-1,a))]/255;
 return 1-((at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v);};
}
let groundReady=false;
const groundMaterial=new T.ShaderMaterial({uniforms:groundUniforms,depthTest:false,depthWrite:false,toneMapped:false,
 vertexShader:`void main(){gl_Position=vec4(position.xy,0.,1.);}`,
 fragmentShader:`uniform sampler2D artwork,normalMap,wearMap,soilMap;uniform vec4 wearBounds;uniform float soilRelief;uniform vec2 resolution;uniform float viewZoom,lightLevel,pixelRatio;
 void main(){vec2 pixel=gl_FragCoord.xy/pixelRatio;vec2 screen=vec2(pixel.x,resolution.y-pixel.y);vec2 world=resolution*.5+(screen-resolution*.5)/viewZoom;
 vec2 uv=vec2((world.x+64.)/128.,1.-(world.y+128.*.568329*.5)/(128.*.568329));
 vec3 n=texture2D(normalMap,uv).xyz*2.-1.;vec3 color=texture2D(artwork,uv).rgb;
 float broad=.5+.5*sin(world.x*.009+sin(world.y*.012)*1.7),detail=.5+.5*sin(world.y*.029+sin(world.x*.021)),variation=.79+.18*broad+.07*detail;
 color*=vec3(variation,variation,variation*.94);color=mix(color,color*vec3(1.12,.96,.78),smoothstep(.68,.94,broad)*.42);color*=clamp(.96+.10*n.x-.08*n.y+.04*n.z,.82,1.12);
 float wear=texture2D(wearMap,(world-wearBounds.xy)/wearBounds.zw).r;
 vec3 soil=texture2D(soilMap,uv).rgb;
 // Texture-derived microrelief, not physical displacement or an authored height map.
 vec2 stepUv=1./vec2(textureSize(soilMap,0));vec3 luminance=vec3(.2126,.7152,.0722);
 float dx=dot(texture2D(soilMap,uv+vec2(stepUv.x,0.)).rgb-texture2D(soilMap,uv-vec2(stepUv.x,0.)).rgb,luminance);
 float dy=dot(texture2D(soilMap,uv+vec2(0.,stepUv.y)).rgb-texture2D(soilMap,uv-vec2(0.,stepUv.y)).rgb,luminance);
 soil*=clamp(1.+soilRelief*(dx*.7-dy*.6),.65,1.35);
 color=mix(color,soil,wear);gl_FragColor=vec4(color*lightLevel,1.);}`});
const ground=new T.Mesh(new T.PlaneGeometry(2,2),groundMaterial);ground.frustumCulled=false;
Promise.all(['grass-short-v1.png','grass-short-v1-normal.png','dirt-path-v1.png'].map(name=>loader.loadAsync('../assets/textures/exploration/'+name))).then(textures=>{for(const t of textures){t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.NoColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}groundUniforms.artwork.value=textures[0];groundUniforms.normalMap.value=textures[1];groundUniforms.soilMap.value=textures[2];groundReady=true;dirty=true;}).catch(error=>{document.querySelector('#status').textContent='Ground texture failed to load: '+error.message;});

function rebuild(){const grassCoverage=buildWear();cover?.dispose();cover=createGroundCover({snow:{texture:zero,footprintTexture:zero,bounds:new T.Vector4(0,0,w,h)},texture:t=>t,flush(){},markBackdrop(){},paint(mesh){scene.add(mesh);renderer.render(scene,camera);scene.remove(mesh);},tuning:{...values,grassCoverage,rocks:document.querySelector('#rocks').checked,sticks:document.querySelector('#sticks').checked}});light.image.data.set([values.light*255,values.light*255,values.light*255,255]);light.needsUpdate=true;black.image.data.set([255*(1-1/noonGain),255*(1-1/noonGain),255*(1-1/noonGain),255]);black.needsUpdate=true;dirty=true;}
function schedule(){clearTimeout(timer);timer=setTimeout(rebuild,90);}
for(const id of ['rocks','sticks'])document.querySelector('#'+id).addEventListener('change',schedule);
document.querySelector('#animate').addEventListener('change',()=>{dirty=true;});
new ResizeObserver(()=>{w=host.clientWidth;h=host.clientHeight;renderer.setSize(w,h,false);camera.right=w;camera.bottom=h;camera.updateProjectionMatrix();rebuild();}).observe(host);
function draw(){requestAnimationFrame(draw);pollGpu();if(document.hidden||!cover){lastFrame=0;return;}const animate=document.querySelector('#animate').checked;if(!dirty&&!animate){lastFrame=0;document.querySelector('#stats').textContent='Rendering paused · enable Animate wind for live FPS / CPU / GPU measurements';return;}
 const start=performance.now();if(lastFrame)frameSamples.push(start-lastFrame);lastFrame=start;if(frameSamples.length>60)frameSamples.shift();dirty=false;renderer.info.reset();
 const query=gpuTimer&&pendingQueries.length<4?gl.createQuery():null;if(query)gl.beginQuery(gpuTimer.TIME_ELAPSED_EXT,query);
 renderer.clear();if(groundReady){groundUniforms.resolution.value.set(w,h);groundUniforms.viewZoom.value=values.zoom;groundUniforms.lightLevel.value=values.light*noonGain;scene.add(ground);renderer.render(scene,camera);scene.remove(ground);}cover.begin({width:w,height:h,matrix:[1,0,0,1,0,0],anchor:{x:w/2,y:h/2},zoom:values.zoom});cover.collect([{grass:true,grassUnit:128/3,grassSquash:.568329,snowEligible:1,points:[{x:-w,y:-h},{x:w*2,y:-h},{x:w*2,y:h*2},{x:-w,y:h*2}]}],{lightMap:{layers:[light,black],left:-w,top:-h,spanWidth:w*3,spanHeight:h*3}});cover.prepare();cover.drawUntil(h/2);drawOrc();cover.drawUntil(Infinity);if(query){gl.endQuery(gpuTimer.TIME_ELAPSED_EXT);pendingQueries.push(query);}cpuSamples.push(performance.now()-start);if(cpuSamples.length>60)cpuSamples.shift();
 if(start-lastReport>500){lastReport=start;const d=cover.diagnostics(),fps=average(frameSamples)>0?(1000/average(frameSamples)).toFixed(1):'…',gpu=gpuTimer?(gpuSamples.length?average(gpuSamples).toFixed(2)+' ms':'warming up'):'unsupported';
 document.querySelector('#stats').innerHTML=`<strong>${fps} FPS</strong> · CPU submit ${average(cpuSamples).toFixed(2)} ms · GPU ${gpu}<br>${d.instances.toLocaleString()} scatter instances · ${renderer.info.render.triangles.toLocaleString()} triangles · ${renderer.info.render.calls} draws<br><small>Rolling averages · CPU = this lab’s rendering work, not total CPU usage · GPU includes ground, scatter and Orc</small>`;}
}
draw();
function sync(){for(const [key] of specs){document.getElementById(key).value=values[key];document.getElementById(key+'Value').textContent=values[key];}schedule();}
document.querySelector('#reset').onclick=()=>{Object.assign(values,defaults);for(const id of ['rocks','sticks','animate','orc'])document.getElementById(id).checked=true;sync();};
document.querySelector('#export').onclick=()=>{const data={schema:'adventure-party-grass-scatter',version:1,settings:{...values,rocks:document.getElementById('rocks').checked,sticks:document.getElementById('sticks').checked}};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='adventure-party-grass-scatter.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.getElementById('status').textContent='Exported settings. Send the JSON back to apply your choices.';};
canvas.addEventListener('wheel',e=>{e.preventDefault();values.zoom=Math.max(.5,Math.min(3,Math.round((values.zoom-e.deltaY*.001)*20)/20));sync();},{passive:false});
window.addEventListener('pagehide',()=>{for(const q of pendingQueries)gl.deleteQuery(q);cover?.dispose();ground.geometry.dispose();groundMaterial.dispose();groundUniforms.artwork.value?.dispose();groundUniforms.normalMap.value?.dispose();groundUniforms.soilMap.value?.dispose();wearTexture.dispose();renderer.dispose();zero.dispose();light.dispose();black.dispose();});
