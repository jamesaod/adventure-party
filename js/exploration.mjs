import {torchAnimation} from './exploration-scene-style.mjs?v=R238C239';
import {isOutdoor,OUTDOOR_AMBIENT} from './exploration-environment.mjs?v=R238C238';
import {effectiveEdges,edgeGeometry,doorKey} from './exploration-edges.mjs?v=R238C232';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {explorationMaterials,explorationDoor,SCENE_STYLE,torchPlacement,CELL,HEIGHT} from './exploration-materials.mjs?v=R238C239';
import {FACINGS,cellKey,createExplorationState,act} from './exploration-core.mjs?v=R238C238';
import {explorationMapMarkup} from './exploration-map.mjs?v=R238C232';
import {discoveryKey,restoreDiscovery,revealDiscovery,saveDiscovery} from './exploration-discovery.mjs?v=R238C232';
import {testContext,testStateKey,exitUrl} from './exploration-test-context.mjs?v=R238C241';
import {createEncounterClient} from './exploration-encounter-client.mjs?v=R238C241';
const $=id=>document.getElementById(id),canvas=$('view'),viewport=$('viewport');
const EYE=SCENE_STYLE.eyeMetres,doors=new Map(),flames=[];
let encounterClient,returnMessage,context,spawn,discovery,renderer,map,state,camera,scene,motion=null,frame,resizeObserver;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function message(text){if(!text)return;const li=document.createElement('li');li.textContent=text;$('messages').append(li);while($('messages').children.length>3)$('messages').firstChild.remove();}
function status(){ revealDiscovery(map,state,discovery);try{const storage=context?sessionStorage:localStorage;storage.setItem(context?testStateKey(context,'discovery'):discoveryKey(map),saveDiscovery(discovery));if(context)storage.setItem(testStateKey(context,'doors'),JSON.stringify([...state.openDoors]));}catch{$('mapSaveStatus').textContent='Map remembered for this visit only (browser storage unavailable).';} $('areaMap').innerHTML=explorationMapMarkup(map,state,discovery);$('mapPosition').textContent=`Party: ${state.x+1}, ${state.z+1} · ${FACINGS[state.facing]}`; $('position').textContent=`Square ${state.x+1}, ${state.z+1} · ${state.steps} steps · ${state.visited.size} squares explored`;$('facing').textContent=FACINGS[state.facing];canvas.dataset.position=`${state.x},${state.z},${state.facing}`;const place=map.landmarks?.find(p=>p.x===state.x&&p.z===state.z);if(place)$('landmark').textContent=place.text;}
function box(w,h,d,material,x,y,z,parent=scene){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function resize(){const r=viewport.getBoundingClientRect(),width=Math.max(1,Math.min(Math.floor(r.width),$('pixelView').checked?800:1600));renderer.setSize(width,Math.max(1,Math.round(width*r.height/r.width)),false);canvas.classList.toggle('pixel',$('pixelView').checked);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
function command(action){if(!state||motion)return;if(encounterClient?.defeated()){message('Carl is defeated. Restart the test to begin again.');return;}const previous={x:state.x,z:state.z,facing:state.facing};const old={x:camera.position.x,z:camera.position.z,yaw:camera.rotation.y};const result=act(map,state,action);message(result.message);if(!result.changed)return;status();if(result.moved&&encounterClient?.begin(state,previous)){motion={};return;}if(context&&result.moved){const url=exitUrl(context,state.x,state.z);if(url){motion={};location.assign(url);return;}}const yaw=old.yaw+(action==='left'?Math.PI/2:action==='right'?-Math.PI/2:0);motion={start:performance.now(),duration:reduced?1:190,old,x:state.x*CELL,z:state.z*CELL,yaw};}
async function start(){
 context=new URLSearchParams(location.search).get('test')==='1'?testContext(location.search,sessionStorage):null;
 if(context){map=context.map;spawn=context.spawn;$('returnLink').href='map-editor.html?map='+encodeURIComponent(context.map.id);$('returnLink').textContent='Return to editor';$('mapSaveStatus').textContent='Test discovery is separate from your saved design.';document.querySelector('.notes').hidden=true;document.querySelector('footer').textContent='Editor test - gold rings are exits - Esc returns to editor - design remains unchanged';}else{const response=await fetch('data/exploration/old-tollhouse.json?v=R238C210');if(!response.ok)throw Error('Map could not load.');map=await response.json();spawn=map.start;}
 state=createExplorationState(map);Object.assign(state,spawn);state.visited=new Set([cellKey(state.x,state.z)]);let saved=null;try{saved=(context?sessionStorage:localStorage).getItem(context?testStateKey(context,'discovery'):discoveryKey(map));if(context){const opened=JSON.parse(sessionStorage.getItem(testStateKey(context,'doors'))||'null');if(Array.isArray(opened))state.openDoors=new Set(opened.filter(key=>map.doors.some(d=>doorKey(d)===key)));}}catch{}discovery=restoreDiscovery(map,saved);if(map.encounters?.length){encounterClient=createEncounterClient(map,context);returnMessage=encounterClient.restore(state);map.party=encounterClient.roster();}
 renderer=new THREE.WebGLRenderer({canvas,antialias:false});renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 scene=new THREE.Scene();const skyCanvas=document.createElement('canvas');skyCanvas.width=512;skyCanvas.height=256;
 const skyContext=skyCanvas.getContext('2d'),skyGradient=skyContext.createLinearGradient(0,0,0,256);skyGradient.addColorStop(0,'#346da7');skyGradient.addColorStop(.5,'#9dc7e6');skyGradient.addColorStop(1,'#dbe3df');skyContext.fillStyle=skyGradient;skyContext.fillRect(0,0,512,256);
 skyContext.fillStyle='rgba(255,255,255,.25)';for(let i=0;i<16;i++){skyContext.beginPath();skyContext.ellipse((i*137)%512,35+(i*31)%85,35+i%4*8,7+i%3*3,0,0,Math.PI*2);skyContext.fill();}
 const skyTexture=new THREE.CanvasTexture(skyCanvas);skyTexture.colorSpace=THREE.SRGBColorSpace;scene.background=skyTexture;scene.fog=new THREE.FogExp2('#24211c',.025);camera=new THREE.PerspectiveCamera(66,1,.05,65);camera.rotation.order='YXZ';camera.position.set(state.x*CELL,EYE,state.z*CELL);camera.rotation.y=-state.facing*Math.PI/2;scene.add(camera);
 const {wall,floor,wood,ceiling}=await explorationMaterials(renderer);
 const {ambient,lantern:lamp,torch:torchLight}=SCENE_STYLE;
 scene.add(new THREE.HemisphereLight(ambient.sky,ambient.ground,ambient.intensity));
 const lantern=new THREE.PointLight(lamp.color,lamp.intensity,lamp.range,lamp.decay);lantern.position.set(0,lamp.height-EYE,lamp.offsetZ);lantern.castShadow=true;lantern.shadow.mapSize.set(lamp.shadowPixels,lamp.shadowPixels);lantern.shadow.bias=-.002;lantern.shadow.camera.near=lamp.shadowNear;camera.add(lantern);
 const wallCells=[],floorCells=[];for(let z=0;z<map.height;z++)for(let x=0;x<map.width;x++)(map.grid[z][x]==='#'?wallCells:floorCells).push({x,z});
 const tiles=(cells,height,y,material)=>{if(!cells.length)return;const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(CELL,height,CELL),material,cells.length),matrix=new THREE.Matrix4();cells.forEach((p,i)=>mesh.setMatrixAt(i,matrix.makeTranslation(p.x*CELL,y,p.z*CELL)));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);};
 if(map.version!==2)tiles(wallCells,HEIGHT,HEIGHT/2,wall);tiles(floorCells,.12,-.06,floor);tiles(floorCells.filter(p=>!isOutdoor(map,p.x,p.z)),.12,HEIGHT+.06,ceiling);
 // Local sky illumination lights only authored outdoor floor surfaces.
 const sky=OUTDOOR_AMBIENT;
 const outdoorFloor=floor.clone();outdoorFloor.emissive=new THREE.Color(sky.sky);outdoorFloor.emissiveIntensity=.28;
 tiles(floorCells.filter(p=>isOutdoor(map,p.x,p.z)),.015,.008,outdoorFloor);
 $('mapDimensions').textContent=`${map.width} × ${map.height} · North up`;
 for(const d of map.doors){const {root,hinge}=explorationDoor(d.material==='wood'?wood:wall,wood,state.openDoors.has(doorKey(d)),map.version===2?{width:d.width*CELL,hinge:d.hinge}:{});root.position.set(d.x*CELL,0,d.z*CELL);root.rotation.y=d.axis==='x'?Math.PI/2:0;scene.add(root);doors.set(doorKey(d),hinge);}
 if(map.version===2)for(const edge of effectiveEdges(map)){
  if(edge.kind==='door')continue;
  const g=edgeGeometry(edge),root=new THREE.Group(),material=edge.material==='wood'?wood:wall;
  root.position.set(g.center.x*CELL,0,g.center.z*CELL);root.rotation.y=g.axis==='x'?Math.PI/2:0;scene.add(root);
  if(edge.kind==='wall'){box(CELL,HEIGHT,SCENE_STYLE.wallDepthMetres,material,0,HEIGHT/2,0,root);continue;}
  const width=edge.width*CELL,sill=SCENE_STYLE.window.sill,height=SCENE_STYLE.window.height,side=(CELL-width)/2;
  for(const sign of [-1,1])box(side,HEIGHT,.18,material,sign*(width/2+side/2),HEIGHT/2,0,root);
  box(width,sill,.18,material,0,sill/2,0,root);box(width,HEIGHT-sill-height,.18,material,0,(HEIGHT+sill+height)/2,0,root);
  const glass=new THREE.MeshLambertMaterial({color:0x8eafb0,transparent:true,opacity:.28});box(width,height,.025,glass,0,sill+height/2,0,root).castShadow=false;
  for(const x of [-width/2,0,width/2])box(.055,height,.08,wood,x,sill+height/2,0,root);
 }
 for(const exit of map.exits||[]){const ring=new THREE.Mesh(new THREE.RingGeometry(.45,.65,24),new THREE.MeshBasicMaterial({color:0xd6b265,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(exit.x*CELL,.015,exit.z*CELL);scene.add(ring);}
 const iron=new THREE.MeshLambertMaterial({color:0x3c3025});
 for(const t of map.torches||[]){
  const placement=torchPlacement(map,t),{x,z,plateX:wallX,plateZ:wallZ,dx,dz}=placement;
  if(placement.attached){
   box(dx?torchLight.plateDepth:torchLight.plateWidth,torchLight.plateHeight,dz?torchLight.plateDepth:torchLight.plateWidth,iron,wallX,1.9,wallZ);
   box(Math.abs(wallX-x)+.08,.09,Math.abs(wallZ-z)+.08,iron,(wallX+x)/2,1.75,(wallZ+z)/2);
  }else box(.12,1.75,.12,iron,x,.875,z);
  box(.13,torchLight.stemHeight,.13,iron,x,torchLight.stemBottom+torchLight.stemHeight/2,z);
  const cup=new THREE.Mesh(new THREE.CylinderGeometry(torchLight.cupRadius,.09,.16,8),iron);cup.position.set(x,2.17,z);cup.castShadow=true;scene.add(cup);
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.13,.42,6),new THREE.MeshBasicMaterial({color:0xffb940}));flame.position.set(x,placement.y,z);scene.add(flame);
  const core=new THREE.Mesh(new THREE.ConeGeometry(.065,.27,5),new THREE.MeshBasicMaterial({color:0xffec9b}));core.position.y=-.05;flame.add(core);
  const light=new THREE.PointLight(torchLight.color,torchLight.intensity,torchLight.range,torchLight.decay);light.position.copy(flame.position);light.castShadow=true;light.shadow.mapSize.set(torchLight.shadowPixels,torchLight.shadowPixels);light.shadow.bias=-.002;light.shadow.camera.near=torchLight.shadowNear;scene.add(light);flames.push({flame,light,placement});
 }
 $('areaName').textContent=map.name;$('mapTitle').textContent=map.name;$('landmark').textContent=map.name;for(const member of map.party||[]){const row=document.createElement('tr');for(const [index,value] of [member.name,member.ac,`${member.hp}/${member.maxHp}`].entries()){const td=document.createElement('td');td.textContent=String(value);if(index===0){const sub=document.createElement('small');sub.textContent=member.role;td.append(sub);}row.append(td);}$('party').append(row);}
 document.querySelectorAll('[data-action]').forEach(button=>{button.disabled=false;button.addEventListener('click',()=>{command(button.dataset.action);canvas.focus({preventScroll:true});});});
 $('restart').disabled=false;$('restart').addEventListener('click',()=>{encounterClient?.reset();state=createExplorationState(map);Object.assign(state,spawn);state.visited=new Set([cellKey(state.x,state.z)]);discovery=restoreDiscovery(map,null);if(encounterClient){map.party=encounterClient.roster();$('party').replaceChildren();for(const p of map.party){const row=document.createElement('tr');for(const v of [p.name,p.ac,`${p.hp}/${p.maxHp}`]){const td=document.createElement('td');td.textContent=v;row.append(td);}$('party').append(row);}}motion=null;renderer.shadowMap.needsUpdate=true;camera.position.set(state.x*CELL,EYE,state.z*CELL);camera.rotation.y=-state.facing*Math.PI/2;doors.forEach((hinge,key)=>hinge.rotation.y=state.openDoors.has(key)?hinge.userData.openAngle:0);$('messages').replaceChildren();status();message('Back at the entrance. Doors restored to their initial states.');});
 $('pixelView').addEventListener('change',resize);resizeObserver=new ResizeObserver(resize);resizeObserver.observe(viewport);resize();status();$('loading').hidden=true;if(returnMessage)message(returnMessage);message(context?'Editor test: step onto a gold floor ring to travel to its connected map.':'You enter the old tollhouse. Move with W A S D; turn with Q / E.');
 const keys={w:'forward',ArrowUp:'forward',s:'back',ArrowDown:'back',a:'strafeLeft',d:'strafeRight',q:'left',ArrowLeft:'left',e:'right',ArrowRight:'right',f:'door'};
 document.addEventListener('keydown',event=>{if(event.ctrlKey||event.metaKey||event.altKey||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;if(event.key==='Escape'){location.assign(context?$('returnLink').href:'index.html');return;}const action=keys[event.key.length===1?event.key.toLowerCase():event.key];if(action){event.preventDefault();if(action!=='door'||!event.repeat)command(action);}});
 function render(now){frame=requestAnimationFrame(render);if(document.hidden)return;if(motion?.old||[...doors.entries()].some(([key,hinge])=>Math.abs(hinge.rotation.y-(state.openDoors.has(key)?hinge.userData.openAngle:0))>.001))renderer.shadowMap.needsUpdate=true;if(motion?.old){const t=Math.min(1,(now-motion.start)/motion.duration),s=t*t*(3-2*t);camera.position.x=THREE.MathUtils.lerp(motion.old.x,motion.x,s);camera.position.z=THREE.MathUtils.lerp(motion.old.z,motion.z,s);camera.rotation.y=THREE.MathUtils.lerp(motion.old.yaw,motion.yaw,s);if(t===1)motion=null;}doors.forEach((hinge,key)=>{const target=state.openDoors.has(key)?hinge.userData.openAngle:0;hinge.rotation.y=THREE.MathUtils.lerp(hinge.rotation.y,target,reduced?1:.2);});flames.forEach(({flame,light,placement})=>{const a=torchAnimation(now,placement.seed,reduced);flame.scale.set(a.width,a.height,a.width);flame.position.set(placement.x+a.swayX,placement.y,placement.z+a.swayZ);flame.rotation.z=a.swayX*2;light.intensity=torchLight.intensity*a.intensity;});renderer.render(scene,camera);}frame=requestAnimationFrame(render);
}
start().catch(error=>{$('loading').textContent=`Exploration could not start: ${error.message} Reload to retry. WebGL is required.`;console.error(error);});
addEventListener('pagehide',()=>{cancelAnimationFrame(frame);resizeObserver?.disconnect();renderer?.dispose();});
