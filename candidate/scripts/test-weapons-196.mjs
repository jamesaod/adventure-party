import assert from 'node:assert/strict';
import fs from 'node:fs';
import {itemCatalogEntry} from '../js/item-catalog.mjs';
import {STUDIO_WEAPONS,studioWeapon,normalizeEquipment,STUDIO_OFF_HAND_WEAPONS} from '../js/studio-equipment.mjs';
import {VISIBLE_WEAPON_ASSETS} from '../js/mob-appearance.mjs';
import {CAPTURE_GROUP_CATALOG} from '../js/action-capture-groups.mjs';
const items=JSON.parse(fs.readFileSync(new URL('../data/equipment-imports-196.json',import.meta.url))).items;
assert.equal(new Set(STUDIO_WEAPONS.map(w=>w.id)).size,STUDIO_WEAPONS.length);
for(const source of items){
 const item=itemCatalogEntry(source.id),weapon=studioWeapon(source.id);
 assert.equal(weapon.label,source.name);assert.equal(weapon.file,item.appearance.asset);
 assert.equal(VISIBLE_WEAPON_ASSETS[source.id].studioId,source.id);
 assert.ok(CAPTURE_GROUP_CATALOG.has(weapon.poseProfileId));
 assert.deepEqual(weapon.primaryAxis,[0,1,0]);
 assert.equal(weapon.handsRequired,source.handsRequired);
 assert.equal(normalizeEquipment({rightHand:source.id,shaftRollDegrees:37,presetRevision:1}).shaftRollDegrees,37);
 if(source.handsRequired===2)assert.ok(!STUDIO_OFF_HAND_WEAPONS.some(w=>w.id===source.id));
}
assert.equal(studioWeapon('medieval-sword').label,'Long Sword');
assert.equal(studioWeapon('wizard-staff-grip').label,'Wooden Staff 1');
assert.equal(studioWeapon('recurve-bow').label,'Bow');
console.log('PASS nine weapon catalog, combat appearance, capture-group and stable-ID rename integrations');
