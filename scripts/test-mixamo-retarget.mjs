import assert from 'node:assert/strict';
import fs from 'node:fs';
import { retargetMixamoClip } from '../js/mixamo-retarget.mjs';

const source = fs.readFileSync(new URL('../assets/vendor/three/three.core.min.js', import.meta.url));
const THREE = await import(`data:text/javascript;base64,${source.toString('base64')}`);
const q=(axis,degrees)=>new THREE.Quaternion().setFromAxisAngle(axis,THREE.MathUtils.degToRad(degrees));
const z=new THREE.Vector3(0,0,1), x=new THREE.Vector3(1,0,0), y=new THREE.Vector3(0,1,0);

const sourceRig=new THREE.Group();
const sourceParent=new THREE.Bone(); sourceParent.name='mixamorig:Spine'; sourceParent.quaternion.copy(q(y,25));
const sourceChild=new THREE.Bone(); sourceChild.name='mixamorig:LeftArm'; sourceChild.quaternion.copy(q(z,15));
sourceParent.add(sourceChild); sourceRig.add(sourceParent);
sourceRig.updateWorldMatrix(true,true);

const targetRig=new THREE.Group();
const targetParent=new THREE.Bone(); targetParent.name='mixamorigSpine'; targetParent.quaternion.copy(q(x,-35));
const targetChild=new THREE.Bone(); targetChild.name='mixamorigLeftArm'; targetChild.quaternion.copy(q(y,40));
targetParent.add(targetChild); targetRig.add(targetParent);
targetRig.updateWorldMatrix(true,true);

const sourceParentBind=sourceParent.quaternion.clone();
const sourceChildBind=sourceChild.quaternion.clone();
const sourceParentMoved=sourceParentBind.clone().multiply(q(z,20)).normalize();
const sourceChildMoved=sourceChildBind.clone().multiply(q(x,30)).normalize();

const clip=new THREE.AnimationClip('Hierarchy',1,[
  new THREE.QuaternionKeyframeTrack('mixamorigSpine.quaternion',[0,1],[
    sourceParentBind.x,sourceParentBind.y,sourceParentBind.z,sourceParentBind.w,
    sourceParentMoved.x,sourceParentMoved.y,sourceParentMoved.z,sourceParentMoved.w
  ]),
  new THREE.QuaternionKeyframeTrack('mixamorigLeftArm.quaternion',[0,1],[
    sourceChildBind.x,sourceChildBind.y,sourceChildBind.z,sourceChildBind.w,
    sourceChildMoved.x,sourceChildMoved.y,sourceChildMoved.z,sourceChildMoved.w
  ]),
  new THREE.VectorKeyframeTrack('mixamorigHips.position',[0,1],[0,0,0,1,2,3])
]);

const retargeted=retargetMixamoClip(THREE,clip,sourceRig,targetRig,'Retargeted');
assert.equal(retargeted.userData.mixamoImport.retargetMode,'world-space-bind-delta');
assert.equal(retargeted.tracks.length,2,'Only rotation tracks are baked');

const mixer=new THREE.AnimationMixer(targetRig);
const action=mixer.clipAction(retargeted).play();
action.paused=true;

action.time=0; mixer.update(0); targetRig.updateWorldMatrix(true,true);
assert.ok(targetParent.quaternion.angleTo(q(x,-35))<5e-4,'Parent source bind maps to target parent bind');
assert.ok(targetChild.quaternion.angleTo(q(y,40))<5e-4,'Child source bind maps to target child bind');

action.time=1; mixer.update(0); targetRig.updateWorldMatrix(true,true);
sourceParent.quaternion.copy(sourceParentMoved);
sourceChild.quaternion.copy(sourceChildMoved);
sourceRig.updateWorldMatrix(true,true);
const sourceParentBindWorld=q(y,25);
const sourceChildBindWorld=sourceParentBindWorld.clone().multiply(q(z,15));
const sourceParentAnimWorld=sourceParent.getWorldQuaternion(new THREE.Quaternion());
const sourceChildAnimWorld=sourceChild.getWorldQuaternion(new THREE.Quaternion());
const targetParentBindWorld=q(x,-35);
const targetChildBindWorld=targetParentBindWorld.clone().multiply(q(y,40));
const expectedParentWorld=sourceParentAnimWorld.clone().multiply(sourceParentBindWorld.clone().invert()).multiply(targetParentBindWorld);
const expectedChildWorld=sourceChildAnimWorld.clone().multiply(sourceChildBindWorld.clone().invert()).multiply(targetChildBindWorld);
const actualParentWorld=targetParent.getWorldQuaternion(new THREE.Quaternion());
const actualChildWorld=targetChild.getWorldQuaternion(new THREE.Quaternion());
assert.ok(actualParentWorld.angleTo(expectedParentWorld)<8e-4,'Parent world-space motion is preserved');
assert.ok(actualChildWorld.angleTo(expectedChildWorld)<8e-4,'Child world-space motion is preserved despite different parent bind axes');

mixer.stopAllAction();
console.log('PASS Mixamo world-space bind retargeting');
