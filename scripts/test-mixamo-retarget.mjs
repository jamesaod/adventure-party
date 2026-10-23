import assert from 'node:assert/strict';
import fs from 'node:fs';
import { retargetMixamoClip } from '../js/mixamo-retarget.mjs';

const source = fs.readFileSync(new URL('../assets/vendor/three/three.core.min.js', import.meta.url));
const THREE = await import(`data:text/javascript;base64,${source.toString('base64')}`);

const axis = new THREE.Vector3(0, 0, 1);
const sourceRig = new THREE.Group();
const sourceBone = new THREE.Bone();
sourceBone.name = 'mixamorig:LeftArm';
sourceBone.quaternion.setFromAxisAngle(axis, THREE.MathUtils.degToRad(25));
sourceRig.add(sourceBone);

const targetRig = new THREE.Group();
const targetBone = new THREE.Bone();
targetBone.name = 'mixamorig:LeftArm';
targetBone.quaternion.setFromAxisAngle(axis, THREE.MathUtils.degToRad(-40));
targetRig.add(targetBone);

const sourceBind = sourceBone.quaternion.clone();
const targetBind = targetBone.quaternion.clone();
const sourceMotion = sourceBind.clone().multiply(
  new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(30))
).normalize();

const noMotion = new THREE.AnimationClip('No motion', 1, [
  new THREE.QuaternionKeyframeTrack('mixamorigLeftArm.quaternion', [0,1], [
    sourceBind.x,sourceBind.y,sourceBind.z,sourceBind.w,
    sourceBind.x,sourceBind.y,sourceBind.z,sourceBind.w
  ])
]);
const moved = new THREE.AnimationClip('Moved', 1, [
  new THREE.QuaternionKeyframeTrack('mixamorigLeftArm.quaternion', [0,1], [
    sourceMotion.x,sourceMotion.y,sourceMotion.z,sourceMotion.w,
    sourceMotion.x,sourceMotion.y,sourceMotion.z,sourceMotion.w
  ])
]);

const retargetedRest=retargetMixamoClip(THREE,noMotion,sourceRig,targetRig,'Rest');
const restQ=new THREE.Quaternion(...Array.from(retargetedRest.tracks[0].values.slice(0,4)));
assert.ok(restQ.angleTo(targetBind)<5e-4,`Source bind pose maps to target bind pose; error=${restQ.angleTo(targetBind)}`);

const retargetedMove=retargetMixamoClip(THREE,moved,sourceRig,targetRig,'Move');
const movedQ=new THREE.Quaternion(...Array.from(retargetedMove.tracks[0].values.slice(0,4)));
const expected=targetBind.clone().multiply(
  new THREE.Quaternion().setFromAxisAngle(axis,THREE.MathUtils.degToRad(30))
).normalize();
assert.ok(movedQ.angleTo(expected)<5e-4,`Source bind-relative motion maps to target bind pose; error=${movedQ.angleTo(expected)}`);
assert.ok(movedQ.angleTo(sourceMotion)>THREE.MathUtils.degToRad(20),
  'Retargeted result is not a raw source quaternion copy');

const withTranslation=new THREE.AnimationClip('Mixed',1,[
  moved.tracks[0],
  new THREE.VectorKeyframeTrack('mixamorigHips.position',[0,1],[0,0,0,1,2,3])
]);
const mixed=retargetMixamoClip(THREE,withTranslation,sourceRig,targetRig,'Mixed');
assert.equal(mixed.tracks.length,1,'Rev 87 continues to ignore translation and scale during audition');

console.log('PASS Mixamo bind-space quaternion retargeting');
