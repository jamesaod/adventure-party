/**
 * Opt-in, non-destructive skinning cleanup for imported humanoids.
 * Classifies disconnected mesh surfaces by aggregate skeletal influences;
 * removes arm weights from leg surfaces and leg weights from upper-body surfaces.
 * Never alters the GLB on disk, skeletal bind matrices, or animations.
 */
export const CROSS_LIMB_REPAIR = 'cross-limb-components-v1';

function boneFamily(name) {
  // Three.js GLTFLoader sanitizes Mixamo names such as
  // 'mixamorig:LeftUpLeg' into 'mixamorig_LeftUpLeg'. Treat both identically.
  const normalized = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const label = normalized.startsWith('mixamorig')
    ? normalized.slice('mixamorig'.length) : normalized;
  if (/^(left|right)(upleg|leg|foot|toebase|toeend)$/.test(label)) return 'leg';
  if (/^(left|right)(shoulder|arm|forearm|hand.*)$/.test(label)) return 'arm';
  if (/^(hips|spine\d*)$/.test(label)) return 'torso';
  return 'other';
}

function connectedComponents(index, count) {
  const parent = Int32Array.from({ length: count }, (_, i) => i);
  const find = i => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  const merge = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };
  for (let k = 0; k < index.count; k += 3) {
    const a = index.getX(k), b = index.getX(k + 1), c = index.getX(k + 2);
    merge(a, b); merge(a, c);
  }
  return Array.from({ length: count }, (_, i) => find(i));
}

export function repairCrossLimbSkinning(root, profile = CROSS_LIMB_REPAIR) {
  if (profile !== CROSS_LIMB_REPAIR) throw new Error('Unknown skin repair profile: ' + profile);
  const report = { meshes: 0, vertices: 0, beforeMixed: 0, afterMixed: 0,
    correctedVertices: 0, correctedComponents: 0, ambiguousComponents: 0 };
  root.traverse(object => {
    if (!object.isSkinnedMesh) return;
    const geom = object.geometry;
    const position = geom?.getAttribute('position');
    const joints = geom?.getAttribute('skinIndex');
    const weights = geom?.getAttribute('skinWeight');
    const index = geom?.index;
    if (!position || !joints || !weights || !index || joints.count !== position.count ||
        weights.count !== position.count || index.count % 3) {
      throw new Error('Cross-limb skin repair requires an indexed GLTF skinned mesh with four bone weights per vertex.');
    }
    const families = object.skeleton?.bones?.map(bone => boneFamily(bone.name));
    if (!families?.includes('arm') || !families?.includes('leg')) {
      throw new Error('Cross-limb skin repair requires named arm and leg bones.');
    }
    const count = position.count;
    const rootForVertex = connectedComponents(index, count);
    const groups = new Map();
    for (let i = 0; i < count; i++) {
      const jointIds = [joints.getX(i), joints.getY(i), joints.getZ(i), joints.getW(i)];
      const influence = [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)];
      const current = { index: i, jointIds, influence, arm: 0, leg: 0 };
      const familyTotals = { arm: 0, leg: 0, torso: 0 };
      for (let k = 0; k < 4; k++) {
        const weight = influence[k];
        if (!Number.isFinite(weight) || weight < 0 || jointIds[k] < 0 || jointIds[k] >= families.length) {
          throw new Error('Invalid skin weight or joint index.');
        }
        const family = families[jointIds[k]];
        if (family in familyTotals) familyTotals[family] += weight;
      }
      current.arm = familyTotals.arm;
      current.leg = familyTotals.leg;
      const key = rootForVertex[i];
      if (!groups.has(key)) groups.set(key, { vertices: [], arm: 0, leg: 0, torso: 0,
        minY: Infinity, maxY: -Infinity, mixed: 0 });
      const group = groups.get(key);
      group.vertices.push(current);
      group.arm += current.arm;
      group.leg += current.leg;
      group.torso += familyTotals.torso;
      group.minY = Math.min(group.minY, position.getY(i));
      group.maxY = Math.max(group.maxY, position.getY(i));
      if (current.arm >= 0.05 && current.leg >= 0.05) { group.mixed++; report.beforeMixed++; }
    }
    const updates = [];
    for (const group of groups.values()) {
      if (!group.mixed) continue;
      let remove = null;
      if (group.leg > group.arm * 2 || (group.maxY < 0.56 && group.leg > group.arm)) remove = 'arm';
      else if (group.arm > group.leg * 2 ||
        (group.minY > 0.58 && group.torso > Math.max(group.leg, group.arm))) remove = 'leg';
      if (!remove) { report.ambiguousComponents++; continue; }
      report.correctedComponents++;
      for (const entry of group.vertices) {
        const fixed = entry.influence.map((weight, k) =>
          families[entry.jointIds[k]] === remove ? 0 : weight);
        if (!fixed.some((weight, k) => weight !== entry.influence[k])) continue;
        const sum = fixed.reduce((a, b) => a + b, 0);
        if (sum <= 1e-7) throw new Error('Skin repair would remove all influences from a vertex.');
        updates.push({ index: entry.index, fixed: fixed.map(value => value / sum) });
      }
    }
    for (const { index: i, fixed } of updates) weights.setXYZW(i, ...fixed);
    if (updates.length) weights.needsUpdate = true;
    for (let i = 0; i < count; i++) {
      let arm = 0, leg = 0;
      const ji = [joints.getX(i), joints.getY(i), joints.getZ(i), joints.getW(i)];
      const wi = [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)];
      for (let k = 0; k < 4; k++) {
        if (families[ji[k]] === 'arm') arm += wi[k];
        if (families[ji[k]] === 'leg') leg += wi[k];
      }
      if (arm >= 0.05 && leg >= 0.05) report.afterMixed++;
    }
    report.meshes++;
    report.vertices += count;
    report.correctedVertices += updates.length;
  });
  if (!report.meshes) throw new Error('No skinned meshes to repair.');
  return report;
}
