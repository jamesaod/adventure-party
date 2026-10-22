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
  "recipe.poseProfile",\n  "poseProfileForHumanoid",\n  "recipe?.model?.url",
  "for(const facing of HEX_FACINGS)",
  "appearanceCacheKey(recipe)",
  "createWeaponAttachment",
  "createShieldAttachment",
  "loadGltf('../'+recipe.shield.asset)",
  "recipe.shield",
  "recipe.renderSettings?.shield",
  "distanceInches",
  "forearmSlideInches",
  "forearmRollDegrees",
  "shieldAppearanceId",
  "quantizeRgba(raw,frame.width,frame.height,image.data",
  "carl-live-",
  "generatedAtRuntime:true"
]) assert.ok(renderer.includes(token), `runtime renderer missing ${token}`);

for(const token of [
  "loadStudioWorkspace()",
  "workspace.captures",
  "capture.clip",
  "capture.time",
  "Studio's saved capture workspace is the authoritative pose recipe",
  "Captured PNG pixels are deliberately ignored",
  "shield: structuredClone"
]) assert.ok(recipe.includes(token), `capture recipe missing ${token}`);

assert.ok(game.includes('markMobAppearanceDirty(player,{reason:"combat-start"})'));
assert.ok(game.includes('moduleUrl("js/mob-appearance-runtime.mjs?v=R238C72")'));
assert.ok(game.includes('moduleUrl("js/combat-mob-renderer.mjs?v=R238C72")'));
assert.ok(game.includes('new URL("js/combat-pose-recipe.mjs?v=R238C72",document.baseURI)'));
assert.ok(!renderer.includes('const flipped=new Uint8Array'), 'runtime renderer must not pre-flip before quantizeRgba');
assert.ok(!game.includes('import("./js/combat-mob-renderer.mjs'));
assert.ok(game.includes('unit.appearanceRefreshPromise=pending'));\nassert.ok(game.includes('HUMANOID_RUNTIME_MODELS'));\nassert.ok(game.includes('runtime.ensure(unit'));\nassert.ok(game.includes('queueHumanoidPresentationReconcile'));\nassert.ok(renderer.includes(\"const manifestId=`${recipe.mob?.type||'humanoid'}-live-${keyId}`\"));
assert.ok(game.includes('await pending'));
assert.ok(game.includes('poseProfile:captured.poseProfile'));
assert.ok(game.includes('renderSettings:captured.renderSettings'));
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
