import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { retargetHumanoidClip } from '../js/mixamo-retarget.mjs';

const THREE = await import('data:text/javascript;base64,' +
  readFileSync(new URL('../assets/vendor/three/three.core.min.js',import.meta.url)).toString('base64'));

function rig(path) {
  const bytes=readFileSync(path);
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
  const parts=doc.nodes.map(node=>{
    const obj=node.name?.startsWith('mixamorig:') ? new THREE.Bone() : new THREE.Object3D();
    obj.name=node.name||'';
    obj.position.fromArray(node.translation||[0,0,0]);
    obj.quaternion.fromArray(node.rotation||[0,0,0,1]);
    obj.scale.fromArray(node.scale||[1,1,1]);
    if(node.matrix) new THREE.Matrix4().fromArray(node.matrix)
      .decompose(obj.position,obj.quaternion,obj.scale);
    return obj;
  });
  doc.nodes.forEach((node,i)=> (node.children||[]).forEach(c=>parts[i].add(parts[c])));
  const scene=new THREE.Group();
  for(const i of doc.scenes?.[doc.scene||0]?.nodes||[])scene.add(parts[i]);
  scene.updateWorldMatrix(true,true);
  const byName=new Map(parts.filter(p=>p.name).map(p=>[p.name,p]));
  return {scene,doc,byName};
}
const carl=rig('assets/models/dungeon-crawler-carl/new-carl/new-carl.glb');
const orc=rig('assets/models/orcs/new-orc/new-orc.glb');
const by=(r,name)=>r.byName.get('mixamorig:'+name);
const sourceLeft=by(carl,'LeftArm'),sourceRight=by(carl,'RightArm');
const targetLeft=by(orc,'LeftArm'),targetRight=by(orc,'RightArm');
const hipSource=by(carl,'Hips'),hipTarget=by(orc,'Hips');
assert.ok(sourceLeft && sourceRight && targetLeft && targetRight && hipSource && hipTarget);
const sourceLeftRest=sourceLeft.quaternion.clone(),sourceRightRest=sourceRight.quaternion.clone();
const targetLeftRest=targetLeft.quaternion.clone(),targetRightRest=targetRight.quaternion.clone();
const targetHipRest=hipTarget.position.clone();
const rightShoulderDiff=THREE.MathUtils.radToDeg(
  by(carl,'RightShoulder').getWorldQuaternion(new THREE.Quaternion())
    .angleTo(by(orc,'RightShoulder').getWorldQuaternion(new THREE.Quaternion())));
assert.ok(rightShoulderDiff>100,'Real Orc vs Carl shoulders have radically different rest frames');

const leftMoved=sourceLeftRest.clone().multiply(new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1,0,0),THREE.MathUtils.degToRad(35)));
const rightMoved=sourceRightRest.clone().multiply(new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0,0,1),THREE.MathUtils.degToRad(-30)));
const mk=(bone,rest,moved)=>new THREE.QuaternionKeyframeTrack(
  bone.name.replace(':','')+'.quaternion',[0,1],[...rest.toArray(),...moved.toArray()]);
const sourceY=hipSource.position.y,targetY=hipTarget.position.y;
const clip=new THREE.AnimationClip('Real-rig-reference-frame-regression',1,[
  mk(sourceLeft,sourceLeftRest,leftMoved),
  mk(sourceRight,sourceRightRest,rightMoved),
  new THREE.VectorKeyframeTrack('mixamorigHips.position',[0,1],
    [hipSource.position.x,sourceY,hipSource.position.z,
     hipSource.position.x+0.04,sourceY-0.15,hipSource.position.z+0.03])
]);
const retargeted=retargetHumanoidClip(THREE,clip,carl.scene,orc.scene,'Reference Aim',{
  mode:'anatomical-aim'
});
assert.equal(retargeted.userData.humanoidImport.retargetMode,
  'anatomical-child-direction-with-hip-y');
assert.ok(retargeted.userData.humanoidImport.aimedBoneRoles.includes('leftUpperArm'));
assert.ok(retargeted.userData.humanoidImport.aimedBoneRoles.includes('rightUpperArm'));
assert.ok(retargeted.userData.humanoidImport.aimedBoneRoles.length>=35);
assert.equal(retargeted.userData.humanoidImport.hipYTransferred,true);
assert.ok(targetLeft.quaternion.angleTo(targetLeftRest)<1e-7,'Retarget must not alter Orc bind pose');
assert.ok(targetRight.quaternion.angleTo(targetRightRest)<1e-7);
assert.ok(sourceLeft.quaternion.angleTo(sourceLeftRest)<1e-7,'Retarget must restore source rig');
assert.ok(sourceRight.quaternion.angleTo(sourceRightRest)<1e-7);
const track=retargeted.tracks.find(t=>t.name===hipTarget.uuid+'.position');
assert.ok(track,'Animated root vertical translation must be retained');
const hipExpected=targetY-0.15*Math.abs(targetY/sourceY);
assert.ok(Math.abs(track.values[4]-hipExpected)<1e-5,
  'Target keeps scaled source hip-Y delta');
assert.ok(Math.abs(track.values[3]-targetHipRest.x)<1e-7 &&
  Math.abs(track.values[5]-targetHipRest.z)<1e-7,
  'Local sprite attack drops XZ travel while preserving Y');

sourceLeft.quaternion.copy(leftMoved);
sourceRight.quaternion.copy(rightMoved);
carl.scene.updateWorldMatrix(true,true);
const desired={};
for(const [side,src] of [['left',sourceLeft],['right',sourceRight]]) {
  const child=by(carl,side==='left'?'LeftForeArm':'RightForeArm');
  desired[side]=child.position.clone()
    .applyQuaternion(src.getWorldQuaternion(new THREE.Quaternion())).normalize();
}
sourceLeft.quaternion.copy(sourceLeftRest);
sourceRight.quaternion.copy(sourceRightRest);
carl.scene.updateWorldMatrix(true,true);
const player=new THREE.AnimationMixer(orc.scene);
const action=player.clipAction(retargeted);
action.setLoop(THREE.LoopOnce,1);
action.clampWhenFinished=true;
action.play();
player.setTime(1);
orc.scene.updateWorldMatrix(true,true);
assert.ok(Math.abs(hipTarget.position.y-hipExpected)<1e-4,
  'AnimationMixer actually applies the baked hip position');
for(const [side,tgt] of [['left',targetLeft],['right',targetRight]]) {
  const child=by(orc,side==='left'?'LeftForeArm':'RightForeArm');
  const actual=child.position.clone()
    .applyQuaternion(tgt.getWorldQuaternion(new THREE.Quaternion())).normalize();
  assert.ok(actual.dot(desired[side])>0.98,
    'Anatomical '+side+' arm must follow animated source physical bone direction');
}
console.log('PASS Rev 112 actual Carl/Orc GLB bind mismatch, physical limb aiming, preserved mesh bind, Y hip transfer');
