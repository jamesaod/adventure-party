import assert from 'node:assert/strict';
import fs from 'node:fs';

const renderer=fs.readFileSync(new URL('../js/combat-mob-renderer.mjs', import.meta.url),'utf8');
const recipe=fs.readFileSync(new URL('../js/combat-pose-recipe.mjs', import.meta.url),'utf8');
const game=fs.readFileSync(new URL('../js/adventure-party.js', import.meta.url),'utf8');
const studio=fs.readFileSync(new URL('../js/3d-studio.mjs', import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html', import.meta.url),'utf8');
const studioHtml=fs.readFileSync(new URL('../3d-studio.html', import.meta.url),'utf8');

for(const token of [
  "const POSES=['ready','attack','prone']",
  "recipe.renderSettings?.frame",
  "recipe.renderSettings?.transform",
  "placement.position.fromArray",
  "calibration.rotation.y",
  "upAxisGroup.rotation.x",
  "recipe.poseProfile",
  "poseProfileForHumanoid",
  "recipe?.model?.url",
  "for(const facing of HEX_FACINGS)",
  "appearanceCacheKey(recipe)",
  "createWeaponAttachment",
  "recipe.equipment.studioId||recipe.equipment.appearanceId",
  "resolveCombatWeaponMount",
  "createShieldAttachment",
  "loadGltf('../'+recipe.shield.asset)",
  "recipe.shield",
  "recipe.renderSettings?.shield",
  "distanceInches",
  "forearmSlideInches",
  "forearmRollDegrees",
  "shieldAppearanceId",
  "quantizeRgba(source,width,height,image.data",
  "imageSmoothingQuality='high'",
  "runtimeImages",
  "renderer:'supersampled-battlefield-v2'",
  "generatedAtRuntime:true"
]) assert.ok(renderer.includes(token), `runtime renderer missing ${token}`);

for(const token of [
  "loadStudioWorkspace({ fromCombat })",
  "workspace.captures",
  "capture.clip",
  "capture.time",
  "Studio's saved capture workspace is the authoritative pose recipe",
  "Captured PNG pixels are deliberately ignored",
  "shield: structuredClone"
]) assert.ok(recipe.includes(token), `capture recipe missing ${token}`);

assert.ok(game.includes('markMobAppearanceDirty(player,{reason:"combat-start"})'));
assert.ok(game.includes('moduleUrl("js/mob-appearance-runtime.mjs?v=R238C97")'));
assert.ok(game.includes('moduleUrl("js/combat-mob-renderer.mjs?v=R238C125")'));
assert.ok(game.includes('new URL("js/combat-pose-recipe.mjs?v=R238C125",document.baseURI)'));
assert.ok(!renderer.includes('const flipped=new Uint8Array'), 'runtime renderer must not pre-flip before quantizeRgba');
assert.ok(!game.includes('import("./js/combat-mob-renderer.mjs'));
assert.ok(game.includes('unit.appearanceRefreshPromise=pending'));
assert.ok(game.includes('HUMANOID_RUNTIME_MODELS'));
assert.ok(game.includes('runtime.ensure(unit'));
assert.ok(game.includes('queueHumanoidPresentationReconcile'));
assert.ok(renderer.includes("const manifestId=`${recipe.mob?.type||'humanoid'}-live-${keyId}`"));
assert.ok(game.includes('await pending'));
assert.ok(game.includes('poseProfile:captured.poseProfile'));
assert.ok(game.includes("renderer:'supersampled-battlefield-v2'"),
  'Equipment refresh must version and request the supersampled battlefield renderer');
assert.ok(renderer.includes("battlefieldCanvas=quantizedCanvas(") &&
  renderer.includes("reducedCtx.imageSmoothingQuality='high'"),
  'Dynamic equipment renderer must downsample before VGA quantization');
assert.ok(renderer.includes("runtimeImages[runtimeFile]=await loadImage(runtimeSrc)"),
  'Dynamic equipment renderer returns dedicated native combat images');
assert.ok(game.includes('window.adventurePartySpriteSets?.register(result.spriteSet)'));
assert.ok(game.includes('unit.dynamicAppearanceSpriteSetId=spriteSetId'));
assert.ok(studio.includes('clipSourceId: animationSourceId'));
assert.ok(studio.includes('state.previewReferenceBounds'));
assert.ok(studio.includes('shieldEquipment'));
assert.ok(studio.includes('distanceInches'));
assert.ok(studio.includes('forearmSlideInches'));
assert.ok(studio.includes('forearmRollDegrees'));
for(const id of ['studioShieldScale','studioShieldDistance','studioShieldForearmSlide','studioShieldForearmRoll','studioResetShieldButton']){
  assert.ok(studioHtml.includes(`id="${id}"`), `Studio shield control missing ${id}`);
}
assert.ok(studio.includes('renderFallbackPreviews'));
assert.ok(studio.includes("ctx.strokeStyle = '#e3ca79'"));
assert.ok(index.includes('<script type="importmap">'));
assert.ok(index.includes('"three": "./assets/vendor/three/three.module.min.js"'));
console.log('PASS captured-pose combat generation, upright runtime frames, weapon/shield refresh and Studio QA integration');
