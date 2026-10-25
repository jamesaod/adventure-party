import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createSpriteSetManifest, validateSpriteSetManifest, SPRITE_DIRECTIONS, SPRITE_POSES } from "../js/sprite-set-core.mjs";
import { SPRITE_LAYOUTS, spriteLayout, spriteMob } from "../js/sprite-layouts.mjs";

// Exercise the production pose resolver and draw path without booting audio,
// terrain, or the DOM. Images and the clock are the only inputs replaced here.
const source = fs.readFileSync(new URL("../js/adventure-party.js", import.meta.url), "utf8");
function productionFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing production function: ${name}`);
  const end = source.indexOf("\n}", start);
  assert.ok(end > start, `Unterminated production function: ${name}`);
  return source.slice(source.slice(start - 6, start) === "async " ? start - 6 : start, end + 2);
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
  selectedStudioPlayerSpriteSets: new Map(), defaultStudioPlayerSpriteSets: new Map(), selectedStudioSpriteSetId: 'studio-kobold',
  studioSpriteLoading: { state: "ready" }, cancelPendingCombatStart() {},
  prepareCrispPixelSprite() {}, renderPixelAssetList() {},
  updateCombatMobSelection() {}, showCombatConditions() {},
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
  "isStudioPlayerSpriteTarget", "configureDefaultPlayerSpriteSets", "playerSpriteSetForType", "applyPlayerSpriteSet", "studioSpriteTestUnits", "selectStudioSpriteSet",
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
assert.equal(registeredAssets.length, SPRITE_POSES.length * SPRITE_DIRECTIONS.length);
assert.equal(sandbox.registeredStudioSpriteSets.get(setId).label, "Package test");
const registeredDefinition = sandbox.UNIT_POSE_DEFINITIONS[setId];
assert.ok(registeredDefinition.directionalSprites.windup, "Four-pose sets register windup artwork");
const windupUnit = { type:"kobold",spriteSetId:setId,alive:true,facing:"right",facingHex:0 };
for (let facingIndex=0;facingIndex<SPRITE_DIRECTIONS.length;facingIndex++) {
  windupUnit.facingHex=facingIndex;
  const facing=SPRITE_DIRECTIONS[facingIndex];
  assert.equal(
    sandbox.directionalUnitPoseFrame(windupUnit,"windup").image,
    images[`windup-${facing.toLowerCase()}.png`],
    `Wind Up uses its own frame for ${facing}`
  );
}

const brokenImages = { ...images, "attack-nw.png": { ...images["attack-nw.png"], naturalWidth: 0 } };
assert.throws(() => sandbox.registerStudioSpriteSet({ manifest, images: brokenImages, sourceUrls }), /dimensions/);
assert.equal(sandbox.UNIT_POSE_DEFINITIONS[setId], registeredDefinition);
assert.equal(registeredAssets.length, SPRITE_POSES.length * SPRITE_DIRECTIONS.length);

const imported = { type: "kobold", spriteSetId: setId, alive: true, facing: "left", facingHex: 0, studioSpriteTest: true };
for (let facingIndex = 0; facingIndex < 6; facingIndex++) {
  imported.facingHex = facingIndex;
  const facing = SPRITE_DIRECTIONS[facingIndex];
  for (const condition of [null, "prone", "sleep", "unconscious"]) {
    imported.effects = condition ? { [condition]: {} } : {};
    // In this directional-frame test, sample after the Falling transition.
    imported.fallingPoseStartedAt = condition ? now-300 : null;
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
imported.fallingPoseStartedAt = now-300;
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

const nativeManifest=createSpriteSetManifest({
  id:"native-runtime",label:"Native runtime",captures:Object.fromEntries(
    SPRITE_POSES.map(pose=>[pose,{clip:pose,time:0.5}])
  ),
  frame:{width:160,height:200,renderWidth:48,renderHeight:60,anchorX:80,anchorY:145},
  battlefield:{renderer:"native-battlefield-v1",width:48,height:60,anchorX:24,anchorY:45}
});
const nativeImages={},nativeRuntimeImages={},nativeUrls={};
for(const pose of SPRITE_POSES){
  for(const facing of SPRITE_DIRECTIONS){
    const sourceName=nativeManifest.poses[pose].frames[facing];
    nativeImages[sourceName]=image(`native-source-${pose}-${facing}`);
    nativeUrls[sourceName]=`assets/sprites/native-runtime/${sourceName}`;
    const runtimeName=nativeManifest.battlefield.poses[pose].frames[facing];
    nativeRuntimeImages[runtimeName]={
      id:`native-runtime-${pose}-${facing}`,complete:true,naturalWidth:48,naturalHeight:60
    };
    nativeUrls[runtimeName]=`assets/sprites/native-runtime/${runtimeName}`;
  }
}
const nativeSetId=sandbox.registerStudioSpriteSet({
  manifest:nativeManifest,images:nativeImages,runtimeImages:nativeRuntimeImages,sourceUrls:nativeUrls
});
const nativeUnit={type:"kobold",spriteSetId:nativeSetId,alive:true,facing:"right",facingHex:0,x:0,y:0};
const nativeFrame=sandbox.directionalUnitPoseFrame(nativeUnit);
assert.equal(nativeFrame.image,nativeImages["ready-e.png"],
  "Combat uses the full-resolution captured frame rather than the low-resolution battlefield derivative");
const nativeEditorAsset=registeredAssets.find(asset=>asset.id==="sprite-set-native-runtime-ready-e");
assert.equal(nativeEditorAsset.gameImage,nativeImages["ready-e.png"],
  "Pixel Editor retains the high-resolution source image");
assert.equal(sandbox.runtimeAnchorForAsset(nativeEditorAsset.id).y,145/200,
  "Combat uses the original captured frame anchor");

// A 5% model-size step can produce fractional game dimensions. Registration
// and Pixel Editor Apply's property read must preserve those exact dimensions;
// the already-scaled manifest must not be scaled again at runtime.
const scaledManifest = createSpriteSetManifest({
  id: "scaled-package", label: "Scaled package", modelScalePercent: 105,
  layout: { id: "single", resolutionPercent: 100 },
  frame: { width: 160, height: 200, renderWidth: 50.4, renderHeight: 63, anchorX: 80, anchorY: 145 },
  captures: Object.fromEntries(SPRITE_POSES.map(pose => [pose, { clip: pose, time: 0.5 }])),
  unit: {
    type: "kobold", modelId: "test-model", modelName: "Test model",
    calibration: { pose: "T-Pose", modelScalePercent: 105, measuredHeightInches: 32 }
  }
});
const scaledId = sandbox.registerStudioSpriteSet({ manifest: scaledManifest, images, sourceUrls });
assert.equal(sandbox.registeredStudioSpriteSets.get(scaledId).modelScalePercent, 105);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.registeredStudioSpriteSets.get(scaledId).unit)), {
  type:"kobold",modelId:"test-model",modelName:"Test model",
  calibration:{pose:"T-Pose",modelScalePercent:105,measuredHeightInches:32}
}, "Combat registry retains Pixel Studio unit calibration");
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
// A 2000% seven-hex studio model keeps a 480×400 source frame while rendering
// at 2880×2400. Applying Pixel Editor properties must not shrink that metadata.
const giantAsset = { spec: { ...scaledAsset.spec,
  sourceWidth: 480, sourceHeight: 400, workspaceWidth: 480, workspaceHeight: 400,
  renderWidth: 2880, renderHeight: 2400, anchorX: 240, anchorY: 300 } };
sandbox.pixelEditorAsset = giantAsset;
sandbox.updatePixelPropertiesUi();
assert.equal(sandbox.pixelRenderWidth.max, "4096");
assert.equal(sandbox.pixelRenderHeight.max, "4096");
sandbox.readPixelPropertiesFromUi();
assert.equal(giantAsset.spec.renderWidth, 2880);
assert.equal(giantAsset.spec.renderHeight, 2400);
assert.equal(giantAsset.spec.workspaceWidth, 480);
assert.equal(giantAsset.spec.workspaceHeight, 400);
assert.equal(giantAsset.spec.anchorX, 240);
assert.equal(giantAsset.spec.anchorY, 300);
sandbox.pixelRenderHeight.value = "5000";
sandbox.readPixelPropertiesFromUi({ renderChanged: "height" });
assert.equal(giantAsset.spec.renderWidth, 4096, "Aspect-locked resizing also caps the derived dimension");
assert.ok(giantAsset.spec.renderHeight <= 4096);
assert.ok(Math.abs(giantAsset.spec.renderWidth / giantAsset.spec.renderHeight - 1.2) < 1e-12);
sandbox.pixelEditorAsset = { spec: { ...scaledAsset.spec, preserveFrame: false, renderWidth: 50.4, renderHeight: 63.6 } };
sandbox.updatePixelPropertiesUi();
assert.equal(sandbox.pixelRenderWidth.step, "1");
assert.equal(sandbox.pixelRenderWidth.max, "512");
assert.equal(sandbox.pixelRenderHeight.max, "512");
sandbox.readPixelPropertiesFromUi();
assert.equal(sandbox.pixelEditorAsset.spec.renderWidth, 50);
assert.equal(sandbox.pixelEditorAsset.spec.renderHeight, 64, "Legacy sprite dimensions retain integer rounding");
sandbox.pixelRenderWidth.value = sandbox.pixelRenderHeight.value = "600";
sandbox.readPixelPropertiesFromUi();
assert.equal(sandbox.pixelEditorAsset.spec.renderWidth, 512);
assert.equal(sandbox.pixelEditorAsset.spec.renderHeight, 512, "Legacy assets retain their existing render-size limit");

// Player-target packages bind the implemented character type. Loading order
// cannot choose a different default; explicit selection wins for that type
// even when the next selected test happens to be a monster.
for (const type of ["fighter", "ranger", "mage"]) {
  const packageFor = prefix => createSpriteSetManifest({
    id: `${prefix}-${type}`, label: `${prefix} ${type}`, mobType: type,
    frame: manifest.frame,
    captures: Object.fromEntries(SPRITE_POSES.map(pose => [pose, { clip: pose, time: 0.5 }]))
  });
  const later = sandbox.registerStudioSpriteSet({ manifest: packageFor("z"), images, sourceUrls });
  const earlier = sandbox.registerStudioSpriteSet({ manifest: packageFor("a"), images, sourceUrls });
  assert.equal(sandbox.playerSpriteSetForType(type).id, earlier);
  assert.equal(sandbox.registeredStudioSpriteSets.get(earlier).targetKind, "player");
  assert.equal(sandbox.selectStudioSpriteSet(later), true);
  assert.equal(sandbox.playerSpriteSetForType(type).id, later);
  assert.equal(sandbox.selectStudioSpriteSet(setId), true);
  assert.equal(sandbox.playerSpriteSetForType(type).id, later, "Selecting a monster does not discard a player's explicit collection");
  const character = { id: type === "fighter" ? "player" : `${type}-test`, type, faction: "player", controller: type === "ranger" ? "npc" : "player",
    alive: true, facingHex: 0, studioSpriteTest: true, effects: {}, stats: { str: 12 }, hp: 50 };
  assert.equal(sandbox.applyPlayerSpriteSet(character), character);
  assert.equal(character.spriteSetId, later);
  assert.equal(character.hp, 50);
  assert.deepEqual(character.stats, { str: 12 }, "Binding changes only sprite/footprint metadata");
  sandbox.game = type === "fighter"
    ? { player: character, allies: [], enemies: [] }
    : { player: { id: "player" }, allies: [character], enemies: [] };
  assert.equal(sandbox.studioSpriteTestUnits().length, 1);
  assert.equal(sandbox.studioSpriteTestUnits()[0], character);
  sandbox.combatAwaitingStart = true;
  for (let facingHex = 0; facingHex < 6; facingHex++) {
    character.facingHex = facingHex;
    for (const pose of SPRITE_POSES) {
      assert.equal(sandbox.inspectStudioSpritePose(pose), true);
      const selected = sandbox.directionalUnitPoseFrame(character);
      assert.equal(selected.image, images[`${pose}-${SPRITE_DIRECTIONS[facingHex].toLowerCase()}.png`]);
      assert.equal(selected.assetId, `sprite-set-z-${type}-${pose}-${SPRITE_DIRECTIONS[facingHex].toLowerCase()}`);
    }
  }
  sandbox.combatAwaitingStart = false;
  assert.equal(sandbox.activeUnitPoseName(character), "stand", "Live combat ignores friendly inspection overrides");
  character.effects = { unconscious: {} };
  assert.equal(sandbox.activeUnitPoseName(character), "prone");
  character.effects = {};
  assert.equal(sandbox.triggerUnitAttackPose(character), true);
  assert.equal(sandbox.activeUnitPoseName(character), "attack");
}
// The published Carl package must bind in ordinary combat without selecting a
// studio encounter. A declared but unavailable default retains legacy art;
// it must not silently adopt an unrelated alphabetically earlier package.
const repositoryIndex = JSON.parse(fs.readFileSync(new URL("../data/sprite-sets.json", import.meta.url), "utf8"));
const carlBinding = repositoryIndex.sets.find(entry => entry.defaultFor === "fighter");
assert.ok(carlBinding, "Carl needs an explicit repository sprite assignment");
const carlManifest = validateSpriteSetManifest(JSON.parse(fs.readFileSync(new URL(`../${carlBinding.manifest}`, import.meta.url), "utf8")));
assert.equal(carlManifest.mobType, "fighter");
const carlImages = {}, carlUrls = {};
for (const pose of carlManifest.sheet.poses) for (const facing of SPRITE_DIRECTIONS) {
  const name = carlManifest.poses[pose].frames[facing];
  carlImages[name] = { complete: true, naturalWidth: carlManifest.frame.width, naturalHeight: carlManifest.frame.height };
  carlUrls[name] = `assets/sprites/${carlManifest.id}/${name}?v=${carlBinding.revision}`;
}
const publishedCarl = sandbox.registerStudioSpriteSet({ manifest: carlManifest, images: carlImages, sourceUrls: carlUrls });
assert.equal(sandbox.unitPoseSupportsPose(sandbox.UNIT_POSE_DEFINITIONS[publishedCarl],"windup"),false,
  "Existing three-pose Carl remains playable without a Wind Up pose");

sandbox.selectedStudioPlayerSpriteSets.delete("fighter");
sandbox.configureDefaultPlayerSpriteSets(repositoryIndex.sets);
assert.equal(sandbox.playerSpriteSetForType("fighter").id, publishedCarl, "Published Carl overrides alphabetic optional packages");
const ordinaryCarl = { id: "player", type: "fighter", alive: true, facingHex: 0, effects: {}, hp: 50 };
sandbox.selectedMobEncounter = "kobolds";
sandbox.applyPlayerSpriteSet(ordinaryCarl);
assert.equal(ordinaryCarl.spriteSetId, publishedCarl);
for (const [pose, internal] of [["ready", "stand"], ["attack", "attack"], ["prone", "prone"]]) {
  for (let facing = 0; facing < 6; facing++) {
    ordinaryCarl.facingHex = facing;
    const selected = sandbox.directionalUnitPoseFrame(ordinaryCarl, internal);
    assert.equal(selected.image, carlImages[carlManifest.poses[pose].frames[SPRITE_DIRECTIONS[facing]]]);
    assert.equal(selected.assetId, `sprite-set-${carlManifest.id}-${pose}-${SPRITE_DIRECTIONS[facing].toLowerCase()}`);
  }
}
sandbox.configureDefaultPlayerSpriteSets([{ id: "unavailable-carl", defaultFor: "fighter" }]);
assert.equal(sandbox.playerSpriteSetForType("fighter"), null, "Missing default cannot choose another fighter package");
sandbox.applyPlayerSpriteSet(ordinaryCarl);
assert.equal(ordinaryCarl.spriteSetId, undefined, "Unavailable declared default keeps the legacy renderer available");
assert.throws(() => sandbox.configureDefaultPlayerSpriteSets([{ id: "a-fighter", defaultFor: "fighter" }, { id: "z-fighter", defaultFor: "fighter" }]), /Duplicate default/);
assert.throws(() => sandbox.configureDefaultPlayerSpriteSets([{ id: "a-fighter", defaultFor: "orc" }]), /Invalid default/);
assert.equal(sandbox.defaultStudioPlayerSpriteSets.get("fighter"), "sprite-set:unavailable-carl", "Invalid defaults cannot partially change the assignment");
sandbox.configureDefaultPlayerSpriteSets(repositoryIndex.sets);
sandbox.selectStudioSpriteSet("sprite-set:a-fighter");
assert.equal(sandbox.playerSpriteSetForType("fighter").id, "sprite-set:a-fighter", "An explicit studio test may override the repository default");
sandbox.selectedStudioPlayerSpriteSets.delete("fighter");

const monster = { type: "orc", faction: "enemy" };
sandbox.applyPlayerSpriteSet(monster);
assert.deepEqual(monster, { type: "orc", faction: "enemy" }, "Player imports do not change existing monster sprite bindings");

// Exercise the actual mouse/Enter routes and runtime startup, with controllable
// network/decode completion. Factories must run only after all optional art and
// the requested draft have settled, and a cancelled start must stay cancelled.
const runtimeSource = fs.readFileSync(new URL("../js/sprite-set-runtime.mjs", import.meta.url), "utf8");
function runtimeFunction(name) {
  const start = runtimeSource.indexOf(`function ${name}(`);
  const end = runtimeSource.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start);
  return runtimeSource.slice(runtimeSource.slice(start - 6, start) === "async " ? start - 6 : start, end + 2);
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
async function flushStartup() {
  for (let i = 0; i < 16; i++) await Promise.resolve();
}
function startupHarness({ repository = [], draft = false, fetchError = false } = {}) {
  const callbacks = [], messages = [], newGames = [];
  const button = { textContent: "Begin Battle", disabled: false, handlers: {},
    addEventListener(type, listener) { this.handlers[type] = listener; }, setAttribute() {}, removeAttribute() {} };
  const conditionButton = { ...button, handlers: {}, dataset: { combatCondition: "wall" } };
  const mobButton = { ...button, handlers: {}, dataset: { mobEncounter: "orcs" } };
  const screen = () => ({ classList: { add() {}, remove() {} } });
  const repositoryWaits = new Map(repository.map(id => [id, deferred()]));
  const draftWait = deferred();
  const context = {
    currentScreen: "combat-conditions", pendingCombatStart: null, studioDraftAutoSelect: true,
    selectedCombatCondition: "grass", selectedMobEncounter: "kobolds", selectedStudioSpriteSetId: "studio-kobold",
    registeredStudioSpriteSets: new Map(), selectedStudioPlayerSpriteSets: new Map(), defaultStudioPlayerSpriteSets: new Map(),
    document: { getElementById: id => id === "beginBattleButton" ? button : null,
      querySelectorAll: selector => selector === "[data-combat-condition]" ? [conditionButton] : [mobButton],
      dispatchEvent() {} }, Event,
    setTimeout(callback, delay) { const timer = { callback, delay, active: true }; callbacks.push(timer); return timer; },
    clearTimeout(timer) { timer.active = false; }, clearInterval() {},
    stopTitleMusic() {}, stopWeatherAudio() {}, updateAudioIndicators() {}, updateCombatConditionSelection() {}, updateCombatMobSelection() {},
    fitBattleCanvas() {}, requestAnimationFrame() {}, draw() {}, syncWeatherAudio() {},
    classReportOpen: false, characterSheetOpen: false, spellCastOverlayOpen: false,
    quickCommandUnitIds: new Set(), quickCommandActive: false, quickCommandUnitId: null, quickCommandGeneration: 0, quickCommandRunning: false,
    aiTimer: null, combatOpeningSpeechDone: false, combatAwaitingStart: false, combatMessageClearTimer: null, combatMessageFlashTimer: null,
    combatMessageSequence: 0, combatMessageText: "", combatMessageTone: "normal", combatMessageHoldUntil: 0,
    audioEnabled: false, audioReady: false,
    console: { error: (...args) => messages.push(args.join(" ")) },
    location: { search: draft ? "?studioSprite=draft" : "" }, URLSearchParams, Blob,
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
    SPRITE_DIRECTIONS, SPRITE_POSES, validateSpriteSetManifest, spriteLayout, spriteMob,
    makeControls() {}, setStatus: {}, message: text => messages.push(text),
    fetch: async () => {
      if (fetchError) throw new Error("Optional sprite index unavailable");
      return { ok: true, json: async () => ({ version: 1, sets: repository.map(id => ({ id })) }) };
    },
    loadRepositorySet: async entry => {
      await repositoryWaits.get(entry.id).promise;
      const id = `sprite-set:${entry.id}`;
      context.registeredStudioSpriteSets.set(id, { id, manifestId: entry.id, mobType: "fighter", layoutId: "single" });
      return id;
    },
    loadStudioDraft: async () => ({
      manifest: { ...manifest, id: "draft-fighter", label: "Draft fighter", mobType: "fighter" },
      files: Object.fromEntries(Object.keys(images).map(name => [name, new Blob(["decoded separately"])]))
    }),
    registerSet: async metadata => {
      await draftWait.promise;
      const id = `sprite-set:${metadata.id}`;
      context.registeredStudioSpriteSets.set(id, { id, manifestId: metadata.id, mobType: metadata.mobType, layoutId: "single" });
      return id;
    },
    newGame: () => newGames.push(context.applyPlayerSpriteSet({ id: "player", type: "fighter" }))
  };
  for (const name of ["launcherScreen", "combatScreen", "combatConditionsScreen", "xpLootScreen", "pixelScreen", "spellbookScreen", "classbookScreen", "spellPreviewScreen"]) context[name] = screen();
  vm.createContext(context);
  vm.runInContext([
    ...["createStudioSpriteLoadingGate", "canAutoSelectStudioDraft", "cancelPendingCombatStart", "showCombat", "showLauncher", "showCombatConditions", "handleCombatConditionsKey",
      "selectStudioSpriteSet", "isStudioPlayerSpriteTarget", "configureDefaultPlayerSpriteSets", "playerSpriteSetForType", "applyPlayerSpriteSet"].map(productionFunction),
    runtimeFunction("start"), runtimeFunction("loadDraft")
  ].join("\n"), context);
  context.studioSpriteLoading = context.createStudioSpriteLoadingGate();
  context.api = {
    select: context.selectStudioSpriteSet,
    setDefaults: context.configureDefaultPlayerSpriteSets,
    loadingState: () => context.studioSpriteLoading.state,
    finishLoading: () => context.studioSpriteLoading.finish(),
    canAutoSelectDraft: context.canAutoSelectStudioDraft
  };
  const bindingStart = source.indexOf('document.querySelectorAll("[data-combat-condition]").forEach(button=>{\n  button.addEventListener');
  const bindingEnd = source.indexOf('document.getElementById("combatConditionsReturnButton")', bindingStart);
  assert.ok(bindingStart >= 0 && bindingEnd > bindingStart);
  vm.runInContext(source.slice(bindingStart, bindingEnd), context);
  return { context, button, conditionButton, mobButton, newGames, messages, repositoryWaits, draftWait,
    boot: () => vm.runInContext(runtimeSource.slice(runtimeSource.lastIndexOf("start().catch(")), context),
    enter: () => context.handleCombatConditionsKey({ key: "Enter", preventDefault() {} }),
    timeout: () => { assert.equal(callbacks[0].delay, 15000); callbacks[0].callback(); }
  };
}

{
  const test = startupHarness({ repository: ["z-fighter", "a-fighter"] });
  const boot = test.boot();
  test.button.handlers.click();
  test.enter();
  assert.equal(test.button.disabled, true);
  test.repositoryWaits.get("z-fighter").resolve();
  await flushStartup();
  assert.equal(test.newGames.length, 0, "Mouse and Enter cannot create Carl from the first decoded package");
  test.repositoryWaits.get("a-fighter").resolve();
  await boot;
  await flushStartup();
  assert.equal(test.newGames.length, 1, "Repeated starts share one pending request");
  assert.equal(test.newGames[0].spriteSetId, "sprite-set:a-fighter");
  assert.equal(test.button.disabled, false);
}
{
  const test = startupHarness({ draft: true });
  const boot = test.boot();
  test.enter();
  await flushStartup();
  assert.equal(test.newGames.length, 0, "Repository completion alone cannot release a pending draft");
  test.draftWait.resolve();
  await boot;
  await flushStartup();
  assert.equal(test.newGames.length, 1);
  assert.equal(test.newGames[0].spriteSetId, "sprite-set:draft-fighter", "Draft selection completes before the factory runs");
}
for (const cancel of ["title", "condition", "monster", "keyboard-condition", "pixel", "spellbook", "classbook"]) {
  const test = startupHarness({ draft: true });
  const boot = test.boot();
  test.enter();
  await flushStartup();
  if (cancel === "title") test.context.handleCombatConditionsKey({ key: "Escape", preventDefault() {} });
  if (cancel === "condition") test.conditionButton.handlers.click();
  if (cancel === "monster") test.mobButton.handlers.click();
  if (cancel === "keyboard-condition") test.context.handleCombatConditionsKey({ key: "ArrowRight", preventDefault() {} });
  const otherScreen = ["pixel", "spellbook", "classbook"].includes(cancel);
  if (otherScreen) test.context.currentScreen = cancel;
  test.draftWait.resolve();
  await boot;
  await flushStartup();
  assert.equal(test.newGames.length, 0, `${cancel} cancels queued combat`);
  assert.equal(test.context.currentScreen, cancel === "title" ? "launcher" : otherScreen ? cancel : "combat-conditions");
  assert.equal(test.context.selectedStudioSpriteSetId, "studio-kobold", "Late draft does not replace a changed setup");
  assert.equal(test.button.disabled, false);
}
{
  const test = startupHarness({ fetchError: true });
  const boot = test.boot();
  test.enter();
  await boot;
  await flushStartup();
  assert.equal(test.context.studioSpriteLoading.state, "ready", "Runtime finally releases failed optional loading");
  assert.equal(test.newGames.length, 1);
  assert.equal(test.newGames[0].spriteSetId, undefined);
}
{
  const test = startupHarness(); // The optional module never starts.
  test.enter();
  test.timeout();
  await flushStartup();
  assert.equal(test.newGames.length, 1);
  assert.equal(test.context.studioSpriteLoading.state, "timed-out");
  assert.equal(test.button.disabled, false, "Missing optional module cannot permanently lock combat");
}
{
  const test = startupHarness({ repository: ["z-fighter", "a-fighter"] });
  const boot = test.boot();
  test.enter();
  test.repositoryWaits.get("z-fighter").resolve();
  await flushStartup();
  test.timeout();
  await flushStartup();
  assert.equal(test.newGames.length, 1);
  assert.equal(test.newGames[0].spriteSetId, undefined, "Timeout does not bind a partial automatic player catalog");
  test.repositoryWaits.get("a-fighter").resolve();
  await boot;
  assert.equal(test.context.playerSpriteSetForType("fighter").id, "sprite-set:a-fighter");
  assert.equal(test.newGames[0].spriteSetId, undefined, "Late completion never rebinds a live player's footprint");
}

console.log("Directional sprites: six facings, pose/render integrity, player target binding, friendly inspection, fractional sizes, mouse/Enter readiness gating, cancellation, error recovery, bounded fallback, and no live rebinding passed.");

// A newly prone five-pose unit must present Falling first, then Prone.
const fallCheck={type:'kobold',spriteSetId:setId,alive:true,facingHex:0,effects:{prone:{}}};
assert.equal(sandbox.activeUnitPoseName(fallCheck),'falling');
assert.equal(sandbox.directionalUnitPoseFrame(fallCheck).image,images['falling-e.png']);
now+=300;
assert.equal(sandbox.activeUnitPoseName(fallCheck),'prone');
