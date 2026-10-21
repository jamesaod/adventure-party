# 3d studio

Open **3d studio** from the Adventure Party title page. The dedicated page has a central interactive model view, six live pixel views on the left, and model/orientation controls on the right. A small articulated demo character loads immediately.

## Load and align a model

1. Choose **Load model**, or drop a model onto the central viewport.
2. Select one `.glb`, `.gltf`, or `.fbx` model. For a model with external buffers or textures, select those files together with it. A self-contained GLB is the simplest handoff.
3. Use **Front adjustment** if the exported model faces a different direction. The studio's canonical model faces +Z with +Y up. **Model's up direction** can correct a Z-up export.
4. Select a direction under the main window to inspect that facing. Drag the main window to orbit, scroll to zoom, and use **Reset view** to return to the game's elevated angle. These free camera movements leave the six fixed pixel cameras aligned to the board.
5. Animated models are automatically framed across their clips, including the rest pose and animation endpoints, with room around the movement. **Fit all animations** repeats that fit. **Fit model** fits only the current pose when you deliberately want a tighter frame. Check the six previews before capturing a set.

Files are read locally by the browser. Selecting a model does not upload it or replace a game asset. Errors retain the last usable model. Unsupported compressed glTF extensions produce an export-without-compression message; see [third-party dependencies](THIRD_PARTY_3D_STUDIO.md) for loader scope.

## Pixel previews and export

- Preview windows use two columns in three rows: **NW, NE**; **W, E**; **SW, SE**, at every screen width.
- All six views use the existing Pixel Editor's fixed 256-entry VGA palette: 16 RGBI entries, a 216-color cube, and 24 gray entries.
- Select **80 × 100**, **160 × 200**, or **320 × 400 · Mode X**. The default is 160 × 200. Preview backgrounds are palette gray; images display with nearest-neighbor scaling.
- **Brightness**, **Contrast**, **Hue**, and **Saturation** update all six pixel previews and saved PNGs together. Brightness, contrast, and saturation range from 0–200% (100% is neutral); hue shifts from −180° to +180° (0° is neutral). **Reset colors** restores all four defaults.
- **Outline width** adds a black outline from **0–10 pixels** at the selected sprite resolution, with a default of 1 pixel. Set it to 0 to turn the outline off. All six previews and PNG exports use the same width; each sheet cell keeps its outline within its own frame.
- Color adjustments happen before VGA palette matching. The gray preview background, transparent export background, and black outline keep their original colors. The central 3D model view shows the source material colors for reference. **Reset colors** resets the four color controls independently of outline width.
- Each **Save PNG** button exports that facing at the selected native resolution, with a transparent background.
- **Save all six as a sheet** exports one transparent sheet in this order: top row **E, NE, NW**; bottom row **W, SW, SE**. All cells have identical dimensions and capture the same pose.

The original imported ready sheet remains available in **Combat System Test → 6-facing Kobold**. The three-pose workflow below adds new complete sets without changing that artwork.

## Capture ready, attack and prone

1. Load the FBX containing the model and its animations. Choose a clip, press **Pause**, and drag the timeline to the moment you want. Scrubbing pauses playback and can hold the final instant of a clip. A static model or **Rest pose** can also be captured.
2. Choose **Capture ready pose**, **Capture attack pose**, or **Capture prone pose**. Each button pauses playback, evaluates no additional animation time, and saves all six physical facings from that same instant. A button replaces only its own row when clicked again.
3. Repeat with any clip/time for the other two poses. A live table beneath the studio fills the 18 slots, with the clip name and precise capture time beside each row. The labels describe how the game will use the image; choose the appropriate moment yourself.
4. Set a recognizable **Sprite set name**. Once all three rows are filled, export or test the complete set.

The first captured row locks **Fit model**, **Fit all animations**, **Front adjustment**, **Model's up direction**, and **Preview resolution**. Every pose therefore shares one frame, scale and projected ground anchor. Orbiting the central viewer and choosing animation clips still work. **Brightness**, **Contrast**, **Hue**, **Saturation**, and **Outline width** reprocess the saved source pixels for every row, so you can adjust the entire set without recapturing it. The 3D source model retains its original colors.

Use a row's **Clear** button to replace that pose, or **Clear sheet** to unlock framing and start a new set. Loading a new valid model clears the previous captures; a failed model load keeps the previous model and sheet. The working captures remain in the open studio tab. Export the ZIP before closing or refreshing it if you need to keep them.

The automatic fit samples animation poses; unusual motion between samples can still reach beyond the frame. A captured row flags the specific directions whose source silhouette touches an image edge. Inspect that row; if it is cropped, clear the sheet and adjust framing before recapturing. The exporter retains the chosen source pixels and full transparent padding.

### Complete sheet and separate assets

**Export 18-sprite sheet** saves a transparent PNG with six direction columns and three pose rows:

| Row | Column 1 | Column 2 | Column 3 | Column 4 | Column 5 | Column 6 |
| --- | --- | --- | --- | --- | --- | --- |
| Ready | E | NE | NW | W | SW | SE |
| Attack | E | NE | NW | W | SW | SE |
| Prone | E | NE | NW | W | SW | SE |

At the default 160 × 200 frame size, the sheet is **960 × 600**. It has no captions, dividers or preview background baked into its pixels. This new layout is separate from the existing **Save all six as a sheet** button, which keeps its original 3 × 2 layout.

**Export game assets (ZIP)** saves one character folder containing the same sheet, **18 individual transparent PNGs**, and **manifest.json**. Each frame remains at its native resolution with its padding intact. The manifest records the frame dimensions, source-space anchor, 48 × 60 default game presentation, physical direction, pose, animation name/time and shared render settings. No image data is embedded in game JavaScript.

### Quick combat check and permanent import

**Test in combat** opens Combat Setup in a new tab with the captured set selected. The studio model and captures stay open. The handoff uses local browser storage for this site's path; it does not upload the model or write to GitHub. Start the six-character test and use **Ready**, **Attack**, **Prone**, or **Live** during the initial paused inspection to check each pose from all six directions. Starting battle clears that visual inspection override, and combat chooses poses normally.

For a permanent asset addition, export the ZIP and run the small importer from the repository:

```sh
node scripts/import-sprite-set.mjs /path/to/character-sprite-set.zip
```

This writes `assets/sprites/<set-id>/` and updates `data/sprite-sets.json`. The game loads that small index and each character's manifest; another character does not require adding 18 image declarations to the main game file. Re-importing the same ID replaces that set while retaining other sets. Follow the existing validation and candidate publishing flow. See [Sprite set import](SPRITE_SET_IMPORT.md) for the complete file contract and [Six-direction combat sprites](DIRECTIONAL_SPRITES.md) for runtime pose behavior.

## Six-direction geometry

The board's `HEX_W = 64`, `HEX_H = 42`, and `HEX_ROW = 31.5` imply an orthographic elevation of approximately 34.6338 degrees. The studio uses that fixed angle for pixel rendering. Model yaw is measured around +Y, starting from a +Z-forward model:

| Facing | Model yaw | Projected board-neighbor direction |
| --- | ---: | --- |
| E | 90° | `(64, 0)` |
| NE | 150° | `(32, -31.5)` |
| NW | 210° | `(-32, -31.5)` |
| W | 270° | `(-64, 0)` |
| SW | 330° | `(-32, 31.5)` |
| SE | 30° | `(32, 31.5)` |

These are physical 60-degree rotations of one complete model. Equipment and handedness therefore rotate with the geometry. The studio does not mirror a left-facing sprite to manufacture the opposite side. `js/studio-core.mjs` owns this projection and palette mapping; its tests check the result against the board vectors and the existing editor palette.

## Animation

Embedded model clips are available immediately, with clip selection, rest pose, play/pause, restart, speed, and timeline scrubbing. The demo includes **Idle**, **Attack**, and **Fall** clips for trying the three captures. Models without clips remain usable as static models.

One `AnimationMixer` evaluates the pose once per frame. A single WebGL renderer then renders all six orientations into a 3 × 2 offscreen atlas before one readback and palette conversion. The central viewer uses the same model and evaluated pose. Pixel previews update at up to 30 frames per second; all six update together. Rendering pauses when the page is hidden or the studio is offscreen.

The three pose captures save still frames from the chosen animation moments. Continuous frame-sequence export and animation-only retargeting remain outside this workflow. Keep animations with their model/rig in the FBX; choose its external textures alongside it when applicable.

## Development

- Page: `3d-studio.html`; scoped styles: `css/3d-studio.css`.
- Renderer, import, playback, and export: `js/3d-studio.mjs`.
- Saved pose rows and PNG/ZIP export: `js/studio-capture.mjs`.
- Manifest/layout contract: `js/sprite-set-core.mjs`; local combat handoff: `js/sprite-set-store.mjs`.
- Game registration: `js/sprite-set-runtime.mjs`; permanent import: `scripts/import-sprite-set.mjs`.
- Pure projection and color functions: `js/studio-core.mjs`.
- The title-page router only navigates to the studio. The game does not load Three.js until the studio page opens.
- Pinned renderer/loaders and licenses are served locally from `assets/vendor/three/`.
- Run `node scripts/test-3d-studio.mjs`, `node scripts/test-sprite-set-package.mjs`, `node scripts/test-directional-sprites.mjs`, `node --check js/3d-studio.mjs`, and the existing `node scripts/validate-repo.mjs` checks.

Browser QA should include model loading with embedded and external textures, a skinned animation, same-frame six-view output, a 60-degree heading adjustment, pause/scrub including the final instant, capture/recapture/clear, shared style changes, outline widths 0/1/10, palette membership, native PNG and ZIP pixels, direct combat handoff, and a ZIP import into a temporary repository.
