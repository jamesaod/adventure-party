import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const source='assets/models/humans/woman-warrior/woman-warrior.glb';
const animated='assets/models/humans/woman-warrior/mixamo-sword-shield-full-17/woman-warrior-mixamo-sword-shield-full-17.glb';
const sha=(data)=>createHash('sha256').update(data).digest('hex');
function parse(path){
 const raw=readFileSync(new URL(path,root));
 assert.equal(raw.toString('ascii',0,4),'glTF');
 assert.equal(raw.readUInt32LE(4),2);
 assert.equal(raw.readUInt32LE(8),raw.length);
 const length=raw.readUInt32LE(12);
 assert.equal(raw.readUInt32LE(16),0x4e4f534a);
 const json=JSON.parse(raw.subarray(20,20+length).toString('utf8'));
 const binOffset=20+length;
 assert.equal(raw.readUInt32LE(binOffset+4),0x004e4942);
 const bin=raw.subarray(binOffset+8,binOffset+8+raw.readUInt32LE(binOffset));
 return {raw,json,bin};
}
const base=parse(source),baked=parse(animated);
const provenance=JSON.parse(readFileSync(new URL('assets/models/humans/woman-warrior/mixamo-sword-shield-full-17/provenance.json',root),'utf8'));
assert.equal(sha(base.raw),'525ec9bb48ebac5ceadd9f6fddd8e4a22451b74608527392107dbc136ce76d4d');
assert.equal(sha(base.raw),provenance.original_sha256);
assert.equal(sha(baked.raw),provenance.output_sha256);
assert.equal(base.json.animations?.length||0,0);
assert.equal(base.json.skins[0].joints.length,65);
assert.equal(baked.json.animations?.length,17);
assert.equal(new Set(baked.json.animations.map(clip=>clip.name)).size,17);
for(const clip of baked.json.animations){
 assert.ok(clip.name.startsWith('Mixamo_'));
 assert.equal(clip.channels.length,66);
 assert.ok(clip.samplers.length===66);
}
for(const key of ['nodes','scenes','scene','skins','meshes','materials','textures','images'])
 assert.deepEqual(baked.json[key],base.json[key],`Source ${key} was modified`);
assert.ok(baked.bin.subarray(0,base.bin.length).equals(base.bin),'Original binary prefix must remain byte-exact');
const catalog=JSON.parse(readFileSync(new URL('data/studio-models.json',root)));
assert.equal(catalog.models.find(x=>x.id==='woman-warrior-tripo-source')?.file,source);
assert.equal(catalog.models.find(x=>x.id==='woman-warrior-mixamo-sword-shield-full-17')?.file,animated);
assert.ok(provenance.bind_quaternion_mismatch_degrees['mixamorig:RightArm']>170,'Preserve right-arm bind mismatch warning for visual QA');
// Orc and Carl retain their own catalog-scoped grips. Both Warrior variants
// select the same reusable configuration via the normal sword selector/Reset.
const warriorProfile='tripo-woman-warrior-one-hand-sword-v1';
const grip=catalog.weaponAttachmentProfiles[warriorProfile];
assert.equal(grip.weaponId,'medieval-sword');
assert.equal(grip.status,'user-calibrated');
assert.deepEqual(grip.position,[-0.010,0.065,0.010]);
assert.deepEqual(grip.rotation,[0,-90,180]);
for (const id of ['woman-warrior-tripo-source','woman-warrior-mixamo-sword-shield-full-17'])
 assert.equal(catalog.models.find(entry=>entry.id===id).weaponAttachmentProfileId,warriorProfile);
for (const model of catalog.models.filter(entry=>entry.id.startsWith('new-orc-')))
 assert.equal(model.weaponAttachmentProfileId,'tripo-mixamo-orc-one-hand-sword-upward-v2');
for (const model of catalog.models.filter(entry=>/carl/.test(entry.id)))
 assert.equal(model.weaponAttachmentProfileId,undefined);
const studio=readFileSync(new URL('js/3d-studio.mjs',root),'utf8');
assert.ok(studio.includes("profileId === 'tripo-woman-warrior-one-hand-sword-v1'"));
assert.ok(studio.includes('changeEquipment(defaultEquipmentSettingsForModel(ui.RightHandWeapon.value))'));
assert.ok(studio.includes('changeEquipment(defaultEquipmentSettingsForModel(equipment.snapshot().settings.rightHand))'));
console.log('PASS Woman Warrior: original bytes, 65 joints, 17 animations, retained skins and model-specific sword grip');
