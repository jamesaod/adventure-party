import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const manifest=JSON.parse(readFileSync('data/new-tripo-qa-assets.json','utf8'));
const catalog=JSON.parse(readFileSync('data/studio-models.json','utf8'));
const byteArrays=new Map(), parsed=new Map();
for(const asset of manifest.models) {
  assert.ok(existsSync(asset.path),`Missing repository-backed GLB: ${asset.path}`);
  assert.ok(catalog.models.some(model=>model.id===asset.id&&model.file===asset.path),`Uncataloged GLB: ${asset.id}`);
  const raw=readFileSync(asset.path);
  assert.equal(raw.length,asset.sizeBytes,`Wrong byte size: ${asset.path}`);
  assert.equal(createHash('sha256').update(raw).digest('hex'),asset.sha256,`Wrong SHA: ${asset.path}`);
  assert.equal(raw.toString('ascii',0,4),'glTF');
  assert.equal(raw.readUInt32LE(4),2);
  assert.equal(raw.readUInt32LE(8),raw.length);
  const jsonLength=raw.readUInt32LE(12);
  assert.equal(raw.readUInt32LE(16),0x4e4f534a);
  const json=JSON.parse(raw.subarray(20,20+jsonLength).toString('utf8'));
  const binAt=20+jsonLength;
  assert.equal(raw.readUInt32LE(binAt+4),0x004e4942);
  const binLength=raw.readUInt32LE(binAt);
  assert.ok(binAt+8+binLength<=raw.length);
  const bin=raw.subarray(binAt+8,binAt+8+binLength);
  assert.ok(json.skins?.[0]?.joints?.length>=60);
  const expected=asset.animated?(asset.clipCount||1):0;
  assert.equal(json.animations?.length||0,expected,`Wrong clip count: ${asset.path}`);
  if(expected) {
    const names=json.animations.map(animation=>animation.name);
    assert.equal(new Set(names).size,names.length,`Duplicated names in ${asset.path}`);
    for(const animation of json.animations) {
      assert.equal(animation.channels.length,66,`Wrong track count in ${asset.path}`);
      assert.ok(animation.samplers.length>0);
    }
    if(asset.clip)assert.equal(names[0],asset.clip);
    if(expected===17)assert.ok(names.every(name=>name.startsWith('Mixamo_')));
  }
  parsed.set(asset.id,json);byteArrays.set(asset.id,bin);
}
for(const [derivedId,sourceId] of [
 ['new-carl-mixamo-baked-proof','new-carl-tripo-source'],
 ['new-carl-mixamo-sword-shield-full-17','new-carl-tripo-source'],
 ['new-orc-mixamo-sword-shield-full-17','new-orc-tripo-source']
]) {
 const src=parsed.get(sourceId), derived=parsed.get(derivedId);
 assert.ok(src&&derived);
 for(const key of ['nodes','skins','meshes','materials','textures','images'])
  assert.deepEqual(derived[key],src[key],`Offline bake altered source ${key}: ${derivedId}`);
 const original=byteArrays.get(sourceId), baked=byteArrays.get(derivedId);
 assert.ok(baked.subarray(0,original.length).equals(original),`Source BIN not preserved: ${derivedId}`);
}
console.log('PASS: SHA-verified GLBs, 17+17 clips, source meshes/skins and binary prefixes intact.');
