export function normalizedRigName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function sourceBindMap(model) {
  const map = new Map();
  model?.traverse(object => {
    if (!object.isBone) return;
    const key = normalizedRigName(object.name);
    if (!key || map.has(key)) return;
    map.set(key, {
      name: object.name,
      quaternion: object.quaternion.clone()
    });
  });
  return map;
}

function targetBindMap(THREE, model) {
  const byKey = new Map();
  const worldByBone = new Map();

  model?.traverse(object => {
    if (!object.isSkinnedMesh) return;
    const skeleton = object.skeleton;
    if (!skeleton?.bones?.length || skeleton.boneInverses.length !== skeleton.bones.length) return;
    skeleton.bones.forEach((bone, index) => {
      if (worldByBone.has(bone)) return;
      const bindWorld = skeleton.boneInverses[index].clone().invert();
      worldByBone.set(bone, bindWorld);
    });
  });

  if (worldByBone.size) {
    for (const [bone, bindWorld] of worldByBone) {
      const key = normalizedRigName(bone.name);
      if (!key || byKey.has(key)) continue;
      const parentBind = bone.parent?.isBone ? worldByBone.get(bone.parent) : null;
      const local = parentBind ? parentBind.clone().invert().multiply(bindWorld) : bindWorld.clone();
      const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
      local.decompose(position, quaternion, scale);
      byKey.set(key, {
        name: THREE.PropertyBinding.sanitizeNodeName(bone.name),
        quaternion
      });
    }
  }

  if (!byKey.size) {
    model?.traverse(object => {
      if (!object.isBone) return;
      const key = normalizedRigName(object.name);
      if (!key || byKey.has(key)) return;
      byKey.set(key, {
        name: THREE.PropertyBinding.sanitizeNodeName(object.name),
        quaternion: object.quaternion.clone()
      });
    });
  }

  return byKey;
}

export function retargetMixamoClip(THREE, clip, sourceModel, targetModel, label) {
  const source = sourceBindMap(sourceModel);
  const target = targetBindMap(THREE, targetModel);
  if (!source.size) throw new Error('The Mixamo FBX has no skeleton bind pose.');
  if (!target.size) throw new Error('The current model has no skeleton to receive animation.');

  let mapped = 0, skipped = 0;
  const tracks = [];

  for (const track of clip.tracks || []) {
    const match = String(track.name || '').match(/^(.*)\.(position|quaternion|scale)$/);
    if (!match) { skipped++; continue; }
    const [, sourceName, property] = match;
    if (property !== 'quaternion') { skipped++; continue; }

    const key = normalizedRigName(sourceName);
    const sourceBind = source.get(key);
    const targetBind = target.get(key);
    if (!sourceBind || !targetBind) { skipped++; continue; }

    const stride = track.getValueSize();
    if (stride !== 4) { skipped++; continue; }
    const values = Array.from(track.values);
    for (let offset = 0; offset < values.length; offset += 4) {
      const sourceAnimated = new THREE.Quaternion(
        values[offset], values[offset + 1], values[offset + 2], values[offset + 3]
      ).normalize();
      const delta = sourceBind.quaternion.clone().invert().multiply(sourceAnimated);
      const targetAnimated = targetBind.quaternion.clone().multiply(delta).normalize();
      values[offset] = targetAnimated.x;
      values[offset + 1] = targetAnimated.y;
      values[offset + 2] = targetAnimated.z;
      values[offset + 3] = targetAnimated.w;
    }

    const cloned = track.clone();
    cloned.name = `${targetBind.name}.quaternion`;
    cloned.values = new track.values.constructor(values);
    tracks.push(cloned);
    mapped++;
  }

  if (!tracks.length) throw new Error('No compatible Mixamo rotation tracks matched the current model.');

  const result = new THREE.AnimationClip(label, clip.duration, tracks);
  result.userData = {
    studioAnimationId: `mixamo:${label}`,
    mixamoImport: {
      sourceName: clip.name || '',
      mappedTracks: mapped,
      skippedTracks: skipped,
      retargetMode: 'bind-space-local-delta'
    }
  };
  return result;
}
