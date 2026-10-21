import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { HEX_FACINGS, CAMERA_ELEVATION, quantizeRgba } from './studio-core.mjs?v=R237C46';
import { createPoseCapture } from './studio-capture.mjs?v=R237C46';

// One model, one animation clock, one WebGL context. All six directions are
// rendered into an atlas before a single readback and palette conversion.
const $ = id => document.getElementById(id);
const ui = Object.fromEntries([
  'Canvas', 'Viewport', 'Files', 'LoadButton', 'DemoButton', 'ModelName',
  'ModelInfo', 'FrameButton', 'FrameAnimationsButton', 'ResetViewButton', 'Heading', 'HeadingValue',
  'UpAxis', 'Resolution', 'Brightness', 'BrightnessValue', 'Contrast', 'ContrastValue',
  'Hue', 'HueValue', 'Saturation', 'SaturationValue', 'ResetColorsButton', 'Outline', 'OutlineValue', 'Clip',
  'PlayButton', 'RestartButton', 'Speed', 'Timeline', 'Time',
  'ExportSheetButton', 'Status', 'Error'
].map(name => [name, $(`studio${name}`)]));

const state = {
  model: null, modelName: 'Studio mannequin', clips: [], mixer: null,
  action: null, playing: true, facing: 'SE', heading: 0, upAxis: 'Y',
  width: 160, height: 200, brightness: 1, contrast: 1, hue: 0, saturation: 1, outline: 1,
  loadingVersion: 0, frame: 0, animationTime: 0, lastPreview: -Infinity,
  mainDirty: true, previewsDirty: true, lastTick: 0, raf: 0, disposed: false,
  viewVisible: true, frameHeight: 3.15, framingMode: 'pose', framingSamplesPerClip: 0,
  center: new THREE.Vector3(0, 1, 0)
};

let renderer, scene, mainCamera, pixelCamera, orbit, turntable, calibration;
let placement, upAxisGroup, helpers, atlasTarget, atlasSource, atlasImage;
let resizeObserver, visibilityObserver, poseCapture;
const atlasCanvas = document.createElement('canvas');
const atlasContext = atlasCanvas.getContext('2d', { alpha: false });
const previews = HEX_FACINGS.map(facing => ({
  ...facing,
  canvas: $(`studioPreview${facing.id}`),
  context: $(`studioPreview${facing.id}`).getContext('2d', { alpha: false })
}));

function status(message) { ui.Status.textContent = message; }
function clearError() { ui.Error.hidden = true; ui.Error.textContent = ''; }
function showError(error) {
  const text = error instanceof Error ? error.message : String(error);
  ui.Error.textContent = text;
  ui.Error.hidden = false;
}
function invalidate(previewsToo = true) {
  state.mainDirty = true;
  if (previewsToo) state.previewsDirty = true;
  requestFrame();
}
function requestFrame() {
  if (!state.raf && !state.disposed && !document.hidden && state.viewVisible) {
    state.raf = requestAnimationFrame(tick);
  }
}

function makeMaterial(color, roughness = 0.85, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function makeDemo() {
  const model = new THREE.Group();
  model.name = 'StudioMannequin';
  const skin = makeMaterial(0xca7540);
  const cloth = makeMaterial(0x9f283c);
  const leather = makeMaterial(0x563c2d);
  const steel = makeMaterial(0x9ba6b3, 0.55, 0.55);
  const wood = makeMaterial(0x8a562d);
  const brass = makeMaterial(0xc29b4f, 0.6, 0.5);
  const dark = makeMaterial(0x24242b);

  function mesh(parent, geometry, material, x, y, z, name) {
    const result = new THREE.Mesh(geometry, material);
    result.position.set(x, y, z);
    if (name) result.name = name;
    parent.add(result);
    return result;
  }
  const cylinder = (radius, length) => new THREE.CylinderGeometry(radius, radius, length, 8);
  [-1, 1].forEach(side => {
    mesh(model, cylinder(0.115, 0.55), skin, side * 0.17, 0.4, 0);
    mesh(model, new THREE.BoxGeometry(0.24, 0.18, 0.42), cloth,
      side * 0.17, 0.095, 0.09);
  });
  const torso = new THREE.Group();
  torso.name = 'DemoTorso';
  torso.position.y = 1.03;
  model.add(torso);
  mesh(torso, new THREE.CylinderGeometry(0.26, 0.23, 0.62, 8), cloth, 0, 0, 0);
  mesh(torso, new THREE.CylinderGeometry(0.267, 0.267, 0.09, 8), leather, 0, -0.17, 0);
  mesh(torso, new THREE.BoxGeometry(0.11, 0.1, 0.04), brass, 0, -0.17, 0.25);
  const head = new THREE.Group();
  head.position.y = 0.55;
  torso.add(head);
  mesh(head, new THREE.SphereGeometry(0.245, 10, 8), cloth, 0, 0.025, -0.025);
  mesh(head, new THREE.SphereGeometry(0.205, 10, 8), skin, 0, 0, 0.055);
  mesh(head, new THREE.BoxGeometry(0.22, 0.125, 0.25), skin, 0, -0.055, 0.23);
  mesh(head, new THREE.SphereGeometry(0.062, 8, 6), dark, 0, -0.028, 0.365);
  [-1, 1].forEach(side => {
    mesh(head, new THREE.SphereGeometry(0.032, 6, 4), brass, side * 0.105, 0.06, 0.226);
    const horn = mesh(head, new THREE.ConeGeometry(0.064, 0.19, 7), brass,
      side * 0.14, 0.24, 0);
    horn.rotation.z = -side * 0.17;
  });
  const rightArm = new THREE.Group();
  rightArm.name = 'DemoRightArm';
  rightArm.position.set(-0.32, 0.19, 0);
  rightArm.rotation.z = -0.12;
  torso.add(rightArm);
  mesh(rightArm, cylinder(0.105, 0.5), skin, 0, -0.22, 0);
  mesh(rightArm, new THREE.SphereGeometry(0.11, 8, 6), skin, 0, -0.49, 0.025);
  const sword = new THREE.Group();
  sword.position.set(0, -0.49, 0.035);
  sword.rotation.x = -0.8;
  rightArm.add(sword);
  mesh(sword, new THREE.BoxGeometry(0.075, 0.15, 0.06), leather, 0, 0, 0);
  mesh(sword, new THREE.BoxGeometry(0.25, 0.04, 0.07), brass, 0, -0.075, 0);
  mesh(sword, new THREE.BoxGeometry(0.105, 0.54, 0.04), steel, 0, -0.36, 0);
  const tip = mesh(sword, new THREE.ConeGeometry(0.068, 0.15, 4), steel, 0, -0.7, 0);
  tip.rotation.z = Math.PI;
  const leftArm = new THREE.Group();
  leftArm.name = 'DemoLeftArm';
  leftArm.position.set(0.32, 0.19, 0);
  leftArm.rotation.z = 0.12;
  torso.add(leftArm);
  mesh(leftArm, cylinder(0.105, 0.47), skin, 0, -0.2, 0);
  const shield = new THREE.Group();
  shield.position.set(0.09, -0.31, 0.13);
  shield.rotation.z = -Math.PI / 2;
  leftArm.add(shield);
  mesh(shield, new THREE.CylinderGeometry(0.34, 0.34, 0.065, 16), brass, 0, 0, 0);
  mesh(shield, new THREE.CylinderGeometry(0.31, 0.31, 0.075, 16), wood, 0, 0, 0);
  const boss = mesh(shield, new THREE.SphereGeometry(0.095, 8, 6), brass, 0, 0.06, 0);
  boss.scale.y = 0.65;
  // A contrasting rear cape makes front/back and left/right visibly distinct.
  mesh(torso, new THREE.BoxGeometry(0.38, 0.57, 0.045), dark, 0, -0.035, -0.245);

  const times = [0, 0.8, 1.6, 2.4];
  const idle = new THREE.AnimationClip('Idle', 2.4, [
    new THREE.NumberKeyframeTrack('DemoTorso.position[y]', times, [1.03, 1.055, 1.04, 1.03]),
    new THREE.NumberKeyframeTrack('DemoRightArm.rotation[x]', times, [0, -0.07, 0.025, 0]),
    new THREE.NumberKeyframeTrack('DemoLeftArm.rotation[x]', times, [0, 0.035, -0.025, 0])
  ]);
  const attack = new THREE.AnimationClip('Attack', 1.2, [
    new THREE.NumberKeyframeTrack('DemoRightArm.rotation[x]', [0, 0.35, 0.6, 1.2], [0, -1.6, 0.65, 0]),
    new THREE.NumberKeyframeTrack('DemoTorso.rotation[y]', [0, 0.35, 0.6, 1.2], [0, -0.22, 0.25, 0])
  ]);
  const fall = new THREE.AnimationClip('Fall', 1.6, [
    new THREE.NumberKeyframeTrack('StudioMannequin.rotation[x]', [0, 0.5, 1.2, 1.6], [0, 0.2, Math.PI / 2, Math.PI / 2]),
    new THREE.NumberKeyframeTrack('StudioMannequin.position[y]', [0, 0.5, 1.2, 1.6], [0, 0.05, 0.3, 0.3])
  ]);
  return { model, clips: [idle, attack, fall], name: 'Studio mannequin' };
}

function disposeModel(model) {
  if (!model) return;
  const geometries = new Set(), materials = new Set(), textures = new Set();
  model.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    const list = Array.isArray(object.material) ? object.material : [object.material];
    list.filter(Boolean).forEach(material => {
      materials.add(material);
      Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); });
    });
    if (object.skeleton?.boneTexture) textures.add(object.skeleton.boneTexture);
  });
  textures.forEach(texture => {
    texture.dispose();
    if (typeof texture.image?.close === 'function') texture.image.close();
  });
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}

function updateModelInfo() {
  let meshes = 0, bones = 0;
  state.model.traverse(object => { if (object.isMesh) meshes++; if (object.isBone) bones++; });
  ui.ModelName.textContent = state.modelName;
  ui.ModelInfo.textContent = `${meshes} mesh${meshes === 1 ? '' : 'es'} · ${bones} bones · ${state.clips.length} animation${state.clips.length === 1 ? '' : 's'}`;
}

function geometryBounds(root) {
  root.updateMatrixWorld(true);
  root.traverse(object => {
    if (object.isSkinnedMesh) object.computeBoundingBox();
  });
  const bounds = new THREE.Box3().setFromObject(root, true);
  if (bounds.isEmpty() || ![...bounds.min, ...bounds.max].every(Number.isFinite)) {
    throw new Error('The model has invalid or empty geometry in an animation pose. Export the model again and retry.');
  }
  return bounds;
}

// Measure off-scene, then apply the complete result. Failed fitting never leaves
// the previous camera, model parent, or animation partially changed.
function measureModelFrame(model, clips, { upAxis = 'Y', mixer = null, action = null } = {}) {
  const parent = model.parent;
  const siblingIndex = parent?.children.indexOf(model) ?? -1;
  const normalized = new THREE.Group();
  const axis = new THREE.Group();
  axis.rotation.x = upAxis === 'Z' ? -Math.PI / 2 : 0;
  normalized.add(axis);
  const previousAction = action ? {
    action, time: action.time, paused: action.paused, timeScale: action.timeScale,
    enabled: action.enabled, weight: action.weight, loop: action.loop,
    repetitions: action.repetitions, clampWhenFinished: action.clampWhenFinished
  } : null;
  let sampler = null;
  try {
    axis.add(model);
    const initial = geometryBounds(normalized);
    const size = initial.getSize(new THREE.Vector3());
    const center = initial.getCenter(new THREE.Vector3());
    const scale = 2 / Math.max(size.y, Math.max(size.x, size.z) * 0.25, 0.001);
    normalized.scale.setScalar(scale);
    normalized.position.set(-center.x * scale, -initial.min.y * scale, -center.z * scale);
    const envelope = geometryBounds(normalized);

    if (clips.length) {
      // Stop the active action before the temporary mixer binds. Each clip then
      // starts from the original rest values rather than blending with another.
      mixer?.stopAllAction();
      sampler = new THREE.AnimationMixer(model);
      envelope.union(geometryBounds(normalized));
      for (const clip of clips) {
        const sampled = sampler.clipAction(clip).reset().setLoop(THREE.LoopOnce, 1).play();
        sampled.paused = true;
        sampled.clampWhenFinished = true;
        // Endpoints and midpoint included; extra space covers between-sample motion.
        const intervals = 48;
        for (let step = 0; step <= intervals; step++) {
          sampled.time = clip.duration * step / intervals;
          sampler.update(0);
          envelope.union(geometryBounds(normalized));
        }
        sampler.stopAllAction();
      }
    }

    // Keep the normalized ground origin fixed, even when root motion or a prone
    // pose moves the bounds away from it. Do not recenter each individual pose.
    const low = Math.min(0, envelope.min.y), high = Math.max(0, envelope.max.y);
    const radius = Math.max(
      Math.hypot(envelope.min.x, envelope.min.z), Math.hypot(envelope.min.x, envelope.max.z),
      Math.hypot(envelope.max.x, envelope.min.z), Math.hypot(envelope.max.x, envelope.max.z)
    );
    const projectedHeight = (high - low) * Math.cos(CAMERA_ELEVATION) + 2 * radius * Math.sin(CAMERA_ELEVATION);
    return {
      scale, position: normalized.position.clone(), center: new THREE.Vector3(0, (high + low) / 2, 0),
      frameHeight: Math.max(projectedHeight, 2 * radius / (state.width / state.height), 1) * 1.24,
      mode: clips.length ? 'animations' : 'pose', samplesPerClip: clips.length ? 49 : 0
    };
  } finally {
    if (sampler) {
      sampler.stopAllAction();
      sampler.uncacheRoot(model);
    }
    axis.remove(model);
    if (parent) {
      parent.add(model);
      if (siblingIndex >= 0 && siblingIndex < parent.children.length - 1) {
        parent.children.splice(parent.children.indexOf(model), 1);
        parent.children.splice(siblingIndex, 0, model);
      }
    }
    if (sampler && previousAction) {
      const saved = previousAction;
      saved.action.reset().setLoop(saved.loop, saved.repetitions).play();
      saved.action.time = saved.time;
      saved.action.timeScale = saved.timeScale;
      saved.action.paused = saved.paused;
      saved.action.enabled = saved.enabled;
      saved.action.weight = saved.weight;
      saved.action.clampWhenFinished = saved.clampWhenFinished;
      mixer.update(0);
    }
    model.updateWorldMatrix(true, true);
  }
}

function applyModelFrame(frame) {
  placement.position.copy(frame.position);
  placement.scale.setScalar(frame.scale);
  upAxisGroup.rotation.x = state.upAxis === 'Z' ? -Math.PI / 2 : 0;
  state.center.copy(frame.center);
  state.frameHeight = frame.frameHeight;
  state.framingMode = frame.mode;
  state.framingSamplesPerClip = frame.samplesPerClip;
  calibration.rotation.y = THREE.MathUtils.degToRad(state.heading);
  turntable.rotation.y = HEX_FACINGS.find(item => item.id === state.facing).yawRadians;
  state.lastTick = 0;
  resetCamera();
  invalidate();
}

function fitModel() {
  if (!state.model || poseCapture?.snapshot().captureCount) return;
  applyModelFrame(measureModelFrame(state.model, [], { upAxis: state.upAxis }));
}

function fitAllAnimations() {
  if (!state.model || poseCapture?.snapshot().captureCount) return;
  try {
    applyModelFrame(measureModelFrame(state.model, state.clips, {
      upAxis: state.upAxis, mixer: state.mixer, action: state.action
    }));
    updateAnimationControls();
    clearError();
    status(state.clips.length ? 'All animations framed · One scale and ground anchor for every pose' : 'Static model framed');
  } catch (error) { showError(error); }
}

function setCameraFrustum(camera, aspect) {
  const halfHeight = state.frameHeight / 2;
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}

function fixedCamera(camera) {
  const distance = Math.max(8, state.frameHeight * 2);
  camera.position.copy(state.center).add(new THREE.Vector3(0, Math.sin(CAMERA_ELEVATION), Math.cos(CAMERA_ELEVATION)).multiplyScalar(distance));
  camera.far = Math.max(100, distance * 3);
  camera.updateProjectionMatrix();
  camera.up.set(0, 1, 0);
  camera.lookAt(state.center);
}

function resetCamera() {
  const rect = ui.Viewport.getBoundingClientRect();
  setCameraFrustum(mainCamera, Math.max(rect.width, 1) / Math.max(rect.height, 1));
  setCameraFrustum(pixelCamera, state.width / state.height);
  fixedCamera(mainCamera);
  fixedCamera(pixelCamera);
  mainCamera.zoom = 1;
  mainCamera.updateProjectionMatrix();
  orbit.target.copy(state.center);
  orbit.update();
  invalidate(false);
}

function selectFacing(id) {
  if (!HEX_FACINGS.some(item => item.id === id)) return;
  state.facing = id;
  document.querySelectorAll('[data-studio-facing]').forEach(button => {
    const active = button.dataset.studioFacing === id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-studio-card]').forEach(card => {
    card.classList.toggle('active', card.dataset.studioCard === id);
  });
  resetCamera();
}

function setClip(index) {
  state.mixer.stopAllAction();
  state.action = null;
  if (state.clips[index]) {
    state.action = state.mixer.clipAction(state.clips[index]);
    state.action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    state.action.timeScale = Number(ui.Speed.value) || 1;
    state.action.paused = !state.playing;
  }
  state.mixer.update(0);
  updateAnimationControls();
  invalidate();
}

function updateAnimationControls() {
  const available = !!state.action;
  ui.PlayButton.disabled = !available;
  ui.RestartButton.disabled = !available;
  ui.Timeline.disabled = !available;
  ui.Speed.disabled = !available;
  ui.PlayButton.textContent = available && state.playing ? 'Pause' : 'Play';
  ui.PlayButton.setAttribute('aria-pressed', String(available && state.playing));
  const duration = state.action?.getClip().duration || 0;
  const time = state.action?.time || 0;
  ui.Timeline.value = duration ? String(time / duration) : '0';
  ui.Time.textContent = `${time.toFixed(2)} / ${duration.toFixed(2)} s`;
}

function installModel({ model, clips, name }) {
  // Validate before releasing the previously usable model.
  let visibleMeshes = 0;
  model.traverse(object => { if (object.isMesh && object.geometry?.attributes?.position?.count) visibleMeshes++; });
  if (!visibleMeshes) {
    disposeModel(model);
    throw new Error('This file has no mesh. Choose a model with its animations included.');
  }
  const availableClips = clips.filter(clip => Number.isFinite(clip.duration) && clip.duration > 0);
  let framing;
  try { framing = measureModelFrame(model, availableClips); }
  catch (error) { disposeModel(model); throw error; }
  if (state.mixer) {
    state.mixer.stopAllAction();
    state.mixer.uncacheRoot(state.model);
  }
  if (state.model) upAxisGroup.remove(state.model);
  disposeModel(state.model);
  state.model = model;
  state.modelName = name;
  poseCapture?.reset(name);
  state.clips = availableClips;
  state.mixer = new THREE.AnimationMixer(model);
  state.heading = 0;
  state.upAxis = 'Y';
  ui.Heading.value = '0';
  ui.HeadingValue.textContent = '0°';
  ui.UpAxis.value = 'Y';
  model.traverse(object => {
    if (object.isSkinnedMesh) object.frustumCulled = false;
  });
  upAxisGroup.add(model);
  ui.Clip.replaceChildren(new Option('Rest pose', '-1'));
  state.clips.forEach((clip, index) => ui.Clip.add(new Option(clip.name || `Animation ${index + 1}`, String(index))));
  ui.Clip.value = state.clips.length ? '0' : '-1';
  ui.Clip.disabled = !state.clips.length;
  setClip(state.clips.length ? 0 : -1);
  updateModelInfo();
  applyModelFrame(framing);
  clearError();
  status(state.clips.length ? 'Ready · All animations framed for six synchronized views' : 'Ready · Static model loaded');
}

function configureAtlas() {
  atlasTarget?.dispose();
  const width = state.width * 3, height = state.height * 2;
  atlasTarget = new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    depthBuffer: true, stencilBuffer: false, samples: 0
  });
  // The quantizer receives display-ready sRGB, just like the central viewport.
  atlasTarget.texture.colorSpace = THREE.SRGBColorSpace;
  atlasSource = new Uint8Array(width * height * 4);
  atlasCanvas.width = width;
  atlasCanvas.height = height;
  atlasImage = atlasContext.createImageData(width, height);
  previews.forEach(preview => {
    preview.canvas.width = state.width;
    preview.canvas.height = state.height;
    preview.context.imageSmoothingEnabled = false;
  });
  if (pixelCamera) setCameraFrustum(pixelCamera, state.width / state.height);
  state.lastPreview = -Infinity;
  invalidate();
}

function pixelRenderOptions(transparent = false) {
  return {
    brightness: state.brightness, contrast: state.contrast,
    hue: state.hue, saturation: state.saturation,
    outline: state.outline, transparent, tileWidth: state.width, tileHeight: state.height
  };
}

function readCapturePose() {
  if (!state.model || state.disposed) throw new Error('Load a model before capturing a pose.');
  state.playing = false;
  state.lastTick = 0;
  if (state.action) state.action.paused = true;
  updateAnimationControls();
  // Do not advance the mixer between directions or wait for another browser frame.
  renderPreviews(performance.now());
  pixelCamera.updateMatrixWorld(true);
  const ground = new THREE.Vector3(0, 0, 0).project(pixelCamera);
  const result = {
    raw: atlasSource.slice(), width: state.width, height: state.height,
    clip: state.action?.getClip().name || 'Rest pose', time: state.action?.time || 0,
    anchorX: (ground.x + 1) * state.width / 2,
    anchorY: (1 - ground.y) * state.height / 2,
    render: {
      model: state.modelName, heading: state.heading, upAxis: state.upAxis,
      cameraElevation: THREE.MathUtils.radToDeg(CAMERA_ELEVATION),
      frameHeight: state.frameHeight, center: state.center.toArray(), framingMode: state.framingMode
    }
  };
  invalidate(false);
  return result;
}

function renderPreviews(timestamp) {
  const background = scene.background;
  scene.background = null;
  helpers.visible = false;
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(atlasTarget);
  renderer.setScissorTest(false);
  renderer.clear(true, true, true);
  renderer.setScissorTest(true);
  for (let index = 0; index < HEX_FACINGS.length; index++) {
    const x = (index % 3) * state.width;
    const y = (1 - Math.floor(index / 3)) * state.height;
    turntable.rotation.y = HEX_FACINGS[index].yawRadians;
    renderer.setViewport(x, y, state.width, state.height);
    renderer.setScissor(x, y, state.width, state.height);
    renderer.render(scene, pixelCamera);
  }
  renderer.setScissorTest(false);
  renderer.readRenderTargetPixels(atlasTarget, 0, 0, atlasTarget.width, atlasTarget.height, atlasSource);
  renderer.setRenderTarget(null);
  scene.background = background;
  helpers.visible = true;
  renderer.setClearColor(0x808080, 1);
  turntable.rotation.y = HEX_FACINGS.find(item => item.id === state.facing).yawRadians;
  quantizeRgba(atlasSource, atlasTarget.width, atlasTarget.height, atlasImage.data, pixelRenderOptions());
  atlasContext.putImageData(atlasImage, 0, 0);
  previews.forEach((preview, index) => {
    preview.context.drawImage(atlasCanvas,
      (index % 3) * state.width, Math.floor(index / 3) * state.height,
      state.width, state.height, 0, 0, state.width, state.height);
    preview.canvas.dataset.frame = String(state.frame + 1);
  });
  state.frame++;
  state.animationTime = state.action?.time || 0;
  state.lastPreview = timestamp;
  state.previewsDirty = false;
}

function resizeRenderer() {
  const rect = ui.Viewport.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (renderer.domElement.width !== width || renderer.domElement.height !== height) {
    // Explicit backing resolution keeps render-target viewports independent of DPR.
    renderer.setSize(width, height, false);
    setCameraFrustum(mainCamera, width / height);
    state.mainDirty = true;
  }
}

function tick(timestamp) {
  state.raf = 0;
  if (state.disposed || document.hidden || !state.viewVisible) { state.lastTick = 0; return; }
  const delta = state.lastTick ? Math.min((timestamp - state.lastTick) / 1000, 0.1) : 0;
  state.lastTick = timestamp;
  if (state.playing && state.action) {
    state.mixer.update(delta); // Exactly once; all views use this one evaluated pose.
    state.mainDirty = true;
    state.previewsDirty = true;
    updateAnimationControls();
  }
  const moving = orbit.update();
  resizeRenderer();
  if (state.previewsDirty && timestamp - state.lastPreview >= 1000 / 30) {
    renderPreviews(timestamp);
    state.mainDirty = true;
  }
  if (state.mainDirty || moving) {
    turntable.rotation.y = HEX_FACINGS.find(item => item.id === state.facing).yawRadians;
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, renderer.domElement.width, renderer.domElement.height);
    renderer.clear(true, true, true);
    renderer.render(scene, mainCamera);
    state.mainDirty = false;
  }
  if ((state.playing && state.action) || moving || state.previewsDirty) requestFrame();
  else state.lastTick = 0;
}

function normalizePath(value) {
  let path = value;
  try { path = decodeURIComponent(path); } catch { /* Keep literal malformed percent names. */ }
  return path.replace(/\\/g, '/').replace(/[?#].*$/, '').replace(/^\.\//, '');
}

function createLocalManager(files) {
  const urls = new Map();
  const created = [];
  const manager = new THREE.LoadingManager();
  const failures = [];
  let started = false;
  let finish;
  const complete = new Promise(resolve => { finish = resolve; });
  manager.onStart = () => { started = true; };
  manager.onLoad = () => finish();
  manager.onError = url => failures.push(url);
  manager.setURLModifier(url => {
    if (/^(data:|blob:)/i.test(url)) return url;
    const normalized = normalizePath(url);
    const exact = files.filter(file => {
      const path = normalizePath(file.webkitRelativePath || file.name);
      return normalized === path || normalized.endsWith(`/${path}`);
    });
    let matches = exact;
    if (!matches.length) {
      const basename = normalized.split('/').pop();
      matches = files.filter(file => file.name === basename);
    }
    if (matches.length !== 1) {
      failures.push(normalized);
      throw new Error(`Select the model together with its buffer and texture files. Missing or ambiguous file: ${normalized.split('/').pop()}`);
    }
    const file = matches[0];
    if (!urls.has(file)) {
      const objectUrl = URL.createObjectURL(file);
      urls.set(file, objectUrl);
      created.push(objectUrl);
    }
    return urls.get(file);
  });
  return {
    manager,
    async wait() {
      if (started) await complete;
      if (failures.length) throw new Error('A model texture or buffer could not be read. Select all associated files and try again.');
    },
    revoke() { created.forEach(url => URL.revokeObjectURL(url)); }
  };
}

function friendlyImportError(error) {
  const message = error?.message || String(error);
  if (/draco|meshopt|ktx2|basisu/i.test(message)) {
    return new Error('This model uses compressed geometry or textures. Export an uncompressed GLB/glTF with PNG or JPEG textures and load it again.');
  }
  return new Error(message);
}

async function loadFiles(fileList) {
  const files = [...fileList];
  const candidates = files.filter(file => /\.(glb|gltf|fbx)$/i.test(file.name));
  if (candidates.length !== 1) {
    showError(new Error('Choose one GLB, glTF, or FBX model, together with any texture and buffer files it needs.'));
    return;
  }
  const version = ++state.loadingVersion;
  const file = candidates[0];
  const local = createLocalManager(files);
  let loaded;
  clearError();
  status(`Loading ${file.name}…`);
  try {
    const buffer = await file.arrayBuffer();
    if (/\.fbx$/i.test(file.name)) {
      const model = new FBXLoader(local.manager).parse(buffer, '');
      loaded = { model, clips: model.animations || [], name: file.name };
    } else {
      const gltf = await new GLTFLoader(local.manager).parseAsync(buffer, '');
      loaded = { model: gltf.scene, clips: gltf.animations || [], name: file.name };
    }
    await local.wait();
    if (version !== state.loadingVersion || state.disposed) {
      disposeModel(loaded.model);
      return;
    }
    installModel(loaded);
  } catch (error) {
    if (loaded?.model !== state.model) disposeModel(loaded?.model);
    if (version === state.loadingVersion && !state.disposed) {
      showError(friendlyImportError(error));
      status('Model could not be loaded · Previous model retained');
    }
  } finally {
    local.revoke();
    ui.Files.value = '';
  }
}

function exportImage(facing = null) {
  if (!state.model) return;
  // Capture the current evaluated pose without advancing the animation clock.
  renderPreviews(performance.now());
  const image = new ImageData(atlasTarget.width, atlasTarget.height);
  quantizeRgba(atlasSource, atlasTarget.width, atlasTarget.height, image.data, pixelRenderOptions(true));
  const source = document.createElement('canvas');
  source.width = image.width;
  source.height = image.height;
  source.getContext('2d').putImageData(image, 0, 0);
  const output = document.createElement('canvas');
  output.width = facing ? state.width : source.width;
  output.height = facing ? state.height : source.height;
  const context = output.getContext('2d');
  context.imageSmoothingEnabled = false;
  if (facing) {
    const index = HEX_FACINGS.findIndex(item => item.id === facing);
    context.drawImage(source, (index % 3) * state.width, Math.floor(index / 3) * state.height,
      state.width, state.height, 0, 0, state.width, state.height);
  } else context.drawImage(source, 0, 0);
  const name = state.modelName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  output.toBlob(blob => {
    if (!blob) { showError(new Error('The PNG could not be created. Please try again.')); return; }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}-${facing || 'six-facings'}-${state.width}x${state.height}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
  invalidate(false);
}

function bindControls() {
  ui.LoadButton.addEventListener('click', () => ui.Files.click());
  ui.Files.addEventListener('change', () => { if (ui.Files.files.length) loadFiles(ui.Files.files); });
  ui.DemoButton.addEventListener('click', () => {
    ++state.loadingVersion;
    installModel(makeDemo());
  });
  ui.FrameButton.addEventListener('click', fitModel);
  ui.FrameAnimationsButton.addEventListener('click', fitAllAnimations);
  ui.ResetViewButton.addEventListener('click', resetCamera);
  document.querySelectorAll('[data-studio-facing]').forEach(button => {
    button.addEventListener('click', () => selectFacing(button.dataset.studioFacing));
  });
  document.querySelectorAll('[data-studio-export]').forEach(button => {
    button.addEventListener('click', () => exportImage(button.dataset.studioExport));
  });
  ui.ExportSheetButton.addEventListener('click', () => exportImage());
  ui.Heading.addEventListener('input', () => {
    state.heading = Number(ui.Heading.value);
    ui.HeadingValue.textContent = `${state.heading}°`;
    calibration.rotation.y = THREE.MathUtils.degToRad(state.heading);
    invalidate();
  });
  ui.UpAxis.addEventListener('change', () => {
    state.upAxis = ui.UpAxis.value;
    fitAllAnimations();
  });
  ui.Resolution.addEventListener('change', () => {
    const [width, height] = ui.Resolution.value.split('x').map(Number);
    if (![[80, 100], [160, 200], [320, 400]].some(pair => pair[0] === width && pair[1] === height)) return;
    state.width = width;
    state.height = height;
    configureAtlas();
  });
  const colorControls = [
    ['Brightness', 'brightness', 100, '%'],
    ['Contrast', 'contrast', 100, '%'],
    ['Hue', 'hue', 1, '°'],
    ['Saturation', 'saturation', 100, '%']
  ].map(([name, key, divisor, suffix]) => {
    const input = ui[name];
    const update = () => {
      const value = Number(input.value);
      state[key] = value / divisor;
      ui[`${name}Value`].textContent = `${value}${suffix}`;
      input.setAttribute('aria-valuetext', `${value} ${suffix === '°' ? 'degrees' : 'percent'}`);
    };
    input.addEventListener('input', () => { update(); poseCapture?.updateStyle(pixelRenderOptions(true)); invalidate(); });
    update();
    return { input, update };
  });
  ui.ResetColorsButton.addEventListener('click', () => {
    colorControls.forEach(({ input, update }) => { input.value = input.defaultValue; update(); });
    poseCapture?.updateStyle(pixelRenderOptions(true));
    invalidate();
  });
  const updateOutline = () => {
    state.outline = Number(ui.Outline.value);
    ui.OutlineValue.textContent = state.outline ? `${state.outline} px` : '0 px (off)';
    ui.Outline.setAttribute('aria-valuetext', state.outline ? `${state.outline} ${state.outline === 1 ? 'pixel' : 'pixels'}` : 'Off');
  };
  ui.Outline.addEventListener('input', () => { updateOutline(); poseCapture?.updateStyle(pixelRenderOptions(true)); invalidate(); });
  updateOutline();
  ui.Clip.addEventListener('change', () => setClip(Number(ui.Clip.value)));
  ui.PlayButton.addEventListener('click', () => {
    state.playing = !state.playing;
    if (state.action) state.action.paused = !state.playing;
    updateAnimationControls();
    state.lastTick = 0;
    invalidate();
  });
  ui.RestartButton.addEventListener('click', () => {
    if (!state.action) return;
    state.action.time = 0;
    state.mixer.update(0);
    updateAnimationControls();
    invalidate();
  });
  ui.Speed.addEventListener('change', () => {
    if (state.action) state.action.timeScale = Number(ui.Speed.value);
    invalidate();
  });
  ui.Timeline.addEventListener('input', () => {
    if (!state.action) return;
    state.playing = false;
    state.action.paused = true;
    state.action.time = Number(ui.Timeline.value) * state.action.getClip().duration;
    state.mixer.update(0);
    updateAnimationControls();
    invalidate();
  });
  ui.Viewport.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
  ui.Viewport.addEventListener('drop', event => {
    event.preventDefault();
    if (event.dataTransfer.files.length) loadFiles(event.dataTransfer.files);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(state.raf);
      state.raf = 0;
      state.lastTick = 0;
    } else invalidate();
  });
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    state.disposed = true;
    state.loadingVersion++;
    cancelAnimationFrame(state.raf);
    resizeObserver.disconnect();
    visibilityObserver?.disconnect();
    orbit.dispose();
    state.mixer?.stopAllAction();
    disposeModel(state.model);
    disposeModel(helpers);
    atlasTarget.dispose();
    renderer.dispose();
  });
}

function start() {
  renderer = new THREE.WebGLRenderer({ canvas: ui.Canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.autoClear = false;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x808080);
  scene.add(new THREE.HemisphereLight(0xe5efff, 0x5b4634, 1.8));
  const light = new THREE.DirectionalLight(0xffffff, 2.3);
  light.position.set(-3, 5, 6);
  scene.add(light);
  turntable = new THREE.Group();
  calibration = new THREE.Group();
  placement = new THREE.Group();
  upAxisGroup = new THREE.Group();
  turntable.add(calibration);
  calibration.add(placement);
  placement.add(upAxisGroup);
  scene.add(turntable);
  helpers = new THREE.Group();
  const grid = new THREE.GridHelper(5, 10, 0x555a61, 0x72767d);
  grid.position.y = -0.002;
  helpers.add(grid);
  const points = Array.from({ length: 7 }, (_, index) => {
    const angle = (index % 6) * Math.PI / 3;
    return new THREE.Vector3(Math.sin(angle) * 1.1, 0, Math.cos(angle) * 1.1);
  });
  helpers.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xb6d5e0 })));
  scene.add(helpers);
  mainCamera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.01, 100);
  pixelCamera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.01, 100);
  orbit = new OrbitControls(mainCamera, ui.Canvas);
  orbit.enableDamping = true;
  orbit.enablePan = true;
  orbit.minZoom = 0.3;
  orbit.maxZoom = 4;
  orbit.maxPolarAngle = Math.PI * 0.92;
  orbit.addEventListener('change', () => invalidate(false));
  configureAtlas();
  bindControls();
  resizeObserver = new ResizeObserver(() => invalidate(false));
  resizeObserver.observe(ui.Viewport);
  if ('IntersectionObserver' in window) {
    visibilityObserver = new IntersectionObserver(entries => {
      state.viewVisible = entries.some(entry => entry.isIntersecting);
      if (state.viewVisible) { state.lastTick = 0; invalidate(); }
      else { cancelAnimationFrame(state.raf); state.raf = 0; state.lastTick = 0; }
    });
    visibilityObserver.observe(ui.Viewport.closest('main') || ui.Viewport);
  }
  ui.Canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    state.viewVisible = false;
    cancelAnimationFrame(state.raf);
    state.raf = 0;
    showError(new Error('The 3D graphics context was interrupted. Reload the studio to restore the viewer.'));
    status('Graphics paused');
  });
  poseCapture = createPoseCapture({
    readPose: readCapturePose,
    getStyle: () => pixelRenderOptions(true),
    onLockChange: locked => {
      for (const control of [ui.FrameButton, ui.FrameAnimationsButton, ui.Heading, ui.UpAxis, ui.Resolution]) control.disabled = locked;
    },
    onError: showError,
    onStatus: status
  });
  installModel(makeDemo());
  selectFacing(state.facing);
  // Read-only diagnostics support candidate QA without exposing mutable scene internals.
  window.adventureParty3DStudio = Object.freeze({
    snapshot: () => ({
      model: state.modelName, facing: state.facing,
      directions: HEX_FACINGS.map(item => item.id),
      previewSize: [state.width, state.height], frame: state.frame,
      animationTime: state.animationTime, playing: state.playing,
      clips: state.clips.map(clip => clip.name),
      cameraElevation: THREE.MathUtils.radToDeg(CAMERA_ELEVATION),
      framingMode: state.framingMode, framingSamplesPerClip: state.framingSamplesPerClip,
      frameHeight: state.frameHeight, frameCenter: state.center.toArray(),
      ...poseCapture.snapshot()
    })
  });
}

try { start(); }
catch (error) {
  cancelAnimationFrame(state.raf);
  state.disposed = true;
  showError(new Error(`The 3D viewer could not start. ${error.message || error}`));
  status('3D viewer unavailable');
}
