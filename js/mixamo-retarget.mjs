import {
  normalizeHumanoidBoneName, semanticBoneMap, semanticRoleForBoneName,
  semanticRoleByBone, parentSemanticRole, analyzeHumanoidRig
} from './humanoid-rig.mjs?v=R238C101';

// Compatibility export retained while callers migrate from the Mixamo-specific name.
export const normalizedRigName = normalizeHumanoidBoneName;

function sourceBones(model) {
  return semanticBoneMap(model);
}

function humanoidRigBasis(THREE, model) {
  const bones=semanticBoneMap(model);
  const left=bones.get('leftShoulder')||bones.get('leftUpperArm')||bones.get('leftHand');
  const right=bones.get('rightShoulder')||bones.get('rightUpperArm')||bones.get('rightHand');
  const hips=bones.get('hips')||bones.get('spine');
  const head=bones.get('head')||bones.get('neck')||bones.get('upperChest')||bones.get('chest');
  if(!left||!right||!hips||!head)return { quaternion:new THREE.Quaternion(),resolved:false };

  model.updateWorldMatrix(true,true);
  const leftPos=left.getWorldPosition(new THREE.Vector3());
  const rightPos=right.getWorldPosition(new THREE.Vector3());
  const hipsPos=hips.getWorldPosition(new THREE.Vector3());
  const headPos=head.getWorldPosition(new THREE.Vector3());

  // Anatomical basis: +X points to the character's right, +Y points up the
  // torso, and +Z is the character's forward direction. This is derived from
  // semantics rather than assuming every asset was authored facing +Z.
  const rightAxis=rightPos.sub(leftPos);
  const upAxis=headPos.sub(hipsPos);
  if(rightAxis.lengthSq()<1e-10||upAxis.lengthSq()<1e-10){
    return { quaternion:new THREE.Quaternion(),resolved:false };
  }
  rightAxis.normalize();
  upAxis.addScaledVector(rightAxis,-upAxis.dot(rightAxis));
  if(upAxis.lengthSq()<1e-10)return { quaternion:new THREE.Quaternion(),resolved:false };
  upAxis.normalize();
  const forwardAxis=rightAxis.clone().cross(upAxis);
  if(forwardAxis.lengthSq()<1e-10)return { quaternion:new THREE.Quaternion(),resolved:false };
  forwardAxis.normalize();
  upAxis.copy(forwardAxis).cross(rightAxis).normalize();

  const matrix=new THREE.Matrix4().makeBasis(rightAxis,upAxis,forwardAxis);
  return {
    quaternion:new THREE.Quaternion().setFromRotationMatrix(matrix).normalize(),
    resolved:true,
    rightAxis:rightAxis.toArray(),
    upAxis:upAxis.toArray(),
    forwardAxis:forwardAxis.toArray()
  };
}

function targetBindData(THREE, model) {
  const byRole = new Map();
  const worldByBone = new Map();
  const roleByBone = semanticRoleByBone(model);

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
    const role = roleByBone.get(bone) || semanticRoleForBoneName(bone.name);
    if (!role || byRole.has(role)) continue;
    const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
    world.decompose(position, quaternion, scale);
    byRole.set(role, {
      bone,
      boneName: bone.name || '',
      // UUID binding is independent of punctuation/namespace conventions in
      // authoring names such as upper_arm.L or mixamorig:RightHand.
      bindingName: bone.uuid,
      bindWorldQuaternion: quaternion,
      parentRole: parentSemanticRole(bone, roleByBone)
    });
  }
  return byRole;
}

function sampleTimes(clip, mappedRoles) {
  const values = new Set([0, Math.max(0, clip.duration || 0)]);
  for (const track of clip.tracks || []) {
    const match = String(track.name || '').match(/^(.*)\.(quaternion)$/);
    if (!match) continue;
    const role = semanticRoleForBoneName(match[1]);
    if (!role || !mappedRoles.has(role)) continue;
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

export function retargetHumanoidClip(THREE, clip, sourceModel, targetModel, label) {
  const source = sourceBones(sourceModel);
  const target = targetBindData(THREE, targetModel);
  const sourceRig = analyzeHumanoidRig(sourceModel);
  const targetRig = analyzeHumanoidRig(targetModel);
  if (!source.size) throw new Error('The animation FBX has no recognized humanoid skeleton bind pose.');
  if (!target.size) throw new Error('The current model has no recognized humanoid skeleton to receive animation.');

  const mappedRoles = new Set([...source.keys()].filter(role=>target.has(role)));
  if (!mappedRoles.size) {
    throw new Error('No compatible humanoid bone roles matched between the animation and current model.');
  }

  sourceModel.updateWorldMatrix(true, true);
  targetModel.updateWorldMatrix(true, true);
  const sourceBasis=humanoidRigBasis(THREE,sourceModel);
  const targetBasis=humanoidRigBasis(THREE,targetModel);
  const sourceToTargetBasis=targetBasis.quaternion.clone()
    .multiply(sourceBasis.quaternion.clone().invert()).normalize();
  const sourceToTargetBasisInverse=sourceToTargetBasis.clone().invert();
  const basisCorrectionDegrees=THREE.MathUtils.radToDeg(
    2*Math.acos(THREE.MathUtils.clamp(Math.abs(sourceToTargetBasis.w),-1,1))
  );
  const sourceBindWorld = new Map();
  for (const [role,bone] of source) {
    const q=new THREE.Quaternion();
    bone.getWorldQuaternion(q);
    sourceBindWorld.set(role,q.clone());
  }

  const times = sampleTimes(clip, mappedRoles);
  const valuesByRole = new Map([...mappedRoles].map(role=>[role,[]]));
  const pose = snapshotLocalPose(sourceModel);
  const quaternionTracks = new Map();
  for (const track of clip.tracks || []) {
    const match = String(track.name || '').match(/^(.*)\.(quaternion)$/);
    if (!match) continue;
    const role = semanticRoleForBoneName(match[1]);
    if (role && mappedRoles.has(role) && !quaternionTracks.has(role)) quaternionTracks.set(role, track);
  }

  try {
    for (const time of times) {
      restoreLocalPose(pose);
      for (const [role, track] of quaternionTracks) {
        const sample = track.createInterpolant().evaluate(Math.min(Math.max(time,0),clip.duration));
        const bone = source.get(role);
        if (!bone || sample.length < 4) continue;
        bone.quaternion.set(sample[0],sample[1],sample[2],sample[3]).normalize();
      }
      sourceModel.updateWorldMatrix(true,true);

      const desiredWorld = new Map();
      const pending = new Set(mappedRoles);
      let guard=0;
      while (pending.size && guard++ < mappedRoles.size + 8) {
        let progressed=false;
        for (const role of [...pending]) {
          const targetInfo = target.get(role);
          if (!targetInfo) { pending.delete(role); continue; }
          const parentRole = targetInfo.parentRole;
          if (parentRole && mappedRoles.has(parentRole) && !desiredWorld.has(parentRole)) continue;

          const sourceBone = source.get(role);
          const sourceAnimatedWorld = sourceBone.getWorldQuaternion(new THREE.Quaternion());
          const sourceBind = sourceBindWorld.get(role);
          const worldDelta = sourceAnimatedWorld.clone().multiply(sourceBind.clone().invert()).normalize();
          // Move the source's world-space rotation delta into the target
          // character's anatomical basis. Without this conjugation a +Z-forward
          // source drives a -Z-forward target as if left/right were mirrored.
          const targetDelta = sourceToTargetBasis.clone()
            .multiply(worldDelta)
            .multiply(sourceToTargetBasisInverse)
            .normalize();
          const targetWorld = targetDelta.multiply(targetInfo.bindWorldQuaternion.clone()).normalize();
          desiredWorld.set(role,targetWorld);

          const parentWorld = parentRole && desiredWorld.has(parentRole)
            ? desiredWorld.get(parentRole)
            : parentRole && target.has(parentRole)
              ? target.get(parentRole).bindWorldQuaternion
              : new THREE.Quaternion();
          const local = parentWorld.clone().invert().multiply(targetWorld).normalize();
          valuesByRole.get(role).push(local.x,local.y,local.z,local.w);
          pending.delete(role);
          progressed=true;
        }
        if (!progressed) break;
      }
      if (pending.size) {
        throw new Error(`The target humanoid hierarchy could not resolve roles: ${[...pending].join(', ')}.`);
      }
    }
  } finally {
    restoreLocalPose(pose);
    sourceModel.updateWorldMatrix(true,true);
  }

  const tracks=[];
  for (const role of mappedRoles) {
    const info=target.get(role), values=valuesByRole.get(role);
    if (!values?.length) continue;
    tracks.push(new THREE.QuaternionKeyframeTrack(`${info.bindingName}.quaternion`,times,values));
  }
  if (!tracks.length) throw new Error('No compatible humanoid rotation tracks matched the current model.');

  const importInfo = {
    sourceName: clip.name || '',
    mappedTracks: tracks.length,
    mappedRoles: [...mappedRoles],
    skippedTracks: Math.max(0,(clip.tracks?.length||0)-tracks.length),
    retargetMode: 'semantic-anatomical-basis-bind-delta',
    sourceRigFamily: sourceRig.family,
    targetRigFamily: targetRig.family,
    targetCoverage: targetRig.coverage,
    sourceBasisResolved:sourceBasis.resolved,
    targetBasisResolved:targetBasis.resolved,
    basisCorrectionDegrees,
    sourceForwardAxis:sourceBasis.forwardAxis||null,
    targetForwardAxis:targetBasis.forwardAxis||null
  };
  const result = new THREE.AnimationClip(label, clip.duration, tracks);
  result.userData = {
    studioAnimationId: `humanoid:${label}`,
    humanoidImport: importInfo,
    // Compatibility for existing diagnostics/tests that still read this field.
    mixamoImport: importInfo
  };
  return result;
}

// Backward-compatible API name.
export const retargetMixamoClip = retargetHumanoidClip;
