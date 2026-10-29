import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {createWeaponShaftRoll} from '../js/weapon-shaft-roll.mjs';
import {STUDIO_WEAPONS,normalizeEquipment} from '../js/studio-equipment.mjs';
const q=r=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...r.map(THREE.MathUtils.degToRad),'XYZ'));
for(const weapon of STUDIO_WEAPONS){
 assert.ok(weapon.primaryAxis?.some(v=>v!==0),weapon.id+' has length axis');
 const initial=normalizeEquipment({rightHand:weapon.id}),edit=createWeaponShaftRoll(THREE);
 const axis=new THREE.Vector3(...weapon.primaryAxis).normalize();
 const before=axis.clone().applyQuaternion(q(initial.rotation));
 let next=initial;
 for(const angle of [30,90,-90,180,-180,0]){
  next=normalizeEquipment(edit.apply('orc',next,weapon.primaryAxis,angle));
  assert.equal(edit.sync('orc',next),angle,'slider retains relative angle');
  assert.ok(before.distanceTo(axis.clone().applyQuaternion(q(next.rotation)))<1e-10,weapon.id+' shaft stays fixed');
  assert.deepEqual(next.position,initial.position);assert.equal(next.sizePercent,initial.sizePercent);
  assert.deepEqual(normalizeEquipment(JSON.parse(JSON.stringify(next))),JSON.parse(JSON.stringify(next)),'saved format round trip');
 }
 assert.deepEqual(next.rotation,initial.rotation,'return to zero restores exact baseline');
 next=edit.apply('orc',next,weapon.primaryAxis,75);
 assert.equal(edit.sync('leader',next),0,'model change rebases');
 next=edit.apply('leader',next,weapon.primaryAxis,30);next.rotation[0]+=1;
 assert.equal(edit.sync('leader',next),0,'manual XYZ edit rebases');
 edit.reset();assert.equal(edit.sync('leader',next),0);
 const restored=createWeaponShaftRoll(THREE);assert.equal(restored.sync('leader',next),0);
}
console.log('PASS shaft roll for all catalog weapons: stable aim, zero return, save roundtrip and editor rebase');
