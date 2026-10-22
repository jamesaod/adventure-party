import assert from 'node:assert/strict';
import fs from 'node:fs';

const renderer=fs.readFileSync(new URL('../js/combat-mob-renderer.mjs', import.meta.url),'utf8');
const recipe=fs.readFileSync(new URL('../js/combat-pose-recipe.mjs', import.meta.url),'utf8');
const game=fs.readFileSync(new URL('../js/adventure-party.js', import.meta.url),'utf8');
const studio=fs.readFileSync(new URL('../js/3d-studio.mjs', import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html', import.meta.url),'utf8');

for(const token of [
  "const POSES=['ready','attack','prone']",
  "recipe.renderSettings?.frame",
  "recipe.renderSettings?.transform",
  "placement.position.fromArray",
  "calibration.rotation.y",
  "upAxisGroup.rotation.x",
  "recipe.poseProfile",
  "for(const facing of HEX_FACINGS)",
  "appearanceCacheKey(recipe)",
  "createWeaponAttachment",
  "carl-live-",
  "generatedAtRuntime:true"
]) assert.ok(renderer.includes(token), `runtime renderer missing ${token}`);

for(const token of [
  "loadStudioWorkspace()",
  "workspace.captures",
  "capture.clip",
  "capture.time",
  "Studio's saved capture workspace is the authoritative pose recipe",
  "Captured PNG pixels are deliberately ignored"
]) assert.ok(recipe.includes(token), `capture recipe missing ${token}`);

assert.ok(game.includes('markMobAppearanceDirty(player,{reason:"combat-start"})'));
assert.ok(game.includes('unit.appearanceRefreshPromise=pending'));
assert.ok(game.includes('await pending'));
assert.ok(game.includes('poseProfile:captured.poseProfile'));
assert.ok(game.includes('renderSettings:captured.renderSettings'));
assert.ok(game.includes('window.adventurePartySpriteSets?.register(result.spriteSet)'));
assert.ok(game.includes('unit.dynamicAppearanceSpriteSetId=spriteSetId'));
assert.ok(studio.includes('clipSourceId: animationSourceId'));
assert.ok(studio.includes('state.previewReferenceBounds'));
assert.ok(studio.includes('renderFallbackPreviews'));
assert.ok(studio.includes("ctx.strokeStyle = '#e3ca79'"));
assert.ok(index.includes('<script type="importmap">'));
assert.ok(index.includes('"three": "./assets/vendor/three/three.module.min.js"'));
console.log('PASS captured-pose combat generation, equipment refresh and Studio QA integration');
