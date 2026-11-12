import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {markFlamingBlade,preparedBladeTemplates,restorePreparedBlade,hasFlamingSword,createWeaponFlameMask} from '../js/combat-weapon-flame.mjs';
import {createUnitBurnEffect} from '../js/combat-unit-burn-effect.mjs';
import {captureDirectUnit,sampleDirectPose} from '../js/combat-direct-units.mjs';
const root=new THREE.Group(),hand=new THREE.Bone(),weapon=new THREE.Group();root.add(hand);hand.add(weapon);
const blade=new THREE.Mesh(new THREE.BufferGeometry().copy(new THREE.BoxGeometry(.08,1,.025)),new THREE.MeshStandardMaterial());blade.position.y=.65;weapon.add(blade);
const grip=new THREE.Mesh(new THREE.BufferGeometry().copy(new THREE.CylinderGeometry(.06,.06,.25,7)),new THREE.MeshStandardMaterial());weapon.add(grip);
const body=new THREE.Mesh(new THREE.BufferGeometry().copy(new THREE.SphereGeometry(.3,9,5)),new THREE.MeshStandardMaterial());root.add(body);
const camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,20);camera.position.set(0,2,6);camera.lookAt(0,.5,0);camera.updateMatrixWorld();
assert.equal(markFlamingBlade(weapon,{base:[0,.2,0],tip:[0,1.15,0]}),2);
assert([...grip.geometry.getAttribute('flameBlade').array].every(v=>v<0),'Grip is excluded from the flame silhouette');
assert.equal(body.geometry.getAttribute('flameBlade'),undefined,'Body is an occluder, never a sword emitter');
const templates=preparedBladeTemplates(weapon),snapshot=captureDirectUnit(root,camera);
assert.equal(snapshot.group.children.filter(m=>m.geometry.getAttribute('flameBlade')).length,2,'Prepared pose captures retain the blade coordinates');
for(const m of snapshot.group.children)m.geometry.deleteAttribute('flameBlade');
assert.equal(restorePreparedBlade(snapshot.group,templates),2,'Old posed assets recover the blade from source topology');
assert.equal(snapshot.group.children[2].geometry.getAttribute('flameBlade'),undefined,'Migration does not mark the body');
const roundTrip=new THREE.ObjectLoader().parse(snapshot.group.toJSON());assert.equal(roundTrip.children.filter(m=>m.geometry.getAttribute('flameBlade')).length,2,'Prepared serialization retains the attachment mask');
const entity={id:'sword',alive:true,inventory:[{equipped:true,catalogItemId:'flaming-sword-5'}]},asset={group:root,camera,workshopSample(_entity,seconds){hand.rotation.z=seconds;hand.position.x=seconds*.1;return true;}};
let previous;
for(let facing=0;facing<6;facing++)for(const seconds of [0,.4,.9]){
 const result=sampleDirectPose({asset,yaw:facing*Math.PI/3},entity,seconds,seconds*1000);
 const tip=weapon.localToWorld(new THREE.Vector3(0,1.15,0)).project(camera);
 assert.equal(result.asset,asset);assert.equal(result.yaw,facing*Math.PI/3);assert(tip.toArray().every(Number.isFinite));
 if(previous)assert(tip.distanceTo(previous)>1e-4,'The source silhouette moves with animation and all six view angles');previous=tip;
 assert.equal(blade.geometry.getAttribute('flameBlade').array.at(-1),templates[0].attribute.array.at(-1),'Blade coordinates remain model-local through animation');
}
const pass=createWeaponFlameMask(),originals=[];root.traverse(m=>{if(m.isMesh)originals.push([m,m.material]);});
assert.throws(()=>pass.draw({render(){throw Error('device lost');}},root,camera),/device lost/);
for(const [mesh,material] of originals)assert.equal(mesh.material,material,'Mask errors restore body and weapon materials');pass.dispose();
assert(hasFlamingSword(entity));assert(!hasFlamingSword({...entity,alive:false}));
for(const patch of [{equipped:false},{lit:false},{lightEnabled:false},{qty:0},{catalogItemId:'long-sword'},{startingLocation:'off-hand'}])assert(!hasFlamingSword({...entity,inventory:[{...entity.inventory[0],...patch}]}));
console.log('PASS model-attached blade coordinates, grip/body exclusion, prepared migration and serialization, animated poses at six view angles, material restoration, equipment and light state.');

const effect=createUnitBurnEffect(),view={width:100,height:100},crop={x:0,y:0,width:50,height:50};effect.update({texture:null,crop,time:1,opacity:1,core:.25,scale:3},view);assert.equal(effect.mesh.material.uniforms.core.value,.25);effect.update({texture:null,crop,time:2,opacity:.8},view);assert.equal(effect.mesh.material.uniforms.core.value,0,'Unit burns retain their original edge-only silhouette after drawing a flaming weapon');assert.equal(effect.mesh.material.uniforms.flameScale.value,1,'Unit burn flame size stays unchanged');effect.dispose();
console.log('PASS shared flame shader resets sword core fill for ordinary unit burn reactions');
