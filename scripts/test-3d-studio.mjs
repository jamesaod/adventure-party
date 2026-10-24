import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { CAMERA_ELEVATION, HEX_FACINGS, VGA_PALETTE, quantizeRgba } from "../js/studio-core.mjs";

// Catch mirrored facings and the common error of using screen-space 60-degree
// turns instead of projecting six equally spaced world headings onto the board.
const boardVectors = [[64, 0], [32, -31.5], [-32, -31.5], [-64, 0], [-32, 31.5], [32, 31.5]];
assert.deepEqual(HEX_FACINGS.map(facing => facing.id), ["E", "NE", "NW", "W", "SW", "SE"]);
for (let i = 0; i < HEX_FACINGS.length; i++) {
  const yaw = HEX_FACINGS[i].yawRadians;
  const projected = [Math.sin(yaw) * 64, Math.cos(yaw) * Math.sin(CAMERA_ELEVATION) * 64];
  assert.ok(projected.every((v, axis) => Math.abs(v - boardVectors[i][axis]) < 1e-10), HEX_FACINGS[i].id);
}

// The new studio must use the same palette as the existing Pixel Editor.
const game = fs.readFileSync(new URL("../js/adventure-party.js", import.meta.url), "utf8");
const start = game.indexOf("const VGA_BASE_COLORS=");
const end = game.indexOf("const VGA_256_PALETTE=buildVga256Palette();", start);
assert.ok(start >= 0 && end > start);
const editorPalette = vm.runInNewContext(game.slice(start, end) + "\nbuildVga256Palette()");
assert.equal(VGA_PALETTE.length, 256);
assert.equal(JSON.stringify(VGA_PALETTE.map(rgb => "#" + rgb.map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase())), JSON.stringify(editorPalette));

// Framebuffer rows and alpha must survive readback consistently: this catches
// upside-down previews, accidental gray backgrounds in transparent exports,
// and outlines written over the subject rather than around its silhouette.
const sample = new Uint8Array(3 * 3 * 4);
sample.set([255, 0, 0, 255], 4 * 1); // top center in source memory
const rgba = quantizeRgba(sample, 3, 3, undefined, { transparent: true });
assert.deepEqual(Array.from(rgba.slice(4 * 7, 4 * 8)), [255, 0, 0, 255]);
assert.equal(rgba[4 * 1 + 3], 0);
const outlined = quantizeRgba(sample, 3, 3, undefined, { transparent: true, outline: true });
assert.deepEqual(Array.from(outlined.slice(4 * 4, 4 * 5)), [0, 0, 0, 255]);
assert.deepEqual(Array.from(outlined.slice(4 * 7, 4 * 8)), [255, 0, 0, 255]);
assert.equal(outlined[3], 0);
const opaque = quantizeRgba(sample, 3, 3);
assert.deepEqual(Array.from(opaque.slice(0, 4)), [128, 128, 128, 255]);

// Independent geometry oracle: compare every output pixel with a direct search
// of the source silhouette. This catches distance-transform errors, inward
// painting, row flips, and outlines leaking into a neighboring atlas cell.
function checkOutline(source, width, height, outline, flipY, tileWidth = width, tileHeight = height) {
  const solid = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (source[(y * width + x) * 4 + 3] >= 128) solid.push([x, y]);
  }
  for (const transparent of [false, true]) {
    const image = quantizeRgba(source, width, height, undefined, {
      outline, flipY, tileWidth, tileHeight, transparent,
      hue: 120, brightness: 1.4, contrast: 1.6, saturation: 1.5
    });
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const sourceY = flipY ? height - y - 1 : y;
      const isSolid = source[(sourceY * width + x) * 4 + 3] >= 128;
      const inOutline = solid.some(([sx, sy]) =>
        Math.floor(sx / tileWidth) === Math.floor(x / tileWidth) &&
        Math.floor(sy / tileHeight) === Math.floor(sourceY / tileHeight) &&
        (sx - x) ** 2 + (sy - sourceY) ** 2 <= outline ** 2);
      const expected = isSolid ? [0, 255, 0, 255] : inOutline ? [0, 0, 0, 255]
        : transparent ? [0, 0, 0, 0] : [128, 128, 128, 255];
      assert.deepEqual(Array.from(image.slice((y * width + x) * 4, (y * width + x + 1) * 4)), expected,
        `outline ${outline}, flip ${flipY}, pixel ${x},${y}`);
    }
  }
}
const dot = new Uint8Array(25 * 27 * 4);
dot.set([255, 0, 0, 255], (11 * 25 + 12) * 4);
dot.set([255, 0, 0, 127], 0); // Below the silhouette threshold; cannot seed an outline.
const tiled = new Uint8Array(16 * 18 * 4);
for (const [x, y] of [[7, 8], [1, 2], [4, 5], [8, 9], [15, 17], [11, 11]]) {
  tiled.set([255, 0, 0, 128], (y * 16 + x) * 4);
}
for (const outline of [0, 1, 3, 10]) for (const flipY of [false, true]) {
  checkOutline(dot, 25, 27, outline, flipY);
  // Two occupied diagonal cells and two empty cells test both boundary axes.
  checkOutline(tiled, 16, 18, outline, flipY, 8, 9);
}
for (const [input, expected] of [[true, 1], [false, 0], [-3, 0], [1000, 768], [NaN, 0], [Infinity, 0]]) {
  assert.deepEqual(
    quantizeRgba(dot, 25, 27, undefined, { outline: input, transparent: true }),
    quantizeRgba(dot, 25, 27, undefined, { outline: expected, transparent: true })
  );
}
const halfPixelOutline = quantizeRgba(sample, 3, 3, undefined, { transparent: true, outline: 0.5 });
assert.deepEqual(Array.from(halfPixelOutline.slice(4 * 4, 4 * 5)), [0, 0, 0, 128],
  'A half-pixel physical outline uses half alpha on the one-pixel edge ring');
assert.deepEqual(Array.from(halfPixelOutline.slice(4 * 3, 4 * 4)), [0, 0, 0, 0],
  'Fractional one-pixel outlines retain the original four-neighbor shape');
assert.ok(quantizeRgba(new Uint8Array(tiled.length), 16, 18, undefined,
  { outline: 10, tileWidth: 8, tileHeight: 9, transparent: true }).every(value => value === 0));
for (const options of [{ tileWidth: 0 }, { tileWidth: 3 }, { tileWidth: 1.5 }, { tileHeight: -1 }, { tileHeight: 4 }, { tileHeight: Infinity }]) {
  assert.throws(() => quantizeRgba(tiled, 16, 18, undefined, options), RangeError);
}

// Color controls operate on the subject before palette conversion. Hue follows
// the color wheel, leaves grays alone, and wraps in either direction.
const pixel = (rgb, options = {}) => Array.from(quantizeRgba(
  new Uint8Array([...rgb, 255]), 1, 1, undefined, options
)).slice(0, 3);
for (const [rgb, shifted] of [
  [[255, 0, 0], [0, 255, 0]],
  [[0, 255, 0], [0, 0, 255]],
  [[0, 0, 255], [255, 0, 0]],
]) assert.deepEqual(pixel(rgb, { hue: 120 }), shifted);
assert.deepEqual(pixel([255, 0, 0], { hue: -120 }), [0, 0, 255]);
assert.deepEqual(pixel([255, 0, 0], { hue: 480 }), [0, 255, 0]);
for (const hue of [-180, -37, 42, 180, 360]) {
  assert.deepEqual(pixel([128, 128, 128], { hue }), [128, 128, 128]);
}
assert.deepEqual(pixel([51, 0, 0], { brightness: 2 }), [102, 0, 0]);
assert.deepEqual(pixel([255, 102, 51], { brightness: 0 }), [0, 0, 0]);
assert.deepEqual(pixel([255, 102, 51], { contrast: 0 }), [128, 128, 128]);
assert.deepEqual(pixel([64, 64, 64], { contrast: 2 }), [0, 0, 0]);
assert.deepEqual(pixel([192, 192, 192], { contrast: 2 }), [255, 255, 255]);
for (const control of ["brightness", "contrast"]) {
  for (const [input, expected] of [[-1, 0], [3, 2], [NaN, 1], [Infinity, 1]]) {
    assert.deepEqual(pixel([204, 102, 51], { [control]: input }),
      pixel([204, 102, 51], { [control]: expected }));
  }
}
for (const [input, expected] of [[-1, 0], [6, 5], [NaN, 1], [Infinity, 1]]) {
  assert.deepEqual(pixel([204, 102, 51], { saturation: input }),
    pixel([204, 102, 51], { saturation: expected }));
}
assert.deepEqual(pixel([204, 102, 51], { hue: NaN }), pixel([204, 102, 51]));
assert.deepEqual(pixel([204, 102, 51], { hue: Infinity }), pixel([204, 102, 51]));
const adjusted = { brightness: 1.4, hue: 120, contrast: 1.6, saturation: 1.5, outline: true };
const adjustedTransparent = quantizeRgba(sample, 3, 3, undefined, { ...adjusted, transparent: true });
assert.deepEqual(Array.from(adjustedTransparent.slice(4 * 4, 4 * 5)), [0, 0, 0, 255]);
assert.deepEqual(Array.from(adjustedTransparent.slice(4 * 7, 4 * 8)), [0, 255, 0, 255]);
assert.deepEqual(Array.from(adjustedTransparent.slice(0, 4)), [0, 0, 0, 0]);
assert.deepEqual(Array.from(quantizeRgba(sample, 3, 3, undefined, adjusted).slice(0, 4)), [128, 128, 128, 255]);

// Color and outline processing may never create colors outside the shared
// palette, even for an arbitrary input image with partial transparency.
const gradient = new Uint8Array(64 * 64 * 4);
for (let p = 0; p < gradient.length; p += 4) {
  gradient[p] = p * 13 % 256;
  gradient[p + 1] = Math.floor(p / 7) % 256;
  gradient[p + 2] = Math.floor(p / 31) % 256;
  gradient[p + 3] = Math.floor(p / 4) % 256;
}
const allowed = new Set(VGA_PALETTE.map(rgb => rgb.join(",")));
for (const saturation of [0, 1, 1.8, 5]) {
  assert.deepEqual(
    quantizeRgba(gradient, 64, 64, undefined, { saturation, outline: true }),
    quantizeRgba(gradient, 64, 64, undefined, { saturation, outline: true, brightness: 1, hue: 0, contrast: 1 })
  );
}
const unadjustedAlpha = quantizeRgba(gradient, 64, 64, undefined, { outline: true, transparent: true });
for (const options of [
  { saturation: 0 }, { saturation: 1 }, { saturation: 1.8 }, { saturation: 5 },
  { brightness: 0, contrast: 0, hue: -180 },
  { brightness: 2, contrast: 2, saturation: 2, hue: 180 },
  adjusted,
]) {
  const image = quantizeRgba(gradient, 64, 64, undefined, { ...options, outline: true });
  const transparentImage = quantizeRgba(gradient, 64, 64, undefined, { ...options, outline: true, transparent: true });
  for (let p = 0; p < image.length; p += 4) {
    assert.ok(allowed.has(`${image[p]},${image[p + 1]},${image[p + 2]}`));
    assert.equal(image[p + 3], 255);
    assert.equal(transparentImage[p + 3], unadjustedAlpha[p + 3]);
  }
}
const studioSource=fs.readFileSync(new URL("../js/3d-studio.mjs",import.meta.url),"utf8");
const studioCaptureSource=fs.readFileSync(new URL("../js/studio-capture.mjs",import.meta.url),"utf8");
const studioHtml=fs.readFileSync(new URL("../3d-studio.html",import.meta.url),"utf8");
assert.ok(studioHtml.includes('id="studioAnimationFiles"')&&studioHtml.includes('id="studioLoadAnimationButton"'),
  'Studio exposes a separate humanoid FBX animation importer');
assert.ok(studioSource.includes("from './mixamo-retarget.mjs?v=R238C113'")&&studioSource.includes('function loadAnimationFiles('),
  'Studio uses the cache-busted semantic humanoid retargeter');
assert.ok(studioSource.includes('retargetHumanoidClip(THREE, clip, parsed, state.model, label)'),
  'Studio supplies both source and target rigs when retargeting');
assert.ok(studioSource.includes("Imported_") && studioSource.includes('analyzeHumanoidRig(state.model)'),
  'Imported clips receive visible names and Studio reports semantic rig analysis');
assert.ok(studioSource.includes('function loadRepositoryAnimationFamilies(') &&
  studioSource.includes("data/humanoid-animation-sources.json") &&
  studioSource.includes("repositoryAnimationFamily: familyId"),
  'Saved humanoid models can request repository animation families before Studio framing');
assert.ok(studioSource.includes("effectiveModelDefaults?.animationFamilies || []"),
  'Model-library animation families are applied on initial load and saved-workspace reopen');
assert.ok(studioHtml.includes('id="studioResolution" type="range" min="50" max="500"'),
  'Resolution control reaches 500 percent');
assert.ok(studioHtml.includes('id="studioAmbientIntensity" type="range" min="0" max="500"'),
  'Environmental lighting reaches 500 percent');
assert.ok(studioHtml.includes('id="studioSaturation" type="range" min="0" max="500"'),
  'Saturation reaches 500 percent');
assert.ok(studioSource.includes("new Option('T-Pose (height calibration)', '-1')"),
  'T-Pose is always exposed as the explicit calibration pose');
assert.ok(studioSource.includes('object.skeleton.pose()') &&
  studioSource.includes('ui.ModelScale.disabled = !state.modelReady || state.spriteOnlyFallback || state.modelLoading || state.disposed;') &&
  !studioSource.includes('!isTPoseSelected()'),
  'T-Pose still calibrates the skeleton, but model size is editable in every animation');
const scaleControlMatch=studioSource.match(/function updateModelScaleAvailability\(\) \{[\s\S]*?\n\}/);
assert.ok(scaleControlMatch,'Studio has an independent model size availability rule');
const scaleState={modelReady:true,modelLoading:false,spriteOnlyFallback:false,disposed:false,action:{name:'attack'}};
const scaleUi={ModelScale:{disabled:true,title:''}};
const updateModelScaleAvailability=new Function('state','ui',
  `${scaleControlMatch[0]}\nreturn updateModelScaleAvailability;`)(scaleState,scaleUi);
updateModelScaleAvailability();
assert.equal(scaleUi.ModelScale.disabled,false,'Animation selection must not lock the model size slider');
scaleState.action=null;
updateModelScaleAvailability();
assert.equal(scaleUi.ModelScale.disabled,false,'T-Pose also permits model size');
scaleState.modelLoading=true;
updateModelScaleAvailability();
assert.equal(scaleUi.ModelScale.disabled,true,'A model still loading cannot be scaled');
assert.ok(studioSource.includes('state.tPoseHeightFeet *= state.modelScalePercent / previousScalePercent'),
  'Changing size during animation keeps calibrated T-Pose body height in sync');
assert.ok(studioSource.includes("assets/terrain/grass-outdoors-tiles.png") &&
  studioSource.includes('function drawGrassPreviewPolygon('),
  'Pixel previews use the combat grass tile sheet inside a tactical hex');
assert.ok(studioSource.includes('function configureBattlefieldAtlas()') &&
  studioSource.includes('function renderBattlefieldAtlas()') &&
  studioSource.includes("battlefieldWidth=Math.max(1,Math.round(size.renderWidth))"),
  'Studio maintains a native battlefield atlas at rounded combat dimensions');
assert.ok(studioSource.includes("supersampleContext.putImageData(supersampleImage,0,0)") &&
  studioSource.includes("battlefieldContext.imageSmoothingQuality='high'") &&
  studioSource.includes("Downsample each facing independently BEFORE VGA quantization"),
  'Battlefield sprites are supersampled from unquantized WebGL pixels before VGA conversion');
assert.ok(studioSource.includes('function combatScreenDisplayScale()') &&
  studioSource.includes('availW/1080') && studioSource.includes('availH/600'),
  'Studio mirrors the combat battlefield canvas fitting scale for the current viewport');
assert.ok(studioSource.includes('const scale=combatScreenDisplayScale()') &&
  studioSource.includes('battlefieldWidth*scale,battlefieldHeight*scale'),
  'Pixel Preview enlarges sprite and hex together using combat-screen display zoom');
assert.ok(!studioSource.includes('const scale=1;'),
  'Pixel Preview no longer assumes internal battlefield pixels equal displayed combat CSS pixels');
assert.ok(studioSource.includes('battlefieldRaw:battlefieldSource.slice()'),
  'Captured poses retain native unquantized battlefield pixels for later style changes');
assert.equal(studioSource.split('geometryBodyBounds(normalized').length - 1, 4,
  'Model fitting measures the animated body only at rest and across sampled clips');
assert.equal(studioSource.split('geometryBounds(normalized').length - 1, 0,
  'Equipment-inclusive bounds cannot participate in model fitting');
assert.ok(!studioSource.includes('{ fit: true }') && !studioSource.includes('{fit:true}'),
  'Equipping, unequipping and resetting gear do not trigger a model refit');
assert.ok(studioHtml.includes('id="studioOutline" type="range" min="0" max="18.75" step="0.125" value="1.875"'),
  'Outline control is expressed in eighth-inch battlefield units');
assert.ok(studioSource.includes('BATTLEFIELD_PIXELS_PER_INCH = 64 / (STUDIO_FEET_PER_HEX * 12)') &&
  studioSource.includes('function outlinePixelsForTarget('),
  'Studio converts physical inches through the 10-foot / 64-pixel battlefield scale');
assert.ok(studioSource.includes('outlineInches: state.outlineInches') &&
  studioCaptureSource.includes('function physicalOutlinePixels('),
  'Saved captures retain physical outline inches and convert them for source and battlefield frames');
assert.ok(!studioSource.includes('outlineInches * state.resolutionPercent') &&
  !studioSource.includes('outlineInches*state.resolutionPercent'),
  'Resolution never directly multiplies the physical outline width');
assert.ok(studioSource.includes("['ambientIntensity', 5]"),
  'Environmental lighting normalization accepts 500 percent');
assert.ok(studioSource.includes("measuredHeightInches") && studioSource.includes("pose: 'T-Pose'"),
  'Studio records T-Pose scale and measured height as unit calibration metadata');
const equipmentUiHtml=fs.readFileSync(new URL("../3d-studio.html",import.meta.url),"utf8");
for(const id of ['studioOffHandGripAlong','studioOffHandGripAcross','studioOffHandGripDepth']){
  assert.ok(equipmentUiHtml.includes(`id="${id}"`),`Studio exposes ${id} calibration control`);
}
assert.ok(studioSource.includes("secondaryGripOffsetInches[index] = event.target.valueAsNumber"),
  'Off-hand calibration controls update persistent equipment settings');
assert.ok(studioSource.includes("changeEquipment(next,{resetPose:false})"),
  'Fine off-hand calibration does not reset the current animation pose');
console.log("3D studio: six projected facings, editor palette parity, framebuffer orientation, fractional physical outlines and color controls passed.");
