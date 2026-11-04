import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createSpriteSetManifest, SPRITE_DIRECTIONS, SPRITE_POSES } from "../js/sprite-set-core.mjs";
import { SPRITE_LAYOUTS } from "../js/sprite-layouts.mjs";

// Exercise the production pose resolver and draw path without booting audio,
// terrain, or the DOM. Images and the clock are the only inputs replaced here.
const source = fs.readFileSync(new URL("../js/adventure-party.js", import.meta.url), "utf8");
function productionFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing production function: ${name}`);
  const end = source.indexOf("\n}", start);
  assert.ok(end > start, `Unterminated production function: ${name}`);
  return source.slice(start, end + 2);
}
const facingNames = ["E", "NE", "NW", "W", "SW", "SE"];
const vectors = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const HEX_DIRS = facingNames.map((name, i) => ({ name, x: vectors[i][0], y: vectors[i][1] }));
const image = id => ({ id, complete: true, naturalWidth: 160, naturalHeight: 200 });
const ready = Object.fromEntries(facingNames.map(name => [name, {
  image: image(`ready-${name}`), assetId: `test-ready-${name.toLowerCase()}`
}]));
const legacyReady = image("legacy-ready");
const legacyAttack = image("legacy-attack");
const legacyProne = image("legacy-prone");
const definition = {
  defaultPose: "stand", actionPose: "attack", actionDurationMs: 1000,
  nativeFacing: "right", sprites: {}, directionalSprites: { stand: ready, attack: {} }
};
let now = 0;
const timers = [];
const scales = [];
const draws = [];
const translations = [];
const framedAsset = {
  spec: { preserveFrame: true, workspaceWidth: 160, workspaceHeight: 200, anchorX: 80, anchorY: 150,
    renderWidth: 48, renderHeight: 60, nativeFacing: "right" },
  editCanvas: { width: 160, height: 200 }, runtimeAnchor: null
};
const legacyProneAsset = { spec: { renderWidth: 35, renderHeight: 18, nativeFacing: "right" } };
const registeredAssets = [];
const sandbox = {
  HEX_DIRS,
  UNIT_FOOTPRINTS: SPRITE_LAYOUTS,
  STUDIO_FOOTPRINTS: new Map(),
  UNIT_DEFAULT_ACTION_POSE_MS: 1000,
  UNIT_POSE_DEFINITIONS: {
    "test-six": definition,
    kobold: {
      defaultPose: "stand", actionPose: "attack", actionDurationMs: 1000,
      nativeFacing: "right", sprites: { stand: legacyReady, attack: legacyAttack, prone: legacyProne }
    }
  },
  performance: { now: () => now },
  setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
  game: {}, draw: () => {},
  combatAwaitingStart: false, selectedMobEncounter: "studio-kobold", currentScreen: "launcher",
  registeredStudioSpriteSets: new Map(), pixelEditorAssets: registeredAssets,
  prepareCrispPixelSprite() {}, renderPixelAssetList() {},
  document: { dispatchEvent() {} }, Event,
  getPixelEditorAsset: id => registeredAssets.find(asset => asset.id === id) || (id === "full-frame" || id?.startsWith("test-ready-")
    ? framedAsset : id === "kobold-prone" ? legacyProneAsset : null),
  getUnitEffect: (unit, name) => unit?.effects?.[name] || null,
  enlargeVisualScale: () => 1,
  activeEnlargeTransitionFx: () => null,
  activeCastingGlowFx: () => null,
  koboldSprite: legacyReady, koboldProneSprite: legacyProne,
  hexCenter: () => ({ x: 100, y: 200 }), drawHpBar: () => {}, drawActiveHex: () => {},
  console,
  ctx: {
    save() {}, restore() {}, beginPath() {}, arc() {}, ellipse() {}, fill() {},
    translate: (...args) => translations.push(args),
    scale: (...args) => scales.push(args),
    drawImage: (...args) => draws.push(args)
  }
};
const names = [
  "facingDirectionIndex", "hexDistance", "hexDirectionIndexToward", "updateFacingForStep",
  "unitFootprintDefinition",
  "unitPoseDefinition", "unitPoseSupportsPose", "directionalUnitPoseFrame",
  "shouldUseKoboldPronePose", "activeUnitPoseName", "unitPoseSprite",
  "setTemporaryUnitPose", "triggerUnitAttackPose", "pixelAssetIdForUnitPose", "drawSpriteFacing",
  "runtimeAnchorForAsset", "trimmedRuntimeCanvasForAsset", "unitPoseNativeFacing",
  "getSpriteAssetSpec", "spriteRenderDimensions", "registerStudioSpriteSet", "inspectStudioSpritePose",
  "clampNumber", "updatePixelPropertiesUi", "readPixelPropertiesFromUi"
];
vm.createContext(sandbox);
vm.runInContext(names.map(productionFunction).join("\n"), sandbox);

const unit = { type: "kobold", spriteSetId: "test-six", alive: true, facing: "left", facingHex: 0, x: 0, y: 0 };
for (let i = 0; i < 6; i++) {
  unit.facingHex = i;
  const frame = sandbox.directionalUnitPoseFrame(unit);
  assert.equal(frame.image, ready[facingNames[i]].image, `Ready facing ${facingNames[i]}`);
  assert.equal(sandbox.pixelAssetIdForUnitPose(unit), ready[facingNames[i]].assetId);
  assert.equal(sandbox.unitPoseSprite(unit, legacyReady), ready[facingNames[i]].image);
  scales.length = 0;
  draws.length = 0;
  sandbox.drawSpriteFacing(frame.image, { x: 0, y: 0 }, 40, 50, "left", "right", unit);
  assert.equal(scales.length, 0, `Directional ${facingNames[i]} must not be mirrored`);
  assert.equal(draws[0][0], frame.image);
  sandbox.updateFacingForStep(unit, ...vectors[i]);
  assert.equal(unit.facingHex, i, `Moving ${facingNames[i]} selects its own frame`);
}

// An action timer is real even before action artwork exists. It keeps the
// matching ready image and never borrows another direction or legacy artwork.
unit.facingHex = 1;
assert.equal(sandbox.triggerUnitAttackPose(unit), true);
assert.equal(sandbox.activeUnitPoseName(unit), "attack");
assert.equal(sandbox.unitPoseSprite(unit, legacyAttack), ready.NE.image);
definition.directionalSprites.attack.E = { image: image("action-E"), assetId: "test-action-e" };
assert.equal(sandbox.unitPoseSprite(unit), ready.NE.image);
definition.directionalSprites.attack.NE = { image: image("action-NE"), assetId: "test-action-ne" };
const actionNE = definition.directionalSprites.attack.NE.image;
actionNE.complete = false;
assert.equal(sandbox.unitPoseSprite(unit), ready.NE.image, "Loading action falls back to matching ready");
actionNE.complete = true;
actionNE.naturalWidth = 0;
assert.equal(sandbox.unitPoseSprite(unit), ready.NE.image, "Failed action falls back to matching ready");
actionNE.naturalWidth = 160;
assert.equal(sandbox.unitPoseSprite(unit), actionNE, "Available action uses matching facing");
assert.equal(sandbox.pixelAssetIdForUnitPose(unit), "test-action-ne");
now = 200;
sandbox.triggerUnitAttackPose(unit);
now = 1020;
timers[0].callback();
assert.equal(sandbox.activeUnitPoseName(unit), "attack", "Older timer cannot cancel a newer action");
now = 1220;
timers[1].callback();
assert.equal(sandbox.activeUnitPoseName(unit), "stand");
assert.equal(sandbox.unitPoseSprite(unit), ready.NE.image);
scales.length = 0;
sandbox.drawSpriteFacing(actionNE, { x: 0, y: 0 }, 48, 60, "left", "right", unit);
assert.equal(scales.length, 0, "Action expiring between image selection and drawing must not mirror the selected frame");

ready.NE.image.complete = false;
assert.equal(sandbox.unitPoseSprite(unit, legacyReady), null, "No loaded matching frame must not borrow other artwork");
ready.NE.image.complete = true;
unit.effects = { sleep: {} };
assert.equal(sandbox.unitPoseSprite(unit), ready.NE.image, "No prone art must retain the character's own image");

// Existing single-view characters retain their ready/action/prone selection
// and left/right mirroring; the new path is opt-in through the sprite set.
const legacy = { type: "kobold", alive: true, facing: "left", facingHex: 3 };
assert.equal(sandbox.directionalUnitPoseFrame(legacy), null);
assert.equal(sandbox.unitPoseSprite(legacy), legacyReady);
sandbox.triggerUnitAttackPose(legacy);
assert.equal(sandbox.unitPoseSprite(legacy), legacyAttack);
legacy.effects = { prone: {} };
assert.equal(sandbox.unitPoseSprite(legacy), legacyProne);
scales.length = 0;
sandbox.drawSpriteFacing(legacyReady, { x: 0, y: 0 }, 27, 28, "left", "right", legacy);
assert.deepEqual(scales, [[-1, 1]]);
assert.equal(sandbox.unitPoseSprite({ type: "unknown" }, legacyReady), legacyReady);

// Pixel Editor Apply must keep the same complete source frame and calibrated
// ground anchor, so changing one facing cannot change its scale or baseline.
const framedRuntime = sandbox.trimmedRuntimeCanvasForAsset(framedAsset);
assert.equal(framedRuntime.canvas, framedAsset.editCanvas);
assert.equal(framedRuntime.anchor.x, 0.5);
assert.equal(framedRuntime.anchor.y, 0.75);
assert.equal(sandbox.runtimeAnchorForAsset("full-frame").y, 0.75);
assert.equal(sandbox.runtimeAnchorForAsset("legacy").y, 1);

// The later R221 script replaces drawKobold and the asset mapper in the real
// page. Run its production prone adapter too: sleep/prone must not squash a
// directional ready frame into the old 35x18 prone image's dimensions.
const proneAdapter = fs.readFileSync(new URL("../js/r221-prone-cloud-shapes.js", import.meta.url), "utf8");
const cloudStart = proneAdapter.indexOf("\nfunction r221FogCellKey(");
assert.ok(cloudStart > 0, "Missing R221 prone/cloud boundary");
vm.runInContext(proneAdapter.slice(0, cloudStart), sandbox);
unit.facingHex = 3;
for (const effect of ["sleep", "unconscious", "prone"]) {
  unit.effects = { [effect]: {} };
  assert.equal(sandbox.pixelAssetIdForUnitPose(unit, "prone"), ready.W.assetId);
  draws.length = scales.length = translations.length = 0;
  sandbox.drawKobold(unit);
  assert.equal(draws[0][0], ready.W.image);
  assert.deepEqual(draws[0].slice(1), [-24, -45, 48, 60], `${effect} must retain the directional frame size and anchor`);
  assert.ok(translations.some(([x, y]) => x === 100 && y === 203));
  assert.equal(scales.some(([x]) => x < 0), false);
}
draws.length = translations.length = 0;
sandbox.drawKobold(legacy);
assert.equal(draws[0][0], legacyProne);
assert.deepEqual(draws[0].slice(-2), [35, 18]);
assert.ok(translations.some(([x, y]) => x === 100 && y === 210));

// A complete folder-backed character registers all eighteen frames in one call.
// Bad or still-loading inputs cannot replace half of an existing set.
const manifest = createSpriteSetManifest({
  id: "test-package", label: "Package test", frame: {
    width: 160, height: 200, renderWidth: 48, renderHeight: 60, anchorX: 80, anchorY: 145
  },
  captures: Object.fromEntries(SPRITE_POSES.map(pose => [pose, { clip: pose, time: 0.5 }]))
});
const images = {}, sourceUrls = {};
for (const pose of SPRITE_POSES) {
  for (const facing of SPRITE_DIRECTIONS) {
    const file = manifest.poses[pose].frames[facing];
    images[file] = image(`${pose}-${facing}`);
    sourceUrls[file] = `assets/sprites/test-package/${file}`;
  }
}
const setId = sandbox.registerStudioSpriteSet({ manifest, images, sourceUrls });
assert.equal(setId, "sprite-set:test-package");
assert.equal(registeredAssets.length, 18);
assert.equal(sandbox.registeredStudioSpriteSets.get(setId).label, "Package test");
const registeredDefinition = sandbox.UNIT_POSE_DEFINITIONS[setId];
const brokenImages = { ...images, "attack-nw.png": { ...images["attack-nw.png"], naturalWidth: 0 } };
assert.throws(() => sandbox.registerStudioSpriteSet({ manifest, images: brokenImages, sourceUrls }), /dimensions/);
assert.equal(sandbox.UNIT_POSE_DEFINITIONS[setId], registeredDefinition);
assert.equal(registeredAssets.length, 18);

const imported = { type: "kobold", spriteSetId: setId, alive: true, facing: "left", facingHex: 0, studioSpriteTest: true };
for (let facingIndex = 0; facingIndex < 6; facingIndex++) {
  imported.facingHex = facingIndex;
  const facing = SPRITE_DIRECTIONS[facingIndex];
  for (const condition of [null, "prone", "sleep", "unconscious"]) {
    imported.effects = condition ? { [condition]: {} } : {};
    const expectedPose = condition ? "prone" : "ready";
    const selected = sandbox.directionalUnitPoseFrame(imported);
    assert.equal(selected.image, images[`${expectedPose}-${facing.toLowerCase()}.png`]);
    draws.length = scales.length = 0;
    sandbox.drawKobold(imported);
    assert.equal(draws[0][0], selected.image);
    assert.deepEqual(draws[0].slice(1), [-24, -44, 48, 60], "All poses retain frame size and 145/200 anchor");
    assert.equal(scales.some(([x]) => x < 0), false);
  }
}
imported.effects = { prone: {} };
imported.type = "fighter";
assert.equal(sandbox.activeUnitPoseName(imported), "prone", "Directional prone status applies to non-Kobold characters too");
imported.type = "kobold";
imported.effects = {};
sandbox.game = { enemies: [imported] };
assert.equal(sandbox.inspectStudioSpritePose("prone"), false, "Inspection cannot override live combat");
sandbox.combatAwaitingStart = true;
assert.equal(sandbox.inspectStudioSpritePose("attack"), true);
assert.equal(sandbox.activeUnitPoseName(imported), "attack");
assert.deepEqual(imported.effects, {}, "Inspection changes no game effects");
assert.equal(sandbox.inspectStudioSpritePose("prone"), true);
assert.equal(sandbox.activeUnitPoseName(imported), "prone");
sandbox.combatAwaitingStart = false;
assert.equal(sandbox.activeUnitPoseName(imported), "stand", "Inspection is ignored as soon as combat starts");
sandbox.combatAwaitingStart = true;
assert.equal(sandbox.inspectStudioSpritePose("live"), true);
assert.equal(sandbox.activeUnitPoseName(imported), "stand");
assert.equal(sandbox.runtimeAnchorForAsset("sprite-set-test-package-prone-e").y, 145 / 200);

// A 5% model-size step can produce fractional game dimensions. Registration
// and Pixel Editor Apply's property read must preserve those exact dimensions;
// the already-scaled manifest must not be scaled again at runtime.
const scaledManifest = createSpriteSetManifest({
  id: "scaled-package", label: "Scaled package", modelScalePercent: 105,
  layout: { id: "single", resolutionPercent: 100 },
  frame: { width: 160, height: 200, renderWidth: 50.4, renderHeight: 63, anchorX: 80, anchorY: 145 },
  captures: Object.fromEntries(SPRITE_POSES.map(pose => [pose, { clip: pose, time: 0.5 }]))
});
const scaledId = sandbox.registerStudioSpriteSet({ manifest: scaledManifest, images, sourceUrls });
assert.equal(sandbox.registeredStudioSpriteSets.get(scaledId).modelScalePercent, 105);
const scaledAsset = registeredAssets.find(asset => asset.id === "sprite-set-scaled-package-prone-e");
assert.equal(sandbox.spriteRenderDimensions(scaledAsset.id, scaledAsset.gameImage).width, 50.4);
Object.assign(sandbox, {
  pixelEditorAsset: scaledAsset, PIXEL_EDITOR_GRID_SIZE: 64, updatePixelSourceScaleUi() {},
  pixelSourceWidth: {}, pixelSourceHeight: {}, pixelWorkspaceWidth: {}, pixelWorkspaceHeight: {},
  pixelRenderWidth: {}, pixelRenderHeight: {}, pixelAnchorX: {}, pixelAnchorY: {},
  pixelScaleMode: {}, pixelLockAspect: {}
});
sandbox.updatePixelPropertiesUi();
assert.equal(sandbox.pixelRenderWidth.step, "any");
assert.equal(sandbox.pixelRenderHeight.step, "any");
sandbox.readPixelPropertiesFromUi();
assert.equal(scaledAsset.spec.renderWidth, 50.4);
assert.equal(scaledAsset.spec.renderHeight, 63);
assert.equal(scaledAsset.spec.anchorY, 145);
sandbox.pixelRenderWidth.value = "52.8";
sandbox.readPixelPropertiesFromUi({ renderChanged: "width" });
assert.equal(scaledAsset.spec.renderWidth, 52.8);
assert.ok(Math.abs(scaledAsset.spec.renderHeight - 66) < 1e-10, "Aspect-locked resizing preserves fractional precision");
sandbox.pixelRenderWidth.value = "not-a-number";
sandbox.readPixelPropertiesFromUi();
assert.equal(scaledAsset.spec.renderWidth, 52.8, "Invalid dimensions retain the last finite value");
sandbox.pixelEditorAsset = { spec: { ...scaledAsset.spec, preserveFrame: false, renderWidth: 50.4, renderHeight: 63.6 } };
sandbox.updatePixelPropertiesUi();
assert.equal(sandbox.pixelRenderWidth.step, "1");
sandbox.readPixelPropertiesFromUi();
assert.equal(sandbox.pixelEditorAsset.spec.renderWidth, 50);
assert.equal(sandbox.pixelEditorAsset.spec.renderHeight, 64, "Legacy sprite dimensions retain integer rounding");

console.log("Directional sprites: six facings, action fallback/timers, no-mirror expiry race, frame anchors, R221 prone presentation, legacy poses, atomic eighteen-frame registration, directional prone conditions, initial-only pose inspection, and fractional model-size preservation passed.");
