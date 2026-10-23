export function normalizedRigName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function sourceBones(model) {
  const map = new Map();
  model?.traverse(object => {
    if (!object.isBone) return;
    const key = normalizedRigName(object.name);
    if (key && !map.has(key)) map.set(key, object);
  });
  return map;
}

function targetBindData(THREE, model) {
  const byKey = new Map();
  const worldByBone = new Map();

  model?.traverse(object => {
    if (!object.isSkinnedMesh) return;
    const skeleton = object.skeleton;
    if (!skeleton?.bones?.length || skeleton.boneInverses.length !== skeleton.bones.length) return;
    skeleton.bones.forEach((bone, index) => {
      if (!worldByBone.has(bone)) worldByBone.set(bone, skeleton.boneInverses[index].clone().invert());
    });
  });

  if (!worldByBone.size) {
    model?.updateWorldMatrix(true, true);
    model?.traverse(object => {
      if (object.isBone) worldByBone.set(object, object.matrixWorld.clone());
    });
  }

  for (const [bone, world] of worldByBone) {
    const key = normalizedRigName(bone.name);
    if (!key || byKey.has(key)) continue;
    const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
    world.decompose(position, quaternion, scale);
    byKey.set(key, {
      bone,
      name: THREE.PropertyBinding.sanitizeNodeName(bone.name),
      bindWorldQuaternion: quaternion,
      parentKey: bone.parent?.isBone ? normalizedRigName(bone.parent.name) : null
    });
  }
  return byKey;
}

function sampleTimes(clip, mappedKeys) {
  const values = new Set([0, Math.max(0, clip.duration || 0)]);
  for (const track of clip.tracks || []) {
    const match = String(track.name || '').match(/^(.*)\.(quaternion)$/);
    if (!match || !mappedKeys.has(normalizedRigName(match[1]))) continue;
    for (const time of track.times || []) if (Number.isFinite(time)) values.add(Number(time));
  }
  return [...values].sort((a,b)=>a-b);
}

function snapshotLocalPose(model) {
  const pose=[];
  model?.traverse(object=>{
    if (!object.isBone) return;
    pose.push([object, object.position.clone(), object.quaternion.clone(), object.scale.clone()]);
  });
  return pose;
}

function restoreLocalPose(pose) {
  for (const [bone, position, quaternion, scale] of pose) {
    bone.position.copy(position);
    bone.quaternion.copy(quaternion);
    bone.scale.copy(scale);
  }
}

export function retargetMixamoClip(THREE, clip, sourceModel, targetModel, label) {
  const source = sourceBones(sourceModel);
  const target = targetBindData(THREE, targetModel);
  if (!source.size) throw new Error('The Mixamo FBX has no skeleton bind pose.');
  if (!target.size) throw new Error('The current model has no skeleton to receive animation.');

  const mappedKeys = new Set([...source.keys()].filter(key=>target.has(key)));
  if (!mappedKeys.size) throw new Error('No compatible Mixamo bones matched the current model.');

  sourceModel.updateWorldMatrix(true, true);
  const sourceBindWorld = new Map();
  for (const [key,bone] of source) {
    const q=new THREE.Quaternion();
    bone.getWorldQuaternion(q);
    sourceBindWorld.set(key,q.clone());
  }

  const times = sampleTimes(clip, mappedKeys);
  const valuesByKey = new Map([...mappedKeys].map(key=>[key,[]]));
  const pose = snapshotLocalPose(sourceModel);
  const mixer = new THREE.AnimationMixer(sourceModel);
  const action = mixer.clipAction(clip);
  action.reset().setLoop(THREE.LoopOnce,1).play();
  action.paused = true;

  try {
    for (const time of times) {
      action.time = Math.min(Math.max(time,0),clip.duration);
      mixer.update(0);
      sourceModel.updateWorldMatrix(true,true);

      const desiredWorld = new Map();
      const pending = new Set(mappedKeys);
      let guard=0;
      while (pending.size && guard++ < mappedKeys.size + 4) {
        let progressed=false;
        for (const key of [...pending]) {
          const targetInfo = target.get(key);
          if (!targetInfo) { pending.delete(key); continue; }
          const parentKey = targetInfo.parentKey;
          if (parentKey && mappedKeys.has(parentKey) && !desiredWorld.has(parentKey)) continue;

          const sourceBone = source.get(key);
          const sourceAnimatedWorld = sourceBone.getWorldQuaternion(new THREE.Quaternion());
          const sourceBind = sourceBindWorld.get(key);
          const worldDelta = sourceAnimatedWorld.clone().multiply(sourceBind.clone().invert()).normalize();
          const targetWorld = worldDelta.multiply(targetInfo.bindWorldQuaternion.clone()).normalize();
          desiredWorld.set(key,targetWorld);

          const parentWorld = parentKey && desiredWorld.has(parentKey)
            ? desiredWorld.get(parentKey)
            : parentKey && target.has(parentKey)
              ? target.get(parentKey).bindWorldQuaternion
              : new THREE.Quaternion();
          const local = parentWorld.clone().invert().multiply(targetWorld).normalize();
          valuesByKey.get(key).push(local.x,local.y,local.z,local.w);
          pending.delete(key);
          progressed=true;
        }
        if (!progressed) break;
      }
      if (pending.size) throw new Error('The target skeleton hierarchy could not be resolved during Mixamo retargeting.');
    }
  } finally {
    mixer.stopAllAction();
    mixer.uncacheRoot(sourceModel);
    restoreLocalPose(pose);
    sourceModel.updateWorldMatrix(true,true);
  }

  const tracks=[];
  for (const key of mappedKeys) {
    const info=target.get(key), values=valuesByKey.get(key);
    if (!values?.length) continue;
    tracks.push(new THREE.QuaternionKeyframeTrack(`${info.name}.quaternion`,times,values));
  }
  if (!tracks.length) throw new Error('No compatible Mixamo rotation tracks matched the current model.');

  const result = new THREE.AnimationClip(label, clip.duration, tracks);
  result.userData = {
    studioAnimationId: `mixamo:${label}`,
    mixamoImport: {
      sourceName: clip.name || '',
      mappedTracks: tracks.length,
      skippedTracks: Math.max(0,(clip.tracks?.length||0)-tracks.length),
      retargetMode: 'world-space-bind-delta'
    }
  };
  return result;
}
