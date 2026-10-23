import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { retargetHumanoidClip } from '../js/mixamo-retarget.mjs';

const THREE = await import('data:text/javascript;base64,' +
  readFileSync(new URL('../assets/vendor/three/three.core.min.js', import.meta.url)).toString('base64'));

function bone(name, parent, rotation) {
  const b = new THREE.Bone();
  b.name = name;
  if (rotation) b.quaternion.copy(rotation);
  parent.add(b);
  return b;
}
const q = (axis, degrees) => new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(...axis), THREE.MathUtils.degToRad(degrees));
const source = new THREE.Group(), target = new THREE.Group();
const srcSpine = bone('mixamorig:Spine', source, q([0,1,0],25));
const srcArm = bone('mixamorig:RightArm', srcSpine, q([0,0,1],15));
const targetSpine = bone('mixamorig:Spine', target, q([1,0,0],-35));
const targetArm = bone('mixamorig:RightArm', targetSpine, q([0,1,0],40));
source.updateWorldMatrix(true,true);
target.updateWorldMatrix(true,true);

const sourceBindWorld = srcArm.getWorldQuaternion(new THREE.Quaternion());
const targetBindWorld = targetArm.getWorldQuaternion(new THREE.Quaternion());
const begin = srcArm.quaternion.clone();
const end = begin.clone().multiply(q([1,0,0],45));
const sourceClip = new THREE.AnimationClip('Carl donor test',1,[
  // GLTFLoader sometimes addresses bones by UUID, not a Mixamo name.
  new THREE.QuaternionKeyframeTrack(srcArm.uuid + '.quaternion',[0,1],[
    ...begin.toArray(), ...end.toArray()
  ])
]);
srcArm.quaternion.copy(end);
source.updateWorldMatrix(true,true);
const sourceAnimatedWorld = srcArm.getWorldQuaternion(new THREE.Quaternion());
srcArm.quaternion.copy(begin);
source.updateWorldMatrix(true,true);
const expectedWorld = sourceAnimatedWorld.clone().multiply(sourceBindWorld.clone().invert())
  .multiply(targetBindWorld);
const expectedJoint = targetBindWorld.clone().multiply(sourceBindWorld.clone().invert())
  .multiply(sourceAnimatedWorld);
assert.ok(expectedWorld.angleTo(expectedJoint)>0.02,
  'Noncommuting source/target bind poses distinguish the two formulas');

for (const [mode, expected, importMode] of [
  ['world-bind-delta',expectedWorld,'semantic-world-bind-delta'],
  ['joint-bind-relative',expectedJoint,'semantic-joint-bind-relative']
]) {
  const clip = retargetHumanoidClip(THREE,sourceClip,source,target,mode,{mode});
  assert.equal(clip.userData.humanoidImport.retargetMode,importMode);
  assert.equal(clip.userData.humanoidImport.mappedTracks,2);
  const track = clip.tracks.find(t=>t.name===targetArm.uuid+'.quaternion');
  assert.ok(track,'UUID-based Carl track resolves to the right Orc joint');
  const last = track.values.slice(-4);
  const actualWorld = targetSpine.quaternion.clone().multiply(new THREE.Quaternion(...last));
  assert.ok(actualWorld.angleTo(expected)<0.0008, mode + ' must follow its declared transform');
}
assert.throws(()=>retargetHumanoidClip(THREE,sourceClip,source,target,'bad',{mode:'relabel-left-right'}),
  /Unknown retargeting mode/);

const catalog=JSON.parse(readFileSync('data/studio-models.json','utf8'));
const variants=catalog.models.filter(m=>m.retargetQa);
assert.equal(variants.length,3,'Rev 111 comparison and Rev 112 anatomical QA stay separate');
assert.deepEqual(variants.map(m=>m.retargetQa.mode).sort(),['anatomical-aim','joint-bind-relative','world-bind-delta']);
const donor='assets/models/dungeon-crawler-carl/new-carl/mixamo-sword-shield-full-17/new-carl-mixamo-sword-shield-full-17.glb';
const originalOrc='assets/models/orcs/new-orc/new-orc.glb';
for(const entry of variants){
  assert.equal(entry.file,originalOrc,'Always load the original Orc');
  assert.equal(entry.retargetQa.carrier,donor,'Both experiments use identical Carl donor');
  assert.deepEqual(entry.retargetQa.clips,['Mixamo_sword_and_shield_attack']);
  assert.ok(!entry.skinWeightRepair && !entry.animationBindRebase && !entry.animationFamilies,
    'Do not change skin, bind or approved production animation family');
}
function glbJson(path){
  const bytes=readFileSync(path);
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
}
assert.equal(glbJson(originalOrc).animations?.length||0,0,'Source Orc stays animationless');
assert.ok(glbJson(donor).animations.some(a=>a.name==='Mixamo_sword_and_shield_attack'),
  'Saved Carl donor includes the shared test motion');
console.log('PASS Rev 111 two-mode world/joint retarget comparison, UUID tracks, untouched Orc and shared Carl clip');
