import {createGiantCorpseSettler} from './giant-corpse-settle.mjs?v=pose-adjust11';
import * as T from '../assets/vendor/three/three.module.min.js';
import {cloneCombatRig,loadCombatModel} from './combat-model-source.mjs';
import {semanticBoneMap} from './humanoid-rig.mjs';
import {retargetHumanoidClip} from './mixamo-retarget.mjs';
import {prepareStudioAnimations} from './studio-animations.mjs';
import {loadWorkshopCombatUnit} from './combat-workshop-unit.mjs?v=spell-poses1';
import {createWorkshopRepositoryMob} from './workshop-repository-mob.mjs';
import {appearanceRecipeForMob} from './mob-appearance.mjs?v=R238C204';
import {directUnitFrame} from './combat-direct-units.mjs?v=outline-reuse2';
import {snapshot,applyPose,blendPose} from './ragdoll-lab-pose.mjs';
export {snapshot,applyPose,blendPose};
const nodes=root=>{const out=[];root.traverse(n=>out.push(n));return out;};
async function sampleClip(root,list,clip){
 const frames=[],mixer=new T.AnimationMixer(root),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();const count=Math.max(2,Math.ceil(clip.duration*24));
 for(let i=0;i<=count;i++){mixer.setTime(clip.duration*i/count);root.updateMatrixWorld(true);frames.push(snapshot(list));if(i%6===0)await new Promise(requestAnimationFrame);}
 mixer.stopAllAction();mixer.uncacheRoot(root);return {frames,duration:clip.duration};
}
export async function loadRagdollRig(progress,{unitId='orc-warrior',heightMetres=1.83,includeAssignedDeath=false,battleScale=false,settleCorpse=false}={}){
 const response=await fetch('data/mobs/'+unitId+'.workshop-unit.json');if(!response.ok)throw Error('Published '+unitId+' package unavailable');const pack=await response.json();
 const adapter=createWorkshopRepositoryMob(pack),entity=adapter.apply({id:'ragdoll-source',alive:true,x:0,y:0},()=>.5),captured=adapter.recipe(entity),recipe=appearanceRecipeForMob(entity,{...captured.model,poseProfile:captured.poseProfile,renderSettings:captured.renderSettings});
 const loaded=await loadWorkshopCombatUnit(recipe,{onProgress:p=>progress?.(p.step)}),image=loaded.images[Object.values(loaded.manifest.poses.ready.frames)[0]],asset=directUnitFrame(image).asset;
 // Combat calibrates from rest-body bounds, not a head/feet bone estimate.
 let restMin=Infinity,restMax=-Infinity;const restPoint=new T.Vector3();asset.group.updateMatrixWorld(true);
 if(battleScale)asset.group.traverse(mesh=>{if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;for(let n=mesh;n;n=n.parent)if(n.name==='StudioRightHandEquipment'||n.name==='StudioLeftHandShield'||n.name==='StudioBackEquipment')return;mesh.skeleton?.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,restPoint);restPoint.applyMatrix4(mesh.matrixWorld);restMin=Math.min(restMin,restPoint.y);restMax=Math.max(restMax,restPoint.y);}});
 if(battleScale){heightMetres=Number(pack.draft.height);if(!(heightMetres>0&&restMax>restMin))throw Error('Invalid battlemap body scale');}
 asset.workshopSample(entity,undefined,0);const sourceNodes=nodes(asset.group),ready=snapshot(sourceNodes);
 progress?.('Loading UAL1 Source Crawl Exit and Death02');
 const deathSourceAsset=await loadCombatModel(new URL('../assets/animations/ual1/ual1-death02-source.glb',import.meta.url).href),crawlSource=prepareStudioAnimations(deathSourceAsset.animations).find(clip=>clip.name==='Crawl_Exit'),deathSource=prepareStudioAnimations(deathSourceAsset.animations).find(clip=>clip.name==='Death02');
 if(!crawlSource)throw Error('UAL1 Source is missing Crawl_Exit.');
 if(!deathSource)throw Error('UAL1 Source is missing Death02.');
 const crawlExit=retargetHumanoidClip(T,crawlSource,deathSourceAsset.scene,asset.group,'Crawl_Exit',{mode:'world-bind-delta',hipTranslation:'scaled-world-y'}),death=retargetHumanoidClip(T,deathSource,deathSourceAsset.scene,asset.group,'Death02',{mode:'world-bind-delta',hipTranslation:'scaled-world-y'}),riseSample=await sampleClip(asset.group,sourceNodes,crawlExit);
 applyPose(sourceNodes,ready);asset.group.updateMatrixWorld(true);const deathSample=await sampleClip(asset.group,sourceNodes,death);
 let assignedDeath=null;
 if(includeAssignedDeath){
  progress?.('Sampling Workshop-assigned death');
  const dying={...entity,alive:false,deathPresentationStartedAt:0};
  asset.workshopSample(dying,undefined,0);
  const duration=dying.deathAnimationDurationMs/1000;if(!(duration>0))throw Error('Assigned death has no duration');
  const frames=[],count=Math.ceil(duration*24);
  for(let i=0;i<=count;i++){asset.workshopSample(dying,undefined,duration*i/count*1000);asset.group.updateMatrixWorld(true);frames.push(snapshot(sourceNodes));if(i%6===0)await new Promise(requestAnimationFrame);}
  const assignment=pack.draft.assignments.death[0],clip=pack.draft.clips.find(c=>c.id===assignment.clipId);
  assignedDeath={frames,duration,name:clip?.name||'Workshop-assigned death',clipId:assignment.clipId};
 }
 applyPose(sourceNodes,ready);asset.group.updateMatrixWorld(true);
 const roles=semanticBoneMap(asset.group),p=new T.Vector3(),head=roles.get('head').getWorldPosition(p.clone()),feet=Math.min(roles.get('leftFoot').getWorldPosition(p.clone()).y,roles.get('rightFoot').getWorldPosition(p.clone()).y),scale=heightMetres/(battleScale?restMax-restMin:head.y-feet+.14*(head.y-feet));
 return {asset,ready,assignedDeath,heightMetres,legacyScaleRatio:battleScale?(head.y-feet+.14*(head.y-feet))/(restMax-restMin):1,restBodyHeightMetres:battleScale?(restMax-restMin)*scale:null,rise:riseSample.frames,riseDuration:riseSample.duration,death:deathSample.frames,deathDuration:deathSample.duration,scale,create(id,x,z){
  const root=new T.Group(),model=cloneCombatRig(asset.group);root.add(model);root.scale.setScalar(scale);root.position.set(x,-feet*scale+.065,z);const list=nodes(model),map=semanticBoneMap(model);
  applyPose(list,ready);root.updateMatrixWorld(true);
  return {id,root,model,settleCorpse:settleCorpse?createGiantCorpseSettler(T,model):null,nodes:list,roles:map,ready,rise:riseSample.frames,riseDuration:riseSample.duration,death:deathSample.frames,deathDuration:deathSample.duration,state:'ready',time:0,start:new T.Vector3(),landed:null,settleSeconds:0,recoverySeconds:0};
 }};
}
export function rigidFrames(unit){
 const specs=[['hips','spine',null,.15,18],['spine','neck','hips',.16,24],['head',null,'spine',.12,5],
 ['leftUpperArm','leftForeArm','spine',.065,3],['leftForeArm','leftHand','leftUpperArm',.055,2,true],['rightUpperArm','rightForeArm','spine',.065,3],['rightForeArm','rightHand','rightUpperArm',.055,2,true],
 ['leftUpperLeg','leftLowerLeg','hips',.09,8],['leftLowerLeg','leftFoot','leftUpperLeg',.07,5,true],['leftFoot','leftToe','leftLowerLeg',.065,1.5,true],['rightUpperLeg','rightLowerLeg','hips',.09,8],['rightLowerLeg','rightFoot','rightUpperLeg',.07,5,true],['rightFoot','rightToe','rightLowerLeg',.065,1.5,true]];
 unit.root.updateMatrixWorld(true);
 return specs.map(([name,tip,parent,radius,mass,hinge])=>{const bone=unit.roles.get(name);if(!bone)throw Error('Rig missing '+name);const position=bone.getWorldPosition(new T.Vector3()),rotation=bone.getWorldQuaternion(new T.Quaternion()),end=tip?unit.roles.get(tip)?.getWorldPosition(new T.Vector3()):position.clone().add(new T.Vector3(0,.17,0));if(!end)throw Error('Rig missing '+tip);return {name,parent,radius,mass,hinge,position,rotation,end};});
}
const p=new T.Vector3(),q=new T.Quaternion(),parentQ=new T.Quaternion();
export function applyPhysicsPose(unit,actor,alpha=1){
 // Parent bones first; intermediate spine/shoulder/finger bones retain their
 // authored local pose and inherit the simulated major segments.
 for(const part of actor.parts){const bone=unit.roles.get(part.name);bone.parent.updateWorldMatrix(true,false);p.lerpVectors(part.prevPosition,part.position,alpha);q.slerpQuaternions(part.prevRotation,part.rotation,alpha);bone.position.copy(bone.parent.worldToLocal(p));bone.quaternion.copy(bone.parent.getWorldQuaternion(parentQ).invert().multiply(q));bone.updateMatrixWorld(true);}
}
export function recoveryPose(unit,pose,offset){applyPose(unit.nodes,pose);unit.root.updateMatrixWorld(true);const hips=unit.roles.get('hips'),world=hips.getWorldPosition(new T.Vector3()).add(offset);hips.position.copy(hips.parent.worldToLocal(world));unit.root.updateMatrixWorld(true);return snapshot(unit.nodes);}
export function beginRecovery(unit){
 const current=snapshot(unit.nodes),hips=unit.roles.get('hips').getWorldPosition(new T.Vector3());
 applyPose(unit.nodes,unit.rise[0]);unit.root.updateMatrixWorld(true);const canonical=unit.roles.get('hips').getWorldPosition(new T.Vector3());
 const offset=new T.Vector3(hips.x-canonical.x,0,hips.z-canonical.z);
 const rise=unit.rise.map(pose=>recoveryPose(unit,pose,offset)),idle=recoveryPose(unit,unit.ready,offset);
 unit.recovery={from:current,rise,idle,duration:unit.riseDuration};applyPose(unit.nodes,current);unit.root.updateMatrixWorld(true);unit.state='recovering';unit.time=0;
}
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function samplePose(nodes,frames,t){const at=Math.max(0,Math.min(1,t))*(frames.length-1),lo=Math.floor(at),hi=Math.min(frames.length-1,lo+1);blendPose(nodes,frames[lo],frames[hi],at-lo);}
export function beginDeath(unit,launch,heading){
 unit.time=0;unit.state='falling';unit.deathFlight={start:unit.root.position.clone(),heading:new T.Vector3(heading.x,0,heading.z),distance:launch.outward*(.30+Math.min(.85,unit.deathDuration*.62)*.45),height:Math.max(.035,launch.upward*.105),duration:Math.min(.85,unit.deathDuration*.62)};
}
// Measure the current skinned body, not cached bind-pose bounds or held gear.
const groundBounds=new T.Box3(),groundPoint=new T.Vector3();
function groundBody(unit){
 unit.root.updateMatrixWorld(true);groundBounds.makeEmpty();let support=Infinity;
 const supportBones=new Set((unit.corpseRestMode==='face'?['head']:['hips','spine','chest','upperChest']).map(k=>unit.roles.get(k)).filter(Boolean));
 unit.model.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;
  for(let parent=mesh;parent;parent=parent.parent)if(parent.name==='StudioRightHandEquipment'||parent.name==='StudioLeftHandShield')return;
  mesh.skeleton?.update();
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,groundPoint);groundPoint.applyMatrix4(mesh.matrixWorld);groundBounds.expandByPoint(groundPoint);
   if(unit.corpseRestMode&&mesh.isSkinnedMesh){const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;let influence=0;if(indices&&weights)for(let j=0;j<4;j++)if(supportBones.has(mesh.skeleton.bones[indices.getComponent(i,j)]))influence+=weights.getComponent(i,j);if(influence>.5)support=Math.min(support,groundPoint.y);}
  }
 });
 if(!groundBounds.isEmpty()){
  const blend=unit.corpseRestMode?ease((unit.time/unit.deathDuration-.65)/.35):0;
  const floor=Number.isFinite(support)?groundBounds.min.y+(support-groundBounds.min.y)*blend:groundBounds.min.y;
  const shift=.004-floor;unit.root.position.y+=shift;
  unit.contactDiagnostics={mode:unit.corpseRestMode||'body',supportHeight:Number.isFinite(support)?support+shift:null,bodyMin:groundBounds.min.y+shift,blend};
 }
 unit.root.updateMatrixWorld(true);
}
export function advanceDeath(unit,dt){
 unit.time+=dt;const t=Math.min(1,unit.time/unit.deathDuration),flight=unit.deathFlight,flightT=Math.min(1,unit.time/flight.duration),travel=ease(flightT);
 samplePose(unit.nodes,unit.death,t);unit.settleCorpse?.(ease((t-.65)/.35),unit.corpseRestMode);unit.root.position.copy(flight.start).addScaledVector(flight.heading,flight.distance*travel);if(unit.landingOffset)unit.root.position.addScaledVector(unit.landingOffset,ease(t));unit.root.position.y+=4*flightT*(1-flightT)*flight.height;unit.root.updateMatrixWorld(true);
 if(flightT>=1)groundBody(unit);
 if(t<1)return false;
 unit.landed=unit.root.getWorldPosition(new T.Vector3());unit.settleSeconds=unit.time;unit.settleReason='Death02 complete';unit.state=unit.alive?'resting':'fallen';unit.time=0;unit.deathFlight=null;return true;
}
export function advanceRecovery(unit,dt){
 unit.time+=dt;const t=unit.time,r=unit.recovery;
 if(t<.5)blendPose(unit.nodes,r.from,r.rise[0],ease(t/.5));
 else if(t<.5+r.duration){const at=(t-.5)/r.duration*(r.rise.length-1),lo=Math.floor(at),hi=Math.min(r.rise.length-1,lo+1);blendPose(unit.nodes,r.rise[lo],r.rise[hi],at-lo);}
 else blendPose(unit.nodes,r.rise.at(-1),r.idle,ease((t-.5-r.duration)/.35));
 unit.root.updateMatrixWorld(true);
 groundBody(unit);
 if(t>=.85+r.duration){unit.state='ready';unit.recoverySeconds=t;unit.recovery=null;}
}
