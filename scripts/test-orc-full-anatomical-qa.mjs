import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { retargetHumanoidClip } from '../js/mixamo-retarget.mjs';

const THREE = await import('data:text/javascript;base64,' +
  readFileSync(new URL('../assets/vendor/three/three.core.min.js', import.meta.url)).toString('base64'));
const carlPath='assets/models/dungeon-crawler-carl/new-carl/mixamo-sword-shield-full-17/new-carl-mixamo-sword-shield-full-17.glb';
const orcPath='assets/models/orcs/new-orc/new-orc.glb';
const catalog=JSON.parse(readFileSync('data/studio-models.json','utf8'));
const entry=catalog.models.find(model=>model.id==='new-orc-retarget-anatomical-full-17-qa');
const proof=catalog.models.find(model=>model.id==='new-orc-retarget-anatomical-aim-qa');
const provenance=JSON.parse(readFileSync(
  'assets/models/dungeon-crawler-carl/new-carl/mixamo-sword-shield-full-17/provenance.json','utf8'));
assert.ok(entry && proof,'Separate single-clip proof and all-17 QA entries remain available');
assert.equal(entry.file,orcPath,'Orc model is the exact untouched source');
assert.equal(proof.file,orcPath,'Original one-clip proof also retained');
assert.equal(entry.retargetQa.carrier,carlPath);
assert.equal(entry.retargetQa.mode,'anatomical-aim');
assert.equal(entry.retargetQa.initialClip,'Mixamo_sword_and_shield_idle');
assert.deepEqual(entry.retargetQa.clips,provenance.clips.map(clip=>clip.name),
  'Catalog must include all seventeen independently verified original clip names in donor order');
assert.equal(entry.retargetQa.clips.length,17);
assert.deepEqual(proof.retargetQa.clips,['Mixamo_sword_and_shield_attack'],
  'Do not expand or replace existing known-good single-clip proof');
for(const name of ['Mixamo_sword_and_shield_idle','Mixamo_sword_and_shield_block_idle',
  'Mixamo_sword_and_shield_block'])assert.ok(entry.retargetQa.clips.includes(name));

function parseGlb(path) {
  const bytes=readFileSync(path);
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  const jsonLength=bytes.readUInt32LE(12);
  const doc=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8'));
  const binaryStart=20+jsonLength;
  assert.equal(bytes.readUInt32LE(binaryStart+4),0x004e4942);
  return {doc,buffer:bytes.subarray(binaryStart+8)};
}
const carl=parseGlb(carlPath), orc=parseGlb(orcPath);
assert.equal(orc.doc.animations?.length||0,0,'Pristine Orc model remains animationless');
assert.equal(carl.doc.animations.length,17,'Carl source has exactly 17 embedded animations');

function makeRig(doc) {
  const parts=doc.nodes.map(node=>{
    const obj=node.name?.startsWith('mixamorig:')?new THREE.Bone():new THREE.Object3D();
    obj.name=node.name||'';
    if(node.matrix)new THREE.Matrix4().fromArray(node.matrix)
      .decompose(obj.position,obj.quaternion,obj.scale);
    else {
      obj.position.fromArray(node.translation||[0,0,0]);
      obj.quaternion.fromArray(node.rotation||[0,0,0,1]);
      obj.scale.fromArray(node.scale||[1,1,1]);
    }
    return obj;
  });
  doc.nodes.forEach((node,i)=>(node.children||[]).forEach(child=>parts[i].add(parts[child])));
  const scene=new THREE.Group();
  for(const root of doc.scenes?.[doc.scene||0]?.nodes||[])scene.add(parts[root]);
  scene.updateWorldMatrix(true,true);
  return {scene,parts};
}
const source=makeRig(carl.doc),target=makeRig(orc.doc);
const srcBones=source.parts.filter(o=>o.isBone),tgtBones=target.parts.filter(o=>o.isBone);
const original=()=>{
  const copy=rig=>rig.parts.filter(o=>o.isBone).map(b=>[b.name,...b.position.toArray(),...b.quaternion.toArray()]);
  return JSON.stringify({source:copy(source),target:copy(target)});
};
const originalPose=original();

function readAccessor(glb,index){
  const a=glb.doc.accessors[index], view=glb.doc.bufferViews[a.bufferView];
  assert.equal(a.componentType,5126,'Expected float32 animation');
  assert.equal(a.normalized||false,false,'No normalized animation accessor');
  const n={SCALAR:1,VEC3:3,VEC4:4}[a.type];
  assert.ok(n,'Unsupported animation track accessor '+a.type);
  const stride=view.byteStride||n*4,base=(view.byteOffset||0)+(a.byteOffset||0);
  assert.ok(base+(a.count-1)*stride+n*4<=glb.buffer.length);
  const values=new Float32Array(a.count*n);
  for(let row=0;row<a.count;row++)
    for(let col=0;col<n;col++)
      values[row*n+col]=glb.buffer.readFloatLE(base+row*stride+4*col);
  assert.ok(values.every(Number.isFinite),'Finite animation channel');
  return values;
}

const clipNames=[];
for(const gltfClip of carl.doc.animations){
  clipNames.push(gltfClip.name);
  const tracks=[];
  let translations=0,rotations=0;
  for(const channel of gltfClip.channels){
    const sampler=gltfClip.samplers[channel.sampler];
    const joint=source.parts[channel.target.node];
    assert.ok(joint?.isBone,'Carrier animation channels target mapped joints');
    const times=readAccessor(carl,sampler.input);
    const values=readAccessor(carl,sampler.output);
    if(channel.target.path==='rotation'){
      rotations++;
      tracks.push(new THREE.QuaternionKeyframeTrack(joint.uuid+'.quaternion',times,values));
    }else if(channel.target.path==='translation'){
      translations++;
      assert.equal(joint.name,'mixamorig:Hips','Only hips translation is baked');
      tracks.push(new THREE.VectorKeyframeTrack(joint.uuid+'.position',times,values));
    }else throw Error('Unexpected animation channel '+channel.target.path);
  }
  assert.equal(rotations,65,'All 65 skeleton bones receive rotation channels');
  assert.equal(translations,1,'Every action contains explicit vertical hip translation');
  const clip=new THREE.AnimationClip(gltfClip.name,-1,tracks);
  const retarget=retargetHumanoidClip(THREE,clip,source.scene,target.scene,
    'QA Bone Direction + Hip Y — '+gltfClip.name,{mode:'anatomical-aim'});
  assert.equal(retarget.userData.humanoidImport.retargetMode,
    'anatomical-child-direction-with-hip-y');
  assert.ok(retarget.userData.humanoidImport.hipYTransferred);
  assert.ok(retarget.userData.humanoidImport.aimedBoneRoles.length>=35);
  const mapped=retarget.userData.humanoidImport.mappedTracks;
  // mappedTracks already includes the hips position track. The 65 original
  // donor joints need not all be recognized by the semantic-role adapter.
  const rotCount=retarget.tracks.filter(t=>t.ValueTypeName==='quaternion').length;
  const hipCount=retarget.tracks.filter(t=>t.ValueTypeName==='vector').length;
  assert.ok(rotCount>=60,'At least 60 compatible animated skeleton joints; got '+rotCount);
  assert.equal(hipCount,1,'One target hips position track is preserved');
  assert.equal(retarget.tracks.length,mapped,'Import diagnostic counts both quaternion and hips tracks');
  assert.ok(retarget.duration>0,'Clip duration is positive');
  assert.ok(retarget.tracks.every(t=>t.values.every(Number.isFinite)),
    'All target animation samples remain finite');
  assert.equal(original(),originalPose,'Every bake leaves original source and target rest poses unchanged');
}
assert.deepEqual(clipNames,entry.retargetQa.clips,'All 17 donor animations retargeted in saved order');
console.log('PASS Rev 113: all 17 real Carl donor clips retargeted against original Orc with 60+ mapped semantic joints and hips Y; preserved binds and original one-clip proof');
