import assert from 'node:assert/strict';
import fs from 'node:fs';

const renderer=fs.readFileSync(new URL('../js/combat-mob-renderer.mjs', import.meta.url),'utf8');
const game=fs.readFileSync(new URL('../js/adventure-party.js', import.meta.url),'utf8');
const studio=fs.readFileSync(new URL('../js/3d-studio.mjs', import.meta.url),'utf8');

for(const token of [
  "const WIDTH=320, HEIGHT=400",
  "['ready','stand']",
  "['attack','attack']",
  "['prone','prone']",
  "for(const facing of HEX_FACINGS)",
  "appearanceCacheKey(recipe)",
  "createWeaponAttachment",
  "carl-live-",
  "generatedAtRuntime:true"
]) assert.ok(renderer.includes(token), `runtime renderer missing ${token}`);

assert.ok(game.includes('refreshCombatMobAppearance(unit,requestedRevision)'));
assert.ok(game.includes('window.adventurePartySpriteSets?.register(result.spriteSet)'));
assert.ok(game.includes('unit.dynamicAppearanceSpriteSetId=spriteSetId'));
assert.ok(game.includes('if(!result.applied || (unit.appearanceRevision||0)!==requestedRevision) return;'));
assert.ok(studio.includes('state.previewReferenceBounds'));
assert.ok(studio.includes('renderFallbackPreviews'));
assert.ok(studio.includes("'orc-shaman': 'assets/sprites/orc-shaman-stand.png'"));
assert.ok(studio.includes('if (!state.spriteOnlyFallback)'));
console.log('PASS combat on-the-fly appearance and Studio QA integration');
