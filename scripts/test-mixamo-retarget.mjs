import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { retargetHumanoidClip } from '../js/mixamo-retarget.mjs';
import { analyzeHumanoidRig, findHumanoidBone, humanoidFingerChains } from '../js/humanoid-rig.mjs';

const source = fs.readFileSync(new URL('../assets/vendor/three/three.core.min.js', import.meta.url));
const THREE = await import(`data:text/javascript;base64,${source.toString('base64')}`);

function readGlbJson(url) {
  const bytes=fs.readFileSync(url);
  assert.equal(bytes.readUInt32LE(0),0x46546c67,'GLB magic');
  assert.equal(bytes.readUInt32LE(4),2,'GLB version');
  assert.equal(bytes.readUInt32LE(8),bytes.length,'GLB declared byte length');
  let json=null;
  for(let offset=12;offset<bytes.length;){
    const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);
    const chunk=bytes.subarray(offset+8,offset+8+length);
    if(type===0x4e4f534a) json=JSON.parse(chunk.toString('utf8').replace(/\\u0000+$/,'').trimEnd());
    offset+=8+length;
  }
  assert.ok(json,'GLB JSON chunk');
  return {bytes,json};
}
const q=(axis,degrees)=>new THREE.Quaternion().setFromAxisAngle(axis,THREE.MathUtils.degToRad(degrees));
const z=new THREE.Vector3(0,0,1), x=new THREE.Vector3(1,0,0), y=new THREE.Vector3(0,1,0);

const sourceRig=new THREE.Group();
const sourceParent=new THREE.Bone(); sourceParent.name='mixamorig:Spine'; sourceParent.quaternion.copy(q(y,25));
const sourceChild=new THREE.Bone(); sourceChild.name='mixamorig:LeftArm'; sourceChild.quaternion.copy(q(z,15));
sourceParent.add(sourceChild); sourceRig.add(sourceParent);
sourceRig.updateWorldMatrix(true,true);

const targetRig=new THREE.Group();
const targetParent=new THREE.Bone(); targetParent.name='spine'; targetParent.quaternion.copy(q(x,-35));
const targetChild=new THREE.Bone(); targetChild.name='upper_arm.L'; targetChild.quaternion.copy(q(y,40));
targetParent.add(targetChild); targetRig.add(targetParent);
targetRig.updateWorldMatrix(true,true);

const sourceParentBind=sourceParent.quaternion.clone();
const sourceChildBind=sourceChild.quaternion.clone();
const sourceParentMoved=sourceParentBind.clone().multiply(q(z,20)).normalize();
const sourceChildMoved=sourceChildBind.clone().multiply(q(x,30)).normalize();

const clip=new THREE.AnimationClip('Hierarchy',1,[
  new THREE.QuaternionKeyframeTrack('mixamorigSpine.quaternion',[0,1],[
    sourceParentBind.x,sourceParentBind.y,sourceParentBind.z,sourceParentBind.w,
    sourceParentMoved.x,sourceParentMoved.y,sourceParentMoved.z,sourceParentMoved.w
  ]),
  new THREE.QuaternionKeyframeTrack('mixamorigLeftArm.quaternion',[0,1],[
    sourceChildBind.x,sourceChildBind.y,sourceChildBind.z,sourceChildBind.w,
    sourceChildMoved.x,sourceChildMoved.y,sourceChildMoved.z,sourceChildMoved.w
  ]),
  new THREE.VectorKeyframeTrack('mixamorigHips.position',[0,1],[0,0,0,1,2,3])
]);

const retargeted=retargetHumanoidClip(THREE,clip,sourceRig,targetRig,'Retargeted');
assert.equal(retargeted.userData.humanoidImport.retargetMode,'semantic-anatomical-basis-bind-delta');
assert.equal(retargeted.userData.humanoidImport.sourceRigFamily,'generic');
assert.equal(retargeted.userData.humanoidImport.targetRigFamily,'generic');
assert.equal(retargeted.tracks.length,2,'Only rotation tracks are baked');

const mixer=new THREE.AnimationMixer(targetRig);
const action=mixer.clipAction(retargeted).play();
action.paused=true;

action.time=0; mixer.update(0); targetRig.updateWorldMatrix(true,true);
assert.ok(targetParent.quaternion.angleTo(q(x,-35))<5e-4,'Parent source bind maps to target parent bind');
assert.ok(targetChild.quaternion.angleTo(q(y,40))<5e-4,'Child source bind maps to target child bind');

action.time=1; mixer.update(0); targetRig.updateWorldMatrix(true,true);
sourceParent.quaternion.copy(sourceParentMoved);
sourceChild.quaternion.copy(sourceChildMoved);
sourceRig.updateWorldMatrix(true,true);
const sourceParentBindWorld=q(y,25);
const sourceChildBindWorld=sourceParentBindWorld.clone().multiply(q(z,15));
const sourceParentAnimWorld=sourceParent.getWorldQuaternion(new THREE.Quaternion());
const sourceChildAnimWorld=sourceChild.getWorldQuaternion(new THREE.Quaternion());
const targetParentBindWorld=q(x,-35);
const targetChildBindWorld=targetParentBindWorld.clone().multiply(q(y,40));
const expectedParentWorld=sourceParentAnimWorld.clone().multiply(sourceParentBindWorld.clone().invert()).multiply(targetParentBindWorld);
const expectedChildWorld=sourceChildAnimWorld.clone().multiply(sourceChildBindWorld.clone().invert()).multiply(targetChildBindWorld);
const actualParentWorld=targetParent.getWorldQuaternion(new THREE.Quaternion());
const actualChildWorld=targetChild.getWorldQuaternion(new THREE.Quaternion());
assert.ok(actualParentWorld.angleTo(expectedParentWorld)<8e-4,'Parent world-space motion is preserved');
assert.ok(actualChildWorld.angleTo(expectedChildWorld)<8e-4,'Child world-space motion is preserved despite different parent bind axes');

mixer.stopAllAction();

// Opposite native front axes must not mirror an otherwise semantic match.
// The source is anatomically +Z forward; the target is anatomically -Z
// forward because its named left/right shoulders occupy opposite X sides.
{
  const source=new THREE.Group();
  const target=new THREE.Group();
  const add=(root,name,position)=>{
    const bone=new THREE.Bone(); bone.name=name; bone.position.fromArray(position); root.add(bone); return bone;
  };
  add(source,'mixamorig:Hips',[0,0,0]);
  add(source,'mixamorig:Head',[0,1,0]);
  add(source,'mixamorig:LeftShoulder',[-0.4,0.75,0]);
  add(source,'mixamorig:RightShoulder',[0.4,0.75,0]);
  const sourceArm=add(source,'mixamorig:RightArm',[0.5,0.65,0]);

  add(target,'mixamorig:Hips',[0,0,0]);
  add(target,'mixamorig:Head',[0,1,0]);
  add(target,'mixamorig:LeftShoulder',[0.4,0.75,0]);
  add(target,'mixamorig:RightShoulder',[-0.4,0.75,0]);
  const targetArm=add(target,'mixamorig:RightArm',[-0.5,0.65,0]);

  source.updateWorldMatrix(true,true);
  target.updateWorldMatrix(true,true);
  const identity=new THREE.Quaternion();
  const sourceMoved=q(x,30);
  const frontClip=new THREE.AnimationClip('OppositeFront',1,[
    new THREE.QuaternionKeyframeTrack('mixamorigRightArm.quaternion',[0,1],[
      identity.x,identity.y,identity.z,identity.w,
      sourceMoved.x,sourceMoved.y,sourceMoved.z,sourceMoved.w
    ])
  ]);
  const mapped=retargetHumanoidClip(THREE,frontClip,source,target,'OppositeFrontMapped');
  assert.equal(mapped.userData.humanoidImport.sourceBasisResolved,true);
  assert.equal(mapped.userData.humanoidImport.targetBasisResolved,true);
  assert.ok(Math.abs(mapped.userData.humanoidImport.basisCorrectionDegrees-180)<1e-4,
    'Opposite-facing rigs report a 180-degree anatomical-basis correction');

  const track=mapped.tracks.find(track=>track.name===`${targetArm.uuid}.quaternion`);
  assert.ok(track,'Target right arm receives the semantic right-arm animation');
  const last=track.values.slice(track.values.length-4);
  const mappedEnd=new THREE.Quaternion(...last);
  assert.ok(mappedEnd.angleTo(q(x,-30))<1e-5,
    'A +X source arm rotation becomes -X on a 180-degree opposite-facing target');
}

// Uploaded Orc acceptance fixture: the actual GLB has these Mixamo bone names.
// The adapter must classify the model as animation/equipment ready without an
// Orc-specific code path.
const orcRig=new THREE.Group();
const orcCore=[
  'mixamorig:Hips','mixamorig:Spine','mixamorig:Spine1','mixamorig:Spine2','mixamorig:Neck','mixamorig:Head',
  'mixamorig:LeftShoulder','mixamorig:LeftArm','mixamorig:LeftForeArm','mixamorig:LeftHand',
  'mixamorig:RightShoulder','mixamorig:RightArm','mixamorig:RightForeArm','mixamorig:RightHand',
  'mixamorig:LeftUpLeg','mixamorig:LeftLeg','mixamorig:LeftFoot',
  'mixamorig:RightUpLeg','mixamorig:RightLeg','mixamorig:RightFoot'
];
for(const name of orcCore){const bone=new THREE.Bone();bone.name=name;orcRig.add(bone);}
for(const side of ['Left','Right'])for(const digit of ['Index','Middle','Ring','Pinky','Thumb'])for(let i=1;i<=3;i++){
  const bone=new THREE.Bone(); bone.name=`mixamorig:${side}Hand${digit}${i}`; orcRig.add(bone);
}
const orcAnalysis=analyzeHumanoidRig(orcRig);
assert.equal(orcAnalysis.family,'mixamo');
assert.equal(orcAnalysis.mappedCoreRoles,orcAnalysis.coreRoleCount);
assert.equal(orcAnalysis.animationReady,true);
assert.equal(orcAnalysis.equipmentReady,true);
assert.equal(orcAnalysis.twoHandedReady,true);
assert.deepEqual(orcAnalysis.fingerChains,{left:5,right:5});
assert.equal(findHumanoidBone(orcRig,'rightHand').name,'mixamorig:RightHand');
assert.equal(humanoidFingerChains(orcRig,'left').length,5);

// Cross-convention bone aliases are semantic equivalents.
const aliasRig=new THREE.Group();
for(const name of ['pelvis','spine','chest','upper_chest','neck','head','shoulder.L','upper_arm.L','forearm.L','hand.L',
  'shoulder.R','upper_arm.R','forearm.R','hand.R','thigh.L','shin.L','foot.L','thigh.R','shin.R','foot.R']){
  const bone=new THREE.Bone(); bone.name=name; aliasRig.add(bone);
}
const aliasAnalysis=analyzeHumanoidRig(aliasRig);
assert.equal(aliasAnalysis.mappedCoreRoles,aliasAnalysis.coreRoleCount);
assert.equal(aliasAnalysis.animationReady,true);
assert.equal(findHumanoidBone(aliasRig,'rightHand').name,'hand.R');

// The repository-backed Orc must remain the exact user-supplied acceptance asset.
const orcFileUrl=new URL('../assets/models/orcs/male-orc-fighter/male-orc-fighter.glb',import.meta.url);
const {bytes:orcBytes,json:orcJson}=readGlbJson(orcFileUrl);
assert.equal(orcBytes.length,1413200,'Orc source byte length is preserved');
assert.equal(
  crypto.createHash('sha256').update(orcBytes).digest('hex'),
  'a0b63e9ae67c47779baf9e254660918c073ab1684237f528c43bb9f7e9f9c688',
  'Orc repository GLB is byte-for-byte the uploaded source'
);
assert.equal(orcJson.asset?.generator,'Tripo');
assert.equal(orcJson.skins?.length,1);
assert.equal(orcJson.skins[0]?.joints?.length,65);
assert.equal(orcJson.animations?.length||0,0,'Orc source intentionally has no embedded animation clips');
const orcNodeNames=new Set((orcJson.nodes||[]).map(node=>node.name));
for(const name of ['mixamorig:Hips','mixamorig:LeftHand','mixamorig:RightHand','mixamorig:LeftFoot','mixamorig:RightFoot']){
  assert.ok(orcNodeNames.has(name),`Orc GLB contains ${name}`);
}

const studioModels=JSON.parse(fs.readFileSync(new URL('../data/studio-models.json',import.meta.url),'utf8'));
const orcEntry=studioModels.models.find(model=>model.id==='male-orc-fighter');
assert.deepEqual(orcEntry,{
  id:'male-orc-fighter',
  label:'Male Orc Fighter',
  file:'assets/models/orcs/male-orc-fighter/male-orc-fighter.glb',
  upAxis:'Y',
  mobType:'orc',
  animationFamilies:['one-handed-swing']
},'Orc is registered as a Y-up Orc Studio model using the shared one-handed swing family');

const animationSources=JSON.parse(fs.readFileSync(new URL('../data/humanoid-animation-sources.json',import.meta.url),'utf8'));
assert.equal(animationSources.version,1);
const oneHanded=animationSources.families['one-handed-swing'];
assert.deepEqual(oneHanded.clips,['UAL2_Sword_Ready','UAL2_Sword_Regular_A']);
assert.equal(oneHanded.carrier,'assets/models/dungeon-crawler-carl/v2-ual2-sword-test/dungeon-crawler-carl-v2-ual2-sword-test.glb');
const {json:carrierJson}=readGlbJson(new URL('../'+oneHanded.carrier,import.meta.url));
const carrierClipNames=(carrierJson.animations||[]).map(animation=>animation.name);
for(const clipName of oneHanded.clips){
  assert.ok(carrierClipNames.includes(clipName),`Repository animation carrier contains ${clipName}`);
}

console.log('PASS semantic humanoid retargeting, Orc integrity, model-library registration, and one-handed animation source catalog');
