import * as T from '../assets/vendor/three/three.module.min.js';
import {createCombatRenderer} from './combat-webgl.mjs?v=cover-profile1';
import {loadWorkshopCombatUnit} from './combat-workshop-unit.mjs?v=spell-poses1';
import {createWorkshopRepositoryMob} from './workshop-repository-mob.mjs';
import {appearanceRecipeForMob} from './mob-appearance.mjs?v=R238C204';
import {directUnitFrame,sampleDirectPose,captureDirectUnit,setDirectUnit} from './combat-direct-units.mjs?v=outline-reuse2';
import {loadCombatModel} from './combat-model-source.mjs';
import {solarState,weatherSolarState,solarAmbient,solarFaceGain,solarTimeLabel} from './solar-clock.mjs?v=R238C380';
import {OUTDOOR_AMBIENT} from './exploration-environment.mjs?v=R238C262';
import {surfaceLight} from './exploration-scene-style.mjs';
import {snowAmbientDisplay,corpseSnowTint} from './combat-corpse-snow.mjs?v=natural-ac1';
import {COMBAT_LIGHTING_DEFAULTS,lightingProfile} from './combat-lighting-profile.mjs';

const $=id=>document.getElementById(id);
const defaults={hour:0,sky:1,sun:1,local:1,distance:2.2,lampAngle:-35,snow:4,rotation:0,zoom:1,ambient:150,...COMBAT_LIGHTING_DEFAULTS};
const values={...defaults};
const specs=[
 ['hour','Solar time',0,23.9,.1,'light',v=>solarTimeLabel(v)],['sky','Sky light',0,2,.05,'light'],['sun','Sunlight',0,2,.05,'light'],['local','Lamp strength',0,3,.05,'light'],['distance','Lamp distance',.5,8,.1,'light',v=>v.toFixed(1)+' m'],['lampAngle','Lamp direction',-180,180,5,'light',v=>v+'°'],
 ['roughness','Roughness floor',0,1,.02,'material'],['metalness','Metalness ceiling',0,1,.02,'material'],['shieldSpecular','Shield specular',0,1,.05,'material'],['compression','Diffuse compression',0,1,.05,'material'],['diffuse','Reflected-light gain',0,2,.05,'material'],['snowReflectance','Snow lamp reflectance',0,1,.05,'material'],['snow','Corpse snow',0,4,.25,'material',v=>(v*.5).toFixed(2)+' inches'],['rotation','View rotation',0,360,5,'material',v=>v+'°'],['zoom','Zoom',.65,1.6,.05,'material']
];
for(const [key,label,min,max,step,section,format] of specs){const row=document.createElement('label');row.className='control';row.htmlFor=key;const line=document.createElement('span'),name=document.createElement('span'),out=document.createElement('output'),input=document.createElement('input');name.textContent=label;out.id=key+'Out';out.htmlFor=key;line.append(name,out);Object.assign(input,{type:'range',id:key,min,max,step,value:values[key]});input.oninput=()=>{values[key]=+input.value;sync();schedule();};row.append(line,input);$(section+'Controls').append(row);}
function sync(){for(const [key,,,,,,format] of specs){$(key).value=values[key];$(key+'Out').value=format?format(values[key]):values[key].toFixed(2);}$('linearLightColors').checked=values.linearLightColors;}
let gpu,loaded,standing,corpse,corpseAsset,shieldImage,shieldFrame,frameHandle=null,ready=false,renderCount=0;
const host=$('viewport'),canvas=$('view');
globalThis.adventurePartyCorpseProgress=()=>1;
globalThis.adventurePartyUnitViewYawOffset=()=>values.rotation*Math.PI/180;
const imageFor=pose=>loaded.images[Object.values(loaded.manifest.poses[pose].frames)[0]];
function schedule(){if(!ready||frameHandle!==null)return;frameHandle=requestAnimationFrame(()=>{frameHandle=null;try{render();}catch(error){fail(error);}});}
function groundBaseline(solar){const ambient=solarAmbient(OUTDOOR_AMBIENT,solar);ambient.intensity*=solarFaceGain({x:0,y:1,z:0},solar);return surfaceLight({x:0,y:0,z:0},{x:0,y:1,z:0},[],()=>true,ambient).map(v=>Math.max(.01,v)**(1/2.2));}
function render(){
 const before=$('compare').value==='before',profile=lightingProfile(before?{...values,compression:0}:values);
 const solar=weatherSolarState(solarState(values.hour),{type:$('weather').value,intensity:1});
 globalThis.adventurePartySolar={state:()=>solar};
 const w=Math.round(host.clientWidth),h=Math.round(host.clientHeight),view={width:w,height:h,zoom:1,anchor:{x:0,y:0},matrix:[1,0,0,1,0,0]};
 canvas.width=w;canvas.height=h;
 const snowGroundLight=groundBaseline({...solar,sky:solar.sky*profile.sky});
 gpu.begin(view);const ctx=gpu.context;
 const tint=$('ambientSnow').checked?corpseSnowTint(4):[.24,.28,.31];
 const ground=snowAmbientDisplay(snowGroundLight.map((v,i)=>v*tint[i])).toArray().map(v=>Math.round(v*255));ctx.fillStyle=`rgb(${ground.join(',')})`;ctx.fillRect(0,0,w,h);
 ctx.strokeStyle='rgba(170,190,210,.13)';ctx.lineWidth=1;for(let x=0;x<w;x+=w/10){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=h/6){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 const lampAngle=values.lampAngle*Math.PI/180,localLights=[{position:[Math.sin(lampAngle)*values.distance,1.9,Math.cos(lampAngle)*values.distance],range:18,intensity:12,color:[1,192/255,110/255]}];
 const f=loaded.manifest.frame,scale=Math.min(w/850,h/500)*6*values.zoom;
 const common={width:f.renderWidth*scale,height:f.renderHeight*scale,anchor:{x:f.anchorX/f.width,y:f.anchorY/f.height},rotation:values.rotation*Math.PI/180,pixelsPerMetre:128/3*scale,opacity:1,saturation:1,solar,ambientPercent:values.ambient,outdoor:true,localLights,snowGroundLight,lightingProfile:profile,equipmentEffects:false};
 corpseAsset.corpseSnow.value=values.snow;
 const draw=globalThis.adventurePartyDirectUnits.draw;
 if(!draw(gpu,imageFor('ready'),{...common,entity:standing,x:w*.20,y:h*.77}))throw Error('Standing model did not render');
 if(!draw(gpu,imageFor('prone'),{...common,entity:corpse,x:w*.52,y:h*.76}))throw Error('Corpse model did not render');
 draw(gpu,shieldImage,{...common,entity:null,x:w*.82,y:h*.58,width:shieldFrame.width*scale,height:shieldFrame.height*scale,anchor:{x:.5,y:.5}});
 gpu.end();renderCount++;
 $('status').textContent=`${solarTimeLabel(values.hour)} · ${solar.phase} · ${before?'Highlight limits off':'Current tuning'} · ${values.snow*.5} inches of corpse snow`;
 document.body.dataset.ready='true';document.body.dataset.renders=String(renderCount);
 document.body.dataset.lighting=JSON.stringify({before,profile,solar,corpseSnow:corpseAsset.corpseSnow.value,triangles:directUnitFrame(imageFor('ready')).asset.triangles});
}
function fail(error){$('error').textContent='Lighting lab: '+error.message;document.body.dataset.ready='error';console.error(error);}
async function init(){
 const response=await fetch('data/mobs/orc-warrior.workshop-unit.json');if(!response.ok)throw Error('Orc package unavailable');
 const adapter=createWorkshopRepositoryMob(await response.json());standing=adapter.apply({id:'lab-standing',alive:true,x:0,y:0},()=>.5);standing.alive=true;
 const captured=adapter.recipe(standing),recipe=appearanceRecipeForMob(standing,{...captured.model,poseProfile:captured.poseProfile,renderSettings:captured.renderSettings});
 loaded=await loadWorkshopCombatUnit(recipe,{onProgress:({step})=>{$('status').textContent=step;}});
 corpse={...standing,id:'lab-corpse',alive:false,deathPresentationStartedAt:performance.now()-60000};
 corpseAsset=sampleDirectPose(directUnitFrame(imageFor('prone')),corpse).asset;
 if(!corpseAsset.corpseSnow)throw Error('Published death pose did not settle');
 const {scene:shield}=await loadCombatModel(new URL('../assets/models/shields/round-wooden-shield.glb',import.meta.url));
 shield.userData.studioShield=true;shield.updateMatrixWorld(true);const box=new T.Box3().setFromObject(shield),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3()),factor=1/Math.max(size.x,size.y,size.z);
 shield.scale.multiplyScalar(factor);shield.position.copy(center).multiplyScalar(-factor);shield.updateMatrixWorld(true);
 const group=new T.Group();group.add(shield);const camera=new T.OrthographicCamera(-.85,.85,.85,-.85,.01,20);camera.position.set(0,.35,4);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 shieldImage={};setDirectUnit(shieldImage,captureDirectUnit(group,camera),0);shieldFrame={width:40,height:40};
 gpu=createCombatRenderer(canvas,document.createElement('canvas'));ready=true;sync();schedule();
}
for(const [id,settings,weather] of [['night',{hour:0,local:1},'clear'],['day',{hour:12,local:0},'clear'],['overcast',{hour:12,local:0},'snow'],['unlit',{hour:0,local:0},'clear']])$(id).onclick=()=>{Object.assign(values,settings);$('weather').value=weather;sync();schedule();};
$('ambientSnow').onchange=$('weather').onchange=$('compare').onchange=schedule;
$('linearLightColors').onchange=()=>{values.linearLightColors=$('linearLightColors').checked;schedule();};
$('reset').onclick=()=>{Object.assign(values,defaults);$('weather').value='clear';$('compare').value='current';sync();schedule();};
$('export').onclick=()=>{const output=$('exports');output.hidden=false;output.value=JSON.stringify({lab:'Adventure Party outdoor lighting',version:391,weather:$('weather').value,compare:$('compare').value,settings:values},null,2);output.focus();output.select();};
new ResizeObserver(schedule).observe(host);
window.addEventListener('pagehide',()=>{if(frameHandle!==null)cancelAnimationFrame(frameHandle);gpu?.dispose?.();});
sync();init().catch(fail);
