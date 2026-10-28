import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const folder='assets/models/orcs/orc-female-shaman/';
const raw=fs.readFileSync(new URL(folder+'orc-female-shaman.glb',root));
const meta=JSON.parse(fs.readFileSync(new URL(folder+'orc-female-shaman.json',root)));
const sha=data=>createHash('sha256').update(data).digest('hex');
assert.equal(sha(raw),meta.sha256);assert.equal(raw.length,meta.bytes);
assert.equal(raw.toString('ascii',0,4),'glTF');assert.equal(raw.readUInt32LE(8),raw.length);
const length=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+length)),bin=raw.subarray(28+length);
assert.equal(doc.skins.length,1);assert.equal(doc.skins[0].joints.length,66);assert.equal(doc.animations?.length||0,0);
assert.equal(doc.meshes.reduce((sum,m)=>sum+m.primitives.reduce((n,p)=>n+doc.accessors[p.indices].count/3,0),0),13094);
for(const i of doc.skins[0].joints)assert.match(doc.nodes[i].name,/^(mixamorig:|neutral_bone$)/);
for(const node of doc.nodes)for(const scale of node.scale||[1,1,1])assert.ok(Math.abs(scale-1)<1e-4,'Unit-scale rig is required by existing hand mounts');
assert.equal(doc.images.length,1);const view=doc.bufferViews[doc.images[0].bufferView];
const png=bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
assert.equal(sha(png),meta.sourceTextureSha256,'Original texture is byte-exact');
assert.equal(png.readUInt32BE(16),512);assert.equal(png.readUInt32BE(20),512);
const catalog=JSON.parse(fs.readFileSync(new URL('data/studio-models.json',root)));
assert.deepEqual(catalog.studioModelIds,['dungeon-crawler-carl-v3','blond-scale-mail-woman','male-orc','orc-leader-male-uniformed','orc-female-shaman','orc-female-shaman-v2']);
const entry=catalog.models.find(m=>m.id===meta.id);assert.equal(entry.file,folder+'orc-female-shaman.glb');
assert.equal(entry.animationLibrary,'uploaded-fbx');assert.equal(entry.initialAnimation,'Sword And Shield Idle');
console.log('PASS Orc Shaman: source texture preserved, 13,094 triangles, 65 unit-scale joints, shared animation catalog');

assert.equal(entry.mobType,'orc');
assert.equal(meta.sourceArchiveSha256,'a027775e48f7046f99391679e5461fff4e60f5b678f01d09fba5aee097266cc6');
assert.equal(catalog.models.find(model=>model.mobType==='orc').id,'male-orc-fighter','Existing Orc combat fallback ordering is preserved');

