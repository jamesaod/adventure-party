#!/usr/bin/env node
// Import a studio ZIP without changing game code or resampling the artwork.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import {
  SPRITE_DIRECTIONS, SPRITE_POSES, validateSpriteSetManifest, assembleSpriteSheet
} from '../js/sprite-set-core.mjs';
import { spriteMob } from '../js/sprite-layouts.mjs';

const DEFAULT_ROOT = fileURLToPath(new URL('../', import.meta.url));
const MAX_ZIP = 32 * 1024 * 1024;
const MAX_FILE = 16 * 1024 * 1024;
const MAX_TOTAL = 64 * 1024 * 1024;
const MAX_MANIFEST = 64 * 1024;
const MAX_ENTRIES = 24;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const fail = message => { throw new Error(`Sprite import: ${message}`); };
const requireValue = (condition, message) => { if (!condition) fail(message); };

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Inspect sizes and paths before asking the bundled inflater to allocate memory.
function inspectZip(data) {
  requireValue(data.length >= 22 && data.length <= MAX_ZIP, 'ZIP must be no larger than 32 MB.');
  let end = data.length - 22;
  const earliest = Math.max(0, end - 65535);
  while (end >= earliest && (data.readUInt32LE(end) !== 0x06054b50 ||
      end + 22 + data.readUInt16LE(end + 20) !== data.length)) end--;
  requireValue(end >= earliest, 'ZIP directory is missing or truncated.');
  const count = data.readUInt16LE(end + 10);
  requireValue(data.readUInt16LE(end + 4) === 0 && data.readUInt16LE(end + 6) === 0 &&
    data.readUInt16LE(end + 8) === count, 'multi-volume ZIP files are not supported.');
  requireValue(count > 0 && count <= MAX_ENTRIES, 'ZIP must contain one character and no more than 24 entries.');
  const directorySize = data.readUInt32LE(end + 12);
  const directoryStart = data.readUInt32LE(end + 16);
  requireValue(directoryStart + directorySize === end, 'ZIP64 or an invalid ZIP directory is not supported.');
  let offset = directoryStart, total = 0;
  const entries = [], names = new Set(), roots = new Set(), ranges = [];
  for (let i = 0; i < count; i++) {
    requireValue(offset + 46 <= end && data.readUInt32LE(offset) === 0x02014b50, 'ZIP directory entry is truncated.');
    const flags = data.readUInt16LE(offset + 8);
    const method = data.readUInt16LE(offset + 10);
    const compressed = data.readUInt32LE(offset + 20);
    const size = data.readUInt32LE(offset + 24);
    const nameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    requireValue(next <= end, 'ZIP filename is truncated.');
    const name = data.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    requireValue(/^[a-z0-9]+(?:-[a-z0-9]+)*\/(?:manifest\.json|[a-z0-9][a-z0-9-]*\.png)?$/.test(name),
      'ZIP paths must be one character folder containing manifest.json and PNG files.');
    requireValue(!names.has(name), `duplicate ZIP filename: ${name}.`);
    names.add(name);
    roots.add(name.split('/')[0]);
    requireValue(roots.size === 1, 'ZIP must contain one character folder.');
    requireValue(!(flags & 1) && (method === 0 || method === 8), 'encrypted or unsupported ZIP compression.');
    const mode = (data.readUInt32LE(offset + 38) >>> 16) & 0xf000;
    requireValue(mode !== 0xa000, 'symbolic links are not sprite assets.');
    total += size;
    requireValue(size <= MAX_FILE && compressed <= MAX_FILE && total <= MAX_TOTAL, 'ZIP exceeds the 64 MB unpacked asset limit.');
    if (name.endsWith('/')) requireValue(size === 0, 'invalid character directory entry.');
    if (name.endsWith('/manifest.json')) requireValue(size <= MAX_MANIFEST, 'manifest is too large.');
    const local = data.readUInt32LE(offset + 42);
    requireValue(local + 30 <= directoryStart && data.readUInt32LE(local) === 0x04034b50,
      'ZIP local file header is missing.');
    requireValue(data.readUInt16LE(local + 6) === flags && data.readUInt16LE(local + 8) === method,
      'ZIP headers disagree.');
    const localNameLength = data.readUInt16LE(local + 26);
    const dataStart = local + 30 + localNameLength + data.readUInt16LE(local + 28);
    requireValue(dataStart + compressed <= directoryStart &&
      data.subarray(local + 30, local + 30 + localNameLength).toString('utf8') === name,
    'ZIP file data is truncated or its filename disagrees.');
    requireValue(ranges.every(([start, finish]) => local >= finish || dataStart + compressed <= start),
      'ZIP entries overlap.');
    ranges.push([local, dataStart + compressed]);
    entries.push({ name, size, crc: data.readUInt32LE(offset + 16) });
    offset = next;
  }
  requireValue(offset === end, 'ZIP directory size disagrees with its entries.');
  return entries;
}

let compression;
async function compressionTools() {
  if (!compression) {
    // This vendored file is an ES module but intentionally retains Three's .js
    // name. A data URL also works on Node 20 without a repository package.json.
    const source = await fs.readFile(new URL('../assets/vendor/three/addons/libs/fflate.module.js', import.meta.url));
    compression = import(`data:text/javascript;base64,${source.toString('base64')}`);
  }
  return compression;
}

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Fully decode the supported native exports, checking CRC, row sizes and alpha. */
export function decodeSpritePng(bytes, expectedWidth, expectedHeight, name = 'PNG') {
  const data = Buffer.from(bytes);
  requireValue(data.length <= MAX_FILE && data.subarray(0, 8).equals(PNG_SIGNATURE), `${name} is not a PNG.`);
  let offset = 8, header, palette, transparency, ended = false, sawData = false, dataEnded = false;
  const idat = [];
  while (offset < data.length) {
    requireValue(offset + 12 <= data.length, `${name} has a truncated chunk.`);
    const length = data.readUInt32BE(offset);
    const end = offset + length + 12;
    requireValue(end <= data.length, `${name} has a truncated chunk.`);
    const type = data.toString('ascii', offset + 4, offset + 8);
    const chunk = data.subarray(offset + 8, end - 4);
    requireValue(crc32(data.subarray(offset + 4, end - 4)) === data.readUInt32BE(end - 4), `${name} has a bad ${type} CRC.`);
    if (type === 'IHDR') {
      requireValue(!header && offset === 8 && length === 13, `${name} has an invalid header.`);
      header = { width: chunk.readUInt32BE(0), height: chunk.readUInt32BE(4), depth: chunk[8], type: chunk[9] };
      requireValue(header.width === expectedWidth && header.height === expectedHeight, `${name} dimensions do not match the manifest.`);
      requireValue(chunk[10] === 0 && chunk[11] === 0 && chunk[12] === 0, `${name} must be a noninterlaced PNG.`);
      requireValue((header.type === 6 && header.depth === 8) ||
        (header.type === 3 && [1, 2, 4, 8].includes(header.depth)), `${name} must use RGBA8 or indexed PNG with transparency.`);
    } else if (type === 'PLTE') {
      requireValue(header && !palette && !sawData && length > 0 && length <= 768 && length % 3 === 0, `${name} has an invalid palette.`);
      palette = chunk;
    } else if (type === 'tRNS') {
      requireValue(header?.type === 3 && palette && !transparency && !sawData && length > 0 && length <= palette.length / 3,
        `${name} has invalid transparency.`);
      transparency = chunk;
    } else if (type === 'IDAT') {
      requireValue(header && !dataEnded && (header.type !== 3 || palette), `${name} has an invalid image stream.`);
      sawData = true;
      idat.push(chunk);
    } else if (type === 'IEND') {
      requireValue(length === 0 && sawData && end === data.length, `${name} has an invalid end chunk.`);
      ended = true;
      break;
    } else {
      requireValue(!/^[A-Z]/.test(type), `${name} has an unsupported critical PNG chunk.`);
      if (sawData) dataEnded = true;
    }
    offset = end;
  }
  requireValue(ended && header && idat.length > 0, `${name} is missing PNG image data.`);
  const { width, height, depth, type } = header;
  const stride = type === 6 ? width * 4 : Math.ceil(width * depth / 8);
  const bytesPerPixel = type === 6 ? 4 : 1;
  const raw = inflateSync(Buffer.concat(idat), { maxOutputLength: (stride + 1) * height });
  requireValue(raw.length === (stride + 1) * height, `${name} has the wrong decoded row length.`);
  const rows = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    requireValue(filter <= 4, `${name} has an invalid PNG row filter.`);
    for (let x = 0; x < stride; x++) {
      const a = x >= bytesPerPixel ? rows[y * stride + x - bytesPerPixel] : 0;
      const b = y ? rows[(y - 1) * stride + x] : 0;
      const c = y && x >= bytesPerPixel ? rows[(y - 1) * stride + x - bytesPerPixel] : 0;
      const predictor = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
      rows[y * stride + x] = (raw[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  const rgba = new Uint8ClampedArray(width * height * 4);
  let opaque = 0, transparent = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dest = (y * width + x) * 4;
      if (type === 6) rgba.set(rows.subarray((y * width + x) * 4, (y * width + x + 1) * 4), dest);
      else {
        const bit = x * depth;
        const index = (rows[y * stride + (bit >> 3)] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
        requireValue(index * 3 < palette.length, `${name} uses a missing palette color.`);
        rgba[dest] = palette[index * 3];
        rgba[dest + 1] = palette[index * 3 + 1];
        rgba[dest + 2] = palette[index * 3 + 2];
        rgba[dest + 3] = transparency?.[index] ?? 255;
      }
      const alpha = rgba[dest + 3];
      requireValue(alpha === 0 || alpha === 255, `${name} must preserve hard pixel transparency (alpha 0 or 255).`);
      if (alpha) opaque++; else transparent++;
    }
  }
  requireValue(opaque > 0 && transparent > 0, `${name} must contain visible sprite pixels and a transparent background.`);
  return rgba;
}

export function validateSpritePackage(manifest, files) {
  validateSpriteSetManifest(manifest);
  const expected = new Set(['manifest.json', manifest.sheet.file]);
  const frames = {};
  for (const pose of SPRITE_POSES) {
    frames[pose] = {};
    for (const facing of SPRITE_DIRECTIONS) {
      const filename = manifest.poses[pose].frames[facing];
      expected.add(filename);
      requireValue(files.has(filename), `missing ${filename}.`);
      frames[pose][facing] = decodeSpritePng(files.get(filename), manifest.frame.width, manifest.frame.height, filename);
      const battlefieldName=manifest.battlefield?.poses?.[pose]?.frames?.[facing];
      if(battlefieldName){
        expected.add(battlefieldName);
        requireValue(files.has(battlefieldName),`missing ${battlefieldName}.`);
        decodeSpritePng(files.get(battlefieldName),manifest.battlefield.width,manifest.battlefield.height,battlefieldName);
      }
    }
  }
  requireValue(files.size === expected.size && [...files.keys()].every(name => expected.has(name)),
    manifest.battlefield
      ? 'package must contain only its manifest, 18 editable images, 18 battlefield images, and sheet.'
      : 'package must contain only its manifest, 18 facing images, and sheet.');
  const assembled = assembleSpriteSheet(frames, manifest.frame.width, manifest.frame.height);
  const sheet = decodeSpritePng(files.get(manifest.sheet.file), assembled.width, assembled.height, manifest.sheet.file);
  requireValue(Buffer.from(sheet).equals(Buffer.from(assembled.data)), 'sheet pixels do not match the 18 facing images.');
  return { manifest, files };
}

export async function readSpriteSetPackage(source) {
  const info = await fs.lstat(source);
  requireValue(!info.isSymbolicLink(), 'choose a ZIP or extracted character folder, not a symbolic link.');
  const files = new Map();
  let archiveFolder;
  if (info.isDirectory()) {
    const entries = await fs.readdir(source, { withFileTypes: true });
    requireValue(entries.length <= MAX_ENTRIES, 'character folder has too many files.');
    let total = 0;
    for (const entry of entries) {
      requireValue(entry.isFile() && /^(?:manifest\.json|[a-z0-9][a-z0-9-]*\.png)$/.test(entry.name),
        'character folder must contain only manifest.json and its PNG files.');
      const fullPath = path.join(source, entry.name);
      const stat = await fs.lstat(fullPath);
      total += stat.size;
      requireValue(stat.size <= MAX_FILE && total <= MAX_TOTAL && (entry.name !== 'manifest.json' || stat.size <= MAX_MANIFEST),
        'character folder exceeds the asset size limit.');
      files.set(entry.name, await fs.readFile(fullPath));
    }
  } else {
    requireValue(info.isFile() && info.size <= MAX_ZIP, 'choose a ZIP no larger than 32 MB.');
    const archive = await fs.readFile(source);
    const entries = inspectZip(archive);
    archiveFolder = entries[0].name.split('/')[0];
    const { unzipSync } = await compressionTools();
    const decoded = unzipSync(archive);
    for (const entry of entries) {
      const bytes = decoded[entry.name];
      requireValue(bytes?.length === entry.size && crc32(bytes) === entry.crc, `ZIP checksum failed: ${entry.name}.`);
      if (!entry.name.endsWith('/')) files.set(entry.name.split('/')[1], Buffer.from(bytes));
    }
  }
  requireValue(files.has('manifest.json'), 'manifest.json is missing.');
  const manifest = JSON.parse(files.get('manifest.json').toString('utf8'));
  requireValue(!archiveFolder || archiveFolder === manifest.id, 'ZIP folder name must match the manifest ID.');
  return validateSpritePackage(manifest, files);
}

async function assertPlainDirectory(directory, create = false) {
  if (create) await fs.mkdir(directory, { recursive: true });
  const info = await fs.lstat(directory);
  requireValue(info.isDirectory() && !info.isSymbolicLink(), `asset destination must be an ordinary directory: ${directory}`);
}

function packageRevision(files) {
  const hash = createHash('sha256');
  for (const name of [...files.keys()].sort()) hash.update(name).update('\0').update(files.get(name));
  return hash.digest('hex');
}

function validateDefaultBinding(entry, manifest) {
  if (entry.defaultFor === undefined) return;
  let target;
  try { target = spriteMob(entry.defaultFor); } catch { /* Report a binding error below. */ }
  requireValue(target?.targetKind === 'player' && manifest.mobType === entry.defaultFor,
    `${entry.id} default player binding must match its captured MOB.`);
}

/** CI and local validation use the same package checks as the importer. */
export async function validateSpriteSetRepository({ repoRoot = DEFAULT_ROOT } = {}) {
  const root = path.resolve(repoRoot);
  for (const directory of ['', 'assets', 'assets/sprites', 'data']) await assertPlainDirectory(path.join(root, directory));
  const indexPath = path.join(root, 'data/sprite-sets.json');
  const info = await fs.lstat(indexPath);
  requireValue(info.isFile() && !info.isSymbolicLink(), 'sprite-sets.json must be an ordinary file.');
  const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
  requireValue(index.version === 1 && Array.isArray(index.sets), 'sprite-sets.json has an unsupported format.');
  const ids = new Set(), defaultTargets = new Set();
  for (const entry of index.sets) {
    requireValue(typeof entry?.id === 'string' && entry.id.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id),
      'sprite index contains an invalid character ID.');
    requireValue(!ids.has(entry.id), `sprite index contains duplicate ID ${entry.id}.`);
    ids.add(entry.id);
    requireValue(entry.manifest === `assets/sprites/${entry.id}/manifest.json`,
      `${entry.id} must reference its own asset-folder manifest.`);
    requireValue(typeof entry.revision === 'string' && /^[a-f0-9]{64}$/.test(entry.revision),
      `${entry.id} needs an import-generated content revision.`);
    const { manifest, files } = await readSpriteSetPackage(path.join(root, 'assets/sprites', entry.id));
    requireValue(manifest.id === entry.id, `${entry.id} manifest ID disagrees with the sprite index.`);
    validateDefaultBinding(entry, manifest);
    if (entry.defaultFor !== undefined) {
      requireValue(!defaultTargets.has(entry.defaultFor), `duplicate default sprites for ${entry.defaultFor}.`);
      defaultTargets.add(entry.defaultFor);
    }
    requireValue(packageRevision(files) === entry.revision,
      `${entry.id} files changed after import; run the importer again to refresh its revision.`);
  }
  return { sets: index.sets.length, indexPath };
}

export async function importSpriteSet(source, { repoRoot = DEFAULT_ROOT } = {}) {
  const { manifest, files } = await readSpriteSetPackage(source);
  const root = path.resolve(repoRoot);
  await assertPlainDirectory(root);
  for (const directory of ['assets', 'assets/sprites', 'data']) await assertPlainDirectory(path.join(root, directory), true);
  const indexPath = path.join(root, 'data/sprite-sets.json');
  let index;
  try {
    const info = await fs.lstat(indexPath);
    requireValue(info.isFile() && !info.isSymbolicLink(), 'sprite-sets.json must be an ordinary file.');
    index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
    requireValue(index.version === 1 && Array.isArray(index.sets), 'existing sprite-sets.json has an unsupported format.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    index = { version: 1, sets: [] };
  }
  const revision = packageRevision(files);
  const entry = { id: manifest.id, manifest: `assets/sprites/${manifest.id}/manifest.json`, revision };
  const existing = index.sets.findIndex(item => item.id === manifest.id);
  if (existing >= 0 && index.sets[existing].defaultFor !== undefined) {
    entry.defaultFor = index.sets[existing].defaultFor;
    validateDefaultBinding(entry, manifest);
  }
  if (existing < 0) index.sets.push(entry); else index.sets[existing] = entry;
  const spritesRoot = path.join(root, 'assets/sprites');
  const destination = path.join(spritesRoot, manifest.id);
  const token = randomUUID();
  const stage = path.join(spritesRoot, `.sprite-import-${token}`);
  const backup = path.join(spritesRoot, `.sprite-backup-${token}`);
  const indexStage = path.join(root, 'data', `.sprite-sets-${token}.json`);
  let movedOld = false, installed = false, completed = false;
  try {
    await fs.mkdir(stage);
    for (const [name, bytes] of files) await fs.writeFile(path.join(stage, name), bytes, { flag: 'wx' });
    await fs.writeFile(indexStage, `${JSON.stringify(index, null, 2)}\n`, { flag: 'wx' });
    try {
      const info = await fs.lstat(destination);
      requireValue(info.isDirectory() && !info.isSymbolicLink(), 'existing character destination must be an ordinary directory.');
      const oldManifestPath = path.join(destination, 'manifest.json');
      const oldManifestInfo = await fs.lstat(oldManifestPath).catch(() => null);
      requireValue(oldManifestInfo?.isFile() && !oldManifestInfo.isSymbolicLink(),
        'that character folder contains assets without a sprite-set manifest; choose a new character ID.');
      const oldManifest = validateSpriteSetManifest(JSON.parse(await fs.readFile(oldManifestPath, 'utf8')));
      requireValue(oldManifest.id === manifest.id, 'existing character folder belongs to a different sprite set.');
      const managedNames = new Set(['manifest.json',oldManifest.sheet.file,
        ...SPRITE_POSES.flatMap(pose=>SPRITE_DIRECTIONS.flatMap(facing=>[
          oldManifest.poses[pose].frames[facing],
          oldManifest.battlefield?.poses?.[pose]?.frames?.[facing]
        ].filter(Boolean)))]);
      const oldEntries = await fs.readdir(destination, { withFileTypes: true });
      requireValue(oldEntries.every(item => item.isFile() && managedNames.has(item.name)),
        'existing character folder has additional files; choose a new character ID to preserve them.');
      await fs.rename(destination, backup);
      movedOld = true;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await fs.rename(stage, destination);
    installed = true;
    await fs.rename(indexStage, indexPath);
    completed = true;
  } catch (error) {
    if (installed) await fs.rm(destination, { recursive: true, force: true });
    if (movedOld) await fs.rename(backup, destination);
    throw error;
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
    await fs.rm(indexStage, { force: true });
    if (completed && movedOld) await fs.rm(backup, { recursive: true, force: true });
  }
  return { id: manifest.id, label: manifest.label, revision, destination, indexPath, files: files.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const usage = 'Usage: node scripts/import-sprite-set.mjs <studio-export.zip | extracted-character-folder | --validate> [--root <repository>]';
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log(usage);
  } else if (!args[0] || (args.length !== 1 && (args.length !== 3 || args[1] !== '--root'))) {
    console.error(usage);
    process.exitCode = 1;
  } else {
    try {
      const options = args[2] ? { repoRoot: args[2] } : {};
      if (args[0] === '--validate') {
        const result = await validateSpriteSetRepository(options);
        console.log(`Validated ${result.sets} imported sprite set${result.sets === 1 ? '' : 's'}: manifests, 18 PNGs, sheet pixels, and cache revisions.`);
      } else {
        const result = await importSpriteSet(path.resolve(args[0]), options);
        console.log(`Imported ${result.label}: 18 sprites and sheet → ${result.destination}`);
        console.log(`Updated ${result.indexPath}. Refresh Combat System Test and select ${result.label}.`);
      }
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
