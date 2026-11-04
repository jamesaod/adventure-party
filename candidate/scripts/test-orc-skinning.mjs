import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { CROSS_LIMB_REPAIR, repairCrossLimbSkinning } from '../js/studio-skinning.mjs';

const root = new URL('../', import.meta.url);
const original = fs.readFileSync(new URL(
  'assets/models/orcs/male-orc-fighter/male-orc-fighter.glb',root
));
assert.equal(crypto.createHash('sha256').update(original).digest('hex'),
  'a0b63e9ae67c47779baf9e254660918c073ab1684237f528c43bb9f7e9f9c688',
  'The uploaded Orc source remains exactly unchanged');

const length=original.readUInt32LE(12);
const doc=JSON.parse(original.toString('utf8',20,20+length));
const bin=original.subarray(28+length);
function accessor(index){
  const a=doc.accessors[index],v=doc.bufferViews[a.bufferView];
  const info={5121:[1,'readUInt8'],5123:[2,'readUInt16LE'],
    5125:[4,'readUInt32LE'],5126:[4,'readFloatLE']}[a.componentType];
  const columns={SCALAR:1,VEC3:3,VEC4:4}[a.type];
  assert.ok(info&&columns,'Supported dense Orc mesh attribute');
  const offset=(v.byteOffset||0)+(a.byteOffset||0);
  const stride=v.byteStride||info[0]*columns;
  const values=[];
  for(let i=0;i<a.count;i++)for(let k=0;k<columns;k++)
    values.push(bin[info[1]](offset+i*stride+k*info[0]));
  return {values,columns};
}

class Attribute {
  constructor({values,columns}){
    this.array=Float32Array.from(values);
    this.itemSize=columns;
    this.count=this.array.length/columns;
    this.version=0;
  }
  getComponent(i,j){return this.array[i*this.itemSize+j]}
  getX(i){return this.getComponent(i,0)}
  getY(i){return this.getComponent(i,1)}
  getZ(i){return this.getComponent(i,2)}
  getW(i){return this.getComponent(i,3)}
  setXYZW(i,...values){
    assert.equal(values.length,4);
    this.array.set(values,i*4);
  }
  set needsUpdate(value){if(value)this.version++}
}

const primitive=doc.meshes[0].primitives[0];
const a=primitive.attributes;
const attrs={
  position:new Attribute(accessor(a.POSITION)),
  skinIndex:new Attribute(accessor(a.JOINTS_0)),
  skinWeight:new Attribute(accessor(a.WEIGHTS_0))
};
const index=new Attribute(accessor(primitive.indices));
// Mirror the real GLTFLoader: it sanitizes Mixamo colon-delimited bone
// names before attaching the Skeleton. This was missing from Rev 104 CI.
const threeSource=fs.readFileSync(new URL('assets/vendor/three/three.core.min.js',root));
const THREE=await import(`data:text/javascript;base64,${threeSource.toString('base64')}`);
const sanitizeName=THREE.PropertyBinding.sanitizeNodeName;
assert.equal(sanitizeName('mixamorig:LeftUpLeg'),'mixamorigLeftUpLeg');
assert.equal(sanitizeName('mixamorig:LeftHandPinky3'),'mixamorigLeftHandPinky3');

const object={
  isSkinnedMesh:true,
  geometry:{index,getAttribute(name){return attrs[name]}},
  skeleton:{bones:doc.skins[0].joints.map(i=>({name:sanitizeName(doc.nodes[i].name)}))}
};
const scene={traverse(visitor){visitor(object)}};
const initial=Float32Array.from(attrs.skinWeight.array);
const report=repairCrossLimbSkinning(scene,CROSS_LIMB_REPAIR);
assert.deepEqual({
  meshes:report.meshes,
  vertices:report.vertices,
  beforeMixed:report.beforeMixed,
  afterMixed:report.afterMixed,
  correctedVertices:report.correctedVertices,
  correctedComponents:report.correctedComponents,
  ambiguousComponents:report.ambiguousComponents
},{meshes:1,vertices:7008,beforeMixed:544,afterMixed:0,
  correctedVertices:750,correctedComponents:53,ambiguousComponents:0},
  'The real Orc input should have 544 cross-limb vertices eliminated in 53 components');
assert.equal(attrs.skinWeight.version,1,'Skin GPU weights must be invalidated');

let changedVertices=0;
for(let i=0;i<attrs.skinWeight.count;i++){
  const old=Array.from(initial.slice(i*4,i*4+4));
  const newer=Array.from(attrs.skinWeight.array.slice(i*4,i*4+4));
  const sum=newer.reduce((a,b)=>a+b,0);
  assert.ok(Math.abs(sum-1)<1e-5,'Normalized skin weights per vertex');
  if(newer.some((w,k)=>Math.abs(w-old[k])>1e-6))changedVertices++;
}
assert.equal(changedVertices,750,'Only the audited cross-limb surfaces are changed');
// Vertex 8 is near the upper thigh but originally inherited LeftHandPinky3 rotation.
assert.ok(initial[8*4+1]>0.2,'Fixture includes thigh-to-finger contamination');
const thighWeights=Array.from(attrs.skinWeight.array.slice(8*4,8*4+4));
const thighJoints=Array.from(attrs.skinIndex.array.slice(8*4,8*4+4));
for(let k=0;k<4;k++){
  const jointName=object.skeleton.bones[thighJoints[k]].name;
  if(jointName.includes('Hand'))assert.equal(thighWeights[k],0,'Thigh cannot follow finger joints');
}
assert.equal(repairCrossLimbSkinning(scene,CROSS_LIMB_REPAIR).correctedVertices,0,
  'Repair is idempotent when reopening a saved studio');
assert.throws(()=>repairCrossLimbSkinning(scene,'not-a-profile'),/Unknown skin repair profile/);
const catalog=JSON.parse(fs.readFileSync(new URL('data/studio-models.json',root),'utf8'));
const repairedOrcs=catalog.models.filter(model=>model.skinWeightRepair===CROSS_LIMB_REPAIR);
assert.deepEqual(repairedOrcs.map(model=>model.id).sort(),
  ['male-orc-fighter','male-orc-fighter-ual2-one-handed-proof'],
  'Only legacy Rev 104/105 Orc entries opt into skin-weight repair');
const untouched=catalog.models.find(model=>model.id==='male-orc-fighter-unmodified-source');
assert.ok(untouched&&!untouched.skinWeightRepair&&!untouched.animationBindRebase,
  'The raw Orc can be loaded without any corrections');
assert.ok(catalog.models.filter(model=>model.id.includes('carl'))
  .every(model=>model.skinWeightRepair===undefined),'No change to Carl models');

const studio=fs.readFileSync(new URL('js/3d-studio.mjs',root),'utf8');
assert.ok(studio.includes('repairCrossLimbSkinning(loaded.model, effectiveModelDefaults.skinWeightRepair)'),
  'The Studio applies in-memory correction when loading the saved Orc');
assert.ok(studio.includes('skinRepair: state.skinRepairReport'),
  'Browser QA reports the actual repair results');
console.log('PASS Orc cross-limb deformation repair: 544 mixed vertices removed, 750 corrected, original GLB unchanged');
