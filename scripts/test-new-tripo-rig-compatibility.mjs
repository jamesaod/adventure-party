import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Inspection-only acceptance gate. Neither source GLB is modified.
const THREE = await import('data:text/javascript;base64,' +
  readFileSync(new URL('../assets/vendor/three/three.core.min.js', import.meta.url)).toString('base64'));

function loadRig(path) {
  const raw=readFileSync(new URL('../'+path, import.meta.url));
  assert.equal(raw.toString('ascii',0,4),'glTF');
  const length=raw.readUInt32LE(12);
  const json=JSON.parse(raw.subarray(20,20+length).toString('utf8'));
  const binaryOffset=20+length;
  assert.equal(raw.readUInt32LE(binaryOffset+4),0x004e4942);
  const bin=raw.subarray(binaryOffset+8,binaryOffset+8+raw.readUInt32LE(binaryOffset));
  const skin=json.skins?.[0];
  assert.ok(skin?.joints?.length>=60, path+' missing humanoid skin');
  const objects=json.nodes.map(node=>{
    const bone=new THREE.Bone();
    bone.name=node.name||'';
    if(node.matrix)new THREE.Matrix4().fromArray(node.matrix).decompose(bone.position,bone.quaternion,bone.scale);
    else {
      bone.position.fromArray(node.translation||[0,0,0]);
      bone.quaternion.fromArray(node.rotation||[0,0,0,1]);
      bone.scale.fromArray(node.scale||[1,1,1]);
    }
    return bone;
  });
  json.nodes.forEach((node,i)=>(node.children||[]).forEach(j=>objects[i].add(objects[j])));
  const scene=new THREE.Group();
  for(const index of json.scenes?.[json.scene||0]?.nodes||[])scene.add(objects[index]);
  scene.updateWorldMatrix(true,true);
  const names=new Map();
  for(const index of skin.joints){
    const bone=objects[index];
    const role=bone.name.replace(/^mixamorig:/,'');
    assert.ok(!names.has(role),'Duplicate skin joint '+role);
    names.set(role,{node:index,bone});
  }
  function bindWorldMatrices(){
    const accessor=json.accessors[skin.inverseBindMatrices];
    const view=json.bufferViews[accessor.bufferView];
    assert.equal(accessor.type,'MAT4');
    assert.equal(accessor.componentType,5126);
    const stride=view.byteStride||64;
    const offset=(view.byteOffset||0)+(accessor.byteOffset||0);
    return skin.joints.map((_,i)=>{
      const m=new THREE.Matrix4();
      m.fromArray(Array.from({length:16},(_,j)=>bin.readFloatLE(offset+i*stride+j*4)));
      return m.invert();
    });
  }
  return {json,skin,names,objects,bindWorldMatrices};
}

const carl=loadRig('assets/models/dungeon-crawler-carl/new-carl/new-carl.glb');
const orc=loadRig('assets/models/orcs/new-orc/new-orc.glb');
const names=Array.from(carl.names.keys()).sort();
assert.deepEqual(Array.from(orc.names.keys()).sort(),names,
  'Carl/Orc skin joint labels differ; inspect exact differences before retargeting');
assert.equal(names.length,65,'Unexpected Mixamo joint count');

function parentName(rig,role){
  const bone=rig.names.get(role).bone;
  return bone.parent?.name?.replace(/^mixamorig:/,'')||'';
}
const parentMismatch=names.filter(name=>parentName(carl,name)!==parentName(orc,name));
assert.deepEqual(parentMismatch,[],'Carl/Orc skin parent hierarchy differs');

const angle=(a,b)=>THREE.MathUtils.radToDeg(a.angleTo(b));
const differences=names.map(name=>{
  const a=carl.names.get(name).bone,b=orc.names.get(name).bone;
  return {
    name,
    localDeg:+angle(a.quaternion,b.quaternion).toFixed(2),
    worldDeg:+angle(a.getWorldQuaternion(new THREE.Quaternion()),
      b.getWorldQuaternion(new THREE.Quaternion())).toFixed(2)
  };
}).sort((a,b)=>b.worldDeg-a.worldDeg);

for(const [label,rig] of [['Carl',carl],['Orc',orc]]){
  const p=name=>rig.names.get(name).bone.getWorldPosition(new THREE.Vector3());
  const left=p('LeftShoulder'),right=p('RightShoulder'),head=p('Head'),hips=p('Hips');
  const rightAxis=right.sub(left).normalize();
  const up=head.sub(hips).normalize();
  assert.ok(rightAxis.lengthSq()>0.9&&up.lengthSq()>0.9,label+' invalid anatomy');
  const ibms=rig.bindWorldMatrices();
  let maxBindPositionError=0,maxBindRotationError=0;
  rig.skin.joints.forEach((node,i)=>{
    const expected=rig.objects[node].matrixWorld;
    const p1=new THREE.Vector3(),q1=new THREE.Quaternion(),s1=new THREE.Vector3();
    const p2=new THREE.Vector3(),q2=new THREE.Quaternion(),s2=new THREE.Vector3();
    expected.decompose(p1,q1,s1);
    ibms[i].decompose(p2,q2,s2);
    maxBindPositionError=Math.max(maxBindPositionError,p1.distanceTo(p2));
    maxBindRotationError=Math.max(maxBindRotationError,angle(q1,q2));
  });
  console.log(label+': '+rig.skin.joints.length+' skin joints; right='+
    rightAxis.toArray().map(v=>v.toFixed(3)).join(',')+
    '; up='+up.toArray().map(v=>v.toFixed(3)).join(',')+
    '; inverse-bind-vs-rest error: '+maxBindPositionError.toFixed(6)+
    ' units, '+maxBindRotationError.toFixed(3)+' deg');
}
const changed=differences.filter(d=>d.worldDeg>1);
console.log('Carl/Orc identical bone labels: YES; identical parenting: YES');
console.log('Bone world orientations differing >1 degree: '+changed.length+'/65');
console.log('Largest world rotation differences: '+JSON.stringify(differences.slice(0,15)));
console.log('Shoulders/arms: '+JSON.stringify(differences.filter(d=>
  /^(Left|Right)(Shoulder|Arm|ForeArm|Hand)$/.test(d.name))));
console.log('PASS: identical labels and hierarchy; numeric rig-orientation diagnostic complete.');
