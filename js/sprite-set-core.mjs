/** Small, shared contract for studio captures and separately stored game assets. */
import { createSpriteLayoutMetadata, spriteLayoutDimensions, spriteMob, validateSpriteModelScale, validateSpriteHexScale } from './sprite-layouts.mjs?v=R238C93';

export const SPRITE_DIRECTIONS = Object.freeze(['E', 'NE', 'NW', 'W', 'SW', 'SE']);
export const SPRITE_POSES = Object.freeze(['ready', 'attack', 'prone']);
export const SPRITE_SET_SCHEMA = 'adventure-party.sprite-set';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PNG_PATTERN = /^[a-z0-9][a-z0-9-]*\.png$/;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function requireValue(condition, message) {
  if (!condition) throw new Error(`Sprite set: ${message}`);
}
function sameOrder(value, expected) {
  return Array.isArray(value) && value.length === expected.length && value.every((item, i) => item === expected[i]);
}

export function spriteSetSlug(label) {
  return String(label || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/g, '') || 'studio-character';
}

/** Validate before using a manifest as paths, image dimensions, or game metadata. */
export function validateSpriteSetManifest(value) {
  requireValue(object(value) && value.schema === SPRITE_SET_SCHEMA && value.version === 1,
    'unsupported manifest format.');
  requireValue(typeof value.id === 'string' && value.id.length <= 64 && ID_PATTERN.test(value.id),
    'ID must contain lowercase letters, digits, and single hyphens.');
  requireValue(typeof value.label === 'string' && value.label.trim().length > 0 && value.label.length <= 120,
    'give this character a name of 1–120 characters.');
  const frame = value.frame;
  requireValue(object(frame), 'frame metadata is missing.');
  for (const key of ['width', 'height']) {
    requireValue(Number.isInteger(frame[key]) && frame[key] > 0 && frame[key] <= 4096,
      `${key} must be an integer from 1 to 4096.`);
  }
  for (const key of ['renderWidth', 'renderHeight']) {
    requireValue(Number.isFinite(frame[key]) && frame[key] > 0 && frame[key] <= 4096,
      `${key} must be a positive size no larger than 4096.`);
  }
  for (const [key, limit] of [['anchorX', frame.width], ['anchorY', frame.height]]) {
    requireValue(Number.isFinite(frame[key]) && frame[key] >= 0 && frame[key] <= limit,
      `${key} must be within the source frame.`);
  }
  // Rev 46 packages remain valid without these optional fields. New exports
  // carry enough information to preserve tactical size independently of detail.
  const modelScalePercent = validateSpriteModelScale(value.modelScalePercent);
  const hexScalePercent = validateSpriteHexScale(value.hexScalePercent);
  if (value.modelScalePercent !== undefined) {
    requireValue(value.layout !== undefined, 'model scale requires layout metadata.');
  }
  if (value.hexScalePercent !== undefined) {
    requireValue(value.layout !== undefined, 'hex scale requires layout metadata.');
  }
  if (value.layout !== undefined) {
    requireValue(object(value.layout) && typeof value.layout.id === 'string' && Number.isInteger(value.layout.resolutionPercent),
      'layout must include its format ID and resolution percentage.');
    const layout = createSpriteLayoutMetadata(value.layout.id, value.layout.resolutionPercent);
    const expected = spriteLayoutDimensions(layout.id, layout.resolutionPercent, modelScalePercent, hexScalePercent);
    for (const key of ['width', 'height', 'renderWidth', 'renderHeight']) {
      requireValue(frame[key] === expected[key], `${key} does not match the selected layout, resolution, model scale, and hex scale.`);
    }
  }
  if (value.mobType !== undefined) {
    requireValue(typeof value.mobType === 'string', 'MOB type must be an implemented creature ID.');
    spriteMob(value.mobType);
  }
  if (value.unit !== undefined) {
    requireValue(object(value.unit), 'unit calibration metadata must be an object.');
    requireValue(typeof value.unit.type === 'string', 'unit type must be an implemented creature ID.');
    spriteMob(value.unit.type);
    requireValue(value.unit.modelId === null || (typeof value.unit.modelId === 'string' && value.unit.modelId.length <= 160),
      'unit model ID must be text or null.');
    requireValue(value.unit.modelName === null || (typeof value.unit.modelName === 'string' && value.unit.modelName.length <= 160),
      'unit model name must be text or null.');
    const calibration = value.unit.calibration;
    requireValue(object(calibration) && calibration.pose === 'T-Pose',
      'unit calibration must use T-Pose.');
    const calibratedScale = validateSpriteModelScale(calibration.modelScalePercent);
    if (value.modelScalePercent !== undefined) {
      requireValue(calibratedScale === value.modelScalePercent,
        'unit calibration model scale must match sprite-set model scale.');
    }
    requireValue(calibration.measuredHeightInches === null ||
      (Number.isFinite(calibration.measuredHeightInches) && calibration.measuredHeightInches > 0 && calibration.measuredHeightInches <= 900),
      'unit calibrated height must be positive inches or null.');
  }
  requireValue(sameOrder(value.facings, SPRITE_DIRECTIONS), 'the six facing directions are missing or out of order.');
  requireValue(object(value.poses), 'pose captures are missing.');
  const files = new Set();
  for (const pose of SPRITE_POSES) {
    const capture = value.poses[pose];
    requireValue(own(value.poses, pose) && object(capture), `${pose} has not been captured.`);
    requireValue(typeof capture.clip === 'string' && capture.clip.length <= 512,
      `${pose} has an invalid animation name.`);
    requireValue(Number.isFinite(capture.time) && capture.time >= 0, `${pose} has an invalid capture time.`);
    requireValue(object(capture.frames), `${pose} has no facing images.`);
    for (const facing of SPRITE_DIRECTIONS) {
      const name = capture.frames[facing];
      requireValue(own(capture.frames, facing) && typeof name === 'string' && name.length <= 96 && PNG_PATTERN.test(name),
        `${pose}/${facing} must reference a PNG filename in the character folder.`);
      requireValue(!files.has(name), `image filename is used more than once: ${name}.`);
      files.add(name);
    }
  }
  const sheet = value.sheet;
  requireValue(object(sheet) && sheet.columns === 6 && sheet.rows === 3 &&
    sameOrder(sheet.poses, SPRITE_POSES) && sameOrder(sheet.facings, SPRITE_DIRECTIONS),
  'sheet must have six facing columns and ready, attack, prone rows.');
  requireValue(typeof sheet.file === 'string' && sheet.file.length <= 96 && PNG_PATTERN.test(sheet.file) && !files.has(sheet.file),
    'sheet must have its own PNG filename.');
  if (value.render !== undefined) requireValue(object(value.render), 'render settings must be an object.');
  return value;
}

/** Capture metadata is kept separately from PNG bytes so the manifest stays small. */
export function createSpriteSetManifest({ id, label, frame, captures, render, layout, mobType, modelScalePercent, hexScalePercent, unit }) {
  const poses = Object.fromEntries(SPRITE_POSES.map(pose => {
    const capture = captures?.[pose];
    requireValue(object(capture), `${pose} has not been captured.`);
    return [pose, {
      clip: capture.clip ?? 'Rest pose', time: capture.time ?? 0,
      frames: Object.fromEntries(SPRITE_DIRECTIONS.map(facing => [facing, `${pose}-${facing.toLowerCase()}.png`]))
    }];
  }));
  return validateSpriteSetManifest({
    schema: SPRITE_SET_SCHEMA, version: 1, id, label, frame: { ...frame },
    facings: [...SPRITE_DIRECTIONS], poses,
    sheet: { file: 'sheet.png', columns: 6, rows: 3, poses: [...SPRITE_POSES], facings: [...SPRITE_DIRECTIONS] },
    ...(render === undefined ? {} : { render }),
    ...(layout === undefined ? {} : { layout: { ...layout } }),
    ...(mobType === undefined ? {} : { mobType }),
    ...(modelScalePercent === undefined ? {} : { modelScalePercent }),
    ...(hexScalePercent === undefined ? {} : { hexScalePercent }),
    ...(unit === undefined ? {} : { unit: structuredClone(unit) })
  });
}

function checkPixels(data, width, height) {
  requireValue(Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0,
    'invalid pixel dimensions.');
  requireValue((data instanceof Uint8Array || data instanceof Uint8ClampedArray) && data.length === width * height * 4,
    'RGBA data does not match its dimensions.');
}

/** Input uses normal top-down RGBA rows and the existing E NE NW / W SW SE atlas. */
export function splitSixFacingAtlas(data, width, height) {
  requireValue(Number.isInteger(width) && width > 0 && width <= 4096 && Number.isInteger(height) && height > 0 && height <= 4096,
    'invalid atlas frame dimensions.');
  checkPixels(data, width * 3, height * 2);
  return Object.fromEntries(SPRITE_DIRECTIONS.map((facing, index) => {
    const result = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      const start = ((Math.floor(index / 3) * height + y) * width * 3 + (index % 3) * width) * 4;
      result.set(data.subarray(start, start + width * 4), y * width * 4);
    }
    return [facing, result];
  }));
}

/** Missing rows are transparent, allowing the same layout for a growing preview. */
export function assembleSpriteSheet(poseFrames, width, height) {
  requireValue(Number.isInteger(width) && width > 0 && width <= 4096 && Number.isInteger(height) && height > 0 && height <= 4096,
    'invalid sheet frame dimensions.');
  const sheetWidth = width * SPRITE_DIRECTIONS.length;
  const sheetHeight = height * SPRITE_POSES.length;
  const data = new Uint8ClampedArray(sheetWidth * sheetHeight * 4);
  SPRITE_POSES.forEach((pose, row) => {
    SPRITE_DIRECTIONS.forEach((facing, column) => {
      const source = poseFrames?.[pose]?.[facing];
      if (source == null) return;
      checkPixels(source, width, height);
      for (let y = 0; y < height; y++) {
        const start = ((row * height + y) * sheetWidth + column * width) * 4;
        data.set(source.subarray(y * width * 4, (y + 1) * width * 4), start);
      }
    });
  });
  return { width: sheetWidth, height: sheetHeight, data };
}
