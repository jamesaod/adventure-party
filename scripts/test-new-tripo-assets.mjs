import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const manifest=JSON.parse(readFileSync('data/new-tripo-qa-assets.json','utf8'));
const byteArrays=new Map();
const parsed=new Map();
for (const asset of manifest.models) {
  assert.ok(existsSync(asset.path),`Missing repository-backed binary: ${asset.path}. Do not publish the Studio library entry until this asset is committed.`);
  const raw=readFileSync(asset.path);
  assert.equal(raw.length,asset.sizeBytes,`Size mismatch: ${asset.path}`);
  assert.equal(createHash('sha256').update(raw).digest('hex'),asset.sha256,`SHA-256 mismatch: ${asset.path}`);
  assert.equal(raw.toString('ascii',0,4),'glTF');
  assert.equal(raw.readUInt32LE(4),2);
  assert.equal(raw.readUInt32LE(8),raw.length);
  const jsonLength=raw.readUInt32LE(12);
  assert.equal(raw.readUInt32LE(16),0x4e4f534a);
  const json=JSON.parse(raw.subarray(20,20+jsonLength).toString('utf8'));
  const binAt=20+jsonLength;
  assert.equal(raw.readUInt32LE(binAt+4),0x004e4942);
  const binLength=raw.readUInt32LE(binAt);
  const bin=raw.subarray(binAt+8,binAt+8+binLength);
  assert.ok(json.skins?.[0]?.joints?.length>=60,`Missing humanoid skin: ${asset.path}`);
  if (asset.animated) {
    assert.equal(json.animations?.length,1);
    assert.equal(json.animations[0].name,asset.clip);
    assert.equal(json.animations[0].channels.length,66);
  } else assert.equal(json.animations?.length||0,0);
  byteArrays.set(asset.id,bin);
  parsed.set(asset.id,json);
}
const src=parsed.get('new-carl-tripo-source');
const proof=parsed.get('new-carl-mixamo-baked-proof');
for(const key of ['nodes','skins','meshes','materials','textures','images'])
  assert.deepEqual(proof[key],src[key],`Offline bake must not change source GLB ${key}`);
const srcBin=byteArrays.get('new-carl-tripo-source');
const proofBin=byteArrays.get('new-carl-mixamo-baked-proof');
assert.ok(proofBin.subarray(0,srcBin.length).equals(srcBin),'Offline baked GLB must retain source BIN prefix byte-for-byte');
console.log('PASS: exact New Carl/Orc GLB hashes, animation proof, source mesh/skin preservation and Studio-ready assets.');
