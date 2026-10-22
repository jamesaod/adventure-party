import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { ITEM_CATALOG_VERSION, ITEM_CATALOG, itemCatalogEntry } from '../js/item-catalog.mjs';

assert.equal(ITEM_CATALOG_VERSION,1);
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
assert.equal(shield.appearance.representation,'procedural-round-shield-v1');
assert.equal(shield.appearance.nativeScale,0.45);
assert.equal(shield.appearance.source.originalFilename,'round+wooden+shield+3d+model.glb');
assert.equal(shield.appearance.source.originalBytes,781832);
assert.equal(shield.appearance.source.originalSha256,'4a0bad4a77b3e5a086576b00e8890ef5f0c2417ea423559ef7196acd8a488928');

assert.equal(shield.appearance.source.vertices,5648);
assert.equal(shield.appearance.source.triangles,8478);
assert.equal(shield.appearance.source.textureResolution,1024);
assert.equal(json.animations?.length||0,0);
assert.equal(json.accessors[json.meshes[0].primitives[0].indices].count/3,384);
assert.equal(json.accessors[json.meshes[0].primitives[0].attributes.POSITION].count,258);
assert.equal(json.images.length,1);
assert.ok(json.images.every(image=>image.mimeType==='image/jpeg'&&Number.isInteger(image.bufferView)));
assert.deepEqual(json.accessors[json.meshes[0].primitives[0].attributes.POSITION].min,
  [-0.5,0,-0.12]);
assert.deepEqual(json.accessors[json.meshes[0].primitives[0].attributes.POSITION].max,
  [0.5,1,0.055]);

const game=fs.readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
assert.ok(game.includes('heightInches:76'));
assert.ok(game.includes('f.heightInches=76'));
assert.ok(game.includes('bodyReferenceHeightInches:76'));
assert.ok(game.includes('catalogItemId:"flaming-sword-5"'));
assert.ok(game.includes('catalogItemId:"battle-axe"'));
assert.ok(game.includes('catalogItemId:"chain-mail"'));
assert.ok(game.includes('catalogItemId:"round-wooden-shield"'));
assert.ok(game.includes('appearanceId:"round-wooden-shield"'));
console.log('PASS canonical item catalog, Carl 76-inch height and wooden shield asset');
