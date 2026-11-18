import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {captureFit,readFit} from '../js/mob-workshop-fit-core.mjs';
for(const shield of [false,true]){
 const settings={position:[.1,.2,.3],rotation:[20,-30,50],sizePercent:100};
 const base=new THREE.Quaternion().setFromEuler(new THREE.Euler(...settings.rotation.map(THREE.MathUtils.degToRad),'XYZ'));
 const extra=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.4),socket=new THREE.Object3D();
 socket.position.set(.2,.3,.5);socket.quaternion.copy(shield?extra.clone().multiply(base):base.clone().multiply(extra));
 const start=captureFit(THREE,socket,settings,shield),same=readFit(THREE,socket,start);
 same.rotation.forEach((v,i)=>assert.ok(Math.abs(v-settings.rotation[i])<1e-8));
 const target=new THREE.Quaternion().setFromEuler(new THREE.Euler(.2,.3,.4));
 socket.quaternion.copy(shield?extra.clone().multiply(target):target.clone().multiply(extra));socket.position.x+=.05;
 const changed=readFit(THREE,socket,start);assert.ok(Math.abs(changed.position[0]-.15)<1e-8);
 const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...changed.rotation.map(THREE.MathUtils.degToRad),'XYZ'));
 assert.ok(q.angleTo(target)<1e-7);assert.equal(changed.sizePercent,100);assert.deepEqual(settings.position,[.1,.2,.3]);
}
console.log('Equipment fit preserves weapon roll, shield mounting offsets and saved transforms.');

const socket=new THREE.Object3D(),settings={position:[0,0,0],rotation:[0,0,0]};const start=captureFit(THREE,socket,settings);socket.position.set(1.75,-1.75,3);assert.deepEqual(readFit(THREE,socket,start).position,[1.75,-1.75,3]);

const {normalizeEquipment}=await import('../js/studio-equipment.mjs');assert.deepEqual(normalizeEquipment({position:[12,-15,3]}).position,[12,-15,3]);socket.position.set(30,-30,12);assert.deepEqual(readFit(THREE,socket,start).position,[20,-20,12]);console.log('Expanded range survives dragging and runtime normalization.');
