# Capture and add a character sprite set

The 3d studio exports one character as **18 separate transparent PNGs**, a reference sheet, and a small JSON manifest. The game reads registered character folders. Adding another character does not require editing the main game JavaScript or embedding image data in it.

## Capture the poses

1. Load a model with its animations, such as an animated FBX from Tripo. Select any separate texture files in the same file selection.
2. The studio fits the model across its animation clips. Choose an animation, pause it, and drag the timeline to the desired moment. **Fit all animations** restores the shared frame if you change it before capturing.
3. Choose **Capture ready pose**, **Capture attack pose**, or **Capture prone pose**. Each button captures all six physical facings at that exact animation time.
4. Repeat for the other poses, using a different clip or time as needed. The growing preview shows the saved captures, not the current playback frame.
5. Give the set a recognizable character name, then choose **Export game assets (ZIP)**.

The captured sheet always has the same mapping:

| Row | Column 1 | Column 2 | Column 3 | Column 4 | Column 5 | Column 6 |
| --- | --- | --- | --- | --- | --- | --- |
| Ready | E | NE | NW | W | SW | SE |
| Attack | E | NE | NW | W | SW | SE |
| Prone | E | NE | NW | W | SW | SE |

At the default 160 × 200 resolution the complete sheet is 960 × 600 pixels. Its layout is separate from the older single-pose six-facing export, which remains E/NE/NW over W/SW/SE.

Captures share one camera frame, resolution, model orientation, render scale, and ground anchor. The studio locks those settings after the first capture; clear the captured sheet to change them. Color and outline adjustments can still update the saved captures together. Preserve the full transparent frame when preparing assets; trimming each pose separately would change its size and ground alignment in combat.

## Test immediately

Choose **Test in combat** after capturing all 18 sprites. The studio transfers the PNGs to a local browser draft and opens Combat System Test with that character selected. This lets you inspect the ready, attack, and prone artwork before importing it into the repository.

The draft is for testing in that browser. Export the ZIP to keep a transferable copy and use the import command below to make the character part of the game repository. The selected visual set uses the test encounter's existing combat rules.

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
| `assets/sprites/kobold-veteran/manifest.json` | Character ID and label, frame dimensions, shared render size and ground anchor, pose/facing filenames, clip names and capture times |
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

## Validation and publishing

```sh
node scripts/import-sprite-set.mjs --validate
node scripts/test-sprite-set-package.mjs
node scripts/test-directional-sprites.mjs
node scripts/validate-repo.mjs
```

The package validator checks the manifest, all 18 directions and poses, PNG CRCs and complete decoded image data, source dimensions, hard transparency, exact agreement between the sheet and its individual images, and safe folder paths. Repository validation also checks unique character IDs, matching manifest paths/IDs, and current content revisions. Invalid packages leave the installed character and registry unchanged.

The importer accepts the studio's native RGBA8 PNGs and noninterlaced indexed PNGs with transparency. A ZIP contains one character folder with exactly its manifest, 18 facing PNGs, and sheet; keep source FBX files and additional reference artwork outside that folder.

Commit the character folder and the updated `data/sprite-sets.json` through the normal **feature branch → candidate PR → Adventure Party Validation → candidate deployment** flow. The workflow instructions remain in the repository's separate `workflow/` directory, outside the published game.
