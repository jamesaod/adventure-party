import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const config=JSON.parse(readFileSync('data/blender-orc-turn-qa.json','utf8'));
const catalog=JSON.parse(readFileSync('data/studio-models.json','utf8'));
const libraryEntry=catalog.models.find(model=>model.id===config.modelId);
assert.ok(libraryEntry,'Blender QA model must appear in Model Library');
assert.equal(libraryEntry.file,config.qaModel.path);
assert.equal(libraryEntry.mobType,'orc');
assert.equal(libraryEntry.upAxis,'Y');
assert.equal(libraryEntry.retargetQa,undefined,'Embedded Blender turns play directly, without applying broken runtime retargeter');
for(const asset of [config.originalOrc, config.donorCarl,config.qaModel,config.blenderProject]){
  assert.ok(existsSync(asset.path),'Missing model or editable source: '+asset.path);
  const bytes=readFileSync(asset.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,
    'Original or saved QA bytes changed: '+asset.path);
  if(asset.sizeBytes)assert.equal(bytes.length,asset.sizeBytes);
}
assert.equal(config.status,'experimental-visual-qa-pending');

function glb(path){
  const bytes=readFileSync(path);
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  assert.equal(bytes.readUInt32LE(4),2);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  const jsonLength=bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16),0x4e4f534a);
  const doc=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8'));
  const binAt=20+jsonLength;
  assert.equal(bytes.readUInt32LE(binAt+4),0x004e4942);
  const binLength=bytes.readUInt32LE(binAt);
  assert.ok(binAt+8+binLength<=bytes.length);
  return {doc,bin:bytes.subarray(binAt+8,binAt+8+binLength)};
}
const source=glb(config.originalOrc.path);
const derived=glb(config.qaModel.path);
assert.equal(source.doc.animations?.length||0,0,'Original New Orc must remain animationless');
assert.equal(derived.doc.skins.length,1);
assert.equal(derived.doc.skins[0].joints.length,66);
assert.equal(derived.doc.meshes.length,source.doc.meshes.length);
assert.equal(derived.doc.textures.length,source.doc.textures.length);
assert.equal(derived.doc.images.length,source.doc.images.length);
assert.equal(derived.doc.animations.length,2);
assert.deepEqual(derived.doc.animations.map(a=>a.name),config.qaModel.clipNames);

const boneNames=derived.doc.skins[0].joints.map(i=>derived.doc.nodes[i].name);
assert.equal(new Set(boneNames).size,66);
for(const name of ['mixamorig:Hips','mixamorig:Spine','mixamorig:Spine1','mixamorig:Spine2',
  'mixamorig:LeftArm','mixamorig:RightArm','mixamorig:LeftUpLeg','mixamorig:RightUpLeg']){
  assert.ok(boneNames.includes(name),'Expected rig joint '+name);
}
function accessor(index){
  const a=derived.doc.accessors[index],v=derived.doc.bufferViews[a.bufferView];
  assert.equal(a.componentType,5126,'Animated quaternion frames must be float32');
  const components={SCALAR:1,VEC3:3,VEC4:4}[a.type];
  assert.ok(components,'Unsupported animation accessor format');
  const stride=v.byteStride||components*4,base=(v.byteOffset||0)+(a.byteOffset||0);
  const result=[];
  for(let i=0;i<a.count;i++) {
    const values=[];
    for(let k=0;k<components;k++){
      const index=base+i*stride+k*4;
      assert.ok(index+4<=derived.bin.length,'Truncated binary animation payload');
      values.push(derived.bin.readFloatLE(index));
    }
    assert.ok(values.every(Number.isFinite),'Non-finite animation values');
    result.push(values);
  }
  return result;
}
const hipNode=derived.doc.nodes.findIndex(node=>node.name==='mixamorig:Hips');
for(const [index,animation] of derived.doc.animations.entries()){
  assert.equal(animation.channels.length,198,'Blender exports 66 bones * 3 transform tracks');
  for(const path of ['rotation','translation','scale']){
    assert.equal(animation.channels.filter(ch=>ch.target.path===path).length,66);
  }
  const channel=animation.channels.find(ch=>
    ch.target.node===hipNode && ch.target.path==='rotation');
  assert.ok(channel,'Blender turning animation must include pelvis orientation');
  const sample=animation.samplers[channel.sampler];
  const times=accessor(sample.input).map(row=>row[0]);
  assert.ok(times.length>10,'Expected sampled turn animation');
  assert.ok(times.every((t,i)=>i===0||t>=times[i-1]));
  const values=accessor(sample.output);
  assert.equal(values.length,times.length);
  const first=values[0],last=values.at(-1);
  const dot=Math.abs(first.reduce((sum,x,k)=>sum+x*last[k],0));
  const angle=2*Math.acos(Math.min(1,Math.max(-1,dot)))*180/Math.PI;
  assert.ok(angle>65 && angle<125,'Turn '+index+' must preserve 90ish degree hip yaw (got '+angle.toFixed(1)+')');
}
const report=JSON.parse(readFileSync(config.qaReport,'utf8'));
assert.equal(report.repaired_vertices,39);
assert.equal(report.before.length,10);
assert.equal(report.after.length,10);
assert.equal(report.before.find(x=>x.fraction===0.5 && x.clip===config.measuredImprovement.clip).edges_gt_2x,55);
assert.equal(report.after.find(x=>x.fraction===0.5 && x.clip===config.measuredImprovement.clip).edges_gt_2x,56);
for(const path of config.scripts)assert.ok(existsSync(path),'Missing Blender pipeline source: '+path);
console.log('PASS: original Carl/Orc SHA preservation, Blender 66-bone 2-turn QA GLB, pelvis yaw, source .blend and conservative skin metrics');
