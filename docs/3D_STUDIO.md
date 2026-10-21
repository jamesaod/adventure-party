# 3d studio

Open **3d studio** from the Adventure Party title page. The dedicated page has a central interactive model view, six live pixel views on the left, and model/orientation controls on the right. A small articulated demo character loads immediately.

## Load and align a model

1. Choose **Load model**, or drop a model onto the central viewport.
2. Select one `.glb`, `.gltf`, or `.fbx` model. For a model with external buffers or textures, select those files together with it. A self-contained GLB is the simplest handoff.
3. Use **Front adjustment** if the exported model faces a different direction. The studio's canonical model faces +Z with +Y up. **Model's up direction** can correct a Z-up export.
4. Select a direction under the main window to inspect that facing. Drag the main window to orbit, scroll to zoom, and use **Reset view** to return to the game's elevated angle. These free camera movements leave the six fixed pixel cameras aligned to the board.
5. **Fit model** frames the current pose consistently across all six pixel views. For a wide animation pose, pause/scrub to that pose and fit again if needed.

Files are read locally by the browser. Selecting a model does not upload it or replace a game asset. Errors retain the last usable model. Unsupported compressed glTF extensions produce an export-without-compression message; see [third-party dependencies](THIRD_PARTY_3D_STUDIO.md) for loader scope.

## Pixel previews and export

- Preview windows use two columns in three rows: **NW, NE**; **W, E**; **SW, SE**, at every screen width.
- All six views use the existing Pixel Editor's fixed 256-entry VGA palette: 16 RGBI entries, a 216-color cube, and 24 gray entries.
- Select **80 × 100**, **160 × 200**, or **320 × 400 · Mode X**. The default is 160 × 200. Preview backgrounds are palette gray; images display with nearest-neighbor scaling.
- Saturation is applied before palette matching. The optional one-pixel black outline also stays within the palette.
- Each **Save PNG** button exports that facing at the selected native resolution, with a transparent background.
- **Save all six as a sheet** exports one transparent sheet in this order: top row **E, NE, NW**; bottom row **W, SW, SE**. All cells have identical dimensions and capture the same pose.

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

Embedded model clips are available immediately, with clip selection, rest pose, play/pause, restart, speed, and timeline scrubbing. The demo includes an Idle clip. Models without clips remain usable as static models.

One `AnimationMixer` evaluates the pose once per frame. A single WebGL renderer then renders all six orientations into a 3 × 2 offscreen atlas before one readback and palette conversion. The central viewer uses the same model and evaluated pose. Pixel previews update at up to 30 frames per second; all six update together. Rendering pauses when the page is hidden or the studio is offscreen.

This provides the foundation for animation export. A future frame-sequence exporter should set an explicit clip time once, evaluate the mixer, capture all six views, and only then advance to the next timestamp. Preserve shared framing and palette across the sequence. Animation-only retargeting and baked frame-sequence export are not implemented in this version.

## Development

- Page: `3d-studio.html`; scoped styles: `css/3d-studio.css`.
- Renderer, import, playback, and export: `js/3d-studio.mjs`.
- Pure projection and color functions: `js/studio-core.mjs`.
- The title-page router only navigates to the studio. The game does not load Three.js until the studio page opens.
- Pinned renderer/loaders and licenses are served locally from `assets/vendor/three/`.
- Run `node scripts/test-3d-studio.mjs`, `node --check js/3d-studio.mjs`, and the existing `node scripts/validate-repo.mjs` checks.

Browser QA should include model loading with embedded and external textures, a skinned animation, same-frame six-view output, a 60-degree heading adjustment, pause/scrub, palette membership, and native-resolution transparent export.
