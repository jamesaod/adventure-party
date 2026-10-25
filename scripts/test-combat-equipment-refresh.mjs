import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
globalThis.location = {href:'https://example.test/candidate/index.html'};
const {compatibleStudioCombatModel} = await import('../js/combat-pose-recipe.mjs');
const {preserveThinSpriteDetails} = await import('../js/studio-thin-detail.mjs');

const catalog=JSON.parse(readFileSync(new URL('../data/studio-models.json',import.meta.url),'utf8'));
const resolved=compatibleStudioCombatModel({libraryModelId:'new-carl-tripo-source'},catalog,'fighter');
assert.equal(resolved.modelId,'new-carl-mixamo-sword-shield-full-17',
  'Imported FBX captures use the published, animation-baked Carl model in combat');
assert.equal(resolved.modelUrl,
  '../assets/models/dungeon-crawler-carl/new-carl/mixamo-sword-shield-full-17/new-carl-mixamo-sword-shield-full-17.glb');
const direct=compatibleStudioCombatModel({libraryModelId:'dungeon-crawler-carl-v2-ual2-sword-test'},catalog,'fighter');
assert.equal(direct.modelId,'dungeon-crawler-carl-v2-ual2-sword-test');
assert.equal(compatibleStudioCombatModel({libraryModelId:'new-orc-tripo-source'},catalog,'fighter'),null,
  'Orc Studio poses may not be silently applied to Carl');
assert.equal(compatibleStudioCombatModel({libraryModelId:'missing-model'},catalog,'fighter'),null);
const unsafe={models:[{id:'test',mobType:'fighter',file:'../../escape.glb'}]};
assert.equal(compatibleStudioCombatModel({libraryModelId:'test'},unsafe,'fighter'),null,
  'Model selection is limited to versioned assets in the repository');

const game=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const renderer=readFileSync(new URL('../js/combat-mob-renderer.mjs',import.meta.url),'utf8');
const recipe=readFileSync(new URL('../js/combat-pose-recipe.mjs',import.meta.url),'utf8');
const manifest=readFileSync(new URL('../js/sprite-set-core.mjs',import.meta.url),'utf8');
assert.ok(game.includes('...(captured.model || {})'), 'Equipment refresh must select the matching captured model');
assert.ok(game.includes('markMobAppearanceDirty(fighter)'), 'Gear swap must mark combat sprites dirty');
assert.ok(game.includes('unit.dynamicAppearanceSpriteSetId=spriteSetId'), 'Newly rendered sprites replace the old set');
assert.ok(recipe.includes('Object.values(captures).some(pose => pose?.stale)'), 'Edited outdated Studio captures cannot drive the combat pose');
assert.ok(renderer.includes('preserveThinSpriteDetails(sourceTopDown'), 'The live sprite renderer must save thin swords');
assert.ok(renderer.includes('defaultPose?.animation'), 'An unavailable captured clip must fall back safely');
assert.ok(manifest.includes("'supersampled-battlefield-v2'"), 'Generated runtime images must satisfy the sprite schema');

// A thin diagonal sword survives the same 1-frame native downsample used by
// equipment changes, not only Studio's six-facing atlas processing.
const source=new Uint8ClampedArray(12*12*4),reduced=new Uint8ClampedArray(4*4*4);
for(let n=0;n<4;n++){
  const i=((n*3+1)*12+n*3+1)*4;
  source[i]=190;source[i+1]=200;source[i+2]=210;source[i+3]=255;
  reduced[(n*4+n)*4+3]=50;
}
preserveThinSpriteDetails(source,12,12,reduced,4,4,1,1);
for(let n=0;n<4;n++)assert.ok(reduced[(n*4+n)*4+3]>=192);
console.log('PASS Candidate Rev 119: equipment-model pose alignment, regeneration hooks and thin pixel coverage');
