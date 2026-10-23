import assert from 'node:assert/strict';
import fs from 'node:fs';
import { retargetHumanoidClip, HUMANOID_RETARGET_QA_MODES } from '../js/mixamo-retarget.mjs';

const threeSource=fs.readFileSync(new URL('../assets/vendor/three/three.core.min.js',import.meta.url));
const THREE=await import(`data:text/javascript;base64,${threeSource.toString('base64')}`);
const q=(axis,degrees)=>new THREE.Quaternion().setFromAxisAngle(axis,THREE.MathUtils.degToRad(degrees));
const x=new THREE.Vector3(1,0,0),y=new THREE.Vector3(0,1,0);

function syntheticRig(armRotation) {
  const root=new THREE.Group(), bones={};
  for(const [name,position] of Object.entries({
    Hips:[0,0,0],Head:[0,1,0],LeftShoulder:[-0.5,0.7,0],
    RightShoulder:[0.5,0.7,0],RightArm:[0.8,0.7,0]
  })) {
    const bone=new THREE.Bone();
    bone.name='mixamorig:'+name;
    bone.position.fromArray(position);
    if(name==='RightArm')bone.quaternion.copy(armRotation);
    root.add(bone);bones[name]=bone;
  }
  root.updateWorldMatrix(true,true);
  return {root,bones};
}
const src=syntheticRig(new THREE.Quaternion());
const twist=q(x,40), flipped=q(y,180), dest=syntheticRig(flipped);
const identity=new THREE.Quaternion();
const clip=new THREE.AnimationClip('TestArm',1,[
  new THREE.QuaternionKeyframeTrack('mixamorigRightArm.quaternion',[0,1],[
    ...identity.toArray(),...twist.toArray()
  ])
]);
for (const mode of HUMANOID_RETARGET_QA_MODES) {
  const mapped=retargetHumanoidClip(THREE,clip,src.root,dest.root,'Mapped',{mode});
  assert.equal(mapped.userData.humanoidImport.retargetMode,mode);
  const armTrack=mapped.tracks.find(t=>t.name===dest.bones.RightArm.uuid+'.quaternion');
  assert.ok(armTrack,mode+' must map to the RightArm bone, not LeftArm');
  const initial=new THREE.Quaternion(...armTrack.values.slice(0,4));
  assert.ok(initial.angleTo(flipped)<0.001,mode+' preserves target rest pose');
  const end=new THREE.Quaternion(...armTrack.values.slice(-4));
  const expected=mode==='anatomical-world-delta'?
    twist.clone().multiply(flipped):flipped.clone().multiply(twist);
  assert.ok(end.angleTo(expected)<0.001,mode+' correct quaternion multiplication order');
}
assert.throws(()=>retargetHumanoidClip(THREE,clip,src.root,dest.root,'Invalid',{mode:'unknown'}),/Unsupported/);

function glbDoc(path) {
  const bytes=fs.readFileSync(path);
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
}
function rig(path) {
  const doc=glbDoc(path), nodes=doc.nodes||[],joints=doc.skins?.[0]?.joints||[];
  const parents=new Map();
  nodes.forEach((node,i)=>(node.children||[]).forEach(child=>parents.set(child,i)));
  const named=new Map(joints.map(i=>[nodes[i]?.name?.replace(/^mixamorig:/,'')||'',i]));
  const boneParent=name=>{
    const i=parents.get(named.get(name));
    return i===undefined?null:nodes[i]?.name?.replace(/^mixamorig:/,'');
  };
  return {nodes,joints,named,names:Array.from(named.keys()).sort(),boneParent};
}

const carl=rig('assets/models/dungeon-crawler-carl/new-carl/new-carl.glb');
const orc=rig('assets/models/orcs/new-orc/new-orc.glb');
const common=carl.names.filter(n=>orc.named.has(n));
const missingFromOrc=carl.names.filter(n=>!orc.named.has(n));
const onlyOrc=orc.names.filter(n=>!carl.named.has(n));
const differingHierarchy=common.filter(n=>carl.boneParent(n)!==orc.boneParent(n));
const armBones=['LeftShoulder','RightShoulder','LeftArm','RightArm','LeftForeArm','RightForeArm','LeftHand','RightHand'];
for (const name of armBones)assert.ok(carl.named.has(name)&&orc.named.has(name),'Missing paired arm rig label '+name);
const armParentDifferences=armBones.filter(n=>carl.boneParent(n)!==orc.boneParent(n));
const armLocalOrientationDifferences=armBones.map(name=>{
  const a=carl.nodes[carl.named.get(name)],b=orc.nodes[orc.named.get(name)];
  const qa=new THREE.Quaternion().fromArray(a.rotation||[0,0,0,1]);
  const qb=new THREE.Quaternion().fromArray(b.rotation||[0,0,0,1]);
  return {name,angleDegrees:+THREE.MathUtils.radToDeg(qa.angleTo(qb)).toFixed(2),
    carlParent:carl.boneParent(name),orcParent:orc.boneParent(name)};
});
assert.ok(common.length>=60,'Tripo exports must retain recognizable Mixamo skin joints');
assert.deepEqual(missingFromOrc,[],'Some Carl skin-joint labels are missing in Orc');
assert.deepEqual(armParentDifferences,[],'Orc arm bones use a different hierarchy');
const models=JSON.parse(fs.readFileSync('data/studio-models.json','utf8'));
const family=JSON.parse(fs.readFileSync('data/humanoid-animation-sources.json','utf8'))
  .families['carl-baked-single-clip-qa'];
assert.ok(family?.carrier?.includes('new-carl-sword-shield-attack-inplace-proof.glb'));
assert.deepEqual(family.clips,['Mixamo_Sword_Shield_Attack_InPlace_QA']);
for(const mode of HUMANOID_RETARGET_QA_MODES){
  const entry=models.models.find(m=>m.animationRetargetMode===mode&&m.animationFamilies?.includes('carl-baked-single-clip-qa'));
  assert.ok(entry,'Missing Orc QA option for '+mode);
  assert.equal(entry.file,'assets/models/orcs/new-orc/new-orc.glb');
  assert.ok(!entry.skinWeightRepair&&!entry.animationBindRebase,'QA must not mutate rig weights or bind');
}
console.log('CARL ↔ ORC RIG AUDIT: '+JSON.stringify({
  carlSkinJoints:carl.joints.length,orcSkinJoints:orc.joints.length,
  commonSkinNames:common.length,missingFromOrc,onlyOrc,
  differingHierarchy,armLocalOrientationDifferences
}));
console.log('PASS: 3 reversible Orc retarget modes, T-pose and correct named arm, real exported skin-joint map audit.');
