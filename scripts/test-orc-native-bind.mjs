import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { ORC_NATIVE_BIND_REBASE, unpackCarlReference, rebaseOrcUal2Clips } from '../js/studio-orc-native-bind.mjs';

const root = new URL('../', import.meta.url);
const vendor = fs.readFileSync(new URL('assets/vendor/three/three.core.min.js', root));
const THREE = await import(`data:text/javascript;base64,${vendor.toString('base64')}`);

function glb(path) {
  const bytes = fs.readFileSync(new URL(path,root));
  assert.equal(bytes.readUInt32LE(0),0x46546c67);
  const len = bytes.readUInt32LE(12), doc=JSON.parse(bytes.toString('utf8',20,20+len));
  const bin=bytes.subarray(28+len);
  const read=index=>{
    const acc=doc.accessors[index],view=doc.bufferViews[acc.bufferView];
    assert.equal(acc.componentType,5126,'Animation GLB accessors must be float32');
    const cols={SCALAR:1,VEC3:3,VEC4:4}[acc.type];
    const offset=(view.byteOffset||0)+(acc.byteOffset||0);
    const stride=view.byteStride||cols*4;
    return Array.from({length:acc.count},(_,row)=>Array.from({length:cols},(_,col)=>
      bin.readFloatLE(offset+row*stride+4*col)));
  };
  return {bytes,doc,read};
}
const rawOrc=glb('assets/models/orcs/male-orc-fighter/male-orc-fighter.glb');
const proof=glb('assets/models/orcs/male-orc-fighter/ual2-one-handed/male-orc-fighter-ual2-one-handed.glb');
const carl=glb('assets/models/dungeon-crawler-carl/v2/dungeon-crawler-carl-v2.glb');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(sha(rawOrc.bytes),'a0b63e9ae67c47779baf9e254660918c073ab1684237f528c43bb9f7e9f9c688');
assert.equal(sha(proof.bytes),'2f88c4062f2fdba6b8738e0296a1e5764cff94f3e716153ea1e374475d7831d0');
assert.equal(sha(carl.bytes),'5284bd3cd0b9fe6665c5d94ec0fc7fae8ec4a5856f0628f3084ae1190b044693');
assert.deepEqual(proof.doc.nodes,rawOrc.doc.nodes,'Proof keeps the original Orc bind TRS');
assert.deepEqual(proof.doc.skins,rawOrc.doc.skins,'Proof keeps the original inverse binds');
const reference=JSON.parse(fs.readFileSync(new URL('data/ual2-carl-reference-bind.json',root),'utf8'));
const ref=unpackCarlReference(reference);
const norm=n=>n.replace(/[^a-z0-9]/gi,'').replace(/^mixamorig/i,'').toLowerCase();
const carlNames=new Map(carl.doc.nodes.map(node=>[norm(node.name||''),node]));
for(const [key,quat] of ref) {
  const expected=carlNames.get(key)?.rotation||[0,0,0,1];
  assert.ok(quat.every((v,i)=>Math.abs(v-expected[i])<5e-7),`Carl bind data differs on ${key}`);
}
const bones=rawOrc.doc.skins[0].joints.map(id=>{
  const entry=rawOrc.doc.nodes[id], bone=new THREE.Bone();
  bone.name=THREE.PropertyBinding.sanitizeNodeName(entry.name);
  bone.quaternion.fromArray(entry.rotation||[0,0,0,1]);
  return bone;
});
const originalBind=new Map(bones.map(b=>[norm(b.name),b.quaternion.clone()]));
const model={traverse(fn){for(const bone of bones)fn(bone)}};
const clips=proof.doc.animations.map(animation=>{
  const tracks=animation.channels.map(channel=>{
    const sampler=animation.samplers[channel.sampler],node=proof.doc.nodes[channel.target.node];
    const name=THREE.PropertyBinding.sanitizeNodeName(node.name);
    const times=proof.read(sampler.input).map(row=>row[0]);
    const values=proof.read(sampler.output).flat();
    if(channel.target.path==='rotation')return new THREE.QuaternionKeyframeTrack(
      `${name}.quaternion`,times,values);
    if(channel.target.path==='translation')return new THREE.VectorKeyframeTrack(
      `${name}.position`,times,values);
    throw new Error('Unexpected Orc proof path: '+channel.target.path);
  });
  return new THREE.AnimationClip(animation.name,-1,tracks);
});
const inputTracks=clips.map(clip=>clip.tracks.map(track=>Array.from(track.values)));
const {clips:rebased,report}=rebaseOrcUal2Clips(THREE,model,clips,reference,ORC_NATIVE_BIND_REBASE);
assert.equal(report.mappedBones,64);
assert.equal(report.rotatedTracks,128);
assert.equal(report.geometryReweighted,false);
assert.deepEqual(rebased.map(clip=>clip.name),['UAL2_Sword_Ready','UAL2_Sword_Regular_A']);
let differing=0;
for(let c=0;c<clips.length;c++) {
  for(let j=0;j<clips[c].tracks.length;j++){
    const old=clips[c].tracks[j],fresh=rebased[c].tracks[j];
    assert.deepEqual(Array.from(old.values),inputTracks[c][j],'Rebase must not mutate source clips');
    assert.deepEqual(Array.from(old.times),Array.from(fresh.times),'Timing preserved');
    const key=norm(old.name.split('.')[0]);
    if(old.name.endsWith('.position')) {
      assert.deepEqual(Array.from(old.values),Array.from(fresh.values),'Hips translation unchanged');
      continue;
    }
    const originalRest=new THREE.Quaternion(...ref.get(key));
    const targetRest=originalBind.get(key);
    const delta=targetRest.clone().multiply(originalRest.clone().invert());
    for(let k=0;k<old.times.length;k++){
      const oldQ=new THREE.Quaternion().fromArray(old.values,k*4);
      const actual=new THREE.Quaternion().fromArray(fresh.values,k*4);
      const expected=oldQ.clone().premultiply(delta).normalize();
      const difference=Math.min(
        Math.hypot(actual.x-expected.x,actual.y-expected.y,actual.z-expected.z,actual.w-expected.w),
        Math.hypot(actual.x+expected.x,actual.y+expected.y,actual.z+expected.z,actual.w+expected.w));
      assert.ok(difference<2e-5,`Bad local motion rebase ${key}: component difference ${difference}`);
      assert.ok(Math.abs(actual.length()-1)<1e-5,'Every transformed key remains unit-length');
      if(actual.angleTo(oldQ)>0.2) differing++;
    }
  }
}
assert.ok(differing>50,'Experiment must meaningfully change the Orc limb basis');
// The original Carl reference T-pose, transported by the rebase, must become
// the unmodified Orc bind pose on every mapped joint.
for(const [key,carlRot] of ref){
  const transported=new THREE.Quaternion(...carlRot).premultiply(
    originalBind.get(key).clone().multiply(new THREE.Quaternion(...carlRot).invert())).normalize();
  const nativeQ=originalBind.get(key);
  const distance=Math.min(
    Math.hypot(transported.x-nativeQ.x,transported.y-nativeQ.y,transported.z-nativeQ.z,transported.w-nativeQ.w),
    Math.hypot(transported.x+nativeQ.x,transported.y+nativeQ.y,transported.z+nativeQ.z,transported.w+nativeQ.w));
  assert.ok(distance<2e-5,`Bind mismatch on ${key}: ${distance}`);
}
const catalog=JSON.parse(fs.readFileSync(new URL('data/studio-models.json',root),'utf8'));
const modelEntry=catalog.models.find(item=>item.id==='male-orc-fighter-ual2-native-bind-experiment');
assert.ok(modelEntry,'New experiment can be selected');
assert.equal(modelEntry.animationBindRebase,ORC_NATIVE_BIND_REBASE);
assert.ok(!modelEntry.skinWeightRepair,'No automatic weight repair on the experimental copy');
assert.equal(modelEntry.file,'assets/models/orcs/male-orc-fighter/ual2-one-handed/male-orc-fighter-ual2-one-handed.glb');
assert.deepEqual(catalog.models.filter(item=>item.id.includes('dungeon-crawler-carl'))
  .map(item=>item.animationBindRebase),[undefined,undefined,undefined]);
console.log('PASS Orc Native-Bind experiment: real GLBs, 64 Carl native joints, 128 rebased quaternion tracks, original mesh/weights and source animations unchanged');
