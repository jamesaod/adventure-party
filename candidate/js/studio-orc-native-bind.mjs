/**
 * Rev 106 diagnostic: rebase Carl-reference UAL2 clips onto the Orc's OWN bind.
 *
 * The Rev 103 offline proof preserved the original Orc inverse bind matrices
 * but its animated joint rotations were composed around Carl's T-pose. Those
 * rotations are not the Orc's original rest rotations. This experimental
 * alternative takes the already-baked clip and converts each local quaternion:
 *
 *   corrected(t) = orcNativeBind * inverse(carlReferenceBind) * baked(t)
 *
 * At donor neutral, corrected = orcNativeBind. No skeleton, mesh, inverse bind,
 * skin weight, translation, weapon socket, or source animation file is edited.
 * Importantly, this is a separate MODEL LIBRARY ENTRY, not a global retarget fix.
 */
export const ORC_NATIVE_BIND_REBASE = 'orc-native-bind-v1';
export const CARL_REFERENCE_SHA256 = '5284bd3cd0b9fe6665c5d94ec0fc7fae8ec4a5856f0628f3084ae1190b044693';

const normalizeBone = name => String(name || '')
  .replace(/[^a-z0-9]/gi, '').replace(/^mixamorig/i, '').toLowerCase();

export function unpackCarlReference(reference) {
  if (reference?.version !== 1 || reference.sourceSha256 !== CARL_REFERENCE_SHA256 ||
      typeof reference.jointNames !== 'string' || typeof reference.quaternionsF32LE !== 'string') {
    throw new Error('Unknown or corrupt Carl bind reference profile.');
  }
  const names = reference.jointNames.split('|');
  if (names.length !== 64 || new Set(names.map(normalizeBone)).size !== 64) {
    throw new Error('Carl bind reference must contain 64 unique mapped joints.');
  }
  // Compatible with both browser and Node; the encoded data is only 1024 bytes.
  const raw = atob(reference.quaternionsF32LE);
  if (raw.length !== names.length * 16) throw new Error('Carl bind quaternions have the wrong length.');
  const buf = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const view = new DataView(buf);
  const map = new Map();
  for (let i = 0; i < names.length; i++) {
    const q = [0, 1, 2, 3].map(j => view.getFloat32(i * 16 + j * 4, true));
    const length = Math.hypot(...q);
    if (!q.every(Number.isFinite) || !(length > 0.999 && length < 1.001)) {
      throw new Error('Carl bind reference contains an invalid quaternion.');
    }
    map.set(normalizeBone(names[i]), q);
  }
  return map;
}

export function rebaseOrcUal2Clips(THREE, model, clips, reference, profile = ORC_NATIVE_BIND_REBASE) {
  if (profile !== ORC_NATIVE_BIND_REBASE) throw new Error('Unknown Orc native-bind experiment profile.');
  const poses = unpackCarlReference(reference);
  const native = new Map();
  model.traverse(object => {
    if (!object.isBone) return;
    const name = normalizeBone(object.name);
    if (native.has(name)) throw new Error('Duplicate humanoid bone: ' + name);
    native.set(name, object.quaternion.clone().normalize());
  });
  for (const name of poses.keys()) {
    if (!native.has(name)) throw new Error('Orc is missing a reference joint: ' + name);
  }
  const output = [];
  let rotatedTracks = 0;
  const seen = new Set();
  for (const input of clips) {
    if (!['UAL2_Sword_Ready', 'UAL2_Sword_Regular_A'].includes(input.name)) {
      throw new Error('Native-bind experimental profile accepts only the approved UAL2 Orc proof clips.');
    }
    const clip = input.clone();
    let perClip = 0;
    for (const track of clip.tracks) {
      const dot = track.name.lastIndexOf('.');
      if (dot < 0) throw new Error('Animation track has no property binding: ' + track.name);
      const property = track.name.slice(dot + 1);
      if (property === 'position') continue; // Preserve the existing hip lift and motion.
      if (property !== 'quaternion') throw new Error('Unexpected Orc animation property: ' + property);
      const name = normalizeBone(track.name.slice(0, dot));
      const sourceQ = poses.get(name);
      const nativeQ = native.get(name);
      if (!sourceQ || !nativeQ) throw new Error('Animation joint cannot be rebased: ' + track.name);
      if (track.values.length !== track.times.length * 4 || track.times.length < 2 ||
          track.createInterpolant?.isInterpolantFactoryMethodGLTFCubicSpline) {
        throw new Error('Native-bind rebase needs dense linear quaternion keys.');
      }
      const correction = nativeQ.clone().multiply(new THREE.Quaternion(...sourceQ).invert());
      const q = new THREE.Quaternion();
      for (let i = 0; i < track.times.length; i++) {
        const j = i * 4;
        q.fromArray(track.values, j);
        if (![q.x, q.y, q.z, q.w].every(Number.isFinite)) {
          throw new Error('Non-finite source quaternion.');
        }
        q.premultiply(correction).normalize();
        q.toArray(track.values, j);
      }
      perClip++;
      rotatedTracks++;
      seen.add(name);
    }
    if (perClip !== 64) throw new Error('Expected 64 mapped rotations in ' + clip.name + '; got ' + perClip);
    output.push(clip);
  }
  if (output.length !== 2 || seen.size !== 64) throw new Error('Incomplete Orc native-bind rebase.');
  return {
    clips: output,
    report: {
      profile, clipCount: output.length, rotatedTracks,
      mappedBones: seen.size,
      sourceReferenceSha256: reference.sourceSha256,
      geometryReweighted: false,
      originalOrcBindPreserved: true
    }
  };
}
