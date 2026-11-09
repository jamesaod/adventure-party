import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readCombatFixture as readFileSync} from './combat-test-source.mjs';
const source=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const extract=name=>{const start=source.indexOf('function '+name+'(');return source.slice(start,source.indexOf('\nfunction ',start+1));};
const context=vm.createContext({getMissileCatalogEntry:id=>id==='bow-short'?{id,ammoId:'arrows',rateOfFire:2,rangeIncrementFt:50}:null,getWeaponCatalogEntry:id=>id==='arrows'?{name:'Arrows'}:null});
for(const name of ['equipCarlBowForCombatTest','syncRepositoryMissileEquipment','consumeMissileAmmo'])vm.runInContext(extract(name),context);
const sword={slot:'weapon',name:'Flaming Sword +5',equipped:true},shield={slot:'shield',name:'Round Wooden Shield',equipped:true},carl={id:'player',inventory:[sword,shield]};
context.equipCarlBowForCombatTest(carl);context.syncRepositoryMissileEquipment(carl);
assert.equal(carl.weaponInHand,'ranged');assert.equal(carl.rangedWeapon,'Bow');assert.equal(carl.missileCatalogId,'bow-short');assert.equal(carl.missileAmmoQuantity,20);assert.equal(carl.missileRateOfFire,2);
assert(!sword.equipped&&!shield.equipped,'The bow needs both hands; melee equipment remains in inventory');
assert(context.consumeMissileAmmo(carl));assert.equal(carl.missileAmmoQuantity,19);assert.equal(carl.inventory.find(i=>i.type==='Ammo').qty,19);
context.equipCarlBowForCombatTest(carl);context.syncRepositoryMissileEquipment(carl);assert.equal(carl.inventory.filter(i=>i.catalogItemId==='recurve-bow').length,1);assert.equal(carl.missileAmmoQuantity,20);
carl.inventory.find(i=>i.catalogItemId==='recurve-bow').equipped=false;sword.equipped=true;context.syncRepositoryMissileEquipment(carl);assert.equal(carl.weaponInHand,'melee');assert.equal(carl.rangedWeapon,null);
// Unregistered allies/enemies use the exact same equipment and ammo path.
for(const faction of ['player','enemy']){
 const unit={id:'humanoid-'+faction,faction,inventory:[{name:'Bow',slot:'weapon',equipped:true,catalogMissileWeaponId:'bow-short'},{name:'Arrows',type:'Ammo',catalogWeaponId:'arrows',qty:3}]};
 context.syncRepositoryMissileEquipment(unit);assert.equal(unit.weaponInHand,'ranged');assert.equal(unit.missileAmmoQuantity,3);
 assert(context.consumeMissileAmmo(unit));context.syncRepositoryMissileEquipment(unit);assert.equal(unit.missileAmmoQuantity,2,'Sync never grants or refills existing ammunition');
}
console.log('PASS Carl combat-test bow, 20 arrows, two-handed loadout, shot consumption/inventory sync, reset and switching back to melee');
