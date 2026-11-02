import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {weaponGripQuaternion,gripSettingsReport} from '../js/weapon-shaft-roll.mjs';
import {STUDIO_WEAPONS,normalizeEquipment} from '../js/studio-equipment.mjs';
import {resolveCombatWeaponMount} from '../js/combat-weapon-mount.mjs';
for(const weapon of STUDIO_WEAPONS){
 const original=normalizeEquipment({rightHand:weapon.id});
 assert.equal(original.shaftRollDegrees,0,'old grips are not rerolled');
 const legacy=new THREE.Quaternion().setFromEuler(new THREE.Euler(...original.rotation.map(THREE.MathUtils.degToRad),'XYZ'));
 assert.ok(legacy.angleTo(weaponGripQuaternion(THREE,original.rotation,weapon.primaryAxis))<1e-6);
 for(const roll of [-180,-29,90,180]){
  let settings=normalizeEquipment({...original,shaftRollDegrees:roll});
  settings=normalizeEquipment({...settings,rotation:[20,48,133],position:[.01,.05,.02]});
  assert.equal(settings.shaftRollDegrees,roll,'XYZ edits preserve roll');
  const axis=new THREE.Vector3(...weapon.primaryAxis).normalize();
  const base=weaponGripQuaternion(THREE,settings.rotation,weapon.primaryAxis,0),turned=weaponGripQuaternion(THREE,settings.rotation,weapon.primaryAxis,roll);
  assert.ok(axis.clone().applyQuaternion(base).distanceTo(axis.clone().applyQuaternion(turned))<1e-10,'shaft direction unchanged');
  const report=JSON.parse(JSON.stringify(gripSettingsReport({id:'male-orc',label:'Orc'},weapon,settings)));
  assert.equal(report.positionSpace,'hand-local');assert.equal(report.modelId,'male-orc');
  assert.deepEqual(normalizeEquipment(report.settings),settings,'copied data reconstructs saved mount');
  const combat=resolveCombatWeaponMount({studioId:weapon.id},{equipment:report.settings},weapon);
  assert.equal(combat.shaftRollDegrees,roll);assert.deepEqual(combat.rotation,settings.rotation);
 }
}
console.log('PASS independent roll: legacy appearance, XYZ edits, save/export report and combat parity for all weapons');
