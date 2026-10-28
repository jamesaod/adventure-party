import { unitSun, sunPosition, shadowMask } from './unit-sun-shadow.mjs?v=R238C169';
import { createGroundShadowMaterial, renderGroundShadow, shadowPixelsCanvas } from './ground-shadow-geometry.mjs?v=R238C169';
import { SPRITE_POSES } from './sprite-set-core.mjs?v=R238C176';
import * as THREE from 'three';
import { loadUploadedFbxAnimations, CARL_ANIMATION_RECIPE } from './repository-fbx-animations.mjs?v=R238C178';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { retargetHumanoidClip } from './mixamo-retarget.mjs?v=R238C140';
import { analyzeHumanoidRig } from './humanoid-rig.mjs?v=R238C101';
import {
  prepareStudioAnimations, sliceAnimationClip, freezeAnimationClip, animationOptionLabel, animationSourceId, restoreAnimationIndex
} from './studio-animations.mjs?v=R238C82';
import { HEX_FACINGS, CAMERA_ELEVATION, quantizeRgba } from './studio-core.mjs?v=R238C99';
import { preserveThinSpriteDetails } from './studio-thin-detail.mjs?v=R238C118';
import { applyWarriorRecolor, isWarriorRecolorModel, normalizeWarriorRecolor } from './warrior-recolor.mjs?v=R238C127';
import { createPoseCapture } from './studio-capture.mjs?v=R238C188';
import {
  SPRITE_LAYOUT_PRESETS, SPRITE_MOBS, SPRITE_RESOLUTION, SPRITE_MODEL_SCALE, SPRITE_HEX_SCALE_PERCENT, spriteLayout,
  spriteMob, spriteLayoutDimensions, spriteLayoutOffsets, createSpriteLayoutMetadata, validateSpriteModelScale, validateSpriteHexScale
} from './sprite-layouts.mjs?v=R238C95';
import {
  STUDIO_FEET_PER_HEX, STUDIO_HEIGHT_RULER_FEET, studioWorldUnitsPerFoot,
  studioModelHeightFeet, studioFootprintGuide, studioLightPosition
} from './studio-geometry.mjs?v=R238C94';
import {
  STUDIO_WEAPONS, STUDIO_OFF_HAND_WEAPONS, studioWeapon, weaponAssetUrl, normalizeEquipment, normalizeOffHandEquipment, createStudioEquipment
} from './studio-equipment.mjs?v=R238C176';
import {
  STUDIO_SHIELDS, normalizeShield, createStudioShield
} from './studio-shield.mjs?v=R238C176';
import { CROSS_LIMB_REPAIR, repairCrossLimbSkinning } from './studio-skinning.mjs?v=R238C105';
import { ORC_NATIVE_BIND_REBASE, rebaseOrcUal2Clips } from './studio-orc-native-bind.mjs?v=R238C106';

import {createStudioPoseLibrary} from './studio-pose-library.mjs?v=R238C188';
import {browserAuthoringStore} from './authoring-store.mjs?v=R238C188';
import {authoringWorkspaceSuffix,normalizePoseLibrary,portablePoseSample} from './pose-library.mjs?v=R238C188';
const authoringQuery=new URLSearchParams(location.search);
const authoringScoped=!!authoringWorkspaceSuffix(location.search);
if(authoringScoped&&authoringQuery.get('preview')==='1')document.documentElement.classList.add('studio-embedded');

// The six previews share one WebGL atlas; throttling its costly GPU readback
// and CPU palette pipeline leaves the main 3D viewport at browser refresh.
// Forced sprite captures/exports call renderPreviews directly, without throttle.
const LIVE_PREVIEW_FPS = 12;

const DEFAULT_LIGHTING = Object.freeze({
  ambientIntensity: 1, ambientColor: '#ffffff', keyIntensity: 2.3,
  keyColor: '#ffffff', keyElevation: 45, keyDirection: 'NW'
});

// The shared asset format still accepts older sizes up to 2000%.
const STUDIO_MODEL_SCALE_MAX = 1000;
const BATTLEFIELD_PIXELS_PER_INCH = 64 / (STUDIO_FEET_PER_HEX * 12);
const DEFAULT_OUTLINE_INCHES = 1 / BATTLEFIELD_PIXELS_PER_INCH; // 1 legacy battlefield pixel = 1.875 in

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
  'Canvas', 'Viewport', 'Files', 'LoadButton', 'AnimationFiles', 'LoadAnimationButton', 'DemoButton', 'ModelName',
  'ModelLibrary', 'LoadLibraryButton', 'ModelLibraryStatus', 'HairColor', 'MetalColor', 'RecolorDebug', 'RecolorPanel', 'RecolorStatus',
  'RightHandWeapon', 'LeftHandShield', 'ShieldStatus', 'ShieldScale', 'ShieldScaleValue', 'ShieldDistance', 'ShieldDistanceValue', 'ShieldForearmSlide', 'ShieldForearmSlideValue',
  'ShieldForearmRoll', 'ShieldForearmRollValue', 'ResetShieldButton', 'WeaponSize', 'WeaponSizeValue', 'EquipmentStatus', 'EquipmentLockNote', 'ResetEquipmentButton',
  'ShieldRotationX', 'ShieldRotationY', 'ShieldRotationZ',
  'ShieldRotationXValue', 'ShieldRotationYValue', 'ShieldRotationZValue',
  'OffHandWeapon', 'OffHandStatus', 'OffHandSize', 'OffHandSizeValue', 'ResetOffHandButton',
  'OffHandPositionX', 'OffHandPositionY', 'OffHandPositionZ',
  'OffHandPositionXValue', 'OffHandPositionYValue', 'OffHandPositionZValue',
  'OffHandRotationX', 'OffHandRotationY', 'OffHandRotationZ',
  'OffHandRotationXValue', 'OffHandRotationYValue', 'OffHandRotationZValue',
  'ShieldPositionX','ShieldPositionY','ShieldPositionZ','ShieldPositionXValue','ShieldPositionYValue','ShieldPositionZValue',
  'WeaponPositionX', 'WeaponPositionY', 'WeaponPositionZ',
  'WeaponPositionXValue', 'WeaponPositionYValue', 'WeaponPositionZValue',
  'WeaponRotationX', 'WeaponRotationY', 'WeaponRotationZ',
  'WeaponRotationXValue', 'WeaponRotationYValue', 'WeaponRotationZValue',
  'OffHandGripAlong', 'OffHandGripAlongValue', 'OffHandGripAcross', 'OffHandGripAcrossValue', 'OffHandGripDepth', 'OffHandGripDepthValue',
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
  unitPackage:null, poseLibrary:null, poseLibrarySignature:null,
  model: null, modelName: 'Studio mannequin', clips: [], sourceClips: [], animationRanges: [], mixer: null,
  action: null, playing: true, facing: 'SE', heading: 0, upAxis: 'Z',
  width: 160, height: 200, layoutId: 'single', resolutionPercent: 100, mobType: 'kobold',
  modelScalePercent: 100, hexScalePercent: SPRITE_HEX_SCALE_PERCENT, lighting: { ...DEFAULT_LIGHTING },
  sourceFiles: [], isDemo: true, demoSourceUpAxis: 'Z', modelReady: false,
  libraryModels: [], libraryModelId: '', libraryLoading: false, modelLoading: false,
  skinRepairReport: null, nativeBindReport: null, appearanceRecolor: {hair:'default',metal:'default'},
  brightness: 1, contrast: 1, hue: 0, saturation: 1, outlineInches: DEFAULT_OUTLINE_INCHES,
  loadingVersion: 0, frame: 0, animationTime: 0, lastPreview: -Infinity,
  mainDirty: true, previewsDirty: true, lastTick: 0, raf: 0, disposed: false,
  heightDirty: true, heightFeet: null, tPoseHeightFeet: null, lastHeightMeasure: -Infinity,
  viewVisible: true, frameHeight: 3.15, framingMode: 'pose', framingSamplesPerClip: 0,
  previewReferenceBounds: null, spriteOnlyFallback: false, fallbackImage: null, fallbackSrc: '',
  center: new THREE.Vector3(0, 1, 0)
};

let renderer, scene, mainCamera, pixelCamera, orbit, turntable, calibration;
let placement, upAxisGroup, helpers, footprintGuide, ambientLight, legacyAmbientLight, keyLight, modelFrame;
let atlasTarget, atlasSource, atlasImage;
let sunShadowMesh, sunShadowTexture, groundShadowMaterial;
const groundShadowCanvas=document.createElement('canvas');
let battlefieldSource,battlefieldImage,battlefieldWidth=1,battlefieldHeight=1;
let supersampleImage;
let resizeObserver, visibilityObserver, poseCapture, poseLibraryPanel;
let modelBounds = null, heightRulerLine;
let humanoidAnimationSourcesPromise = null;
const equipment = createStudioEquipment({
  THREE,
  loadAsset: async weapon => {
    const url = weaponAssetUrl(weapon, new URL('../', import.meta.url));
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
const offHandEquipment = createStudioEquipment({
  THREE, offHand:true,
  loadAsset: async weapon => (await new GLTFLoader().loadAsync(weaponAssetUrl(weapon,new URL('../',import.meta.url)).href)).scene,
  disposeObject:disposeModel,
  onChange:()=>{
    updateEquipmentControls();
    if(state.model)updateModelInfo();
    if(renderer)invalidate();
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
const battlefieldCanvas=document.createElement('canvas');
const battlefieldContext=battlefieldCanvas.getContext('2d',{willReadFrequently:true});
const supersampleCanvas=document.createElement('canvas');
const supersampleContext=supersampleCanvas.getContext('2d');
const previewGrassImage = new Image();
previewGrassImage.onload = () => invalidate();
previewGrassImage.src = new URL('../assets/terrain/grass-outdoors-tiles.png', import.meta.url).href;

const previews = HEX_FACINGS.map(facing => ({
  ...facing,
  canvas: $(`studioPreview${facing.id}`),
  context: $(`studioPreview${facing.id}`).getContext('2d', { alpha: false })
}));

function getWorkspaceSettings() {
  return {
    unitPackage:state.unitPackage,poseLibrary:state.poseLibrary,poseLibrarySignature:state.poseLibrarySignature,
    modelName: state.modelName, sourceFiles: state.sourceFiles, isDemo: state.isDemo,
    libraryModelId: state.libraryModelId,
    axeStanceRecipe:'neutral-bind-v2',
    animationRecipe: state.sourceClips.find(clip => clip.userData?.animationRecipe)?.userData.animationRecipe || null,
    equipmentAssetSha256: studioWeapon(equipment.snapshot().settings.rightHand)?.assetSha256 || null,
    demoSourceUpAxis: state.demoSourceUpAxis,
    layoutId: state.layoutId, resolutionPercent: state.resolutionPercent,
    layout: createSpriteLayoutMetadata(state.layoutId, state.resolutionPercent),
    mobType: state.mobType, width: state.width, height: state.height,
    modelScalePercent: state.modelScalePercent, hexScalePercent: state.hexScalePercent, lighting: { ...state.lighting },
    unitCalibration: {
      version: 1,
      mobType: state.mobType,
      modelId: state.libraryModelId || null,
      modelName: state.modelName || null,
      pose: 'T-Pose',
      modelScalePercent: state.modelScalePercent,
      measuredHeightInches: Number.isFinite(state.tPoseHeightFeet)
        ? Number((state.tPoseHeightFeet * 12).toFixed(2)) : null
    },
    equipment: equipment.snapshot().settings,
    shield: shieldEquipment.snapshot().settings,
    offHandEquipment: offHandEquipment.snapshot().settings,
    appearanceRecolor: { ...state.appearanceRecolor },
    heading: state.heading, upAxis: state.upAxis, frameHeight: state.frameHeight,
    center: state.center.toArray(), framingMode: state.framingMode,
    framingSamplesPerClip: state.framingSamplesPerClip,
    // Store the base transform. Model size is applied once when reopening it.
    placement: modelFrame ? { position: modelFrame.position.toArray(), scale: modelFrame.scale } : null,
    clipIndex: Number(ui.Clip.value), clipName: state.action?.getClip().name || 'T-Pose',
    clipSourceId: animationSourceId(state.action?.getClip()) || 't-pose', animationTimingVersion: 1,
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

function isTPoseSelected() {
  return state.modelReady && !state.action && String(ui.Clip?.value) === '-1';
}

function updateModelScaleAvailability() {
  // Model size is shared across all animations, not tied to T-Pose selection.
  // Edited captures are marked outdated and can be recaptured as usual.
  ui.ModelScale.disabled = !state.modelReady || state.spriteOnlyFallback || state.modelLoading || state.disposed;
  ui.ModelScale.title = 'Adjust model size in any pose. The setting is shared by every animation.';
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
  ui.FormatSummary.textContent = `Frame ${state.width} × ${state.height} · Sheet ${state.width * 6} × ${state.height * SPRITE_POSES.length}`;
  ui.ModelScale.value = String(state.modelScalePercent);
  ui.ModelScaleValue.textContent = `${state.modelScalePercent}%`;
  const size = spriteLayoutDimensions(state.layoutId, state.resolutionPercent, state.modelScalePercent, state.hexScalePercent);
  const renderWidth = Number(size.renderWidth.toFixed(2)), renderHeight = Number(size.renderHeight.toFixed(2));
  ui.BattlefieldSize.textContent = `Battlefield frame ${renderWidth} × ${renderHeight} px · Model size adjustable in every pose`;
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

function syncCaptureLock(_locked) {
  // Saved snapshots stay visible but become outdated after model-changing
  // edits. No captured pose may freeze the equipment/lighting/framing editor.
  const locked = false;
  for (const control of [ui.Footprint, ui.Resolution]) control.disabled = locked;
  for (const control of [ui.FrameButton, ui.FrameAnimationsButton, ui.Heading, ui.UpAxis].filter(Boolean)) {
    control.disabled = locked || !state.modelReady;
  }
  updateModelScaleAvailability();
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

function refreshRecolorControls(){
  const enabled=isWarriorRecolorModel(state.libraryModelId)&&state.modelReady;
  // Temporarily hide experimental recolor controls; preserve feature data.
  ui.RecolorPanel.hidden=true;
  ui.HairColor.value=state.appearanceRecolor.hair;
  ui.MetalColor.value=state.appearanceRecolor.metal;
  ui.RecolorDebug.value=state.appearanceRecolor.debug;
  ui.RecolorStatus.textContent=enabled
    ? 'Experimental selections on the actual 3D model. Default restores the original texture. Check for color spill before approving.'
    : '';
}

function updateEquipmentControls(locked = false) {
  const current = equipment.snapshot(), settings = current.settings;
  const shieldCurrent = shieldEquipment.snapshot(), shieldSettings = shieldCurrent.settings;
  const offHandCurrent=offHandEquipment.snapshot(), offHandSettings=offHandCurrent.settings;
  const busy = !state.modelReady || state.spriteOnlyFallback || state.modelLoading || current.loading || shieldCurrent.loading || offHandCurrent.loading || state.disposed;
  poseCapture?.setEquipmentBusy(current.loading||shieldCurrent.loading||offHandCurrent.loading);
  ui.RightHandWeapon.value = settings.rightHand;
  ui.RightHandWeapon.disabled = busy || locked;
  ui.LeftHandShield.value = shieldSettings.leftHandShield;
  const twoHandedWeapon = studioWeapon(settings.rightHand)?.handsRequired === 2;
  ui.LeftHandShield.disabled = busy || locked || twoHandedWeapon;
  ui.OffHandWeapon.value=offHandSettings.rightHand;
  ui.OffHandWeapon.disabled=busy||locked||twoHandedWeapon;
  const offHandDisabled=busy||locked||twoHandedWeapon||offHandSettings.rightHand==='none';
  ui.OffHandSize.value=String(offHandSettings.sizePercent);
  ui.OffHandSizeValue.textContent=`${offHandSettings.sizePercent}%`;
  ui.OffHandSize.disabled=offHandDisabled;
  ui.ResetOffHandButton.disabled=offHandDisabled;
  ui.OffHandStatus.textContent=offHandCurrent.error || (twoHandedWeapon
    ? 'Two-handed weapons use both hands.'
    : offHandCurrent.loading ? 'Loading off-hand weapon…'
    : 'One-handed weapons only. Selecting one replaces the shield.');
  for(const [name,key] of [['Position','position'],['Rotation','rotation']]){
    for(const [axis,index] of [['X',0],['Y',1],['Z',2]]){
      const input=ui[`OffHand${name}${axis}`], value=key==='position'?offHandEquipment.worldPosition()[index]:offHandSettings[key][index];
      input.value=String(value);input.disabled=offHandDisabled;
      ui[`OffHand${name}${axis}Value`].textContent=name==='Rotation' ? `${Math.round(value)}°` : value.toFixed(3);
    }
  }
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
  for(const [axis,index] of [['X',0],['Y',1],['Z',2]]){
    const field=ui[`ShieldRotation${axis}`],value=shieldSettings.rotation[index];
    field.value=String(value);
    field.disabled=shieldDisabled;
    ui[`ShieldRotation${axis}Value`].textContent=`${Math.round(value)}°`;
    field.setAttribute('aria-valuetext',`${Math.round(value)} degrees`);
  }
  for(const [axis,index] of [['X',0],['Y',1],['Z',2]]){
    const value=shieldEquipment.worldPosition()[index],field=ui[`ShieldPosition${axis}`];
    field.value=String(value);field.disabled=shieldDisabled;ui[`ShieldPosition${axis}Value`].textContent=value.toFixed(3);
  }
  ui.ResetShieldButton.disabled=shieldDisabled;
  ui.WeaponSize.value = String(settings.sizePercent);
  ui.WeaponSizeValue.textContent = `${settings.sizePercent}%`;
  ui.WeaponSize.disabled = busy || locked || settings.rightHand === 'none';
  for (const [name, key] of [['Position', 'position'], ['Rotation', 'rotation']]) {
    for (const [axis, index] of [['X', 0], ['Y', 1], ['Z', 2]]) {
      const field = ui[`Weapon${name}${axis}`];
      const value = key==='position'?equipment.worldPosition()[index]:settings[key][index];
      field.value = String(value);
      field.disabled = busy || locked || settings.rightHand === 'none';
      const formatted = name === 'Position' ? value.toFixed(3) : `${Math.round(value)}°`;
      ui[`Weapon${name}${axis}Value`].textContent = formatted;
      field.setAttribute('aria-valuetext', formatted);
    }
  }
  const offHandOffsets = settings.secondaryGripOffsetInches || [0,0,0];
  for (const [name,index] of [['Across',0],['Along',1],['Depth',2]]) {
    const input = ui[`OffHandGrip${name}`], output = ui[`OffHandGrip${name}Value`];
    const value = Number(offHandOffsets[index]) || 0;
    input.value = String(value);
    input.disabled = busy || locked || !studioWeapon(settings.rightHand)?.secondaryGrip;
    output.textContent = `${value > 0 ? '+' : ''}${value.toFixed(2)} in`;
  }
  ui.ResetEquipmentButton.disabled = busy || locked || settings.rightHand === 'none';
  ui.EquipmentStatus.classList.toggle('error', !!current.error);
  ui.EquipmentStatus.textContent = current.loading ? 'Loading weapon…' : current.error
    ? locked ? `${current.error} Reload the studio to retry without clearing your captures.` : current.error
    : current.twoHandedConstraint?.active ? (current.twoHandedConstraint.solved ? 'Two-handed grip active: right hand drives the weapon and left hand is constrained to the secondary grip.' : 'Two-handed grip is active, but the left hand cannot currently reach the secondary grip.')
    : current.attached ? `Equipped weapon follows the ${current.attachmentHand} hand in every animation.`
    : current.rightHandBone ? 'Choose a weapon to equip this model.'
    : 'Load a compatible rigged MOB model to equip a weapon.';
  ui.ShieldStatus.classList.toggle('error', !!shieldCurrent.error);
  ui.ShieldStatus.textContent = shieldCurrent.loading ? 'Loading wooden shield…' : shieldCurrent.error
    ? shieldCurrent.error
    : shieldCurrent.attached ? 'Wooden shield follows the left hand through the selected animation.'
    : shieldCurrent.leftHandBone ? 'Choose a left-hand shield for animation QA.'
    : 'Load a compatible rigged MOB model to use a left-hand shield.';
  ui.EquipmentLockNote.classList.toggle('locked', locked);
  ui.EquipmentLockNote.textContent = locked
    ? 'Equipment and grip are shared by this sheet. Clear all captured poses before changing them.'
    : 'Selected equipment is included in all six previews and new captures. Bows use the left hand.';
}

function readyClipIndex() {
  const preferredTwoHandedRest = state.clips.findIndex(clip => /^UAL2_2H_Rest_Candidate_0\.5s$/i.test(clip.name));
  if (preferredTwoHandedRest >= 0) return preferredTwoHandedRest;
  const twoHandedRest = state.clips.findIndex(clip => /^UAL2_2H_Rest_Candidate_/i.test(clip.name));
  if (twoHandedRest >= 0) return twoHandedRest;
  const explicit = state.clips.findIndex(clip => /^UAL2_Sword_Ready$/i.test(clip.name));
  return explicit >= 0 ? explicit : state.clips.findIndex(clip => /ready|rest/i.test(clip.name));
}

function resetPreviewReferenceToReady() {
  state.previewReferenceBounds = null;
  const index = readyClipIndex();
  if (index < 0 || !state.mixer) return;
  setClip(index);
  if (state.action) {
    state.action.time = 0;
    equipment.restoreConstraints(); state.mixer.update(0); equipment.applyConstraints();
    updateAnimationControls();
  }
}

// Catalog-driven per-rig weapon mounts. Current Carl and other humanoids keep
// their existing global weapon defaults; a model explicitly opts into a
// calibrated profile by ID. Changing gear or pressing Reset grip reapplies it.
function defaultEquipmentSettingsForModel(weaponId) {
  const entry = state.libraryModels.find(model => model.id === state.libraryModelId);
  const profile = entry?.weaponAttachmentProfiles?.find(profile => profile.weaponIds.includes(weaponId))
    || entry?.weaponAttachmentProfile;
  const defaults = normalizeEquipment({ rightHand: weaponId });
  return profile?.weaponId === weaponId || profile?.weaponIds?.includes(weaponId)
    ? normalizeEquipment({ ...defaults, position: [...profile.position], rotation: [...profile.rotation] })
    : defaults;
}

async function changeEquipment(value, { resetPose = true } = {}) {
  if (!state.modelReady || state.modelLoading) {
    updateEquipmentControls();
    return;
  }
  const model = state.model;
  const selectedWeapon = studioWeapon(value?.rightHand || value);
  if (selectedWeapon?.handsRequired === 2 && shieldEquipment.snapshot().settings.leftHandShield !== 'none') {
    await shieldEquipment.select('none');
  }
  if(selectedWeapon?.handsRequired===2)await offHandEquipment.select({});
  const changed = await equipment.select(value);
  if (state.disposed || state.model !== model) return;
  if (changed) {
    // Equipment is an attachment, not a scale input. Keep the body calibration
    // and capture framing unchanged when gear is equipped or removed.
    if (resetPose) {
      resetPreviewReferenceToReady();
      if (['bow','direct-fire'].includes(selectedWeapon?.poseProfileId) || ['wooden-staff','short-sword','dagger','wizard-staff-grip','sling'].includes(selectedWeapon?.id)) {
        const profileClip = (state.clips || []).findIndex(clip => clip.userData?.actionProfiles?.includes(selectedWeapon.poseProfileId));
        if (profileClip >= 0) {
          setClip(profileClip);
          const preview = selectedWeapon.previewPose;
          if (preview && preview.modelId === state.libraryModelId &&
              preview.animationId === state.clips[profileClip].userData?.studioAnimationId && state.action) {
            state.playing = false;
            state.action.paused = true;
            state.action.time = Math.min(preview.timeSeconds, state.action.getClip().duration);
            equipment.restoreConstraints(); state.mixer.update(0); equipment.applyConstraints();
            updateAnimationControls(); invalidate();
          }
        }
      }
    }
    // Existing poses retain their captured loadouts; this edit affects the next capture.
  }
  poseCapture?.saveWorkspace();
}

async function changeOffHand(value){
  if(!state.modelReady||state.modelLoading)return;
  const model=state.model;
  const next=studioWeapon(equipment.snapshot().settings.rightHand)?.handsRequired===2
    ? normalizeOffHandEquipment() : normalizeOffHandEquipment(value);
  if(next.rightHand!=='none')await shieldEquipment.select({});
  if(state.disposed||state.model!==model)return;
  await offHandEquipment.select(next);
  if(state.disposed||state.model!==model)return;
  // Keep each saved pose's independent off-hand transform.
  updateEquipmentControls();poseCapture?.saveWorkspace();
}

async function restoreProfileEquipment(settings,capture){
  if(!settings||!state.modelReady)return;
  const model=state.model;
  const primary=normalizeEquipment(settings.equipment||{});
  const off=studioWeapon(primary.rightHand)?.handsRequired===2 ? normalizeOffHandEquipment() : normalizeOffHandEquipment(settings.offHandEquipment||{});
  const shield=normalizeShield(studioWeapon(primary.rightHand)?.handsRequired===2||off.rightHand!=='none' ? {} : settings.shield||{});
  await Promise.all([equipment.select(primary),offHandEquipment.select(off),shieldEquipment.select(shield)]);
  if(state.disposed||state.model!==model)return;
  if(capture){
    const clipIndex=restoreAnimationIndex(state.clips,{clipSourceId:capture.clipSourceId,clipName:capture.clip,clipIndex:capture.clip==='T-Pose'?-1:undefined});
    setClip(clipIndex);state.playing=false;
    if(state.action){
      state.action.paused=true;state.action.time=Math.max(0,Math.min(capture.time,state.action.getClip().duration));
      equipment.restoreConstraints(); state.mixer.update(0); equipment.applyConstraints();
    }
    updateAnimationControls();
  }
  updateEquipmentControls();invalidate();
}

async function changeShield(value,{resetPose=true}={}){
  if(!state.modelReady||state.modelLoading){
    updateEquipmentControls();
    return;
  }
  const model=state.model;
  if(normalizeShield(value).leftHandShield!=='none'&&studioWeapon(equipment.snapshot().settings.rightHand)?.handsRequired===2){
    await equipment.select('none');
    if(state.disposed||state.model!==model)return;
  }
  if(normalizeShield(value).leftHandShield!=='none')await offHandEquipment.select({});
  const changed=await shieldEquipment.select(value);
  if(state.disposed||state.model!==model)return;
  if(changed){
    // Keep the shield transform already stored with each captured pose.
    // Shields follow the already-calibrated unit transform; they never refit it.
    if(resetPose)resetPreviewReferenceToReady();
  }
  updateEquipmentControls();
  poseCapture?.saveWorkspace();
}

function setModelReady(ready) {
  state.modelReady = ready;
  if(ui.RecolorPanel) refreshRecolorControls();
  state.heightDirty = true;
  if (!ready) { modelBounds = null; state.heightFeet = null; }
  ui.HeightRuler.toggleAttribute('hidden', !ready);
  ui.ModelHeight.hidden = !ready;
  ui.LoadButton.disabled = ui.DemoButton.disabled = !renderer || state.disposed;
  ui.LoadAnimationButton.disabled = !ready || state.spriteOnlyFallback || state.modelLoading || state.disposed;
  syncModelLibraryControls();
  if(ui.ResetViewButton)ui.ResetViewButton.disabled = !ready;
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
  for (const [key, max] of [['ambientIntensity', 5], ['keyIntensity', 5], ['keyElevation', 90]]) {
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
  if(renderer) configureBattlefieldAtlas();
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
  if (renderer && orbit && !state.raf && !state.disposed && !document.hidden && state.viewVisible) {
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
  const rig = analyzeHumanoidRig(state.model);
  const rigText = bones
    ? `${rig.family} rig · ${rig.mappedCoreRoles}/${rig.coreRoleCount} humanoid roles${rig.animationReady ? ' · animation ready' : ''}`
    : 'no humanoid rig';
  ui.ModelName.textContent = state.modelName;
  ui.ModelInfo.textContent = `${meshes} mesh${meshes === 1 ? '' : 'es'} · ${bones} bones · ${state.clips.length} animation${state.clips.length === 1 ? '' : 's'} · ${rigText}`;
}

function geometryBodyBounds(root, options = {}) {
  const attachments = [];
  root?.traverse(object => {
    if ((object.userData?.studioEquipment || object.userData?.studioShield) && object.parent) {
      attachments.push({ object, parent: object.parent });
    }
  });
  for (const { object, parent } of attachments) parent.remove(object);
  try {
    return geometryBounds(root, options);
  } finally {
    for (const { object, parent } of attachments) parent.add(object);
    root?.updateWorldMatrix(true, true);
  }
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
    // The visible height follows the currently animated silhouette, including
    // sword/shield attachments. They remain excluded from the separate T-Pose
    // body calibration used for physical unit height and framing.
    modelBounds = geometryBounds(state.model, { refreshSkinnedBounds: false });
    state.heightFeet = studioModelHeightFeet(modelBounds.max.y - modelBounds.min.y, state.layoutId, state.frameHeight);
    if (isTPoseSelected()) {
      const bodyBounds = geometryBodyBounds(state.model, { refreshSkinnedBounds: false });
      state.tPoseHeightFeet = studioModelHeightFeet(bodyBounds.max.y - bodyBounds.min.y, state.layoutId, state.frameHeight);
    }
    ui.ModelHeightValue.textContent = `${state.heightFeet.toFixed(1)} ft`;
    state.heightDirty = false;
    state.lastHeightMeasure = timestamp;
  }
  ui.ModelHeight.querySelector('small').textContent = isTPoseSelected()
    ? 'Current T-Pose silhouette · gear included'
    : 'Current animated silhouette · gear included · 10 ft / hex';
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
    // Scale and framing are calibrated from the animated body only. Equipment
    // may change the silhouette, but cannot change the unit's battlefield scale.
    const initial = geometryBodyBounds(normalized);
    const size = initial.getSize(new THREE.Vector3());
    const center = initial.getCenter(new THREE.Vector3());
    const scale = 2 / Math.max(size.y, Math.max(size.x, size.z) * 0.25, 0.001);
    normalized.scale.setScalar(scale);
    normalized.position.set(-center.x * scale, -initial.min.y * scale, -center.z * scale);
    const envelope = geometryBodyBounds(normalized);

    if (clips.length) {
      // Stop the active action before the temporary mixer binds. Each clip then
      // starts from the original rest values rather than blending with another.
      mixer?.stopAllAction();
      sampler = new THREE.AnimationMixer(model);
      envelope.union(geometryBodyBounds(normalized));
      for (const clip of clips) {
        const sampled = sampler.clipAction(clip).reset().setLoop(THREE.LoopOnce, 1).play();
        sampled.paused = true;
        sampled.clampWhenFinished = true;
        // Endpoints and midpoint included; extra space covers between-sample motion.
        const intervals = 48;
        for (let step = 0; step <= intervals; step++) {
          sampled.time = clip.duration * step / intervals;
          sampler.update(0);
          envelope.union(geometryBodyBounds(normalized));
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
  if (!state.model) return;
  applyModelFrame(measureModelFrame(state.model, [], { upAxis: state.upAxis }));
  poseCapture?.invalidateCaptures('Model framing changed');
  poseCapture?.saveWorkspace();
}

function fitAllAnimations() {
  if (!state.model) return;
  try {
    applyModelFrame(measureModelFrame(state.model, state.clips, {
      upAxis: state.upAxis, mixer: state.mixer, action: state.action
    }));
    updateAnimationControls();
    clearError();
    poseCapture?.invalidateCaptures('Animation framing changed');
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
  ui.Clip.replaceChildren(new Option('T-Pose (height calibration)', '-1'));
  state.clips.forEach((clip, clipIndex) => ui.Clip.add(new Option(animationOptionLabel(clip, clipIndex), String(clipIndex))));
  ui.Clip.value = String(index);
  ui.Clip.disabled = !state.model;
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
  equipment.restoreConstraints();
  state.mixer.stopAllAction();
  state.action = null;

  if (state.clips[index]) {
    state.action = state.mixer.clipAction(state.clips[index]);
    state.action.reset().setEffectiveWeight(1).setLoop(THREE.LoopRepeat, Infinity).play();
    state.action.timeScale = Number(ui.Speed.value) || 1;
    state.action.paused = !state.playing;
    state.mixer.update(0);
    equipment.applyConstraints();
    ui.Clip.value = String(index);
  } else {
    // A real bind/T-pose calibration mode. Do not apply procedural weapon IK:
    // body height and scale must be measured from the unmodified rig.
    const posed = new Set();
    state.model?.traverse(object => {
      if (object.isSkinnedMesh && object.skeleton && !posed.has(object.skeleton)) {
        posed.add(object.skeleton);
        object.skeleton.pose();
      }
    });
    state.model?.updateWorldMatrix(true, true);
    ui.Clip.value = '-1';
  }

  state.heightDirty = true;
  updateRangeEditor();
  updateAnimationControls();
  updateModelScaleAvailability();
  invalidate();
}

function updateAnimationControls() {
  updateEquipmentControls();
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

function installModel({ model, clips, name, demoSourceUpAxis = null, skinRepairReport = null, nativeBindReport = null }, {
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
  const isTwoHandedAuditionModel = modelDefaults?.id === 'dungeon-crawler-carl-v2-ual2-two-handed-audition'
    || restoreSettings?.libraryModelId === 'dungeon-crawler-carl-v2-ual2-two-handed-audition';
  if (isTwoHandedAuditionModel) {
    const source = sourceClips.find(clip => clip.name === 'UAL2_2H_Sword_Regular_Combo');
    if (source) {
      const restSamples=[0,0.5,1.0,1.5,2.0,2.5].filter(time=>time<=source.duration);
      const frozen=restSamples.map(time=>freezeAnimationClip(
        source,time,`UAL2_2H_Rest_Candidate_${time.toFixed(1)}s`
      ));
      availableClips.unshift(...frozen);
    }
  }
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
  offHandEquipment.setModel(null);
  if (state.model) upAxisGroup.remove(state.model);
  disposeModel(state.model);
  state.model = model;
  state.modelName = name;
  state.skinRepairReport = skinRepairReport;
  state.nativeBindReport = nativeBindReport;
  state.libraryModelId = restoreSettings?.libraryModelId || modelDefaults?.id || '';
  state.appearanceRecolor = normalizeWarriorRecolor(restoreSettings?.appearanceRecolor);
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
  state.playing = restoreSettings ? !!restoreSettings.playing : false;
  state.tPoseHeightFeet = Number.isFinite(restoreSettings?.unitCalibration?.measuredHeightInches)
    ? restoreSettings.unitCalibration.measuredHeightInches / 12 : null;
  ui.Heading.value = String(state.heading);
  ui.HeadingValue.textContent = `${state.heading}°`;
  ui.UpAxis.value = state.upAxis;
  model.traverse(object => {
    if (object.isSkinnedMesh) object.frustumCulled = false;
  });
  upAxisGroup.add(model);
  let clipIndex = restoreAnimationIndex(state.clips, restoreSettings);
  const preferredTwoHandedRest = state.clips.findIndex(clip => /^UAL2_2H_Rest_Candidate_0\.5s$/i.test(clip.name));
  const isTwoHandedAudition = isTwoHandedAuditionModel;
  const restoredTPose = !!restoreSettings && (
    restoreSettings.clipSourceId === 't-pose' ||
    restoreSettings.clipName === 'T-Pose' ||
    Number(restoreSettings.clipIndex) === -1
  );
  if (!restoredTPose && isTwoHandedAudition && preferredTwoHandedRest >= 0 && (clipIndex < 0 || !state.clips[clipIndex])) {
    clipIndex = preferredTwoHandedRest;
  } else if (!restoreSettings) {
    const firstQaClip = modelDefaults?.initialAnimation || modelDefaults?.retargetQa?.initialClip;
    const qaStartIndex = firstQaClip
      ? state.clips.findIndex(clip =>
        clip.name === firstQaClip || clip.userData?.retargetQa?.sourceClip === firstQaClip ||
        (clip.name.startsWith('QA Bone Direction + Hip Y — ') &&
         clip.name.endsWith(' — ' + firstQaClip)))
      : -1;
    const readyIndex = qaStartIndex >= 0 ? qaStartIndex
      : preferredTwoHandedRest >= 0 ? preferredTwoHandedRest
      : state.clips.findIndex(clip => /^UAL2_Sword_Ready$/i.test(clip.name));
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
    equipment.restoreConstraints(); state.mixer.update(0); equipment.applyConstraints();
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
  if(isWarriorRecolorModel(state.libraryModelId)) applyWarriorRecolor(THREE,model,state.appearanceRecolor);
  refreshRecolorControls();
  if (!restoreSettings) poseCapture?.reset(name, { persist: false });
  ui.EmptyMessage.hidden = true;
  setModelReady(true);
  clearError();
  if (skippedRanges) {
    ui.RangeStatus.textContent = `${skippedRanges} saved animation range${skippedRanges === 1 ? '' : 's'} could not be restored. Your captured sprites are still available.`;
    ui.AnimationRanges.open = true;
  }
  const repositoryClipCount = state.clips.filter(clip => clip.userData?.repositoryAnimationFamily).length;
  const skinNote = state.skinRepairReport?.correctedVertices ?
    ` · Skin weights repaired (${state.skinRepairReport.correctedVertices} vertices)` : '';
  const rebaseNote = state.nativeBindReport ? ' · Native Orc bind animation experiment (original weights)' : '';
  const qaNote = modelDefaults?.retargetQa
    ? ' · Experimental Carl→Orc ' + modelDefaults.retargetQa.mode + ' (unchanged Orc source)'
    : '';
  status((restoreSettings ? 'Saved studio restored · Your captures are ready to export or continue' :
    repositoryClipCount ? `Ready · ${repositoryClipCount} repository animation${repositoryClipCount === 1 ? '' : 's'} retargeted · All animations framed` :
    state.clips.length ? 'Ready · All animations framed for six synchronized views' : 'Ready · Static model loaded') + skinNote + rebaseNote + qaNote);
  if (!restoreSettings && persist) poseCapture?.saveWorkspace();
  const requestedEquipment=restoreSettings?.equipment || {};
  const requestedShield=restoreSettings?.shield || (!restoreSettings && nextMobType==='fighter'
    ? {leftHandShield:'round-wooden-shield'} : {leftHandShield:'none'});
  const requestedWeapon=studioWeapon(requestedEquipment?.rightHand);
  const normalizedShield=requestedWeapon?.handsRequired===2
    ? { ...requestedShield, leftHandShield:'none' }
    : requestedShield;
  return equipment.setModel(model,requestedEquipment).then(async weaponResult=>{
    const requestedOffHand=requestedWeapon?.handsRequired===2||normalizedShield.leftHandShield!=='none' ? {} : restoreSettings?.offHandEquipment||{};
    const offHandResult=await offHandEquipment.setModel(model,requestedOffHand);
    const shieldResult=await shieldEquipment.setModel(model,normalizedShield);
    if(!restoreSettings&&normalizedShield.leftHandShield!=='none')fitAllAnimations();
    updateEquipmentControls();
    return [weaponResult,shieldResult,offHandResult];
  });
}

function configureBattlefieldAtlas() {
  const size=spriteLayoutDimensions(state.layoutId,state.resolutionPercent,state.modelScalePercent,state.hexScalePercent);
  battlefieldWidth=Math.max(1,Math.round(size.renderWidth));
  battlefieldHeight=Math.max(1,Math.round(size.renderHeight));
  const width=battlefieldWidth*3,height=battlefieldHeight*2;
  battlefieldSource=new Uint8Array(width*height*4);
  battlefieldCanvas.width=width;
  battlefieldCanvas.height=height;
  battlefieldImage=battlefieldContext.createImageData(width,height);
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
  supersampleCanvas.width=width;
  supersampleCanvas.height=height;
  supersampleImage=supersampleContext.createImageData(width,height);
  previews.forEach(preview => {
    preview.canvas.width=200;
    preview.canvas.height=180;
    preview.canvas.style.width='200px';
    preview.canvas.style.height='180px';
    preview.context.imageSmoothingEnabled=false;
  });
  updateCaptureCamera();
  configureBattlefieldAtlas();
  state.lastPreview = -Infinity;
  invalidate();
}

function outlinePixelsForTarget(targetWidth = state.width, battlefieldFrameWidth = battlefieldWidth) {
  const battlefieldPixels = Math.max(0, state.outlineInches) * BATTLEFIELD_PIXELS_PER_INCH;
  const sourceScale = battlefieldFrameWidth > 0 ? targetWidth / battlefieldFrameWidth : 1;
  return battlefieldPixels * sourceScale;
}

function pixelRenderOptions(transparent = false, targetWidth = state.width, battlefieldFrameWidth = battlefieldWidth) {
  return {
    brightness: state.brightness, contrast: state.contrast,
    hue: state.hue, saturation: state.saturation,
    outline: outlinePixelsForTarget(targetWidth, battlefieldFrameWidth),
    outlineInches: state.outlineInches,
    transparent, tileWidth: targetWidth, tileHeight: state.height
  };
}

function renderBattlefieldAtlas() {
  if(!atlasSource||!supersampleImage||!battlefieldSource)return;

  // Convert the unquantized WebGL framebuffer to a normal top-down canvas.
  const sourceWidth=state.width*3,sourceHeight=state.height*2;
  const sourceStride=sourceWidth*4;
  for(let y=0;y<sourceHeight;y++){
    const from=(sourceHeight-1-y)*sourceStride;
    supersampleImage.data.set(atlasSource.subarray(from,from+sourceStride),y*sourceStride);
  }
  supersampleContext.putImageData(supersampleImage,0,0);

  // Downsample each facing independently BEFORE VGA quantization. This is the
  // key detail-preserving step: no palette pixels are discarded by shrinking.
  battlefieldContext.clearRect(0,0,battlefieldCanvas.width,battlefieldCanvas.height);
  battlefieldContext.imageSmoothingEnabled=true;
  battlefieldContext.imageSmoothingQuality='high';
  for(let index=0;index<HEX_FACINGS.length;index++){
    const sx=(index%3)*state.width;
    const sy=Math.floor(index/3)*state.height;
    const dx=(index%3)*battlefieldWidth;
    const dy=Math.floor(index/3)*battlefieldHeight;
    battlefieldContext.drawImage(
      supersampleCanvas,sx,sy,state.width,state.height,
      dx,dy,battlefieldWidth,battlefieldHeight
    );
  }

  // Store the supersampled result in framebuffer row order so the existing
  // quantizer/capture path remains identical to WebGL readback semantics.
  const downsampled=battlefieldContext.getImageData(
    0,0,battlefieldCanvas.width,battlefieldCanvas.height
  ).data;
  // Anti-aliased diagonal weapons may cover a fraction of a battlefield
  // pixel. Keep real opaque source detail before the VGA alpha threshold.
  preserveThinSpriteDetails(supersampleImage.data,state.width,state.height,
    downsampled,battlefieldWidth,battlefieldHeight);
  const targetWidth=battlefieldCanvas.width,targetHeight=battlefieldCanvas.height;
  const targetStride=targetWidth*4;
  for(let y=0;y<targetHeight;y++){
    const from=y*targetStride;
    const to=(targetHeight-1-y)*targetStride;
    battlefieldSource.set(downsampled.subarray(from,from+targetStride),to);
  }

  quantizeRgba(
    battlefieldSource,targetWidth,targetHeight,battlefieldImage.data,
    {
      ...pixelRenderOptions(true,battlefieldWidth,battlefieldWidth),
      tileWidth:battlefieldWidth,
      tileHeight:battlefieldHeight
    }
  );
  battlefieldContext.putImageData(battlefieldImage,0,0);
}

function combatScreenDisplayScale(){
  const viewportWidth=Math.max(320,Number(window.innerWidth)||1080);
  const viewportHeight=Math.max(480,Number(window.innerHeight)||720);

  // Mirror adventure-party.css / fitBattleCanvas(): combat screen padding,
  // fixed side panel, 5px grid gap, fixed header/log/command rows, and 10px
  // canvas-fit padding. The result is CSS pixels per battlefield canvas pixel.
  const screenWidth=Math.max(1,viewportWidth-20);
  const screenHeight=Math.max(1,viewportHeight-18);
  const compact=viewportWidth<=900;
  const stacked=viewportWidth<=680;
  const sideWidth=stacked?0:(compact?230:496);
  const mainGap=stacked?0:5;
  const battleWrapWidth=Math.max(1,screenWidth-sideWidth-mainGap);
  const fixedRows=62+106+48+(5*3);
  const battleWrapHeight=stacked?Math.max(430,screenHeight-fixedRows):Math.max(1,screenHeight-fixedRows);
  const availW=Math.max(1,battleWrapWidth-10);
  const availH=Math.max(1,battleWrapHeight-10);
  return Math.max(0.25,Math.min(availW/1080,availH/600));
}

function drawBattlefieldPreview(preview,index){
  const ctx=preview.context;
  ctx.fillStyle='#808080';
  ctx.fillRect(0,0,preview.canvas.width,preview.canvas.height);
  if(!battlefieldCanvas.width||!battlefieldCanvas.height)return;

  const ground=new THREE.Vector3(0,0,0).project(pixelCamera);
  const anchorX=(ground.x+1)*battlefieldWidth/2;
  const anchorY=(1-ground.y)*battlefieldHeight/2;
  const footprint=spriteLayoutOffsets(state.layoutId,index);
  const hexVertices=[[0,-21],[32,-10.5],[32,10.5],[0,21],[-32,10.5],[-32,-10.5]];
  const centers=footprint.map(({x,y})=>({x:64*(x+y/2),y:31.5*y}));

  // Match the CSS enlargement used by the real combat battlefield canvas.
  const scale=combatScreenDisplayScale();
  const originX=Math.round(preview.canvas.width/2);
  const originY=Math.round(preview.canvas.height/2+10);

  for(const center of centers){
    drawGrassPreviewPolygon(ctx,hexVertices.map(([vx,vy])=>({
      x:originX+(center.x+vx)*scale,
      y:originY+(center.y+vy)*scale
    })),scale);
  }

  const sx=(index%3)*battlefieldWidth,sy=Math.floor(index/3)*battlefieldHeight;
  unitSun.draw(ctx,battlefieldCanvas,{x:originX,y:originY,width:battlefieldWidth*scale,height:battlefieldHeight*scale,
    groundShadow:groundShadowCanvas,anchorX:anchorX/battlefieldWidth,anchorY:anchorY/battlefieldHeight,sx,sy,sw:battlefieldWidth,sh:battlefieldHeight,revision:state.frame});
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(
    battlefieldCanvas,sx,sy,battlefieldWidth,battlefieldHeight,
    originX-anchorX*scale,originY-anchorY*scale,
    battlefieldWidth*scale,battlefieldHeight*scale
  );
}

function updateSunShadowView(){
  const sun=sunPosition(unitSun.hour);
  sunShadowMesh.visible=sun.opacity>0&&state.modelReady&&!state.spriteOnlyFallback;
  if(!sunShadowMesh.visible)return;
  const index=HEX_FACINGS.findIndex(facing=>facing.id===state.facing);
  const mask=shadowMask(groundShadowCanvas,{sx:(index%3)*battlefieldWidth,sy:Math.floor(index/3)*battlefieldHeight,
    sw:battlefieldWidth,sh:battlefieldHeight,revision:state.frame-1});
  if(!mask){sunShadowMesh.visible=false;return;}
  if(!sunShadowTexture){
    sunShadowTexture=new THREE.CanvasTexture(mask);
    sunShadowTexture.magFilter=THREE.NearestFilter;sunShadowTexture.minFilter=THREE.NearestFilter;
    sunShadowMesh.material.map=sunShadowTexture;sunShadowMesh.material.needsUpdate=true;
  }else if(sunShadowTexture.image!==mask){sunShadowTexture.image=mask;sunShadowTexture.needsUpdate=true;}
  const ground=new THREE.Vector3(0,0,0).project(pixelCamera);
  const anchorX=(ground.x+1)*battlefieldWidth/2,anchorY=(1-ground.y)*battlefieldHeight/2;
  const units=(pixelCamera.top-pixelCamera.bottom)/battlefieldHeight;
  const points=sunShadowMesh.geometry.attributes.position;
  [[0,0],[battlefieldWidth,0],[0,battlefieldHeight],[battlefieldWidth,battlefieldHeight]].forEach(([px,py],i)=>{
    points.setXYZ(i,(px-anchorX)*units,0.004,(py-anchorY)*units/Math.sin(CAMERA_ELEVATION));
  });
  points.needsUpdate=true;sunShadowMesh.material.opacity=sun.opacity;
}

function renderFallbackCapture(capture){
  const index=state.clips.findIndex(clip=>animationSourceId(clip)===capture.clipSourceId);
  if(index<0)throw Error('Fallback animation is unavailable on this model.');
  const previous={index:Number(ui.Clip.value),time:state.action?.time||0,playing:state.playing};
  try{
    state.playing=false;setClip(index);state.action.paused=true;state.action.time=capture.time;
    equipment.restoreConstraints(); state.mixer.update(0); equipment.applyConstraints();
    return readCapturePose();
  }finally{
    setClip(previous.index);
    if(state.action){state.action.time=previous.time;equipment.restoreConstraints(); state.mixer.update(0); equipment.applyConstraints();}
    state.playing=previous.playing;updateAnimationControls();invalidate();
  }
}

function readCapturePose() {
  if (!state.modelReady || !state.model || state.disposed) throw new Error('Load a model before capturing a pose. Your saved sprites can still be exported.');
  if (!state.action) throw new Error('T-Pose is for height and model-size calibration only. Select an animation before capturing Ready, Attack, or Prone.');
  const gear = equipment.snapshot();
  const shieldGear = shieldEquipment.snapshot();
  const offHandGear=offHandEquipment.snapshot();
  if (gear.loading||offHandGear.loading||shieldGear.loading) throw new Error('Wait for equipment to finish loading before capturing a pose.');
  if(offHandGear.settings.rightHand!=='none'&&!offHandGear.attached)throw new Error(offHandGear.error||'The off-hand weapon is unavailable.');
  if(offHandGear.settings.rightHand!=='none'&&(shieldGear.settings.leftHandShield!=='none'||studioWeapon(gear.settings.rightHand)?.handsRequired===2))throw new Error('Off-hand weapons cannot be combined with a shield or two-handed primary weapon.');
  if (gear.settings.rightHand !== 'none' && !gear.attached) {
    throw new Error(gear.error || 'The equipped weapon is unavailable. Reload the studio before capturing another pose.');
  }
  if (shieldGear.settings.leftHandShield !== 'none' && !shieldGear.attached) {
    throw new Error(shieldGear.error || 'The equipped shield is unavailable. Reload the studio before capturing another pose.');
  }
  if (studioWeapon(gear.settings.rightHand)?.handsRequired===2 && shieldGear.settings.leftHandShield!=='none') {
    throw new Error('Two-handed weapons and shields are mutually exclusive. Unequip one before capturing.');
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
    battlefieldRaw:battlefieldSource.slice(),
    groundShadowRgba:groundShadowCanvas.getContext('2d').getImageData(0,0,groundShadowCanvas.width,groundShadowCanvas.height).data,
    battlefieldWidth,battlefieldHeight,
    battlefieldAnchorX:(ground.x+1)*battlefieldWidth/2,
    battlefieldAnchorY:(1-ground.y)*battlefieldHeight/2,
    layout: createSpriteLayoutMetadata(state.layoutId, state.resolutionPercent), mobType: state.mobType,
    modelScalePercent: state.modelScalePercent, hexScalePercent: state.hexScalePercent,
    renderWidth: size.renderWidth, renderHeight: size.renderHeight,
    unitCalibration: {
      version: 1, mobType: state.mobType, modelId: state.libraryModelId || null,
      modelName: state.modelName || null, pose: 'T-Pose',
      modelScalePercent: state.modelScalePercent,
      measuredHeightInches: Number.isFinite(state.tPoseHeightFeet)
        ? Number((state.tPoseHeightFeet * 12).toFixed(2)) : null
    },
    clip: state.action?.getClip().name || 'T-Pose',
    clipSourceId: animationSourceId(state.action?.getClip()) || state.action?.getClip().name || 't-pose',
    time: state.action?.time || 0,
    anchorX: (ground.x + 1) * state.width / 2,
    anchorY: (1 - ground.y) * state.height / 2,
    render: {
      model: state.modelName, heading: state.heading, upAxis: state.upAxis,
      cameraElevation: THREE.MathUtils.radToDeg(CAMERA_ELEVATION),
      frameHeight: state.frameHeight * state.modelScalePercent / 100 * state.hexScalePercent / 100,
      center: state.center.clone().multiplyScalar(state.modelScalePercent / 100 * state.hexScalePercent / 100).toArray(),
      framingMode: state.framingMode, modelScalePercent: state.modelScalePercent,
      lighting: { ...state.lighting }, equipment: gear.settings, shield: shieldGear.settings, offHandEquipment:offHandGear.settings
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
      if (atlasImage.data[(y * atlasCanvas.width + x) * 4 + 3] < 128) continue;
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

function drawGrassPreviewPolygon(ctx, points, lineWidth = 1) {
  if (!points?.length) return;
  const xs=points.map(point=>point.x), ys=points.map(point=>point.y);
  const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);

  ctx.save();
  ctx.beginPath();
  points.forEach((point,index) => index ? ctx.lineTo(point.x,point.y) : ctx.moveTo(point.x,point.y));
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle='#4d613e';
  ctx.fillRect(minX,minY,Math.max(1,maxX-minX),Math.max(1,maxY-minY));
  if (previewGrassImage.complete && previewGrassImage.naturalWidth > 0) {
    // Quiet combat-grass tile 16. The polygon clip supplies the tactical hex edge.
    ctx.imageSmoothingEnabled=true;
    ctx.drawImage(previewGrassImage,0,2*176,168,176,
      minX-0.6,minY-0.6,Math.max(1,maxX-minX)+1.2,Math.max(1,maxY-minY)+1.2);
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#e3ca79';
  ctx.lineWidth = Math.max(1,lineWidth);
  ctx.beginPath();
  points.forEach((point,index) => index ? ctx.lineTo(point.x,point.y) : ctx.moveTo(point.x,point.y));
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function previewFootprintAtlasPolygons(index) {
  if (!pixelCamera) return [];
  pixelCamera.updateMatrixWorld(true);
  const left=(index%3)*state.width;
  const top=Math.floor(index/3)*state.height;
  return studioFootprintGuide(state.layoutId,index,state.frameHeight).map(cell =>
    cell.vertices.map(vertex => {
      const projected=new THREE.Vector3(vertex.x,0.003,vertex.z).project(pixelCamera);
      return {
        x:left+(projected.x+1)*state.width/2,
        y:top+(1-projected.y)*state.height/2
      };
    })
  );
}

function drawProjectedPreviewFootprint(preview,bounds,index) {
  if (!bounds) return;
  const scale=bounds.displayHeight/bounds.height;
  const offsetX=(preview.canvas.width-bounds.displayWidth)/2;
  const offsetY=(preview.canvas.height-bounds.displayHeight)/2;
  const polygons=previewFootprintAtlasPolygons(index).map(points => points.map(point => ({
    x:offsetX+(point.x-bounds.x)*scale,
    y:offsetY+(point.y-bounds.y)*scale
  })));
  for (const polygon of polygons) drawGrassPreviewPolygon(preview.context,polygon,scale);
}

function drawFallbackPreviewFootprint(preview) {
  const resolutionScale=state.resolutionPercent/100;
  const halfW=32*resolutionScale;
  const halfH=21*resolutionScale;
  const cx=preview.canvas.width/2;
  const cy=preview.canvas.height*0.72;
  drawGrassPreviewPolygon(preview.context,
    [[0,-halfH],[halfW,-halfH/2],[halfW,halfH/2],[0,halfH],[-halfW,halfH/2],[-halfW,-halfH/2]]
      .map(([x,y])=>({x:cx+x,y:cy+y})),
    resolutionScale);
}

function drawDirectionalPreview(preview,bounds,index) {
  drawBattlefieldPreview(preview,index);
}

function renderFallbackPreviews(timestamp) {
  const image = state.fallbackImage;
  previews.forEach(preview => {
    const ctx = preview.context;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, preview.canvas.width, preview.canvas.height);

    drawFallbackPreviewFootprint(preview);
    const resolutionScale = state.resolutionPercent / 100;
    const halfH = 21 * resolutionScale;
    const cy = preview.canvas.height * 0.72;

    if (image?.naturalWidth && image?.naturalHeight) {
      ctx.imageSmoothingEnabled = false;
      const scale = state.modelScalePercent / 100;
      const targetH = Math.max(1, Math.round(preview.canvas.height * 0.5 * scale));
      const targetW = Math.max(1, Math.round(image.naturalWidth * targetH / image.naturalHeight));
      const groundY = Math.round(cy + halfH * 0.1);
      ctx.imageSmoothingEnabled = false;
      unitSun.draw(ctx,image,{x:preview.canvas.width/2,y:groundY,width:targetW,height:targetH});
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
  if(sunShadowMesh)sunShadowMesh.visible=false;
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
  // Reuse the same renderer/target after saving the untouched character atlas.
  renderer.clear(true,true,true);renderer.setScissorTest(true);
  for(let index=0;index<HEX_FACINGS.length;index++){
    const x=(index%3)*state.width,y=(1-Math.floor(index/3))*state.height;
    turntable.rotation.y=HEX_FACINGS[index].yawRadians;
    renderer.setViewport(x,y,state.width,state.height);renderer.setScissor(x,y,state.width,state.height);
    renderGroundShadow(renderer,scene,pixelCamera,groundShadowMaterial);
  }
  renderer.setScissorTest(false);
  const shadowRaw=new Uint8Array(atlasSource.length);
  renderer.readRenderTargetPixels(atlasTarget,0,0,atlasTarget.width,atlasTarget.height,shadowRaw);
  const shadowSource=shadowPixelsCanvas(shadowRaw,atlasTarget.width,atlasTarget.height);
  groundShadowCanvas.width=battlefieldWidth*3;groundShadowCanvas.height=battlefieldHeight*2;
  const shadowContext=groundShadowCanvas.getContext('2d');
  for(let index=0;index<HEX_FACINGS.length;index++){
    const col=index%3,row=Math.floor(index/3);
    shadowContext.drawImage(shadowSource,col*state.width,row*state.height,state.width,state.height,
      col*battlefieldWidth,row*battlefieldHeight,battlefieldWidth,battlefieldHeight);
  }
  renderer.setRenderTarget(null);
  scene.background = background;
  helpers.visible = true;
  renderer.setClearColor(0x808080, 1);
  turntable.rotation.y = HEX_FACINGS.find(item => item.id === state.facing).yawRadians;
  // Preview framing is display-only. Captures and PNG exports continue using
  // the original atlasSource and its shared camera, dimensions and anchors.
  quantizeRgba(atlasSource, atlasTarget.width, atlasTarget.height, atlasImage.data, pixelRenderOptions(true));
  atlasContext.putImageData(atlasImage, 0, 0);
  renderBattlefieldAtlas();
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
    if (!current || !reference) drawDirectionalPreview(preview,current,index);
    else {
      const scale = reference.displayHeight / reference.height;
      const locked = {
        ...current,
        displayHeight: Math.max(1, Math.round(current.height * scale)),
        displayWidth: Math.max(1, Math.round(current.width * scale))
      };
      drawDirectionalPreview(preview,locked,index);
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
    state.previewsDirty = true;
  }
}

function tick(timestamp) {
  state.raf = 0;
  if (state.disposed || document.hidden || !state.viewVisible) { state.lastTick = 0; return; }
  const delta = state.lastTick ? Math.min((timestamp - state.lastTick) / 1000, 0.1) : 0;
  state.lastTick = timestamp;
  if (state.playing && state.action) {
    equipment.restoreConstraints(); state.mixer.update(delta); equipment.applyConstraints(); // Restore clean authored pose, evaluate once, then constrain.
    state.mainDirty = true;
    state.previewsDirty = true;
    state.heightDirty = true;
    updateAnimationControls();
  }
  const moving = orbit.update();
  resizeRenderer();
  if (state.previewsDirty && timestamp - state.lastPreview >= 1000 / LIVE_PREVIEW_FPS) {
    renderPreviews(timestamp);
    state.mainDirty = true;
  }
  if (state.mainDirty || moving) {
    turntable.rotation.y = HEX_FACINGS.find(item => item.id === state.facing).yawRadians;
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, renderer.domElement.width, renderer.domElement.height);
    renderer.clear(true, true, true);
    if (!state.spriteOnlyFallback) {
      updateSunShadowView();
      renderer.render(scene, mainCamera);
      updateHeightGuide(timestamp);
    }
    state.mainDirty = false;
  }
  if ((state.playing && state.action) || moving || state.previewsDirty) requestFrame();
  else state.lastTick = 0;
}

async function loadAnimationFiles(fileList) {
  if (!state.modelReady || !state.model || state.modelLoading || state.disposed) {
    showError(new Error('Load a rigged model before importing animation FBX files.'));
    return false;
  }
  const files = [...fileList].filter(file => /\.fbx$/i.test(file.name));
  if (!files.length) {
    showError(new Error('Choose one or more FBX animation files.'));
    return false;
  }
  clearError();
  const added = [];
  try {
    for (const file of files) {
      status(`Loading animation ${file.name}…`);
      const buffer = await file.arrayBuffer();
      const parsed = new FBXLoader().parse(buffer, '');
      const clips = prepareStudioAnimations(parsed.animations || []);
      if (!clips.length) throw new Error(`${file.name} contains no usable animation clips.`);
      const base = file.name.replace(/\.fbx$/i, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
      clips.forEach((clip, index) => {
        const label = clips.length === 1 ? `Imported_${base}` : `Imported_${base}_${index + 1}`;
        const retargeted = retargetHumanoidClip(THREE, clip, parsed, state.model, label);
        state.sourceClips.push(retargeted);
        state.clips.push(retargeted);
        added.push(retargeted);
      });
      disposeModel(parsed);
    }
    const selected = state.clips.length - added.length;
    updateAnimationChoices(selected);
    setClip(selected);
    updateModelInfo();
    fitAllAnimations();
    poseCapture?.invalidateCaptures('Animation library changed');
    state.previewReferenceBounds = null;
    poseCapture?.saveWorkspace();
    const rig = analyzeHumanoidRig(state.model);
    status(`Added ${added.length} humanoid animation${added.length === 1 ? '' : 's'} · ${rig.mappedCoreRoles}/${rig.coreRoleCount} rig roles mapped · Select from Animation`);
    return true;
  } catch (error) {
    showError(friendlyImportError(error));
    status('Animation import failed · Existing model and animations retained');
    return false;
  } finally {
    ui.AnimationFiles.value = '';
  }
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

async function loadHumanoidAnimationSourceCatalog() {
  if (!humanoidAnimationSourcesPromise) {
    const appRoot = new URL('../', import.meta.url);
    humanoidAnimationSourcesPromise = fetch(new URL('data/humanoid-animation-sources.json', appRoot), { cache: 'no-cache' })
      .then(async response => {
        if (!response.ok) throw new Error(`Humanoid animation library returned ${response.status}.`);
        const catalog = await response.json();
        if (catalog.version !== 1 || !catalog.families || typeof catalog.families !== 'object') {
          throw new Error('Unsupported humanoid animation library.');
        }
        return catalog;
      })
      .catch(error => {
        humanoidAnimationSourcesPromise = null;
        throw error;
      });
  }
  return humanoidAnimationSourcesPromise;
}

async function loadRepositoryAnimationFamilies(targetModel, familyIds = []) {
  const requested = [...new Set(familyIds.filter(id => typeof id === 'string' && id))];
  if (!requested.length) return [];
  const appRoot = new URL('../', import.meta.url);
  const catalog = await loadHumanoidAnimationSourceCatalog();
  const retargeted = [];

  for (const familyId of requested) {
    const family = catalog.families[familyId];
    if (!family || typeof family.carrier !== 'string' || !Array.isArray(family.clips) || !family.clips.length) {
      throw new Error(`Unknown or invalid humanoid animation family: ${familyId}`);
    }
    const carrierUrl = new URL(family.carrier, appRoot);
    if (carrierUrl.origin !== appRoot.origin ||
        !carrierUrl.pathname.startsWith(`${appRoot.pathname}assets/models/`) ||
        !/\.glb$/i.test(carrierUrl.pathname)) {
      throw new Error(`Animation family ${familyId} must use a repository GLB carrier.`);
    }

    status(`Loading ${family.label || familyId} animation library…`);
    const response = await fetch(carrierUrl, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Animation carrier for ${familyId} returned ${response.status}.`);
    const sourceGltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
    try {
      const sourceClips = prepareStudioAnimations(sourceGltf.animations || []);
      for (const clipName of family.clips) {
        const sourceClip = sourceClips.find(clip => clip.name === clipName);
        if (!sourceClip) throw new Error(`Animation family ${familyId} is missing ${clipName}.`);
        const clip = retargetHumanoidClip(THREE, sourceClip, sourceGltf.scene, targetModel, clipName);
        clip.userData = {
          ...clip.userData,
          repositoryAnimationFamily: familyId,
          repositoryAnimationCarrier: family.carrier,
          repositoryAnimationSource: family.source || ''
        };
        retargeted.push(clip);
      }
    } finally {
      disposeModel(sourceGltf.scene);
    }
  }
  return retargeted;
}

// Controlled Rev 111 experiment. Both QA choices load the exact untouched
// New Orc GLB. Only the retarget mode changes; the one test clip and Carl
// donor GLB are identical. No skin-weight or bind-pose mutations are made.
async function loadRetargetQaClips(targetModel, experiment) {
  if (!experiment) return [];
  const appRoot = new URL('../', import.meta.url);
  const donorUrl = new URL(experiment.carrier, appRoot);
  status('Loading saved Carl animation as the Orc comparison donor…');
  const response = await fetch(donorUrl, { cache: 'force-cache' });
  if (!response.ok) throw new Error('Carl QA animation donor could not be loaded (' + response.status + ').');
  const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
  try {
    const sourceClips = prepareStudioAnimations(gltf.animations || []);
    const sourceByName = new Map(sourceClips.map(clip => [clip.name, clip]));
    return experiment.clips.map((sourceName, index) => {
      status(`Retargeting Orc QA animation ${index + 1}/${experiment.clips.length}: ${sourceName}…`);
      const sourceClip = sourceByName.get(sourceName);
      if (!sourceClip) throw new Error('Carl QA donor is missing the required clip: ' + sourceName);
      const variantName = experiment.mode === 'world-bind-delta' ? 'World Delta'
        : experiment.mode === 'anatomical-aim' ? 'Bone Direction + Hip Y' : 'Joint Relative';
      const label = 'QA ' + variantName + ' — ' + sourceName;
      const clip = retargetHumanoidClip(THREE, sourceClip, gltf.scene, targetModel,
        label, { mode: experiment.mode });
      if (clip.userData.humanoidImport.mappedTracks < 60 ||
          (experiment.mode === 'anatomical-aim' &&
            (!clip.userData.humanoidImport.hipYTransferred ||
             clip.userData.humanoidImport.aimedBoneRoles.length < 12))) {
        throw new Error('QA retarget rejected incompatible joint coverage or missing hip motion: ' + sourceName);
      }
      clip.userData = { ...clip.userData, retargetQa: {
        mode: experiment.mode, donor: experiment.carrier, sourceClip: sourceName
      } };
      return clip;
    });
  } finally {
    disposeModel(gltf.scene);
  }
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
    const attachmentProfiles = catalog.weaponAttachmentProfiles || {};
    if (!attachmentProfiles || typeof attachmentProfiles !== 'object' || Array.isArray(attachmentProfiles)) {
      throw new Error('Unsupported weapon attachment profile catalog.');
    }
    const ids = new Set();
    state.libraryModels = catalog.models.map(entry => {
      if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) ||
          typeof entry.label !== 'string' || !entry.label || typeof entry.file !== 'string' ||
          !['Y', 'Z'].includes(entry.upAxis)) throw new Error('Invalid model library entry.');
      const url = new URL(entry.file, appRoot);
      if (url.origin !== appRoot.origin || !url.pathname.startsWith(`${appRoot.pathname}assets/models/`) ||
          !/\.glb$/i.test(url.pathname)) throw new Error('Saved models must be GLB files in the model assets folder.');
      if (entry.mobType) spriteMob(entry.mobType);
      if (entry.skinWeightRepair !== undefined && entry.skinWeightRepair !== CROSS_LIMB_REPAIR) {
        throw new Error('Unsupported Model Library skin-weight repair profile.');
      }
      if (entry.animationBindRebase !== undefined && entry.animationBindRebase !== ORC_NATIVE_BIND_REBASE) {
        throw new Error('Unsupported Model Library native-bind animation profile.');
      }
      if (entry.animationBindRebase && entry.skinWeightRepair) {
        throw new Error('Diagnostic native-bind experiment must use original skin weights.');
      }
      if (entry.animationFamilies !== undefined &&
          (!Array.isArray(entry.animationFamilies) ||
           entry.animationFamilies.some(id => typeof id !== 'string' || !id))) {
        throw new Error('Saved model animationFamilies must be a non-empty string array.');
      }
      if (entry.retargetQa !== undefined) {
        const qa = entry.retargetQa;
        const qaUrl = new URL(qa?.carrier || '', appRoot);
        const singleClipProof = Array.isArray(qa?.clips) && qa.clips.length === 1 &&
          qa.clips[0] === 'Mixamo_sword_and_shield_attack' && qa.initialClip === undefined;
        const fullAnatomicalQa = qa?.mode === 'anatomical-aim' &&
          Array.isArray(qa?.clips) && qa.clips.length === 17 &&
          new Set(qa.clips).size === 17 &&
          qa.clips.every(name => /^Mixamo_[a-z0-9_]+$/.test(name)) &&
          qa.clips.includes('Mixamo_sword_and_shield_idle') &&
          qa.clips.includes('Mixamo_sword_and_shield_block_idle') &&
          qa.initialClip === 'Mixamo_sword_and_shield_idle';
        if (entry.file !== 'assets/models/orcs/new-orc/new-orc.glb' ||
            !['world-bind-delta','joint-bind-relative','anatomical-aim'].includes(qa?.mode) ||
            !(singleClipProof || fullAnatomicalQa) ||
            qaUrl.origin !== appRoot.origin ||
            !qaUrl.pathname.startsWith(appRoot.pathname + 'assets/models/') ||
            !/\.glb$/i.test(qaUrl.pathname) ||
            entry.skinWeightRepair || entry.animationBindRebase || entry.animationFamilies?.length) {
          throw new Error('Unsafe model library Orc retarget QA configuration.');
        }
      }
      let weaponAttachmentProfile = null;
      if (entry.weaponAttachmentProfileId !== undefined) {
        const profileId = entry.weaponAttachmentProfileId;
        const profile = attachmentProfiles[profileId];
        const validVector = (value, min, max) => Array.isArray(value) && value.length === 3 &&
          value.every(item => Number.isFinite(item) && item >= min && item <= max);
        const orcProfile = profileId === 'tripo-mixamo-orc-one-hand-sword-upward-v2' &&
          entry.id.startsWith('new-orc-') &&
          (entry.file === 'assets/models/orcs/new-orc/new-orc.glb' ||
           entry.file.startsWith('assets/models/orcs/new-orc/'));
        const warriorProfile = profileId === 'tripo-woman-warrior-one-hand-sword-v1' &&
          entry.id.startsWith('woman-warrior-') &&
          entry.file.startsWith('assets/models/humans/woman-warrior/');
        if (typeof profileId !== 'string' || !profile ||
            profile.weaponId !== 'medieval-sword' ||
            !validVector(profile.position, -1, 1) ||
            !validVector(profile.rotation, -180, 180) ||
            typeof profile.status !== 'string' ||
            !(orcProfile || warriorProfile)) {
          throw new Error('Invalid model-specific sword attachment profile.');
        }
        weaponAttachmentProfile = {
          weaponId: profile.weaponId,
          position: [...profile.position],
          rotation: [...profile.rotation]
        };
      }
      const profileIds = entry.weaponAttachmentProfileIds || [];
      if (!Array.isArray(profileIds) || new Set(profileIds).size !== profileIds.length) {
        throw new Error('Invalid model weapon attachment profile IDs.');
      }
      const assignedWeapons = new Set();
      const weaponAttachmentProfiles = profileIds.map(profileId => {
        const profile = attachmentProfiles[profileId];
        const validVector = (value, min, max) => Array.isArray(value) && value.length === 3 &&
          value.every(item => Number.isFinite(item) && item >= min && item <= max);
        if (typeof profileId !== 'string' || !Array.isArray(profile?.weaponIds) || !profile.weaponIds.length ||
            new Set(profile.weaponIds).size !== profile.weaponIds.length ||
            !validVector(profile.position, -1, 1) || !validVector(profile.rotation, -180, 180) ||
            typeof profile.status !== 'string' || profile.weaponIds.some(id => !studioWeapon(id) || assignedWeapons.has(id))) {
          throw new Error('Invalid model-specific weapon attachment profile.');
        }
        for (const id of profile.weaponIds) assignedWeapons.add(id);
        return { weaponIds: [...profile.weaponIds], position: [...profile.position], rotation: [...profile.rotation] };
      });
      ids.add(entry.id);
      return {
        ...entry, weaponAttachmentProfile, weaponAttachmentProfiles,
        animationFamilies: [...(entry.animationFamilies || [])], url: url.href
      };
    }).filter(entry => !catalog.studioModelIds || catalog.studioModelIds.includes(entry.id));
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

async function loadLibraryModel({restoreSettings=null} = {}) {
  const entry = state.libraryModels.find(model => model.id === ui.ModelLibrary.value);
  if(authoringScoped&&entry?.id!==authoringQuery.get('model')){showError(new Error('Choose the model in MOB Creator, then reopen its Studio workspace.'));return;}
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
    await loadFiles([new File([blob], filename, { type: 'model/gltf-binary' })], { modelDefaults: entry, restoreSettings });
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
    const effectiveModelDefaults = modelDefaults ||
      state.libraryModels.find(model => model.id === restoreSettings?.libraryModelId) || null;
    loaded.name = effectiveModelDefaults?.label || restoreSettings?.modelName || loaded.name;
    // Apply model-specific weight corrections before frame fitting, equipment, or animation.
    // This runs on the in-memory clone only; the original repository GLB is unchanged.
    if (effectiveModelDefaults?.skinWeightRepair) {
      loaded.skinRepairReport = repairCrossLimbSkinning(loaded.model, effectiveModelDefaults.skinWeightRepair);
    }
    if (effectiveModelDefaults?.animationBindRebase) {
      const referenceUrl = new URL('../data/ual2-carl-reference-bind.json', import.meta.url);
      const referenceResponse = await fetch(referenceUrl, { cache: 'force-cache' });
      if (!referenceResponse.ok) throw new Error('Cannot load saved Carl reference-pose data.');
      const reference = await referenceResponse.json();
      const rebased = rebaseOrcUal2Clips(THREE, loaded.model, loaded.clips, reference,
        effectiveModelDefaults.animationBindRebase);
      loaded.clips = rebased.clips;
      loaded.nativeBindReport = rebased.report;
    }

    if (effectiveModelDefaults?.animationLibrary === 'uploaded-fbx') {
      loaded.clips = await loadUploadedFbxAnimations({
        appRoot:new URL('../',import.meta.url),targetModel:loaded.model,FBXLoader,THREE,
        prepareStudioAnimations,retargetHumanoidClip,disposeModel,onStatus:status
      });
    }
    const repositoryClips = await loadRepositoryAnimationFamilies(
      loaded.model, effectiveModelDefaults?.animationFamilies || []
    );
    if (repositoryClips.length) {
      const existingNames = new Set((loaded.clips || []).map(clip => clip.name));
      loaded.clips = [
        ...(loaded.clips || []),
        ...repositoryClips.filter(clip => !existingNames.has(clip.name))
      ];
    }
    const qaClips = await loadRetargetQaClips(loaded.model, effectiveModelDefaults?.retargetQa);
    if (qaClips.length) loaded.clips = [...(loaded.clips || []), ...qaClips];

    await installModel(loaded, {
      restoreSettings, modelDefaults: effectiveModelDefaults,
      sourceFiles: files.map(source => ({
        name: source.name, type: source.type, lastModified: source.lastModified,
        relativePath: source.studioRelativePath || source.webkitRelativePath || '', blob: source
      }))
    });
    const equipmentAssetSha256 = studioWeapon(equipment.snapshot().settings.rightHand)?.assetSha256;
    if (restoreSettings && equipmentAssetSha256 &&
        restoreSettings.equipmentAssetSha256 !== equipmentAssetSha256) {
      poseCapture?.invalidateCaptures('Weapon texture updated');
      poseCapture?.saveWorkspace();
    }
    if(restoreSettings && restoreSettings.axeStanceRecipe!=='neutral-bind-v2'){
      const changedPoses=Object.entries(poseCapture.recipeProfiles()).flatMap(([groupId,poses])=>
        Object.entries(poses).filter(([,capture])=>capture.clipSourceId==='uploaded:staff-pose:0').map(([pose])=>({groupId,pose})));
      if(changedPoses.length)poseCapture.invalidateCaptures('Axe Stance corrected; recapture this pose',{changedPoses});
    }
    if (restoreSettings && effectiveModelDefaults?.animationLibrary === 'uploaded-fbx' &&
        restoreSettings.animationRecipe !== CARL_ANIMATION_RECIPE) {
      poseCapture?.invalidateCaptures('Carl animation recipe corrected');
      poseCapture?.saveWorkspace();
    }
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
  for(const [control,channel] of [[ui.HairColor,'hair'],[ui.MetalColor,'metal'],[ui.RecolorDebug,'debug']]){
    control.addEventListener('change',()=>{
      state.appearanceRecolor=normalizeWarriorRecolor({...state.appearanceRecolor,[channel]:control.value});
      if(state.model&&isWarriorRecolorModel(state.libraryModelId)){
        try {applyWarriorRecolor(THREE,state.model,state.appearanceRecolor);}
        catch(error){showError(error);return;}
        poseCapture?.invalidateCaptures('Appearance color changed');
        poseCapture?.saveWorkspace();
        invalidate();
      }
    });
  }
  ui.LoadLibraryButton.addEventListener('click', loadLibraryModel);
  ui.LoadButton.addEventListener('click', () => ui.Files.click());
  ui.Files.addEventListener('change', () => { if (ui.Files.files.length) loadFiles(ui.Files.files); });
  ui.LoadAnimationButton.addEventListener('click', () => ui.AnimationFiles.click());
  ui.AnimationFiles.addEventListener('change', () => { if (ui.AnimationFiles.files.length) void loadAnimationFiles(ui.AnimationFiles.files); });
  ui.DemoButton.addEventListener('click', async () => {
    ++state.loadingVersion;
    try { await installModel(makeDemo(), { isDemo: true }); }
    catch (error) { showError(error); }
  });
  ui.RightHandWeapon.addEventListener('change', () => {
    // Each weapon owns its own calibrated socket/grip preset. Do not carry the
    // previous weapon's transform into the newly selected asset.
    const weaponId = ui.RightHandWeapon.value;
    void changeEquipment(defaultEquipmentSettingsForModel(weaponId));

  });
  for(const weapon of STUDIO_OFF_HAND_WEAPONS){
    const option=document.createElement('option');option.value=weapon.id;option.textContent=weapon.label;ui.OffHandWeapon.append(option);
  }
  ui.OffHandWeapon.addEventListener('change',()=>void changeOffHand({rightHand:ui.OffHandWeapon.value}));
  ui.OffHandSize.addEventListener('input',()=>void changeOffHand({...offHandEquipment.snapshot().settings,sizePercent:ui.OffHandSize.valueAsNumber}));
  for(const [name,key] of [['Position','position'],['Rotation','rotation']]){
    for(const [axis,index] of [['X',0],['Y',1],['Z',2]]){
      ui[`OffHand${name}${axis}`].addEventListener('input',event=>{
        const next=key==='position'?offHandEquipment.withWorldPosition(index,event.target.valueAsNumber):offHandEquipment.snapshot().settings;
        if(key!=='position')next[key][index]=event.target.valueAsNumber;void changeOffHand(next);
      });
    }
  }
  ui.ResetOffHandButton.addEventListener('click',()=>void changeOffHand({rightHand:offHandEquipment.snapshot().settings.rightHand}));
  ui.LeftHandShield.addEventListener('change',()=>{
    void changeShield(normalizeShield({leftHandShield:ui.LeftHandShield.value}));
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
  for(const [axis,index] of [['X',0],['Y',1],['Z',2]]){
    ui[`ShieldRotation${axis}`].addEventListener('input',event=>{
      const next=shieldEquipment.snapshot().settings;
      next.rotation[index]=event.target.valueAsNumber;
      void changeShield(next,{resetPose:false});
    });
  }
  for(const [axis,index] of [['X',0],['Y',1],['Z',2]])ui[`ShieldPosition${axis}`].addEventListener('input',event=>{
    void changeShield(shieldEquipment.withWorldPosition(index,event.target.valueAsNumber),{resetPose:false});
  });
  ui.ResetShieldButton.addEventListener('click',()=>{
    void changeShield(normalizeShield({leftHandShield:shieldEquipment.snapshot().settings.leftHandShield}));
  });
  ui.WeaponSize.addEventListener('input', () => {
    void changeEquipment({ ...equipment.snapshot().settings, sizePercent: ui.WeaponSize.valueAsNumber });
  });
  for (const [name,index] of [['Across',0],['Along',1],['Depth',2]]) {
    ui[`OffHandGrip${name}`].addEventListener('input', event => {
      const next = equipment.snapshot().settings;
      next.secondaryGripOffsetInches[index] = event.target.valueAsNumber;
      void changeEquipment(next,{resetPose:false});
    });
  }
  for (const [name, key] of [['Position', 'position'], ['Rotation', 'rotation']]) {
    for (const [axis, index] of [['X', 0], ['Y', 1], ['Z', 2]]) {
      ui[`Weapon${name}${axis}`].addEventListener('input', event => {
        const next = key==='position'?equipment.withWorldPosition(index,event.target.valueAsNumber):equipment.snapshot().settings;
        if(key!=='position')next[key][index] = event.target.valueAsNumber;
        // Adjust only the held item live. Do not snap the animation to ready
        // while calibrating a grip in the middle of a sword swing.
        void changeEquipment(next, { resetPose: false });
      });
    }
  }
  ui.ResetEquipmentButton.addEventListener('click', () => {
    void changeEquipment(defaultEquipmentSettingsForModel(equipment.snapshot().settings.rightHand));
  });



  document.querySelectorAll('[data-studio-facing]').forEach(button => {
    button.addEventListener('click', () => { selectFacing(button.dataset.studioFacing); poseCapture?.saveWorkspace(); });
  });
  document.querySelectorAll('[data-studio-export]').forEach(button => {
    button.addEventListener('click', () => exportImage(button.dataset.studioExport));
  });
  ui.ExportSheetButton.addEventListener('click', () => exportImage());
  ui.Heading.addEventListener('input', () => {
    poseCapture?.invalidateCaptures('Model front direction changed');
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
    state.resolutionPercent = Number(ui.Resolution.value);
    poseCapture?.invalidateCaptures('Sprite resolution changed');
    changeSpriteFormat();
  });
  ui.Footprint.addEventListener('change', () => {
    state.layoutId = spriteLayout(ui.Footprint.value).id;
    poseCapture?.invalidateCaptures('Sprite footprint changed');
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
    poseCapture?.invalidateCaptures('Sprite target changed');
    state.layoutId = mob.defaultLayout;
    changeSpriteFormat({ refit: !state.spriteOnlyFallback });
    syncCaptureLock(!!poseCapture?.snapshot().captureCount);
  });
  ui.ModelScale.addEventListener('input', () => {
    if (!state.modelReady || state.spriteOnlyFallback || state.modelLoading || state.disposed) {
      updateSetupLabels();
      updateModelScaleAvailability();
      return;
    }
    const previousScalePercent = state.modelScalePercent;
    state.modelScalePercent = Math.min(STUDIO_MODEL_SCALE_MAX, validateSpriteModelScale(Number(ui.ModelScale.value)));
    // Preserve the T-Pose body-height calibration even when scaling in another
    // animation. The pose itself remains selected and continues playing.
    if (Number.isFinite(state.tPoseHeightFeet) && previousScalePercent > 0) {
      state.tPoseHeightFeet *= state.modelScalePercent / previousScalePercent;
    }
    applyModelSize(previousScalePercent);
    if (state.spriteOnlyFallback) invalidate();
    updateSetupLabels();
    poseCapture?.invalidateCaptures('Model scale changed');
    poseCapture?.updateModelScale(state.modelScalePercent);
    poseCapture?.saveWorkspace();
  });
  for (const [name, key, divisor] of [
    ['AmbientIntensity', 'ambientIntensity', 100], ['KeyIntensity', 'keyIntensity', 100],
    ['KeyElevation', 'keyElevation', 1], ['AmbientColor', 'ambientColor'],
    ['KeyColor', 'keyColor'], ['KeyDirection', 'keyDirection']
  ]) {
    ui[name].addEventListener(name === 'KeyDirection' ? 'change' : 'input', () => {
      state.lighting[key] = divisor ? Number(ui[name].value) / divisor : ui[name].value;
      poseCapture?.invalidateCaptures('Lighting changed');
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
  ui.Outline.value = String(state.outlineInches);
  ui.ResetColorsButton.addEventListener('click', () => {
    colorControls.forEach(({ input, update }) => { input.value = input.defaultValue; update(); });
    poseCapture?.updateStyle(pixelRenderOptions(true));
    invalidate();
  });
  const updateOutline = () => {
    state.outlineInches = Math.max(0, Number(ui.Outline.value));
    const battlefieldPixels = state.outlineInches * BATTLEFIELD_PIXELS_PER_INCH;
    ui.OutlineValue.textContent = state.outlineInches
      ? `${Number(state.outlineInches.toFixed(3))} in · ${battlefieldPixels.toFixed(2)} px`
      : '0 in (off)';
    ui.Outline.setAttribute('aria-valuetext', state.outlineInches
      ? `${Number(state.outlineInches.toFixed(3))} inches, ${battlefieldPixels.toFixed(2)} battlefield pixels`
      : 'Off');
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
    equipment.restoreConstraints(); state.mixer.update(0); equipment.applyConstraints();
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
    equipment.restoreConstraints(); state.mixer.update(0); equipment.applyConstraints();
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
    offHandEquipment.dispose();
    disposeModel(state.model);
    disposeModel(helpers);
    sunShadowTexture?.dispose();
    groundShadowMaterial?.dispose();
    if(sunShadowMesh){sunShadowMesh.geometry.dispose();sunShadowMesh.material.dispose();}
    atlasTarget?.dispose();
    renderer?.dispose();
  });
}

function useCurrentFormatAfterClear() {
  if (!poseCapture?.snapshot().totalCaptureCount) {
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
  groundShadowMaterial=createGroundShadowMaterial();
  sunShadowMesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
  sunShadowMesh.frustumCulled=false;sunShadowMesh.visible=false;
  scene.add(sunShadowMesh);
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
  state.unitPackage=settings.unitPackage||null;
  state.poseLibrary=settings.poseLibrary?normalizePoseLibrary(settings.poseLibrary):null;
  state.poseLibrarySignature=settings.poseLibrarySignature||null;
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
  state.width = Number.isInteger(settings.width) && settings.width > 0 && settings.width <= 4096 ? settings.width : size.width;
  state.height = Number.isInteger(settings.height) && settings.height > 0 && settings.height <= 4096 ? settings.height : size.height;
  state.modelName = settings.modelName || 'Saved character';
  state.libraryModelId = typeof settings.libraryModelId === 'string' ? settings.libraryModelId : '';
  state.appearanceRecolor = normalizeWarriorRecolor(settings.appearanceRecolor);
  state.sourceFiles = Array.isArray(settings.sourceFiles) ? settings.sourceFiles : [];
  state.isDemo = settings.isDemo === true;
  // Source orientation is independent of the user's orientation correction.
  // Demo workspaces made before this field existed used the original Y-up mesh.
  state.demoSourceUpAxis = settings.demoSourceUpAxis === 'Z' ? 'Z' : 'Y';
  state.heading = Number.isFinite(settings.heading) ? settings.heading : 0;
  state.upAxis = settings.upAxis === 'Y' ? 'Y' : 'Z';
  state.facing = HEX_FACINGS.some(item => item.id === settings.facing) ? settings.facing : 'SE';
  for (const key of ['brightness', 'contrast', 'hue', 'saturation']) {
    if (Number.isFinite(style[key])) state[key] = style[key];
  }
  if (Number.isFinite(style.outlineInches)) state.outlineInches = Math.max(0, style.outlineInches);
  else if (Number.isFinite(style.outline)) {
    // Older workspaces stored a hard battlefield pixel width.
    state.outlineInches = Math.max(0, style.outline) / BATTLEFIELD_PIXELS_PER_INCH;
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
    renderFallback:renderFallbackCapture,
    getStyle: () => pixelRenderOptions(true),
    getWorkspaceSettings,
    onProfileChange:restoreProfileEquipment,
    onCapture:(profile,pose)=>{if(!poseLibraryPanel)throw Error('Wait for Action Pose Capture to finish loading.');poseLibraryPanel.recordCapture(profile,pose);},
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
      skinRepair: state.skinRepairReport ? { ...state.skinRepairReport } : null,
      nativeBindExperiment: state.nativeBindReport ? { ...state.nativeBindReport } : null,
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
      offHandEquipment:offHandEquipment.snapshot(),
      appearanceRecolor: { ...state.appearanceRecolor },
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
  await loadModelLibrary();
  let linkedLibrary=null;
  if(authoringScoped){
    const store=browserAuthoringStore(),mob=store.mob(query.get('mob'));
    if(query.has('mob')&&!mob)throw Error('MOB draft not found. Save it in MOB Creator before opening Studio.');
    if(mob&&mob.modelId!==query.get('model'))throw Error('MOB model changed. Reopen Studio from MOB Creator.');
    state.unitPackage=mob;
    linkedLibrary=mob?.references.poseLibrary||store.library(query.get('poseLibrary'));
    if(!state.libraryModels.some(model=>model.id===query.get('model')))throw Error('The requested model is not in the Studio catalog.');
    if(mob){
      const back=document.createElement('a');back.href='./mob-creator.html?mob='+encodeURIComponent(mob.id);back.textContent='Return to MOB Creator';back.className='studio-button';document.querySelector('.studio-header').append(back);
      const test=document.getElementById('studioTestCombatButton');test.title='Export this MOB package for repository combat integration.';
      ui.MobTarget.closest('.studio-field').hidden=true;ui.Footprint.closest('.studio-field').hidden=true;
      ui.LoadButton.hidden=true;ui.Files.hidden=true;
      document.getElementById('studioWorkspaceStatus').textContent='This MOB has its own model workspace. Export its ZIP for repository integration.';
      if(!restored){state.layoutId=mob.mob.footprint;updateSetupLabels();}
    }
  }
  if (restored?.settings?.libraryModelId === 'dungeon-crawler-carl-v2') {
    restored.settings = {...restored.settings,libraryModelId:'dungeon-crawler-carl-v3',
      modelName:'Dungeon Crawler Carl Ver 3',animationRanges:[],clipName:'Sword And Shield Idle',
      clipSourceId:'uploaded:sword-and-shield-idle:0',clipIndex:8};
    poseCapture?.invalidateCaptures('Carl Ver 3 uses the newly uploaded animations');
  }
  const offeredModel = state.libraryModels.some(model => model.id === restored?.settings?.libraryModelId);
  if (restored && !offeredModel && !restored.captureCount) restored = null;
  try {
    startViewer();
    if (restored?.settings?.isDemo && offeredModel) {
      await installModel(makeDemo({ upAxis: state.demoSourceUpAxis }), { isDemo: true, restoreSettings: restored.settings });
    } else if (restored && offeredModel && state.sourceFiles.length) {
      const files = state.sourceFiles.map(source => {
        const file = new File([source.blob], source.name, { type: source.type, lastModified: source.lastModified });
        Object.defineProperty(file, 'studioRelativePath', { value: source.relativePath || '' });
        return file;
      });
      await loadFiles(files, { restoreSettings: restored.settings });
    } else if (restored && offeredModel) {
      ui.ModelLibrary.value=restored.settings.libraryModelId;
      await loadLibraryModel({restoreSettings:restored.settings});
    } else if (restored?.captureCount) {
      setModelReady(false);
      ui.EmptyMessage.hidden = false;
      ui.EmptyMessage.textContent = 'Your captured sprites are restored below and ready to export.';
      ui.ModelInfo.textContent = 'Saved sprite set · Source model is not stored';
      status('Saved captures restored · Export or test the same sprite set');
    } else if (authoringScoped) {
      ui.ModelLibrary.value=query.get('model');
      await loadLibraryModel();
    } else if (state.libraryModels.length === 1) {
      ui.ModelLibrary.value = state.libraryModels[0].id;
      await loadLibraryModel();
    } else await installModel(makeDemo(), { isDemo: true, restoreSettings: restored?.settings || null, persist: !restoreError });
    if(state.unitPackage&&state.layoutId!==state.unitPackage.mob.footprint){state.layoutId=state.unitPackage.mob.footprint;poseCapture.invalidateCaptures('MOB footprint changed');changeSpriteFormat({refit:true});}
    useCurrentFormatAfterClear();
    selectFacing(state.facing);
    poseLibraryPanel=createStudioPoseLibrary({
      readOnly:query.get('preview')==='1',
      initialLibrary:query.get('preview')==='1'?(linkedLibrary||state.poseLibrary):(state.poseLibrary||linkedLibrary),
      getSample:()=>{if(!state.action||!state.modelReady)throw Error('Load a model and select an animation first.');return portablePoseSample(state.action.getClip(),state.action.time,state.sourceClips,state.animationRanges);},
      getClips:()=>state.clips.map(clip=>({sourceId:animationSourceId(clip),duration:clip.duration})),
      selectProfile:id=>poseCapture.switchActionProfile(id),
      preview:async({index,sample})=>{if(!state.modelReady||state.modelLoading)throw Error('Wait for the model to load.');state.playing=false;setClip(index);state.action.paused=true;state.action.time=sample.timeSeconds;equipment.restoreConstraints(); state.mixer.update(0); equipment.applyConstraints();updateAnimationControls();invalidate();poseCapture.saveWorkspace();},
      getCaptureRecipes:()=>{const groups=poseCapture.recipeProfiles();for(const poses of Object.values(groups))for(const capture of Object.values(poses)){if(!capture.clipSourceId||capture.clipSourceId==='t-pose')continue;const clip=state.clips.find(item=>animationSourceId(item)===capture.clipSourceId);if(!clip)throw Error('Load the source animation before copying capture references: '+capture.clip);const sample=portablePoseSample(clip,capture.time,state.sourceClips,state.animationRanges);capture.clip=sample.animation;capture.clipSourceId=sample.sourceId;capture.time=sample.timeSeconds;}return groups;},
      getCaptureStates:()=>poseCapture.captureStates(),
      getStudioAppearance:()=>{if(!state.modelReady||state.modelLoading||!state.libraryModelId)throw Error('Load a repository model and wait for it to finish loading.');const settings=getWorkspaceSettings();return {version:1,modelId:state.libraryModelId,modelScalePercent:state.modelScalePercent,hexScalePercent:state.hexScalePercent,footprint:state.layoutId,equipment:settings.equipment,offHandEquipment:settings.offHandEquipment,shield:settings.shield,appearanceRecolor:settings.appearanceRecolor,poseEquipment:Object.fromEntries(Object.entries(poseCapture.captureStates()).map(([group,poses])=>[group,Object.fromEntries(Object.entries(poses).map(([pose,capture])=>[pose,{equipment:capture.render?.equipment,offHandEquipment:capture.render?.offHandEquipment,shield:capture.render?.shield}]))]))};},
      selectCaptureLibrary:id=>poseCapture.selectCaptureLibrary(id),
      copyCaptureLibrary:id=>poseCapture.selectCaptureLibrary(id,{copyCurrent:true}),
      clearCaptures:()=>poseCapture.clearLibraryCaptures(),
      resetAdjustments:async()=>{
        if(!state.modelReady||state.modelLoading)throw Error('Load a model first.');
        const primary=equipment.snapshot().settings.rightHand,offhand=offHandEquipment.snapshot().settings.rightHand,shield=shieldEquipment.snapshot().settings.leftHandShield;
        await changeEquipment(defaultEquipmentSettingsForModel(primary),{resetPose:false});
        await changeOffHand({rightHand:offhand},{resetPose:false});
        await changeShield(normalizeShield({leftHandShield:shield}),{resetPose:false});
        const previous=state.modelScalePercent;state.modelScalePercent=100;
        if(Number.isFinite(state.tPoseHeightFeet)&&previous>0)state.tPoseHeightFeet*=100/previous;
        applyModelSize(previous);state.heading=0;ui.Heading.value='0';ui.HeadingValue.textContent='0°';if(calibration)calibration.rotation.y=0;
        updateSetupLabels();poseCapture.invalidateCaptures('Model adjustments reset');poseCapture.saveWorkspace();invalidate();
      },
      invalidateCaptures:(reason,options)=>poseCapture.invalidateCaptures(reason,options),
      getLinkedLibrary:()=>state.poseLibrary,
      getSignature:()=>state.poseLibrarySignature,
      setLink:(library,signature)=>{state.poseLibrary=structuredClone(library);state.poseLibrarySignature=signature;poseCapture.refreshControls();poseCapture.saveWorkspace();}
    });
    if(authoringScoped&&query.get('preview')==='1'){
      window.addEventListener('message',async event=>{
        if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='mob-preview-pose')return;
        try{await poseLibraryPanel.previewPose(event.data.profile,event.data.pose);parent.postMessage({type:'mob-preview-result',message:'Pose displayed on '+state.modelName},location.origin);}
        catch(error){parent.postMessage({type:'mob-preview-result',message:error.message},location.origin);}
      });
      parent.postMessage({type:'mob-preview-ready'},location.origin);
    }
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
