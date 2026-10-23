import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const manifest=JSON.parse(readFileSync('data/new-tripo-full-animations.json','utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(readFileSync(manifest.sourceZip)),manifest.sourceZipSha256);
const catalog=JSON.parse(readFileSync('data/studio-models.json','utf8'));
function glb(bytes){
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  const jsonLength=bytes.readUInt32LE(12);assert.equal(bytes.readUInt32LE(16),0x4e4f534a);
  const json=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8'));
  const binAt=20+jsonLength;assert.equal(bytes.readUInt32LE(binAt+4),0x004e4942);
  return {json,bin:bytes.subarray(binAt+8,binAt+8+bytes.readUInt32LE(binAt))};
}
for(const asset of manifest.models){
  const bytes=readFileSync(asset.file);assert.equal(bytes.length,asset.sizeBytes,asset.id);
  assert.equal(hash(bytes),asset.sha256,asset.id);
  const c=catalog.models.find(x=>x.id===asset.id);assert.equal(c?.file,asset.file,asset.id);
  const baked=glb(bytes),original=glb(readFileSync(asset.original));
  for(const part of ['nodes','skins','meshes','materials','textures','images']){
    assert.deepEqual(baked.json[part],original.json[part],asset.id+' alters '+part);
  }
  assert.ok(baked.bin.subarray(0,original.bin.length).equals(original.bin),asset.id+' modified original BIN');
  assert.equal(baked.json.animations.length,17,asset.id);
  const names=new Set(baked.json.animations.map(a=>a.name));assert.equal(names.size,17);
  const skinBones=new Set(baked.json.skins[0].joints);
  for(const a of baked.json.animations){
    assert.equal(a.channels.length,66,a.name);
    assert.equal(a.channels.filter(ch=>ch.target.path==='translation').length,1,a.name);
    const rot=a.channels.filter(ch=>ch.target.path==='rotation');
    assert.equal(rot.length,65,a.name);
    for(const ch of rot)assert.ok(skinBones.has(ch.target.node),a.name);
    for(const sampler of a.samplers){
      assert.equal(sampler.interpolation,'LINEAR',a.name);
      const accessor=baked.json.accessors[sampler.input];
      assert.ok(accessor.count>=2,a.name);
    }
  }
  const proven=JSON.parse(readFileSync(asset.provenance,'utf8'));
  assert.equal(proven.count,17);assert.equal(proven.output_glb_sha256,asset.sha256);
  assert.ok(proven.all_source_nodes_and_skins_preserved);
}
console.log('PASS: original source ZIP + two SHA-matched GLBs, each with 17 distinct clips, preserves untouched Tripo meshes and skins.');
