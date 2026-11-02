import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {ARMOR_ITEMS,ARMOR_ENGINE_CATALOG,encumberedMovement,inventoryMovement} from '../js/armor-rules.mjs';
import {ITEM_CATALOG} from '../js/item-catalog.mjs';
import {sampleGeneration,defaultGeneration} from '../js/mob-generation.mjs';
assert.equal(Object.keys(ARMOR_ITEMS).length,14);
for(const armor of Object.values(ARMOR_ITEMS)){
 assert.deepEqual(ITEM_CATALOG[armor.id],armor);
 assert.equal(ARMOR_ENGINE_CATALOG[armor.rules.catalogArmorId].baseArmorClass,armor.rules.baseArmorClass);
 assert.equal(armor.appearance,null);assert.equal(armor.rules.maxMoveFt,undefined);
}
assert.equal(ITEM_CATALOG['chain-mail'].rules.encumbrance,40);
assert.equal(ITEM_CATALOG['plate-mail'].rules.cost,'600 gp');
assert.equal(ITEM_CATALOG['full-plate'].rules.cost,'4,000–10,000 gp');
assert.equal(encumberedMovement({strength:17,weight:140}).move,7); // Handbook worked example
assert.equal(encumberedMovement({strength:10,weight:40}).move,12);
assert.equal(encumberedMovement({strength:10,weight:40.1}).move,11);
assert.equal(encumberedMovement({strength:10,weight:110}).move,1);
assert.equal(encumberedMovement({strength:10,weight:111}).move,0);
assert.equal(encumberedMovement({strength:18,exceptionalStrength:100,weight:335}).move,12);
assert.equal(encumberedMovement({strength:10,weight:65,baseMove:6}).move,3);
assert.equal(encumberedMovement({strength:10,weight:40,baseMove:9}).move,9);
assert.equal(encumberedMovement({strength:25,weight:1535}).move,12);
const unit={stats:{str:10},move:12,inventory:[{name:'Chain',slot:'armor',encumbrance:40,qty:1,equipped:true}]};
const first=inventoryMovement(unit);assert.equal(first.weight,45);assert.equal(first.move,11);
unit.inventory[0].equipped=false;assert.equal(inventoryMovement(unit).move,11,'carried armor still weighs the same');
unit.unencumberedMove=12;unit.move=11;assert.equal(inventoryMovement(unit).move,11,'sync cannot compound reduction');
unit.sizeCategory='small';assert.equal(inventoryMovement(unit).weight,25);
unit.sizeCategory='large';assert.equal(inventoryMovement(unit).weight,65);
unit.inventory=[];assert.equal(inventoryMovement(unit).move,12);
unit.inventory=[{name:'Unweighed treasure'}];assert.deepEqual(inventoryMovement(unit).missingWeights,['Unweighed treasure']);
const g=defaultGeneration({},[{itemId:'chain-mail',slot:'armor'}]);
const sample=sampleGeneration(g);assert.ok(sample.equipment.some(i=>i.itemId==='chain-mail'&&i.slot==='armor'));
assert.equal(sample.generation.armor,'chain-mail');assert.equal(g.alwaysItems.length,0);
assert.throws(()=>sampleGeneration({...g,armor:'long-sword'}),/armor/);
// Exercise the production equipment synchronizer and AC resolver, not a duplicate engine.
const source=fs.readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const fn=name=>{const start=source.indexOf(`function ${name}(`);assert.ok(start>=0);return source.slice(start,source.indexOf('\n}',start)+2);};
const sandbox={window:{adventurePartyArmorRules:{inventoryMovement}},getArmorCatalogEntry:id=>ARMOR_ENGINE_CATALOG[id],getWeaponCatalogEntry:()=>null,getMissileCatalogEntry:()=>null,syncRepositoryMissileEquipment:()=>{},dexterityAdjustments:()=>({defensive:0}),clamp:(v,min,max)=>Math.max(min,Math.min(max,v))};
vm.createContext(sandbox);vm.runInContext(fn('calculateArmorClass')+'\n'+fn('syncFighterEquipment'),sandbox);
const armored={move:12,stats:{str:10,dex:10},inventory:[{name:'Chain',catalogArmorId:'chain',slot:'armor',equipped:true}]};
sandbox.syncFighterEquipment(armored);assert.equal(armored.ac,5);assert.equal(armored.move,11);
sandbox.syncFighterEquipment(armored);assert.equal(armored.move,11);
armored.inventory[0].baseArmorClass=3;sandbox.syncFighterEquipment(armored);assert.equal(armored.ac,3,'variant armor AC wins');
armored.inventory[0].equipped=false;sandbox.syncFighterEquipment(armored);assert.equal(armored.ac,10);assert.equal(armored.move,11);
armored.inventory=[];sandbox.syncFighterEquipment(armored);assert.equal(armored.move,12);
console.log('Armor: 14 shared entries, PHB movement example/boundaries, size, carried armor, stable resync and MOB assignment passed.');
