import * as T from '../assets/vendor/three/three.module.min.js';
import {ARROW_VISUAL as profile} from './arrow-visual-profile.mjs';
import {sampleDeflection,canDeflect} from './shield-deflection-test-motion.mjs';
const $=id=>document.getElementById(id),host=$('stage'),scene=new T.Scene();scene.background=new T.Color('#1e2d3a');
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;host.append(renderer.domElement);
const camera=new T.PerspectiveCamera(40,1,.05,100);scene.add(new T.HemisphereLight(0xd8ecff,0x66513c,2));const sun=new T.DirectionalLight(0xffe4bc,3);sun.position.set(-3,7,4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
const mesh=(geometry,color,parent=scene)=>{const m=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.7}));m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
const floor=mesh(new T.PlaneGeometry(24,20),'#354a51');floor.rotation.x=-Math.PI/2;const grid=new T.GridHelper(20,20,0x546b72,0x40575f);grid.position.y=.002;scene.add(grid);
const dummy=new T.Group();dummy.position.x=.45;scene.add(dummy);mesh(new T.CapsuleGeometry(.24,.7,5,12),'#566579',dummy).position.y=1.15;mesh(new T.SphereGeometry(.19,16,12),'#aa9682',dummy).position.y=1.88;
for(const z of [-.16,.16])mesh(new T.CapsuleGeometry(.095,.65,4,8),'#394455',dummy).position.set(0,.47,z);
const shield=mesh(new T.CylinderGeometry(.52,.52,.1,32),'#557a8b');shield.rotation.z=Math.PI/2;shield.position.set(-.1,1.25,0);
const boss=mesh(new T.SphereGeometry(.14,16,12),'#b8c3c7');boss.scale.x=.45;boss.position.set(-.19,1.25,0);
const arrow=new T.Group();scene.add(arrow);const shaft=mesh(new T.CylinderGeometry(profile.shaftWidth/40,profile.shaftWidth/40,.8,8),profile.wood,arrow);shaft.rotation.z=-Math.PI/2;
const head=mesh(new T.ConeGeometry(profile.headWidth/20,profile.headLength/20,4),profile.head,arrow);head.rotation.z=-Math.PI/2;head.position.x=.4+profile.headLength/40;
for(const angle of [0,Math.PI/2]){const feather=mesh(new T.BoxGeometry(profile.featherLength/20,.006,profile.featherWidth/10),profile.feather,arrow);feather.position.x=-.3;feather.rotation.x=angle;}
const flash=mesh(new T.SphereGeometry(.045,12,8),'#fff2b6');flash.material=new T.MeshBasicMaterial({color:0xffefb0,transparent:true});flash.position.set(-.25,1.25,0);
let time=0,playing=false,last=performance.now(),raf;const options=()=>Object.fromEntries(['shield','front'].map(k=>[k,$(k).checked]).concat(['missBy','loft','spins','side'].map(k=>[k,+$(k).value])));
function render(){const o=options(),p=sampleDeflection(time,o);$('timeline').max=p.end;$('timeline').value=time;$('timeOut').value=time.toFixed(2)+' s';$('phase').textContent=p.stage;arrow.position.set(p.x,p.y,p.z);arrow.rotation.set(0,0,p.angle);shield.visible=boss.visible=o.shield;const elapsed=time-.65;flash.visible=canDeflect(o)&&elapsed>=0&&elapsed<.12;flash.material.opacity=Math.max(0,1-elapsed/.12);const a=+$('camera').value*Math.PI/180;camera.position.set(-2+Math.sin(a)*7,3.7,Math.cos(a)*8);camera.lookAt(-1.8,1,0);renderer.render(scene,camera);if(time>=p.end){playing=false;$('pause').textContent='Resume';}}
function tick(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(playing&&!document.hidden){const before=time;time+=dt*+$('speed').value;audioStep(before,time);}render();raf=requestAnimationFrame(tick);}
let context,master,ready;const buffers={},voices=new Set();
function stopAudio(){for(const source of voices){try{source.stop();}catch{}}voices.clear();}
async function enableAudio(){
 context??=new AudioContext();if(!master){master=context.createGain();master.connect(context.destination);}setVolume();await context.resume();
 ready??=Promise.all(Object.entries({tick:'shield-deflection/shield-tick.mp3',spin:'shield-deflection/spinning-lasso.mp3',land:'bow/miss.wav'}).map(async([key,path])=>{const response=await fetch('assets/audio/sfx/'+path);if(!response.ok)throw Error(path);buffers[key]=await context.decodeAudioData(await response.arrayBuffer());}));
 try{await ready;$('audioStatus').textContent='Sounds ready';return true;}catch(error){$('audioStatus').textContent='Audio unavailable: '+error.message;ready=null;return false;}
}
function setVolume(){if(master)master.gain.value=$('mute').checked?0:+$('volume').value;$('volumeOut').value=Math.round(+$('volume').value*100)+'%';}
function sound(key,{duration,offset=0,gain=1}={}){
 if(!buffers[key]||context.state!=='running')return;
 const source=context.createBufferSource(),level=context.createGain(),buffer=buffers[key];source.buffer=buffer;
 source.playbackRate.value=duration?buffer.duration/duration:1;level.gain.value=gain;source.connect(level);level.connect(master);
 const remaining=(buffer.duration-offset)/source.playbackRate.value;if(remaining<=0)return;
 level.gain.setValueAtTime(gain,context.currentTime);level.gain.setValueAtTime(gain,context.currentTime+Math.max(0,remaining-.06));level.gain.linearRampToValueAtTime(0,context.currentTime+remaining);
 voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();level.disconnect();};source.start(0,offset);
}
function resumeSpin(){const o=options(),p=sampleDeflection(time,o),landing=p.end-.3;if(canDeflect(o)&&time>=.65&&time<landing&&buffers.spin)sound('spin',{duration:(landing-.65)/+$('speed').value,offset:buffers.spin.duration*(time-.65)/(landing-.65),gain:.5});}
function audioStep(before,after){const o=options(),p=sampleDeflection(after,o),deflect=canDeflect(o),landing=p.end-(deflect?.3:0);if(deflect&&before<.65&&after>=.65){sound('tick',{gain:.8});resumeSpin();}if(before<landing&&after>=landing){stopAudio();sound('land',{gain:.65});}}
let playbackRequest=0;
async function replay(){const request=++playbackRequest;playing=false;stopAudio();await enableAudio();if(request!==playbackRequest)return;time=0;last=performance.now();playing=true;$('pause').textContent='Pause';}
$('replay').onclick=replay;$('pause').textContent='Resume';$('pause').onclick=async()=>{if(playing){++playbackRequest;playing=false;stopAudio();$('pause').textContent='Resume';}else{const request=++playbackRequest;await enableAudio();if(request!==playbackRequest)return;if(time>=sampleDeflection(time,options()).end)time=0;playing=true;last=performance.now();resumeSpin();$('pause').textContent='Pause';}};
$('timeline').oninput=()=>{++playbackRequest;playing=false;stopAudio();time=+$('timeline').value;$('pause').textContent='Resume';};
for(const id of ['speed','loft','spins','side'])$(id).oninput=()=>{$(id+'Out').value=$(id).value+(id==='speed'?'×':'');if(id!=='speed')replay();else{stopAudio();if(playing)resumeSpin();}};for(const id of ['missBy','shield','front'])$(id).onchange=replay;
$('volume').oninput=setVolume;$('mute').onchange=setVolume;
document.addEventListener('visibilitychange',()=>{stopAudio();if(!document.hidden&&playing)resumeSpin();});
window.addEventListener('keydown',e=>{if(e.target.matches('input,button'))return;if(e.code==='Space'){e.preventDefault();$('pause').click();}if(e.key.toLowerCase()==='r')replay();});
new ResizeObserver(()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();}).observe(host);
window.addEventListener('pagehide',()=>{stopAudio();context?.close();cancelAnimationFrame(raf);renderer.dispose();});raf=requestAnimationFrame(tick);
