import {poseChecklist} from './pose-checklist.mjs?v=R238C196';
import {planCaptureExport,recoveryPoseReference} from './studio-capture-export.mjs?v=R238C196';
import { quantizeRgba } from './studio-core.mjs?v=R238C99';
import {
  SPRITE_DIRECTIONS, SPRITE_POSES, spriteSetSlug, createSpriteSetManifest,
  splitSixFacingAtlas, assembleSpriteSheet, validateSpriteSetManifest
} from './sprite-set-core.mjs?v=R238C196';
import {
  saveStudioDraft, loadStudioDraft, saveStudioWorkspace, loadStudioWorkspace,
  upgradeStudioWorkspaceHexScale
} from './sprite-set-store.mjs?v=R238C196';
import { spriteLayoutDimensions, validateSpriteModelScale, validateSpriteHexScale } from './sprite-layouts.mjs?v=R238C95';
import { ACTION_PROFILE_CATALOG, ACTION_POSE_LABELS } from './action-profile-catalog.mjs?v=R238C196';
import { buildStudioUnitExport } from './studio-unit-export.mjs?v=R238C198';
import { zipSync, strToU8 } from '../assets/vendor/three/addons/libs/fflate.module.js';

import {CAPTURE_FORMAT_VERSION,CAPTURE_GROUP_CATALOG,isSharedCaptureGroup,capturePosesForGroup,captureGroupPath,upgradeCaptureWorkspace,combinedCaptureGroup,assertCompatibleCaptureFrames} from './action-capture-groups.mjs?v=R238C196';

const poseLabel = pose => ACTION_POSE_LABELS[pose];
const spriteCount = SPRITE_POSES.length * SPRITE_DIRECTIONS.length;
const BATTLEFIELD_PIXELS_PER_INCH = 64 / (10 * 12);

function physicalOutlinePixels(renderStyle, targetWidth, battlefieldWidth) {
  if (Number.isFinite(renderStyle?.outlineInches) && Number.isFinite(battlefieldWidth) && battlefieldWidth > 0) {
    return Math.max(0, renderStyle.outlineInches) * BATTLEFIELD_PIXELS_PER_INCH * targetWidth / battlefieldWidth;
  }
  return Number.isFinite(renderStyle?.outline) ? Math.max(0, renderStyle.outline) : 0;
}

function frameEdgeDirections({ raw, width, height }) {
  const atlasWidth = width * 3, atlasHeight = height * 2;
  return SPRITE_DIRECTIONS.filter((direction, index) => {
    const left = (index % 3) * width, top = Math.floor(index / 3) * height;
    const occupied = (x, y) => raw[((atlasHeight - 1 - top - y) * atlasWidth + left + x) * 4 + 3] >= 128;
    for (let x = 0; x < width; x++) if (occupied(x, 0) || occupied(x, height - 1)) return true;
    for (let y = 1; y < height - 1; y++) if (occupied(0, y) || occupied(width - 1, y)) return true;
    return false;
  });
}

function pngBlob(data, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (blob) resolve(blob);
    else reject(new Error('A sprite PNG could not be created. Try exporting again.'));
  }, 'image/png'));
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Captures retain unquantized pixels, allowing one color/outline adjustment to
// update every saved pose without re-evaluating animation or moving its camera.
export function createPoseCapture({ readPose, getStyle, getWorkspaceSettings = () => ({}), onLockChange, onError, onStatus, onProfileChange = async () => {}, onCapture = () => {}, renderFallback = null }) {
  const byId = suffix => document.getElementById(`studio${suffix}`);
  const ui = Object.fromEntries([
    'CaptureCount', 'SpriteSetName', 'PoseSheetRows', 'SheetStatus', 'CaptureLockNote',
    'ExportPoseSheetButton', 'ExportPackageButton', 'TestCombatButton', 'ClearPosesButton', 'WorkspaceStatus', 'CaptureProfileSummary', 'ActionProfile', 'ActionPose', 'CaptureSelectedPoseButton'
  ].map(name => [name, byId(name)]));
  const rows = new Map();
  let captures = {}, style = getStyle(), busy = false, modelReady = false, equipmentBusy = false;
  const capturesByProfile=new Map([['one-handed-swing',captures]]);
  let selectedProfileId='one-handed-swing',weaponProfileId='one-handed-swing',legacySharedCaptures={};
  const equipmentByProfile=new Map();
  let captureLibraryId=null,libraryCaptures={};
  const savedGroups=()=>Object.fromEntries([...capturesByProfile].map(([id,group])=>[id,Object.fromEntries(Object.entries(group).map(([pose,value])=>{const {frames,battlefieldFrames,shadowFrames,...saved}=value;return [pose,saved];}))]));
  function selectCaptureLibrary(id,{copyCurrent=false}={}){
    if(busy||equipmentBusy)throw Error('Wait for capture or equipment loading to finish.');
    if(!captureLibraryId){captureLibraryId=id;return;}
    if(captureLibraryId===id)return;
    libraryCaptures[captureLibraryId]={groups:savedGroups(),legacySharedCaptures,profileEquipment:Object.fromEntries(equipmentByProfile),style:{...style}};
    if(copyCurrent)libraryCaptures[id]=structuredClone(libraryCaptures[captureLibraryId]);
    const saved=libraryCaptures[id];delete libraryCaptures[id];captureLibraryId=id;
    capturesByProfile.clear();equipmentByProfile.clear();legacySharedCaptures=saved?.legacySharedCaptures||{};
    for(const [group,poses] of Object.entries(saved?.groups||{})){
      for(const capture of Object.values(poses)){if(JSON.stringify(saved.style)!==JSON.stringify(style)){capture.stale=true;capture.staleReason='Rendering settings changed';}quantizeCapture(capture,style);}
      capturesByProfile.set(group,poses);
    }
    for(const [group,value] of Object.entries(saved?.profileEquipment||{}))equipmentByProfile.set(group,value);
    captures=capturesByProfile.get(selectedProfileId)||{};capturesByProfile.set(selectedProfileId,captures);refresh();
    ui.SheetStatus.textContent="Selected library captures loaded. ZIP export includes only this library.";
  }
  function clearLibraryCaptures(){
    if(busy||equipmentBusy)throw Error('Wait for capture or equipment loading to finish.');
    captures={};capturesByProfile.clear();capturesByProfile.set(selectedProfileId,captures);equipmentByProfile.clear();legacySharedCaptures={};
    refresh();saveWorkspace();ui.SheetStatus.textContent='No captured sprites in this library. Capture a pose to begin.';document.dispatchEvent(new CustomEvent('studio-captures-changed'));
  }
  let windupDurationMs=250;
  const currentEquipment=()=>{
    const settings=getWorkspaceSettings();
    return structuredClone({equipment:settings.equipment,offHandEquipment:settings.offHandEquipment,shield:settings.shield});
  };
  async function switchActionProfile(nextId){
    if(busy||equipmentBusy||!CAPTURE_GROUP_CATALOG.has(nextId)||nextId===selectedProfileId)return;
    capturesByProfile.set(selectedProfileId,captures);
    if(modelReady)equipmentByProfile.set(selectedProfileId,currentEquipment());
    selectedProfileId=nextId;
    if(!isSharedCaptureGroup(nextId))weaponProfileId=nextId;
    if(ui.ActionProfile)ui.ActionProfile.value=nextId;
    captures=capturesByProfile.get(nextId)||{};
    capturesByProfile.set(nextId,captures);
    busy=true;refresh();
    try{
      const saved=equipmentByProfile.get(nextId)||Object.values(captures)[0]?.render;
      if(saved)await onProfileChange(saved,captures[ui.ActionPose?.value]||Object.values(captures)[0]);
    }catch(error){onError(error);}
    finally{busy=false;refresh();queueSave();}

  }
  if(ui.ActionProfile){
    for(const profile of CAPTURE_GROUP_CATALOG.values()){
      if(profile.id==='spell-casting')continue;
      const option=document.createElement('option');option.value=profile.id;option.textContent=profile.label;
      ui.ActionProfile.append(option);
    }
    ui.ActionProfile.value='one-handed-swing';
    ui.ActionProfile.addEventListener('change',()=>switchActionProfile(ui.ActionProfile.value));
  }
  const legacyPanel=document.createElement('div');legacyPanel.className='studio-sheet-actions';legacyPanel.hidden=true;
  const legacyChoice=document.createElement('select');legacyChoice.setAttribute('aria-label','Earlier per-weapon shared captures');
  const legacyButton=document.createElement('button');legacyButton.type='button';legacyButton.className='studio-button';legacyButton.textContent='Restore earlier capture';
  legacyPanel.append(legacyChoice,legacyButton);ui.CaptureProfileSummary?.after(legacyPanel);
  function refreshLegacyChoices(){
    const previous=legacyChoice.value;
    const entries=Object.entries(legacySharedCaptures).flatMap(([id,poses])=>Object.keys(poses).filter(p=>groupPoses().includes(p)).map(p=>[id,p]));
    legacyPanel.hidden=!isSharedCaptureGroup(selectedProfileId)||!entries.length;
    legacyChoice.replaceChildren(...entries.map(([id,pose])=>new Option(`${ACTION_PROFILE_CATALOG.get(id)?.label}: ${poseLabel(pose)}`,id+':'+pose)));
    if(entries.some(([id,pose])=>id+':'+pose===previous))legacyChoice.value=previous;
    legacyButton.disabled=busy||equipmentBusy;
  }
  legacyButton.addEventListener('click',()=>{
    if(busy||equipmentBusy)return;
    const [id,pose]=legacyChoice.value.split(':'),saved=legacySharedCaptures[id]?.[pose];
    if(!saved||!groupPoses().includes(pose))return;
    const restored=structuredClone(saved);restored.edgeDirections=frameEdgeDirections(restored);quantizeCapture(restored);
    captures[pose]=restored;refresh();queueSave();ui.SheetStatus.textContent=`Restored earlier ${poseLabel(pose)}. Check its framing before exporting.`;
  });
  let savedSettings = null, restored = false, saveRevision = 0, savedRevision = 0;
  let saveQueue = Promise.resolve(), lastSaveError = null, saveTimer = 0;

  function workspaceStatus(message, failed = false) {
    if (!ui.WorkspaceStatus) return;
    ui.WorkspaceStatus.textContent = message;
    ui.WorkspaceStatus.classList.toggle('error', failed);
  }

  function workspaceSnapshot() {
    const currentSettings = getWorkspaceSettings();
    const settings = { ...(!modelReady && savedSettings ? savedSettings : currentSettings) };
    if(ui.ActionProfile) settings.actionProfileId=selectedProfileId;
    settings.weaponActionProfileId=weaponProfileId;
    if(ui.ActionPose)settings.selectedActionPose=ui.ActionPose.value;
    settings.windupDurationMs=windupDurationMs;
    if(modelReady&&!busy)equipmentByProfile.set(selectedProfileId,currentEquipment());
    const first = Object.values(captures)[0];
    settings.hexScalePercent = validateSpriteHexScale(first ? first.hexScalePercent : settings.hexScalePercent);
    return {
      version: 1, captureLibraryId, libraryCaptures, captureFormatVersion:CAPTURE_FORMAT_VERSION, legacySharedCaptures, name: ui.SpriteSetName.value.slice(0, 120), style: { ...style }, settings,
      captures: Object.fromEntries(Object.entries(captures).map(([pose, value]) => {
        const { frames, battlefieldFrames, shadowFrames, ...saved } = value;
        return [pose, saved];
      })),
      profileEquipment:Object.fromEntries(equipmentByProfile),
      ...Object.fromEntries(['actionProfiles','sharedActionGroups'].map(key=>[key,Object.fromEntries(
        [...capturesByProfile].filter(([id])=>isSharedCaptureGroup(id)===(key==='sharedActionGroups')).map(([id,group])=>[id,
          Object.fromEntries(Object.entries(group).map(([pose,value])=>{
            const {frames,battlefieldFrames,shadowFrames,...saved}=value;return [pose,saved];
          }))]))]))
    };
  }

  function queueSave() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    const revision = ++saveRevision;
    const workspace = workspaceSnapshot();
    workspaceStatus('Saving captures and studio settings…');
    const pending = saveQueue.catch(() => {}).then(async () => {
      await saveStudioWorkspace(workspace);
      savedRevision = revision;
      lastSaveError = null;
      if (revision === saveRevision) workspaceStatus('Saved in this browser. Your captures will return with you from combat.');
    });
    saveQueue = pending;
    pending.catch(error => {
      lastSaveError = error;
      if (revision === saveRevision) {
        workspaceStatus(error.message, true);
        onError(error);
      }
    });
    return pending;
  }

  function saveWorkspace() {
    clearTimeout(saveTimer);
    workspaceStatus('Saving captures and studio settings…');
    saveTimer = setTimeout(() => { queueSave(); }, 150);
  }

  async function flushSave() {
    if (saveTimer || savedRevision !== saveRevision || lastSaveError) await queueSave();
    else await saveQueue;
  }

  window.addEventListener('beforeunload',event=>{
    if(savedRevision!==saveRevision||saveTimer||lastSaveError){event.preventDefault();event.returnValue='';}
  });

  for (const pose of SPRITE_POSES) {
    const tr = document.createElement('tr');
    tr.dataset.studioSavedPose = pose;
    const heading = document.createElement('th');
    heading.scope = 'row';
    const title = document.createElement('span');
    title.textContent = poseLabel(pose);
    const detail = document.createElement('small');
    detail.textContent = 'Not captured';
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'studio-button';
    clear.textContent = 'Clear';
    clear.dataset.studioClearPose = pose;
    clear.setAttribute('aria-label', `Clear ${pose} pose`);
    clear.hidden = true;
    clear.addEventListener('click', () => {
      if (busy) return;
      delete captures[pose];
      document.dispatchEvent(new CustomEvent('studio-captures-changed'));
      refresh();
      queueSave();
      ui.SheetStatus.textContent = `${poseLabel(pose)} cleared. Capture a new moment to fill that row.`;
    });
    heading.append(title, detail, clear);
    tr.append(heading);
    const canvases = {};
    for (const direction of SPRITE_DIRECTIONS) {
      const cell = document.createElement('td');
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 200;
      canvas.dataset.studioCapture = `${pose}:${direction}`;
      canvas.setAttribute('aria-label', `${poseLabel(pose)}, ${direction} facing — not captured`);
      canvas.textContent = `${poseLabel(pose)}, ${direction} facing`;
      cell.append(canvas);
      tr.append(cell);
      canvases[direction] = canvas;
    }
    ui.PoseSheetRows.append(tr);
    rows.set(pose, { tr, detail, clear, canvases });
  }

  if(ui.CaptureSelectedPoseButton){
    ui.CaptureSelectedPoseButton.addEventListener('click',()=>{
      const pose=ui.ActionPose?.value;
      if(SPRITE_POSES.includes(pose))capture(pose);
    });
  }
  const groupPoses=()=>capturePosesForGroup(selectedProfileId);
  function count() { return Object.keys(captures).length * 6; }
  function totalCount() { return [...capturesByProfile.values()].reduce((sum,group)=>sum+Object.keys(group).length*6,0); }
  function freshCount() { return Object.values(captures).filter(capture => !capture.stale).length * 6; }
  function modelScaleAdjustable() {
    return !freshCount() || Object.values(captures).every(capture => !!capture.layout && !capture.battlefieldRaw);
  }

  // Edits never discard a saved frame silently. The previous thumbnails
  // remain visible and export in recovery/ with their exact references/pixels.
  // Combat only uses current captures until outdated poses are recaptured.
  function invalidateCaptures(reason = 'Studio settings changed', {allProfiles=true,changedPoses=null} = {}) {
    const targets=changedPoses ? changedPoses.flatMap(({groupId,pose,sample})=>{
      const capture=capturesByProfile.get(groupId)?.[pose];
      return capture&&(!sample||capture.clipSourceId!==sample.sourceId||Math.abs(capture.time-sample.timeSeconds)>0.0001)?[capture]:[];
    }) : (allProfiles ? [...capturesByProfile.values()] : [captures]).flatMap(group=>Object.values(group));
    if(allProfiles&&!changedPoses)for(const bank of Object.values(libraryCaptures))for(const group of Object.values({...bank.groups,...bank.legacySharedCaptures}))for(const capture of Object.values(group)){capture.stale=true;capture.staleReason=reason;}
    if(!targets.length)return;
    for(const capture of targets) { capture.stale = true; capture.staleReason=reason; }
    if(allProfiles&&!changedPoses)for(const group of Object.values(legacySharedCaptures))for(const capture of Object.values(group))capture.stale=true;
    refresh();
    document.dispatchEvent(new CustomEvent('studio-captures-changed'));
    ui.SheetStatus.textContent = `${reason}. Saved sprites are outdated; recapture any affected pose to use it in combat.`;
    saveWorkspace();
  }

  function refreshControls() {
    const available=groupPoses(),previous=ui.ActionPose?.value;
    if(ui.ActionPose){
      for(const option of ui.ActionPose.options){option.hidden=!available.includes(option.value);option.disabled=option.hidden;}
      if(!available.includes(previous))ui.ActionPose.value=available[0];
    }
    refreshLegacyChoices();
    const captured = count();
    const fresh = freshCount();
    if(ui.ActionProfile){
      ui.ActionProfile.disabled=busy||equipmentBusy;
      for(const option of ui.ActionProfile.options){
        const group=CAPTURE_GROUP_CATALOG.get(option.value),saved=capturesByProfile.get(option.value)||{};
        const library=getWorkspaceSettings().poseLibrary;
        const assigned=isSharedCaptureGroup(option.value)?library?.sharedActionGroups?.[option.value]:library?.profiles?.[option.value];
        const complete=group.poses.every(pose=>assigned?.[pose]||(!library&&saved[pose]));
        option.textContent=(complete?'✅ ':'')+group.label;
      }
    }
    if(ui.CaptureProfileSummary){
      const total=[...capturesByProfile.values()].reduce((n,group)=>n+Object.keys(group).length,0);
      const outdated=[...capturesByProfile.values()].reduce((n,group)=>n+Object.values(group).filter(pose=>pose.stale).length,0);
      ui.CaptureProfileSummary.textContent=`${CAPTURE_GROUP_CATALOG.get(selectedProfileId)?.label}: ${fresh/SPRITE_DIRECTIONS.length}/${groupPoses().length} current sprite captures · ${total} captured poses across all groups${outdated?` · ${outdated} outdated snapshots preserved`:""}`;
    }
    const coverage=byId('PoseCoverage');
    if(coverage){
      const library=getWorkspaceSettings().poseLibrary;
      const assigned=isSharedCaptureGroup(selectedProfileId)?library?.sharedActionGroups?.[selectedProfileId]:library?.profiles?.[selectedProfileId];
      coverage.textContent=groupPoses().map(pose=>`${poseLabel(pose)}: ${assigned?.[pose]?'frame assigned':'frame unassigned'}; sprites ${!captures[pose]?'not captured':captures[pose].stale?'need re-render (preserved)':'current'}`).join(' · ');
    }
    // No capture-state editor lock: affected captures are marked outdated
    // when an edit changes the rendered model.
    onLockChange(false);
    ui.CaptureCount.textContent = `${fresh} / ${groupPoses().length*6} ready sprites` +
      (captured > fresh ? ` · ${captured - fresh} need recapture` : '');
    ui.ClearPosesButton.disabled = busy || !captured;
    if(ui.CaptureSelectedPoseButton)ui.CaptureSelectedPoseButton.disabled=busy||equipmentBusy||!modelReady;
    for (const button of [ui.ExportPoseSheetButton, ui.ExportPackageButton, ui.TestCombatButton]) {
      button.disabled = busy;
    }
    if(getWorkspaceSettings().unitPackage?.mob?.authoringVersion)ui.TestCombatButton.disabled=true;
    for (const [pose,row] of rows) {
      row.tr.hidden=!groupPoses().includes(pose);
      row.clear.disabled = busy;
    }
    ui.CaptureLockNote.classList.toggle('locked', captured > fresh);
    ui.CaptureLockNote.textContent = captured > fresh
      ? 'Some saved poses are outdated after editing. Controls stay available; ZIP export preserves them in recovery; recapture them before combat.'
      : 'Each pose keeps its captured equipment and grip. Lighting or framing changes mark captures outdated; ZIP export preserves those snapshots for recovery.';
  }

  function refresh() {
    const settings = !modelReady && savedSettings ? savedSettings : getWorkspaceSettings();
    const first = Object.values(captures)[0];
    const emptyWidth = first?.width || settings.width || 160;
    const emptyHeight = first?.height || settings.height || 200;
    for (const pose of SPRITE_POSES) {
      const capture = captures[pose], row = rows.get(pose);
      row.tr.classList.toggle('captured', !!capture);
      row.tr.classList.toggle('outdated', !!capture?.stale);
      row.tr.classList.toggle('touches-edge', !!capture?.edgeDirections.length);
      row.clear.hidden = !capture;
      row.detail.textContent = capture ? `${capture.clip} · ${capture.time.toFixed(3)} s${capture.stale ? ' · OUTDATED — preserved in export' : ''}` : 'Not captured';
      if (capture?.edgeDirections.length) row.detail.textContent += ` · Touches frame edge: ${capture.edgeDirections.join(', ')}`;
      for (const direction of SPRITE_DIRECTIONS) {
        const canvas = row.canvases[direction];
        canvas.width = capture?.width || emptyWidth;
        canvas.height = capture?.height || emptyHeight;
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        if (capture) context.putImageData(new ImageData(capture.frames[direction], capture.width, capture.height), 0, 0);
        canvas.setAttribute('aria-label', `${poseLabel(pose)}, ${direction} facing — ${capture ? 'captured' : 'not captured'}`);
      }
    }
    refreshControls();
  }

  function quantizeCapture(capture, renderStyle = style) {
    const { width, height, raw } = capture;
    const rgba = new Uint8ClampedArray(raw.length);
    const sourceOutline = physicalOutlinePixels(renderStyle, width, capture.battlefieldWidth);
    if (capture.bakedPixels && renderStyle.brightness === 1 && renderStyle.contrast === 1 &&
        renderStyle.hue === 0 && renderStyle.saturation === 1 && sourceOutline === 0) {
      // A Rev 46 PNG already has the chosen palette and outline. Re-quantizing
      // a palette color can select a neighboring lookup bucket; copy it exactly.
      const stride = width * 3 * 4;
      for (let y = 0; y < height * 2; y++) {
        const start = (height * 2 - 1 - y) * stride;
        rgba.set(raw.subarray(start, start + stride), y * stride);
      }
      capture.frames = splitSixFacingAtlas(rgba, width, height);
      return;
    }
    quantizeRgba(raw, width * 3, height * 2, rgba, {
      ...renderStyle, outline: sourceOutline, transparent: true, tileWidth: width, tileHeight: height
    });
    capture.frames = splitSixFacingAtlas(rgba, width, height);

    if(capture.battlefieldRaw && Number.isInteger(capture.battlefieldWidth) && Number.isInteger(capture.battlefieldHeight)){
      const bw=capture.battlefieldWidth,bh=capture.battlefieldHeight;
      const battlefieldRgba=new Uint8ClampedArray(capture.battlefieldRaw.length);
      quantizeRgba(capture.battlefieldRaw,bw*3,bh*2,battlefieldRgba,{
        ...renderStyle,outline:physicalOutlinePixels(renderStyle,bw,bw),transparent:true,tileWidth:bw,tileHeight:bh
      });
      capture.battlefieldFrames=splitSixFacingAtlas(battlefieldRgba,bw,bh);
      if(capture.groundShadowRgba)capture.shadowFrames=splitSixFacingAtlas(capture.groundShadowRgba,bw,bh);
    }
  }

  function capture(pose) {
    if (busy || !modelReady || !groupPoses().includes(pose)) return;
    try {
      const captured = readPose();
      const first = Object.values(captures).find(value => !value.stale);
      if (first && (first.width !== captured.width || first.height !== captured.height)) {
        throw new Error('Clear the sheet before changing its sprite resolution.');
      }
      if (first && (first.modelScalePercent ?? 100) !== (captured.modelScalePercent ?? 100)) {
        throw new Error('Clear the sheet before changing its model size.');
      }
      if (first && (first.hexScalePercent ?? 100) !== (captured.hexScalePercent ?? 100)) {
        throw new Error('Clear the sheet before changing its hex scale.');
      }
      style = getStyle();
      captured.edgeDirections = frameEdgeDirections(captured);
      captured.stale = false;
      quantizeCapture(captured);
      onCapture(selectedProfileId,pose,captured);
      captures[pose] = captured;
      refresh();
      queueSave();
      const complete = freshCount() === groupPoses().length*6;
      const note = `${poseLabel(pose)} captured at ${captured.time.toFixed(3)} s · six facings saved.`;
      const edgeNote = captured.edgeDirections.length
        ? 'A sprite touches the frame edge. If it is cropped, adjust the model size or framing before capturing again.'
        : complete ? `All ${groupPoses().length*6} sprites are ready to export or test.` : 'Capture the remaining poses to complete the set.';
      ui.SheetStatus.textContent = `${note} ${edgeNote}`;
      onStatus(note);
      document.dispatchEvent(new CustomEvent('studio-captures-changed'));
    } catch (error) { onError(error); }
  }

  function snapshot() {
    const first = Object.values(captures)[0];
    return {
      captureCount: count(), totalCaptureCount: totalCount(), freshCaptureCount: freshCount(),
      outdatedCaptureCount: count()-freshCount(), captureLocked: false,
      modelScaleAdjustable: modelScaleAdjustable(),
      modelReady, workspaceRestored: restored,
      workspaceSaved: !saveTimer && savedRevision === saveRevision && !lastSaveError,
      groundAnchor: first ? [first.anchorX, first.anchorY] : null,
      captures: Object.fromEntries(Object.entries(captures).map(([pose, value]) => [pose, {
        clip: value.clip, time: value.time, width: value.width, height: value.height,
        modelScalePercent: value.modelScalePercent ?? 100,
        hexScalePercent: value.hexScalePercent ?? 100,
        renderWidth: value.renderWidth, renderHeight: value.renderHeight,
        battlefieldWidth:value.battlefieldWidth ?? null,battlefieldHeight:value.battlefieldHeight ?? null,
        edgeDirections: [...value.edgeDirections]
      }]))
    };
  }

  function buildExport(group=captures,profileId=selectedProfileId,{includeOutdated=false,includeQaSheet=false}={}) {
    const captures=group;
    const included=pose=>captures[pose]&&(includeOutdated||!captures[pose].stale);
    const settings = !modelReady && savedSettings ? savedSettings : getWorkspaceSettings();
    const first=Object.values(captures).find(capture=>!capture.stale);
    const base=first || Object.values(captures)[0];
    const dimensions=base || spriteLayoutDimensions(settings.layoutId || settings.layout?.id || 'single',
      settings.resolutionPercent || settings.layout?.resolutionPercent || 100,
      settings.modelScalePercent || 100,settings.hexScalePercent || 100);
    const {width,height,anchorX=width/2,anchorY=height/2,render={},layout=base?.layout || settings.layout || {id:'single',resolutionPercent:100},
      modelScalePercent=settings.modelScalePercent ?? 100,hexScalePercent=settings.hexScalePercent ?? 100,
      renderWidth=48,renderHeight=48*height/width}=dimensions;
    const mobType = settings.mobType || base?.mobType;
    const calibration = base?.unitCalibration || settings.unitCalibration || null;
    const unit = calibration ? {
      type: mobType,
      modelId: calibration.modelId ?? settings.libraryModelId ?? null,
      modelName: calibration.modelName ?? settings.modelName ?? null,
      calibration: {
        pose: 'T-Pose',
        modelScalePercent: calibration.modelScalePercent ?? modelScalePercent ?? 100,
        measuredHeightInches: Number.isFinite(calibration.measuredHeightInches)
          ? calibration.measuredHeightInches : null
      }
    } : undefined;
    const label = ui.SpriteSetName.value.trim() || 'Studio character';
    const battlefield = base?.battlefieldFrames ? {
      renderer:'native-battlefield-v1',
      width:base.battlefieldWidth,
      height:base.battlefieldHeight,
      anchorX:base.battlefieldAnchorX,
      anchorY:base.battlefieldAnchorY
    } : undefined;
    const manifest = createSpriteSetManifest({
      id: spriteSetSlug(label+'-'+profileId), label,
      frame: { width, height, renderWidth, renderHeight, anchorX, anchorY },
      ...(layout ? { layout } : {}), ...(mobType ? { mobType } : {}),
      ...(modelScalePercent === undefined ? {} : { modelScalePercent }),
      ...(hexScalePercent === undefined ? {} : { hexScalePercent }),
      ...(unit ? { unit } : {}),
      ...(battlefield ? { battlefield } : {}),
      windupDurationMs,
      partialPoses:true, actionProfileId:profileId,
      captures: Object.fromEntries(SPRITE_POSES.filter(included).map(pose => [pose, { clip: captures[pose].clip, time: captures[pose].time }])),
      render: {
        ...render,
        appearanceRecolor: structuredClone(settings.appearanceRecolor || {hair:'default',metal:'default'}),
        recolorMaskSetId: String(settings.libraryModelId||'').startsWith('woman-warrior-')
          ? 'woman-warrior-hair-metal-v1' : null,
        brightness: style.brightness, contrast: style.contrast,
        hue: style.hue, saturation: style.saturation, outline: style.outline,
        palette: 'Adventure Party VGA 256'
      }
    });
    manifest.captureFormatVersion=CAPTURE_FORMAT_VERSION;
    if(isSharedCaptureGroup(profileId)){delete manifest.actionProfileId;manifest.sharedActionGroupId=profileId;}
    for(const pose of Object.keys(manifest.poses)){
      manifest.poses[pose].clipSourceId=captures[pose].clipSourceId||null;
      if(captures[pose].stale){manifest.poses[pose].outdated=true;manifest.poses[pose].outdatedReason=captures[pose].staleReason||'Earlier Studio settings changed; review this saved snapshot.';}
      manifest.poses[pose].render=structuredClone(captures[pose].render||{});
    }
    const poseFrames = Object.fromEntries(SPRITE_POSES.filter(included).map(pose => [pose, captures[pose].frames]));
    const battlefieldPoseFrames = battlefield
      ? Object.fromEntries(SPRITE_POSES.filter(pose=>included(pose)&&captures[pose].battlefieldFrames).map(pose=>[pose,captures[pose].battlefieldFrames]))
      : null;
    return {
      manifest,poseFrames,battlefieldPoseFrames,
      shadowFrames:Object.fromEntries(Object.entries(captures).filter(([,c])=>!c.stale&&c.shadowFrames).map(([pose,c])=>[pose,c.shadowFrames])),
      sheet:includeQaSheet?assembleSpriteSheet({...Object.fromEntries(SPRITE_POSES.map(pose=>[pose,poseFrames[pose] || {}]))},width,height):null,
      workspace:workspaceSnapshot()
    };
  }

  async function packageFiles(exported,{includeQaSheet=false}={}) {
    const { manifest, poseFrames, battlefieldPoseFrames, sheet } = exported;
    const { width, height } = manifest.frame;
    const jobs = Object.keys(manifest.poses).flatMap(pose => SPRITE_DIRECTIONS.map(async direction => [
      manifest.poses[pose].frames[direction], await pngBlob(poseFrames[pose][direction], width, height)
    ]));
    if(manifest.battlefield && battlefieldPoseFrames){
      for(const pose of Object.keys(manifest.battlefield.poses)){
        for(const direction of SPRITE_DIRECTIONS){
          jobs.push(Promise.resolve([
            manifest.battlefield.poses[pose].frames[direction],
            await pngBlob(
              battlefieldPoseFrames[pose][direction],
              manifest.battlefield.width,manifest.battlefield.height
            )
          ]));
        }
      }
    }
    // The sheet is for Studio visual QA only, never a combat dependency.
    if(includeQaSheet)jobs.push(pngBlob(sheet.data, sheet.width, sheet.height).then(blob => [manifest.sheet.file, blob]));
    return Object.fromEntries(await Promise.all(jobs));
  }

  async function runExport(task) {
    if (busy) return;
    busy = true;
    refreshControls();
    try { await task(); }
    catch (error) { onError(error); ui.SheetStatus.textContent = 'Export did not finish. Your captured poses are still here.'; }
    finally { busy = false; refreshControls(); }
  }

  ui.ExportPoseSheetButton.addEventListener('click', () => runExport(async () => {
    const {manifest,sheet}=buildExport(captures,selectedProfileId,{includeQaSheet:true});
    download(await pngBlob(sheet.data, sheet.width, sheet.height), `${manifest.id}-${spriteCount}-sprites-${manifest.frame.width}x${manifest.frame.height}.png`);
    ui.SheetStatus.textContent = `Sheet exported: six facing columns and ${SPRITE_POSES.length} rows (${SPRITE_POSES.map(poseLabel).join(', ')}).`;
  }));

  ui.ExportPackageButton.addEventListener('click', () => runExport(async () => {
    const plan=planCaptureExport(Object.fromEntries(capturesByProfile));
    if(!plan.poseCount)throw new Error('Capture at least one pose before exporting action groups.');
    const profiles=plan.current.map(({id,captures,path})=>({id,path,exported:buildExport(captures,id)}));
    const recovery=plan.recovery.map(({id,pose,capture,path})=>({id,pose,path,exported:buildExport({[pose]:capture},id,{includeOutdated:true})}));
    const checklist=getWorkspaceSettings().poseLibrary?poseChecklist(getWorkspaceSettings().poseLibrary,Object.fromEntries(capturesByProfile)):[];
    const report={libraryId:getWorkspaceSettings().poseLibrary?.id,poses:checklist,current:checklist.filter(p=>p.state==='captured').length,missing:checklist.filter(p=>p.state==='missing').length,outdated:checklist.filter(p=>p.state==='outdated').length};
    const entries=[['capture-summary.json',strToU8(JSON.stringify(report,null,2)+'\n')]];
    for(const {path,exported} of [...profiles,...recovery]){
      const files=await packageFiles(exported,{includeQaSheet:false});
      for(const [name,blob] of Object.entries(files))entries.push([`${path}/${name}`,new Uint8Array(await blob.arrayBuffer())]);
      entries.push([`${path}/manifest.json`,strToU8(JSON.stringify(exported.manifest,null,2)+'\n')]);
    }
    const recovered=recovery.map(({id,pose,path,exported})=>({id,pose,path,manifest:exported.manifest}));
    const unit=buildStudioUnitExport({
      name:ui.SpriteSetName.value.trim()||'Studio character',settings:!modelReady&&savedSettings?savedSettings:getWorkspaceSettings(),
      profiles:profiles.map(({id,exported})=>({id,manifest:exported.manifest})),recovery:recovered
    });
    if(recovery.length)entries.push(['capture-recovery.json',strToU8(JSON.stringify({
      schema:'adventure-party.capture-recovery',version:1,modelId:unit.modelId,
      records:recovered.map(recoveryPoseReference)
    },null,2)+'\n')]);
    if(unit.references.poseLibrary)entries.push(['pose-library.json',strToU8(JSON.stringify(unit.references.poseLibrary,null,2)+'\n')]);
    entries.push(['unit-package.json',strToU8(JSON.stringify(unit,null,2)+'\n')]);
    download(new Blob([zipSync(Object.fromEntries(entries),{level:0})],{type:'application/zip'}),`${unit.id}-weapon-sets.zip`);
    ui.SheetStatus.textContent=`Exported ${plan.poseCount} captured poses (${report.missing} checklist slots missing): ${plan.poseCount-recovery.length} current and ${recovery.length} earlier snapshots in recovery. Pose library, animation references, grips and six-facing PNGs are preserved.`;
  }));

  ui.TestCombatButton.addEventListener('click', () => {
    if (busy) return;
    runExport(async () => {
      const groups=Object.fromEntries(capturesByProfile);
      const group=combinedCaptureGroup({captureFormatVersion:2,settings:{},actionProfiles:groups,sharedActionGroups:groups},weaponProfileId);
      // Borrow only the source frame. Render it with this model's currently
      // selected equipment; do not reuse pixels depicting the fallback weapon.
      if(renderFallback)for(const [pose,captured] of Object.entries(group)){
        const direct=(pose==='falling'||pose==='prone'?groups['death-prone']:pose==='cast'||pose==='casting-windup'?groups.magic:groups[weaponProfileId])?.[pose];
        if(!direct&&!captured.stale){
          const rendered=await renderFallback(captured);
          rendered.edgeDirections=frameEdgeDirections(rendered);rendered.stale=false;quantizeCapture(rendered);group[pose]=rendered;
        }
      }
      assertCompatibleCaptureFrames(group);
      const exported=buildExport(group,weaponProfileId);
      ui.SheetStatus.textContent = 'Saving your captured sprites before opening combat…';
      const files = await packageFiles(exported,{includeQaSheet:false});
      await flushSave();
      // Finish saving the exact test set and return workspace before leaving
      // this page. A failed save leaves the studio and its captures open.
      const shadows={};
      for(const [pose,frames] of Object.entries(exported.shadowFrames))for(const facing of SPRITE_DIRECTIONS){
        const field=exported.manifest.battlefield;
        shadows[exported.manifest.poses[pose].frames[facing]]=await pngBlob(frames[facing],field.width,field.height);
      }
      await saveStudioDraft({ manifest: exported.manifest, files, shadows, workspace: exported.workspace });
      const target=new URL('./index.html',window.location.href);
      target.search=window.location.search;
      target.searchParams.delete('studioRestore');target.searchParams.delete('restore');
      target.searchParams.set('studioSprite','draft');
      target.searchParams.delete('sunHour');
      window.location.assign(target.href);
    });
  });

  function reset(name, { persist = true } = {}) {
    captures = {};captureLibraryId=null;libraryCaptures={};
    capturesByProfile.clear();equipmentByProfile.clear();selectedProfileId=weaponProfileId='one-handed-swing';legacySharedCaptures={};
    capturesByProfile.set(selectedProfileId,captures);
    if(ui.ActionProfile)ui.ActionProfile.value=selectedProfileId;
    style = getStyle();
    savedSettings = null;
    restored = false;
    ui.SpriteSetName.value = String(name).replace(/\.[^.]+$/, '');
    refresh();
    ui.SheetStatus.textContent = 'Capture whichever poses you need; missing poses use fallback artwork.';
    if (persist) queueSave();
  }

  function scaledFrameMetadata(metadata, oldScale, nextScale) {
    const ratio = nextScale / oldScale;
    const next = { ...metadata, modelScalePercent: nextScale };
    const vector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
    if (Number.isFinite(metadata?.frameHeight)) next.frameHeight = metadata.frameHeight * ratio;
    if (vector(metadata?.center)) next.center = metadata.center.map(value => value * ratio);
    return next;
  }

  function updateModelScale(percent) {
    const nextScale = validateSpriteModelScale(percent);
    if (count() && !freshCount()) {
      // Source pixels are retained as outdated references. The newly rendered
      // replacement pose will capture at the edited size.
      refresh();
      saveWorkspace();
      return;
    }
    if (!modelScaleAdjustable()) throw new Error('Clear the captured poses before changing Model size so native battlefield sprites can be re-rendered.');
    // Stage every row before committing: a size change must never leave poses
    // with different presentation sizes or alter their original captured pixels.
    const changes = Object.values(captures).map(capture => {
      const dimensions = spriteLayoutDimensions(capture.layout.id, capture.layout.resolutionPercent, nextScale, capture.hexScalePercent);
      if (dimensions.width !== capture.width || dimensions.height !== capture.height) {
        throw new Error('The captured frame does not match its footprint. Clear the sheet before changing its model size.');
      }
      const oldScale = capture.modelScalePercent ?? 100;
      const unitCalibration = capture.unitCalibration ? {
        ...capture.unitCalibration,
        modelScalePercent: nextScale,
        measuredHeightInches: Number.isFinite(capture.unitCalibration.measuredHeightInches)
          ? Number((capture.unitCalibration.measuredHeightInches * nextScale / oldScale).toFixed(2))
          : null
      } : undefined;
      return [capture, {
        modelScalePercent: nextScale, renderWidth: dimensions.renderWidth, renderHeight: dimensions.renderHeight,
        render: scaledFrameMetadata(capture.render, oldScale, nextScale),
        ...(unitCalibration ? { unitCalibration } : {})
      }];
    });
    for (const [capture, metadata] of changes) Object.assign(capture, metadata);
    if (!modelReady && savedSettings) {
      // Workspace geometry stays at its base 100% size; the renderer applies
      // this percentage when restoring its display and capture cameras.
      savedSettings = { ...savedSettings, modelScalePercent: nextScale };
    }
    refreshControls();
    saveWorkspace();
  }

  async function legacyCombatWorkspace() {
    const draft = await loadStudioDraft();
    if (!draft) return null;
    const manifest = validateSpriteSetManifest(draft.manifest);
    const { width, height, anchorX, anchorY, renderWidth, renderHeight } = manifest.frame;
    const captureRows = {};
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    for (const pose of SPRITE_POSES.filter(pose => manifest.poses[pose])) {
      const raw = new Uint8Array(width * height * 6 * 4);
      for (let index = 0; index < SPRITE_DIRECTIONS.length; index++) {
        const facing = SPRITE_DIRECTIONS[index];
        const file = draft.files?.[manifest.poses[pose].frames[facing]];
        if (!(file instanceof Blob)) throw new Error('An older combat draft is missing a PNG. The saved draft has been left intact.');
        const bitmap = await createImageBitmap(file);
        try {
          if (bitmap.width !== width || bitmap.height !== height) throw new Error('An older combat draft has inconsistent PNG sizes.');
          context.clearRect(0, 0, width, height);
          context.drawImage(bitmap, 0, 0);
          const pixels = context.getImageData(0, 0, width, height).data;
          for (let y = 0; y < height; y++) {
            const atlasY = height * 2 - 1 - (Math.floor(index / 3) * height + y);
            const offset = (atlasY * width * 3 + (index % 3) * width) * 4;
            raw.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), offset);
          }
        } finally { bitmap.close(); }
      }
      captureRows[pose] = {
        raw, width, height, anchorX, anchorY, renderWidth, renderHeight, bakedPixels: true,
        clip: manifest.poses[pose].clip, time: manifest.poses[pose].time,
        render: { ...manifest.render }, ...(manifest.layout ? { layout: manifest.layout } : {}),
        ...(manifest.mobType ? { mobType: manifest.mobType } : {}),
        ...(manifest.modelScalePercent === undefined ? {} : { modelScalePercent: manifest.modelScalePercent }),
        ...(manifest.hexScalePercent === undefined ? {} : { hexScalePercent: manifest.hexScalePercent })
      };
    }
    // Older drafts contain finished PNGs, so neutral adjustments preserve their
    // exact palette pixels. The captured outline is already part of those pixels.
    const neutralStyle = { ...getStyle(), brightness: 1, contrast: 1, hue: 0, saturation: 1, outline: 0 };
    const baseRender = scaledFrameMetadata(manifest.render,
      (manifest.modelScalePercent ?? 100) * (manifest.hexScalePercent ?? 100) / 100, 100);
    return {
      version: 1, name: manifest.label, style: neutralStyle, captures: captureRows,
      settings: {
        ...baseRender, modelName: manifest.render?.model || manifest.label,
        sourceFiles: [], isDemo: false, width, height,
        layoutId: manifest.layout?.id || 'single', resolutionPercent: manifest.layout?.resolutionPercent || (width / 160 * 100),
        ...(manifest.layout ? { layout: manifest.layout } : {}), mobType: manifest.mobType || 'kobold',
        modelScalePercent: manifest.modelScalePercent ?? 100,
        hexScalePercent: manifest.hexScalePercent ?? 100,
        ...(manifest.unit?.calibration ? {
          unitCalibration: {
            version: 1,
            mobType: manifest.unit.type,
            modelId: manifest.unit.modelId ?? null,
            modelName: manifest.unit.modelName ?? null,
            pose: 'T-Pose',
            modelScalePercent: manifest.unit.calibration.modelScalePercent,
            measuredHeightInches: manifest.unit.calibration.measuredHeightInches ?? null
          }
        } : {})
      },
      savedAt: draft.savedAt, recoveredFromCombat: true
    };
  }

  async function restore({ fromCombat = false } = {}) {
    busy = true;
    refreshControls();
    workspaceStatus('Checking for saved captures…');
    try {
      const editable = await loadStudioWorkspace();
      const tested = fromCombat ? await loadStudioWorkspace({fromCombat:true}) : null;
      const savedWorkspace = editable && (!tested || (editable.savedAt||0)>=(tested.savedAt||0))
        ? editable : tested || await legacyCombatWorkspace();
      if (!savedWorkspace) {
        workspaceStatus('Captures and studio settings save automatically in this browser.');
        return null;
      }
      const workspace = upgradeCaptureWorkspace(upgradeStudioWorkspaceHexScale(savedWorkspace));
      captureLibraryId=workspace.captureLibraryId||workspace.settings.poseLibrary?.id||null;libraryCaptures=workspace.libraryCaptures||{};
      legacySharedCaptures=workspace.legacySharedCaptures||{};
      const staged = {};
      for (const [pose, saved] of Object.entries(workspace.captures||{})) {
        const captured = { ...saved };
        captured.edgeDirections = frameEdgeDirections(captured);
        quantizeCapture(captured, workspace.style);
        staged[pose] = captured;
      }
      // Only commit once every row has been decoded and re-rendered successfully.
      capturesByProfile.clear();
      for(const [id,group] of Object.entries({...workspace.actionProfiles,...workspace.sharedActionGroups})){
        if(!CAPTURE_GROUP_CATALOG.has(id))continue;
        const rows={};
        for(const [pose,saved] of Object.entries(group)){
          const captured={...saved};captured.edgeDirections=frameEdgeDirections(captured);
          quantizeCapture(captured,workspace.style);rows[pose]=captured;
        }
        capturesByProfile.set(id,rows);
      }
      selectedProfileId=workspace.settings.actionProfileId==='spell-casting'?'magic':CAPTURE_GROUP_CATALOG.has(workspace.settings.actionProfileId)?workspace.settings.actionProfileId:'one-handed-swing';
      weaponProfileId=ACTION_PROFILE_CATALOG.has(workspace.settings.weaponActionProfileId)?workspace.settings.weaponActionProfileId:(isSharedCaptureGroup(selectedProfileId)?'one-handed-swing':selectedProfileId);
      captures=capturesByProfile.get(selectedProfileId)||staged;
      capturesByProfile.set(selectedProfileId,captures);
      style = { ...workspace.style };
      savedSettings = workspace.settings;
      equipmentByProfile.clear();
      for(const [id,value] of Object.entries(workspace.profileEquipment||{}))if(CAPTURE_GROUP_CATALOG.has(id))equipmentByProfile.set(id,value);
      windupDurationMs=workspace.settings.windupDurationMs??250;
      ui.SpriteSetName.value = workspace.name;
      if(ui.ActionProfile)ui.ActionProfile.value=selectedProfileId;
      if(ui.ActionPose)ui.ActionPose.value=SPRITE_POSES.includes(workspace.settings.selectedActionPose)?workspace.settings.selectedActionPose:'ready';

      modelReady = false;
      restored = true;
      refresh();
      const note = workspace.recoveredFromCombat
        ? 'Recovered the sprites from your earlier combat test. They are ready to export; color adjustments now start from those saved PNGs.'
        : `Restored ${count()} captured sprites${fromCombat ? ' from your combat test' : ''}. You can continue editing or export this set.`;
      ui.SheetStatus.textContent = note;
      workspaceStatus('Saved captures restored in this browser.');
      let persisted = true;
      if (fromCombat || workspace.recoveredFromCombat || workspace !== savedWorkspace) {
        // The tested copy becomes the editable workspace before its return flag
        // can be removed, so a subsequent reload keeps any new edits.
        try { await queueSave(); }
        catch { persisted = false; }
      }
      return {
        settings: workspace.settings, style: { ...style }, name: workspace.name,
        captureCount: totalCount(), savedAt: workspace.savedAt, recoveredFromCombat: !!workspace.recoveredFromCombat,
        persisted
      };
    } catch (error) {
      workspaceStatus(error.message, true);
      throw error;
    } finally {
      busy = false;
      refreshControls();
    }
  }


  ui.ActionPose?.addEventListener('change',saveWorkspace);

  ui.ClearPosesButton.addEventListener('click', () => {
    if (busy) return;
    captures = {};
    capturesByProfile.set(selectedProfileId,captures);
    refresh();
    queueSave();
    document.dispatchEvent(new CustomEvent('studio-captures-changed'));
    ui.SheetStatus.textContent = 'Sheet cleared. Framing, front direction, footprint, resolution and lighting can be changed again.';
  });

  ui.SpriteSetName.addEventListener('input', saveWorkspace);
  window.addEventListener('pagehide', () => { if (saveTimer) queueSave(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) queueSave(); });

  return Object.freeze({
    reset, snapshot, saveWorkspace, flushSave, updateModelScale, invalidateCaptures, refreshControls,
    switchActionProfile, selectCaptureLibrary, clearLibraryCaptures,
    captureStates:()=>Object.fromEntries([...capturesByProfile].map(([id,group])=>[id,Object.fromEntries(Object.entries(group).map(([pose,c])=>[pose,{clipSourceId:c.clipSourceId,time:c.time,stale:!!c.stale}]))])),
    recipeProfiles:()=>Object.fromEntries([...capturesByProfile].map(([id,poses])=>[id,Object.fromEntries(Object.entries(poses).map(([pose,capture])=>[pose,{clip:capture.clip,clipSourceId:capture.clipSourceId,time:capture.time}]))])),
    setEquipmentBusy(value){
      if(equipmentBusy===!!value)return;
      equipmentBusy=!!value;refreshControls();
    },
    setModelReady(ready) {
      modelReady = !!ready;
      if (modelReady) savedSettings = null;
      refresh();
    },
    updateMetadata() {
      if (!modelReady && savedSettings) {
        const current = getWorkspaceSettings();
        savedSettings = { ...savedSettings, mobType: current.mobType || savedSettings.mobType };
        // A recovered sheet can be cleared without restoring its source model.
        // Once empty, its chosen format must update placeholders and autosave.
        if (!count()) for (const key of ['layout', 'layoutId', 'resolutionPercent', 'width', 'height', 'lighting', 'hexScalePercent']) {
          if (current[key] !== undefined) savedSettings[key] = current[key];
        }
      }
      refresh();
      saveWorkspace();
    },
    restore,
    updateStyle(nextStyle) {
      style = nextStyle;
      for(const group of capturesByProfile.values())Object.values(group).forEach(captured => quantizeCapture(captured));
      refresh();
      saveWorkspace();
    }
  });
}
