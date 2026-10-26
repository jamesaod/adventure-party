import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { ITEM_CATALOG_VERSION, ITEM_CATALOG, itemCatalogEntry } from '../js/item-catalog.mjs';

assert.equal(ITEM_CATALOG_VERSION,3);
for(const id of ['flaming-sword-5','battle-axe','two-handed-sword','chain-mail','round-wooden-shield']){
  assert.equal(itemCatalogEntry(id),ITEM_CATALOG[id],`Catalog lookup resolves ${id}`);
  assert.ok(Object.isFrozen(ITEM_CATALOG[id]),`${id} is immutable`);
}

const twoHanded=itemCatalogEntry('two-handed-sword');
assert.equal(twoHanded.appearance.poseProfileId,'two-handed-swing');
assert.equal(twoHanded.appearance.handsRequired,2);
assert.deepEqual(twoHanded.appearance.primaryAxis,[0,-1,0]);
assert.deepEqual(twoHanded.appearance.grip,[0,0.81,0]);
assert.deepEqual(twoHanded.appearance.secondaryGrip,[0,0.95,0]);
assert.equal(twoHanded.appearance.nativeScale,0.78);
assert.equal(twoHanded.appearance.source.originalBytes,646456);
assert.equal(twoHanded.appearance.source.originalSha256,'85408b9b17fa38a72816d57ac55e63e6409862b5d5a305beb6cf5eee045c948a');
const twoHandedBytes=fs.readFileSync(new URL('../'+twoHanded.appearance.asset,import.meta.url));
assert.equal(twoHandedBytes.length,646456);
assert.equal(crypto.createHash('sha256').update(twoHandedBytes).digest('hex'),twoHanded.appearance.source.originalSha256);
assert.equal(twoHandedBytes.readUInt32LE(0),0x46546c67);
assert.equal(twoHandedBytes.readUInt32LE(4),2);
assert.equal(twoHandedBytes.readUInt32LE(8),twoHandedBytes.length);
let twoHandedJson=null;
for(let offset=12;offset<twoHandedBytes.length;){
  const length=twoHandedBytes.readUInt32LE(offset),type=twoHandedBytes.readUInt32LE(offset+4);
  const chunk=twoHandedBytes.subarray(offset+8,offset+8+length);
  if(type===0x4e4f534a)twoHandedJson=JSON.parse(chunk.toString('utf8'));
  offset+=8+length;
}
assert.ok(twoHandedJson);
assert.equal(twoHandedJson.meshes.length,1);
assert.equal(twoHandedJson.materials.length,1);
assert.equal(twoHandedJson.skins?.length||0,0);
assert.equal(twoHandedJson.animations?.length||0,0);
assert.equal(twoHandedJson.accessors[twoHandedJson.meshes[0].primitives[0].indices].count/3,8333);
assert.equal(twoHandedJson.accessors[twoHandedJson.meshes[0].primitives[0].attributes.POSITION].count,6623);
assert.equal(twoHandedJson.images.length,3);
assert.ok(twoHandedJson.images.every(image=>image.mimeType==='image/jpeg'&&Number.isInteger(image.bufferView)));
assert.deepEqual(twoHandedJson.accessors[twoHandedJson.meshes[0].primitives[0].attributes.POSITION].min,[-0.1240234524011612,0,-0.029155734926462173]);
assert.deepEqual(twoHandedJson.accessors[twoHandedJson.meshes[0].primitives[0].attributes.POSITION].max,[0.1240234524011612,1,0.029155734926462173]);

const shield=itemCatalogEntry('round-wooden-shield');
assert.equal(shield.rules.catalogArmorId,'shield-medium');
assert.equal(shield.rules.acBonus,1);
assert.equal(shield.rules.encumbrance,8);
assert.equal(shield.rules.maxProtectedAttacksPerRound,2);
assert.equal(shield.physical.calibratedDiameterInches,35);
assert.equal(shield.physical.calibratedThicknessInches,6.13);
assert.equal(shield.appearance.representation,'source-gltf-v1');
assert.equal(shield.appearance.asset,'assets/models/shields/round-wooden-shield.glb');
assert.equal(shield.appearance.nativeScale,0.45);
assert.equal(shield.appearance.runtimeAsset.bytes,781832);
assert.equal(shield.appearance.runtimeAsset.sha256,shield.appearance.source.originalSha256);
assert.equal(shield.appearance.source.originalFilename,'round+wooden+shield+3d+model.glb');
assert.equal(shield.appearance.source.originalBytes,781832);
assert.equal(shield.appearance.source.originalSha256,'4a0bad4a77b3e5a086576b00e8890ef5f0c2417ea423559ef7196acd8a488928');
assert.equal(shield.appearance.source.vertices,5648);
assert.equal(shield.appearance.source.triangles,8478);

const bytes=fs.readFileSync(new URL('../'+shield.appearance.asset,import.meta.url));
assert.equal(bytes.length,781832);
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),
  '4a0bad4a77b3e5a086576b00e8890ef5f0c2417ea423559ef7196acd8a488928');
assert.equal(bytes.readUInt32LE(0),0x46546c67);
assert.equal(bytes.readUInt32LE(4),2);
assert.equal(bytes.readUInt32LE(8),bytes.length);
let json=null;
for(let offset=12;offset<bytes.length;){
  const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);
  const chunk=bytes.subarray(offset+8,offset+8+length);
  if(type===0x4e4f534a)json=JSON.parse(chunk.toString('utf8'));
  offset+=8+length;
}
assert.ok(json);
assert.equal(json.meshes.length,1);
assert.equal(json.materials.length,1);
assert.equal(json.skins?.length||0,0);
assert.equal(json.animations?.length||0,0);
assert.equal(json.accessors[json.meshes[0].primitives[0].indices].count/3,8478);
assert.equal(json.accessors[json.meshes[0].primitives[0].attributes.POSITION].count,5648);
assert.equal(json.images.length,3);
assert.ok(json.images.every(image=>image.mimeType==='image/jpeg'&&Number.isInteger(image.bufferView)));
assert.deepEqual(json.accessors[json.meshes[0].primitives[0].attributes.POSITION].min,[-0.4998169541358948,0,-0.12459565699100494]);
assert.deepEqual(json.accessors[json.meshes[0].primitives[0].attributes.POSITION].max,[0.4998169541358948,1,0.12459565699100494]);

const game=fs.readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
assert.ok(game.includes('fighter:76'));
assert.ok(game.includes('heightInches:76'));
assert.ok(game.includes('f.heightInches=76'));
assert.ok(game.includes('bodyReferenceHeightInches:76'));
assert.ok(game.includes('catalogItemId:"round-wooden-shield"'));
assert.ok(game.includes('appearanceId:"round-wooden-shield"'));
assert.ok(game.includes('catalogItemId:"flaming-sword-5"'));
assert.ok(game.includes('catalogItemId:"battle-axe"'));
assert.ok(game.includes('catalogItemId:"chain-mail"'));
assert.ok(game.includes('HUMANOID_RUNTIME_MODELS'));
assert.ok(game.includes('runtime.ensure(unit'));
assert.ok(game.includes('queueHumanoidPresentationReconcile'));
console.log('PASS canonical item catalog, Carl 76-inch height and wooden shield GLB');

// Exercise the versioned Unit Package layer as part of standard repository QA.
await import('./test-unit-package.mjs');

const wizardItem=itemCatalogEntry('wizard-staff-grip'),ordinaryStaff=itemCatalogEntry('wooden-staff');
assert.equal(wizardItem.name,'Wizard Staff Grip');assert.equal(wizardItem.rules.catalogWeaponId,'staff');
assert.equal(wizardItem.rules.handsRequired,1);assert.equal(ordinaryStaff.rules.handsRequired,2);
assert.equal(wizardItem.appearance.asset,ordinaryStaff.appearance.asset);
assert.deepEqual(wizardItem.appearance.runtimeAsset,ordinaryStaff.appearance.runtimeAsset);
assert.equal(wizardItem.appearance.poseProfileId,'wizard-staff-grip');
