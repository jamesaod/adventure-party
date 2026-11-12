import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {createHandPose,normalizeHandPose,GRIP_PRESETS} from '../js/mob-workshop-hand-pose.mjs';
const root=new THREE.Group(),hand=new THREE.Bone();hand.name='mixamorigRightHand';root.add(hand);
for(const finger of ['Index','Middle','Ring','Pinky','Thumb']){let parent=hand;for(let i=1;i<=3;i++){const b=new THREE.Bone();b.name='mixamorigRightHand'+finger+i;parent.add(b);parent=b;}}
const pose=createHandPose(THREE),info=pose.bind(root);assert.equal(info.fingers.length,5);
const settings={wrist:[10,20,30],curl:GRIP_PRESETS.shaft,opposition:20};pose.apply(settings);
const first=hand.quaternion.clone(),finger=hand.children[0],fq=finger.quaternion.clone();
for(let i=0;i<100;i++)pose.apply(settings);
assert.ok(hand.quaternion.angleTo(first)<1e-7);assert.ok(finger.quaternion.angleTo(fq)<1e-7);
pose.restore();assert.ok(hand.quaternion.angleTo(new THREE.Quaternion())<1e-7);
hand.rotation.x=.3;const authored=hand.quaternion.clone();pose.apply(settings);pose.restore();assert.ok(hand.quaternion.angleTo(authored)<1e-7);
assert.equal(pose.bind(new THREE.Group()).hand,null);pose.apply(settings);
assert.deepEqual(normalizeHandPose(null).curl,[0,0,0,0,0]);assert.equal(normalizeHandPose({wrist:[999]}).wrist[0],90);
console.log('Hand pose: complete chains, stable repeated application, authored animation restoration, missing rig and input bounds passed.');
