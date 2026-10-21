# 3d studio

Open **3d studio** from the Adventure Party title page. The dedicated page has a central interactive model view, six live pixel views on the left, and model/orientation controls on the right. It restores the last saved workspace when one exists; a small articulated demo character loads on the first visit.

## Load and align a model

1. Choose **Load model**, or drop a model onto the central viewport.
2. Select one `.glb`, `.gltf`, or `.fbx` model. For a model with external buffers or textures, select those files together with it. A self-contained GLB is the simplest handoff.
3. New models default to **Z** under **Model's up direction**. Choose **Y** for a Y-up source, and use **Front adjustment** if its front faces a different direction. Restoring a workspace preserves its saved up direction, including older Y-up choices. Internally the studio aligns the model to +Z forward with +Y up for rendering.
4. Select a direction under the main window to inspect that facing. Drag the main window to orbit, scroll to zoom, and use **Reset view** to return to the game's elevated angle with the model centered at **50% of the available width or height**. The camera fits the model; the 75-foot ruler can extend beyond the visible window. These free camera movements leave the six fixed pixel cameras aligned to the board.
5. Animated models are automatically framed across their clips, including the rest pose and animation endpoints, with room around the movement. **Fit all animations** repeats that fit. **Fit model** fits only the current pose when you deliberately want a tighter frame. Check the six previews before capturing a set.

Files are read locally by the browser. Selecting a model does not upload it or replace a game asset. Errors retain the last usable model. Unsupported compressed glTF extensions produce an export-without-compression message; see [third-party dependencies](THIRD_PARTY_3D_STUDIO.md) for loader scope.

## Choose the MOB, footprint and resolution

Before the first capture, choose the **MOB / player character**, **Footprint and sheet format**, and **Resolution**. The dropdown groups the seven implemented MOBs (Kobold, Kobold Body Guard, Kobold Slinger, Orc, Orc Leader, Orc Shaman, and Juvenile Red Dragon) and the test player characters: **Dungeon Crawler Carl — Fighter**, **Elven Ranger — Ranger**, and **Baub — Mage**. Combat tests use the selected character's existing statistics, controller and behavior. Selecting a target before capturing chooses its default footprint: single hex for the humanoids, or seven hexes for the dragon. You can then choose another footprint for the set.

The **Resolution** slider runs from **50–200% in 5% steps**, with 100% as the default. It changes the native PNG dimensions and pixel detail. The separate **Model size** slider runs from **25–2000% in 5% steps**, also defaulting to 100%. It changes how large the model appears against the floor footprint and how large its sprite renders in combat. The viewer automatically adjusts its zoom as Model size changes, keeping the model at the same on-screen size and position while preserving your viewing angle, pan, and manual zoom. The fixed-size footprint and height ruler show the change in battlefield scale. Changing resolution does not enlarge the creature, and changing model size does not resize the PNGs or change its occupied hexes.

| Footprint | Format ID | Source frame at 100% resolution | Complete sheet at 100% resolution | Game render size at 100% model size |
| --- | --- | --- | --- | --- |
| Single hex | `single` | 160 × 200 | 960 × 600 | 52.32 × 65.4 |
| Three-hex triangle: one above two | `triangle3` | 320 × 280 | 1920 × 840 | 104.64 × 91.56 |
| Three-hex inverted triangle: two above one | `triangle3-inverted` | 320 × 280 | 1920 × 840 | 104.64 × 91.56 |
| Seven hexes: center and surrounding ring | `hex7` | 480 × 400 | 2880 × 1200 | 156.96 × 130.8 |

The game render dimensions include **109% of the original hex-based scale**, a 1.09× exaggeration applied once. The physical model and height ruler use the same adjustment. Saved captures with layout metadata receive it once when reopened, preserving their captured pixels; previously exported packages retain their declared size.

These four arrangements describe the **E-facing** footprint shown in the studio diagram. The central model view also displays the selected occupied-hex footprint on its floor at the matching battlefield proportions, so you can judge model size against it. This floor guide is not baked into previews or exported artwork. Asymmetric footprints rotate with the unit's facing in combat. They determine occupied hexes for movement, collision and targeting; each creature remains one unit with one set of statistics. All formats retain the same eighteen-frame pose/direction mapping below.

Earlier two-wide (`wide2`), trapezoid (`trapezoid5`), and tall-diamond (`diamond4`) formats remain supported for recovering saved workspaces and importing or exporting existing sets. They are no longer choices for a new set. Recovery retains their original source dimensions and footprint instead of converting their artwork to a different format.

Model size multiplies the table's game render dimensions. For example, a single-hex set at 50% model size renders at 26.16 × 32.7; at 200% resolution its PNGs are still 320 × 400. Model size remains editable after capture: it updates the shared rendering metadata without recapturing or resampling the saved sprites. A recovered older capture without layout metadata retains its original scale and must be cleared and captured again before its model size can be adjusted.

### Measure model height

The Model View has a **0–75-foot ruler** beside the model, with one-foot ticks and labels every five feet. Its lower-right corner shows **Model height** in feet. Both use the battlefield's existing **10 feet per hex**, so the size shown agrees with the sprite's combat scale rather than relying on a source file's native units.

The readout measures the current pose's vertical mesh bounds, including equipment. It updates when the model is resized, reoriented, or animated; a prone pose therefore reads shorter than an upright pose. Changing **Model size** changes this height. Camera orbit, pan, zoom and source resolution do not change the measurement. **Reset view** restores a view containing the full ruler; zooming in can move some marks outside the window. Imported files are normalized to the shared sprite frame, so this is the model's in-game height, not its original authoring-unit measurement.

The ruler and height readout are viewing guides only. They are never included in pixel previews, captured poses, PNGs, or the exported sheet. The existing model-size and render-dimension metadata carries the selected scale into combat.

## Set the lighting

**Environmental light** supplies light around the model. Its color starts white; use its color and intensity controls to change the overall illumination. **Directional light** also starts white and has its own color, intensity, elevation, and hex-direction controls. Choose **E, NE, NW, W, SW, or SE** to place that light around the model, then adjust its elevation above the floor.

These controls affect the 3D model and the rendered sprite pixels. Set them before the first pose capture. Lighting locks as soon as any pose is captured so all three poses retain the same illumination; **Clear sheet** unlocks it. Lighting is saved with the workspace and capture metadata. The pixel color and outline controls below remain editable after capture.

## Pixel previews and export

- Preview windows use two columns in three rows: **NW, NE**; **W, E**; **SW, SE**, at every screen width.
- All six views use the existing Pixel Editor's fixed 256-entry VGA palette: 16 RGBI entries, a 216-color cube, and 24 gray entries.
- The **Resolution** slider scales the selected footprint's source frame. For a single hex, 50%, 100%, and 200% produce 80 × 100, 160 × 200, and 320 × 400 respectively. Preview backgrounds are palette gray; images display with nearest-neighbor scaling.
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

The first captured row locks **Fit model**, **Fit all animations**, **Front adjustment**, **Model's up direction**, **Footprint and sheet format**, **Resolution**, and lighting. Every pose therefore shares one source frame, illumination, and projected ground anchor. Orbiting the central viewer and choosing animation clips still work. **MOB** and **Model size** remain editable without changing the captured pixels or format; model size updates the render dimensions for the entire set. **Brightness**, **Contrast**, **Hue**, **Saturation**, and **Outline width** reprocess the saved source pixels for every row, so you can adjust the entire set without recapturing it. These pixel controls leave the source model's material colors intact.

Use a row's **Clear** button to replace that pose, or **Clear sheet** to unlock framing and start a new set. Loading a new valid model clears the previous captures; a failed model load keeps the previous model and sheet.

### Saved workspace and returning from combat

The studio automatically saves partial or complete capture rows, source pixels, shared color/outline settings, lighting, model size, set name, MOB, footprint, resolution, model files, and animation/framing settings in this browser. Check the workspace status for **Saved** before closing the tab. Refreshing or reopening the same studio restores that workspace; clearing a row or the sheet is saved too. The original model can be restored from the stored files. If it cannot load, the saved rows still preview and export without recreating their poses.

Older sheets retain their original lighting until cleared, and saved demos retain their original source orientation independently of the selected up direction.

**Test in combat** saves a separate copy of the exact set being tested before opening the game in the current tab. It waits for the saves to finish before navigating; a save failure keeps the studio and captured poses open. **Return to 3d studio**, available from Combat Setup and combat, restores that tested copy in the same tab. A studio test also returns directly after victory, defeat, or a manual exit, without a loot screen. Returning makes it the current editable workspace, so subsequent edits and reloads continue from those captures. Existing PNG-only combat drafts from the earlier studio can also be recovered for export, without their original model.

Workspace storage belongs to this browser and site folder; stable and candidate workspaces are separate. It is not a repository commit or a portable backup. Export the ZIP for a transferable copy. If browser storage is unavailable or full, the status reports the failure and the open captures remain available for export.

The automatic fit samples animation poses; unusual motion between samples can still reach beyond the frame. A captured row flags the specific directions whose source silhouette touches an image edge. Inspect that row; if it is cropped, clear the sheet and adjust framing before recapturing. The exporter retains the chosen source pixels and full transparent padding.

### Complete sheet and separate assets

**Export 18-sprite sheet** saves a transparent PNG with six direction columns and three pose rows:

| Row | Column 1 | Column 2 | Column 3 | Column 4 | Column 5 | Column 6 |
| --- | --- | --- | --- | --- | --- | --- |
| Ready | E | NE | NW | W | SW | SE |
| Attack | E | NE | NW | W | SW | SE |
| Prone | E | NE | NW | W | SW | SE |

At the default single-hex 160 × 200 frame size, the sheet is **960 × 600**. Other formats use six times their frame width and three times their frame height. It has no captions, dividers or preview background baked into its pixels. This layout is separate from the existing **Save all six as a sheet** button, which keeps its original 3 × 2 layout.

**Export game assets (ZIP)** saves one character folder containing the same sheet, **18 individual transparent PNGs**, and **manifest.json**. Each frame remains at its native resolution with its padding intact. The manifest records the MOB type, footprint ID, resolution and model-size percentages, source and game render dimensions, source-space anchor, physical direction, pose, animation name/time, lighting, and shared render settings. The optional top-level `modelScalePercent` requires layout metadata; older manifests without it retain 100% model size. The source model stays in the browser workspace and is not included in the game asset ZIP. No image data is embedded in game JavaScript.

### Quick combat check and permanent import

**Test in combat** opens Combat Setup in the current tab with the captured set selected. Choosing **Dungeon Crawler Carl** uses exactly one Carl: the existing player character, with the selected sprites and footprint, against six Kobolds. His name, Fighter statistics, equipment, and player control are retained. Monster tests use six units to display all facings; Ranger and Mage tests retain their six friendly inspection copies with Kobold opponents. Initial placement accommodates all occupied hexes. Use **Ready**, **Attack**, **Prone**, or **Live** during paused inspection to check the captured poses. Starting battle clears that visual override; movement and attacks select each unit's actual facing and pose. Use **Return to 3d studio** to export or revise the exact tested captures.

For a permanent asset addition, export the ZIP and run the small importer from the repository:

```sh
node scripts/import-sprite-set.mjs /path/to/character-sprite-set.zip
```

This writes `assets/sprites/<set-id>/` and updates `data/sprite-sets.json`. The game loads that small index and each character's manifest; another character does not require adding 18 image declarations to the main game file. Re-importing the same ID replaces that set while retaining other sets. Follow the existing validation and candidate publishing flow. See [Sprite set import](SPRITE_SET_IMPORT.md) for the complete file contract and [Six-direction combat sprites](DIRECTIONAL_SPRITES.md) for runtime pose behavior.

An imported `fighter`, `ranger`, or `mage` collection also supplies the corresponding test character's sprites when that character is created. If several imported sets target the same character, the first package ID alphabetically is the default; choosing a set in Combat Setup overrides that character's choice for the current session. Keep the same set name/ID when replacing its ready, attack and prone collection. Monster sets remain selectable test sets, preserving existing monster artwork in ordinary encounters.

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

Embedded model clips are available immediately, with clip selection, rest pose, play/pause, restart, speed, and timeline scrubbing. The demo source is adapted to the Z-up default and includes **Idle**, **Attack**, and **Fall** clips for trying the three captures. Models without clips remain usable as static models.

One `AnimationMixer` evaluates the pose once per frame. A single WebGL renderer then renders all six orientations into a 3 × 2 offscreen atlas before one readback and palette conversion. The central viewer uses the same model and evaluated pose. Pixel previews update at up to 30 frames per second; all six update together. Rendering pauses when the page is hidden or the studio is offscreen.

The three pose captures save still frames from the chosen animation moments. Continuous frame-sequence export and animation-only retargeting remain outside this workflow. Keep animations with their model/rig in the FBX; choose its external textures alongside it when applicable.

## Development

- Page: `3d-studio.html`; scoped styles: `css/3d-studio.css`.
- Renderer, import, playback, and export: `js/3d-studio.mjs`.
- Saved pose rows and PNG/ZIP export: `js/studio-capture.mjs`.
- Manifest contract: `js/sprite-set-core.mjs`; shared footprint, resolution, model-size and MOB catalog: `js/sprite-layouts.mjs`.
- Saved workspaces and atomic combat handoff: `js/sprite-set-store.mjs`.
- Game registration: `js/sprite-set-runtime.mjs`; permanent import: `scripts/import-sprite-set.mjs`.
- Pure projection and color functions: `js/studio-core.mjs`.
- The title-page router only navigates to the studio. The game does not load Three.js until the studio page opens.
- Pinned renderer/loaders and licenses are served locally from `assets/vendor/three/`.
- Run `node scripts/test-3d-studio.mjs`, `node scripts/test-sprite-set-package.mjs`, `node scripts/test-directional-sprites.mjs`, `node scripts/test-studio-footprints.mjs`, `node scripts/test-studio-geometry.mjs`, `node scripts/test-studio-combat-exit.mjs`, `node --check js/3d-studio.mjs`, and the existing `node scripts/validate-repo.mjs` checks.

Browser QA should include model loading with embedded and external textures, a skinned animation, same-frame six-view output, a 60-degree heading adjustment, pause/scrub including the final instant, capture/recapture/clear, shared style changes, outline widths 0/1/10, palette membership, and native PNG and ZIP pixels. Check the four new-format choices and three legacy recovery formats, independent resolution/model-size controls, post-capture size changes, lighting and its capture lock, the floor footprint, selected MOB behavior, rotated footprint occupancy, and a ZIP import into a temporary repository. Verify Z-up defaults and preserved restored orientation, partial-sheet reload, restored source model/clip/settings, exact combat return after closing the original tab, direct return after victory/defeat/manual exit, export without WebGL, and migration of an older PNG-only combat draft.
