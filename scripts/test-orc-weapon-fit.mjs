import assert from 'node:assert/strict';
import fs from 'node:fs';
import {orcWeaponFit} from '../js/orc-weapon-fit.mjs';
import {STUDIO_WEAPONS, normalizeEquipment} from '../js/studio-equipment.mjs';
const THREE = await import('data:text/javascript;base64,' + fs.readFileSync(new URL('../assets/vendor/three/three.core.min.js', import.meta.url)).toString('base64'));
const weapons = STUDIO_WEAPONS.filter(w => w.presetRevision === 100);
assert.ok(weapons.length > 15);
for (const weapon of weapons) {
  const fit = orcWeaponFit('male-orc', weapon);
  assert.ok(fit);
  assert.deepEqual(normalizeEquipment(fit).rotation, fit.rotation, weapon.id + ' survives preset migration');
  assert.equal(orcWeaponFit('dungeon-crawler-carl', weapon), null);
  assert.equal(orcWeaponFit('male-orc', weapon, 'shield'), null);
  const left = weapon.attachmentHand === 'left';
  const palmAxis = new THREE.Vector3(...(left
    ? [.03151578 + .02628777, .07208471 - .08915385, -.00519347 - .00279070]
    : [-.020100275 - .015519260, .057089865 - .063654244, .021753471 + .019858047])).normalize();
  // A crossbow's trigger grip is +Z; other handles run along +Y.
  const axis = new THREE.Vector3(...(weapon.visualClass === 'crossbow' ? [0,0,1] : [0,1,0]));
  axis.applyEuler(new THREE.Euler(...fit.rotation.map(THREE.MathUtils.degToRad)));
  assert.ok(axis.angleTo(palmAxis) < .001, weapon.id + ' aligns with anatomical palm axis');
}
assert.equal(orcWeaponFit('male-orc', {presetRevision: 1}), null);
const fit = orcWeaponFit('male-orc', weapons[0]);
const adjusted = {...fit, position: [.01,.08,.02], rotation: [10,20,30]};
assert.deepEqual(normalizeEquipment(adjusted).position, adjusted.position);
assert.deepEqual(normalizeEquipment(adjusted).rotation, adjusted.rotation);
console.log('Orc palm sockets: catalog migration, anatomical handle axes, crossbow grip, model isolation and manual adjustments passed.');
