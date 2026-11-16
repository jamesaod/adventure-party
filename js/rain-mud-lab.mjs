import {createRainFieldCover,fieldWear} from './rain-field-cover.mjs?v=tree-snow-grains1';
import * as T from '../assets/vendor/three/three.module.min.js';
import {OrbitControls} from '../assets/vendor/three/addons/controls/OrbitControls.js';
import {WetGround,N,SIZE,STEP,sheltered,materialAt} from './rain-mud-sim.mjs?v=2';
import {loadWorkshopCombatUnit} from './combat-workshop-unit.mjs?v=tree-snow-grains1';
import {createWorkshopRepositoryMob} from './workshop-repository-mob.mjs';
import {appearanceRecipeForMob} from './mob-appearance.mjs?v=R238C204';
import {directUnitFrame} from './combat-direct-units.mjs?v=tree-snow-grains1';
const $=s=>document.querySelector(s),values={rain:0,drying:.25,softness:.8,wind:.6},sim=new WetGround({allGrass:true});
for(const [key,title,max] of [['rain','Rainfall',1],['drying','Drying rate',2],['softness','Soil softness',1],['wind','Wind',2]]){
 const label=document.createElement('label');label.textContent=title;const out=document.createElement('output'),input=document.createElement('input');input.type='range';input.min=0;input.max=max;input.step=.05;input.value=values[key];out.textContent=input.value;input.oninput=()=>{values[key]=+input.value;out.textContent=input.value;};label.append(out,input);$('#controls').append(label);
}
const renderer=new T.WebGLRenderer({canvas:$('#view'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
const scene=new T.Scene();scene.background=new T.Color('#354950');scene.fog=new T.Fog('#354950',23,55);
const camera=new T.PerspectiveCamera(43,1,.1,100);camera.position.set(14,14,18);const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,0,0);orbit.maxPolarAngle=Math.PI*.48;orbit.minDistance=5;orbit.maxDistance=36;orbit.update();
scene.add(new T.HemisphereLight(0xc9e2f0,0x54422f,2));const sun=new T.DirectionalLight(0xffecd3,2);sun.position.set(-4,10,5);scene.add(sun);
const geo=new T.PlaneGeometry(SIZE,SIZE,N-1,N-1);geo.rotateX(-Math.PI/2);const colors=new Float32Array(N*N*3);geo.setAttribute('color',new T.BufferAttribute(colors,3));
const surfaceData=new Uint8Array(N*N*4),surfaceMap=new T.DataTexture(surfaceData,N,N);surfaceMap.minFilter=surfaceMap.magFilter=T.LinearFilter;surfaceMap.needsUpdate=true;
const groundMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.95,metalness:0});
const ground=new T.Mesh(geo,groundMaterial);scene.add(ground);
const fieldCover=createRainFieldCover(renderer,camera,{surfaceMap,values});
const textures=new T.TextureLoader();
Promise.all(['grass-short-v1.png','grass-short-v1-normal.png','dirt-path-v1.png'].map(name=>textures.loadAsync('assets/textures/exploration/'+name))).then(([grass,normal,soil])=>{
 for(const texture of [grass,normal,soil]){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(SIZE/3,SIZE/3);texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
 grass.colorSpace=soil.colorSpace=T.SRGBColorSpace;groundMaterial.map=grass;groundMaterial.normalMap=normal;groundMaterial.normalScale.set(.25,.25);
 groundMaterial.onBeforeCompile=shader=>{shader.uniforms.labSoil={value:soil};shader.fragmentShader='uniform sampler2D labSoil; varying vec2 labGroundXZ;\n'+shader.fragmentShader;shader.vertexShader='varying vec2 labGroundXZ;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlabGroundXZ=position.xz;');shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat wear=texture2D(labSurface,(labGroundXZ+8.)/16.).b;diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(labSoil,vMapUv).rgb*diffuseColor.rgb/max(texture2D(map,vMapUv).rgb,vec3(.01)),wear);');shader.uniforms.labSurface={value:surfaceMap};shader.fragmentShader='uniform sampler2D labSurface;\n'+shader.fragmentShader;};groundMaterial.needsUpdate=true;
 document.body.dataset.fieldTextures='loaded';
}).catch(e=>{$('#error').textContent='Field textures failed: '+e.message;});
const waterGeo=new T.PlaneGeometry(STEP*1.05,STEP*1.05);waterGeo.rotateX(-Math.PI/2);
const waterMat=new T.MeshStandardMaterial({color:0x7d9b9d,roughness:.23,metalness:.18,transparent:true,opacity:.63,depthWrite:false});
waterMat.onBeforeCompile=shader=>{shader.uniforms.rainTime={value:0};waterMat.userData.shader=shader;shader.fragmentShader='uniform float rainTime;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(normal+vec3(sin(vViewPosition.x*32.0+rainTime*4.0)*0.035,sin(vViewPosition.y*29.0-rainTime*3.0)*0.035,0.0));');};
const puddles=new T.InstancedMesh(waterGeo,waterMat,N*N);puddles.instanceMatrix.setUsage(T.DynamicDrawUsage);puddles.frustumCulled=false;scene.add(puddles);
const dummy=new T.Object3D(),color=new T.Color();let puddleCount=0;
function refreshGround(){const pos=geo.attributes.position;let count=0;
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,x=i*STEP-8,z=j*STEP-8,type=materialAt(x),wet=sim.wet[k];pos.setXYZ(k,x,sim.base[k]+sim.dent[k],z);
  color.setRGB(1-wet*.42,1-wet*.42,1-wet*.42);
  colors.set([color.r,color.g,color.b],k*3);
  surfaceData.set([Math.round(Math.max(0,Math.min(1,(sim.base[k]+sim.dent[k]+.4)/.6))*255),Math.round(wet*255),Math.round(fieldWear(x,z)*255),255],k*4);
  if(sim.water[k]>.0015){const coverage=Math.min(1,sim.water[k]/.009);dummy.position.set(x,sim.base[k]+sim.dent[k]+sim.water[k]+.003,z);dummy.scale.set(coverage,1,coverage);dummy.updateMatrix();puddles.setMatrixAt(count++,dummy.matrix);}
 }
 surfaceMap.needsUpdate=true;puddleCount=count;puddles.count=count;puddles.instanceMatrix.needsUpdate=true;pos.needsUpdate=true;geo.attributes.color.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingSphere();
}
refreshGround();
const roof=new T.Group();roof.visible=false;scene.add(roof);const wood=new T.MeshStandardMaterial({color:0x665342,roughness:1});
for(const x of [2,6])for(const z of [2,6]){const post=new T.Mesh(new T.BoxGeometry(.12,2.6,.12),wood);post.position.set(x,1.3,z);roof.add(post);}
const roofTop=new T.Mesh(new T.BoxGeometry(4.4,.12,4.4),new T.MeshStandardMaterial({color:0x43545b,roughness:.9}));roofTop.position.set(4,2.65,4);roof.add(roofTop);$('#roof').onchange=()=>{roof.visible=$('#roof').checked;sim.shelterEnabled=roof.visible;};sim.shelterEnabled=false;
function sign(text,x,z){const c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#17242c';ctx.fillRect(0,0,256,64);ctx.fillStyle='#dce9e8';ctx.font='26px sans-serif';ctx.textAlign='center';ctx.fillText(text,128,43);const sprite=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(c),depthTest:false}));sprite.position.set(x,.3,z);sprite.scale.set(2.8,.7,1);scene.add(sprite);}
// Field stays free of test-panel labels.
const dropCount=1800,dropData=new Float32Array(dropCount*6),drops=Array.from({length:dropCount},()=>({x:Math.random()*16-8,y:Math.random()*9,z:Math.random()*16-8}));
const rainGeo=new T.BufferGeometry();rainGeo.setAttribute('position',new T.BufferAttribute(dropData,3));const rain=new T.LineSegments(rainGeo,new T.LineBasicMaterial({color:0xb8d7e4,transparent:true,opacity:.34,depthWrite:false}));rain.frustumCulled=false;scene.add(rain);
const splashData=new Float32Array(120*3),splashLife=new Float32Array(120);let splashCursor=0;const splashGeo=new T.BufferGeometry();splashGeo.setAttribute('position',new T.BufferAttribute(splashData,3));const splashes=new T.Points(splashGeo,new T.PointsMaterial({color:0xc8e3e6,size:.055,transparent:true,opacity:.6,depthWrite:false}));splashes.frustumCulled=false;scene.add(splashes);
function rainStep(dt){const active=Math.floor(dropCount*values.rain);rainGeo.setDrawRange(0,active*2);for(let i=0;i<active;i++){const d=drops[i];d.y-=dt*12;d.x+=dt*values.wind*2;const floor=(sim.shelterEnabled&&sheltered(d.x,d.z))?2.72:sim.height(d.x,d.z);if(d.y<floor){if(!(sim.shelterEnabled&&sheltered(d.x,d.z))){const k=splashCursor++%120;splashData.set([d.x,floor+.03,d.z],k*3);splashLife[k]=.18;}d.x=Math.random()*16-8;d.z=Math.random()*16-8;d.y=9;}dropData.set([d.x,d.y,d.z,d.x-values.wind*.045,d.y+.25,d.z],i*6);}rainGeo.attributes.position.needsUpdate=true;
 for(let i=0;i<120;i++){splashLife[i]-=dt;if(splashLife[i]<=0)splashData[i*3+1]=-10;else splashData[i*3+1]+=dt*.4;}splashGeo.attributes.position.needsUpdate=true;
}
let orc=null,walkTime=0,lastStep=-1,paused=false,time=0;
async function loadOrc(){const response=await fetch('data/mobs/orc-warrior.workshop-unit.json');if(!response.ok)throw Error('Orc package unavailable');const pack=await response.json(),adapter=createWorkshopRepositoryMob(pack),entity=adapter.apply({id:'rain-lab-orc',alive:true,x:0,y:0},()=>.5),captured=adapter.recipe(entity),recipe=appearanceRecipeForMob(entity,{...captured.model,poseProfile:captured.poseProfile,renderSettings:captured.renderSettings});const loaded=await loadWorkshopCombatUnit(recipe),image=loaded.images[Object.values(loaded.manifest.poses.ready.frames)[0]],asset=directUnitFrame(image).asset;asset.workshopSample(entity,0,0);asset.group.rotation.set(0,0,0);asset.group.updateMatrixWorld(true);const box=new T.Box3().setFromObject(asset.group),scale=1.83/(box.max.y-box.min.y),root=new T.Group();root.scale.setScalar(scale);root.position.y=-box.min.y*scale;root.add(asset.group);const holder=new T.Group();holder.add(root);scene.add(holder);orc={asset,entity,holder,root,scale};$('#status').textContent='Published Orc loaded. Actual field grass, rocks, sticks and ground textures. Start dry; add rain to compare.';}
loadOrc().catch(e=>{$('#error').textContent='Orc loading failed: '+e.message;console.error(e);});
$('#pause').onclick=()=>{paused=!paused;$('#pause').textContent=paused?'Resume':'Pause';};$('#reset').onclick=()=>{sim.reset();refreshGround();};$('#soak').onclick=()=>{sim.wet.fill(1);for(let k=0;k<N*N;k++)sim.water[k]=.012;refreshGround();};
const ray=new T.Raycaster(),mouse=new T.Vector2();let down=null;
renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;const rect=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);ray.setFromCamera(mouse,camera);const hit=ray.intersectObject(ground)[0];if(hit){sim.stamp(hit.point.x,hit.point.z,0,values.softness);refreshGround();}});
new ResizeObserver(()=>{const rect=$('#viewport').getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();}).observe($('#viewport'));
let last=0,acc=0,frames=0,report=0,simCost=0;
function frame(now){requestAnimationFrame(frame);const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(document.hidden)return;
 if(!paused){time+=dt;acc+=dt;rainStep(dt);if(waterMat.userData.shader)waterMat.userData.shader.uniforms.rainTime.value=time;
  if(orc){if($('#walk').checked)walkTime+=dt;const angle=walkTime*.18,x=Math.sin(angle)*5.5,z=Math.sin(angle*2)*3,heading=Math.atan2(5.5*Math.cos(angle),6*Math.cos(angle*2));orc.asset.workshopSample(orc.entity,$('#walk').checked?walkTime:undefined,time*1000);orc.holder.position.set(x,sim.height(x,z),z);orc.holder.rotation.y=heading;
   const step=Math.floor(walkTime/.45);if(step!==lastStep){lastStep=step;const side=step%2?1:-1;sim.stamp(x+Math.cos(heading)*.14*side,z-Math.sin(heading)*.14*side,heading,values.softness);}
  }
  if(acc>=.1){const start=performance.now();sim.step(.1,values);refreshGround();simCost=performance.now()-start;acc%=.1;}
 }
 renderer.autoClear=false;renderer.info.autoReset=false;renderer.info.reset();renderer.clear();renderer.render(scene,camera);fieldCover.draw(orc?.holder.position);frames++;if(now-report>1000){$('#stats').textContent=`${Math.round(frames*1000/(now-report))} FPS · surface update ${simCost.toFixed(2)} ms / 10 Hz · ${puddleCount} wet cells · ${fieldCover.diagnostics().instances} field details · ${renderer.info.render.calls} draws`;report=now;frames=0;}
}
document.addEventListener('visibilitychange',()=>{last=0;});requestAnimationFrame(frame);
