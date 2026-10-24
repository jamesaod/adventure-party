# Capture and add a character sprite set

The 3d studio exports one character as **18 separate transparent PNGs**, a reference sheet, and a small JSON manifest. The game reads registered character folders. Adding another character does not require editing the main game JavaScript or embedding image data in it.

## Capture the poses

1. Choose the target **MOB / player character** and one of four footprints: single hex, three-hex triangle, inverted triangle, or seven-hex center/ring. The test player choices are Dungeon Crawler Carl (Fighter), Elven Ranger (Ranger), and Baub (Mage). **Resolution** scales source frames from 50–200% in 5% steps; **Model size** independently scales the battlefield render dimensions from 25–2000% in 5% steps. Both default to 100%. See the [format table](3D_STUDIO.md#choose-the-mob-footprint-and-resolution) for frame and sheet dimensions.
2. Load a model with its animations, such as an animated FBX from Tripo. Select any separate texture files in the same file selection. New models default to Z-up; choose Y if the source needs it. A restored workspace keeps its saved orientation.
3. The studio fits the model across its animation clips. Adjust the environmental light's color/intensity and the directional light's color/intensity/elevation/hex direction before capturing; both lights start white. Use the matching footprint, 0–75-foot ruler, and lower-corner model-height readout to judge size. The scale is 10 feet per battlefield hex; height measures the current pose including equipment. Choose an animation, pause it, and drag the timeline to the desired moment. **Fit all animations** restores the shared frame if you change it before capturing.
4. Choose **Capture ready pose**, **Capture attack pose**, or **Capture prone pose**. Each button captures all six physical facings at that exact animation time.
5. Repeat for the other poses, using a different clip or time as needed. The growing preview shows the saved captures, not the current playback frame.
6. Give the set a recognizable character name, then choose **Export game assets (ZIP)**.

The captured sheet always has the same mapping:

| Row | Column 1 | Column 2 | Column 3 | Column 4 | Column 5 | Column 6 |
| --- | --- | --- | --- | --- | --- | --- |
| Ready | E | NE | NW | W | SW | SE |
| Attack | E | NE | NW | W | SW | SE |
| Prone | E | NE | NW | W | SW | SE |

At the default single-hex 100% resolution, each frame is 160 × 200 and the complete sheet is 960 × 600 pixels. Every footprint uses six frame widths by three frame heights, including the larger formats. Its layout is separate from the older single-pose six-facing export, which remains E/NE/NW over W/SW/SE.

Captures share one source camera frame, footprint, resolution, model orientation, lighting, and ground anchor. The studio locks those settings after the first capture; clear the captured sheet to change them. The MOB target and model size remain editable. Model size updates the shared render dimensions without recapturing or resampling the PNGs; color and outline adjustments can still update the saved captures together. Older recovered captures without layout metadata need a cleared sheet and a new capture before model size can change. The model-floor footprint is only a viewing guide and is never baked into exports. Preserve the full transparent frame when preparing assets; trimming each pose separately would change its size and ground alignment in combat.

Partial and complete sheets autosave in this browser with their source pixels, model files, lighting, size and other studio settings. Wait for **Saved** before closing the tab. Reopening the studio restores the workspace; captured rows remain exportable if the original model cannot be restored. This local workspace is separate from repository assets and the portable ZIP.

## Test immediately

Choose **Test in combat** after capturing all 18 sprites. The studio saves the PNGs and an exact copy of the captured workspace, then opens Combat System Test in the current tab with that character selected. If saving fails, the studio stays open with your captures. The test creates six units using the selected MOB's implemented statistics and behavior, with the set's chosen footprint. This lets you inspect the ready, attack, and prone artwork before importing it into the repository.

The `fighter` target uses exactly one Dungeon Crawler Carl: the existing player with the selected sprite set, against six Kobolds. It creates no extra Carl allies or initiative entries. The `ranger` and `mage` targets retain six friendly inspection copies of Elven Ranger or Baub with Kobold opponents. Existing class, equipment, statistics and player/NPC control are retained, and the pose inspector works on the selected friendly test character or formation.

Choose **Return to 3d studio** from setup or combat to restore the exact tested captures in the same tab and export or adjust them. Victory, defeat, and manual exit from a studio battle also return directly to the studio without a loot screen. Stable and candidate drafts are separate. Export the ZIP to keep a transferable copy and use the import command below to make the character part of the game repository.

## Add the set to the repository

From the repository, run:

```sh
node scripts/import-sprite-set.mjs /path/to/kobold-veteran-sprite-set.zip
```

An extracted character folder containing `manifest.json` and its PNGs also works:

```sh
node scripts/import-sprite-set.mjs /path/to/kobold-veteran
```

The importer verifies every image first, then copies the exact PNG bytes and registers the set. It does not resize, crop, recolor, or regenerate the artwork. Native studio renders are not enlarged by the older 4× convention used for low-resolution archive sprites.

For a set named “Kobold veteran,” the resulting files are:

| Location | Purpose |
| --- | --- |
| `assets/sprites/kobold-veteran/manifest.json` | Character ID and label, MOB type, footprint/resolution/model size, source and render dimensions, ground anchor, pose/facing filenames, clip names/times, and lighting/render settings |
| `assets/sprites/kobold-veteran/ready-e.png` through the six ready facings | Ready artwork |
| `assets/sprites/kobold-veteran/attack-e.png` through the six attack facings | Attack artwork |
| `assets/sprites/kobold-veteran/prone-e.png` through the six prone facings | Prone artwork |
| `assets/sprites/kobold-veteran/sheet.png` | Complete 18-sprite reference sheet |
| `data/sprite-sets.json` | Small index pointing to each character manifest, with a content revision for cache refresh |

Refresh **Combat System Test**, choose the imported character, and begin the test encounter. The game loads its separate asset files and registers its pose images in Pixel Editor. The existing character sets and ordinary encounters remain available.

To revise the same character, keep the same name/ID and run the importer again with its new export. It replaces only that managed character folder and updates its index entry. Other sets remain untouched. If a destination folder contains unrelated files, the importer stops rather than deleting them; choose a distinct character name or move those files to a source-art folder.

When testing another checkout or a temporary fixture repository, add `--root`:

```sh
node scripts/import-sprite-set.mjs /path/to/kobold-veteran-sprite-set.zip --root /path/to/adventure-party
```

The default destination is the repository containing the importer script, regardless of the current working directory.

## Footprint, model size and MOB metadata

The version-1 manifest supports optional `layout`, `mobType`, and top-level `modelScalePercent` and `hexScalePercent` fields. For example, a dragon set captured at the seven-hex format's native resolution and 150% model size includes:

```json
{
  "layout": { "id": "hex7", "resolutionPercent": 100 },
  "mobType": "juvenile-red-dragon",
  "modelScalePercent": 150,
  "hexScalePercent": 109
}
```

For that example, `frame.width` and `frame.height` are 480 and 400, while `frame.renderWidth` and `frame.renderHeight` are 235.44 and 196.2. Raising resolution to 200% changes only the source dimensions to 960 × 800; the game render size stays 235.44 × 196.2. Setting model size to 100% instead gives a 156.96 × 130.8 game render size at either resolution. All eighteen images use the same frame and anchor.

When present, `modelScalePercent` must be an integer from 25–2000 in 5% steps and requires `layout` metadata. `hexScalePercent` also requires `layout` and accepts 100 (original calibration) or 109 (current studio calibration). Omitting either field means 100. The source dimensions must match the declared format and resolution; render dimensions must match the format's base render dimensions multiplied by `modelScalePercent / 100` and `hexScalePercent / 100`. Fractional render sizes are valid. Old exported packages remain valid without changes. Reopening layout-bearing captures upgrades their calibration once through metadata; their PNG pixels remain intact. Lighting is preserved in the shared render metadata; source model files remain in the browser workspace rather than the game asset ZIP.

`mobType` identifies an existing combat factory; `layout.id` identifies the occupied-hex arrangement. The shared definitions live in `js/sprite-layouts.mjs`. Its active catalog contains `single`, `triangle3`, `triangle3-inverted`, and `hex7`. Explicit legacy definitions retain `wide2`, `trapezoid5`, and `diamond4` so existing exported packages and drafts recover with their original source dimensions and footprints; these three formats are not offered for new sets.

Older version-1 sets without layout/MOB metadata still load with their original image dimensions and use the single-hex Kobold test defaults. Their recovered captures remain exportable; clear and recapture them before adding model-size metadata. Imported monster sets are selectable for testing and do not replace every existing instance of that MOB's artwork.

For a test player collection, set `mobType` to `fighter` (Dungeon Crawler Carl), `ranger` (Elven Ranger), or `mage` (Baub); the studio writes this from the dropdown automatically. These sets also supply that matching character's sprites whenever its factory creates it.

The optional `defaultFor` field on an entry in `data/sprite-sets.json` explicitly links a player type to its published sprite collection. Carl is assigned as follows (the importer supplies the content revision):

```json
{
  "id": "dungeon-crawler-carl",
  "manifest": "assets/sprites/dungeon-crawler-carl/manifest.json",
  "defaultFor": "fighter"
}
```

Only one default may be assigned per player type, and it must match the manifest's `mobType`. This assignment applies to ordinary Combat System Test encounters; it does not require choosing a studio sprite-test encounter. A failed assigned package retains the character's legacy artwork, without silently choosing a different imported collection. The importer preserves the assignment when replacing the same character ID and rejects a replacement that changes its target type.

An explicit selection in Combat Setup can override the assignment for that player during the current session. Player types with no explicit assignment retain the earlier alphabetical package-ID default. Re-export and import the same name/ID to replace a collection without changing game code. See [Unit and asset roster](UNIT_ASSETS.md) for the current character mapping.

## Validation and publishing

```sh
node scripts/import-sprite-set.mjs --validate
node scripts/test-sprite-set-package.mjs
node scripts/test-directional-sprites.mjs
node scripts/test-studio-footprints.mjs
node scripts/test-studio-geometry.mjs
node scripts/test-studio-combat-exit.mjs
node scripts/validate-repo.mjs
```

The package validator checks the manifest, known MOB and active/legacy footprint IDs, independent resolution/model-size dimensions, all 18 directions and poses, PNG CRCs and complete decoded image data, source dimensions, hard transparency, exact agreement between the sheet and its individual images, and safe folder paths. Repository validation also checks unique character IDs, matching manifest paths/IDs, current content revisions, and unique default player assignments that agree with their captured MOB. Invalid packages leave the installed character and registry unchanged.

The importer accepts the studio's native RGBA8 PNGs and noninterlaced indexed PNGs with transparency. A ZIP contains one character folder with exactly its manifest, 18 facing PNGs, and sheet; keep source FBX files and additional reference artwork outside that folder.

Commit the character folder and the updated `data/sprite-sets.json` through the normal **feature branch → candidate PR → Adventure Party Validation → candidate deployment** flow. The workflow instructions remain in the repository's separate `workflow/` directory, outside the published game.
