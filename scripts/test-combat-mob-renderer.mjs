import assert from 'node:assert/strict';
import fs from 'node:fs';

const renderer=fs.readFileSync(new URL('../js/combat-mob-renderer.mjs', import.meta.url),'utf8');
const recipe=fs.readFileSync(new URL('../js/combat-pose-recipe.mjs', import.meta.url),'utf8');
const game=fs.readFileSync(new URL('../js/adventure-party.js', import.meta.url),'utf8');
const studio=fs.readFileSync(new URL('../js/3d-studio.mjs', import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html', import.meta.url),'utf8');
const studioHtml=fs.readFileSync(new URL('../3d-studio.html', import.meta.url),'utf8');

for(const token of [
  "const WINDUP_POSES = SPRITE_POSES;",
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
assert.ok(game.includes('moduleUrl("js/mob-appearance-runtime.mjs?v=R238C204")'));
assert.ok(game.includes('moduleUrl("js/combat-mob-renderer.mjs?v=R238C205")'));
assert.ok(game.includes('new URL("js/combat-pose-recipe.mjs?v=R238C202",document.baseURI)'));
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

// Wind Up must survive source-capture recipe building, runtime offscreen
// rendering, and generated manifest registration.
assert.ok(recipe.includes("Object.keys(captures).filter"));
assert.ok(renderer.includes("WINDUP_POSES.filter(name=>profile?.poses?.[name])"));
assert.ok(renderer.includes("for(const capture of poseNames)"));
assert.ok(renderer.includes("poseNames.map(capture=>"));
assert.ok(renderer.includes("windupDurationMs:profile?.poses?.windup"));

assert.ok(renderer.includes("recipe?.model?.animationLibrary==='uploaded-fbx'") && renderer.includes('await loadUploadedFbxAnimations('), 'Every catalog-selected uploaded-FBX model uses the same motion library in combat as Studio');
// Execute the real scene assembly on a body proxy: delayed fallback rendering
// must retain the canonical frame's 175% model / 109% hex body calibration.
const core=fs.readFileSync(new URL('../assets/vendor/three/three.core.min.js',import.meta.url));
const THREE=await import(`data:text/javascript;base64,${core.toString('base64')}`);
const bodyBuilder=new Function('THREE',`${renderer.slice(renderer.indexOf('const finite='),renderer.indexOf('function loadImage('))}\n${renderer.slice(renderer.indexOf('function buildSceneGraph('),renderer.indexOf('function configureCamera('))}\nreturn buildSceneGraph;`)(THREE);
function body(){return new THREE.Mesh(new THREE.BoxGeometry(1,2,.4),new THREE.MeshBasicMaterial());}
const fallbackBody=body(),fallbackScene=bodyBuilder(fallbackBody,{renderSettings:{}});
assert.ok(Math.abs(new THREE.Box3().setFromObject(fallbackScene,true).getSize(new THREE.Vector3()).y-3.815)<1e-6,'Fallback body must match the scale baked into the canonical camera/frame');
const explicit=bodyBuilder(body(),{renderSettings:{modelScalePercent:125,hexScalePercent:109}});
assert.ok(Math.abs(new THREE.Box3().setFromObject(explicit,true).getSize(new THREE.Vector3()).y-2.725)<1e-6,'Explicit model size is applied once');
const capturedScene=bodyBuilder(body(),{renderSettings:{modelScalePercent:125,hexScalePercent:109,transform:{placement:{scale:3,position:[0,0,0]},upAxis:'Y',heading:0}}});
assert.ok(Math.abs(new THREE.Box3().setFromObject(capturedScene,true).getSize(new THREE.Vector3()).y-8.175)<1e-6,'Studio placement must not acquire the legacy fallback factor');
console.log('PASS delayed fallback body scale and exact Studio scale preservation');
