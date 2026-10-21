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

function fixtureFrames() {
  return Object.fromEntries(SPRITE_POSES.map((pose, row) => [pose,
    Object.fromEntries(SPRITE_DIRECTIONS.map((facing, column) => {
      const pixels = new Uint8ClampedArray(width * height * 4);
      for (let y = 2; y < height - 2; y++) {
        for (let x = 1; x < width - 1; x++) {
          pixels.set([column * 40, row * 80, (x + y) * 10, 255], (y * width + x) * 4);
        }
      }
      return [facing, pixels];
    }))
  ]));
}

function packageFiles(metadata, frames) {
  const files = new Map([['manifest.json', Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`)]]);
  SPRITE_POSES.forEach((pose, row) => SPRITE_DIRECTIONS.forEach((facing, column) => {
    files.set(metadata.poses[pose].frames[facing], rgbaPng(frames[pose][facing], width, height, (row + column) % 5));
  }));
  const sheet = assembleSpriteSheet(frames, width, height);
  files.set(metadata.sheet.file, rgbaPng(sheet.data, sheet.width, sheet.height, 4));
  return files;
}

const frames = fixtureFrames();
const files = packageFiles(manifest, frames);
assert.equal(validateSpriteSetManifest(manifest), manifest);
assert.equal(spriteSetSlug('Kobold Veteran.fbx'), 'kobold-veteran');
assert.equal(spriteSetSlug('  Àrcher / Blue!  '), 'archer-blue');
assert.equal(spriteSetSlug(''), 'studio-character');
assert.throws(() => createSpriteSetManifest({ id: 'test', label: 'Test', frame, captures: {} }), /ready has not been captured/);
for (const alter of [
  value => { value.id = '../escape'; },
  value => { value.poses.attack.frames.NE = '../attack-ne.png'; },
  value => { value.poses.prone.frames.SE = value.poses.ready.frames.E; },
  value => { value.frame.width = Infinity; },
  value => { value.frame.height = 2048; },
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
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}

console.log('Sprite packages: pose/facing mapping, 18-cell assembly, PNG decode/alpha/CRC, ZIP bounds/paths, exact import/replacement, failure preservation, and repository registration checks passed.');
