import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  sliceAnimationClip, prepareStudioAnimations, freezeAnimationClip, animationOptionLabel,
  animationSourceId, restoreAnimationIndex
} from '../js/studio-animations.mjs';

// Node 20 can load the bundled ESM without changing this repository's package type.
const source = fs.readFileSync(new URL('../assets/vendor/three/three.core.min.js', import.meta.url));
const THREE = await import(`data:text/javascript;base64,${source.toString('base64')}`);
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6,
  `${message}: expected ${expected}, received ${actual}`);
const valuesClose = (actual, expected, message) => {
  assert.equal(actual.length, expected.length, message);
  actual.forEach((value, index) => close(value, expected[index], message));
};
const quaternion = angle => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle).toArray();
const tracks = [
  new THREE.VectorKeyframeTrack('.position', [0, 4, 10], [0, 0, 0, 4, 8, 12, 10, 20, 30]),
  new THREE.QuaternionKeyframeTrack('.quaternion', [0, 10], [...quaternion(0), ...quaternion(Math.PI)]),
  new THREE.NumberKeyframeTrack('.morphTargetInfluences[0]', [0, 10], [0, 1]),
  new THREE.VectorKeyframeTrack('.scale', [5], [2, 3, 4]),
  new THREE.BooleanKeyframeTrack('.visible', [0, 4, 8], [true, false, true]),
  new THREE.StringKeyframeTrack('.name', [0, 4, 8], ['ready', 'attack', 'prone'])
];
const original = new THREE.AnimationClip('Combined take', 10, tracks);
original.userData = { source: 'fixture', nested: { unchanged: true } };
const before = JSON.stringify(THREE.AnimationClip.toJSON(original));
const ranged = sliceAnimationClip(original, 2, 8, 'Attack');
assert.equal(ranged.name, 'Attack');
assert.equal(ranged.duration, 6);
assert.notEqual(ranged.uuid, original.uuid);
assert.deepEqual(ranged.userData, original.userData);
assert.notEqual(ranged.userData, original.userData);
assert.deepEqual(Array.from(ranged.tracks[0].times), [0, 2, 6]);
assert.deepEqual(Array.from(ranged.tracks[3].times), [0, 3, 6]);
for (let index = 0; index < tracks.length; index++) {
  assert.notEqual(ranged.tracks[index], tracks[index]);
  assert.notEqual(ranged.tracks[index].times, tracks[index].times);
  assert.notEqual(ranged.tracks[index].values, tracks[index].values);
  assert.equal(ranged.tracks[index].getInterpolation(), tracks[index].getInterpolation());
  for (const time of [0, 1, 2, 3, 5, 6]) {
    const actual = Array.from(ranged.tracks[index].createInterpolant().evaluate(time));
    const expected = Array.from(tracks[index].createInterpolant().evaluate(time + 2));
    if (['bool', 'string'].includes(tracks[index].ValueTypeName)) assert.deepEqual(actual, expected);
    else valuesClose(actual, expected, `Track ${index} at range time ${time}`);
  }
}
assert.equal(JSON.stringify(THREE.AnimationClip.toJSON(original)), before, 'Slicing leaves the entire source clip unchanged');
assert.deepEqual(Array.from(sliceAnimationClip(original, 0, 10).tracks[0].times), [0, 4, 10],
  'Cuts on existing keys do not duplicate endpoint keys');

// Apply the result through the real mixer, including properties without interior keys.
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
geometry.morphAttributes.position = [new THREE.Float32BufferAttribute([1, 0, 0], 3)];
const model = new THREE.Mesh(geometry);
const mixer = new THREE.AnimationMixer(model);
const action = mixer.clipAction(ranged).play();
action.paused = true;
for (const time of [0, 6]) {
  action.time = time;
  mixer.update(0);
  valuesClose(model.position.toArray(), [time + 2, (time + 2) * 2, (time + 2) * 3], 'Mixer vector pose');
  valuesClose(model.quaternion.toArray(), quaternion((time + 2) / 10 * Math.PI), 'Mixer quaternion pose');
  valuesClose(model.scale.toArray(), [2, 3, 4], 'Sparse scale remains in both endpoint poses');
  close(model.morphTargetInfluences[0], (time + 2) / 10, 'Morph endpoint');
  assert.equal(model.name, time === 0 ? 'ready' : 'prone', 'String values survive real mixer evaluation');
}
mixer.stopAllAction();

const frozen = freezeAnimationClip(original, 2.5, 'UAL2_2H_Sword_Rest');
assert.equal(frozen.name,'UAL2_2H_Sword_Rest');
assert.equal(frozen.duration,1);
assert.match(animationSourceId(frozen),/^frozen:/);
assert.deepEqual(frozen.userData.frozenPose,{sourceName:'Combined take',sourceId:'',timeSeconds:2.5});
for(let index=0;index<tracks.length;index++){
  const expected=Array.from(tracks[index].createInterpolant().evaluate(2.5));
  for(const time of [0,0.5,1]){
    const actual=Array.from(frozen.tracks[index].createInterpolant().evaluate(time));
    if(['bool','string'].includes(tracks[index].ValueTypeName))assert.deepEqual(actual,expected);
    else valuesClose(actual,expected,`Frozen track ${index} remains static at ${time}`);
  }
}
assert.equal(JSON.stringify(THREE.AnimationClip.toJSON(original)),before,'Freezing a pose leaves source animation unchanged');

const fbx = new THREE.AnimationClip('Named take', 12, [
  new THREE.VectorKeyframeTrack('.position', [10, 12], [1, 2, 3, 5, 6, 7])
]);
fbx.userData.fbxAnimation = { stackId: '42', start: 8, end: 14, layerCount: 1 };
const normalized = prepareStudioAnimations([fbx])[0];
assert.equal(normalized.duration, 6);
assert.deepEqual(Array.from(normalized.tracks[0].times), [0, 2, 4, 6]);
assert.deepEqual(Array.from(normalized.tracks[0].values), [1, 2, 3, 1, 2, 3, 5, 6, 7, 5, 6, 7]);
assert.deepEqual(normalized.userData.fbxAnimation, { ...fbx.userData.fbxAnimation, timingNormalized: true });
assert.equal(fbx.duration, 12);
assert.equal(fbx.userData.fbxAnimation.timingNormalized, undefined);
assert.deepEqual(THREE.AnimationClip.toJSON(prepareStudioAnimations([normalized])[0]).tracks,
  THREE.AnimationClip.toJSON(normalized).tracks, 'Preparation is idempotent');
const withoutRange = fbx.clone();
withoutRange.userData.fbxAnimation = { stackId: '43', start: null, end: null, layerCount: 1 };
assert.equal(prepareStudioAnimations([withoutRange])[0].duration, 12);
assert.equal(prepareStudioAnimations([new THREE.AnimationClip('Empty', 2, []),
  new THREE.AnimationClip('Zero duration', 0, [tracks[0]]), original]).length, 1);
for (const fixture of [
  { times: [-4, -2], values: [1, 3], start: -5, end: -1, expected: [1, 1, 3, 3] },
  { times: [0], values: [7], start: 2, end: 5, expected: [7, 7] }
]) {
  const held = new THREE.AnimationClip('Authored hold', -1, [new THREE.NumberKeyframeTrack('.value', fixture.times, fixture.values)]);
  held.userData.fbxAnimation = { stackId: 'hold', start: fixture.start, end: fixture.end, layerCount: 1 };
  assert.ok(held.duration <= 0);
  const prepared = prepareStudioAnimations([held]);
  assert.equal(prepared.length, 1, 'A positive authored span retains a zero/negative raw timeline');
  assert.equal(prepared[0].duration, fixture.end - fixture.start);
  assert.deepEqual(Array.from(prepared[0].tracks[0].values), fixture.expected);
}

for (const [start, end] of [[-1, 2], [3, 3], [4, 2], [0, 11], [NaN, 2], [0, Infinity]]) {
  assert.throws(() => sliceAnimationClip(original, start, end), /range/i);
}
const invalidRange = fbx.clone();
invalidRange.userData.fbxAnimation.end = NaN;
assert.throws(() => prepareStudioAnimations([invalidRange]), /authored start\/end/);
const invalidTrack = original.clone();
invalidTrack.tracks[0].values[0] = Infinity;
assert.throws(() => sliceAnimationClip(invalidTrack, 2, 8), /values must be finite/);
invalidTrack.tracks[0].values[0] = 0;
invalidTrack.tracks[0].times[1] = NaN;
assert.throws(() => sliceAnimationClip(invalidTrack, 2, 8), /times must be finite/);

// glTF cubic splines store in/value/out triples: never treat them as plain values.
const cubic = new THREE.VectorKeyframeTrack('.position', [0, 1], new Array(18).fill(0));
cubic.createInterpolant = function customCubic() { throw new Error('Must not sample packed cubic values'); };
cubic.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline = true;
const cubicClip = new THREE.AnimationClip('Spline', 1, [cubic]);
assert.throws(() => sliceAnimationClip(cubicClip, 0, 0.5), /glTF cubic-spline/);
assert.equal(prepareStudioAnimations([cubicClip])[0].tracks[0].createInterpolant,
  cubic.createInterpolant, 'A complete glTF cubic-spline animation remains usable');
const smooth = new THREE.AnimationClip('Smooth curve', 6, [
  new THREE.NumberKeyframeTrack('.value', [0, 2, 4, 6], [0, 2, -1, 3], THREE.InterpolateSmooth)
]);
assert.throws(() => sliceAnimationClip(smooth, 1, 5), /smooth cubic interpolation/);
assert.equal(prepareStudioAnimations([smooth])[0].tracks[0].getInterpolation(), THREE.InterpolateSmooth,
  'Complete smooth animations remain usable without changing their curve');

const duplicate = normalized.clone();
duplicate.userData.fbxAnimation.stackId = '99';
const unnamed = original.clone();
unnamed.name = '';
const custom = ranged.clone();
custom.userData.studioAnimationId = 'range:attack';
const choices = [normalized, duplicate, unnamed, custom];
assert.equal(animationSourceId(normalized), 'fbx:42');
assert.equal(animationSourceId(custom), 'range:attack');
assert.match(animationOptionLabel(normalized, 0), /^1\. Named take.*6\.00 s$/);
assert.match(animationOptionLabel(duplicate, 1), /^2\. Named take/);
assert.match(animationOptionLabel(unnamed, 2), /3\. Unnamed animation/);
assert.equal(restoreAnimationIndex(choices, { clipIndex: 1, clipName: 'Named take' }), 1);
assert.equal(restoreAnimationIndex(choices, { clipIndex: 0, clipName: 'Attack' }), 3,
  'A unique legacy name repairs an index shifted by a newly recovered authored take');
assert.equal(restoreAnimationIndex(choices, { clipIndex: 0, clipSourceId: 'fbx:99' }), 1);
assert.equal(restoreAnimationIndex(choices, { clipIndex: 0, clipSourceId: 'range:attack' }), 3);
assert.equal(restoreAnimationIndex(choices, { clipIndex: -1, clipName: '', clipSourceId: 'fbx:42' }), -1);
assert.equal(restoreAnimationIndex(choices, { clipIndex: 99, clipName: 'Attack' }), 3);
assert.equal(restoreAnimationIndex(choices, { clipName: 'Named take' }), 0);
assert.equal(restoreAnimationIndex([], { clipIndex: 0 }), -1);
assert.equal(restoreAnimationIndex(choices, null), 0, 'A new model has no restore settings');
const studioSource=fs.readFileSync(new URL('../js/3d-studio.mjs',import.meta.url),'utf8');
for(const sample of ['0.0','0.5','1.0','1.5','2.0','2.5']){
  assert.ok(studioSource.includes(`UAL2_2H_Rest_Candidate_\${time.toFixed(1)}s`)||studioSource.includes('restSamples=[0,0.5,1.0,1.5,2.0,2.5]'),
    'Studio exposes frozen two-handed rest candidates');
}
assert.ok(studioSource.includes("UAL2_2H_Rest_Candidate_0\\.5s"),'0.5-second rest candidate is the default audition frame');
const studioSource2=fs.readFileSync(new URL('../js/3d-studio.mjs',import.meta.url),'utf8');
assert.ok(studioSource2.includes("Bind / generic rest pose"),'Generic rest is clearly distinguished from 2H rest candidates');
assert.ok(studioSource2.includes("clipIndex < 0 || !state.clips[clipIndex]"),'Saved generic rest migrates to 2H rest candidate');
assert.ok(studioSource2.includes("/^UAL2_2H_Rest_Candidate_/i"),'Ready/reset logic recognizes 2H rest candidates');
console.log('Studio animation slicing, FBX timing, endpoint poses and selection restoration passed.');
