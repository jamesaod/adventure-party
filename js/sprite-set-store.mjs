import { SPRITE_DIRECTIONS, SPRITE_POSES, validateSpriteSetManifest } from './sprite-set-core.mjs?v=R238C54';
import { SPRITE_HEX_SCALE_PERCENT, spriteLayoutDimensions, validateSpriteModelScale, validateSpriteHexScale } from './sprite-layouts.mjs?v=R238C54';

// Candidate and stable share an origin, so isolate their drafts by page folder.
const scope = new URL('.', location.href).pathname;
const databaseName = `adventure-party-studio:${scope}`;
const storeName = 'sprite-drafts';
const WORKSPACE_VERSION = 1;
const MAX_WORKSPACE_BYTES = 256 * 1024 * 1024;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function storedBytes(value, seen = new WeakSet()) {
  if (typeof value === 'string') return value.length * 2;
  if (!value || typeof value !== 'object') return 8;
  if (seen.has(value)) return 0;
  seen.add(value);
  if (value instanceof Blob) return value.size;
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value.byteLength;
  return Object.entries(value).reduce((bytes, [key, item]) => bytes + key.length * 2 + storedBytes(item, seen), 0);
}

/** Validate the raw capture workspace before replacing an existing saved copy. */
export function validateStudioWorkspace(workspace) {
  const invalid = message => { throw new Error(`Saved studio workspace: ${message}`); };
  if (!plain(workspace) || workspace.version !== WORKSPACE_VERSION) invalid('unsupported format.');
  if (typeof workspace.name !== 'string' || workspace.name.length > 120) invalid('invalid character name.');
  if (!plain(workspace.style) || !plain(workspace.settings) || !plain(workspace.captures)) invalid('settings are missing.');
  for (const key of ['brightness', 'contrast', 'hue', 'saturation', 'outline']) {
    if (!Number.isFinite(workspace.style[key])) invalid(`invalid ${key}.`);
  }
  if (workspace.settings.modelScalePercent !== undefined) validateSpriteModelScale(workspace.settings.modelScalePercent);
  const settingsHexScale = validateSpriteHexScale(workspace.settings.hexScalePercent);
  let dimensions, modelScale, hexScale;
  for (const [pose, capture] of Object.entries(workspace.captures)) {
    if (!SPRITE_POSES.includes(pose) || !plain(capture)) invalid('invalid pose.');
    const { width, height, raw, anchorX, anchorY, clip, time } = capture;
    if (![width, height].every(value => Number.isInteger(value) && value > 0 && value <= 1024)) invalid('invalid frame size.');
    if (!(raw instanceof Uint8Array || raw instanceof Uint8ClampedArray) || raw.length !== width * height * 6 * 4) invalid('incomplete captured pixels.');
    if (!Number.isFinite(anchorX) || anchorX < 0 || anchorX > width || !Number.isFinite(anchorY) || anchorY < 0 || anchorY > height) invalid('invalid ground anchor.');
    if (typeof clip !== 'string' || clip.length > 512 || !Number.isFinite(time) || time < 0) invalid('invalid animation time.');
    if (dimensions && (dimensions[0] !== width || dimensions[1] !== height)) invalid('poses have different frame sizes.');
    dimensions = [width, height];
    const scale = validateSpriteModelScale(capture.modelScalePercent);
    if (capture.modelScalePercent !== undefined && !plain(capture.layout)) invalid('model size needs its captured footprint metadata.');
    if (modelScale !== undefined && modelScale !== scale) invalid('poses have different model sizes.');
    modelScale = scale;
    const calibration = validateSpriteHexScale(capture.hexScalePercent);
    if (capture.hexScalePercent !== undefined && !plain(capture.layout)) invalid('hex scale needs its captured footprint metadata.');
    if (hexScale !== undefined && hexScale !== calibration) invalid('poses have different hex scales.');
    if (calibration !== settingsHexScale) invalid('captured hex scale does not match the workspace.');
    hexScale = calibration;
  }
  const sources = workspace.settings.sourceFiles;
  if (sources !== undefined && (!Array.isArray(sources) || sources.some(source =>
    !plain(source) || typeof source.name !== 'string' || !source.name || !(source.blob instanceof Blob)))) {
    invalid('invalid model source files.');
  }
  if (storedBytes(workspace) > MAX_WORKSPACE_BYTES) {
    invalid('the model and captures exceed 256 MB. Export the asset ZIP to keep the captures.');
  }
  return workspace;
}

/** Restore-time calibration changes metadata only, never captured pixels or base framing. */
export function upgradeStudioWorkspaceHexScale(workspace) {
  validateStudioWorkspace(workspace);
  const rows = Object.values(workspace.captures);
  const canUpgrade = rows.length ? rows.every(capture => plain(capture.layout)) : plain(workspace.settings.layout);
  const target = canUpgrade ? SPRITE_HEX_SCALE_PERCENT : 100;
  let changed = workspace.settings.hexScalePercent !== target;
  const captures = Object.fromEntries(Object.entries(workspace.captures).map(([pose, capture]) => {
    if (!canUpgrade || capture.hexScalePercent === target) return [pose, capture];
    const dimensions = spriteLayoutDimensions(capture.layout.id, capture.layout.resolutionPercent,
      capture.modelScalePercent, target);
    if (dimensions.width !== capture.width || dimensions.height !== capture.height) {
      throw new Error('Saved studio workspace: captured frame does not match its footprint.');
    }
    const ratio = target / validateSpriteHexScale(capture.hexScalePercent);
    const render = { ...capture.render };
    if (Number.isFinite(render.frameHeight)) render.frameHeight *= ratio;
    if (Array.isArray(render.center) && render.center.length === 3 && render.center.every(Number.isFinite)) {
      render.center = render.center.map(value => value * ratio);
    }
    changed = true;
    return [pose, { ...capture, hexScalePercent: target,
      renderWidth: dimensions.renderWidth, renderHeight: dimensions.renderHeight, render }];
  }));
  if (!changed) return workspace;
  return validateStudioWorkspace({ ...workspace, captures,
    settings: { ...workspace.settings, hexScalePercent: target } });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('This browser cannot save the studio workspace. Export the asset ZIP to keep your sprites.'));
      return;
    }
    let blocked = false;
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => blocked ? request.result.close() : resolve(request.result);
    request.onerror = () => reject(new Error('The browser could not open the studio draft storage. Export the asset ZIP instead.'));
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Studio draft storage is busy in another tab. Close that tab and retry.'));
    };
  });
}

async function writeRecords(records) {
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      for (const [key, record] of records) store.put(record, key);
      transaction.oncomplete = resolve;
      transaction.onabort = transaction.onerror = () => reject(new Error(
        'The browser could not save the studio workspace. Storage may be full. Your open captures are intact; export the asset ZIP before leaving.'
      ));
    });
  } finally { db.close(); }
}

async function readRecord(key) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('The saved studio workspace could not be read. Retry without clearing browser storage.'));
    });
  } finally { db.close(); }
}

export async function saveStudioWorkspace(workspace) {
  validateStudioWorkspace(workspace);
  await writeRecords([['workspace', { ...workspace, savedAt: Date.now() }]]);
}

export async function loadStudioWorkspace({ fromCombat = false } = {}) {
  const workspace = await readRecord(fromCombat ? 'combat-workspace' : 'workspace');
  return workspace ? validateStudioWorkspace(workspace) : null;
}

export async function saveStudioDraft({ manifest, files, workspace }) {
  validateSpriteSetManifest(manifest);
  let bytes = 0;
  const storedFiles = {};
  const names = SPRITE_POSES.flatMap(pose => SPRITE_DIRECTIONS.map(facing => manifest.poses[pose].frames[facing]));
  if (files?.[manifest.sheet.file] instanceof Blob) names.push(manifest.sheet.file);
  for (const name of names) {
    const file = files?.[name];
    if (!(file instanceof Blob) || !file.size) throw new Error(`Missing captured PNG: ${name}.`);
    bytes += file.size;
    storedFiles[name] = file;
  }
  if (bytes > 64 * 1024 * 1024) throw new Error('This sprite draft is too large for a quick combat test. Export the asset ZIP instead.');
  const records = [['current', { manifest, files: storedFiles, savedAt: Date.now() }]];
  if (workspace) {
    validateStudioWorkspace(workspace);
    records.push(['combat-workspace', { ...workspace, savedAt: Date.now() }]);
  }
  // The PNG test set and its editable return workspace are one atomic write.
  await writeRecords(records);
}

export async function loadStudioDraft() {
  return readRecord('current');
}
