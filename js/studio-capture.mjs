import { quantizeRgba } from './studio-core.mjs?v=R238C99';
import {
  SPRITE_DIRECTIONS, SPRITE_POSES, spriteSetSlug, createSpriteSetManifest,
  splitSixFacingAtlas, assembleSpriteSheet, validateSpriteSetManifest
} from './sprite-set-core.mjs?v=R238C95';
import {
  saveStudioDraft, loadStudioDraft, saveStudioWorkspace, loadStudioWorkspace,
  upgradeStudioWorkspaceHexScale
} from './sprite-set-store.mjs?v=R238C93';
import { spriteLayoutDimensions, validateSpriteModelScale, validateSpriteHexScale } from './sprite-layouts.mjs?v=R238C95';
import { zipSync, strToU8 } from '../assets/vendor/three/addons/libs/fflate.module.js';

const poseLabel = pose => pose[0].toUpperCase() + pose.slice(1);
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
export function createPoseCapture({ readPose, getStyle, getWorkspaceSettings = () => ({}), onLockChange, onError, onStatus }) {
  const byId = suffix => document.getElementById(`studio${suffix}`);
  const ui = Object.fromEntries([
    'CaptureCount', 'SpriteSetName', 'PoseSheetRows', 'SheetStatus', 'CaptureLockNote',
    'ExportPoseSheetButton', 'ExportPackageButton', 'TestCombatButton', 'ClearPosesButton', 'WorkspaceStatus'
  ].map(name => [name, byId(name)]));
  const rows = new Map();
  let captures = {}, style = getStyle(), busy = false, modelReady = false;
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
    const first = Object.values(captures)[0];
    settings.hexScalePercent = validateSpriteHexScale(first ? first.hexScalePercent : settings.hexScalePercent);
    return {
      version: 1, name: ui.SpriteSetName.value.slice(0, 120), style: { ...style }, settings,
      captures: Object.fromEntries(Object.entries(captures).map(([pose, value]) => {
        const { frames, battlefieldFrames, ...saved } = value;
        return [pose, saved];
      }))
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
    const button = byId(`Capture${poseLabel(pose)}Button`);
    button.addEventListener('click', () => capture(pose));
    rows.set(pose, { tr, detail, clear, canvases, button });
  }

  function count() { return Object.keys(captures).length * 6; }
  function modelScaleAdjustable() { return Object.values(captures).every(capture => !!capture.layout && !capture.battlefieldRaw); }

  function refreshControls() {
    const captured = count();
    const locked = captured > 0;
    onLockChange(locked);
    ui.CaptureCount.textContent = `${captured} / 18 sprites`;
    ui.ClearPosesButton.disabled = busy || !locked;
    for (const button of [ui.ExportPoseSheetButton, ui.ExportPackageButton, ui.TestCombatButton]) {
      button.disabled = busy || captured !== 18;
    }
    for (const row of rows.values()) {
      row.button.disabled = busy || !modelReady;
      row.clear.disabled = busy;
    }
    ui.CaptureLockNote.classList.toggle('locked', locked);
    ui.CaptureLockNote.textContent = locked
      ? `Framing, footprint, resolution, lighting and equipment are shared by this set. Clear all captured poses to change them. Colors, outline and target mob remain adjustable.${modelScaleAdjustable() ? ' Model size can also be changed without recapturing.' : ''}`
      : 'Set the footprint, resolution, model size, lighting, equipment and model front before your first capture. Fit all animations restores room for the full movement.';
  }

  function refresh() {
    const settings = !modelReady && savedSettings ? savedSettings : getWorkspaceSettings();
    const first = Object.values(captures)[0];
    const emptyWidth = first?.width || settings.width || 160;
    const emptyHeight = first?.height || settings.height || 200;
    for (const pose of SPRITE_POSES) {
      const capture = captures[pose], row = rows.get(pose);
      row.tr.classList.toggle('captured', !!capture);
      row.tr.classList.toggle('touches-edge', !!capture?.edgeDirections.length);
      row.clear.hidden = !capture;
      row.detail.textContent = capture ? `${capture.clip} · ${capture.time.toFixed(3)} s` : 'Not captured';
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
    }
  }

  function capture(pose) {
    if (busy || !modelReady) return;
    try {
      const captured = readPose();
      const first = Object.values(captures)[0];
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
      quantizeCapture(captured);
      captures[pose] = captured;
      refresh();
      queueSave();
      const complete = count() === 18;
      const note = `${poseLabel(pose)} captured at ${captured.time.toFixed(3)} s · six facings saved.`;
      const edgeNote = captured.edgeDirections.length
        ? 'A sprite touches the frame edge. If it is cropped, clear the sheet and choose Fit all animations before capturing again.'
        : complete ? 'All 18 sprites are ready to export or test.' : 'Capture the remaining poses to complete the set.';
      ui.SheetStatus.textContent = `${note} ${edgeNote}`;
      onStatus(note);
    } catch (error) { onError(error); }
  }

  function snapshot() {
    const first = Object.values(captures)[0];
    return {
      captureCount: count(), captureLocked: count() > 0, modelScaleAdjustable: modelScaleAdjustable(),
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

  function buildExport() {
    if (count() !== 18) throw new Error('Capture all three poses before exporting or testing the set.');
    const { width, height, anchorX, anchorY, render, layout, modelScalePercent, hexScalePercent,
      renderWidth = 48, renderHeight = 48 * height / width } = captures.ready;
    const settings = !modelReady && savedSettings ? savedSettings : getWorkspaceSettings();
    const mobType = settings.mobType || captures.ready.mobType;
    const calibration = captures.ready.unitCalibration || settings.unitCalibration || null;
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
    const battlefield = captures.ready.battlefieldFrames ? {
      renderer:'native-battlefield-v1',
      width:captures.ready.battlefieldWidth,
      height:captures.ready.battlefieldHeight,
      anchorX:captures.ready.battlefieldAnchorX,
      anchorY:captures.ready.battlefieldAnchorY
    } : undefined;
    const manifest = createSpriteSetManifest({
      id: spriteSetSlug(label), label,
      frame: { width, height, renderWidth, renderHeight, anchorX, anchorY },
      ...(layout ? { layout } : {}), ...(mobType ? { mobType } : {}),
      ...(modelScalePercent === undefined ? {} : { modelScalePercent }),
      ...(hexScalePercent === undefined ? {} : { hexScalePercent }),
      ...(unit ? { unit } : {}),
      ...(battlefield ? { battlefield } : {}),
      captures: Object.fromEntries(SPRITE_POSES.map(pose => [pose, { clip: captures[pose].clip, time: captures[pose].time }])),
      render: {
        ...render, brightness: style.brightness, contrast: style.contrast,
        hue: style.hue, saturation: style.saturation, outline: style.outline,
        palette: 'Adventure Party VGA 256'
      }
    });
    const poseFrames = Object.fromEntries(SPRITE_POSES.map(pose => [pose, captures[pose].frames]));
    const battlefieldPoseFrames = battlefield
      ? Object.fromEntries(SPRITE_POSES.map(pose=>[pose,captures[pose].battlefieldFrames]))
      : null;
    return {
      manifest,poseFrames,battlefieldPoseFrames,
      sheet:assembleSpriteSheet(poseFrames,width,height),
      workspace:workspaceSnapshot()
    };
  }

  async function packageFiles(exported) {
    const { manifest, poseFrames, battlefieldPoseFrames, sheet } = exported;
    const { width, height } = manifest.frame;
    const jobs = SPRITE_POSES.flatMap(pose => SPRITE_DIRECTIONS.map(async direction => [
      manifest.poses[pose].frames[direction], await pngBlob(poseFrames[pose][direction], width, height)
    ]));
    if(manifest.battlefield && battlefieldPoseFrames){
      for(const pose of SPRITE_POSES){
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
    jobs.push(pngBlob(sheet.data, sheet.width, sheet.height).then(blob => [manifest.sheet.file, blob]));
    return Object.fromEntries(await Promise.all(jobs));
  }

  async function runExport(task) {
    if (busy) return;
    busy = true;
    refreshControls();
    try { await task(buildExport()); }
    catch (error) { onError(error); ui.SheetStatus.textContent = 'Export did not finish. Your captured poses are still here.'; }
    finally { busy = false; refreshControls(); }
  }

  ui.ExportPoseSheetButton.addEventListener('click', () => runExport(async ({ manifest, sheet }) => {
    download(await pngBlob(sheet.data, sheet.width, sheet.height), `${manifest.id}-18-sprites-${manifest.frame.width}x${manifest.frame.height}.png`);
    ui.SheetStatus.textContent = 'Sheet exported: six columns (E, NE, NW, W, SW, SE), three rows (ready, attack, prone).';
  }));

  ui.ExportPackageButton.addEventListener('click', () => runExport(async exported => {
    const files = await packageFiles(exported);
    const { manifest } = exported;
    const entries = await Promise.all(Object.entries(files).map(async ([name, blob]) => [
      `${manifest.id}/${name}`, new Uint8Array(await blob.arrayBuffer())
    ]));
    entries.push([`${manifest.id}/manifest.json`, strToU8(`${JSON.stringify(manifest, null, 2)}\n`)]);
    download(new Blob([zipSync(Object.fromEntries(entries), { level: 0 })], { type: 'application/zip' }), `${manifest.id}-sprite-set.zip`);
    ui.SheetStatus.textContent = 'Game assets exported: 18 separate PNGs, sheet.png and manifest.json. Import the ZIP to add this set to the game.';
  }));

  ui.TestCombatButton.addEventListener('click', () => {
    if (busy || count() !== 18) return;
    runExport(async exported => {
      ui.SheetStatus.textContent = 'Saving your captured sprites before opening combat…';
      const files = await packageFiles(exported);
      await flushSave();
      // Finish saving the exact test set and return workspace before leaving
      // this page. A failed save leaves the studio and its captures open.
      await saveStudioDraft({ manifest: exported.manifest, files, workspace: exported.workspace });
      window.location.assign(new URL('./index.html?studioSprite=draft', window.location.href).href);
    });
  });

  function reset(name, { persist = true } = {}) {
    captures = {};
    style = getStyle();
    savedSettings = null;
    restored = false;
    ui.SpriteSetName.value = String(name).replace(/\.[^.]+$/, '');
    refresh();
    ui.SheetStatus.textContent = 'Capture ready, attack and prone to export or test the complete set.';
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
    for (const pose of SPRITE_POSES) {
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
      const savedWorkspace = await loadStudioWorkspace({ fromCombat }) || await legacyCombatWorkspace() ||
        (fromCombat ? await loadStudioWorkspace() : null);
      if (!savedWorkspace) {
        workspaceStatus('Captures and studio settings save automatically in this browser.');
        return null;
      }
      const workspace = upgradeStudioWorkspaceHexScale(savedWorkspace);
      const staged = {};
      for (const [pose, saved] of Object.entries(workspace.captures)) {
        const captured = { ...saved };
        captured.edgeDirections = frameEdgeDirections(captured);
        quantizeCapture(captured, workspace.style);
        staged[pose] = captured;
      }
      // Only commit once every row has been decoded and re-rendered successfully.
      captures = staged;
      style = { ...workspace.style };
      savedSettings = workspace.settings;
      ui.SpriteSetName.value = workspace.name;
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
        captureCount: count(), savedAt: workspace.savedAt, recoveredFromCombat: !!workspace.recoveredFromCombat,
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

  ui.ClearPosesButton.addEventListener('click', () => {
    if (busy) return;
    captures = {};
    refresh();
    queueSave();
    ui.SheetStatus.textContent = 'Sheet cleared. Framing, front direction, footprint, resolution and lighting can be changed again.';
  });

  ui.SpriteSetName.addEventListener('input', saveWorkspace);
  window.addEventListener('pagehide', () => { if (saveTimer) queueSave(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) queueSave(); });

  return Object.freeze({
    reset, snapshot, saveWorkspace, flushSave, updateModelScale,
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
      Object.values(captures).forEach(captured => quantizeCapture(captured));
      refresh();
      saveWorkspace();
    }
  });
}
