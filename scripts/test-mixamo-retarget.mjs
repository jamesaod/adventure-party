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
  let json=null,binary=null;
  for(let offset=12;offset<bytes.length;){
    const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);
    const chunk=bytes.subarray(offset+8,offset+8+length);
    if(type===0x4e4f534a) json=JSON.parse(chunk.toString('utf8').replace(/\\u0000+$/,'').trimEnd());
    if(type===0x004e4942) binary=chunk;
    offset+=8+length;
  }
  assert.ok(json,'GLB JSON chunk');
  return {bytes,json,binary};
}

function glbAccessor(glb,index){
  const accessor=glb.json.accessors[index];
  const view=glb.json.bufferViews[accessor.bufferView];
  assert.equal(accessor.componentType,5126,'diagnostic accessor is float32');
  const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[accessor.type];
  const stride=view.byteStride||components*4;
  const base=(view.byteOffset||0)+(accessor.byteOffset||0);
  return Array.from({length:accessor.count},(_,row)=>
    Array.from({length:components},(_,component)=>glb.binary.readFloatLE(base+row*stride+component*4))
  );
}

function diagnosticRig(THREE,glb){
  const objects=(glb.json.nodes||[]).map(node=>{
    const object=new THREE.Bone();
    object.name=node.name||'';
    if(node.matrix)new THREE.Matrix4().fromArray(node.matrix).decompose(object.position,object.quaternion,object.scale);
    else{
      object.position.fromArray(node.translation||[0,0,0]);
      object.quaternion.fromArray(node.rotation||[0,0,0,1]);
      object.scale.fromArray(node.scale||[1,1,1]);
    }
    return object;
  });
  (glb.json.nodes||[]).forEach((node,index)=>(node.children||[]).forEach(child=>objects[index].add(objects[child])));
  const scene=new THREE.Group();
  for(const root of glb.json.scenes?.[glb.json.scene||0]?.nodes||[])scene.add(objects[root]);
  scene.updateWorldMatrix(true,true);
  return {scene,objects};
}

function bindSpaceDiagnostics(THREE,glb,label){
  const skin=glb.json.skins?.[0];
  assert.ok(skin?.joints?.length,'diagnostic skin');
  const ibms=glbAccessor(glb,skin.inverseBindMatrices);
  const {scene,objects}=diagnosticRig(THREE,glb);
  const rows=[];
  for(let i=0;i<skin.joints.length;i++){
    const nodeIndex=skin.joints[i],bone=objects[nodeIndex];
    const nodeWorld=bone.getWorldQuaternion(new THREE.Quaternion());
    const bindWorld=new THREE.Matrix4().fromArray(ibms[i]).invert();
    const pos=new THREE.Vector3(),ibmWorld=new THREE.Quaternion(),scale=new THREE.Vector3();
    bindWorld.decompose(pos,ibmWorld,scale);
    rows.push({name:bone.name,angle:THREE.MathUtils.radToDeg(nodeWorld.angleTo(ibmWorld))});
  }
  rows.sort((a,b)=>b.angle-a.angle);
  return rows;
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
assert.equal(retargeted.userData.humanoidImport.retargetMode,'semantic-joint-bind-relative');
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
const expectedParentWorld=targetParentBindWorld.clone().multiply(sourceParentBindWorld.clone().invert()).multiply(sourceParentAnimWorld);
const expectedChildWorld=targetChildBindWorld.clone().multiply(sourceChildBindWorld.clone().invert()).multiply(sourceChildAnimWorld);
const actualParentWorld=targetParent.getWorldQuaternion(new THREE.Quaternion());
const actualChildWorld=targetChild.getWorldQuaternion(new THREE.Quaternion());
assert.ok(actualParentWorld.angleTo(expectedParentWorld)<8e-4,'Parent world-space motion is preserved');
assert.ok(actualChildWorld.angleTo(expectedChildWorld)<8e-4,'Child world-space motion is preserved despite different parent bind axes');

mixer.stopAllAction();

// Different joint bind frames must preserve the animation relative to each
// joint's own rest orientation instead of forcing the source world delta onto
// the target. This is the failure mode that folded the Orc's arms inward.
{
  const source=new THREE.Group();
  const target=new THREE.Group();
  const add=(root,name,position,rotation=null)=>{
    const bone=new THREE.Bone(); bone.name=name; bone.position.fromArray(position);
    if(rotation)bone.quaternion.copy(rotation);
    root.add(bone); return bone;
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
  const targetBind=q(y,180);
  const targetArm=add(target,'mixamorig:RightArm',[-0.5,0.65,0],targetBind);

  source.updateWorldMatrix(true,true);
  target.updateWorldMatrix(true,true);
  const identity=new THREE.Quaternion();
  const sourceMoved=q(x,30);
  const frontClip=new THREE.AnimationClip('DifferentBindFrame',1,[
    new THREE.QuaternionKeyframeTrack('mixamorigRightArm.quaternion',[0,1],[
      identity.x,identity.y,identity.z,identity.w,
      sourceMoved.x,sourceMoved.y,sourceMoved.z,sourceMoved.w
    ])
  ]);
  const mapped=retargetHumanoidClip(THREE,frontClip,source,target,'DifferentBindFrameMapped');
  const track=mapped.tracks.find(track=>track.name===`${targetArm.uuid}.quaternion`);
  assert.ok(track,'Target semantic right arm receives the animation');
  const last=track.values.slice(track.values.length-4);
  const mappedEnd=new THREE.Quaternion(...last);
  const expected=targetBind.clone().multiply(sourceMoved);
  assert.ok(mappedEnd.angleTo(expected)<5e-4,
    'Target keeps its own bind orientation and receives the source bind-relative motion');
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
const orcGlb=readGlbJson(orcFileUrl);
const {bytes:orcBytes,json:orcJson}=orcGlb;
const orcBindDiagnostics=bindSpaceDiagnostics(THREE,orcGlb,'orc');
const carlCarrierGlb=readGlbJson(new URL('../assets/models/dungeon-crawler-carl/v2-ual2-sword-test/dungeon-crawler-carl-v2-ual2-sword-test.glb',import.meta.url));
const carlBindDiagnostics=bindSpaceDiagnostics(THREE,carlCarrierGlb,'carl-carrier');
assert.ok(orcBindDiagnostics[0].angle<0.1 && carlBindDiagnostics[0].angle<0.1,
  'Node-world and inverse-bind rotations agree closely in both real rigs; bind coordinate-space mismatch is not the Orc failure');
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
  skinWeightRepair:'cross-limb-components-v1'
},'Raw Orc source stays untouched, with opt-in skinning cleanup and no automatic runtime retargeting');

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

// Hip-only keys must survive the recovered Carl stationary-motion policy.
{
  const source=new THREE.Group(),target=new THREE.Group();
  const sourceHip=new THREE.Bone(),targetHip=new THREE.Bone();
  sourceHip.name=targetHip.name='mixamorig:Hips';
  sourceHip.position.set(0,10,0);targetHip.position.set(.2,1,.3);
  source.add(sourceHip);target.add(targetHip);
  const clip=new THREE.AnimationClip('Hip-only displacement',1,[
    new THREE.QuaternionKeyframeTrack('mixamorigHips.quaternion',[0,1],[0,0,0,1,0,0,0,1]),
    new THREE.VectorKeyframeTrack('mixamorigHips.position',[0,.25,.75,1],[0,10,0,5,12,8,9,8,4,0,10,0])
  ]);
  const result=retargetHumanoidClip(THREE,clip,source,target,'Carl hip policy',
    {mode:'world-bind-delta',hipTranslation:'scaled-world-y'});
  const hipTrack=result.tracks.find(track=>track.name.endsWith('.position'));
  assert.deepEqual([...hipTrack.times],[0,.25,.75,1]);
  for(let i=0;i<4;i++){
    assert.ok(Math.abs(hipTrack.values[i*3]-.2)<1e-6);
    assert.ok(Math.abs(hipTrack.values[i*3+2]-.3)<1e-6);
    assert.ok(Math.abs(hipTrack.values[i*3+1]-[1,1.2,.8,1][i])<1e-6);
  }
  assert.deepEqual(sourceHip.position.toArray(),[0,10,0],'Source pose is restored after sampling');
  assert.deepEqual(targetHip.position.toArray(),[.2,1,.3],'Target bind position is not mutated');
  console.log('PASS Carl scaled vertical hips, position-only key times and source/target preservation');
}
