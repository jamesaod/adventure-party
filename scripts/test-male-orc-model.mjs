import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const folder='assets/models/orcs/male-orc/';
const raw=fs.readFileSync(new URL(folder+'male-orc.glb',root));
const meta=JSON.parse(fs.readFileSync(new URL(folder+'male-orc.json',root)));
const sha=data=>createHash('sha256').update(data).digest('hex');
assert.equal(sha(raw),meta.sha256);assert.equal(raw.length,meta.bytes);
assert.equal(raw.toString('ascii',0,4),'glTF');assert.equal(raw.readUInt32LE(8),raw.length);
const length=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+length)),bin=raw.subarray(28+length);
assert.equal(doc.skins.length,1);assert.equal(doc.skins[0].joints.length,65);assert.equal(doc.animations?.length||0,0);
assert.equal(doc.meshes.reduce((sum,m)=>sum+m.primitives.reduce((n,p)=>n+doc.accessors[p.indices].count/3,0),0),11519);
for(const i of doc.skins[0].joints)assert.match(doc.nodes[i].name,/^mixamorig:/);
for(const node of doc.nodes)for(const scale of node.scale||[1,1,1])assert.ok(Math.abs(scale-1)<1e-4,'Unit-scale rig is required by existing hand mounts');
assert.equal(doc.images.length,1);const view=doc.bufferViews[doc.images[0].bufferView];
const png=bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
assert.equal(sha(png),meta.sourceTextureSha256,'Original texture is byte-exact');
assert.equal(png.readUInt32BE(16),2048);assert.equal(png.readUInt32BE(20),2048);
const catalog=JSON.parse(fs.readFileSync(new URL('data/studio-models.json',root)));
assert.deepEqual(catalog.studioModelIds,['dungeon-crawler-carl-v3','blond-scale-mail-woman','male-orc','orc-leader-male-uniformed','orc-female-shaman']);
const entry=catalog.models.find(m=>m.id===meta.id);assert.equal(entry.file,folder+'male-orc.glb');
assert.equal(entry.animationLibrary,'uploaded-fbx');assert.equal(entry.initialAnimation,'Sword And Shield Idle');
console.log('PASS Male Orc: source texture preserved, 11,519 triangles, 65 unit-scale joints, shared animation catalog');

assert.equal(entry.mobType,'orc');
assert.equal(meta.sourceArchiveSha256,'b2ba66853edcd1376e73daa419fcdd59de8d23c77704969c847143aed6752f25');
assert.equal(catalog.models.find(model=>model.mobType==='orc').id,'male-orc-fighter','Existing Orc combat fallback ordering is preserved');

// Exercise the actual catalog parser and selector/reset resolver, including
// preset-revision migration that previously discarded non-sword overrides.
const {default:vm}=await import('node:vm');
const {studioWeapon,normalizeEquipment,STUDIO_WEAPONS}=await import('../js/studio-equipment.mjs');
assert.equal(entry.label,'Orc, Male, Uniformed');
const studio=fs.readFileSync(new URL('js/3d-studio.mjs',root),'utf8');
const parser=studio.slice(studio.indexOf('      const profileIds = entry.weaponAttachmentProfileIds'),studio.indexOf('      ids.add(entry.id);'));
const profiles=vm.runInNewContext(`(()=>{${parser};return weaponAttachmentProfiles;})()`,{entry,attachmentProfiles:catalog.weaponAttachmentProfiles,studioWeapon});
const model={...entry,weaponAttachmentProfiles:profiles};
const state={libraryModels:[model],libraryModelId:'male-orc'};
const resolver=studio.slice(studio.indexOf('function defaultEquipmentSettingsForModel('),studio.indexOf('async function changeEquipment('));
const resolve=vm.runInNewContext(`${resolver};defaultEquipmentSettingsForModel`,{state,normalizeEquipment});
for(const weapon of STUDIO_WEAPONS){
 const settings=resolve(weapon.id);
 if((weapon.handsRequired||1)===1){
  assert.deepEqual(settings.position,[-0.020,0.050,0.005],weapon.id);
  assert.deepEqual(settings.rotation,[161,-46,15],weapon.id);
 }else if(weapon.id==='medieval-two-handed-sword'){
  assert.deepEqual(settings.position,[-0.045,0.065,0.060]);
  assert.deepEqual(settings.rotation,[-114,-16,-30]);
 }else if(weapon.id==='spear'){
  assert.deepEqual(settings.position,[-0.010,0.030,-0.060]);
  assert.deepEqual(settings.rotation,[100,77,-43]);
  assert.equal(settings.sizePercent,100);
 }else assert.deepEqual(settings,normalizeEquipment({rightHand:weapon.id}),'Other two-handed presets unchanged');
 assert.equal(settings.sizePercent,weapon.defaultSizePercent||100);
 assert.deepEqual(settings.secondaryGripOffsetInches,[0,0,0]);
 assert.deepEqual(normalizeEquipment({...settings,position:[0.1,0.2,0.3]}).position,[0.1,0.2,0.3],'Saved custom grips remain adjustable');
}
const leader=catalog.models.find(m=>m.id==='orc-leader-male-uniformed');
const carl=catalog.models.find(m=>m.id==='dungeon-crawler-carl-v3');
for(const other of [leader,carl]){
 const otherProfiles=vm.runInNewContext(`(()=>{${parser};return weaponAttachmentProfiles;})()`,{entry:other,attachmentProfiles:catalog.weaponAttachmentProfiles,studioWeapon});
 state.libraryModels.push({...other,weaponAttachmentProfiles:otherProfiles});
 state.libraryModelId=other.id;
 for(const weapon of STUDIO_WEAPONS)assert.deepEqual(resolve(weapon.id),normalizeEquipment({rightHand:weapon.id}),`${other.label} retains global weapon defaults`);
}
console.log('PASS regular Orc calibration retained; Orc Leader and Carl resolve identical equipment defaults');
