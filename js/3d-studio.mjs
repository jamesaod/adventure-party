import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import {
  prepareStudioAnimations, sliceAnimationClip, animationOptionLabel, animationSourceId, restoreAnimationIndex
} from './studio-animations.mjs?v=R238C57';
import { HEX_FACINGS, CAMERA_ELEVATION, quantizeRgba } from './studio-core.mjs?v=R238C57';
import { createPoseCapture } from './studio-capture.mjs?v=R238C57';
import {
  SPRITE_LAYOUT_PRESETS, SPRITE_MOBS, SPRITE_RESOLUTION, SPRITE_MODEL_SCALE, SPRITE_HEX_SCALE_PERCENT, spriteLayout,
  spriteMob, spriteLayoutDimensions, createSpriteLayoutMetadata, validateSpriteModelScale, validateSpriteHexScale
} from './sprite-layouts.mjs?v=R238C57';
import {
  STUDIO_FEET_PER_HEX, STUDIO_HEIGHT_RULER_FEET, studioWorldUnitsPerFoot,
  studioModelHeightFeet, studioFootprintGuide, studioLightPosition
} from './studio-geometry.mjs?v=R238C57';
import {
  STUDIO_WEAPONS, normalizeEquipment, createStudioEquipment
} from './studio-equipment.mjs?v=R238C67';
import {
  STUDIO_SHIELDS, normalizeShield, createStudioShield
} from './studio-shield.mjs?v=R238C72';

const DEFAULT_LIGHTING = Object.freeze({
  ambientIntensity: 1, ambientColor: '#ffffff', keyIntensity: 2.3,
  keyColor: '#ffffff', keyElevation: 45, keyDirection: 'NW'
});

// The shared asset format still accepts older sizes up to 2000%.
const STUDIO_MODEL_SCALE_MAX = 1000;

const FALLBACK_SPRITES = Object.freeze({
  kobold: 'assets/sprites/kobold-stand.png',
  'kobold-bodyguard': 'assets/sprites/kobold-bodyguard-stand.png',
  'kobold-slinger': 'assets/sprites/kobold-slinger-stand.png',
  orc: 'assets/sprites/orc-stand.png',
  'orc-leader': 'assets/sprites/orc-leader-stand.png',
  'orc-shaman': 'assets/sprites/orc-shaman-stand.png',
  'juvenile-red-dragon': 'assets/sprites/juvenile-red-dragon.png'
});

// One model, one animation clock, one WebGL context. All six directions are
// rendered into an atlas before a single readback and palette conversion.
const $ = id => document.getElementById(id);
const ui = Object.fromEntries([
  'Canvas', 'Viewport', 'Files', 'LoadButton', 'DemoButton', 'ModelName',
  'ModelLibrary', 'LoadLibraryButton', 'ModelLibraryStatus',
  'RightHandWeapon', 'LeftHandShield', 'ShieldStatus', 'ShieldScale', 'ShieldScaleValue', 'ShieldDistance', 'ShieldDistanceValue', 'ShieldForearmSlide', 'ShieldForearmSlideValue',
  'ShieldForearmRoll', 'ShieldForearmRollValue', 'ResetShieldButton', 'WeaponSize', 'WeaponSizeValue', 'EquipmentStatus', 'EquipmentLockNote', 'ResetEquipmentButton',
  'WeaponPositionX', 'WeaponPositionY', 'WeaponPositionZ', 'WeaponRotationX', 'WeaponRotationY', 'WeaponRotationZ',
  'ModelInfo', 'FrameButton', 'FrameAnimationsButton', 'ResetViewButton', 'Heading', 'HeadingValue',
  'UpAxis', 'Resolution', 'ResolutionValue', 'MobTarget', 'Footprint', 'LegacyFootprint',
  'FootprintPreview', 'FootprintDescription', 'FormatSummary', 'EmptyMessage',
  'ModelScale', 'ModelScaleValue', 'BattlefieldSize', 'LightingLockNote', 'LightingFields',
  'HeightRuler', 'ModelHeight', 'ModelHeightValue',
  'AmbientIntensity', 'AmbientIntensityValue', 'AmbientColor',
  'KeyIntensity', 'KeyIntensityValue', 'KeyColor', 'KeyElevation', 'KeyElevationValue', 'KeyDirection',
  'Brightness', 'BrightnessValue', 'Contrast', 'ContrastValue',
  'Hue', 'HueValue', 'Saturation', 'SaturationValue', 'ResetColorsButton', 'Outline', 'OutlineValue', 'Clip',
  'PlayButton', 'RestartButton', 'Speed', 'Timeline', 'Time', 'AnimationSummary', 'AnimationWarning',
  'AnimationRanges', 'RangeSource', 'RangeName', 'RangeStart', 'RangeEnd', 'RangeStartButton', 'RangeEndButton',
  'AddRangeButton', 'RemoveRangeButton', 'RangeStatus',
  'ExportSheetButton', 'Status', 'Error'
].map(name => [name, $(`studio${name}`)]));

const state = {
  model: null, modelName: 'Studio mannequin', clips: [], sourceClips: [], animationRanges: [], mixer: null,
  action: null, playing: true, facing: 'SE', heading: 0, upAxis: 'Z',
  width: 160, height: 200, layoutId: 'single', resolutionPercent: 100, mobType: 'kobold',
  modelScalePercent: 100, hexScalePercent: SPRITE_HEX_SCALE_PERCENT, lighting: { ...DEFAULT_LIGHTING },
  sourceFiles: [], isDemo: true, demoSourceUpAxis: 'Z', modelReady: false,
  libraryModels: [], libraryModelId: '', libraryLoading: false, modelLoading: false,
  brightness: 1, contrast: 1, hue: 0, saturation: 1, outline: 1,
  loadingVersion: 0, frame: 0, animationTime: 0, lastPreview: -Infinity,
  mainDirty: true, previewsDirty: true, lastTick: 0, raf: 0, disposed: false,
  heightDirty: true, heightFeet: null, lastHeightMeasure: -Infinity,
  viewVisible: true, frameHeight: 3.15, framingMode: 'pose', framingSamplesPerClip: 0,
  previewReferenceBounds: null, spriteOnlyFallback: false, fallbackImage: null, fallbackSrc: '',
  center: new THREE.Vector3(0, 1, 0)
};

let renderer, scene, mainCamera, pixelCamera, orbit, turntable, calibration;
let placement, upAxisGroup, helpers, footprintGuide, ambientLight, legacyAmbientLight, keyLight, modelFrame;
let atlasTarget, atlasSource, atlasImage;
let resizeObserver, visibilityObserver, poseCapture;
let modelBounds = null, heightRulerLine;
const equipment = createStudioEquipment({
  THREE,
  loadAsset: async weapon => {
    const url = new URL(weapon.file, new URL('../', import.meta.url));
    const loaded = await new GLTFLoader().loadAsync(url.href);
    return loaded.scene;
  },
  disposeObject: disposeModel,
  onChange: () => {
    updateEquipmentControls();
    if (state.model) updateModelInfo();
    if (renderer) invalidate();
  }
});
const shieldEquipment = createStudioShield({
  THREE,
  loadAsset: async shield => {
    const url=new URL(shield.file,new URL('../',import.meta.url));
    const loaded=await new GLTFLoader().loadAsync(url.href);
    return loaded.scene;
  },
  disposeObject: disposeModel,
  onChange: () => {
    updateEquipmentControls();
    if (state.model) updateModelInfo();
    if (renderer) invalidate();
  }
});
const heightRulerTicks = [];
const atlasCanvas = document.createElement('canvas');
const atlasContext = atlasCanvas.getContext('2d');
const previews = HEX_FACINGS.map(facing => ({
  ...facing,
  canvas: $(`studioPreview${facing.id}`),
  context: $(`studioPreview${facing.id}`).getContext('2d', { alpha: false })
}));

function getWorkspaceSettings() {
  return {
    modelName: state.modelName, sourceFiles: state.sourceFiles, isDemo: state.isDemo,
    libraryModelId: state.libraryModelId,
    demoSourceUpAxis: state.demoSourceUpAxis,
    layoutId: state.layoutId, resolutionPercent: state.resolutionPercent,
    layout: createSpriteLayoutMetadata(state.layoutId, state.resolutionPercent),
    mobType: state.mobType, width: state.width, height: state.height,
    modelScalePercent: state.modelScalePercent, hexScalePercent: state.hexScalePercent, lighting: { ...state.lighting },
    equipment: equipment.snapshot().settings,
    shield: shieldEquipment.snapshot().settings,
    heading: state.heading, upAxis: state.upAxis, frameHeight: state.frameHeight,
    center: state.center.toArray(), framingMode: state.framingMode,
    framingSamplesPerClip: state.framingSamplesPerClip,
    // Store the base transform. Model size is applied once when reopening it.
    placement: modelFrame ? { position: modelFrame.position.toArray(), scale: modelFrame.scale } : null,
    clipIndex: Number(ui.Clip.value), clipName: state.action?.getClip().name || '',
    clipSourceId: animationSourceId(state.action?.getClip()), animationTimingVersion: 1,
    animationRanges: state.animationRanges.map(range => ({ ...range })),
    time: state.action?.time || 0, playing: state.playing,
    speed: Number(ui.Speed.value) || 1, facing: state.facing
  };
}

function renderFootprintPreview() {
  const layout = spriteLayout(state.layoutId);
  const centers = layout.offsets.map(({ x, y }) => ({ x: (x + y / 2) * 40, y: y * 21 }));
  const minX = Math.min(...centers.map(point => point.x)) - 23;
  const maxX = Math.max(...centers.map(point => point.x)) + 23;
  const minY = Math.min(...centers.map(point => point.y)) - 17;
  const maxY = Math.max(...centers.map(point => point.y)) + 17;
  ui.FootprintPreview.setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
  ui.FootprintPreview.setAttribute('aria-label', `${layout.label}, ${centers.length} occupied hexes, facing east`);
  ui.FootprintPreview.replaceChildren(...centers.map(center => {
    const hex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    hex.setAttribute('points', [[0, -14], [20, -7], [20, 7], [0, 14], [-20, 7], [-20, -7]]
      .map(([x, y]) => `${center.x + x},${center.y + y}`).join(' '));
    return hex;
  }));
  ui.FootprintDescription.textContent = `${centers.length} occupied ${centers.length === 1 ? 'hex' : 'hexes'} · E-facing footprint`;
}

function updateSetupLabels() {
  const legacy = !SPRITE_LAYOUT_PRESETS.some(layout => layout.id === state.layoutId);
  ui.Footprint.hidden = legacy;
  ui.LegacyFootprint.hidden = !legacy;
  ui.LegacyFootprint.textContent = legacy ? `${spriteLayout(state.layoutId).label} · Saved format; clear the sheet to choose a new one.` : '';
  ui.Footprint.value = state.layoutId;
  ui.MobTarget.value = state.mobType;
  ui.Resolution.value = String(state.resolutionPercent);
  ui.ResolutionValue.textContent = `${state.resolutionPercent}%`;
  ui.Resolution.setAttribute('aria-valuetext', `${state.width} by ${state.height} pixels per sprite, ${state.resolutionPercent} percent`);
  ui.FormatSummary.textContent = `Frame ${state.width} × ${state.height} · Sheet ${state.width * 6} × ${state.height * 3}`;
  ui.ModelScale.value = String(state.modelScalePercent);
  ui.ModelScaleValue.textContent = `${state.modelScalePercent}%`;
  const size = spriteLayoutDimensions(state.layoutId, state.resolutionPercent, state.modelScalePercent, state.hexScalePercent);
  const renderWidth = Number(size.renderWidth.toFixed(2)), renderHeight = Number(size.renderHeight.toFixed(2));
  ui.BattlefieldSize.textContent = `Battlefield frame ${renderWidth} × ${renderHeight} px`;
  ui.ModelScale.setAttribute('aria-valuetext', `${state.modelScalePercent} percent, ${renderWidth} by ${renderHeight} battlefield pixels`);
  renderFootprintPreview();
}

function populateSetupControls() {
  ui.RightHandWeapon.replaceChildren(new Option('None', 'none'),
    ...STUDIO_WEAPONS.map(weapon => new Option(weapon.label, weapon.id)));
  ui.LeftHandShield.replaceChildren(new Option('None', 'none'),
    ...STUDIO_SHIELDS.map(shield => new Option(shield.label, shield.id)));
  ui.MobTarget.replaceChildren(...['monster', 'player'].map(kind => {
    const group = document.createElement('optgroup');
    group.label = kind === 'player' ? 'Test player characters' : 'MOBs';
    group.append(...SPRITE_MOBS.filter(mob => (mob.targetKind || 'monster') === kind)
      .map(mob => new Option(mob.label, mob.id)));
    return group;
  }));
  ui.Footprint.replaceChildren(...SPRITE_LAYOUT_PRESETS.map(layout => new Option(layout.label, layout.id)));
  for (const key of ['min', 'max', 'step']) ui.Resolution[key] = String(SPRITE_RESOLUTION[key]);
  for (const key of ['min', 'max', 'step']) ui.ModelScale[key] = String(SPRITE_MODEL_SCALE[key]);
  ui.ModelScale.max = String(STUDIO_MODEL_SCALE_MAX);
  ui.KeyDirection.replaceChildren(...HEX_FACINGS.map(facing => new Option(`${facing.label} (${facing.id})`, facing.id)));
  updateSetupLabels();
  const svgElement = name => document.createElementNS('http://www.w3.org/2000/svg', name);
  heightRulerLine = svgElement('line');
  ui.HeightRuler.append(heightRulerLine);
  for (let feet = 0; feet <= STUDIO_HEIGHT_RULER_FEET; feet++) {
    const tick = svgElement('line');
    const label = feet % 5 === 0 ? svgElement('text') : null;
    if (label) label.textContent = `${feet} ft`;
    ui.HeightRuler.append(tick);
    if (label) ui.HeightRuler.append(label);
    heightRulerTicks.push({ feet, tick, label });
  }
}

function syncCaptureLock(locked) {
  for (const control of [ui.Footprint, ui.Resolution]) control.disabled = locked;
  for (const control of [ui.FrameButton, ui.FrameAnimationsButton, ui.Heading, ui.UpAxis]) {
    control.disabled = locked || !state.modelReady;
  }
  const saved = poseCapture?.snapshot();
  ui.ModelScale.disabled = saved?.modelScaleAdjustable === false || (!state.modelReady && !state.spriteOnlyFallback && !locked);
  for (const control of [ui.AmbientIntensity, ui.AmbientColor, ui.KeyIntensity, ui.KeyColor, ui.KeyElevation, ui.KeyDirection]) {
    control.disabled = locked || !state.modelReady;
  }
  ui.LightingLockNote.textContent = locked
    ? state.lighting.legacyRig === 'rev47'
      ? 'Original lighting restored for this saved sheet. Clear the sheet to use the new lighting controls.'
      : 'Lighting is shared by all captured poses. Clear the sheet to change it.'
    : 'Both lights affect the model, six pixel previews and captured sprites.';
  updateEquipmentControls(locked);
}

function formatShieldDistance(value){
  if(Math.abs(value)<0.001)return 'Base';
  return `${Math.abs(value).toFixed(2)} in ${value>0?'farther':'closer'}`;
}
function formatShieldSlide(value){
  if(Math.abs(value)<0.001)return 'Base';
  return `${Math.abs(value).toFixed(2)} in ${value>0?'toward elbow':'toward hand'}`;
}

function updateEquipmentControls(locked = !!poseCapture?.snapshot().captureCount) {
  const current = equipment.snapshot(), settings = current.settings;
  const shieldCurrent = shieldEquipment.snapshot(), shieldSettings = shieldCurrent.settings;
  const busy = !state.modelReady || state.spriteOnlyFallback || state.modelLoading || current.loading || shieldCurrent.loading || state.disposed;
  ui.RightHandWeapon.value = settings.rightHand;
  ui.RightHandWeapon.disabled = busy || locked;
  ui.LeftHandShield.value = shieldSettings.leftHandShield;
  ui.LeftHandShield.disabled = busy || locked;
  const shieldDisabled=busy||locked||shieldSettings.leftHandShield==='none';
  ui.ShieldScale.value=String(shieldSettings.sizePercent);
  ui.ShieldScaleValue.textContent=`${Math.round(shieldSettings.sizePercent)}%`;
  ui.ShieldScale.disabled=shieldDisabled;
  ui.ShieldScale.setAttribute('aria-valuetext',`${Math.round(shieldSettings.sizePercent)} percent`);
  ui.ShieldDistance.value=String(shieldSettings.distanceInches);
  ui.ShieldDistanceValue.textContent=formatShieldDistance(shieldSettings.distanceInches);
  ui.ShieldDistance.disabled=shieldDisabled;
  ui.ShieldDistance.setAttribute('aria-valuetext',formatShieldDistance(shieldSettings.distanceInches));
  ui.ShieldForearmSlide.value=String(shieldSettings.forearmSlideInches);
  ui.ShieldForearmSlideValue.textContent=formatShieldSlide(shieldSettings.forearmSlideInches);
  ui.ShieldForearmSlide.disabled=shieldDisabled;
  ui.ShieldForearmSlide.setAttribute('aria-valuetext',formatShieldSlide(shieldSettings.forearmSlideInches));
  ui.ShieldForearmRoll.value=String(shieldSettings.forearmRollDegrees);
  ui.ShieldForearmRollValue.textContent=`${Math.round(shieldSettings.forearmRollDegrees)}°`;
  ui.ShieldForearmRoll.disabled=shieldDisabled;
  ui.ShieldForearmRoll.setAttribute('aria-valuetext',`${Math.round(shieldSettings.forearmRollDegrees)} degrees`);
  ui.ResetShieldButton.disabled=shieldDisabled;
  ui.WeaponSize.value = String(settings.sizePercent);
  ui.WeaponSizeValue.textContent = `${settings.sizePercent}%`;
  ui.WeaponSize.disabled = busy || locked || settings.rightHand === 'none';
  for (const [name, key] of [['Position', 'position'], ['Rotation', 'rotation']]) {
    for (const [axis, index] of [['X', 0], ['Y', 1], ['Z', 2]]) {
      const field = ui[`Weapon${name}${axis}`];
      field.value = String(settings[key][index]);
      field.disabled = busy || locked || settings.rightHand === 'none';
    }
  }
  ui.ResetEquipmentButton.disabled = busy || locked || settings.rightHand === 'none';
  ui.EquipmentStatus.classList.toggle('error', !!current.error);
  ui.EquipmentStatus.textContent = current.loading ? 'Loading weapon…' : current.error
    ? locked ? `${current.error} Reload the studio to retry without clearing your captures.` : current.error
    : current.attached ? 'Equipped weapon follows the right hand in every animation.'
    : current.rightHandBone ? 'Choose a right-hand weapon to equip this model.'
    : 'Load a compatible rigged MOB model to use a right-hand attachment.';
  ui.ShieldStatus.classList.toggle('error', !!shieldCurrent.error);
  ui.ShieldStatus.textContent = shieldCurrent.loading ? 'Loading wooden shield…' : shieldCurrent.error
    ? shieldCurrent.error
    : shieldCurrent.attached ? 'Wooden shield follows the left hand through the selected animation.'
    : shieldCurrent.leftHandBone ? 'Choose a left-hand shield for animation QA.'
    : 'Load a compatible rigged MOB model to use a left-hand shield.';
  ui.EquipmentLockNote.classList.toggle('locked', locked);
  ui.EquipmentLockNote.textContent = locked
    ? 'Equipment and grip are shared by this sheet. Clear all captured poses before changing them.'
    : 'Right-hand weapon and left-hand shield are included in all six previews and new captures.';
}

function readyClipIndex() {
  const explicit = state.clips.findIndex(clip => /^UAL2_Sword_Ready$/i.test(clip.name));
  return explicit >= 0 ? explicit : state.clips.findIndex(clip => /ready/i.test(clip.name));
}

function resetPreviewReferenceToReady() {
  state.previewReferenceBounds = null;
  const index = readyClipIndex();
  if (index < 0 || !state.mixer) return;
  setClip(index);
  if (state.action) {
    state.action.time = 0;
    state.mixer.update(0);
    updateAnimationControls();
  }
}

async function changeEquipment(value, { fit = false } = {}) {
  if (!state.modelReady || state.modelLoading || poseCapture?.snapshot().captureCount) {
    updateEquipmentControls();
    return;
  }
  const model = state.model;
  const changed = await equipment.select(value);
  if (state.disposed || state.model !== model) return;
  if (changed) {
    if (fit) fitAllAnimations();
    resetPreviewReferenceToReady();
  }
  poseCapture?.saveWorkspace();
}

async function changeShield(value,{fit=false,resetPose=true}={}){
  if(!state.modelReady||state.modelLoading||poseCapture?.snapshot().captureCount){
    updateEquipmentControls();
    return;
  }
  const model=state.model;
  const changed=await shieldEquipment.select(value);
  if(state.disposed||state.model!==model)return;
  if(changed){
    if(fit)fitAllAnimations();
    if(resetPose)resetPreviewReferenceToReady();
  }
  poseCapture?.saveWorkspace();
}

function setModelReady(ready) {
  state.modelReady = ready;
  state.heightDirty = true;
  if (!ready) { modelBounds = null; state.heightFeet = null; }
  ui.HeightRuler.toggleAttribute('hidden', !ready);
  ui.ModelHeight.hidden = !ready;
  ui.LoadButton.disabled = ui.DemoButton.disabled = !renderer || state.disposed;
  syncModelLibraryControls();
  ui.ResetViewButton.disabled = !ready;
  ui.ExportSheetButton.disabled = !ready;
  document.querySelectorAll('[data-studio-export], [data-studio-facing]').forEach(button => { button.disabled = !ready; });
  poseCapture?.setModelReady(ready);
  syncCaptureLock(!!poseCapture?.snapshot().captureCount);
  updateAnimationControls();
}

function changeSpriteFormat({ refit = false } = {}) {
  const dimensions = spriteLayoutDimensions(state.layoutId, state.resolutionPercent);
  state.width = dimensions.width;
  state.height = dimensions.height;
  if (renderer && !state.disposed) configureAtlas();
  updateSetupLabels();
  if (refit && state.modelReady) fitAllAnimations();
  else rebuildFootprintGuide();
  poseCapture?.updateMetadata();
}

function normalizedLighting(value = {}) {
  const result = { ...DEFAULT_LIGHTING };
  for (const [key, max] of [['ambientIntensity', 3], ['keyIntensity', 5], ['keyElevation', 90]]) {
    if (Number.isFinite(value[key])) result[key] = THREE.MathUtils.clamp(value[key], 0, max);
  }
  for (const key of ['ambientColor', 'keyColor']) {
    if (/^#[0-9a-f]{6}$/i.test(value[key] || '')) result[key] = value[key].toLowerCase();
  }
  if (HEX_FACINGS.some(facing => facing.id === value.keyDirection)) result.keyDirection = value.keyDirection;
  if (value.legacyRig === 'rev47') result.legacyRig = 'rev47';
  return result;
}

function updateLighting() {
  const light = state.lighting;
  ui.AmbientIntensity.value = String(Math.round(light.ambientIntensity * 100));
  ui.AmbientIntensityValue.textContent = `${Math.round(light.ambientIntensity * 100)}%`;
  ui.AmbientColor.value = light.ambientColor;
  ui.KeyIntensity.value = String(Math.round(light.keyIntensity * 100));
  ui.KeyIntensityValue.textContent = `${Math.round(light.keyIntensity * 100)}%`;
  ui.KeyColor.value = light.keyColor;
  ui.KeyElevation.value = String(light.keyElevation);
  ui.KeyElevationValue.textContent = `${light.keyElevation}°`;
  ui.KeyDirection.value = light.keyDirection;
  const legacy = light.legacyRig === 'rev47';
  ui.LightingFields.hidden = legacy;
  if (ambientLight) {
    ambientLight.visible = !legacy;
    legacyAmbientLight.visible = legacy;
    ambientLight.color.set(light.ambientColor);
    ambientLight.intensity = light.ambientIntensity;
    keyLight.color.set(light.keyColor);
    keyLight.intensity = light.keyIntensity;
    const position = legacy ? { x: -3, y: 5, z: 6 } : studioLightPosition(light.keyDirection, light.keyElevation);
    keyLight.position.set(position.x, position.y, position.z);
    keyLight.target.position.set(0, 0, 0);
    keyLight.updateMatrixWorld();
    keyLight.target.updateMatrixWorld();
  }
  invalidate();
}

function rebuildFootprintGuide() {
  if (!helpers) return;
  if (footprintGuide) { helpers.remove(footprintGuide); disposeModel(footprintGuide); }
  footprintGuide = new THREE.Group();
  footprintGuide.name = 'SelectedHexFootprint';
  const facing = HEX_FACINGS.findIndex(item => item.id === state.facing);
  const cells = studioFootprintGuide(state.layoutId, facing, state.frameHeight);
  for (const cell of cells) {
    const points = cell.vertices.map(vertex => new THREE.Vector3(vertex.x, 0.006, vertex.z));
    const positions = [];
    for (let index = 0; index < 6; index++) {
      positions.push(cell.x, 0.003, cell.z, points[index].x, 0.003, points[index].z,
        points[(index + 1) % 6].x, 0.003, points[(index + 1) % 6].z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    footprintGuide.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color: 0xd0b66a, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false
    })));
    footprintGuide.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0xe3ca79, transparent: true, opacity: 0.95 })));
  }
  helpers.add(footprintGuide);
  invalidate(false);
}

function rescaleModelView(ratio) {
  if (!mainCamera || !orbit || ratio === 1) return;
  const position = mainCamera.position.clone(), target = orbit.target.clone();
  const zoom = mainCamera.zoom, damping = orbit.enableDamping;
  try {
    // Clear pending orbit/pan inertia without advancing the visible view.
    // Otherwise an old world-space pan would keep moving after the rescale.
    orbit.enableDamping = false;
    orbit.update();
    mainCamera.position.copy(position).multiplyScalar(ratio);
    orbit.target.copy(target).multiplyScalar(ratio);
    mainCamera.zoom = zoom;
    // Model points and the complete orthographic view scale about the same
    // origin. Their screen projection stays fixed; the ground/ruler do not.
    for (const key of ['left', 'right', 'top', 'bottom', 'near', 'far']) mainCamera[key] *= ratio;
    mainCamera.updateProjectionMatrix();
    orbit.update();
    mainCamera.updateMatrixWorld();
  } finally { orbit.enableDamping = damping; }
}

function applyModelSize(previousScalePercent = state.modelScalePercent) {
  if (!modelFrame || !placement) return;
  const factor = state.modelScalePercent / 100 * state.hexScalePercent / 100;
  placement.position.copy(modelFrame.position).multiplyScalar(factor);
  placement.scale.setScalar(modelFrame.scale * factor);
  rescaleModelView(state.modelScalePercent / previousScalePercent);
  updateCaptureCamera();
  invalidate();
}

function status(message) { ui.Status.textContent = message; }
function clearError() { ui.Error.hidden = true; ui.Error.textContent = ''; }
function showError(error) {
  const text = error instanceof Error ? error.message : String(error);
  ui.Error.textContent = text;
  ui.Error.hidden = false;
}
function invalidate(previewsToo = true) {
  state.mainDirty = true;
  if (previewsToo) { state.previewsDirty = true; state.heightDirty = true; }
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

function makeDemo({ upAxis = 'Z' } = {}) {
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
  const root = upAxis === 'Z' ? new THREE.Group() : model;
  if (root !== model) {
    root.name = 'StudioMannequinZUp';
    root.rotation.x = Math.PI / 2;
    root.add(model);
  }
  return { model: root, clips: [idle, attack, fall], name: 'Studio mannequin', demoSourceUpAxis: upAxis };
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

function geometryBounds(root, { refreshSkinnedBounds = true } = {}) {
  root.updateWorldMatrix(true, false);
  // SkinnedMesh overrides updateMatrixWorld to refresh its bind inverse;
  // preserve that dispatch when measuring normalized models off-scene.
  root.updateMatrixWorld(true);
  if (refreshSkinnedBounds) root.traverse(object => {
    if (object.isSkinnedMesh) object.computeBoundingBox();
  });
  const bounds = new THREE.Box3().setFromObject(root, true);
  if (bounds.isEmpty() || ![...bounds.min, ...bounds.max].every(Number.isFinite)) {
    throw new Error('The model has invalid or empty geometry in an animation pose. Export the model again and retry.');
  }
  return bounds;
}

// Screen labels follow a world-space vertical ruler. They never enter the
// render scene or capture atlas. Measure skinned poses at most ten times per
// second during playback; paused edits update on the next rendered frame.
function updateHeightGuide(timestamp) {
  if (!state.modelReady || !state.model) return;
  if (!modelBounds || (state.heightDirty &&
      (!state.playing || !state.action || timestamp - state.lastHeightMeasure >= 100))) {
    modelBounds = geometryBounds(state.model, { refreshSkinnedBounds: false });
    state.heightFeet = studioModelHeightFeet(modelBounds.max.y - modelBounds.min.y, state.layoutId, state.frameHeight);
    ui.ModelHeightValue.textContent = `${state.heightFeet.toFixed(1)} ft`;
    state.heightDirty = false;
    state.lastHeightMeasure = timestamp;
  }
  const width = ui.Viewport.clientWidth, height = ui.Viewport.clientHeight;
  if (!width || !height) return;
  const screen = point => {
    const projected = point.project(mainCamera);
    return { x: (projected.x + 1) * width / 2, y: (1 - projected.y) * height / 2 };
  };
  let modelLeft = width;
  for (const x of [modelBounds.min.x, modelBounds.max.x]) {
    for (const y of [modelBounds.min.y, modelBounds.max.y]) {
      for (const z of [modelBounds.min.z, modelBounds.max.z]) {
        modelLeft = Math.min(modelLeft, screen(new THREE.Vector3(x, y, z)).x);
      }
    }
  }
  const unitsPerFoot = studioWorldUnitsPerFoot(state.layoutId, state.frameHeight);
  const ground = screen(new THREE.Vector3(0, 0, 0));
  const top = screen(new THREE.Vector3(0, unitsPerFoot * STUDIO_HEIGHT_RULER_FEET, 0));
  // Keep the labels beside the model and legible during orbit/pan. The vertical
  // projection uses the real camera, so zoom changes ruler spacing, not feet.
  const x = THREE.MathUtils.clamp(modelLeft - 24, 62, Math.max(62, width - 18));
  const pixelsPerFoot = (ground.y - top.y) / STUDIO_HEIGHT_RULER_FEET;
  ui.HeightRuler.setAttribute('viewBox', `0 0 ${width} ${height}`);
  ui.HeightRuler.toggleAttribute('hidden', Math.abs(ground.y - top.y) < 16);
  heightRulerLine.setAttribute('x1', x);
  heightRulerLine.setAttribute('x2', x);
  heightRulerLine.setAttribute('y1', ground.y);
  heightRulerLine.setAttribute('y2', top.y);
  for (const { feet, tick, label } of heightRulerTicks) {
    const y = ground.y - feet * pixelsPerFoot;
    tick.setAttribute('x1', x - (label ? 7 : 4));
    tick.setAttribute('x2', x + (label ? 7 : 4));
    tick.setAttribute('y1', y);
    tick.setAttribute('y2', y);
    tick.toggleAttribute('hidden', !label && Math.abs(pixelsPerFoot) < 4);
    if (label) {
      label.setAttribute('x', x - 12);
      label.setAttribute('y', y);
      label.toggleAttribute('hidden', feet > 0 && feet < STUDIO_HEIGHT_RULER_FEET && Math.abs(pixelsPerFoot) < 3);
    }
  }
}

// Measure off-scene, then apply the complete result. Failed fitting never leaves
// the previous camera, model parent, or animation partially changed.
function measureModelFrame(model, clips, { upAxis = 'Z', mixer = null, action = null, aspect = state.width / state.height } = {}) {
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
      frameHeight: Math.max(projectedHeight, 2 * radius / aspect, 1) * 1.24,
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
  modelBounds = null;
  modelFrame = { ...frame, position: frame.position.clone(), center: frame.center.clone() };
  upAxisGroup.rotation.x = state.upAxis === 'Z' ? -Math.PI / 2 : 0;
  state.center.copy(frame.center);
  state.frameHeight = frame.frameHeight;
  state.framingMode = frame.mode;
  state.framingSamplesPerClip = frame.samplesPerClip;
  calibration.rotation.y = THREE.MathUtils.degToRad(state.heading);
  turntable.rotation.y = HEX_FACINGS.find(item => item.id === state.facing).yawRadians;
  state.lastTick = 0;
  applyModelSize();
  rebuildFootprintGuide();
  resetCamera();
  invalidate();
}

function fitModel() {
  if (!state.model || poseCapture?.snapshot().captureCount) return;
  applyModelFrame(measureModelFrame(state.model, [], { upAxis: state.upAxis }));
  poseCapture?.saveWorkspace();
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
    poseCapture?.saveWorkspace();
  } catch (error) { showError(error); }
}

function setCameraFrustum(camera, aspect, frameHeight = state.frameHeight) {
  const halfHeight = frameHeight / 2;
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}

function fixedCamera(camera, center = state.center, frameHeight = state.frameHeight) {
  const distance = Math.max(8, frameHeight * 2);
  camera.position.copy(center).add(new THREE.Vector3(0, Math.sin(CAMERA_ELEVATION), Math.cos(CAMERA_ELEVATION)).multiplyScalar(distance));
  camera.far = Math.max(100, distance * 3);
  camera.updateProjectionMatrix();
  camera.up.set(0, 1, 0);
  camera.lookAt(center);
}

function updateCaptureCamera() {
  if (!pixelCamera) return;
  const factor = state.modelScalePercent / 100 * state.hexScalePercent / 100;
  const height = state.frameHeight * factor;
  // The source image keeps the same framing at every model size. Combat applies
  // the exported render dimensions once, so size never gets multiplied twice.
  setCameraFrustum(pixelCamera, state.width / state.height, height);
  fixedCamera(pixelCamera, state.center.clone().multiplyScalar(factor), height);
}

function mainViewFrame(aspect) {
  if (!state.model) return { center: state.center.clone(), height: state.frameHeight * 2 };
  turntable.rotation.y = HEX_FACINGS.find(item => item.id === state.facing).yawRadians;
  const bounds = geometryBounds(state.model);
  const size = bounds.getSize(new THREE.Vector3());
  const projectedHeight = size.y * Math.cos(CAMERA_ELEVATION) + size.z * Math.sin(CAMERA_ELEVATION);
  // Fit the model to half the available width or height. The ruler remains in
  // feet and can extend outside the view; it must not shrink a small creature.
  return {
    center: bounds.getCenter(new THREE.Vector3()),
    height: Math.max(projectedHeight, size.x / aspect, 0.001) * 2
  };
}

function resetCamera() {
  if (!mainCamera || !pixelCamera || !orbit) return;
  const rect = ui.Viewport.getBoundingClientRect();
  const aspect = Math.max(rect.width, 1) / Math.max(rect.height, 1);
  const frame = mainViewFrame(aspect);
  setCameraFrustum(mainCamera, aspect, frame.height);
  fixedCamera(mainCamera, frame.center, frame.height);
  updateCaptureCamera();
  mainCamera.zoom = 1;
  mainCamera.updateProjectionMatrix();
  orbit.target.copy(frame.center);
  orbit.update();
  invalidate(false);
}

function selectFacing(id) {
  if (!HEX_FACINGS.some(item => item.id === id)) return;
  state.facing = id;
  modelBounds = null;
  document.querySelectorAll('[data-studio-facing]').forEach(button => {
    const active = button.dataset.studioFacing === id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-studio-card]').forEach(card => {
    card.classList.toggle('active', card.dataset.studioCard === id);
  });
  rebuildFootprintGuide();
  resetCamera();
}

function makeRangeClip(range, sourceClips) {
  const sourceIndex = range.sourceId ? sourceClips.findIndex(clip => animationSourceId(clip) === range.sourceId) : range.sourceIndex;
  const source = sourceClips[sourceIndex];
  if (!source || typeof range.id !== 'string' || !range.id.startsWith('range:') ||
      typeof range.name !== 'string' || !range.name.trim() || range.name.length > 120) {
    throw new Error('This saved animation range no longer matches its source animation.');
  }
  const clip = sliceAnimationClip(source, range.start, range.end, range.name.trim());
  clip.userData = { ...clip.userData, studioAnimationId: range.id };
  return { clip, range: { ...range, sourceIndex, sourceId: animationSourceId(source) } };
}

function animationRangeContext() {
  const clip = state.action?.getClip();
  if (!clip) return null;
  const range = state.animationRanges.find(item => item.id === animationSourceId(clip));
  const sourceIndex = range ? range.sourceIndex : state.sourceClips.indexOf(clip);
  const source = state.sourceClips[sourceIndex];
  return source ? { source, sourceIndex, range } : null;
}

function updateRangeEditor() {
  const context = animationRangeContext();
  ui.RangeSource.textContent = context ? `Source: ${animationOptionLabel(context.source, context.sourceIndex)}` : 'Select an animation first.';
  ui.RangeName.value = context?.range?.name || '';
  ui.RangeStart.value = String(context?.range?.start || 0);
  ui.RangeEnd.value = String(context?.range?.end ?? context?.source.duration ?? 0);
  ui.RangeStart.max = ui.RangeEnd.max = String(context?.source.duration || 0);
  ui.RangeStatus.textContent = '';
}

function updateAnimationChoices(index) {
  ui.Clip.replaceChildren(new Option('Rest pose', '-1'));
  state.clips.forEach((clip, clipIndex) => ui.Clip.add(new Option(animationOptionLabel(clip, clipIndex), String(clipIndex))));
  ui.Clip.value = String(index);
  ui.Clip.disabled = !state.clips.length;
  const count = state.sourceClips.length;
  const info = state.model?.userData?.fbxAnimations;
  const sourceSummary = info ? `${count} selectable animation${count === 1 ? '' : 's'} from ${info.stackCount} FBX take${info.stackCount === 1 ? '' : 's'}` :
    count ? `${count} embedded animation${count === 1 ? '' : 's'} found` : 'No animated clips found';
  ui.AnimationSummary.textContent = sourceSummary +
    (state.animationRanges.length ? ` · ${state.animationRanges.length} saved range${state.animationRanges.length === 1 ? '' : 's'}` : '') +
    (count ? '. One animation plays at a time.' : '. The rest pose is available for capture.');
  const notes = [];
  if (info?.emptyStackCount) notes.push(`${info.emptyStackCount} FBX take${info.emptyStackCount === 1 ? ' had' : 's had'} no supported animation tracks and ${info.emptyStackCount === 1 ? 'was' : 'were'} skipped.`);
  if (info?.layeredStackCount) notes.push('Layered FBX takes use their first usable layer. Export baked animations to include all blended layers.');
  ui.AnimationWarning.textContent = notes.join(' ');
  ui.AnimationWarning.hidden = !notes.length;
}

function setClip(index) {
  if (!state.mixer) return;
  state.mixer.stopAllAction();
  state.action = null;
  if (state.clips[index]) {
    state.action = state.mixer.clipAction(state.clips[index]);
    state.action.reset().setEffectiveWeight(1).setLoop(THREE.LoopRepeat, Infinity).play();
    state.action.timeScale = Number(ui.Speed.value) || 1;
    state.action.paused = !state.playing;
  }
  ui.Clip.value = state.action ? String(index) : '-1';
  state.mixer.update(0);
  updateRangeEditor();
  updateAnimationControls();
  invalidate();
}

function updateAnimationControls() {
  const available = state.modelReady && !!state.action;
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
  for (const field of ['RangeName', 'RangeStart', 'RangeEnd', 'RangeStartButton', 'RangeEndButton', 'AddRangeButton']) {
    ui[field].disabled = !available;
  }
  ui.RemoveRangeButton.disabled = !available || !animationRangeContext()?.range;
}

function installModel({ model, clips, name, demoSourceUpAxis = null }, {
  restoreSettings = null, sourceFiles = [], isDemo = false, persist = true, modelDefaults = null
} = {}) {
  // Validate before releasing the previously usable model.
  let visibleMeshes = 0;
  model.traverse(object => { if (object.isMesh && object.geometry?.attributes?.position?.count) visibleMeshes++; });
  if (!visibleMeshes) {
    disposeModel(model);
    throw new Error('This file has no mesh. Choose a model with its animations included.');
  }
  const sourceClips = prepareStudioAnimations(clips);
  sourceClips.forEach((clip, index) => {
    if (!animationSourceId(clip)) clip.userData = { ...clip.userData, studioAnimationId: `source:${index}` };
  });
  const availableClips = [...sourceClips], animationRanges = [];
  let skippedRanges = 0;
  for (const savedRange of Array.isArray(restoreSettings?.animationRanges) ? restoreSettings.animationRanges : []) {
    try {
      if (animationRanges.some(range => range.id === savedRange.id)) throw new Error('Duplicate saved animation range.');
      const { clip, range } = makeRangeClip(savedRange, sourceClips);
      availableClips.push(clip);
      animationRanges.push(range);
    } catch { skippedRanges++; }
  }
  const nextMobType = !restoreSettings && modelDefaults?.mobType ? spriteMob(modelDefaults.mobType).id : state.mobType;
  const nextUpAxis = (restoreSettings ? restoreSettings.upAxis : modelDefaults?.upAxis) === 'Y' ? 'Y' : 'Z';
  const nextLayoutId = !restoreSettings && (modelDefaults?.mobType || !SPRITE_LAYOUT_PRESETS.some(layout => layout.id === state.layoutId))
    ? spriteMob(nextMobType).defaultLayout : state.layoutId;
  const nextSize = restoreSettings ? { width: state.width, height: state.height }
    : spriteLayoutDimensions(nextLayoutId, state.resolutionPercent);
  let framing;
  try {
    framing = measureModelFrame(model, availableClips, {
      upAxis: nextUpAxis, aspect: nextSize.width / nextSize.height
    });
  }
  catch (error) { disposeModel(model); throw error; }
  if (state.mixer) {
    state.mixer.stopAllAction();
    state.mixer.uncacheRoot(state.model);
  }
  // Release equipment before disposing the old character's object tree.
  equipment.setModel(null);
  shieldEquipment.setModel(null);
  if (state.model) upAxisGroup.remove(state.model);
  disposeModel(state.model);
  state.model = model;
  state.modelName = name;
  state.libraryModelId = restoreSettings?.libraryModelId || modelDefaults?.id || '';
  state.modelLoading = false;
  state.sourceFiles = sourceFiles;
  state.isDemo = isDemo;
  state.demoSourceUpAxis = isDemo ? demoSourceUpAxis : null;
  if (!restoreSettings) {
    state.mobType = nextMobType;
    state.layoutId = nextLayoutId;
    state.modelScalePercent = Math.min(STUDIO_MODEL_SCALE_MAX, state.modelScalePercent);
    state.hexScalePercent = SPRITE_HEX_SCALE_PERCENT;
    state.width = nextSize.width;
    state.height = nextSize.height;
    if (state.lighting.legacyRig) { state.lighting = { ...DEFAULT_LIGHTING }; updateLighting(); }
    configureAtlas();
    updateSetupLabels();
  }
  state.clips = availableClips;
  state.sourceClips = sourceClips;
  state.animationRanges = animationRanges;
  state.mixer = new THREE.AnimationMixer(model);
  state.heading = Number.isFinite(restoreSettings?.heading) ? restoreSettings.heading : 0;
  state.upAxis = nextUpAxis;
  state.playing = restoreSettings ? !!restoreSettings.playing : true;
  ui.Heading.value = String(state.heading);
  ui.HeadingValue.textContent = `${state.heading}°`;
  ui.UpAxis.value = state.upAxis;
  model.traverse(object => {
    if (object.isSkinnedMesh) object.frustumCulled = false;
  });
  upAxisGroup.add(model);
  let clipIndex = restoreAnimationIndex(state.clips, restoreSettings);
  if (!restoreSettings) {
    const readyIndex = state.clips.findIndex(clip => /^UAL2_Sword_Ready$/i.test(clip.name));
    if (readyIndex >= 0) clipIndex = readyIndex;
  }
  state.previewReferenceBounds = null;
  state.spriteOnlyFallback = false;
  state.fallbackImage = null;
  state.fallbackSrc = '';
  if (restoreSettings) {
    ui.Speed.value = ['0.25', '0.5', '1', '1.5', '2'].includes(String(restoreSettings.speed)) ? String(restoreSettings.speed) : '1';
  }
  updateAnimationChoices(clipIndex);
  setClip(clipIndex);
  if (restoreSettings && state.action && Number.isFinite(restoreSettings.time)) {
    const clip = state.action.getClip();
    const oldTimeOffset = restoreSettings.animationTimingVersion === 1 ? 0 : clip.userData?.fbxAnimation?.start || 0;
    state.action.time = THREE.MathUtils.clamp(restoreSettings.time - oldTimeOffset, 0, clip.duration);
    state.mixer.update(0);
    updateAnimationControls();
  }
  const vector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
  if (restoreSettings && vector(restoreSettings.center) && vector(restoreSettings.placement?.position) &&
      Number.isFinite(restoreSettings.placement.scale) && restoreSettings.placement.scale > 0 &&
      Number.isFinite(restoreSettings.frameHeight) && restoreSettings.frameHeight > 0) {
    framing = {
      scale: restoreSettings.placement.scale,
      position: new THREE.Vector3(...restoreSettings.placement.position),
      center: new THREE.Vector3(...restoreSettings.center),
      frameHeight: restoreSettings.frameHeight,
      mode: restoreSettings.framingMode || 'animations',
      samplesPerClip: restoreSettings.framingSamplesPerClip || 0
    };
  }
  updateModelInfo();
  applyModelFrame(framing);
  if (!restoreSettings) poseCapture?.reset(name, { persist: false });
  ui.EmptyMessage.hidden = true;
  setModelReady(true);
  clearError();
  if (skippedRanges) {
    ui.RangeStatus.textContent = `${skippedRanges} saved animation range${skippedRanges === 1 ? '' : 's'} could not be restored. Your captured sprites are still available.`;
    ui.AnimationRanges.open = true;
  }
  status(restoreSettings ? 'Saved studio restored · Your captures are ready to export or continue' :
    state.clips.length ? 'Ready · All animations framed for six synchronized views' : 'Ready · Static model loaded');
  if (!restoreSettings && persist) poseCapture?.saveWorkspace();
  const shieldSettings=restoreSettings?.shield || (!restoreSettings && nextMobType==='fighter'
    ? {leftHandShield:'round-wooden-shield'} : {leftHandShield:'none'});
  return Promise.all([
    equipment.setModel(model, restoreSettings?.equipment),
    Promise.resolve(shieldEquipment.setModel(model, shieldSettings))
  ]).then(result=>{
    if(!restoreSettings && shieldSettings.leftHandShield!=='none') fitAllAnimations();
    return result;
  });
}

function configureAtlas() {
  atlasTarget?.dispose();
  state.previewReferenceBounds = null;
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
    preview.canvas.width = Math.max(state.width, Math.ceil(state.height * 1.25));
    preview.canvas.height = state.height;
    preview.context.imageSmoothingEnabled = false;
  });
  updateCaptureCamera();
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
  if (!state.modelReady || !state.model || state.disposed) throw new Error('Load a model before capturing a pose. Your saved sprites can still be exported.');
  const gear = equipment.snapshot();
  const shieldGear = shieldEquipment.snapshot();
  if (gear.loading) throw new Error('Wait for the weapon to finish loading before capturing a pose.');
  if (gear.settings.rightHand !== 'none' && !gear.attached) {
    throw new Error(gear.error || 'The equipped weapon is unavailable. Reload the studio before capturing another pose.');
  }
  if (shieldGear.settings.leftHandShield !== 'none' && !shieldGear.attached) {
    throw new Error(shieldGear.error || 'The equipped shield is unavailable. Reload the studio before capturing another pose.');
  }
  state.playing = false;
  state.lastTick = 0;
  if (state.action) state.action.paused = true;
  updateAnimationControls();
  // Do not advance the mixer between directions or wait for another browser frame.
  renderPreviews(performance.now());
  pixelCamera.updateMatrixWorld(true);
  const ground = new THREE.Vector3(0, 0, 0).project(pixelCamera);
  const size = spriteLayoutDimensions(state.layoutId, state.resolutionPercent, state.modelScalePercent, state.hexScalePercent);
  const result = {
    raw: atlasSource.slice(), width: state.width, height: state.height,
    layout: createSpriteLayoutMetadata(state.layoutId, state.resolutionPercent), mobType: state.mobType,
    modelScalePercent: state.modelScalePercent, hexScalePercent: state.hexScalePercent,
    renderWidth: size.renderWidth, renderHeight: size.renderHeight,
    clip: state.action?.getClip().name || 'Rest pose',
    clipSourceId: animationSourceId(state.action?.getClip()) || state.action?.getClip().name || 'Rest pose',
    time: state.action?.time || 0,
    anchorX: (ground.x + 1) * state.width / 2,
    anchorY: (1 - ground.y) * state.height / 2,
    render: {
      model: state.modelName, heading: state.heading, upAxis: state.upAxis,
      cameraElevation: THREE.MathUtils.radToDeg(CAMERA_ELEVATION),
      frameHeight: state.frameHeight * state.modelScalePercent / 100 * state.hexScalePercent / 100,
      center: state.center.clone().multiplyScalar(state.modelScalePercent / 100 * state.hexScalePercent / 100).toArray(),
      framingMode: state.framingMode, modelScalePercent: state.modelScalePercent,
      lighting: { ...state.lighting }, equipment: gear.settings, shield: shieldGear.settings
    }
  };
  invalidate(false);
  return result;
}

function directionalPreviewBounds(index) {
  const left = (index % 3) * state.width, top = Math.floor(index / 3) * state.height;
  let minX = left + state.width, minY = top + state.height, maxX = -1, maxY = -1;
  // Use the quantized silhouette so the sword and outline count toward the
  // displayed height, including pixels whose color matches the background.
  for (let y = top; y < top + state.height; y++) {
    for (let x = left; x < left + state.width; x++) {
      if (!atlasImage.data[(y * atlasCanvas.width + x) * 4 + 3]) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return null;
  const width = maxX - minX + 1, height = maxY - minY + 1;
  const displayHeight = Math.round(state.height / 2);
  const displayWidth = Math.round(width * displayHeight / height);
  return { x: minX, y: minY, width, height, displayWidth, displayHeight };
}

function drawDirectionalPreview(preview, bounds) {
  preview.context.fillStyle = '#808080';
  preview.context.fillRect(0, 0, preview.canvas.width, preview.canvas.height);
  if (!bounds) return;
  preview.context.drawImage(atlasCanvas, bounds.x, bounds.y, bounds.width, bounds.height,
    Math.round((preview.canvas.width - bounds.displayWidth) / 2),
    Math.round((preview.canvas.height - bounds.displayHeight) / 2), bounds.displayWidth, bounds.displayHeight);
}

function renderFallbackPreviews(timestamp) {
  const image = state.fallbackImage;
  previews.forEach(preview => {
    const ctx = preview.context;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, preview.canvas.width, preview.canvas.height);

    // QA Rev 62: draw one battlefield hex behind the fallback sprite so Model
    // Size changes have an immediate tactical scale reference.
    const resolutionScale = state.resolutionPercent / 100;
    const halfW = 32 * resolutionScale;
    const halfH = 21 * resolutionScale;
    const cx = preview.canvas.width / 2;
    const cy = preview.canvas.height * 0.72;
    ctx.save();
    ctx.strokeStyle = '#e3ca79';
    ctx.lineWidth = Math.max(1, resolutionScale);
    ctx.beginPath();
    [[0,-halfH],[halfW,-halfH/2],[halfW,halfH/2],[0,halfH],[-halfW,halfH/2],[-halfW,-halfH/2]]
      .forEach(([x,y],index) => index ? ctx.lineTo(cx+x,cy+y) : ctx.moveTo(cx+x,cy+y));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    if (image?.naturalWidth && image?.naturalHeight) {
      const scale = state.modelScalePercent / 100;
      const targetH = Math.max(1, Math.round(preview.canvas.height * 0.5 * scale));
      const targetW = Math.max(1, Math.round(image.naturalWidth * targetH / image.naturalHeight));
      const groundY = Math.round(cy + halfH * 0.1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image,
        Math.round((preview.canvas.width-targetW)/2),
        groundY-targetH,
        targetW,targetH);
    }
    preview.canvas.dataset.frame = String(state.frame + 1);
  });
  state.frame++;
  state.lastPreview = timestamp;
  state.previewsDirty = false;
}

function renderPreviews(timestamp) {
  if (state.spriteOnlyFallback) {
    renderFallbackPreviews(timestamp);
    return;
  }
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
  // Preview framing is display-only. Captures and PNG exports continue using
  // the original atlasSource and its shared camera, dimensions and anchors.
  quantizeRgba(atlasSource, atlasTarget.width, atlasTarget.height, atlasImage.data, pixelRenderOptions(true));
  atlasContext.putImageData(atlasImage, 0, 0);
  const currentBounds = previews.map((preview, index) => directionalPreviewBounds(index));
  // Rev 61 QA: the preview transform is established once from Ready frame 0.
  // Later animation poses move inside that fixed framing instead of re-zooming
  // whenever the silhouette becomes shorter or taller.
  if (!state.previewReferenceBounds) {
    state.previewReferenceBounds = currentBounds.map(box => box ? ({...box}) : null);
  }
  const referenceBounds = state.previewReferenceBounds;
  const previewWidth = Math.max(previews[0].canvas.width,
    ...referenceBounds.map(box => box ? Math.ceil(box.displayWidth * 1.05) : 0));
  previews.forEach((preview, index) => {
    if (preview.canvas.width !== previewWidth) {
      preview.canvas.width = previewWidth;
      preview.context.imageSmoothingEnabled = false;
    }
    const current = currentBounds[index], reference = referenceBounds[index];
    if (!current || !reference) drawDirectionalPreview(preview, current);
    else {
      const scale = reference.displayHeight / reference.height;
      const locked = {
        ...current,
        displayHeight: Math.max(1, Math.round(current.height * scale)),
        displayWidth: Math.max(1, Math.round(current.width * scale))
      };
      drawDirectionalPreview(preview, locked);
    }
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
    // Resizing the panel changes aspect only; preserve the user's current
    // framing, including the compensation from Model size changes.
    setCameraFrustum(mainCamera, width / height, mainCamera.top - mainCamera.bottom);
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
    state.heightDirty = true;
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
    if (!state.spriteOnlyFallback) {
      renderer.render(scene, mainCamera);
      updateHeightGuide(timestamp);
    }
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
      const path = normalizePath(file.studioRelativePath || file.webkitRelativePath || file.name);
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

function syncModelLibraryControls() {
  const busy = state.libraryLoading || state.modelLoading;
  ui.ModelLibrary.disabled = busy || !state.libraryModels.length;
  ui.LoadLibraryButton.disabled = !renderer || state.disposed || busy ||
    !state.libraryModels.some(model => model.id === ui.ModelLibrary.value);
  ui.LoadLibraryButton.textContent = state.libraryLoading ? 'Loading model…' : 'Load selected model';
}

async function loadModelLibrary() {
  try {
    const appRoot = new URL('../', import.meta.url);
    const response = await fetch(new URL('data/studio-models.json', appRoot), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Model library returned ${response.status}.`);
    const catalog = await response.json();
    if (catalog.version !== 1 || !Array.isArray(catalog.models)) throw new Error('Unsupported model library.');
    const ids = new Set();
    state.libraryModels = catalog.models.map(entry => {
      if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) ||
          typeof entry.label !== 'string' || !entry.label || typeof entry.file !== 'string' ||
          !['Y', 'Z'].includes(entry.upAxis)) throw new Error('Invalid model library entry.');
      const url = new URL(entry.file, appRoot);
      if (url.origin !== appRoot.origin || !url.pathname.startsWith(`${appRoot.pathname}assets/models/`) ||
          !/\.glb$/i.test(url.pathname)) throw new Error('Saved models must be GLB files in the model assets folder.');
      if (entry.mobType) spriteMob(entry.mobType);
      ids.add(entry.id);
      return { ...entry, url: url.href };
    });
    ui.ModelLibrary.replaceChildren(new Option('Choose a saved model…', ''),
      ...state.libraryModels.map(model => new Option(model.label, model.id)));
    if (state.libraryModels.some(model => model.id === state.libraryModelId)) ui.ModelLibrary.value = state.libraryModelId;
    ui.ModelLibraryStatus.textContent = state.libraryModels.length
      ? 'Choose a model, then load it to start a new sprite sheet.' : 'No saved models are available yet.';
  } catch (error) {
    state.libraryModels = [];
    ui.ModelLibrary.replaceChildren(new Option('Model library unavailable', ''));
    ui.ModelLibraryStatus.textContent = 'Saved models could not be listed. You can still load a model from your device.';
  }
  syncModelLibraryControls();
}

async function loadLibraryModel() {
  const entry = state.libraryModels.find(model => model.id === ui.ModelLibrary.value);
  if (!entry || !renderer || state.disposed || state.libraryLoading || state.modelLoading) return;
  const version = ++state.loadingVersion;
  state.libraryLoading = true;
  syncModelLibraryControls();
  clearError();
  status(`Downloading ${entry.label}…`);
  try {
    const response = await fetch(entry.url);
    if (!response.ok) throw new Error(`The saved model could not be downloaded (${response.status}). Please try again.`);
    const blob = await response.blob();
    if (version !== state.loadingVersion || state.disposed) return;
    const filename = new URL(entry.url).pathname.split('/').pop();
    await loadFiles([new File([blob], filename, { type: 'model/gltf-binary' })], { modelDefaults: entry });
  } catch (error) {
    if (version === state.loadingVersion && !state.disposed) {
      showError(error);
      status('Saved model could not be loaded · Previous model retained');
    }
  } finally {
    state.libraryLoading = false;
    syncModelLibraryControls();
  }
}

async function loadFiles(fileList, { restoreSettings = null, modelDefaults = null } = {}) {
  if (!renderer || state.disposed) {
    showError(new Error('The 3D viewer is unavailable. Your saved captures can still be exported.'));
    return false;
  }
  const files = [...fileList];
  const candidates = files.filter(file => /\.(glb|gltf|fbx)$/i.test(file.name));
  if (candidates.length !== 1) {
    showError(new Error('Choose one GLB, glTF, or FBX model, together with any texture and buffer files it needs.'));
    return false;
  }
  const version = ++state.loadingVersion;
  const file = candidates[0];
  const local = createLocalManager(files);
  let loaded;
  const previousModelReady = state.modelReady;
  state.modelLoading = true;
  setModelReady(false);
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
      return false;
    }
    loaded.name = restoreSettings?.modelName || modelDefaults?.label || loaded.name;
    await installModel(loaded, {
      restoreSettings, modelDefaults,
      sourceFiles: files.map(source => ({
        name: source.name, type: source.type, lastModified: source.lastModified,
        relativePath: source.studioRelativePath || source.webkitRelativePath || '', blob: source
      }))
    });
    return true;
  } catch (error) {
    if (loaded?.model !== state.model) disposeModel(loaded?.model);
    if (version === state.loadingVersion && !state.disposed) {
      showError(friendlyImportError(error));
      setModelReady(previousModelReady);
      status(restoreSettings ? 'Saved captures restored · Model could not be reopened' : 'Model could not be loaded · Previous model retained');
    }
    return false;
  } finally {
    local.revoke();
    ui.Files.value = '';
    if (version === state.loadingVersion) state.modelLoading = false;
    syncModelLibraryControls();
    updateEquipmentControls();
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
  ui.ModelLibrary.addEventListener('change', syncModelLibraryControls);
  ui.LoadLibraryButton.addEventListener('click', loadLibraryModel);
  ui.LoadButton.addEventListener('click', () => ui.Files.click());
  ui.Files.addEventListener('change', () => { if (ui.Files.files.length) loadFiles(ui.Files.files); });
  ui.DemoButton.addEventListener('click', async () => {
    ++state.loadingVersion;
    try { await installModel(makeDemo(), { isDemo: true }); }
    catch (error) { showError(error); }
  });
  ui.RightHandWeapon.addEventListener('change', () => {
    // Each weapon owns its own calibrated socket/grip preset. Do not carry the
    // previous weapon's transform into the newly selected asset.
    void changeEquipment(normalizeEquipment({ rightHand: ui.RightHandWeapon.value }), { fit: true });
  });
  ui.LeftHandShield.addEventListener('change',()=>{
    void changeShield(normalizeShield({leftHandShield:ui.LeftHandShield.value}),{fit:true});
  });
  for(const [control,key] of [
    [ui.ShieldScale,'sizePercent'],
    [ui.ShieldDistance,'distanceInches'],
    [ui.ShieldForearmSlide,'forearmSlideInches'],
    [ui.ShieldForearmRoll,'forearmRollDegrees']
  ]){
    control.addEventListener('input',()=>{
      const next=shieldEquipment.snapshot().settings;
      next[key]=control.valueAsNumber;
      void changeShield(next,{resetPose:false});
    });
  }
  ui.ResetShieldButton.addEventListener('click',()=>{
    void changeShield(normalizeShield({leftHandShield:shieldEquipment.snapshot().settings.leftHandShield}),{fit:true});
  });
  ui.WeaponSize.addEventListener('input', () => {
    void changeEquipment({ ...equipment.snapshot().settings, sizePercent: ui.WeaponSize.valueAsNumber });
  });
  for (const [name, key] of [['Position', 'position'], ['Rotation', 'rotation']]) {
    for (const [axis, index] of [['X', 0], ['Y', 1], ['Z', 2]]) {
      ui[`Weapon${name}${axis}`].addEventListener('change', event => {
        const next = equipment.snapshot().settings;
        next[key][index] = event.target.valueAsNumber;
        void changeEquipment(next);
      });
    }
  }
  ui.ResetEquipmentButton.addEventListener('click', () => {
    void changeEquipment(normalizeEquipment({ rightHand: equipment.snapshot().settings.rightHand }), { fit: true });
  });
  ui.FrameButton.addEventListener('click', fitModel);
  ui.FrameAnimationsButton.addEventListener('click', fitAllAnimations);
  ui.ResetViewButton.addEventListener('click', resetCamera);
  document.querySelectorAll('[data-studio-facing]').forEach(button => {
    button.addEventListener('click', () => { selectFacing(button.dataset.studioFacing); poseCapture?.saveWorkspace(); });
  });
  document.querySelectorAll('[data-studio-export]').forEach(button => {
    button.addEventListener('click', () => exportImage(button.dataset.studioExport));
  });
  ui.ExportSheetButton.addEventListener('click', () => exportImage());
  ui.Heading.addEventListener('input', () => {
    state.heading = Number(ui.Heading.value);
    ui.HeadingValue.textContent = `${state.heading}°`;
    if (calibration) calibration.rotation.y = THREE.MathUtils.degToRad(state.heading);
    poseCapture?.saveWorkspace();
    invalidate();
  });
  ui.UpAxis.addEventListener('change', () => {
    state.upAxis = ui.UpAxis.value;
    fitAllAnimations();
  });
  ui.Resolution.addEventListener('input', () => {
    if (poseCapture?.snapshot().captureCount) { updateSetupLabels(); return; }
    state.resolutionPercent = Number(ui.Resolution.value);
    changeSpriteFormat();
  });
  ui.Footprint.addEventListener('change', () => {
    if (poseCapture?.snapshot().captureCount) { updateSetupLabels(); return; }
    state.layoutId = spriteLayout(ui.Footprint.value).id;
    changeSpriteFormat({ refit: true });
  });
  ui.MobTarget.addEventListener('change', async () => {
    const mob = spriteMob(ui.MobTarget.value);
    state.mobType = mob.id;
    const hasSavedModel = state.libraryModels.some(model => model.mobType === mob.id);
    state.spriteOnlyFallback = !hasSavedModel && !!FALLBACK_SPRITES[mob.id];
    state.previewReferenceBounds = null;
    if (state.spriteOnlyFallback) {
      state.fallbackSrc = FALLBACK_SPRITES[mob.id];
      const image = new Image();
      image.src = new URL('../' + state.fallbackSrc, import.meta.url).href;
      try { await image.decode(); state.fallbackImage = image; } catch { state.fallbackImage = null; }
      ui.EmptyMessage.hidden = false;
      ui.EmptyMessage.textContent = '';
      ui.HeightRuler.hidden = true;
      ui.ModelHeight.hidden = true;
      if (state.model) state.model.visible = false;
      invalidate();
    } else {
      state.fallbackImage = null;
      state.fallbackSrc = '';
      if (state.model) state.model.visible = true;
      ui.EmptyMessage.hidden = !!state.modelReady;
      invalidate();
    }
    if (!poseCapture?.snapshot().captureCount) {
      state.layoutId = mob.defaultLayout;
      changeSpriteFormat({ refit: !state.spriteOnlyFallback });
    } else poseCapture.updateMetadata();
    syncCaptureLock(!!poseCapture?.snapshot().captureCount);
  });
  ui.ModelScale.addEventListener('input', () => {
    if (poseCapture?.snapshot().modelScaleAdjustable === false) { updateSetupLabels(); return; }
    const previousScalePercent = state.modelScalePercent;
    state.modelScalePercent = Math.min(STUDIO_MODEL_SCALE_MAX, validateSpriteModelScale(Number(ui.ModelScale.value)));
    applyModelSize(previousScalePercent);
    if (state.spriteOnlyFallback) invalidate();
    updateSetupLabels();
    poseCapture?.updateModelScale(state.modelScalePercent);
  });
  for (const [name, key, divisor] of [
    ['AmbientIntensity', 'ambientIntensity', 100], ['KeyIntensity', 'keyIntensity', 100],
    ['KeyElevation', 'keyElevation', 1], ['AmbientColor', 'ambientColor'],
    ['KeyColor', 'keyColor'], ['KeyDirection', 'keyDirection']
  ]) {
    ui[name].addEventListener(name === 'KeyDirection' ? 'change' : 'input', () => {
      if (poseCapture?.snapshot().captureCount) { updateLighting(); return; }
      state.lighting[key] = divisor ? Number(ui[name].value) / divisor : ui[name].value;
      updateLighting();
      poseCapture?.saveWorkspace();
    });
  }
  updateLighting();
  // Retired formats remain recoverable, but an empty sheet starts a current format.
  $('studioPoseSheetRows').addEventListener('click', useCurrentFormatAfterClear);
  $('studioClearPosesButton').addEventListener('click', useCurrentFormatAfterClear);
  const colorControls = [
    ['Brightness', 'brightness', 100, '%'],
    ['Contrast', 'contrast', 100, '%'],
    ['Hue', 'hue', 1, '°'],
    ['Saturation', 'saturation', 100, '%']
  ].map(([name, key, divisor, suffix]) => {
    const input = ui[name];
    input.value = String(state[key] * divisor);
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
  ui.Outline.value = String(state.outline);
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
  ui.Clip.addEventListener('change', () => { setClip(Number(ui.Clip.value)); poseCapture?.saveWorkspace(); });
  for (const [button, input] of [['RangeStartButton', 'RangeStart'], ['RangeEndButton', 'RangeEnd']]) {
    ui[button].addEventListener('click', () => {
      const context = animationRangeContext();
      if (!context || !state.modelReady) return;
      state.playing = false;
      state.action.paused = true;
      ui[input].value = String(Math.min(context.source.duration,
        Math.max(0, Number(((context.range?.start || 0) + state.action.time).toFixed(6)))));
      updateAnimationControls();
      poseCapture?.saveWorkspace();
    });
  }
  ui.AddRangeButton.addEventListener('click', () => {
    const context = animationRangeContext();
    if (!context || !state.modelReady) return;
    try {
      const name = ui.RangeName.value.trim();
      if (!name) throw new Error('Give this animation a name, such as Ready or Attack.');
      if (ui.RangeStart.value === '' || ui.RangeEnd.value === '') throw new Error('Enter both a start and an end time.');
      const { clip, range } = makeRangeClip({
        id: `range:${crypto.randomUUID()}`, name,
        sourceIndex: context.sourceIndex, sourceId: animationSourceId(context.source),
        start: Number(ui.RangeStart.value), end: Number(ui.RangeEnd.value)
      }, state.sourceClips);
      state.clips.push(clip);
      state.animationRanges.push(range);
      updateAnimationChoices(state.clips.length - 1);
      setClip(state.clips.length - 1);
      updateModelInfo();
      ui.RangeStatus.textContent = `Added ${name}. Select it from the Animation dropdown anytime.`;
      poseCapture?.saveWorkspace();
    } catch (error) { ui.RangeStatus.textContent = error.message || String(error); }
  });
  ui.RemoveRangeButton.addEventListener('click', () => {
    const context = animationRangeContext();
    if (!context?.range || !state.modelReady) return;
    const clip = state.action.getClip();
    setClip(context.sourceIndex);
    state.mixer.uncacheClip(clip);
    state.clips = state.clips.filter(item => item !== clip);
    state.animationRanges = state.animationRanges.filter(range => range.id !== context.range.id);
    updateAnimationChoices(context.sourceIndex);
    updateModelInfo();
    ui.RangeStatus.textContent = 'Range removed. Your captured sprites are still available.';
    poseCapture?.saveWorkspace();
  });
  ui.PlayButton.addEventListener('click', () => {
    state.playing = !state.playing;
    if (state.action) state.action.paused = !state.playing;
    updateAnimationControls();
    state.lastTick = 0;
    poseCapture?.saveWorkspace();
    invalidate();
  });
  ui.RestartButton.addEventListener('click', () => {
    if (!state.action) return;
    state.action.time = 0;
    state.mixer.update(0);
    updateAnimationControls();
    poseCapture?.saveWorkspace();
    invalidate();
  });
  ui.Speed.addEventListener('change', () => {
    if (state.action) state.action.timeScale = Number(ui.Speed.value);
    poseCapture?.saveWorkspace();
    invalidate();
  });
  ui.Timeline.addEventListener('input', () => {
    if (!state.action) return;
    state.playing = false;
    state.action.paused = true;
    state.action.time = Number(ui.Timeline.value) * state.action.getClip().duration;
    state.mixer.update(0);
    updateAnimationControls();
    poseCapture?.saveWorkspace();
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
    resizeObserver?.disconnect();
    visibilityObserver?.disconnect();
    orbit?.dispose();
    state.mixer?.stopAllAction();
    equipment.dispose();
    shieldEquipment.dispose();
    disposeModel(state.model);
    disposeModel(helpers);
    atlasTarget?.dispose();
    renderer?.dispose();
  });
}

function useCurrentFormatAfterClear() {
  if (!poseCapture?.snapshot().captureCount) {
    if (state.modelScalePercent > STUDIO_MODEL_SCALE_MAX) {
      const previousScalePercent = state.modelScalePercent;
      poseCapture.updateModelScale(STUDIO_MODEL_SCALE_MAX);
      state.modelScalePercent = STUDIO_MODEL_SCALE_MAX;
      applyModelSize(previousScalePercent);
      updateSetupLabels();
    }
    if (state.hexScalePercent !== SPRITE_HEX_SCALE_PERCENT) {
      const previousHexScale = state.hexScalePercent;
      state.hexScalePercent = SPRITE_HEX_SCALE_PERCENT;
      applyModelSize();
      rescaleModelView(state.hexScalePercent / previousHexScale);
      updateSetupLabels();
      poseCapture?.updateMetadata();
    }
    if (state.lighting.legacyRig) {
      state.lighting = { ...DEFAULT_LIGHTING };
      updateLighting();
      poseCapture?.updateMetadata();
    }
    if (!SPRITE_LAYOUT_PRESETS.some(layout => layout.id === state.layoutId)) {
      state.layoutId = spriteMob(state.mobType).defaultLayout;
      changeSpriteFormat({ refit: true });
    }
  }
  syncCaptureLock(!!poseCapture?.snapshot().captureCount);
}

function startViewer() {
  renderer = new THREE.WebGLRenderer({ canvas: ui.Canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.autoClear = false;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x808080);
  ambientLight = new THREE.AmbientLight(0xffffff, state.lighting.ambientIntensity);
  // Continue older partial sheets with exactly the light rig used for their
  // existing captures. New sheets always use the adjustable white defaults.
  legacyAmbientLight = new THREE.HemisphereLight(0xe5efff, 0x5b4634, 1.8);
  keyLight = new THREE.DirectionalLight(0xffffff, state.lighting.keyIntensity);
  scene.add(ambientLight, legacyAmbientLight, keyLight, keyLight.target);
  updateLighting();
  turntable = new THREE.Group();
  calibration = new THREE.Group();
  placement = new THREE.Group();
  upAxisGroup = new THREE.Group();
  turntable.add(calibration);
  calibration.add(placement);
  placement.add(upAxisGroup);
  scene.add(turntable);
  helpers = new THREE.Group();
  scene.add(helpers);
  rebuildFootprintGuide();
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
    setModelReady(false);
    showError(new Error('The 3D graphics context was interrupted. Reload the studio to restore the viewer.'));
    status('Graphics paused');
  });
}

function restoreWorkspaceValues({ settings = {}, style = {}, captureCount = 0 }) {
  try {
    state.layoutId = spriteLayout(settings.layout?.id || settings.layoutId || 'single').id;
    state.resolutionPercent = createSpriteLayoutMetadata(state.layoutId,
      settings.layout?.resolutionPercent || settings.resolutionPercent || 100).resolutionPercent;
  } catch { state.layoutId = 'single'; state.resolutionPercent = 100; }
  try { state.mobType = spriteMob(settings.mobType || 'kobold').id; }
  catch { state.mobType = 'kobold'; }
  try { state.modelScalePercent = validateSpriteModelScale(settings.modelScalePercent ?? 100); }
  catch { state.modelScalePercent = 100; }
  state.hexScalePercent = validateSpriteHexScale(settings.hexScalePercent);
  state.lighting = normalizedLighting(settings.lighting);
  if (!settings.lighting && captureCount) state.lighting.legacyRig = 'rev47';
  const size = spriteLayoutDimensions(state.layoutId, state.resolutionPercent);
  state.width = Number.isInteger(settings.width) && settings.width > 0 && settings.width <= 1024 ? settings.width : size.width;
  state.height = Number.isInteger(settings.height) && settings.height > 0 && settings.height <= 1024 ? settings.height : size.height;
  state.modelName = settings.modelName || 'Saved character';
  state.libraryModelId = typeof settings.libraryModelId === 'string' ? settings.libraryModelId : '';
  state.sourceFiles = Array.isArray(settings.sourceFiles) ? settings.sourceFiles : [];
  state.isDemo = settings.isDemo === true;
  // Source orientation is independent of the user's orientation correction.
  // Demo workspaces made before this field existed used the original Y-up mesh.
  state.demoSourceUpAxis = settings.demoSourceUpAxis === 'Z' ? 'Z' : 'Y';
  state.heading = Number.isFinite(settings.heading) ? settings.heading : 0;
  state.upAxis = settings.upAxis === 'Y' ? 'Y' : 'Z';
  state.facing = HEX_FACINGS.some(item => item.id === settings.facing) ? settings.facing : 'SE';
  for (const key of ['brightness', 'contrast', 'hue', 'saturation', 'outline']) {
    if (Number.isFinite(style[key])) state[key] = style[key];
  }
  ui.Heading.value = String(state.heading);
  ui.HeadingValue.textContent = `${state.heading}°`;
  ui.UpAxis.value = state.upAxis;
  ui.ModelName.textContent = state.modelName;
  ui.ModelInfo.textContent = 'Saved captures restored. Reopening the model…';
  updateSetupLabels();
}

async function start() {
  populateSetupControls();
  poseCapture = createPoseCapture({
    readPose: readCapturePose,
    getStyle: () => pixelRenderOptions(true),
    getWorkspaceSettings,
    onLockChange: syncCaptureLock,
    onError: showError,
    onStatus: status
  });
  setModelReady(false);
  // Read-only diagnostics support candidate QA without exposing mutable scene internals.
  window.adventureParty3DStudio = Object.freeze({
    snapshot: () => ({
      model: state.modelName, facing: state.facing,
      libraryModelId: state.libraryModelId,
      directions: HEX_FACINGS.map(item => item.id),
      previewSize: [previews[0].canvas.width, previews[0].canvas.height],
      sourceFrameSize: [state.width, state.height], frame: state.frame,
      animationTime: state.animationTime, playing: state.playing,
      clips: state.clips.map(clip => clip.name),
      animationClips: state.clips.map(clip => ({
        name: clip.name, duration: clip.duration, sourceId: animationSourceId(clip), fbx: clip.userData?.fbxAnimation || null
      })),
      selectedAnimation: state.action ? {
        index: Number(ui.Clip.value), sourceId: animationSourceId(state.action.getClip()),
        name: state.action.getClip().name, time: state.action.time, duration: state.action.getClip().duration
      } : null,
      activeAnimationCount: state.mixer?.stats.actions.inUse || 0,
      animationRanges: state.animationRanges.map(range => ({ ...range })),
      cameraElevation: THREE.MathUtils.radToDeg(CAMERA_ELEVATION),
      framingMode: state.framingMode, framingSamplesPerClip: state.framingSamplesPerClip,
      frameHeight: state.frameHeight, frameCenter: state.center.toArray(),
      layoutId: state.layoutId, resolutionPercent: state.resolutionPercent, mobType: state.mobType,
      modelScalePercent: state.modelScalePercent, hexScalePercent: state.hexScalePercent,
      heading: state.heading,
      upAxis: state.upAxis, demoSourceUpAxis: state.demoSourceUpAxis,
      lighting: { ...state.lighting },
      equipment: equipment.snapshot(),
      shield: shieldEquipment.snapshot(),
      renderSize: Object.values(spriteLayoutDimensions(state.layoutId, state.resolutionPercent, state.modelScalePercent, state.hexScalePercent)).slice(2),
      modelDisplayScale: placement?.scale.x || null,
      modelHeightFeet: state.heightFeet,
      modelWorldBounds: modelBounds ? { min: modelBounds.min.toArray(), max: modelBounds.max.toArray() } : null,
      heightRuler: {
        maxFeet: STUDIO_HEIGHT_RULER_FEET, feetPerHex: STUDIO_FEET_PER_HEX,
        worldUnitsPerFoot: studioWorldUnitsPerFoot(state.layoutId, state.frameHeight)
      },
      captureFrameHeight: pixelCamera ? pixelCamera.top - pixelCamera.bottom : null,
      modelView: mainCamera ? {
        position: mainCamera.position.toArray(), target: orbit.target.toArray(),
        quaternion: mainCamera.quaternion.toArray(), zoom: mainCamera.zoom,
        frameHeight: mainCamera.top - mainCamera.bottom,
        near: mainCamera.near, far: mainCamera.far
      } : null,
      footprintCellCount: footprintGuide ? footprintGuide.children.length / 2 : 0,
      footprintWorldCells: studioFootprintGuide(state.layoutId, HEX_FACINGS.findIndex(item => item.id === state.facing), state.frameHeight),
      lightPosition: keyLight?.position.toArray() || null,
      sourceFileCount: state.sourceFiles.length,
      ...poseCapture.snapshot()
    })
  });
  const query = new URLSearchParams(location.search);
  const fromCombat = query.get('studioRestore') === '1' || query.get('restore') === '1';
  let restored = null, restoreError = null;
  try { restored = await poseCapture.restore({ fromCombat }); }
  catch (error) { restoreError = error; }
  if (restored) {
    restoreWorkspaceValues(restored);
    if (state.modelScalePercent > STUDIO_MODEL_SCALE_MAX && poseCapture.snapshot().modelScaleAdjustable) {
      // Change saved render metadata together with the restored model size;
      // the captured source pixels and anchors must stay intact.
      poseCapture.updateModelScale(STUDIO_MODEL_SCALE_MAX);
      state.modelScalePercent = STUDIO_MODEL_SCALE_MAX;
      restored.settings = { ...restored.settings, modelScalePercent: STUDIO_MODEL_SCALE_MAX };
      updateSetupLabels();
    }
  }
  if (restored && fromCombat && restored.persisted !== false) {
    const url = new URL(location.href);
    url.searchParams.delete('studioRestore');
    url.searchParams.delete('restore');
    history.replaceState(null, '', url);
  }
  bindControls();
  void loadModelLibrary();
  try {
    startViewer();
    if (restored?.settings?.isDemo) {
      await installModel(makeDemo({ upAxis: state.demoSourceUpAxis }), { isDemo: true, restoreSettings: restored.settings });
    } else if (restored && state.sourceFiles.length) {
      const files = state.sourceFiles.map(source => {
        const file = new File([source.blob], source.name, { type: source.type, lastModified: source.lastModified });
        Object.defineProperty(file, 'studioRelativePath', { value: source.relativePath || '' });
        return file;
      });
      await loadFiles(files, { restoreSettings: restored.settings });
    } else if (restored?.captureCount) {
      setModelReady(false);
      ui.EmptyMessage.hidden = false;
      ui.EmptyMessage.textContent = 'Your captured sprites are restored below and ready to export.';
      ui.ModelInfo.textContent = 'Saved sprite set · Source model is not stored';
      status('Saved captures restored · Export or test the same sprite set');
    } else await installModel(makeDemo(), { isDemo: true, restoreSettings: restored?.settings || null, persist: !restoreError });
    useCurrentFormatAfterClear();
    selectFacing(state.facing);
    if (restoreError) {
      showError(restoreError);
      status('Studio ready · Automatic saving is unavailable');
    }
  } catch (error) {
    cancelAnimationFrame(state.raf);
    state.disposed = true;
    setModelReady(false);
    ui.EmptyMessage.hidden = false;
    ui.EmptyMessage.textContent = restored?.captureCount ? 'Your saved captures are available below for export.' : 'The 3D viewer could not start.';
    showError(new Error(`The 3D viewer could not start. ${error.message || error}`));
    status(restored?.captureCount ? 'Saved captures restored · 3D viewer unavailable' : '3D viewer unavailable');
  }
}

start().catch(error => { showError(error); status('Studio could not be initialized'); });
