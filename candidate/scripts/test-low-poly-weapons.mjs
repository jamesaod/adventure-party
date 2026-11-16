import assert from 'node:assert/strict';
import {ITEM_CATALOG as items} from '../js/item-catalog.mjs';
import {readFileSync} from 'node:fs';
for(const [id,sm,large,weight,speed,cost] of [['great-mace','1d8+1','2d4',20,10,'20 gp'],['two-handed-battle-axe','1d10','2d8',10,9,'10 gp'],['maul','2d4','1d10',10,9,'5 gp']]){
 const r=items[id].rules;assert.equal(r.damageSM,sm);assert.equal(r.damageL,large);assert.equal(r.encumbrance,weight);assert.equal(r.speedFactor,speed);assert.equal(r.cost,cost);assert.equal(r.handsRequired,2);
}
assert.equal(items.staff.rules.catalogWeaponId,items['wooden-staff'].rules.catalogWeaponId);
assert.equal(items.staff.rules.handsRequired,1);
assert.equal(items.staff.appearance.handsRequired,1);
assert.equal(items.staff.appearance.secondaryGrip,undefined);
assert.equal(items.staff.appearance.poseProfileId,'wizard-staff-grip');
assert.equal(items['wooden-staff'].name,'Quarterstaff');
assert.equal(items['wooden-staff'].rules.handsRequired,2);
assert.ok(items['wooden-staff'].appearance.secondaryGrip);
assert.equal(items['two-handed-falchion'].rules.damageSM,items['two-handed-sword'].rules.damageSM);
assert.equal(items['long-sword'].rules.lightSource,undefined);assert.equal(items['long-sword'].rules.magicHitBonus,0);
assert.ok(items['flaming-sword-5'].rules.lightSource);
for(const id of ['longbow','composite-longbow']){
 const b=readFileSync(items[id].appearance.asset),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
 assert.ok(j.nodes.some(n=>n.name==='BowRest'));assert.ok(j.nodes.some(n=>n.name==='BowDrawn'));
}
console.log('PASS low-poly weapons: requested stats, ordinary versus flaming sword, paired bow geometry');
