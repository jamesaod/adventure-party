import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { ITEM_CATALOG_VERSION, ITEM_CATALOG, itemCatalogEntry } from '../js/item-catalog.mjs';

assert.equal(ITEM_CATALOG_VERSION,2);
for(const id of ['flaming-sword-5','battle-axe','chain-mail','round-wooden-shield']){
  assert.equal(itemCatalogEntry(id),ITEM_CATALOG[id],`Catalog lookup resolves ${id}`);
  assert.ok(Object.isFrozen(ITEM_CATALOG[id]),`${id} is immutable`);
}

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
