import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const threeSource=fs.readFileSync(new URL('assets/vendor/three/three.core.min.js',root));
const THREE=await import(`data:text/javascript;base64,${threeSource.toString('base64')}`);

function readGlb(relative){
  const bytes=fs.readFileSync(new URL(relative,root));
  assert.equal(bytes.readUInt32LE(0),0x46546c67,`${relative}: GLB magic`);
  assert.equal(bytes.readUInt32LE(4),2,`${relative}: GLB version`);
  assert.equal(bytes.readUInt32LE(8),bytes.length,`${relative}: declared length`);
  let json=null,binary=null;
  for(let offset=12;offset<bytes.length;){
    const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);
    const chunk=bytes.subarray(offset+8,offset+8+length);
    if(type===0x4e4f534a)json=JSON.parse(chunk.toString('utf8').replace(/\0+$/,'').trimEnd());
    if(type===0x004e4942)binary=chunk;
    offset+=8+length;
  }
  assert.ok(json&&binary,`${relative}: JSON and BIN chunks`);
  const accessor=index=>{
    const value=json.accessors[index],view=json.bufferViews[value.bufferView];
    const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[value.type];
    assert.equal(value.componentType,5126,'Proof animation accessors are float32');
    const base=(view.byteOffset||0)+(value.byteOffset||0),stride=view.byteStride||components*4;
    return Array.from({length:value.count},(_,row)=>
      Array.from({length:components},(_,component)=>binary.readFloatLE(base+row*stride+component*4)));
  };
  return {bytes,json,binary,accessor};
}

const originalPath='assets/models/orcs/male-orc-fighter/male-orc-fighter.glb';
const proofPath='assets/models/orcs/male-orc-fighter/ual2-one-handed/male-orc-fighter-ual2-one-handed.glb';
const original=readGlb(originalPath),proof=readGlb(proofPath);

assert.equal(crypto.createHash('sha256').update(original.bytes).digest('hex'),
  'a0b63e9ae67c47779baf9e254660918c073ab1684237f528c43bb9f7e9f9c688',
  'Original Orc source remains exact');
assert.equal(crypto.createHash('sha256').update(proof.bytes).digest('hex'),
  '2f88c4062f2fdba6b8738e0296a1e5764cff94f3e716153ea1e374475d7831d0',
  'Carl-method Orc proof identity');

for(const key of ['asset','scene','scenes','nodes','meshes','skins','materials','textures','images','samplers']){
  assert.deepEqual(proof.json[key],original.json[key],`Proof preserves original ${key}`);
}
assert.deepEqual(proof.json.accessors.slice(0,original.json.accessors.length),original.json.accessors,
  'Proof preserves original accessors');
assert.deepEqual(proof.json.bufferViews.slice(0,original.json.bufferViews.length),original.json.bufferViews,
  'Proof preserves original buffer views');
assert.ok(proof.binary.subarray(0,original.json.buffers[0].byteLength)
  .equals(original.binary.subarray(0,original.json.buffers[0].byteLength)),
  'Proof preserves original Orc mesh/skin/texture binary prefix');
assert.equal(original.json.animations?.length||0,0,'Original Orc remains animationless');

assert.deepEqual(proof.json.animations.map(animation=>animation.name),
  ['UAL2_Sword_Ready','UAL2_Sword_Regular_A'],'Proof embeds only the approved one-handed clips');
assert.equal(proof.json.animations[0].channels.length,65,'Ready has 64 rotations plus hips translation');
assert.equal(proof.json.animations[1].channels.length,65,'Attack has 64 rotations plus hips translation');

const objects=proof.json.nodes.map((node,index)=>{
  const isJoint=proof.json.skins[0].joints.includes(index);
  const object=isJoint?new THREE.Bone():new THREE.Group();
  object.name=node.name||'';
  if(node.matrix)new THREE.Matrix4().fromArray(node.matrix).decompose(object.position,object.quaternion,object.scale);
  else{
    object.position.fromArray(node.translation||[0,0,0]);
    object.quaternion.fromArray(node.rotation||[0,0,0,1]);
    object.scale.fromArray(node.scale||[1,1,1]);
  }
  return object;
});
proof.json.nodes.forEach((node,index)=>(node.children||[]).forEach(child=>objects[index].add(objects[child])));
const character=new THREE.Group();
for(const index of proof.json.scenes[proof.json.scene||0].nodes)character.add(objects[index]);

const ready=proof.json.animations[0];
for(const channel of ready.channels){
  const sampler=ready.samplers[channel.sampler];
  const values=proof.accessor(sampler.output);
  const object=objects[channel.target.node],value=values[0];
  if(channel.target.path==='rotation')object.quaternion.fromArray(value);
  else if(channel.target.path==='translation')object.position.fromArray(value);
}
character.updateWorldMatrix(true,true);
const byName=new Map(objects.map(object=>[object.name,object]));
const pos=name=>byName.get(name).getWorldPosition(new THREE.Vector3());
const hips=pos('mixamorig:Hips');
const leftHand=pos('mixamorig:LeftHand'),rightHand=pos('mixamorig:RightHand');
const leftFore=pos('mixamorig:LeftForeArm'),rightFore=pos('mixamorig:RightForeArm');
assert.ok(leftHand.x>hips.x+0.12 && leftFore.x>hips.x+0.10,
  `Ready left arm must remain on anatomical left: hips ${hips.x}, forearm ${leftFore.x}, hand ${leftHand.x}`);
assert.ok(rightHand.x<hips.x-0.12 && rightFore.x<hips.x-0.10,
  `Ready right arm must remain on anatomical right: hips ${hips.x}, forearm ${rightFore.x}, hand ${rightHand.x}`);

const catalog=JSON.parse(fs.readFileSync(new URL('data/studio-models.json',root),'utf8'));
const raw=catalog.models.find(model=>model.id==='male-orc-fighter');
const derived=catalog.models.find(model=>model.id==='male-orc-fighter-ual2-one-handed-proof');
assert.ok(raw&&!raw.animationFamilies,'Raw Orc remains untouched and does not runtime-retarget animations');
assert.equal(raw.skinWeightRepair,'cross-limb-components-v1','Raw Orc opts into in-memory cross-limb cleanup');
assert.deepEqual(derived,{
  id:'male-orc-fighter-ual2-one-handed-proof',
  label:'Male Orc Fighter — UAL2 One-Handed Proof',
  file:proofPath,
  upAxis:'Y',
  mobType:'orc',
  skinWeightRepair:'cross-limb-components-v1'
},'Derived proof is a separate Studio Model Library entry');

const provenance=JSON.parse(fs.readFileSync(new URL(
  'assets/models/orcs/male-orc-fighter/ual2-one-handed/provenance.json',root),'utf8'));
assert.equal(provenance.source.sha256,'8cee20ab1bc55130092447e810e26df22dd2803eccc54f52137a7d54d7ab88a8');
assert.equal(provenance.target.sha256,'a0b63e9ae67c47779baf9e254660918c073ab1684237f528c43bb9f7e9f9c688');
assert.equal(provenance.referenceTarget.sha256,'5284bd3cd0b9fe6665c5d94ec0fc7fae8ec4a5856f0628f3084ae1190b044693');
assert.equal(provenance.output.sha256,'2f88c4062f2fdba6b8738e0296a1e5764cff94f3e716153ea1e374475d7831d0');

console.log('PASS Orc Carl-method UAL2 proof: source preserved, clips baked, ready arms remain on anatomical sides');
