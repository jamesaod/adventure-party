import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const root=new URL('../',import.meta.url);
const originalPath='assets/models/dungeon-crawler-carl/v2/dungeon-crawler-carl-v2.glb';
const auditionPath='assets/models/dungeon-crawler-carl/v2-ual2-two-handed-audition/dungeon-crawler-carl-v2-ual2-two-handed-audition.glb';
const provenancePath='assets/models/dungeon-crawler-carl/v2-ual2-two-handed-audition/provenance.json';

function readGlb(path){
  const bytes=fs.readFileSync(new URL(path,root));
  assert.equal(bytes.readUInt32LE(0),0x46546c67,'GLB magic');
  assert.equal(bytes.readUInt32LE(4),2,'glTF 2');
  assert.equal(bytes.readUInt32LE(8),bytes.length,'complete GLB');
  let json=null,binary=null;
  for(let offset=12;offset<bytes.length;){
    const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);
    const chunk=bytes.subarray(offset+8,offset+8+length);
    assert.equal(chunk.length,length,'complete chunk');
    if(type===0x4e4f534a)json=JSON.parse(chunk.toString('utf8'));
    if(type===0x004e4942)binary=chunk;
    offset+=8+length;
  }
  assert.ok(json&&binary,'JSON and BIN chunks');
  return {bytes,json,binary};
}

const original=readGlb(originalPath);
const audition=readGlb(auditionPath);
const provenance=JSON.parse(fs.readFileSync(new URL(provenancePath,root),'utf8'));

assert.equal(audition.bytes.length,11896352);
assert.equal(
  crypto.createHash('sha256').update(audition.bytes).digest('hex'),
  '927a426125dfba802fafc1418e7f5406cc1767a2575dc32a1772910f9bcfbffb'
);
assert.equal(provenance.output.bytes,audition.bytes.length);
assert.equal(provenance.output.sha256,'927a426125dfba802fafc1418e7f5406cc1767a2575dc32a1772910f9bcfbffb');
assert.equal(provenance.source.sha256,'8cee20ab1bc55130092447e810e26df22dd2803eccc54f52137a7d54d7ab88a8');

const expected=[
  'UAL2_2H_Sword_Heavy_Combo',
  'UAL2_2H_Sword_Regular_Combo',
  'UAL2_2H_Sword_Regular_B',
  'UAL2_2H_Sword_Regular_C',
  'UAL2_2H_TreeChopping_Loop'
];
assert.deepEqual(audition.json.animations.slice(0,5).map(a=>a.name),expected);
assert.deepEqual(audition.json.animations.slice(5).map(a=>a.name),['box_01','fall','box_02','box_03']);
assert.deepEqual(provenance.output.clips.map(c=>c.outputName),expected);
for(const animation of audition.json.animations.slice(0,5)){
  assert.equal(animation.channels.length,65,animation.name+' has 65 target channels');
}
for(const key of ['asset','scene','scenes','nodes','meshes','materials','skins','textures','images','samplers']){
  assert.deepEqual(audition.json[key],original.json[key],key+' preserved');
}
assert.deepEqual(
  audition.json.accessors.slice(0,original.json.accessors.length),
  original.json.accessors,
  'original accessors preserved'
);
assert.deepEqual(
  audition.json.bufferViews.slice(0,original.json.bufferViews.length),
  original.json.bufferViews,
  'original buffer views preserved'
);
assert.ok(
  audition.binary.subarray(0,original.json.buffers[0].byteLength)
    .equals(original.binary.subarray(0,original.json.buffers[0].byteLength)),
  'original Carl binary prefix preserved'
);

const catalog=JSON.parse(fs.readFileSync(new URL('data/studio-models.json',root),'utf8'));
assert.equal(catalog.models.some(m=>m.id==='dungeon-crawler-carl-v2'),true,'Ver 2 remains selectable');
assert.equal(catalog.models.some(m=>m.id==='dungeon-crawler-carl-v2-ual2-sword-test'),true,'UAL2 Sword Test remains selectable');
const entry=catalog.models.find(m=>m.id==='dungeon-crawler-carl-v2-ual2-two-handed-audition');
assert.ok(entry,'two-handed audition model is selectable');
assert.equal(entry.label,'Dungeon Crawler Carl — UAL2 Two-Handed Audition');
assert.equal(entry.file,auditionPath);
assert.equal(entry.upAxis,'Y');
assert.equal(entry.mobType,'fighter');

console.log('PASS Carl UAL2 two-handed audition: five retargeted clips, original Carl preserved, Studio entry registered');
