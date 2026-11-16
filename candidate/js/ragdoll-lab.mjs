import * as T from '../assets/vendor/three/three.module.min.js';
import {createRagdollPhysics,RAGDOLL_STEP} from './ragdoll-lab-physics.mjs?v=R238C392L';
import {loadRagdollRig,rigidFrames,applyPhysicsPose,beginRecovery,advanceRecovery} from './ragdoll-lab-rig.mjs?v=tree-snow-grains1';
import {captureDirectUnit} from './combat-direct-units.mjs?v=tree-snow-grains1';
import {createCombatFrameScheduler} from './combat-frame-scheduler.mjs?v=R238C395';
const $=id=>document.getElementById(id),canvas=$('view'),host=$('viewport');
let physics,rig,units=[],lostEquipment=[],paused=false,accumulator=0,lastTime=null,elapsed=0,blastTime=-100,ready=false,benchmark=null,poseMs=0,bakeMs=0,frames=0;
const scene=new T.Scene();scene.background=new T.Color(0x24323c);scene.fog=new T.Fog(0x24323c,24,60);
const camera=new T.OrthographicCamera(-8,8,6,-6,.1,100),renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{throw Error(gl.getShaderInfoLog(vertex)+'\n'+gl.getShaderInfoLog(fragment));};
scene.add(new T.HemisphereLight(0xdce8ff,0x6c6553,1.4));const sun=new T.DirectionalLight(0xffebcb,2);sun.position.set(-5,9,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:.1,far:40});sun.shadow.bias=-.0003;scene.add(sun);
const floor=new T.Mesh(new T.PlaneGeometry(60,60),new T.MeshStandardMaterial({color:0x52615c,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const grid=new T.GridHelper(40,40,0x83918a,0x66766b);grid.position.y=.004;grid.material.transparent=true;grid.material.opacity=.4;scene.add(grid);
const wall=new T.Mesh(new T.BoxGeometry(10,2,.36),new T.MeshStandardMaterial({color:0x737e87,roughness:1}));wall.position.set(0,1,3.6);wall.castShadow=wall.receiveShadow=true;wall.visible=false;scene.add(wall);
const marker=new T.Mesh(new T.RingGeometry(.32,.38,48),new T.MeshBasicMaterial({color:0xf4c680,side:T.DoubleSide}));marker.rotation.x=-Math.PI/2;marker.position.set(0,.015,-2.8);scene.add(marker);
const pulse=new T.Mesh(new T.RingGeometry(.85,1,48),new T.MeshBasicMaterial({color:0xffb35f,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}));pulse.rotation.x=-Math.PI/2;pulse.position.copy(marker.position);pulse.position.y=.025;scene.add(pulse);
const debugGeometry=new T.BufferGeometry(),debugMesh=new T.LineSegments(debugGeometry,new T.LineBasicMaterial({vertexColors:true,depthTest:false,transparent:true,opacity:.7}));debugMesh.renderOrder=10;debugMesh.frustumCulled=false;scene.add(debugMesh);
let azimuth=.6,elevation=.68,zoom=4.5,pointer=null;
function setCamera(){const ratio=host.clientWidth/host.clientHeight;camera.left=-zoom*ratio;camera.right=zoom*ratio;camera.top=zoom;camera.bottom=-zoom;camera.position.set(Math.sin(azimuth)*18*Math.cos(elevation),marker.position.z+Math.cos(azimuth)*18*Math.cos(elevation));camera.lookAt(marker.position.x,.6,marker.position.z+.15);camera.updateProjectionMatrix();}
function resize(){renderer.setSize(host.clientWidth,host.clientHeight,false);setCamera();scheduler.request();}
const fitPoint=new T.Vector3();
function keepUnitsInView(){
 if(!$('autoFrame').checked)return;
 camera.updateMatrixWorld();let required=zoom;const ratio=host.clientWidth/host.clientHeight;
 for(const u of units)for(const bone of u.roles.values()){
  bone.getWorldPosition(fitPoint).applyMatrix4(camera.matrixWorldInverse);
  required=Math.max(required,Math.abs(fitPoint.y)+.8,(Math.abs(fitPoint.x)+.8)/ratio);
 }
 for(const item of lostEquipment){item.holder.getWorldPosition(fitPoint).applyMatrix4(camera.matrixWorldInverse);required=Math.max(required,Math.abs(fitPoint.y)+.5,(Math.abs(fitPoint.x)+.5)/ratio);}
 if(required>zoom){zoom=required;setCamera();}
}
const scheduler=createCombatFrameScheduler({render:frame,onError:fail});
function schedule(){scheduler.request();}
function fail(error){$('error').textContent='Ragdoll lab: '+error.message;$('phase').textContent='Test stopped';document.body.dataset.ready='error';console.error(error);paused=true;}
function disposeBaked(unit){if(!unit.baked)return;scene.remove(unit.baked);unit.baked.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat())m?.dispose();});unit.baked=null;}
function clearLostEquipment(){for(const item of lostEquipment){physics?.removeDebris(item.id);scene.remove(item.holder);}lostEquipment=[];}
function clearUnits(){clearLostEquipment();for(const u of units){physics.remove(u.id);scene.remove(u.root);disposeBaked(u);const skeletons=new Set();u.root.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton);});for(const skeleton of skeletons)skeleton.dispose();}units=[];}
function radialSpawn(index,count){const radius=count===1?2.15:count===4?2.4:2.8,angle=Math.PI/2+index*Math.PI*2/count,heading={x:Math.cos(angle),z:Math.sin(angle)};return {x:marker.position.x+heading.x*radius,z:marker.position.z+heading.z*radius,heading};}
function face(unit,heading){
 // The published combat model is authored +Z-forward. Keep this root turn
 // through physics and recovery so the standing Orc faces its blast travel.
 unit.root.rotation.y=Math.atan2(heading.x,heading.z);unit.root.updateMatrixWorld(true);
}
function faceOutward(unit,heading){
 face(unit,heading);unit.blastHeading={x:heading.x,z:heading.z};
}
function thinnestAxis(size){return size.x<=size.y&&size.x<=size.z?new T.Vector3(1,0,0):size.y<=size.z?new T.Vector3(0,1,0):new T.Vector3(0,0,1);}
function layEquipmentFlat(item){
 const normal=item.flatAxis.clone().applyQuaternion(item.holder.quaternion);if(normal.y<0)normal.multiplyScalar(-1);
 item.holder.quaternion.premultiply(new T.Quaternion().setFromUnitVectors(normal,new T.Vector3(0,1,0))).normalize();item.holder.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(item.holder);item.holder.position.y+=.004-bounds.min.y;item.holder.updateMatrixWorld(true);item.flat=true;
}
function dropEquipment(unit){
 if(unit.equipmentDropped||!unit.physics)return;const sockets=[];unit.model.traverse(node=>{if((node.name==='StudioRightHandEquipment'||node.name==='StudioLeftHandShield')&&node.parent)sockets.push(node);});
 const hip=unit.physics.byName.get('hips'),base=hip?.v||{x:0,y:0,z:0},heading=unit.blastHeading||{x:0,z:1},side={x:heading.z,z:-heading.x};
 sockets.forEach((socket,index)=>{const shield=socket.name==='StudioLeftHandShield',before=new T.Box3().setFromObject(socket),center=before.getCenter(new T.Vector3()),holder=new T.Group(),id='gear-'+unit.id+'-'+index;socket.traverse(node=>node.userData.ragdollDetached=true);holder.name=shield?'DroppedShield':'DroppedWeapon';holder.position.copy(center);scene.add(holder);holder.updateMatrixWorld(true);holder.attach(socket);holder.updateMatrixWorld(true);const size=new T.Box3().setFromObject(holder).getSize(new T.Vector3()),item={id,holder,kind:shield?'shield':'weapon',flatAxis:thinnestAxis(size),flat:false},outward=shield?2.4:3.6,lateral=shield?-1.1:1.1;physics.addDebris(id,holder,{halfExtents:{x:size.x*.5,y:size.y*.5,z:size.z*.5},velocity:{x:base.x+heading.x*outward+side.x*lateral,y:base.y+(shield?1.2:1.6),z:base.z+heading.z*outward+side.z*lateral},angularVelocity:{x:shield?3:8,y:0,z:shield?-5:6},mass:shield?3.2:1.4,onSettle:()=>layEquipmentFlat(item)});lostEquipment.push(item);});
 unit.equipmentDropped=true;
}
function reset(count=+$('count').value){
 clearUnits();paused=false;accumulator=0;lastTime=null;elapsed=0;blastTime=-100;bakeMs=0;physics.resetStats();
 for(let i=0;i<count;i++){const spawn=radialSpawn(i,count),u=rig.create(i,spawn.x,spawn.z),angle=Math.random()*Math.PI*2;face(u,{x:Math.sin(angle),z:Math.cos(angle)});u.root.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});scene.add(u.root);units.push(u);}
 $('count').value=String(count);$('pause').textContent='Pause';$('error').textContent='';zoom=count===1?4.5:6;setCamera();ready=true;schedule();
}
function settle(unit,actor){
 applyPhysicsPose(unit,actor);unit.physics=null;unit.state=unit.alive?'resting':'fallen';unit.time=0;unit.settleSeconds=actor.age;unit.settleReason=actor.reason;unit.landed=unit.roles.get('hips').getWorldPosition(new T.Vector3());
 if(!unit.alive){const start=performance.now(),baked=captureDirectUnit(unit.root,camera,{shareTextures:true});bakeMs=Math.max(bakeMs,performance.now()-start);unit.baked=baked.group;unit.baked.position.copy(unit.root.position);unit.baked.quaternion.copy(unit.root.quaternion);unit.baked.scale.copy(unit.root.scale);unit.baked.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});scene.add(unit.baked);unit.root.visible=false;}
}
const vary=(value,amount)=>value*(1+(Math.random()*2-1)*amount);
function explode(){
 if(!ready)return;paused=false;$('pause').textContent='Pause';physics.resetStats();bakeMs=0;elapsed=0;blastTime=0;lastTime=null;accumulator=0;
 const variation=+$('variation').value/100;
 for(const u of units){if(u.state==='fallen')continue;u.alive=$('survive').checked;u.autoRecover=$('autoRecover').checked;const dir=u.root.position.clone().sub(marker.position);dir.y=0;dir.normalize();faceOutward(u,dir);const right={x:dir.z,z:-dir.x},lean={x:right.x*+$('lean').value,z:right.z*+$('lean').value},launch={outward:vary(+$('strength').value,variation),upward:vary(+$('lift').value,variation),tumble:vary(+$('spin').value,variation)};u.launch=launch;u.launchLean=lean;const positions=rigidFrames(u),origin=positions[0].position;u.start.copy(origin);u.landed=null;u.settleSeconds=0;u.recoverySeconds=0;u.state='airborne';u.time=0;u.recovery=null;u.equipmentDropped=false;u.physics=physics.add(u.id,positions,{velocity:{x:dir.x*launch.outward,y:launch.upward,z:dir.z*launch.outward},spin:launch.tumble,lean,collideUnits:$('collideUnits').checked,onSettle:actor=>settle(u,actor)});}
 schedule();
}
function simulate(dt){
 elapsed+=dt;accumulator=Math.min(accumulator+dt,5*RAGDOLL_STEP);let steps=0;
 while(accumulator>=RAGDOLL_STEP&&steps<5){physics.step();accumulator-=RAGDOLL_STEP;steps++;}
 const started=performance.now();
 for(const u of units){
  if(u.physics){if(!u.equipmentDropped&&u.physics.age>=.12)dropEquipment(u);applyPhysicsPose(u,u.physics,accumulator/RAGDOLL_STEP);u.state=u.physics.grounded?'settling':'airborne';}
  else if(u.state==='resting'){u.time+=dt;if(u.alive&&u.autoRecover&&u.time>.65)beginRecovery(u);}
  else if(u.state==='recovering')advanceRecovery(u,dt);
 }
 poseMs=performance.now()-started;
}
function updateUI(){
 const active=physics.active.size,equipmentActive=physics.debris.size,bodyCount=active*13+equipmentActive,stats=physics.stats,rest=units.filter(u=>u.state==='resting'||u.state==='fallen').length,recovering=units.filter(u=>u.state==='recovering').length;
 $('bodies').textContent=bodyCount;$('bodyBudget').textContent=units.length*15;$('stepCost').textContent=active||equipmentActive?stats.lastMs.toFixed(2):'0.00';$('peakCost').textContent=stats.peakMs.toFixed(2);$('steps').textContent=stats.steps;$('stepHint').textContent=active||equipmentActive?' active':' stopped';
 $('poseCost').textContent=poseMs.toFixed(2);$('bakeCost').textContent=bakeMs.toFixed(2);
 $('phase').textContent=paused?'Paused':active?'Physics active':recovering?'Standing up · physics stopped':rest?'At rest · physics stopped':'Ready · physics stopped';
 $('status').textContent=active?`${active} moving · ${equipmentActive} loose gear · ${rest} frozen · ${recovering} recovering`:equipmentActive?`${equipmentActive} dropped items moving · body physics released`:recovering?`${recovering} recovery blends · no solver steps`:rest?`${rest} frozen bodies · simulation released`:'Trigger an explosion to start';
 $('unitRows').innerHTML=units.map(u=>{const current=u.landed||u.roles.get('hips').getWorldPosition(new T.Vector3()),distance=u.settleSeconds||u.physics?Math.hypot(current.x-u.start.x,current.z-u.start.z):0;return `<tr><td>Orc ${u.id+1}</td><td>${u.state==='fallen'?'Frozen corpse':u.state==='resting'?'Resting survivor':u.state[0].toUpperCase()+u.state.slice(1)}</td><td>${distance.toFixed(1)} m</td><td>${u.settleSeconds?u.settleSeconds.toFixed(2)+' s':'—'}</td></tr>`;}).join('');
 $('recover').disabled=!units.some(u=>u.state==='resting'&&u.alive);$('blast').disabled=!ready||!!benchmark||units.every(u=>u.state==='fallen');$('step').disabled=!paused;$('benchmark').disabled=!ready||!!benchmark;
 $('quickBlast').disabled=$('blast').disabled;$('quickPause').textContent=paused?'Resume':'Pause';
 const diagnostics={ready:true,paused,count:units.length,active,equipmentActive,droppedEquipment:lostEquipment.map(item=>item.kind),flatEquipment:lostEquipment.filter(item=>item.flat).map(item=>item.kind),bodyCount,steps:stats.steps,meanStepMs:stats.steps?stats.totalMs/stats.steps:0,peakStepMs:stats.peakMs,poseMs,bakePeakMs:bakeMs,frames,states:units.map(u=>u.state),settleReasons:units.map(u=>u.settleReason||null),blastHeadings:units.map(u=>u.blastHeading||null),blastLeans:units.map(u=>u.launchLean||null),launchVariation:+$('variation').value,launches:units.map(u=>u.launch||null),benchmark:benchmark?.index??null};document.body.dataset.ragdoll=JSON.stringify(diagnostics);document.body.dataset.ready='true';
}
function checkBenchmark(){if(!benchmark||physics.active.size||physics.debris.size||units.some(u=>['resting','recovering','airborne','settling'].includes(u.state)))return;const s=physics.stats;benchmark.rows.push({count:units.length,mean:s.totalMs/Math.max(1,s.steps),peak:s.peakMs,settle:Math.max(...units.map(u=>u.settleSeconds)),steps:s.steps,bake:bakeMs});
 $('benchResults').innerHTML='<h2 style="margin-top:20px">Measured on this device</h2><table><thead><tr><th>Units</th><th>Mean / peak physics</th><th>Last rest</th><th>Solver stopped</th></tr></thead><tbody>'+benchmark.rows.map(r=>`<tr><td>${r.count}</td><td>${r.mean.toFixed(2)} / ${r.peak.toFixed(2)} ms</td><td>${r.settle.toFixed(2)} s</td><td>Yes · ${r.steps} steps</td></tr>`).join('')+'</tbody></table>';
 benchmark.index++;if(benchmark.index<3){reset([1,4,8][benchmark.index]);explode();}else{document.body.dataset.benchmark=JSON.stringify(benchmark.rows);benchmark=null;$('benchmark').disabled=false;}
}
function frame(now){
 const dt=lastTime===null?0:Math.min(.1,(now-lastTime)/1000);lastTime=now;if(!ready){renderer.render(scene,camera);return;}
 if(!paused)simulate(dt);const pulseAge=elapsed-blastTime;pulse.visible=pulseAge>=0&&pulseAge<.75;pulse.scale.setScalar(.4+pulseAge*8);pulse.material.opacity=Math.max(0,(1-pulseAge/.75)*.55);
 debugMesh.visible=$('debug').checked&&physics.active.size>0;if(debugMesh.visible){const data=physics.world.debugRender();debugGeometry.setAttribute('position',new T.BufferAttribute(data.vertices,3));debugGeometry.setAttribute('color',new T.BufferAttribute(data.colors,4));}
 keepUnitsInView();renderer.render(scene,camera);frames++;checkBenchmark();updateUI();
 if(!paused&&(physics.active.size||physics.debris.size||units.some(u=>u.state==='recovering'||(u.state==='resting'&&u.autoRecover))||pulse.visible))schedule();
}
$('blast').onclick=()=>{try{explode();}catch(error){fail(error);}};$('reset').onclick=()=>{benchmark=null;reset();};$('count').onchange=()=>{benchmark=null;reset();};
for(const [quick,full] of [['quickBlast','blast'],['quickPause','pause'],['quickReset','reset']])$(quick).onclick=()=>$(full).click();
$('autoFrame').onchange=schedule;
$('pause').onclick=()=>{paused=!paused;lastTime=null;$('pause').textContent=paused?'Resume':'Pause';schedule();};$('step').onclick=()=>{simulate(RAGDOLL_STEP);schedule();};
$('recover').onclick=()=>{for(const u of units)if(u.alive&&u.state==='resting')beginRecovery(u);paused=false;lastTime=null;$('pause').textContent='Pause';schedule();};
$('benchmark').onclick=()=>{benchmark={index:0,rows:[]};delete document.body.dataset.benchmark;$('survive').checked=$('autoRecover').checked=true;$('benchResults').textContent='Measuring one, four and eight surviving Orcs through recovery…';reset(1);explode();};
$('obstacle').onchange=()=>{wall.visible=$('obstacle').value==='wall';physics.setWall(wall.visible);schedule();};$('debug').onchange=schedule;
for(const key of ['strength','lift','spin','lean'])$(key).oninput=()=>{$(key+'Out').value=(+$(key).value).toFixed(1)+(key==='lean'?' rad/s':key==='spin'?'':' m/s');};$('variation').oninput=()=>{$('variationOut').value=$('variation').value+'%';};
canvas.addEventListener('pointerdown',e=>{pointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!pointer)return;azimuth-=(e.clientX-pointer.x)*.008;elevation=T.MathUtils.clamp(elevation+(e.clientY-pointer.y)*.005,.15,1.35);pointer={x:e.clientX,y:e.clientY};setCamera();schedule();});canvas.addEventListener('pointerup',()=>{pointer=null;});canvas.addEventListener('pointercancel',()=>{pointer=null;});canvas.addEventListener('wheel',e=>{e.preventDefault();$('autoFrame').checked=false;zoom=T.MathUtils.clamp(zoom*Math.exp(e.deltaY*.001),3,32);setCamera();schedule();},{passive:false});
new ResizeObserver(resize).observe(host);document.addEventListener('visibilitychange',()=>{lastTime=null;accumulator=0;if(!document.hidden){scheduler.wake();schedule();}});
window.addEventListener('pagehide',()=>{scheduler.dispose();clearUnits();physics?.dispose();renderer.dispose();});
resize();
try{[physics,rig]=await Promise.all([createRagdollPhysics(),loadRagdollRig(text=>{$('status').textContent=text;})]);reset();for(const id of ['blast','pause','reset','benchmark','quickBlast','quickPause','quickReset'])$(id).disabled=false;}catch(error){fail(error);}
