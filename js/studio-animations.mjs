/** Clip preparation shared by import, named ranges and workspace restoration. */

function validClip(clip, allowNonpositiveDuration = false) {
  return clip && Number.isFinite(clip.duration) && (clip.duration > 0 || allowNonpositiveDuration) &&
    Array.isArray(clip.tracks) && clip.tracks.length > 0 && typeof clip.clone === 'function';
}

function copyBuffer(source, values) {
  return Array.isArray(source) ? values.slice() : new source.constructor(values);
}

function sliceTrack(track, start, end) {
  if (track.createInterpolant?.isInterpolantFactoryMethodGLTFCubicSpline) {
    throw new Error('This animation uses glTF cubic-spline tracks. Slicing these tracks is not supported; use the complete animation.');
  }
  if (typeof track.createInterpolant === 'function' && track.createInterpolant === track.InterpolantFactoryMethodSmooth) {
    throw new Error('This animation uses smooth cubic interpolation. Slicing would change its motion; use the complete animation.');
  }
  if (typeof track.createInterpolant !== 'function' || track.getInterpolation?.() === undefined) {
    throw new Error('This animation uses a custom interpolant that cannot safely be sliced. Use the complete animation.');
  }
  const { times, values } = track;
  const stride = track.getValueSize();
  if (!times?.length || !values?.length || !Number.isInteger(stride) || stride < 1) {
    throw new Error('The animation contains an invalid keyframe track.');
  }
  for (let index = 0; index < times.length; index++) {
    if (!Number.isFinite(times[index]) || (index && times[index] < times[index - 1])) {
      throw new Error('Animation keyframe times must be finite and ordered.');
    }
  }
  if (track.ValueTypeName !== 'bool' && track.ValueTypeName !== 'string') {
    for (const value of values) {
      if (!Number.isFinite(value)) throw new Error('Animation keyframe values must be finite.');
    }
  }
  const interpolant = track.createInterpolant();
  const nextTimes = [0], nextValues = [];
  const appendSample = time => {
    const sample = interpolant.evaluate(time);
    if (sample.length < stride) throw new Error('The animation interpolant has an unsupported value layout.');
    for (let index = 0; index < stride; index++) nextValues.push(sample[index]);
  };
  appendSample(start);
  for (let index = 0; index < times.length; index++) {
    if (times[index] <= start || times[index] >= end) continue;
    nextTimes.push(times[index] - start);
    for (let component = 0; component < stride; component++) nextValues.push(values[index * stride + component]);
  }
  nextTimes.push(end - start);
  appendSample(end);
  const sliced = track.clone();
  sliced.times = copyBuffer(times, nextTimes);
  sliced.values = copyBuffer(values, nextValues);
  return sliced;
}

function sliceClip(clip, start, end, name, allowOutsideClip = false) {
  if (!validClip(clip, allowOutsideClip)) throw new Error('Choose a usable animation before creating a range.');
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(end - start) || end <= start ||
      (!allowOutsideClip && (start < 0 || end > clip.duration))) {
    throw new RangeError('Animation range must have finite start and end times, with 0 ≤ start < end ≤ animation duration.');
  }
  if (typeof name !== 'string') throw new TypeError('Animation range name must be text.');
  // Three's trim() drops surrounding keys without evaluating the cut points.
  // Explicit boundary samples retain every animated property's endpoint pose,
  // even when that property has only sparse keys outside the selected range.
  const tracks = clip.tracks.map(track => sliceTrack(track, start, end));
  const result = clip.clone();
  result.name = name;
  result.duration = end - start;
  result.tracks = tracks;
  return result;
}

/** Slice a local timeline; source tracks, clip metadata and arrays are untouched. */
export function sliceAnimationClip(clip, start, end, name = clip?.name) {
  return sliceClip(clip, start, end, name);
}

/** Apply authored FBX take boundaries once, including intentional endpoint holds. */
export function prepareStudioAnimations(clips) {
  if (!Array.isArray(clips)) throw new TypeError('Animations must be an array of clips.');
  return clips.filter(clip => {
    if (validClip(clip)) return true;
    const metadata = clip?.userData?.fbxAnimation;
    return validClip(clip, true) && Number.isFinite(metadata?.start) && Number.isFinite(metadata?.end) &&
      Number.isFinite(metadata.end - metadata.start) && metadata.end > metadata.start;
  }).map(clip => {
    const metadata = clip.userData?.fbxAnimation;
    if (!metadata) return clip.clone();
    const hasStart = metadata.start !== null && metadata.start !== undefined;
    const hasEnd = metadata.end !== null && metadata.end !== undefined;
    if (hasStart !== hasEnd || (hasStart && (!Number.isFinite(metadata.start) ||
        !Number.isFinite(metadata.end) || metadata.end <= metadata.start))) {
      throw new Error('The FBX animation has invalid authored start/end times.');
    }
    if (!hasStart || metadata.timingNormalized === true) return clip.clone();
    // FBX take boundaries can precede the first key or follow the last key.
    // Interpolants hold their endpoint values over those authored spans.
    const result = sliceClip(clip, metadata.start, metadata.end, clip.name, true);
    result.userData.fbxAnimation = { ...metadata, timingNormalized: true };
    return result;
  });
}

export function animationOptionLabel(clip, index) {
  const name = typeof clip?.name === 'string' && clip.name.trim() ? clip.name.trim() : 'Unnamed animation';
  const duration = Number.isFinite(clip?.duration) ? clip.duration : 0;
  return `${index + 1}. ${name} · ${duration.toFixed(2)} s`;
}

export function animationSourceId(clip) {
  const id = clip?.userData?.studioAnimationId;
  if (typeof id === 'string' && id) return id;
  const stackId = clip?.userData?.fbxAnimation?.stackId;
  return stackId === undefined || stackId === null || stackId === '' ? '' : `fbx:${stackId}`;
}

export function restoreAnimationIndex(clips, settings = {}) {
  const { clipIndex, clipName, clipSourceId } = settings || {};
  // Rest pose must not accidentally match an unnamed clip or an old source ID.
  if (clipIndex === -1 || !clips.length) return -1;
  const validIndex = Number.isInteger(clipIndex) && clipIndex >= 0 && clipIndex < clips.length;
  if (typeof clipSourceId === 'string' && clipSourceId) {
    const matching = clips.map((clip, index) => animationSourceId(clip) === clipSourceId ? index : -1)
      .filter(index => index >= 0);
    if (matching.length === 1) return matching[0];
    if (validIndex && matching.includes(clipIndex)) return clipIndex;
  }
  if (validIndex) {
    // Older workspaces have no source ID. Newly recovered authored FBX takes
    // can shift their indices; only a unique name is safe to repair that shift.
    if (!(typeof clipSourceId === 'string' && clipSourceId) && typeof clipName === 'string' && clipName &&
        clips[clipIndex].name !== clipName) {
      const matching = clips.map((clip, index) => clip.name === clipName ? index : -1).filter(index => index >= 0);
      if (matching.length === 1) return matching[0];
    }
    return clipIndex;
  }
  if (typeof clipName === 'string' && clipName) {
    const matching = clips.map((clip, index) => clip.name === clipName ? index : -1).filter(index => index >= 0);
    if (matching.length === 1) return matching[0];
  }
  return 0;
}
