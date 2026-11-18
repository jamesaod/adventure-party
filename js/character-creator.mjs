import {HELMET_FILE,helmetSettings,attachHelmet,helmetControls} from './workshop-helmet.mjs?v=head2';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {SLOTS,preset,validateDesign,assembleParts,adaptAnimation,disposeAssembly} from './character-creator-core.mjs';
const $=id=>document.getElementById(id),base=new URL('../assets/characters/quaternius/',import.meta.url),storageKey='adventure-party-character-creator-v1';
const loader=new GLTFLoader(),cache=new Map(),textureCache=new Map();
let syncHelmet=()=>{};
let catalog,design,assembly,mixer,action,clips=[],helper,playing=false,busy=false,saved=[];
const scene=new THREE.Scene();scene.background=new THREE.Color('#11151b');
const camera=new THREE.PerspectiveCamera(34,1,.01,100);camera.position.set(2.3,1.6,3.5);
const renderer=new THREE.WebGLRenderer({canvas:$('view'),antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,.95,0);orbit.minDistance=.5;orbit.maxDistance=8;orbit.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xd9e8ff,0x75654d,2.1));const key=new THREE.DirectionalLight(0xffeddb,3.0);key.position.set(3,5,4);scene.add(key);const fill=new THREE.DirectionalLight(0xa9caff,1.3);fill.position.set(-3,2,-2);scene.add(fill);
const ground=new THREE.Mesh(new THREE.CylinderGeometry(.8,.83,.04,64),new THREE.MeshStandardMaterial({color:0x303a44,roughness:.95}));ground.position.y=-.035;scene.add(ground);
const grid=new THREE.GridHelper(8,40,0x303b46,0x202a34);grid.position.y=-.058;scene.add(grid);
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
async function guarded(fn){if(busy)return;busy=true;const states=[...document.querySelectorAll('button,select,input')].map(el=>[el,el.disabled]);states.forEach(([el])=>el.disabled=true);$('loading').hidden=false;try{await fn();}catch(e){console.error(e);status(e.message,true);}finally{busy=false;states.forEach(([el,disabled])=>el.disabled=disabled);$('loading').hidden=true;if(design)$('hair').disabled=!!design.parts.hood;}}
function asset(file){if(!cache.has(file))cache.set(file,loader.loadAsync(new URL(file,base).href).catch(e=>{cache.delete(file);throw e;}));return cache.get(file);}
function texture(file){if(!textureCache.has(file))textureCache.set(file,new THREE.TextureLoader().loadAsync(new URL(file,base).href).then(t=>{t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;return t;}).catch(e=>{textureCache.delete(file);throw e;}));return textureCache.get(file);}
function options(select,entries,value,empty){select.replaceChildren();if(empty)select.add(new Option(empty,''));for(const e of entries)select.add(new Option(e.label,e.id));select.value=value;}
function fields(){
 $('parts').replaceChildren();for(const slot of SLOTS){const label=document.createElement('label');label.textContent={body:'Torso',arms:'Arms & hands',legs:'Legs',feet:'Footwear',hood:'Hood',shoulders:'Shoulders'}[slot];const select=document.createElement('select');select.id='part-'+slot;options(select,catalog.parts.filter(p=>p.gender===design.gender&&p.slot===slot),design.parts[slot],['hood','shoulders'].includes(slot)?'None':null);select.onchange=()=>guarded(async()=>{const next=structuredClone(design);next.parts[slot]=select.value;await rebuild(next);});label.append(select);$('parts').append(label);}
 for(const slot of ['hair','beard'])options($(slot),catalog.hair.filter(p=>p.slot===slot),design[slot],'None');
 for(const k of ['name','gender','palette','skin','tint','hairColor'])$(k).value=design[k];
 $('hair').disabled=!!design.parts.hood;
}
async function colorize(a,d){const pending=[];a.root.traverse(o=>{if(!o.isMesh)return;for(const m of [].concat(o.material)){m.wireframe=$('wire').checked;let file;
 if(m.name.includes('MI_Ranger')||m.name.includes('MI_Peasant')){const family=m.name.includes('Ranger')?'Ranger':'Peasant';file=catalog.textures[family][d.palette].file;m.color.set(d.tint);}
 else if(/MI_Superhero/.test(m.name)){file=catalog.textures[`${d.gender==='male'?'Male':'Female'} skin`][d.skin].file;}
 else if(/MI_Hair/.test(m.name))m.color.set(d.hairColor);
 if(file)pending.push(texture(file).then(t=>{m.map=t;m.needsUpdate=true;}));
 }});await Promise.all(pending);}
async function rebuild(next){
 const checked=validateDesign(next,catalog);checked.helmet=helmetSettings(next.helmet);const entries=SLOTS.map(slot=>catalog.parts.find(p=>p.id===checked.parts[slot])).filter(Boolean);
 entries.push({...catalog.heads.find(p=>p.gender===checked.gender),slot:'head'});
 for(const slot of ['hair','beard'])if(checked[slot]&&!(slot==='hair'&&checked.parts.hood))entries.push(catalog.hair.find(p=>p.id===checked[slot]));
 const loaded=await Promise.all(entries.map(async e=>({...e,scene:clone((await asset(e.file)).scene)})));
 let candidate;try{candidate=assembleParts(loaded);await colorize(candidate,checked);if(checked.helmet.enabled){const helmet=await loader.loadAsync(new URL(HELMET_FILE,import.meta.url).href);attachHelmet(candidate,helmet.scene,checked.helmet);}const nextClips=await Promise.all(catalog.animations.map(async a=>{const donor=await asset(a.file);const clip=adaptAnimation(clone(donor.scene),donor.animations[0],candidate.root);clip.name=a.label;return clip;}));
 const selected=$('animation').value,wasPlaying=playing,oldTime=action?.time||0;
 if(mixer){mixer.stopAllAction();mixer.uncacheRoot(assembly.root);}if(helper){scene.remove(helper);helper.geometry.dispose();helper.material.dispose();helper=null;}disposeAssembly(assembly);
 assembly=candidate;design=checked;clips=nextClips;scene.add(assembly.root);mixer=new THREE.AnimationMixer(assembly.root);
 options($('animation'),clips.map(c=>({id:c.name,label:c.name})),selected,'Rest pose');fields();syncHelmet();setClip(selected);if(action){action.time=Math.min(oldTime,action.getClip().duration);mixer.update(0);}playing=!!action&&wasPlaying;$('play').textContent=playing?'Pause':'Play';showBones();
 let tris=0;assembly.root.traverse(o=>{if(o.isMesh)tris+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});$('stats').textContent=`${entries.length} parts · ${Math.round(tris).toLocaleString()} triangles`;status('Character ready. Preview movement, then export your rigged model.');
 }catch(e){if(candidate&&candidate!==assembly)disposeAssembly(candidate);throw e;}
}
function setClip(name){mixer?.stopAllAction();action=null;playing=false;if(mixer&&name){const clip=clips.find(c=>c.name===name);if(clip){action=mixer.clipAction(clip);action.play();mixer.update(0);playing=true;}}$('play').textContent=playing?'Pause':'Play';$('timeline').value=0;$('time').textContent='0.00 s';}
function showBones(){if(helper){scene.remove(helper);helper.geometry.dispose();helper.material.dispose();helper=null;}if($('bones').checked&&assembly){helper=new THREE.SkeletonHelper(assembly.root);helper.material.depthTest=false;helper.renderOrder=9;scene.add(helper);}}
function download(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
const filename=()=>design.name.replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'')||'character';
function savedOptions(){options($('saved'),saved.map(s=>({id:s.id,label:s.design.name})),'','Choose a saved character…');}
function readSaved(){try{const parsed=JSON.parse(localStorage.getItem(storageKey)||'[]');if(!Array.isArray(parsed))throw Error('Invalid library');saved=parsed.filter(s=>{try{validateDesign(s.design,catalog);return typeof s.id==='string';}catch{return false;}});}catch{saved=[];status('Saved library could not be read; exported designs can still be imported.',true);}savedOptions();}
async function exportModel(){const selected=$('animation').value,time=action?.time||0,wasPlaying=playing;mixer.stopAllAction();mixer.update(0);try{assembly.root.userData={creator:'Adventure Party Character Creator',license:design.helmet?.enabled?'Quaternius CC0; helmet supplied by user (separate rights)':'CC0-1.0',design:structuredClone(design)};const bytes=await new GLTFExporter().parseAsync(assembly.root,{binary:true,animations:clips,onlyVisible:true});download(bytes,filename()+'.glb','model/gltf-binary');status('Rigged GLB exported. In MOB Workshop, use Load model file to open it.');}finally{setClip(selected);if(action){action.time=time;mixer.update(0);}playing=wasPlaying;$('play').textContent=playing?'Pause':'Play';}}
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>guarded(()=>rebuild({...preset(catalog,design.gender,b.dataset.preset),name:design.name,helmet:design.helmet})));
 $('gender').onchange=()=>guarded(()=>rebuild({...preset(catalog,$('gender').value,'Ranger'),name:design.name,helmet:design.helmet}));
for(const slot of ['hair','beard'])$(slot).onchange=()=>guarded(()=>rebuild({...design,[slot]:$(slot).value}));
for(const k of ['palette','skin','tint','hairColor'])$(k).onchange=()=>guarded(async()=>{const next={...design,[k]:['palette','skin'].includes(k)?Number($(k).value):$(k).value};await colorize(assembly,next);design=next;});
$('name').oninput=()=>{if(design)design.name=$('name').value.trim()||'New adventurer';};
$('animation').onchange=()=>setClip($('animation').value);$('play').onclick=()=>{if(!action){status('Select an animation to play.');return;}playing=!playing;$('play').textContent=playing?'Pause':'Play';};
$('timeline').oninput=()=>{if(action){playing=false;$('play').textContent='Play';action.time=Number($('timeline').value)/1000*action.getClip().duration;mixer.update(0);}};
$('wire').onchange=()=>assembly?.materials.forEach(m=>m.wireframe=$('wire').checked);$('bones').onchange=showBones;
function frame(sign=1){camera.position.set(0,1.05,sign*3.8);orbit.target.set(0,.94,0);orbit.update();}
$('front').onclick=()=>frame();$('back').onclick=()=>frame(-1);$('frame').onclick=()=>frame();
$('save').onclick=()=>{try{const existing=saved.find(s=>s.design.name===design.name),entry={id:existing?.id||crypto.randomUUID(),design:structuredClone(design)};const next=existing?saved.map(s=>s.id===existing.id?entry:s):[...saved,entry];localStorage.setItem(storageKey,JSON.stringify(next));saved=next;savedOptions();$('saved').value=entry.id;status('Saved '+design.name+' in this browser.');}catch(e){status('Could not save: '+e.message,true);}};
$('load').onclick=()=>guarded(async()=>{const entry=saved.find(s=>s.id===$('saved').value);if(!entry)throw Error('Choose a saved character.');await rebuild(entry.design);});
$('delete').onclick=()=>{const id=$('saved').value;if(!id)return;try{const next=saved.filter(s=>s.id!==id);localStorage.setItem(storageKey,JSON.stringify(next));saved=next;savedOptions();status('Saved character removed. The current preview is unchanged.');}catch(e){status(e.message,true);}};
$('exportDesign').onclick=()=>download(JSON.stringify(design,null,2),filename()+'.character.json','application/json');
$('importDesign').onchange=e=>guarded(async()=>{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw Error('Design file is too large.');await rebuild(JSON.parse(await file.text()));e.target.value='';});
$('exportModel').onclick=()=>guarded(exportModel);
const resize=new ResizeObserver(()=>{const r=$('viewport').getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();});resize.observe($('viewport'));
let last=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;if(!busy&&playing)mixer?.update(dt*Number($('speed').value));if(action){$('timeline').value=action.time/action.getClip().duration*1000;$('time').textContent=action.time.toFixed(2)+' s';}orbit.update();helper?.update();renderer.render(scene,camera);});
addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);resize.disconnect();orbit.dispose();disposeAssembly(assembly);renderer.dispose();});
syncHelmet=helmetControls({getDesign:()=>design,getAssembly:()=>assembly,rebuild,guarded});
await guarded(async()=>{const response=await fetch(new URL('catalog.json',base));if(!response.ok)throw Error('The character catalog could not load.');catalog=await response.json();design=preset(catalog);if(new URLSearchParams(location.search).get('helmet')==='tripo')design.helmet={enabled:true};await rebuild(design);readSaved();frame();});
// Read-only diagnostics for assembly checks and support.
globalThis.characterCreatorSnapshot=()=>({ready:!!assembly,busy,design:design&&structuredClone(design),bones:assembly?.bones.size,clips:clips.map(c=>c.name),parts:assembly?.root.children.filter(o=>o.isMesh).map(o=>o.userData.partId)});



