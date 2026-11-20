import {createGiantImpactDust} from './giant-impact-dust.mjs';
import * as T from '../assets/vendor/three/three.module.min.js';
import {OrbitControls} from '../assets/vendor/three/addons/controls/OrbitControls.js';
import {GLTFLoader} from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
import {loadRagdollRig,applyPose} from './ragdoll-lab-rig.mjs';
import {loadCombatModel} from './combat-model-source.mjs';
import {prepareStudioAnimations} from './studio-animations.mjs';
import {retargetHumanoidClip} from './mixamo-retarget.mjs';
import {removeWorkshopRootTravel} from './workshop-grounding.mjs';
import {CombatWetBasins,BASIN_MAX_METRES} from './combat-wet-basins.mjs';
import {beginBoulderRoll,advanceBoulderRoll,boulderHoleDepth,exposedDepth,liftBoulder,throwBoulder,advanceBoulder,boulderBlocks} from './boulder-state.mjs';
const $=id=>document.getElementById(id),host=$('viewport'),scene=new T.Scene();scene.background=new T.Color('#24373c');
const renderer=new T.WebGLRenderer({canvas:$('view'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
const camera=new T.PerspectiveCamera(45,1,.1,150);camera.position.set(13,11,17);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1,0);controls.update();controls.addEventListener('change',schedule);
const hemi=new T.HemisphereLight(0xd8edff,0x67533b,2);scene.add(hemi);const sun=new T.DirectionalLight(0xffe6ba,3);sun.position.set(-8,14,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,far:50});sun.shadow.bias=-.0003;scene.add(sun);
const groundGeometry=new T.PlaneGeometry(40,24,600,360);groundGeometry.rotateX(-Math.PI/2);const color=new T.Float32BufferAttribute(new Float32Array(groundGeometry.attributes.position.count*3),3);groundGeometry.setAttribute('color',color);const soil=new T.Float32BufferAttribute(new Float32Array(color.count),1);groundGeometry.setAttribute('soil',soil);const groundMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:1});const floor=new T.Mesh(groundGeometry,groundMaterial);floor.receiveShadow=true;scene.add(floor);
const textureLoader=new T.TextureLoader();const grassMap=textureLoader.load('assets/textures/exploration/grass-short-v1.png',schedule),soilMap=textureLoader.load('assets/textures/exploration/dirt-path-v1.png',schedule);for(const t of [grassMap,soilMap]){t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;}
 const soilWetness={value:0};
 groundMaterial.onBeforeCompile=shader=>{shader.uniforms.soilWetness=soilWetness;shader.uniforms.grassMap={value:grassMap};shader.uniforms.soilMap={value:soilMap};shader.vertexShader='attribute float soil;varying float soilMix;varying vec3 groundPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngroundPoint=position;soilMix=soil;');shader.fragmentShader='uniform float soilWetness;varying float soilMix;uniform sampler2D grassMap,soilMap;varying vec3 groundPoint;\n'+shader.fragmentShader.replace('#include <map_fragment>','vec2 groundUV=groundPoint.xz/3.;float dirt=soilMix;diffuseColor.rgb*=mix(texture2D(grassMap,groundUV).rgb,texture2D(soilMap,groundUV).rgb*mix(vec3(1.),vec3(.43,.35,.28),soilWetness),dirt);').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.38,soilMix*soilWetness);');};
const holes=[],rocks=[],waters=[];const wet=new CombatWetBasins();let giant,mixer,clips={},action=null,held=null,busy=null,ready=false,pending=0,last=0,waterClock=0,elapsed=0;
const impactDust=createGiantImpactDust(renderer,scene),noFire={intensity:0,position:new T.Vector3()};
const target=new T.Vector3(5,0,-3),targetMesh=new T.Mesh(new T.RingGeometry(.8,.9,48),new T.MeshBasicMaterial({color:0xe8b36d,side:T.DoubleSide}));targetMesh.rotation.x=-Math.PI/2;targetMesh.position.copy(target);targetMesh.position.y=.015;scene.add(targetMesh);
const grassGeometry=new T.PlaneGeometry(.05,.2);grassGeometry.translate(0,.1,0);const grass=new T.InstancedMesh(grassGeometry,new T.MeshStandardMaterial({color:0x526d36,side:T.DoubleSide,roughness:1}),2200);const grassPositions=[];let seed=891;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<2200;i++)grassPositions.push({x:(random()-.5)*34,z:(random()-.5)*19,yaw:random()*Math.PI});scene.add(grass);
function dirtAt(x,z){let d=exposedDepth(holes,x,z)>0?1:0;for(const h of holes){if(Math.abs(x-h.x)>h.rx+.25||Math.abs(z-h.z)>h.rz+.25)continue;for(let i=0;i<12;i++){const a=i*Math.PI/6,r=.08+.16*(.5+.5*Math.sin(x*23+z*31));if(boulderHoleDepth(h,x+Math.cos(a)*r,z+Math.sin(a)*r)>0)d=Math.max(d,.3+.5*(.5+.5*Math.sin(x*39+z*27)));}}return d;}
function rebuildGround(){const p=groundGeometry.attributes.position,c=new T.Color();for(let i=0;i<p.count;i++){const depth=exposedDepth(holes,p.getX(i),p.getZ(i));p.setY(i,-depth);soil.setX(i,dirtAt(p.getX(i),p.getZ(i)));c.setHex(0xffffff);color.setXYZ(i,c.r,c.g,c.b);}p.needsUpdate=color.needsUpdate=soil.needsUpdate=true;groundGeometry.computeVertexNormals();const dummy=new T.Object3D();grassPositions.forEach((v,i)=>{dummy.position.set(v.x,0,v.z);dummy.rotation.y=v.yaw;dummy.scale.setScalar(dirtAt(v.x,v.z)>.65?0:1);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);});grass.instanceMatrix.needsUpdate=true;for(const w of waters){scene.remove(w);w.material.uniforms.bedMap.value.dispose();w.geometry.dispose();w.material.dispose();}waters.length=0;
 for(const h of holes){const n=65,data=new Uint8Array(n*n*4);for(let j=0;j<n;j++)for(let i=0;i<n;i++){const k=(j*n+i)*4;data[k]=Math.round(boulderHoleDepth(h,h.x+(i/(n-1)*2-1)*h.rx,h.z-(j/(n-1)*2-1)*h.rz)/BASIN_MAX_METRES*255);data[k+3]=255;}const map=new T.DataTexture(data,n,n);map.magFilter=map.minFilter=T.LinearFilter;map.needsUpdate=true;
 const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{bedMap:{value:map},level:{value:-BASIN_MAX_METRES}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;uniform sampler2D bedMap;uniform float level;void main(){float d=texture2D(bedMap,v).r*.1524;if(d<.001||-d>=level)discard;gl_FragColor=vec4(.16,.25,.27,.78);}'});const w=new T.Mesh(new T.PlaneGeometry(h.rx*2,h.rz*2),mat);w.rotation.x=-Math.PI/2;w.position.set(h.x,0,h.z);scene.add(w);waters.push(w);}

}
function selected(){return rocks[Number($('rock').value)||0];}
function pose(name,time){for(const f of curled)f.bone.quaternion.copy(f.before);curled.length=0;if(action?.getClip()!==clips[name]){mixer.stopAllAction();action=mixer.clipAction(clips[name]);action.reset().setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();}// Sampling the final LoopOnce frame pauses the action; every seek must re-enable it.
 action.paused=false;action.enabled=true;mixer.setTime(time);giant.root.updateMatrixWorld(true);}
let palmGrip=null;const curled=[];const handPosition=new T.Vector3(),handRotation=new T.Quaternion();function followHand(){if(!held)return;const hand=giant.roles.get('rightHand');hand.getWorldPosition(handPosition);hand.getWorldQuaternion(handRotation);const grip=held.grip;const palm=palmGrip.offset.clone().applyQuaternion(handRotation);handPosition.add(palm).add(palmGrip.normal.clone().applyQuaternion(handRotation).multiplyScalar(grip.support));handRotation.multiply(grip.rotation);const b=busy?.kind==='pickup'?busy:null;const blend=b?T.MathUtils.smoothstep(b.t,b.contact,b.gripEnd):1;if(b){held.object.position.lerpVectors(b.rockStart,handPosition,blend);held.object.quaternion.slerpQuaternions(b.rockRotation,handRotation,blend);}else{held.object.position.copy(handPosition);held.object.quaternion.copy(handRotation);}held.x=held.object.position.x;held.y=held.object.position.y;held.z=held.object.position.z;if(busy&&palmGrip){for(const f of palmGrip.fingers){curled.push({bone:f.bone,before:f.bone.quaternion.clone()});f.bone.quaternion.multiply(new T.Quaternion().setFromAxisAngle(f.axis,.45*blend));}giant.root.updateMatrixWorld(true);}}
function controlsState(){const r=selected();$('pickup').disabled=!ready||!!busy||!!held||r?.state!=='ground';$('throw').disabled=!ready||!!busy||!held;$('rock').disabled=!!busy||!!held;$('reset').disabled=!ready;$('grip').disabled=!!busy||!!held;}
function status(text){$('status').textContent=text;}
function reset(){if(!ready)return;busy=null;held=null;mixer.stopAllAction();action=null;applyPose(giant.nodes,giant.ready);giant.root.position.copy(giant.home);giant.root.quaternion.copy(giant.homeRotation);$('pickupProgress').value=0;holes.length=0;wet.reset();impactDust.clear();for(const p of particles)p.life=0;rocks.forEach((r,i)=>{r.state='ground';r.flight=null;r.roll=null;r.settle=null;r.soilTime=0;r.soilCredit=0;r.buried=.15;r.x=-6+i*2.6;r.z=2;r.y=r.height/2-r.buried;r.object.position.set(r.x,r.y,r.z);r.object.quaternion.identity();});rebuildGround();controlsState();status('Select a boulder, then pick it up.');schedule();}
$('pickup').onclick=()=>{const r=selected();if(!r||busy||held)return;
 const duration=clips.pickup.duration;let low=Infinity,lowestTime=0,offset=new T.Vector3();
 // Measure the retargeted hand path rather than assuming a contact frame.
 const startRotation=giant.root.quaternion.clone();giant.root.quaternion.identity();
 for(let i=0;i<=100;i++){const t=duration*i/100;pose('pickup',t);const p=giant.roles.get('rightHand').getWorldPosition(new T.Vector3());if(p.y<low){low=p.y;lowestTime=t;offset.copy(p).sub(giant.root.position);}}
 const direction=new T.Vector3(r.x-giant.root.position.x,0,r.z-giant.root.position.z).normalize();
 if(direction.lengthSq()<.001)direction.set(0,0,1);
 const yaw=Math.atan2(direction.x,direction.z)-Math.atan2(offset.x,offset.z);
 const endRotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw);
 const aligned=offset.clone().applyQuaternion(endRotation);
 giant.root.position.x=r.x-aligned.x;giant.root.position.z=r.z-aligned.z;
 giant.root.quaternion.copy(startRotation);pose('pickup',0);
 const gripEnd=duration*Number($('grip').value)/100,contact=Math.max(0,gripEnd-.6);
 busy={kind:'pickup',t:0,rock:r,contact,gripEnd,duration,lowestTime:Math.max(.01,lowestTime),startRotation,endRotation,rockStart:r.object.position.clone(),rockRotation:r.object.quaternion.clone()};
 controlsState();status('Turning and lifting boulder…');schedule();};
$('grip').oninput=()=>{$('gripLabel').textContent=$('grip').value+'%';};

$('throw').onclick=()=>{if(!held||busy)return;giant.root.lookAt(target.x,giant.root.position.y,target.z);busy={kind:'throw',t:0,rock:held,contact:clips.throw.duration*Number($('release').value)/100,duration:clips.throw.duration};pose('throw',0);controlsState();status('Throwing toward the target…');schedule();};
$('reset').onclick=reset;$('rock').onchange=()=>{controlsState();schedule();};$('release').oninput=()=>{$('releaseLabel').textContent=$('release').value+'%';};$('weather').onchange=schedule;$('waterSpeed').onchange=schedule;$('saturated').onclick=()=>{wet.wet=1;wet.water=BASIN_MAX_METRES;schedule();};
function update(dt){elapsed+=dt;waterClock+=dt*Number($('waterSpeed').value)*1000;wet.update(waterClock,{type:$('weather').value,intensity:1},document.hidden);groundMaterial.color.setScalar(1-wet.wet*.2);soilWetness.value=wet.wet;
 if(busy){const b=busy;b.t=Math.min(b.duration,b.t+dt*.5);if(b.kind==='pickup'){giant.root.quaternion.slerpQuaternions(b.startRotation,b.endRotation,T.MathUtils.smoothstep(b.t,0,b.lowestTime));$('pickupProgress').value=b.t/b.duration*100;}pose(b.kind,b.t);if(b.kind==='pickup'&&b.t>=b.contact&&!b.contacted){b.contacted=true;if(liftBoulder(b.rock,holes)){held=b.rock;held.soilTime=Infinity;held.soilFade=1;rebuildGround();}}followHand();if(b.kind==='throw'&&b.t>=b.contact&&!b.contacted){b.contacted=true;const r=held;r.soilTime=2.5;r.soilFade=1;throwBoulder(r,{x:r.x,y:r.y,z:r.z},{x:target.x,y:r.height/2,z:target.z},1.5);r.releaseRotation=r.object.quaternion.clone();r.previousFlight=0;held=null;}if(b.t>=b.duration){if(b.kind==='pickup'){b.rock.soilTime=.5;for(const p of particles)if(p.rock===b.rock)p.life=Math.min(p.life,.5);}busy=null;controlsState();status(held?'Boulder held. The exposed hole remains.':'Throw complete. Watch the landing.');}}
 else followHand();
 let terrainDirty=false;
 for(const r of rocks){
 if(r.state==='flight'){const flight=r.flight;advanceBoulder(r,dt);r.object.position.set(r.x,r.y,r.z);r.object.quaternion.copy(r.releaseRotation).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),flight.elapsed*1.4));
 if(r.state==='ground'){beginBoulderRoll(r,flight,holes);r.soilTime=Infinity;r.soilCredit=420;r.impactUntil=elapsed+.25;const outline=Array.from({length:16},(_,i)=>{const a=i*Math.PI/8;return {x:Math.cos(a)*r.width*.4,z:Math.sin(a)*r.depth*.4,nx:Math.cos(a),nz:Math.sin(a)};});impactDust.emit(outline,new T.Vector3(r.x,0,r.z),elapsed);r.rutClock=0;terrainDirty=true;status('Impact! Boulder rolling and tearing up the ground.');}}
 if(r.state==='rolling'){const roll=r.roll,distance=advanceBoulderRoll(r,dt),axis=new T.Vector3(roll.dz,0,-roll.dx);r.object.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(axis,distance/Math.max(.2,r.height*.5)));
 const box=new T.Box3().setFromObject(r.object);const bottom=box.min.y-r.object.position.y;
 r.y=-bottom-exposedDepth(holes,r.x,r.z)+.015;r.object.position.set(r.x,r.y,r.z);
 r.rutClock+=dt;if(r.rutClock>=.2||r.state==='ground'){terrainDirty=true;r.rutClock=0;}
 if(r.state==='ground'){r.state='settling';r.soilTime=.6;r.settle={time:0,from:r.object.quaternion.clone(),to:stableRest(r)};status('Boulder tipping onto a stable resting face…');controlsState();}}
 if(r.state==='settling'){const a=r.settle;a.time+=dt;const t=Math.min(1,a.time/1.1),ease=t*t*(3-2*t);r.object.quaternion.slerpQuaternions(a.from,a.to,ease);seatRock(r);if(t>=1){r.state='ground';r.settle=null;status('Boulder settled on a stable face.');controlsState();}}
 }
 if(terrainDirty)rebuildGround();
 impactDust.update(elapsed);updateSoil(dt);
 for(const w of waters){w.position.y=wet.water-BASIN_MAX_METRES+.002;w.material.uniforms.level.value=wet.water-BASIN_MAX_METRES;w.visible=wet.water>0;}
 $('water').textContent='Shared soil saturation: '+Math.round(wet.wet*100)+'% · water: '+(wet.water*100).toFixed(1)+' cm · exposed holes: '+holes.length;
 const r=selected();$('stats').textContent=r? r.id+' · '+r.triangles.toLocaleString()+' triangles · '+r.state+' · '+(boulderBlocks(r,r.x,r.z)?'blocks ground':'not a ground obstacle'):'';
 document.body.dataset.ready=String(ready);document.body.dataset.boulders=JSON.stringify({holes:holes.length,states:rocks.map(r=>r.state),held:held?.id||null,busy:busy?.kind||null,water:wet.snapshot(),soilWetness:soilWetness.value,impactClouds:impactDust.count,particles:particles.filter(p=>p.life>0).length,pickupTime:busy?.kind==='pickup'?busy.t:null,pickupHandLocal:giant.model.worldToLocal(giant.roles.get('rightHand').getWorldPosition(new T.Vector3())).toArray(),triangles:rocks.map(r=>r.triangles)});
}
function schedule(){if(!pending)pending=requestAnimationFrame(frame);}function frame(now){pending=0;const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(ready&&!document.hidden)update(dt);impactDust.render(camera,hemi,sun,noFire);if(impactDust.active||particles.some(p=>p.life>0)||busy||rocks.some(r=>(r.state==='flight'||r.state==='rolling'||r.state==='settling'))||wet.active||$('weather').value==='rain')schedule();else last=0;}
new ResizeObserver(()=>{renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();schedule();}).observe(host);document.addEventListener('visibilitychange',()=>{last=0;if(!document.hidden)schedule();});
async function init(){const manifest=await fetch('assets/models/terrain/boulders/manifest.json').then(r=>r.json()),loader=new GLTFLoader();for(const [i,m] of manifest.entries()){const g=await loader.loadAsync(m.file),root=new T.Group(),scale=1.35;g.scene.scale.setScalar(scale);const height=m.dimensionsMetres[1]*scale;g.scene.position.y=-height/2;root.add(g.scene);root.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});scene.add(root);const profile=sampleProfile(root,m.dimensionsMetres[0]*scale,height,m.dimensionsMetres[2]*scale);const supportPoints=rockPoints(root);rocks.push({...m,profile,supportPoints,object:root,width:m.dimensionsMetres[0]*scale,height,depth:m.dimensionsMetres[2]*scale,state:'ground'});$('rock').add(new Option('Boulder '+(i+1),i));}
 status('Loading giant and pickup/throw motions…');const rig=await loadRagdollRig(status,{unitId:'hill-giant',battleScale:true});giant=rig.create('boulder-giant',0,-2);giant.home=giant.root.position.clone();giant.homeRotation=giant.root.quaternion.clone();giant.root.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});scene.add(giant.root);
 const sources=await Promise.all([loadCombatModel(new URL('../assets/animations/ual1/ual1-death02-source.glb',import.meta.url)),loadCombatModel(new URL('../assets/animations/throwing/goalie-throw.fbx',import.meta.url))]);
 for(const [name,source,original]of [['pickup',sources[0],prepareStudioAnimations(sources[0].animations).find(c=>c.name==='PickUp_Kneeling')],['throw',sources[1],sources[1].animations[0]]]){if(!original)throw Error('Missing '+name+' animation');clips[name]=removeWorkshopRootTravel(retargetHumanoidClip(T,original,source.scene,giant.model,name,{mode:'world-bind-delta',hipTranslation:'scaled-world-y'}),giant.model);}
 mixer=new T.AnimationMixer(giant.model);palmGrip=buildPalmGrip();for(const r of rocks){r.grip={support:r.height/2+.025,rotation:new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),palmGrip.normal)};}ready=true;reset();}
init().catch(e=>{console.error(e);$('error').textContent=e.message;status('Could not prepare the test.');});

function sampleProfile(root,width,height,depth){
 root.updateMatrixWorld(true);const n=65,data=new Float32Array(n*n),ray=new T.Raycaster(),meshes=[];
 root.traverse(o=>{if(o.isMesh){meshes.push(o);}});
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){ray.set(new T.Vector3((i/(n-1)-.5)*width,-height-1,(j/(n-1)-.5)*depth),new T.Vector3(0,1,0));const hit=ray.intersectObjects(meshes,false)[0];if(hit)data[j*n+i]=Math.max(0,.15-(hit.point.y+height/2));}
 return {n,data};
}
const particles=Array.from({length:1600},()=>({life:0}));let particleCursor=0;
const dustGeometry=new T.BufferGeometry(),dustPositions=new Float32Array(4800),dustOpacity=new Float32Array(1600),dustSize=new Float32Array(1600);
dustGeometry.setAttribute('position',new T.BufferAttribute(dustPositions,3));dustGeometry.setAttribute('fade',new T.BufferAttribute(dustOpacity,1));dustGeometry.setAttribute('size',new T.BufferAttribute(dustSize,1));
const dustMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,vertexShader:'attribute float fade,size;varying float f;void main(){f=fade;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*600./max(1.,-p.z),1.,64.);}',fragmentShader:'varying float f;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(.29,.17,.08,f*pow(1.-r,1.4));}'});
const dustPoints=new T.Points(dustGeometry,dustMaterial);dustPoints.frustumCulled=false;scene.add(dustPoints);
function updateSoil(dt){
 for(const r of rocks)if(r.state!=='ground'&&r.soilTime>0){r.soilTime=Math.max(0,r.soilTime-dt);const taper=r.state==='held'&&busy?.kind!=='pickup'?Math.min(1,r.soilTime/.5):1;r.soilCredit=(r.soilCredit||0)+dt*(r.state==='rolling'?650:240)*taper;const count=Math.floor(r.soilCredit);r.soilCredit-=count;for(let k=0;k<count;k++){const i=particleCursor++%1600,p=particles[i],dust=Math.random()<(elapsed<(r.impactUntil||0)?.2:.7);const life=r.state==='held'&&busy?.kind!=='pickup'?Math.min(.5,r.soilTime):2.5;Object.assign(p,{life,maxLife:life,rock:r,x:r.x+(Math.random()-.5)*r.width*.8,y:r.state==='rolling'?Math.max(.03,-exposedDepth(holes,r.x,r.z)+.06):r.y-r.height*.25,z:r.z+(Math.random()-.5)*r.depth*.8,vx:(Math.random()-.5)*(r.state==='rolling'?4:.7),vz:(Math.random()-.5)*(r.state==='rolling'?4:.7),vy:r.state==='rolling'?1+Math.random()*2:-Math.random(),dust});dustSize[i]=dust?.12+Math.random()*.25:.035;}}
 particles.forEach((p,i)=>{if(p.life<=0){dustOpacity[i]=0;return;}p.life-=dt;p.vy-=dt*(p.dust?2.5:9.8);p.x+=p.vx*dt;p.z+=p.vz*dt;p.y=Math.max(-exposedDepth(holes,p.x,p.z)+.01,p.y+p.vy*dt);dustPositions.set([p.x,p.y,p.z],i*3);dustOpacity[i]=Math.max(0,p.life/Math.max(.001,p.maxLife))*(p.dust?.65:1);});for(const a of Object.values(dustGeometry.attributes))a.needsUpdate=true;
}



function buildPalmGrip(){
 const hand=giant.roles.get('rightHand');giant.root.updateMatrixWorld(true);
 const bones=[];hand.traverse(b=>{if(b.isBone&&b!==hand)bones.push(b);});
 const bases=bones.filter(b=>b.parent===hand);
 const find=word=>bases.find(b=>b.name.toLowerCase().includes(word));
 const index=find('index'),pinky=find('pinky')||find('little'),middle=find('middle');
 const wrist=hand.getWorldPosition(new T.Vector3()),q=hand.getWorldQuaternion(new T.Quaternion()),inv=q.clone().invert();
 const tip=(middle||index||bases[0])?.getWorldPosition(new T.Vector3())||wrist.clone().add(new T.Vector3(.15,0,0).applyQuaternion(q));
 const forward=tip.clone().sub(wrist).normalize();
 const side=index&&pinky?index.getWorldPosition(new T.Vector3()).sub(pinky.getWorldPosition(new T.Vector3())).normalize():new T.Vector3(0,0,1).applyQuaternion(q);
 const normal=new T.Vector3().crossVectors(forward,side).normalize();
 // Palm faces opposite the dorsal thumb side on this right-hand skeleton.
 const thumb=find('thumb');if(thumb){const towardThumb=thumb.getWorldPosition(new T.Vector3()).sub(wrist);if(normal.dot(towardThumb)<0)normal.negate();}
 const fingers=bones.filter(b=>b.children.some(c=>c.isBone)&&!b.name.toLowerCase().includes('thumb')).map(b=>({bone:b,axis:side.clone().applyQuaternion(b.getWorldQuaternion(new T.Quaternion()).invert()).normalize()}));
 return {offset:tip.sub(wrist).multiplyScalar(.55).applyQuaternion(inv),normal:normal.applyQuaternion(inv),fingers};
}

function rockPoints(root){
 root.updateMatrixWorld(true);const out=[],inverse=root.matrixWorld.clone().invert();
 root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,m=inverse.clone().multiply(o.matrixWorld);for(let i=0;i<p.count;i++)out.push(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(m));});return out;
}
function stableRest(r){
 // Minimise support height of the rock centre: unstable edges tip downhill.
 // Geometry is already centred; use bounds centre as a uniform-density proxy.
 const q=r.object.quaternion.clone(),v=new T.Vector3();
 const energy=rotation=>{let bottom=Infinity;for(const p of r.supportPoints)bottom=Math.min(bottom,v.copy(p).applyQuaternion(rotation).y);return -bottom;};
 let best=energy(q);const axes=[new T.Vector3(1,0,0),new T.Vector3(0,0,1)];
 for(const angle of [.35,.15,.06,.02,.006,.002])for(let pass=0;pass<35;pass++){let improved=false;for(const axis of axes)for(const sign of [-1,1]){const candidate=new T.Quaternion().setFromAxisAngle(axis,angle*sign).multiply(q),e=energy(candidate);if(e<best-1e-7){best=e;q.copy(candidate);improved=true;}}if(!improved)break;}return q;
}
function seatRock(r){
 const v=new T.Vector3();let y=-Infinity;
 for(const p of r.supportPoints){v.copy(p).applyQuaternion(r.object.quaternion);y=Math.max(y,-exposedDepth(holes,r.x+v.x,r.z+v.z)-v.y);}
 r.y=y+.008;r.object.position.set(r.x,r.y,r.z);
}

