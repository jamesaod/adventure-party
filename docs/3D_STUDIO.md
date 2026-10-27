# 3d studio

Open **3d studio** from the Adventure Party title page. The dedicated page has a central interactive model view, six live pixel views on the left, and model/orientation controls on the right. It restores the last saved workspace when one exists; a small articulated demo character loads on the first visit.

## Saved model library

Under **Model**, choose an entry from **Model library**, then press **Load selected model**. The GLBs are stored in the repository, so they can be opened without uploading local copies.

| Saved model | Use |
| --- | --- |
| **Dungeon Crawler Carl Ver 2** | Original saved model with four independent animations: `box_01`, `fall`, `box_02`, and `box_03`. |
| **Dungeon Crawler Carl Ver 2 — UAL2 Sword Test** | Alternate QA model retaining the original four clips and adding `UAL2_Sword_Ready` and `UAL2_Sword_Regular_A`, retargeted from Quaternius's Universal Animation Library 2. |
| **Male Orc Fighter** | Exact repository-backed source GLB supplied by the user. Mixamo-style 65-joint rig, Y up / +Z forward, but its bind stance is not a true T-pose and it contains no embedded clips. It remains untouched for reference and rig QA. |
| **Male Orc Fighter — UAL2 One-Handed Proof** | Derived from the exact Orc source with the same offline UAL2 bake used for Carl. Carl V2 supplies the known-good Tripo/Mixamo T-pose reference rotations; the Orc keeps its own bone lengths, mesh, skin weights, materials, textures, translations, scales, and original binary prefix. Embedded clips: `UAL2_Sword_Ready` and `UAL2_Sword_Regular_A`. |

The Carl entries select **Y up** and **Dungeon Crawler Carl — Fighter**. **Male Orc Fighter** selects **Y up** and the **Orc** Studio target. All use a single-hex footprint. Their display name, source model, selected animation and studio settings persist through the existing workspace save/restore flow. Simply choosing a menu entry leaves the current workspace in place; pressing **Load selected model** loads it and starts a fresh capture sheet after a successful import. A failed download/import retains the existing model and captures.

The Orc source is preserved byte-for-byte at `assets/models/orcs/male-orc-fighter/male-orc-fighter.glb`. It is no longer assigned automatic runtime-retargeted animations. The separate proof at `assets/models/orcs/male-orc-fighter/ual2-one-handed/` is generated offline from the same exact Quaternius `UAL2_Standard.glb` donor and the same world-delta bake method used for Carl, with Carl's known-good T-pose bind rotations used only as the target reference pose because the Orc source bind stance has its arms lowered. The proof's provenance records all three hashes and the bake checks. Additional humanoid FBX files can still be imported manually for experiments.

The original Version 2 GLB is preserved byte-for-byte; the UAL2 test is a separate derived file. Saved model entries live in `data/studio-models.json`; source-model files stay in `assets/models/`, separately from exported sprite assets in `assets/sprites/`. Loading a saved model does not replace Carl's combat sprites. Source identities, clip derivations and the animation license are recorded in the [Carl model README](../assets/models/dungeon-crawler-carl/README.md). Local files can still be opened with **Load from device**.

### Test the UAL2 sword clips

1. Load **Dungeon Crawler Carl Ver 2 — UAL2 Sword Test** and choose **Equipment → Right hand → Medieval Sword**.
2. Select **UAL2_Sword_Ready** in **Animation**. It holds the opening stance of the source sword attack for one second; it is a derived ready pose, not a separate source idle loop.
3. Select **UAL2_Sword_Regular_A** to preview the 1.4-second attack and recovery. Play or scrub the timeline, checking the right-hand attachment and all six previews before capturing.
4. Capture the chosen Ready and Attack poses. For a complete three-pose test set, the original **fall** clip remains available for Prone. Continue with the normal [combat test and export workflow](#quick-combat-check-and-permanent-import).

The two added takes are the scope of this alternate model. Publishing a new battle sprite set remains a separate export/import step.

## Equip Carl's right hand

Load either saved Carl model, then choose **Equipment → Right hand → Medieval Sword** or **Battle Axe**. Both use the first-pass one-handed swinging weapon pose family; their GLB assets and grip calibrations remain independent.

The Battle Axe starts with a provisional sword-style right-hand calibration. Adjust its size, position, and rotation visually before treating the profile as approved.

To preserve those artistic choices, the **Weapon pose profile** panel records exact Ready, Attack, and Prone animation samples. Equip one supported weapon, scrub to the desired animation moment, use **Record ready / attack / prone**, then choose **Export pose profile JSON**. The export includes the equipped appearance ID, complete grip settings, exact animation/source/time, Carl's 6′3″ Height, model identity, lighting, orientation, framing, and combat pose mappings. Give that JSON back to development to update an authored weapon pose profile without transcribing sliders or guessing frames.

Load either saved Carl model, then choose **Equipment → Right hand → Medieval Sword**. The sword is a separate repository asset attached to the model's animated right-hand bone. It follows every selected animation and is rendered by all six previews and subsequent captures.

**Sword size** adjusts the calibrated weapon size. Expand **Adjust grip** to move the handle within the hand or change its rotation. **Reset grip** restores the starting Carl preset. Selecting **None** removes the sword; selecting it again retains your adjusted fit. Equipping, unequipping, or resetting gear preserves the unit's existing body calibration and capture framing. **Fit model** and **Fit all animations** also measure body geometry only, so attached weapons and shields cannot change the unit's battlefield scale. Check the six previews after a large equipment adjustment for clipping.

Equipment and its grip save with the workspace, including page reload and return from combat. These controls lock after the first pose capture so a sheet uses one equipment configuration; clear all captured poses before changing it. A failed weapon load keeps existing captures available and prevents a new incomplete capture. Models without a supported right-hand bone display an explanation.

The preset follows the character's existing hand and finger animation. Capturing and publishing a sword-equipped battle set uses the normal export/import workflow. The already-published Carl sprites retain their supplied artwork until a replacement package is imported. Source and calibration details are in [the weapons README](../assets/models/weapons/README.md); current unit-to-art assignments are in [UNIT_ASSETS.md](UNIT_ASSETS.md).

## Load and align a model

1. Choose **Load from device**, or drop a model onto the central viewport.
2. Select one `.glb`, `.gltf`, or `.fbx` model. For a model with external buffers or textures, select those files together with it. A self-contained GLB is the simplest handoff.
3. New models default to **Z** under **Model's up direction**. Choose **Y** for a Y-up source, and use **Front adjustment** if its front faces a different direction. Restoring a workspace preserves its saved up direction, including older Y-up choices. Internally the studio aligns the model to +Z forward with +Y up for rendering.
4. Select a direction under the main window to inspect that facing. Drag the main window to orbit, scroll to zoom, and use **Reset view** to return to the game's elevated angle with the model centered at **50% of the available width or height**. The camera fits the model; the 75-foot ruler can extend beyond the visible window. These free camera movements leave the six fixed pixel cameras aligned to the board.
5. Animated models are automatically framed across their clips, including the rest pose and animation endpoints, with room around the movement. **Fit all animations** repeats that fit. **Fit model** fits only the current pose when you deliberately want a tighter frame. Check the six previews before capturing a set.

Files are read locally by the browser. Selecting a model does not upload it or replace a game asset. Errors retain the last usable model. Unsupported compressed glTF extensions produce an export-without-compression message; see [third-party dependencies](THIRD_PARTY_3D_STUDIO.md) for loader scope.

### Humanoid rig analysis and external animations

When a rigged humanoid is loaded, Studio analyzes its skeleton into semantic roles instead of requiring Carl's exact bone names. The Model summary shows the detected rig family and mapped core-role count. The first pass recognizes common Mixamo, Blender/Rigify, Unreal-style, Bip01/Biped and generic naming conventions.

**Load animation FBX** now retargets a humanoid FBX through those semantic roles. A source `upper_arm.L`, `Bip01_L_UpperArm`, or `mixamorig:LeftArm` can therefore drive the target model's semantic left upper arm even when their literal names differ. Right/left weapon sockets, shields and the two-handed arm chain use the same mapping.

See [HUMANOID_RIG_PIPELINE.md](HUMANOID_RIG_PIPELINE.md) for the onboarding pipeline, current limitations, and the first Orc acceptance model.

## Choose the MOB, footprint and resolution

Before the first capture, choose the **MOB / player character**, **Footprint and sheet format**, and **Resolution**. The dropdown groups the seven implemented MOBs (Kobold, Kobold Body Guard, Kobold Slinger, Orc, Orc Leader, Orc Shaman, and Juvenile Red Dragon) and the test player characters: **Dungeon Crawler Carl — Fighter**, **Elven Ranger — Ranger**, and **Baub — Mage**. Combat tests use the selected character's existing statistics, controller and behavior. Selecting a target before capturing chooses its default footprint: single hex for the humanoids, or seven hexes for the dragon. You can then choose another footprint for the set.

The **Resolution** slider runs from **50–200% in 5% steps**, with 100% as the default. It changes the native PNG dimensions and pixel detail. The separate **Model size** slider runs from **25–1000% in 5% steps**, also defaulting to 100%. It changes how large the model appears against the floor footprint and how large its sprite renders in combat. The viewer automatically adjusts its zoom as Model size changes, keeping the model at the same on-screen size and position while preserving your viewing angle, pan, and manual zoom. The fixed-size footprint and height ruler show the change in battlefield scale. Changing resolution does not enlarge the creature, and changing model size does not resize the PNGs or change its occupied hexes.

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

Saved workspaces above 1000% with layout metadata reopen at the new 1000% maximum, updating every captured pose's render size together while preserving its source pixels and ground anchor. Older exported packages retain support for their original sizes.

### Measure model height

The Model View has a **0–75-foot ruler** beside the model, with one-foot ticks and labels every five feet. Its lower-right corner shows **Model height** in feet. Both use the battlefield's existing **10 feet per hex**, so the size shown agrees with the sprite's combat scale rather than relying on a source file's native units.

The readout measures the current pose's vertical **body** bounds and excludes attached equipment. It updates when the model is resized, reoriented, or animated; a prone pose therefore reads shorter than an upright pose, but equipping a sword or shield cannot make the character taller or shorter. Changing **Model size** changes this height. Camera orbit, pan, zoom and source resolution do not change the measurement. **Reset view** restores a view containing the full ruler; zooming in can move some marks outside the window. Imported files are normalized to the shared sprite frame, so this is the model's in-game height, not its original authoring-unit measurement.

The ruler and height readout are viewing guides only. They are never included in pixel previews, captured poses, PNGs, or the exported sheet. The existing model-size and render-dimension metadata carries the selected scale into combat.

## Set the lighting

The **Pixel rendering & lighting** box sits directly beneath **Pixel previews** in the right-hand column. Its controls are ordered as pixel color adjustments and outline, environmental light, then directional light. On narrow screens the same combined box remains immediately below the previews.

**Environmental light** supplies light around the model. Its color starts white; use its color and intensity controls to change the overall illumination. **Directional light** also starts white and has its own color, intensity, elevation, and hex-direction controls. Choose **E, NE, NW, W, SW, or SE** to place that light around the model, then adjust its elevation above the floor.

These controls affect the 3D model and the rendered sprite pixels. Set them before the first pose capture. Lighting locks as soon as any pose is captured so all three poses retain the same illumination; **Clear sheet** unlocks it. Lighting is saved with the workspace and capture metadata. The pixel color and outline controls below remain editable after capture.

## Pixel previews and export

- Preview windows use two columns in three rows: **NW, NE**; **W, E**; **SW, SE**, at every screen width.
- Each directional preview centers the current visible sprite at **50% of the window height**, including equipped weapons and the outline, using nearest-neighbor scaling. The windows use wider proportions to accommodate prone poses. If a pose needs additional width, all six windows widen together and retain that width until the model or format changes. This display framing remains independent of Model size and Resolution. Captures and PNG exports retain their native pixels, shared capture framing and ground anchors.
- All six views use the existing Pixel Editor's fixed 256-entry VGA palette: 16 RGBI entries, a 216-color cube, and 24 gray entries.
- The **Resolution** slider scales the selected footprint's source frame. For a single hex, 50%, 100%, and 200% produce 80 × 100, 160 × 200, and 320 × 400 respectively. Preview backgrounds are palette gray; images display with nearest-neighbor scaling.
- **Brightness**, **Contrast**, **Hue**, and **Saturation** update all six pixel previews and saved PNGs together. Brightness, contrast, and saturation range from 0–200% (100% is neutral); hue shifts from −180° to +180° (0° is neutral). **Reset colors** restores all four defaults.
- **Outline width** is measured in **battlefield inches**, from **0–18.75 in** in 1/8-inch steps. The default **1.875 in** is exactly the former 1-pixel battlefield outline because the board's east-west scale is 10 ft = 64 pixels. The Studio converts that physical thickness separately for the native source frame and the final battlefield frame, so changing **Resolution** does not change the apparent world-space thickness. Fractional final-pixel widths use partial alpha on the next outward pixel ring, allowing values such as **1 in** to render visibly thinner than the old 1 px outline. Set it to 0 in to turn the outline off; each atlas cell keeps its outline within its own frame.
- Color adjustments happen before VGA palette matching. The gray preview background, transparent export background, and black outline keep their original colors. The central 3D model view shows the source material colors for reference. **Reset colors** resets the four color controls independently of outline width.
- Each **Save PNG** button exports that facing at the selected native resolution, with a transparent background.
- **Save all six as a sheet** exports one transparent sheet in this order: top row **E, NE, NW**; bottom row **W, SW, SE**. All cells have identical dimensions and capture the same pose.

The original imported ready sheet remains available in **Combat System Test → 6-facing Kobold**. The three-pose workflow below adds new complete sets without changing that artwork.

## Select an animation

The **Animation** dropdown lists every usable embedded clip with a number, name and duration. The number distinguishes duplicate names. Selecting a clip stops the previous animation; the central model and all six previews share that one animation clock. **Rest pose** stops animation completely.

FBX files can contain multiple named takes. The studio reports the selectable-animation count alongside the total take count, follows curves shared by multiple takes, and honors each take's valid start/end markers. Each take gets a timeline starting at zero, retaining the exact boundary poses and intentional holds. Takes with no supported tracks are skipped with a note; this does not establish that the source take is empty. If a take contains multiple animation layers, the studio uses the first usable layer and displays a note; export baked animations when those layers need to be blended together.

To check a newer export, choose its file again with **Load from device**. Refreshing restores the previously saved model files; it does not reread a changed file on your computer. Loading a new file with the same name replaces the stored file normally.

If the file contains several motions on one continuous timeline, expand **Create animation from range**:

1. Select the source animation and enter a name, such as Ready, Attack or Prone.
2. Enter the start and end in seconds. Alternatively, pause or scrub the timeline and choose **Use current time as start** or **Use current time as end**.
3. Choose **Save as animation**. The new named range appears in the dropdown with its own timeline starting at zero.

Saved ranges retain their original source animation. When a range is selected, its editor shows times in that original source. **Remove selected range** removes only that range; captured sprites and the original animation remain available. The current selection, playback time and named ranges are saved with the workspace and restored after a combat test. Creating ranges from smooth cubic or packed glTF cubic-spline animations is not supported; those complete clips remain selectable.

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

An imported `fighter`, `ranger`, or `mage` collection also supplies the corresponding character's sprites when that character is created. A `defaultFor` field in `data/sprite-sets.json` explicitly assigns the published collection to a player type; Carl's `dungeon-crawler-carl` set is assigned to `fighter` and appears in ordinary combat. The assignment must be unique for that player type and match the package's `mobType`. If the assigned package cannot load, the character retains its legacy fallback artwork. Choosing a set in Combat Setup overrides that player type for the current session; player types without an explicit assignment retain the earlier alphabetical package-ID default. Keep the same set name/ID when replacing its ready, attack and prone collection. Monster sets remain selectable test sets, preserving existing monster artwork in ordinary encounters.

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


## Candidate Rev 139 — Carl Ver 3 and uploaded animations only

The Studio model selector now offers only **Dungeon Crawler Carl Ver 3**. This is the original **Dungeon Crawler Carl Ver 2** mesh, materials, skin and rig, referenced by a new catalog ID `dungeon-crawler-carl-v3`; the source GLB is unchanged. `studioModelIds` in `data/studio-models.json` controls the offered list. Historical catalog records remain for existing combat recipes, asset integrity tests and archived QA, but are absent from the Studio selector. The demo button is hidden, and a fresh workspace opens Carl Ver 3.

Carl Ver 3's `animationLibrary: "uploaded-fbx"` replaces its four legacy embedded clips with exactly the 13 source-supplied FBX animations listed in `data/animation-library-sources.json`. The UAL2 and old 17-clip sword/shield test packs are excluded. T-Pose remains available for height calibration. **Sword And Shield Idle** is the initial motion; **Bayonet Stab** retains its `two-handed-thrust` association for spear QA.

`js/repository-fbx-animations.mjs` fetches repository assets and calls the same pinned FBX loader, clip preparation and humanoid retargeting function already used by device imports. Source files and target geometry are unchanged. A failure to load any source prevents installing a partial new model. Uploaded animation IDs are stable (`uploaded:<source-id>:<clip-index>`), and repository animations reload with saved Ver 3 workspaces. Per-animation visual alignment and equipment tuning remain available in the existing controls.

Saved Ver 2 workspaces migrate to the Ver 3 catalog identity and uploaded idle motion, preserving equipment settings and marking old captured poses outdated for recapture. Saved captures from retired models stay exportable; those models no longer reopen in the Studio. Unit Package templates, historical models, combat mappings and source animations remain intact.

Run `node scripts/test-fbx-animations.mjs` to verify the single offered model, exact source-file checksums, all 13 real FBX parses and retargets, finite animation tracks and stable profile metadata. Then run the full repository workflow and check the published selector and animation list. To add a future supplied animation, place it under `assets/animations/`, record its source checksum/profile in the upload catalog, and use the shared loader rather than adding a model variant or renderer.

Combat sprite regeneration for the Ver 3 model ID calls the same uploaded-FBX loader as Studio, so equipment swaps preserve the captured motion names and times instead of falling back to the old GLB clips. Existing models retain their original combat loading paths.

## Candidate Rev 140 — recovered Carl animation recipe

The Rev 139 uploaded-animation path inherited a joint-relative default from an Orc experiment, which distorted Carl. Rev 140 explicitly restores the historical Carl world-bind-delta calculation plus scaled vertical hip motion in the shared Studio/combat loader. The 13 uploaded clips, original model, scale, grip and attachment controls remain. Older Ver 3 captures are retained but marked outdated until recaptured. See [Carl animation recipe](CARL_ANIMATION_RECIPE.md) for the recovered history, exact calculation, independent reference generator and visual QA process.

## Candidate Rev 142: Recurve Bow equipment

Choose **Equipment -> Weapon -> Recurve Bow** to equip the cleaned 1.24 MB, 512px bow on the left hand. Selection clears the shield and selects Bow Weapons plus Carl's uploaded Standing Aim Recoil clip. Scale and XYZ grip/rotation controls remain adjustable and saved. See [Recurve bow integration](RECURVE_BOW_ASSET.md) for provenance, mounting values, reproduction and the pixel-atlas material override. The source Arms bend and String pull morph targets are preserved; automatic bowstring draw/release is a future animation step.

## Candidate Rev 143 - crossbow equipment

Choose **Equipment -> Weapon -> Crossbow** to use the optimized 4,678-triangle, 512px asset. Studio selects **Direct Fire Weapons (Crossbow)** and the uploaded **Rifle Aim To Down** clip. The right-hand mount keeps size, position and rotation adjustable; the support hand retains the authored animation. Captures and saved workspaces use the existing equipment flow. See [Crossbow integration](CROSSBOW_INTEGRATION.md) for exact reproduction, mounting defaults, source-color checks and limitations.

## Candidate Rev 144: staff, short sword and dagger

Equipment now includes **Wooden Staff**, **Short Sword** and **Dagger**, all below 10,000 triangles with three embedded 512px PBR textures each. The staff selects 2H Swing / Great Sword Idle and clears shields; the one-handed blades select 1H Stab / Stabbing and permit shields. All uploaded clips remain available. Existing size, grip, orientation, off-hand offsets, captures and workspace persistence remain in use. [Batch reproduction and validation](EQUIPMENT_BATCH_144.md) records precise hashes, importer lessons and dagger attribution.

## Candidate Rev 145 follow-up

[Wizard Staff Grip and blade visibility](WIZARD_STAFF_AND_BLADE_VISIBILITY.md) records the dedicated one-handed staff equipment/action profile and the short sword/dagger material adaptation. Blade texture pixels and geometry remain unchanged; current sizes/hashes and reproducible export settings are in the follow-up. Keep the original two-handed staff behavior and source-color regression checks.

## Candidate Rev 146 - Sling

**Sling** is selectable through Equipment -> Weapon, using the existing **Slings** action profile. On Carl Ver 3, selection pauses **Goalie Throw** at 1.566667 s with the sling hanging from the raised hand. Size and grip controls remain editable. The 9,512-triangle GLB has three 512px maps; it follows the hand as a static shape. See [the reproduction recipe](SLING_INTEGRATION.md) for geometry, color checks, calibration and limitations.


## Candidate Rev 147 - Standing Idle

**Standing Idle** is now the 14th uploaded animation for Carl Ver 3. Choose it in the Animation selector; it uses the recovered Carl recipe and is tagged Bare Handed for organization. Existing animations, equipment transforms, saved captures and default initial motion are preserved. See [Carl animation recipe](CARL_ANIMATION_RECIPE.md#standing-idle---candidate-rev-147) for source hash, import steps and pose validation.

## Candidate Rev 148 — Shield rotation on all three axes

Choose a shield, then open **Equipment → Adjust shield → Shield rotation**. **Rotation X**, **Rotation Y**, and **Rotation Z** each cover −180° to +180° in 1° steps. The controls use the existing hand-local XYZ Euler rotation; **Rotate around forearm** remains an additional roll around the forearm axis.

The sliders edit the existing `shield.rotation` array through `changeShield(..., { resetPose: false })`. They update the 3D view and six pixel previews without changing the selected animation time, mark prior captures outdated, and save through the existing workspace / equipment / Unit Package path. No new attachment renderer, schema, preset revision or migration is needed. Existing calibration and captures remain intact until the user changes a setting. **Reset shield settings** restores the calibrated shield defaults, including all three rotation axes.

Reproduction / QA: equip Round Wooden Shield, pause an animation partway through, adjust each axis and a combined XYZ rotation, reload to confirm values persist, then reset and confirm X/Y/Z return to 0°. Check the six preview facings after large rotations for clipping.

## Candidate Rev 149 — Compact setup, weapon capture sets and off-hand gear

**Model** is part of **Sprite setup** at the top. Equipment and Model view now start on the same row, including at tablet/desktop widths. **Model size** sits above the viewport. The six facing buttons, Fit model, Fit all animations and Reset view controls are removed; orbit/zoom and automatic initial framing remain. The five capture buttons are compact. Wind Up timing has no Studio input: Engine QA owns timing; existing timing metadata is retained for compatibility.

Select **Weapon type to capture** immediately above the capture buttons. Each action-catalog type has its own Ready, Wind Up, Attack, Falling and Prone snapshots, each containing six directions. Changing this selector preserves the other sets and restores the selected type's saved loadout and pose. Changing weapons does not silently change the capture type. Equipment/grip edits invalidate only the selected set; shared model, lighting and framing edits invalidate all sets. Color/outline edits re-quantize all sets together. Existing workspace captures are retained, including older groups without separate loadout metadata.

**Off Hand** offers None and the catalog's one-handed weapons. It uses a second `createStudioEquipment` instance with `offHand:true`, sharing the same loader and `createWeaponAttachment` path, attached to the semantic left hand. Scale, XYZ position and XYZ rotation have independent saved controls. No mirrored geometry or alternate renderer is introduced. Selecting off-hand gear clears a shield; selecting a shield clears off-hand gear. A two-handed primary clears both and disables off-hand selection. Captures are disabled while equipment loads, and the capture boundary rejects invalid/unavailable combinations. Saved off-hand mounts survive reload, pose captures and the existing combat render handoff.

**Export all weapon sets (ZIP)** exports every type with a fresh captured pose:
- `unit-package.json` uses the existing Unit Package schema and references all included action types.
- `profiles/<action-profile-id>/manifest.json` and six-facing PNGs keep each type's files separate.
- Each pose includes its stable animation source ID, name, time, primary/off-hand/shield mounts and rendering settings. The package references existing model and item catalog assets; it does not duplicate GLBs.
- Outdated poses are excluded. Missing poses retain the existing fallback behavior. The QA sheet and Test in combat buttons still operate on the selected type.
- For the existing single-set CLI importer, extract the ZIP and import a profile directory. The root Unit Package retains the complete cross-weapon references for subsequent combat weapon-switch integration; this pass does not add a new combat switching interface.

Reproduction: capture Ready for Dual Weapons with a primary sword and off-hand dagger; capture another type with different equipment; switch back, reload, and confirm both groups and mounts remain. Export the ZIP, validate each manifest and PNG path, and check `references.spriteSets` in `unit-package.json`. Exercise shield ↔ off-hand swaps and a two-handed primary; the left hand must never carry both. `scripts/test-studio-weapon-sets.mjs` covers the shared attachment, saved adjustments, exclusion rules and multi-profile package references.

## Candidate Rev 150 — Off-hand placement defaults

The user-calibrated off-hand mount uses size **100%**, XYZ position **[0.005, 0.065, -0.005]** and XYZ rotation **[163, -180, 0] degrees**. The shared off-hand normalizer applies these defaults when selecting a weapon or pressing **Reset off-hand grip**. Explicit saved size, position and rotation remain adjustable and survive reload; captured poses and primary-hand defaults are unchanged. For an existing saved mount, Reset off-hand grip applies the new baseline through the normal capture invalidation and persistence path.

## Candidate Rev 151 — Off-hand weapon alignment QA

Rev 150 reused the Medieval Sword Euler rotation for every asset, even though their handle axes differ. The short sword/dagger use local +Y; the sword uses -X; the axe shaft is diagonal [4,5,0]. Applying one Euler tuple pointed the blades along the forearm and skewed the axe. Keep weapon-specific left-hand presets in `OFF_HAND_GRIPS` in the shared equipment module. Do not change asset geometry, right-hand presets, rigs or animations to correct a mount.

| Off-hand weapon | XYZ rotation (degrees) | XYZ attachment position | Size |
| --- | --- | --- | --- |
| Medieval Sword | [163, -180, 0] (user-approved, unchanged) | [0.005, 0.065, -0.005] | 100% |
| Battle Axe | [-17, 0, -51] | [0.005, 0.065, -0.005] | 100% |
| Short Sword | [73, 0, -90] | [0.005, 0.065, -0.005] | 100% |
| Dagger | [73, 0, -90] | [0.005, 0.065, -0.005] | 100% |
| Wizard Staff Grip | [-23, -1, -157] | [-0.015, 0.02, 0.015] | 100% |
| Sling | [-23, -1, -157] | [0.005, 0.065, -0.005] | 100% |

For melee grips, compose `Q_leftSword * inverse(Q_rightSword) * Q_rightWeapon`, then store the equivalent XYZ angles. This preserves each asset's authored shaft/edge orientation while matching the approved sword's hand-local +X direction. The source axes after transformation agree within one degree. Staff and sling are separately calibrated to world +Y/-Y in Carl **Standing Idle, 0 seconds**, using the independent uploaded-animation reference's LeftHand quaternion. The staff offset slides its shaft through the palm slightly to keep the lower tip above the ground in that reference pose. Their upright/hanging orientation is pose-specific: these remain rigid props following the animated hand, without gravity, finger posing or ground collision.

QA reproduction: choose no primary weapon, Standing Idle at 0, then select each Off Hand entry and inspect the hand and all six previews. Scrub Stabbing and Sword And Shield Slash to check that the mount follows the wrist; orbit to check the palm from another side. Reset off-hand grip must restore the selected weapon's row above. Change rotation/scale, reload, and confirm custom settings survive. Selecting an off-hand item still excludes shields and two-handed primaries. `test-studio-weapon-sets.mjs` checks all six attachment pivots across 70 independent reference poses from all 14 uploaded clips and six facings, plus melee-axis and upright/hanging reference alignment, persistence and exclusions.

Explicit saved adjustments and historical captures are preserved. For an existing saved mount, use **Reset off-hand grip** or reselect the weapon to apply its corrected default, then recapture affected poses. This avoids silently changing the model pose behind previously exported sprite pixels.

## Candidate Rev 152 — User QA adjustments and off-hand choices

User-provided screenshots supersede the Rev 151 axe/short-sword calibration. Both defaults remain 100% size:

| Off-hand weapon | XYZ position | XYZ rotation (degrees) |
| --- | --- | --- |
| Battle Axe | [-0.005, 0.075, -0.005] | [154, 6, -51] |
| Short Sword | [0.005, 0.065, -0.005] | [-22, 0, -90] |

The Off Hand selector now offers **None, Medieval Sword, Battle Axe, Short Sword and Dagger**. `STUDIO_OFF_HAND_WEAPONS` derives eligibility from the explicit `OFF_HAND_GRIPS` presets and the one-handed requirement. Both the UI and shared normalizer use that list, so Wizard Staff Grip and Sling cannot reappear via a saved off-hand assignment; such assignments resolve to None. Both items remain available in the primary Weapon selector with their existing assets and action profiles. Stored Unit Package and captured-pose records are not deleted.

Selecting or resetting an eligible off-hand weapon applies its current preset. Explicit saved custom grips remain intact; use **Reset off-hand grip** to adopt the revised defaults, then recapture affected poses. Regression checks cover the four eligible choices, excluded saved mounts, unchanged primary availability, user-specified transforms, and palm attachment through all 14 uploaded animation references.


## Candidate Rev 153 — casting captures in every weapon set

Every capture type now has seven independent slots: Ready, Wind Up, Attack, Falling, Prone, **Casting Wind Up** (`casting-windup`) and **Cast** (`cast`). Each slot saves six facings; a full set is 42 sprites. Casting slots are available while carrying any supported loadout, including within the existing Spell Casting profile. They do not replace weapon Wind Up/Attack or change combat timing/damage rules.

To reproduce a dataset:

1. Select **Weapon type to capture**, then equip and adjust the intended loadout.
2. Select an uploaded casting animation, pause/scrub to the desired anticipation frame, and press **Casting Wind Up**. Pick the release frame (in the same or another animation) and press **Cast**. The Action pose to record selector also offers both slots.
3. Confirm the two rows in the captured sheet. Switching weapon types or reloading restores each group's separate captures. Changing visual settings marks affected captures outdated as before.
4. **Export all weapon sets (ZIP)** writes fresh rows to each `profiles/<id>/manifest.json`, source/native six-facing PNGs, and `unit-package.json`. Each pose retains its stable `clipSourceId`, exact time and captured primary/off-hand/shield adjustments. Missing slots remain absent; they are not silently replaced with melee poses. Export may contain incomplete sets.
5. **Test in combat** preserves these rows. Before starting combat, the existing sprite inspector offers Casting Wind Up and Cast. This is pose-data QA, not a new spell resolver or casting duration control.

The shared action/sprite pose list appends the casting slots after the original five rows, preserving existing row positions. New partial manifests declare seven rows; historical three-, four- and five-row manifests and saved browser workspaces remain supported without rewriting captures. Legacy PNG draft restoration now iterates only present rows. Standalone sprite-package import allows up to 86 files (42 source + 42 native PNGs + manifest + optional sheet), retaining existing byte/path checks. The all-weapon ZIP remains the Unit Package export format, not the single-character CLI importer format.

Validation: `node scripts/test-studio-casting-captures.mjs` covers distinct attack/casting times, six-facing row placement, legacy manifests, workspace groups, stable IDs and loadout snapshots. Existing directional tests exercise both new poses for all six facings, and combat capture parity checks preserve both source IDs/times. Run the full Adventure Party Validation workflow. Browser QA used Standing 2h Cast Spell 01 at 0.650 s and Standing 2h Magic Attack 04 at 1.667 s in both unarmed Spell Casting and Short Sword / 1H Stab sets, verified reload and exported PNG/reference data. These are test frames, not prescribed defaults or engine timing.

## Candidate Rev 157 — Blond Haired Woman in Scale Mail

The Model library now offers **Blond Haired Woman in Scale Mail** alongside Carl Ver 3. Load her to preview the same 14 uploaded FBX motions, select primary/off-hand weapons or a shield, and adjust the existing scale, grip, XYZ rotation and attachment controls. This is a model choice, not a new character class or MOB template. [Import recipe and QA](BLOND_SCALE_MAIL_MODEL.md) documents source preservation, normalized FBX armature units and animation verification.


## Candidate Rev 160 — reusable pose libraries and MOB Creator

See [MOB Creator](MOB_CREATOR.md) for six-score MOB definitions, separate model/library selection, all-weapon action recipes, pinned library revisions, isolated Studio workspaces, and the JSON/ZIP integration workflow. Reuse the existing renderer, retargeter, captures and Unit Package schema. Browser drafts are authoring data; live combat registration remains a repository integration step.
