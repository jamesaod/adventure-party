import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {semanticBoneMap,humanoidFingerChains,HUMANOID_CORE_ROLES,semanticRoleForBoneName} from '../js/humanoid-rig.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../data/studio-models.json',import.meta.url)));
const entry=catalog.models.find(m=>m.id==='tripo-elf-archer-cc5');assert(entry);assert(catalog.studioModelIds.includes(entry.id));assert.equal(entry.animationLibrary,undefined,'Use embedded CC5 clips, not automatic retargeting');
const bytes=fs.readFileSync(new URL('../'+entry.file,import.meta.url));const original=fs.readFileSync(new URL('../assets/source-characters/tripo-elf-archer/Tripo-Elf-CC5.glb',import.meta.url));assert(bytes.equals(original),'Runtime must preserve validated export bytes');
const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));const names=new Set(json.skins.flatMap(s=>s.joints).map(i=>json.nodes[i].name));const model={traverse(fn){for(const name of names)fn({isBone:true,name});}};
const roles=semanticBoneMap(model);for(const role of HUMANOID_CORE_ROLES)assert(roles.has(role),'Missing '+role);assert.equal(roles.get('hips').name,'CC_Base_Hip');assert.equal(roles.get('rightHand').name,'CC_Base_R_Hand');assert.equal(roles.get('leftHand').name,'CC_Base_L_Hand');for(const side of ['left','right'])assert.equal(humanoidFingerChains(model,side).length,5);
for(const name of ['CC_Base_L_ElbowShareBone','CC_Base_R_UpperarmTwist01','CC_Base_L_ToeBaseShareBone'])assert.equal(semanticRoleForBoneName(name),null,'Helper must not replace deform bone');
assert.equal(json.animations.length,7);for(const a of json.animations){for(const hand of ['CC_Base_L_Hand','CC_Base_R_Hand'])assert(a.channels.some(c=>json.nodes[c.target.node].name===hand&&c.target.path==='rotation'),'Missing animated '+hand);}
const tris=json.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+json.accessors[p.indices].count/3,0);assert.equal(tris,10703);
console.log('PASS Tripo CC5 elf: exact export bytes, 10,703 triangles, seven animations, 20 core roles, both hands and ten finger chains. SHA256 '+crypto.createHash('sha256').update(bytes).digest('hex'));
