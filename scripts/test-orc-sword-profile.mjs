import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWeaponAttachment, normalizeEquipment, studioWeapon, STUDIO_WEAPONS } from '../js/studio-equipment.mjs';
const THREE=await import('data:text/javascript;base64,'+
  readFileSync(new URL('../assets/vendor/three/three.core.min.js',import.meta.url)).toString('base64'));

const catalog=JSON.parse(readFileSync('data/studio-models.json','utf8'));
const id='tripo-mixamo-orc-one-hand-sword-upward-v2';
const preset=catalog.weaponAttachmentProfiles?.[id];
assert.ok(preset,'The Orc sword pose must be stored as catalog data');
assert.equal(preset.weaponId,'medieval-sword');
assert.equal(preset.status,'user-calibrated');
assert.deepEqual(preset.position,[-0.010,0.050,0.005]);
assert.deepEqual(preset.rotation,[-29,-55,175]);
const orcs=catalog.models.filter(entry=>entry.id.startsWith('new-orc-'));
assert.ok(orcs.length>=6,'Source, Rev 110 and all Rev 111/112/113 QA Orc models are cataloged');
for(const entry of orcs)assert.equal(entry.weaponAttachmentProfileId,id,
  'New Orc variants share identical reusable sword orientation profile');
for(const entry of catalog.models.filter(entry=>/carl/i.test(entry.id))) {
  assert.equal(entry.weaponAttachmentProfileId,undefined,
    'Carl retains the independently approved global sword grip');
}
assert.deepEqual(studioWeapon('medieval-sword').rotation,[0,-90,0],
  'Shared sword preset unchanged; Orc adjustment is opt-in only');
assert.equal(STUDIO_WEAPONS.length,10,'Existing weapons plus the three Rev 144 imports use the shared attachment path');

const hand=new THREE.Bone(); hand.name='mixamorig:RightHand';
const root=new THREE.Group();root.add(hand);
const sword=new THREE.Group();
const settings=normalizeEquipment({rightHand:preset.weaponId,
  position:preset.position,rotation:preset.rotation});
const attachment=createWeaponAttachment(THREE,hand,sword,settings);
root.updateWorldMatrix(true,true);
const gripPoint=new THREE.Vector3(...studioWeapon('medieval-sword').grip);
const actualGrip=sword.localToWorld(gripPoint.clone());
const expectedGrip=hand.localToWorld(new THREE.Vector3(...preset.position));
assert.ok(actualGrip.distanceTo(expectedGrip)<1e-6,
  'Rotate weapon about its calibrated grip so the hilt stays in the fist');
// User-calibrated rotation must be preserved without imposing the former
// experimental axis direction on the blade.
assert.deepEqual(settings.position,preset.position);
assert.deepEqual(settings.rotation,preset.rotation);
attachment.detach();

// This profile is applied by the normal weapon selector and by Reset grip,
// so a newly equipped sword on the same rig gets the same data-driven result.
const studio=readFileSync('js/3d-studio.mjs','utf8');
assert.ok(studio.includes('function defaultEquipmentSettingsForModel(weaponId)'));
assert.ok(studio.includes('changeEquipment(defaultEquipmentSettingsForModel(weaponId))'));
assert.ok(studio.includes('changeEquipment(defaultEquipmentSettingsForModel(equipment.snapshot().settings.rightHand))'));
assert.ok(studio.includes('profile?.weaponId === weaponId'),
  'Wrong weapon classes do not inherit the one-handed sword orientation');
console.log('PASS: Orc catalog sword profile, unchanged Carl default, preserved sword grip, and selector/reset reuse');
