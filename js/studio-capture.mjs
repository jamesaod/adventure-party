import { quantizeRgba } from './studio-core.mjs?v=R237C46';
import {
  SPRITE_DIRECTIONS, SPRITE_POSES, spriteSetSlug, createSpriteSetManifest,
  splitSixFacingAtlas, assembleSpriteSheet
} from './sprite-set-core.mjs?v=R237C46';
import { saveStudioDraft } from './sprite-set-store.mjs?v=R237C46';
import { zipSync, strToU8 } from '../assets/vendor/three/addons/libs/fflate.module.js';

const poseLabel = pose => pose[0].toUpperCase() + pose.slice(1);

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
export function createPoseCapture({ readPose, getStyle, onLockChange, onError, onStatus }) {
  const byId = suffix => document.getElementById(`studio${suffix}`);
  const ui = Object.fromEntries([
    'CaptureCount', 'SpriteSetName', 'PoseSheetRows', 'SheetStatus', 'CaptureLockNote',
    'ExportPoseSheetButton', 'ExportPackageButton', 'TestCombatButton', 'ClearPosesButton'
  ].map(name => [name, byId(name)]));
  const rows = new Map();
  let captures = {}, style = getStyle(), busy = false;

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
      row.button.disabled = busy;
      row.clear.disabled = busy;
    }
    ui.CaptureLockNote.classList.toggle('locked', locked);
    ui.CaptureLockNote.textContent = locked
      ? 'Framing, front direction and resolution are shared by this set. Clear all captured poses to change them. Colors and outline remain adjustable.'
      : 'Animation clips are fitted together. Set the front and resolution before your first capture. Fit all animations restores room for the full movement.';
  }

  function refresh() {
    for (const pose of SPRITE_POSES) {
      const capture = captures[pose], row = rows.get(pose);
      row.tr.classList.toggle('captured', !!capture);
      row.tr.classList.toggle('touches-edge', !!capture?.edgeDirections.length);
      row.clear.hidden = !capture;
      row.detail.textContent = capture ? `${capture.clip} · ${capture.time.toFixed(3)} s` : 'Not captured';
      if (capture?.edgeDirections.length) row.detail.textContent += ` · Touches frame edge: ${capture.edgeDirections.join(', ')}`;
      for (const direction of SPRITE_DIRECTIONS) {
        const canvas = row.canvases[direction];
        canvas.width = capture?.width || 160;
        canvas.height = capture?.height || 200;
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        if (capture) context.putImageData(new ImageData(capture.frames[direction], capture.width, capture.height), 0, 0);
        canvas.setAttribute('aria-label', `${poseLabel(pose)}, ${direction} facing — ${capture ? 'captured' : 'not captured'}`);
      }
    }
    refreshControls();
  }

  function quantizeCapture(capture) {
    const { width, height, raw } = capture;
    const rgba = new Uint8ClampedArray(raw.length);
    quantizeRgba(raw, width * 3, height * 2, rgba, {
      ...style, transparent: true, tileWidth: width, tileHeight: height
    });
    capture.frames = splitSixFacingAtlas(rgba, width, height);
  }

  function capture(pose) {
    if (busy) return;
    try {
      const captured = readPose();
      const first = Object.values(captures)[0];
      if (first && (first.width !== captured.width || first.height !== captured.height)) {
        throw new Error('Clear the sheet before changing its sprite resolution.');
      }
      style = getStyle();
      captured.edgeDirections = frameEdgeDirections(captured);
      quantizeCapture(captured);
      captures[pose] = captured;
      refresh();
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
      captureCount: count(), captureLocked: count() > 0,
      groundAnchor: first ? [first.anchorX, first.anchorY] : null,
      captures: Object.fromEntries(Object.entries(captures).map(([pose, value]) => [pose, {
        clip: value.clip, time: value.time, width: value.width, height: value.height,
        edgeDirections: [...value.edgeDirections]
      }]))
    };
  }

  function buildExport() {
    if (count() !== 18) throw new Error('Capture all three poses before exporting or testing the set.');
    const { width, height, anchorX, anchorY, render } = captures.ready;
    const label = ui.SpriteSetName.value.trim() || 'Studio character';
    const manifest = createSpriteSetManifest({
      id: spriteSetSlug(label), label,
      frame: { width, height, renderWidth: 48, renderHeight: 48 * height / width, anchorX, anchorY },
      captures: Object.fromEntries(SPRITE_POSES.map(pose => [pose, { clip: captures[pose].clip, time: captures[pose].time }])),
      render: {
        ...render, brightness: style.brightness, contrast: style.contrast,
        hue: style.hue, saturation: style.saturation, outline: style.outline,
        palette: 'Adventure Party VGA 256'
      }
    });
    const poseFrames = Object.fromEntries(SPRITE_POSES.map(pose => [pose, captures[pose].frames]));
    return { manifest, poseFrames, sheet: assembleSpriteSheet(poseFrames, width, height) };
  }

  async function packageFiles(exported) {
    const { manifest, poseFrames, sheet } = exported;
    const { width, height } = manifest.frame;
    const jobs = SPRITE_POSES.flatMap(pose => SPRITE_DIRECTIONS.map(async direction => [
      manifest.poses[pose].frames[direction], await pngBlob(poseFrames[pose][direction], width, height)
    ]));
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
    // Open during the user's click, before asynchronous PNG/IndexedDB work.
    const tab = window.open('', '_blank');
    if (!tab) {
      onError(new Error('The combat tab was blocked. Allow a new tab for this site, then choose Test in combat again.'));
      return;
    }
    tab.document.title = 'Preparing sprite test — Adventure Party';
    tab.document.body.textContent = 'Preparing your captured sprite set…';
    runExport(async exported => {
      try {
        const files = await packageFiles(exported);
        await saveStudioDraft({ manifest: exported.manifest, files });
        tab.opener = null;
        tab.location.href = new URL('./index.html?studioSprite=draft', window.location.href).href;
        ui.SheetStatus.textContent = 'Combat test opened with your captured set. Use Ready, Attack and Prone to inspect it before starting the battle.';
      } catch (error) { tab.close(); throw error; }
    });
  });

  function reset(name) {
    captures = {};
    style = getStyle();
    ui.SpriteSetName.value = String(name).replace(/\.[^.]+$/, '');
    refresh();
    ui.SheetStatus.textContent = 'Capture ready, attack and prone to export or test the complete set.';
  }

  ui.ClearPosesButton.addEventListener('click', () => {
    if (busy) return;
    captures = {};
    refresh();
    ui.SheetStatus.textContent = 'Sheet cleared. Framing, front direction and resolution can be changed again.';
  });

  return Object.freeze({
    reset, snapshot,
    updateStyle(nextStyle) {
      style = nextStyle;
      Object.values(captures).forEach(quantizeCapture);
      refresh();
    }
  });
}
