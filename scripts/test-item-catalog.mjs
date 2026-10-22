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
assert.equal(shield.physical.calibratedThicknessInches,8.72);
assert.equal(shield.appearance.representation,'procedural-round-shield-textured-v1');
assert.equal(shield.appearance.nativeScale,0.45);
assert.equal(shield.appearance.source.originalFilename,'round+wooden+shield+3d+model.glb');
assert.equal(shield.appearance.source.originalBytes,781832);
assert.equal(shield.appearance.source.originalSha256,'4a0bad4a77b3e5a086576b00e8890ef5f0c2417ea423559ef7196acd8a488928');
assert.equal(shield.appearance.source.vertices,5648);
assert.equal(shield.appearance.source.triangles,8478);
assert.equal(shield.appearance.texturePack.resolution,256);

const textureCases=[
  ['baseColor',17079,'101d884733e850625da37d3d629b5a8cd070785c2707069c081d1209de5f1fbd'],
  ['normal',5528,'5a656d1e404a2b02fe2caa6c032daa7d3c1f711c1c81f3cffbe73403efa36220'],
  ['roughnessMetallic',14372,'e9c04df10678786d7dc8eb39f517059a78f7a3a76e1059e710a0533593db34f8']
];
for(const [key,expectedBytes,expectedSha] of textureCases){
  const record=shield.appearance.texturePack[key];
  const encoded=fs.readFileSync(new URL('../'+record.path,import.meta.url),'utf8').trim();
  const bytes=Buffer.from(encoded,'base64');
  assert.equal(bytes.length,expectedBytes,`${key} byte count`);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expectedSha,`${key} SHA-256`);
  assert.equal(bytes[0],0xff);
  assert.equal(bytes[1],0xd8);
  assert.equal(bytes.at(-2),0xff);
  assert.equal(bytes.at(-1),0xd9);
}

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
console.log('PASS canonical item catalog, Carl 76-inch height and wooden shield texture assets');
