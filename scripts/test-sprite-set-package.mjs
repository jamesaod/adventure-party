import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { deflateSync } from 'node:zlib';
import {
  SPRITE_DIRECTIONS, SPRITE_POSES, spriteSetSlug, createSpriteSetManifest,
  validateSpriteSetManifest, splitSixFacingAtlas, assembleSpriteSheet
} from '../js/sprite-set-core.mjs';
import {
  SPRITE_LAYOUT_PRESETS, SPRITE_LAYOUTS, SPRITE_LEGACY_LAYOUT_PRESETS, SPRITE_LEGACY_LAYOUTS,
  SPRITE_MOBS, SPRITE_RESOLUTION, SPRITE_MODEL_SCALE, SPRITE_HEX_SCALE_PERCENT,
  validateSpriteModelScale, validateSpriteHexScale,
  spriteLayout, spriteLayoutDimensions, spriteLayoutOffsets, spriteMob, createSpriteLayoutMetadata
} from '../js/sprite-layouts.mjs';
import {
  crc32, decodeSpritePng, readSpriteSetPackage, importSpriteSet,
  validateSpritePackage, validateSpriteSetRepository
} from './import-sprite-set.mjs';

const width = 8, height = 10;
const frame = { width, height, renderWidth: 48, renderHeight: 60, anchorX: 4, anchorY: 7.5 };
const captures = Object.fromEntries(SPRITE_POSES.map((pose, i) => [pose, { clip: `Animation ${i + 1}`, time: i + 0.25 }]));
const manifest = createSpriteSetManifest({ id: 'test-character', label: 'Test character', frame, captures });
const compressionSource = await fs.readFile(new URL('../assets/vendor/three/addons/libs/fflate.module.js', import.meta.url));
const { zipSync } = await import(`data:text/javascript;base64,${compressionSource.toString('base64')}`);

function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function rgbaPng(data, w, h, filter = 0) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  const bpp = 4, stride = w * bpp;
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = filter;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? data[y * stride + x - bpp] : 0;
      const b = y ? data[(y - 1) * stride + x] : 0;
      const c = y && x >= bpp ? data[(y - 1) * stride + x - bpp] : 0;
      let predictor = 0;
      if (filter === 1) predictor = a;
      if (filter === 2) predictor = b;
      if (filter === 3) predictor = Math.floor((a + b) / 2);
      if (filter === 4) {
        const p = a + b - c, distances = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
        predictor = [a, b, c][distances.indexOf(Math.min(...distances))];
      }
      raw[y * (stride + 1) + x + 1] = (data[y * stride + x] - predictor) & 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0); header.writeUInt32BE(h, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function fixtureFrames(w = width, h = height) {
  return Object.fromEntries(SPRITE_POSES.map((pose, row) => [pose,
    Object.fromEntries(SPRITE_DIRECTIONS.map((facing, column) => {
      const pixels = new Uint8ClampedArray(w * h * 4);
      for (let y = 2; y < h - 2; y++) {
        for (let x = 1; x < w - 1; x++) {
          pixels.set([column * 40, row * 80, ((x + y) % 25) * 10, 255], (y * w + x) * 4);
        }
      }
      return [facing, pixels];
    }))
  ]));
}

function packageFiles(metadata, frames) {
  const { width: w, height: h } = metadata.frame;
  const files = new Map([['manifest.json', Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`)]]);
  SPRITE_POSES.forEach((pose, row) => SPRITE_DIRECTIONS.forEach((facing, column) => {
    files.set(metadata.poses[pose].frames[facing], rgbaPng(frames[pose][facing], w, h, (row + column) % 5));
  }));
  const sheet = assembleSpriteSheet(frames, w, h);
  files.set(metadata.sheet.file, rgbaPng(sheet.data, sheet.width, sheet.height, 4));
  return files;
}

const frames = fixtureFrames();
const files = packageFiles(manifest, frames);
assert.equal(validateSpriteSetManifest(manifest), manifest);
assert.equal(manifest.layout, undefined, 'Rev 46 manifests keep their original shape and frame sizes');
assert.equal(manifest.mobType, undefined, 'Legacy MOB selection remains optional');
assert.equal(manifest.modelScalePercent, undefined, 'Legacy model size remains implicit without rewriting the manifest');
assert.equal(manifest.hexScalePercent, undefined, 'Old packages retain their original hex calibration');
assert.equal(spriteSetSlug('Kobold Veteran.fbx'), 'kobold-veteran');
assert.equal(spriteSetSlug('  Àrcher / Blue!  '), 'archer-blue');
assert.equal(spriteSetSlug(''), 'studio-character');
assert.throws(() => createSpriteSetManifest({ id: 'test', label: 'Test', frame, captures: {} }), /ready has not been captured/);
for (const alter of [
  value => { value.id = '../escape'; },
  value => { value.poses.attack.frames.NE = '../attack-ne.png'; },
  value => { value.poses.prone.frames.SE = value.poses.ready.frames.E; },
  value => { value.frame.width = Infinity; },
  value => { value.frame.height = 4097; },
  value => { value.frame.anchorY = -1; },
  value => { value.poses.ready.time = -0.1; },
  value => { delete value.poses.prone; },
  value => { value.facings.reverse(); },
  value => { value.sheet.rows = 6; }
]) {
  const malformed = structuredClone(manifest);
  alter(malformed);
  assert.throws(() => validateSpriteSetManifest(malformed));
}

// New work offers four formats. Removed formats remain explicit, frozen
// recovery definitions so existing exports and drafts keep their dimensions.
const expectedLayouts = {
  single: { cells: [[0, 0]], size: [160, 200, 48, 60], rows: [1] },
  wide2: { cells: [[0, 0], [1, 0]], size: [320, 200, 96, 60], rows: [2] },
  triangle3: { cells: [[0, 0], [1, 0], [1, -1]], size: [320, 280, 96, 84], rows: [1, 2] },
  'triangle3-inverted': { cells: [[0, 0], [1, 0], [0, 1]], size: [320, 280, 96, 84], rows: [2, 1] },
  hex7: { cells: [[0, 0], [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]], size: [480, 400, 144, 120], rows: [2, 3, 2] },
  trapezoid5: { cells: [[0, 0], [1, 0], [2, 0], [1, -1], [2, -1]], size: [480, 320, 144, 96], rows: [2, 3] },
  diamond4: { cells: [[0, 0], [1, 0], [1, -1], [0, 1]], size: [320, 480, 96, 144], rows: [1, 2, 1] }
};
const activeIds = ['single', 'triangle3', 'triangle3-inverted', 'hex7'];
const legacyIds = ['wide2', 'trapezoid5', 'diamond4'];
assert.deepEqual(SPRITE_LAYOUT_PRESETS.map(layout => layout.id), activeIds);
assert.deepEqual(Object.keys(SPRITE_LAYOUTS), activeIds);
assert.deepEqual(SPRITE_LEGACY_LAYOUT_PRESETS.map(layout => layout.id), legacyIds);
assert.deepEqual(Object.keys(SPRITE_LEGACY_LAYOUTS), legacyIds);
assert.ok(Object.isFrozen(SPRITE_LAYOUT_PRESETS) && Object.isFrozen(SPRITE_LAYOUTS));
assert.ok(Object.isFrozen(SPRITE_LEGACY_LAYOUT_PRESETS) && Object.isFrozen(SPRITE_LEGACY_LAYOUTS));
assert.deepEqual(SPRITE_RESOLUTION, { min: 50, max: 500, step: 5 });
assert.deepEqual(SPRITE_MODEL_SCALE, { min: 25, max: 2000, step: 5 });
assert.equal(validateSpriteModelScale(), 100);
assert.equal(SPRITE_HEX_SCALE_PERCENT, 109);
assert.equal(validateSpriteHexScale(), 100);
assert.equal(validateSpriteHexScale(100), 100);
assert.equal(validateSpriteHexScale(109), 109);
for (const invalid of [0, 99, 108, 110, 200, 109.5, NaN, Infinity, '109', null]) {
  assert.throws(() => validateSpriteHexScale(invalid), /hex scale/);
  assert.throws(() => spriteLayoutDimensions('single', 100, 100, invalid), /hex scale/);
}
for (const [id, expected] of Object.entries(expectedLayouts)) {
  const layout = spriteLayout(id);
  assert.equal(layout, SPRITE_LAYOUTS[id] || SPRITE_LEGACY_LAYOUTS[id]);
  assert.ok(Object.isFrozen(layout) && Object.isFrozen(layout.offsets) && layout.offsets.every(Object.isFrozen));
  assert.deepEqual(layout.offsets.map(({ x, y }) => [x, y]), expected.cells, `${id} pivot and cells`);
  const rowCounts = Object.entries(Object.groupBy ? Object.groupBy(layout.offsets, cell => cell.y) :
    layout.offsets.reduce((rows, cell) => { (rows[cell.y] ||= []).push(cell); return rows; }, {}))
    .sort(([a], [b]) => Number(a) - Number(b)).map(([, cells]) => cells.length);
  assert.deepEqual(rowCounts, expected.rows, `${id} diagram row arrangement`);
  for (let percent = 50; percent <= 500; percent += 5) {
    const dims = spriteLayoutDimensions(id, percent);
    assert.deepEqual(dims, {
      width: expected.size[0] * percent / 100, height: expected.size[1] * percent / 100,
      renderWidth: expected.size[2], renderHeight: expected.size[3]
    });
    assert.ok(dims.width <= 4096 && dims.height <= 4096);
    assert.equal(dims.width * expected.size[1], dims.height * expected.size[0]);
    const largerModel = spriteLayoutDimensions(id, percent, 200);
    assert.deepEqual([largerModel.width, largerModel.height], [dims.width, dims.height], 'Model size never changes source resolution');
    assert.deepEqual([largerModel.renderWidth, largerModel.renderHeight], [expected.size[2] * 2, expected.size[3] * 2]);
  }
  for (let scale = 25; scale <= 2000; scale += 5) {
    assert.equal(validateSpriteModelScale(scale), scale);
    const sized = spriteLayoutDimensions(id, 100, scale);
    assert.deepEqual([sized.width, sized.height], expected.size.slice(0, 2));
    assert.deepEqual([sized.renderWidth, sized.renderHeight], [expected.size[2] * scale / 100, expected.size[3] * scale / 100]);
  }
  const calibrated = spriteLayoutDimensions(id, 50, 2000, 109);
  assert.deepEqual(calibrated, {
    width: expected.size[0] / 2, height: expected.size[1] / 2,
    renderWidth: expected.size[2] * 2000 * 109 / 10000,
    renderHeight: expected.size[3] * 2000 * 109 / 10000
  }, 'Hex calibration changes only battlefield size, including recovered formats');
  for (let facing = 0; facing < 6; facing++) {
    const cells = spriteLayoutOffsets(id, facing);
    assert.equal(new Set(cells.map(cell => `${cell.x},${cell.y}`)).size, expected.cells.length);
    assert.ok(cells.some(cell => cell.x === 0 && cell.y === 0), 'Rotation keeps the pivot');
    if (!layout.rotates) assert.deepEqual(cells, layout.offsets);
  }
  assert.deepEqual(spriteLayoutOffsets(id, 6), layout.offsets, 'Six steps return to the original layout');
}
const expectedEToSE = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
expectedEToSE.forEach(([x, y], facing) => {
  assert.deepEqual(spriteLayoutOffsets('wide2', facing)[1], { x, y }, `${SPRITE_DIRECTIONS[facing]} footprint follows the actual facing`);
});
assert.deepEqual(spriteLayoutOffsets('wide2', -1), spriteLayoutOffsets('wide2', 5));
assert.throws(() => spriteLayoutOffsets('wide2', 0.5), /integer hex direction/);
for (const invalid of [49, 51, 505, NaN, Infinity, '100']) {
  assert.throws(() => spriteLayoutDimensions('single', invalid), /resolution/);
}
for (const invalid of [0, 24, 26, 201, 2001, 2005, 50.5, NaN, Infinity, '100', null]) {
  assert.throws(() => validateSpriteModelScale(invalid), /model scale/);
  assert.throws(() => spriteLayoutDimensions('single', 100, invalid), /model scale/);
}
assert.deepEqual(spriteLayoutDimensions('single', 200, 55), {
  width: 320, height: 400, renderWidth: 26.4, renderHeight: 33
}, 'Fractional combat sizes retain detail without rounding to whole pixels');
assert.throws(() => spriteLayout('constructor'), /Unknown sprite layout/);
assert.throws(() => spriteMob('unknown'), /Unknown sprite MOB/);
assert.deepEqual(SPRITE_MOBS.map(mob => mob.id), [
  'kobold', 'kobold-bodyguard', 'kobold-slinger', 'orc', 'orc-leader', 'orc-shaman', 'juvenile-red-dragon',
  'fighter', 'ranger', 'mage'
]);
assert.equal(spriteMob('juvenile-red-dragon').defaultLayout, 'hex7');
assert.equal(SPRITE_MOBS.filter(mob => mob.targetKind === 'monster').length, 7);
for (const id of ['fighter', 'ranger', 'mage']) {
  assert.equal(spriteMob(id).targetKind, 'player');
  assert.equal(spriteMob(id).defaultLayout, 'single');
  assert.equal(validateSpriteSetManifest({ ...manifest, mobType: id }).mobType, id);
}

const largeDimensions = spriteLayoutDimensions('diamond4', 125);
const formatManifest = createSpriteSetManifest({
  id: 'test-large-character', label: 'Test large character', captures,
  frame: { ...largeDimensions, anchorX: largeDimensions.width / 2, anchorY: largeDimensions.height * 0.75 },
  layout: createSpriteLayoutMetadata('diamond4', 125), mobType: 'orc-leader'
});
assert.equal(formatManifest.version, 1, 'New optional metadata keeps legacy schema compatibility');
assert.deepEqual(formatManifest.layout, { id: 'diamond4', resolutionPercent: 125 });
assert.equal(formatManifest.mobType, 'orc-leader');
assert.equal(formatManifest.modelScalePercent, undefined, 'Removed Rev 47 formats still validate at their original size');
const scaledDimensions = spriteLayoutDimensions('single', 200, 55);
const scaledManifest = createSpriteSetManifest({
  id: 'scaled-character', label: 'Scaled character', captures,
  frame: { ...scaledDimensions, anchorX: scaledDimensions.width / 2, anchorY: scaledDimensions.height * 0.75 },
  layout: createSpriteLayoutMetadata('single', 200), mobType: 'kobold', modelScalePercent: 55
});
assert.equal(scaledManifest.version, 1);
assert.equal(scaledManifest.modelScalePercent, 55);
assert.deepEqual(scaledManifest.frame, { width: 320, height: 400, renderWidth: 26.4, renderHeight: 33, anchorX: 160, anchorY: 300 });
for (const alter of [
  value => { value.modelScalePercent = 54; },
  value => { value.modelScalePercent = '55'; },
  value => { value.modelScalePercent = null; },
  value => { value.modelScalePercent = 25; },
  value => { delete value.modelScalePercent; },
  value => { delete value.layout; },
  value => { value.frame.renderWidth = 26; },
  value => { value.frame.renderHeight = 60; }
]) {
  const bad = structuredClone(scaledManifest); alter(bad);
  assert.throws(() => validateSpriteSetManifest(bad));
}
assert.throws(() => createSpriteSetManifest({
  id: 'scale-without-layout', label: 'Scale without layout', frame, captures, modelScalePercent: 100
}), /model scale requires layout/);
const calibratedManifest = createSpriteSetManifest({
  id: 'calibrated-character', label: 'Calibrated character', captures,
  frame: { ...spriteLayoutDimensions('hex7', 50, 150, 109), anchorX: 120, anchorY: 150 },
  layout: createSpriteLayoutMetadata('hex7', 50), mobType: 'fighter', modelScalePercent: 150,
  hexScalePercent: 109
});
assert.equal(calibratedManifest.frame.renderWidth, 235.44);
assert.equal(calibratedManifest.frame.renderHeight, 196.2);
assert.equal(calibratedManifest.hexScalePercent, 109);
const unitCalibratedManifest = createSpriteSetManifest({
  id: 'unit-calibrated-character', label: 'Unit calibrated character', captures,
  frame: { ...spriteLayoutDimensions('single', 500, 125), anchorX: 400, anchorY: 750 },
  layout: createSpriteLayoutMetadata('single', 500), mobType: 'fighter', modelScalePercent: 125,
  unit: {
    type: 'fighter', modelId: 'dungeon-crawler-carl-v2', modelName: 'Dungeon Crawler Carl',
    calibration: { pose: 'T-Pose', modelScalePercent: 125, measuredHeightInches: 76 }
  }
});
assert.equal(unitCalibratedManifest.frame.width, 800);
assert.equal(unitCalibratedManifest.frame.height, 1000);
assert.deepEqual(unitCalibratedManifest.unit.calibration,
  { pose: 'T-Pose', modelScalePercent: 125, measuredHeightInches: 76 });
for (const alter of [
  value => { value.unit.calibration.pose = 'Idle'; },
  value => { value.unit.calibration.modelScalePercent = 130; },
  value => { value.unit.calibration.measuredHeightInches = -1; },
  value => { value.unit.type = 'unknown'; }
]) {
  const bad = structuredClone(unitCalibratedManifest); alter(bad);
  assert.throws(() => validateSpriteSetManifest(bad));
}
assert.deepEqual(validateSpriteSetManifest({ ...scaledManifest, hexScalePercent: 100 }).frame, scaledManifest.frame);
const oldManifestJson = JSON.stringify(scaledManifest);
validateSpriteSetManifest(scaledManifest);
assert.equal(JSON.stringify(scaledManifest), oldManifestJson, 'Validation never migrates previously exported packages');
for (const alter of [
  value => { delete value.hexScalePercent; },
  value => { value.hexScalePercent = 100; },
  value => { value.hexScalePercent = 110; },
  value => { delete value.layout; }
]) {
  const bad = structuredClone(calibratedManifest); alter(bad);
  assert.throws(() => validateSpriteSetManifest(bad));
}
assert.throws(() => createSpriteSetManifest({
  id: 'hex-scale-without-layout', label: 'Hex scale without layout', frame, captures, hexScalePercent: 100
}), /hex scale requires layout/);
for (const alter of [
  value => { value.layout.id = 'unknown'; },
  value => { value.layout.resolutionPercent = 51; },
  value => { delete value.layout.resolutionPercent; },
  value => { value.frame.width += 1; },
  value => { value.frame.renderWidth *= 2; },
  value => { value.mobType = 'unimplemented-monster'; }
]) {
  const bad = structuredClone(formatManifest); alter(bad);
  assert.throws(() => validateSpriteSetManifest(bad));
}

// Exercise the production restore migration without opening browser storage.
// Module initialization only needs a page URL to choose its IndexedDB scope.
const previousLocation = globalThis.location;
globalThis.location = { href: 'https://example.invalid/candidate/3d-studio.html' };
const { validateStudioWorkspace, upgradeStudioWorkspaceHexScale } = await import('../js/sprite-set-store.mjs');
if (previousLocation === undefined) delete globalThis.location;
else globalThis.location = previousLocation;
const workspaceDimensions = spriteLayoutDimensions('single', 50, 150);
const oldWorkspace = {
  version: 1, name: 'Saved before calibration',
  style: { brightness: 1, contrast: 1, hue: 0, saturation: 1, outline: 0 },
  settings: { layout: createSpriteLayoutMetadata('single', 50), modelScalePercent: 150,
    frameHeight: 4, center: [1, 2, 3] },
  captures: Object.fromEntries(SPRITE_POSES.map(pose => [pose, {
    ...workspaceDimensions, raw: new Uint8Array(workspaceDimensions.width * workspaceDimensions.height * 24),
    anchorX: 40, anchorY: 75, clip: 'Saved clip', time: 0.5,
    layout: createSpriteLayoutMetadata('single', 50), modelScalePercent: 150,
    render: { frameHeight: 6, center: [1.5, 3, 4.5], modelScalePercent: 150 }
  }]))
};
const upgradedWorkspace = upgradeStudioWorkspaceHexScale(oldWorkspace);
assert.notEqual(upgradedWorkspace, oldWorkspace);
assert.equal(oldWorkspace.settings.hexScalePercent, undefined, 'Staging does not mutate the saved input');
assert.equal(upgradedWorkspace.settings.hexScalePercent, 109);
assert.equal(upgradedWorkspace.settings.frameHeight, 4, 'Workspace stores unscaled base framing');
assert.deepEqual(upgradedWorkspace.settings.center, [1, 2, 3]);
for (const pose of SPRITE_POSES) {
  const before = oldWorkspace.captures[pose], after = upgradedWorkspace.captures[pose];
  assert.equal(after.raw, before.raw, 'Calibration never copies or changes captured pixels');
  assert.equal(after.hexScalePercent, 109);
  assert.equal(after.renderWidth, 78.48);
  assert.equal(after.renderHeight, 98.1);
  assert.deepEqual([after.width, after.height, after.anchorX, after.anchorY], [80, 100, 40, 75]);
  assert.equal(after.render.frameHeight, before.render.frameHeight * 1.09);
  assert.deepEqual(after.render.center, before.render.center.map(value => value * 1.09));
}
assert.equal(upgradeStudioWorkspaceHexScale(upgradedWorkspace), upgradedWorkspace, 'Repeated restore calibrates exactly once');
assert.equal(upgradeStudioWorkspaceHexScale({ ...oldWorkspace, captures: {} }).settings.hexScalePercent, 109,
  'Empty layout-bearing workspaces also adopt the current calibration');
const legacyWorkspace = structuredClone(oldWorkspace);
delete legacyWorkspace.settings.layout;
for (const capture of Object.values(legacyWorkspace.captures)) {
  delete capture.layout;
  delete capture.modelScalePercent;
}
const recoveredLegacy = upgradeStudioWorkspaceHexScale(legacyWorkspace);
assert.equal(recoveredLegacy.settings.hexScalePercent, 100);
for (const pose of SPRITE_POSES) assert.equal(recoveredLegacy.captures[pose], legacyWorkspace.captures[pose],
  'No-layout legacy captures retain their original dimensions and pixels');
assert.equal(upgradeStudioWorkspaceHexScale(recoveredLegacy), recoveredLegacy);
assert.throws(() => validateStudioWorkspace({ ...upgradedWorkspace,
  settings: { ...upgradedWorkspace.settings, hexScalePercent: 100 } }), /does not match the workspace/);

// The six-facing legacy atlas and the 18-frame sheet use different layouts.
const atlas = new Uint8ClampedArray(width * 3 * height * 2 * 4);
SPRITE_DIRECTIONS.forEach((facing, index) => {
  for (let y = 0; y < height; y++) {
    const target = ((Math.floor(index / 3) * height + y) * width * 3 + (index % 3) * width) * 4;
    atlas.set(frames.ready[facing].subarray(y * width * 4, (y + 1) * width * 4), target);
  }
});
const split = splitSixFacingAtlas(atlas, width, height);
for (const facing of SPRITE_DIRECTIONS) assert.deepEqual(split[facing], frames.ready[facing]);
assert.throws(() => splitSixFacingAtlas(atlas, 2.5, height));
const partial = assembleSpriteSheet({ ready: split }, width, height);
assert.ok(partial.data.subarray(width * 6 * height * 4).every(byte => byte === 0), 'Uncaptured rows stay empty');
const sheet = assembleSpriteSheet(frames, width, height);
assert.equal(sheet.width, width * 6);
assert.equal(sheet.height, height * 3);
SPRITE_POSES.forEach((pose, row) => SPRITE_DIRECTIONS.forEach((facing, column) => {
  for (let y = 0; y < height; y++) {
    const start = ((row * height + y) * sheet.width + column * width) * 4;
    assert.deepEqual(sheet.data.subarray(start, start + width * 4), frames[pose][facing].subarray(y * width * 4, (y + 1) * width * 4));
  }
}));

for (let filter = 0; filter <= 4; filter++) {
  assert.deepEqual(decodeSpritePng(rgbaPng(frames.attack.NE, width, height, filter), width, height), frames.attack.NE);
}
// Indexed pixel-art PNGs retain their palette transparency as well.
const indexedHeader = Buffer.alloc(13);
indexedHeader.writeUInt32BE(8, 0); indexedHeader.writeUInt32BE(2, 4);
indexedHeader[8] = 1; indexedHeader[9] = 3;
const indexed = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', indexedHeader), chunk('PLTE', Buffer.from([0, 0, 0, 255, 51, 102])),
  chunk('tRNS', Buffer.from([0, 255])), chunk('IDAT', deflateSync(Buffer.from([0, 0b00111100, 0, 0b00011000]))),
  chunk('IEND', Buffer.alloc(0))]);
const decodedIndexed = decodeSpritePng(indexed, 8, 2);
assert.deepEqual([...decodedIndexed.slice(0, 4)], [0, 0, 0, 0]);
assert.deepEqual([...decodedIndexed.slice(2 * 4, 3 * 4)], [255, 51, 102, 255]);
assert.equal(decodedIndexed.filter((value, i) => i % 4 === 3 && value === 255).length, 6);
const brokenCrc = Buffer.from(files.get('ready-e.png'));
brokenCrc[brokenCrc.length - 5] ^= 1;
assert.throws(() => decodeSpritePng(brokenCrc, width, height), /CRC/);
assert.throws(() => decodeSpritePng(files.get('ready-e.png'), width + 1, height), /dimensions/);
const antialias = new Uint8ClampedArray(frames.ready.E);
antialias[(width * 2 + 1) * 4 + 3] = 100;
assert.throws(() => decodeSpritePng(rgbaPng(antialias, width, height), width, height), /transparency/);
assert.throws(() => decodeSpritePng(rgbaPng(new Uint8ClampedArray(width * height * 4), width, height), width, height), /visible sprite/);
const mismatched = new Map(files);
mismatched.set('prone-se.png', files.get('ready-e.png'));
assert.throws(() => validateSpritePackage(manifest, mismatched), /sheet pixels/);
const missing = new Map(files); missing.delete('attack-nw.png');
assert.throws(() => validateSpritePackage(manifest, missing), /missing attack-nw/);

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'adventure-party-sprite-package-'));
try {
  const zipPath = path.join(temp, 'character.zip');
  const zipEntries = Object.fromEntries([...files].map(([name, bytes]) => [`${manifest.id}/${name}`, bytes]));
  const zip = zipSync(zipEntries, { level: 6 });
  await fs.writeFile(zipPath, zip);
  const unpacked = await readSpriteSetPackage(zipPath);
  assert.equal(unpacked.manifest.id, manifest.id);
  assert.equal(unpacked.files.size, 20);
  for (const [name, bytes] of files) assert.deepEqual(unpacked.files.get(name), bytes);

  const root = path.join(temp, 'repo');
  await fs.mkdir(path.join(root, 'data'), { recursive: true });
  const unrelated = { id: 'existing-character', manifest: 'assets/sprites/existing-character/manifest.json', revision: 'existing' };
  await fs.writeFile(path.join(root, 'data/sprite-sets.json'), JSON.stringify({ version: 1, sets: [unrelated] }));
  const imported = await importSpriteSet(zipPath, { repoRoot: root });
  assert.equal(imported.files, 20);
  assert.match(imported.revision, /^[a-f0-9]{64}$/);
  let index = JSON.parse(await fs.readFile(imported.indexPath, 'utf8'));
  assert.deepEqual(index.sets[0], unrelated);
  assert.equal(index.sets[1].manifest, `assets/sprites/${manifest.id}/manifest.json`);
  for (const [name, bytes] of files) assert.deepEqual(await fs.readFile(path.join(imported.destination, name)), bytes);
  assert.equal((await fs.readdir(root)).includes('js'), false, 'Import creates assets and index, never game code');
  const repeated = await importSpriteSet(zipPath, { repoRoot: root });
  assert.equal(repeated.revision, imported.revision, 'Same bytes have a stable cache revision');

  const modifiedManifest = structuredClone(manifest);
  modifiedManifest.poses.ready.time = 0.75;
  const modifiedFrames = fixtureFrames();
  modifiedFrames.ready.E[(width * 3 + 2) * 4] = 255;
  const modified = packageFiles(modifiedManifest, modifiedFrames);
  const extracted = path.join(temp, 'extracted');
  await fs.mkdir(extracted);
  for (const [name, bytes] of modified) await fs.writeFile(path.join(extracted, name), bytes);
  const replaced = await importSpriteSet(extracted, { repoRoot: root });
  assert.notEqual(replaced.revision, imported.revision);
  assert.deepEqual(await fs.readFile(path.join(replaced.destination, 'ready-e.png')), modified.get('ready-e.png'));
  index = JSON.parse(await fs.readFile(replaced.indexPath, 'utf8'));
  assert.equal(index.sets.length, 2);
  assert.deepEqual(index.sets[0], unrelated);

  // A failed package leaves the current character and index byte-for-byte intact.
  const savedIndex = await fs.readFile(replaced.indexPath);
  const savedImage = await fs.readFile(path.join(replaced.destination, 'ready-e.png'));
  await fs.writeFile(path.join(extracted, 'ready-e.png'), brokenCrc);
  await assert.rejects(importSpriteSet(extracted, { repoRoot: root }), /CRC/);
  assert.deepEqual(await fs.readFile(replaced.indexPath), savedIndex);
  assert.deepEqual(await fs.readFile(path.join(replaced.destination, 'ready-e.png')), savedImage);

  const unsafeZip = path.join(temp, 'unsafe.zip');
  await fs.writeFile(unsafeZip, zipSync({ ...zipEntries, '../escape.png': files.get('ready-e.png') }));
  await assert.rejects(readSpriteSetPackage(unsafeZip), /ZIP paths/);
  const duplicateFolder = path.join(temp, 'two-characters.zip');
  await fs.writeFile(duplicateFolder, zipSync({ ...zipEntries, 'another-character/ready-e.png': files.get('ready-e.png') }));
  await assert.rejects(readSpriteSetPackage(duplicateFolder), /one character folder/);
  const extraZip = path.join(temp, 'extra.zip');
  await fs.writeFile(extraZip, zipSync({ ...zipEntries, 'test-character/unlisted.png': files.get('ready-e.png') }));
  await assert.rejects(readSpriteSetPackage(extraZip), /only its manifest/);

  const oversized = Buffer.from(zip);
  const end = oversized.length - 22;
  const directory = oversized.readUInt32LE(end + 16);
  oversized.writeUInt32LE(0x40000000, directory + 24);
  const oversizedPath = path.join(temp, 'oversized.zip');
  await fs.writeFile(oversizedPath, oversized);
  await assert.rejects(readSpriteSetPackage(oversizedPath), /unpacked asset limit/);

  const existingExtra = path.join(replaced.destination, 'source.fbx');
  await fs.writeFile(existingExtra, 'keep my source model');
  await assert.rejects(importSpriteSet(zipPath, { repoRoot: root }), /additional files/);
  assert.equal(await fs.readFile(existingExtra, 'utf8'), 'keep my source model');
  assert.deepEqual(await fs.readFile(replaced.indexPath), savedIndex);

  const symlinkRoot = path.join(temp, 'symlink-repo');
  await fs.mkdir(symlinkRoot);
  await fs.symlink(root, path.join(symlinkRoot, 'assets'));
  await assert.rejects(importSpriteSet(zipPath, { repoRoot: symlinkRoot }), /ordinary directory/);

  const validationRoot = path.join(temp, 'validation-repo');
  await fs.mkdir(validationRoot);
  const registered = await importSpriteSet(zipPath, { repoRoot: validationRoot });
  assert.equal((await validateSpriteSetRepository({ repoRoot: validationRoot })).sets, 1);
  const goodIndex = JSON.parse(await fs.readFile(registered.indexPath, 'utf8'));
  await fs.writeFile(registered.indexPath, JSON.stringify({ ...goodIndex, sets: [...goodIndex.sets, ...goodIndex.sets] }));
  await assert.rejects(validateSpriteSetRepository({ repoRoot: validationRoot }), /duplicate ID/);
  const badPathIndex = structuredClone(goodIndex);
  badPathIndex.sets[0].manifest = '../outside/manifest.json';
  await fs.writeFile(registered.indexPath, JSON.stringify(badPathIndex));
  await assert.rejects(validateSpriteSetRepository({ repoRoot: validationRoot }), /own asset-folder/);
  await fs.writeFile(registered.indexPath, JSON.stringify(goodIndex));
  const manifestPath = path.join(registered.destination, 'manifest.json');
  const changedManifest = structuredClone(manifest);
  changedManifest.poses.ready.time = 1.125;
  await fs.writeFile(manifestPath, JSON.stringify(changedManifest));
  await assert.rejects(validateSpriteSetRepository({ repoRoot: validationRoot }), /changed after import/);
  changedManifest.id = 'another-character';
  await fs.writeFile(manifestPath, JSON.stringify(changedManifest));
  await assert.rejects(validateSpriteSetRepository({ repoRoot: validationRoot }), /manifest ID disagrees/);
  await fs.writeFile(registered.indexPath, JSON.stringify({ version: 1, sets: [] }));
  assert.equal((await validateSpriteSetRepository({ repoRoot: validationRoot })).sets, 0);

  // New scaled packages and unchanged Rev 47 packages keep exact PNG bytes and
  // MOB/footprint/model-size metadata through the real importer.
  const formatsRoot = path.join(temp, 'format-repo');
  await fs.mkdir(formatsRoot);
  const importLayouts = [...SPRITE_LAYOUT_PRESETS, ...SPRITE_LEGACY_LAYOUT_PRESETS];
  for (let index = 0; index < importLayouts.length; index++) {
    const layout = importLayouts[index];
    const modelScalePercent = index < SPRITE_LAYOUT_PRESETS.length ? [25, 55, 1000, 2000][index] : undefined;
    const hexScalePercent = index < SPRITE_LAYOUT_PRESETS.length ? 109 : undefined;
    const dimensions = spriteLayoutDimensions(layout.id, 50, modelScalePercent, hexScalePercent);
    const metadata = createSpriteSetManifest({
      id: `format-${layout.id}`, label: `Format ${layout.label}`, captures,
      frame: { ...dimensions, anchorX: dimensions.width / 2, anchorY: dimensions.height * 0.75 },
      layout: createSpriteLayoutMetadata(layout.id, 50), mobType: SPRITE_MOBS[index].id,
      ...(modelScalePercent === undefined ? {} : { modelScalePercent }),
      ...(hexScalePercent === undefined ? {} : { hexScalePercent })
    });
    const sizedFrames = fixtureFrames(dimensions.width, dimensions.height);
    const sizedFiles = packageFiles(metadata, sizedFrames);
    const formatZip = path.join(temp, `${metadata.id}.zip`);
    await fs.writeFile(formatZip, zipSync(Object.fromEntries([...sizedFiles].map(([name, bytes]) => [`${metadata.id}/${name}`, bytes])), { level: 0 }));
    const importedFormat = await importSpriteSet(formatZip, { repoRoot: formatsRoot });
    const restoredMetadata = JSON.parse(await fs.readFile(path.join(importedFormat.destination, 'manifest.json'), 'utf8'));
    assert.deepEqual(restoredMetadata.layout, metadata.layout);
    assert.equal(restoredMetadata.mobType, metadata.mobType);
    assert.equal(restoredMetadata.modelScalePercent, metadata.modelScalePercent);
    assert.equal(restoredMetadata.hexScalePercent, metadata.hexScalePercent);
    assert.deepEqual(restoredMetadata.frame, metadata.frame);
    for (const [name, bytes] of sizedFiles) assert.deepEqual(await fs.readFile(path.join(importedFormat.destination, name)), bytes);
  }
  assert.equal((await validateSpriteSetRepository({ repoRoot: formatsRoot })).sets, 7);
  // Opt-in player targets follow the identical separate-folder package path;
  // they require no special PNG format or edits to the game's source files.
  for (const target of SPRITE_MOBS.filter(mob => mob.targetKind === 'player')) {
    const dimensions = spriteLayoutDimensions('single', 50);
    const metadata = createSpriteSetManifest({
      id: `player-${target.id}`, label: target.label, captures,
      frame: { ...dimensions, anchorX: dimensions.width / 2, anchorY: dimensions.height * 0.75 },
      layout: createSpriteLayoutMetadata('single', 50), mobType: target.id
    });
    const playerFiles = packageFiles(metadata, fixtureFrames(dimensions.width, dimensions.height));
    const playerZip = path.join(temp, `${metadata.id}.zip`);
    await fs.writeFile(playerZip, zipSync(Object.fromEntries([...playerFiles].map(([name, bytes]) => [`${metadata.id}/${name}`, bytes]))));
    const importedPlayer = await importSpriteSet(playerZip, { repoRoot: formatsRoot });
    assert.equal(JSON.parse(await fs.readFile(path.join(importedPlayer.destination, 'manifest.json'), 'utf8')).mobType, target.id);
    for (const [name, bytes] of playerFiles) assert.deepEqual(await fs.readFile(path.join(importedPlayer.destination, name)), bytes);
    const assignedIndex = JSON.parse(await fs.readFile(importedPlayer.indexPath, 'utf8'));
    assignedIndex.sets.find(entry => entry.id === metadata.id).defaultFor = target.id;
    await fs.writeFile(importedPlayer.indexPath, JSON.stringify(assignedIndex));
    await importSpriteSet(playerZip, { repoRoot: formatsRoot });
    const replacedIndex = JSON.parse(await fs.readFile(importedPlayer.indexPath, 'utf8'));
    assert.equal(replacedIndex.sets.find(entry => entry.id === metadata.id).defaultFor, target.id,
      'Reimport preserves the explicit unit-to-sprite assignment');
  }
  assert.equal((await validateSpriteSetRepository({ repoRoot: formatsRoot })).sets, 10);
  const formatIndexPath = path.join(formatsRoot, 'data/sprite-sets.json');
  const assignedIndex = JSON.parse(await fs.readFile(formatIndexPath, 'utf8'));
  const mismatchedBinding = structuredClone(assignedIndex);
  mismatchedBinding.sets.find(entry => entry.id === 'player-fighter').defaultFor = 'ranger';
  await fs.writeFile(formatIndexPath, JSON.stringify(mismatchedBinding));
  await assert.rejects(validateSpriteSetRepository({ repoRoot: formatsRoot }), /binding must match/);
  await assert.rejects(importSpriteSet(path.join(temp, 'player-fighter.zip'), { repoRoot: formatsRoot }), /binding must match/);
  assert.deepEqual(JSON.parse(await fs.readFile(formatIndexPath, 'utf8')), mismatchedBinding,
    'A mismatched replacement cannot rewrite the asset assignment');
  await fs.writeFile(formatIndexPath, JSON.stringify(assignedIndex));
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}

console.log('Sprite packages: four selectable layouts, three recoverable legacy layouts, independent model size and resolution, backward-compatible hex calibration and one-time workspace recovery, seven monsters and three player targets, counterclockwise footprints, exact 18-frame imports, PNG/ZIP integrity, and repository registration checks passed.');
