/**
 * Semantic humanoid-rig adapter.
 *
 * Renderer/animation code should ask for roles such as rightHand or leftForeArm
 * instead of depending on one author's raw bone names. The first pass recognizes
 * Mixamo, Blender/Rigify-style, Unreal-style, Bip01 and common generic names.
 */

export const HUMANOID_CORE_ROLES = Object.freeze([
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftForeArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightForeArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot'
]);

const ROLE_ALIASES = Object.freeze({
  hips: ['ccbasehip','mixamorighips','hips','pelvis','rootpelvis','bip01pelvis','bip001pelvis','bip01hips'],
  spine: ['ccbasewaist','mixamorigspine','spine','spine01','spine001','bip01spine','bip001spine'],
  chest: ['ccbasespine01','mixamorigspine1','spine1','spine02','spine002','chest','chest1','bip01spine1','bip001spine1'],
  upperChest: ['ccbasespine02','mixamorigspine2','spine2','spine03','spine003','upperchest','chest2','bip01spine2','bip001spine2'],
  neck: ['ccbasenecktwist01','mixamorigneck','neck','neck01','bip01neck','bip001neck'],
  head: ['ccbasehead','mixamorighead','head','head01','bip01head','bip001head'],

  leftShoulder: ['ccbaselclavicle','mixamorigleftshoulder','leftshoulder','shoulderl','lshoulder','claviclel','leftclavicle','bip01lclavicle','bip001lclavicle'],
  leftUpperArm: ['ccbaselupperarm','mixamorigleftarm','leftarm','leftupperarm','upperarml','lupperarm','arml','bip01lupperarm','bip001lupperarm'],
  leftForeArm: ['ccbaselforearm','mixamorigleftforearm','leftforearm','leftlowerarm','forearml','lowerarml','lforearm','bip01lforearm','bip001lforearm'],
  leftHand: ['ccbaselhand','mixamoriglefthand','lefthand','handl','lhand','bip01lhand','bip001lhand'],

  rightShoulder: ['ccbaserclavicle','mixamorigrightshoulder','rightshoulder','shoulderr','rshoulder','clavicler','rightclavicle','bip01rclavicle','bip001rclavicle'],
  rightUpperArm: ['ccbaserupperarm','mixamorigrightarm','rightarm','rightupperarm','upperarmr','rupperarm','armr','bip01rupperarm','bip001rupperarm'],
  rightForeArm: ['ccbaserforearm','mixamorigrightforearm','rightforearm','rightlowerarm','forearmr','lowerarmr','rforearm','bip01rforearm','bip001rforearm'],
  rightHand: ['ccbaserhand','mixamorigrighthand','righthand','handr','rhand','bip01rhand','bip001rhand'],

  leftUpperLeg: ['ccbaselthigh','mixamorigleftupleg','leftupleg','leftupperleg','thighl','leftthigh','lthigh','bip01lthigh','bip001lthigh'],
  leftLowerLeg: ['ccbaselcalf','mixamorigleftleg','leftleg','leftlowerleg','calfl','leftcalf','shinl','bip01lcalf','bip001lcalf'],
  leftFoot: ['ccbaselfoot','mixamorigleftfoot','leftfoot','footl','lfoot','bip01lfoot','bip001lfoot'],
  leftToe: ['ccbaseltoebase','mixamoriglefttoebase','lefttoebase','lefttoe','toel','balll','bip01ltoe0','bip001ltoe0'],

  rightUpperLeg: ['ccbaserthigh','mixamorigrightupleg','rightupleg','rightupperleg','thighr','rightthigh','rthigh','bip01rthigh','bip001rthigh'],
  rightLowerLeg: ['ccbasercalf','mixamorigrightleg','rightleg','rightlowerleg','calfr','rightcalf','shinr','bip01rcalf','bip001rcalf'],
  rightFoot: ['ccbaserfoot','mixamorigrightfoot','rightfoot','footr','rfoot','bip01rfoot','bip001rfoot'],
  rightToe: ['ccbasertoebase','mixamorigrighttoebase','righttoebase','righttoe','toer','ballr','bip01rtoe0','bip001rtoe0']
});

const ALIAS_TO_ROLE = new Map();
for (const [role, aliases] of Object.entries(ROLE_ALIASES)) {
  for (const alias of aliases) if (!ALIAS_TO_ROLE.has(alias)) ALIAS_TO_ROLE.set(alias, role);
}

export function normalizeHumanoidBoneName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const fingerRole = normalized => {
  // CC5 uses Mid for the middle finger; leave twist/share helpers unmapped.
  normalized = normalized.replace(/^ccbase([lr])mid([1-3])$/, '$1middle$2').replace(/^ccbase([lr])(index|ring|pinky|thumb)([1-3])$/, '$1$2$3');
  const match = normalized.match(/(?:mixamorig)?(left|right)hand(index|middle|ring|pinky|little|thumb)([1-4])$/)
    || normalized.match(/(index|middle|ring|pinky|little|thumb)([1-4])([lr])$/)
    || normalized.match(/([lr])(index|middle|ring|pinky|little|thumb)([1-4])$/);
  if (!match) return null;
  let side, digit, index;
  if (match[1] === 'left' || match[1] === 'right') {
    side = match[1]; digit = match[2]; index = match[3];
  } else if (match[3] === 'l' || match[3] === 'r') {
    side = match[3] === 'l' ? 'left' : 'right'; digit = match[1]; index = match[2];
  } else {
    side = match[1] === 'l' ? 'left' : 'right'; digit = match[2]; index = match[3];
  }
  if (digit === 'little') digit = 'pinky';
  return `${side}${digit[0].toUpperCase()}${digit.slice(1)}${index}`;
};

export function semanticRoleForBoneName(value) {
  const normalized = normalizeHumanoidBoneName(value);
  if (!normalized) return null;
  const finger = fingerRole(normalized);
  if (finger) return finger;
  const exact = ALIAS_TO_ROLE.get(normalized);
  if (exact) return exact;

  // Namespace/prefix tolerant fallback for rigs such as Character_Bip01_R_Hand.
  let best = null;
  for (const [alias, role] of ALIAS_TO_ROLE) {
    if (alias.length < 5 || !normalized.endsWith(alias)) continue;
    if (!best || alias.length > best.alias.length) best = { alias, role };
  }
  return best?.role || null;
}

function candidateScore(name, role) {
  const normalized = normalizeHumanoidBoneName(name);
  const aliases = ROLE_ALIASES[role] || [];
  const exact = aliases.indexOf(normalized);
  if (exact >= 0) return 1000 - exact;
  let best = 0;
  for (const alias of aliases) if (normalized.endsWith(alias)) best = Math.max(best, alias.length);
  return best;
}

export function semanticBoneMap(model) {
  const byRole = new Map();
  const scores = new Map();
  model?.traverse(object => {
    if (!object.isBone) return;
    const role = semanticRoleForBoneName(object.name);
    if (!role) return;
    const score = candidateScore(object.name, role);
    if (!byRole.has(role) || score > (scores.get(role) || -1)) {
      byRole.set(role, object);
      scores.set(role, score);
    }
  });
  return byRole;
}

export function findHumanoidBone(model, role) {
  return semanticBoneMap(model).get(role) || null;
}

export function humanoidFingerChains(model, side = 'left') {
  const map = semanticBoneMap(model);
  const prefix = side === 'right' ? 'right' : 'left';
  const chains = [];
  for (const digit of ['index','middle','ring','pinky','thumb']) {
    const cap = digit[0].toUpperCase() + digit.slice(1);
    const bones = [1,2,3].map(index => map.get(`${prefix}${cap}${index}`) || null);
    if (bones.every(Boolean)) chains.push({ fingerName: digit, bones });
  }
  return chains;
}

function rigFamily(boneNames) {
  const normalized = boneNames.map(normalizeHumanoidBoneName);
  const count = test => normalized.filter(test).length;
  const mixamo = count(name => name.startsWith('mixamorig'));
  const bip = count(name => /^bip0*1/.test(name) || /^bip0*01/.test(name));
  const rigify = count(name => /(upperarm|forearm|thigh|shin|hand|foot)[lr]$/.test(name));
  if (mixamo >= 10) return 'mixamo';
  if (bip >= 8) return 'biped';
  if (rigify >= 8) return 'rigify-or-unreal';
  return 'generic';
}

export function analyzeHumanoidRig(model) {
  const map = semanticBoneMap(model);
  const boneNames = [];
  model?.traverse(object => { if (object.isBone) boneNames.push(object.name || ''); });
  const missingRoles = HUMANOID_CORE_ROLES.filter(role => !map.has(role));
  const mappedCoreRoles = HUMANOID_CORE_ROLES.length - missingRoles.length;
  const leftFingers = humanoidFingerChains(model, 'left');
  const rightFingers = humanoidFingerChains(model, 'right');
  const family = rigFamily(boneNames);
  const requiredAnimationRoles = [
    'hips','spine','leftUpperArm','leftForeArm','leftHand',
    'rightUpperArm','rightForeArm','rightHand',
    'leftUpperLeg','leftLowerLeg','leftFoot',
    'rightUpperLeg','rightLowerLeg','rightFoot'
  ];
  const animationReady = requiredAnimationRoles.every(role => map.has(role));
  const twoHandedRoles = ['rightHand','leftShoulder','leftUpperArm','leftForeArm','leftHand'];
  return {
    version: 1,
    family,
    boneCount: boneNames.length,
    mappedCoreRoles,
    coreRoleCount: HUMANOID_CORE_ROLES.length,
    coverage: HUMANOID_CORE_ROLES.length ? mappedCoreRoles / HUMANOID_CORE_ROLES.length : 0,
    missingRoles,
    animationReady,
    equipmentReady: map.has('rightHand') && map.has('leftHand'),
    twoHandedReady: twoHandedRoles.every(role => map.has(role)),
    fingerChains: { left: leftFingers.length, right: rightFingers.length },
    mapping: Object.fromEntries([...map].map(([role, bone]) => [role, bone.name || null]))
  };
}

export function parentSemanticRole(bone, roleByBone) {
  let parent = bone?.parent || null;
  while (parent) {
    if (roleByBone.has(parent)) return roleByBone.get(parent);
    parent = parent.parent;
  }
  return null;
}

export function semanticRoleByBone(model) {
  const result = new Map();
  for (const [role, bone] of semanticBoneMap(model)) result.set(bone, role);
  return result;
}
