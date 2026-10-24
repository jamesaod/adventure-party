# Six-direction combat sprites

## Capture and test a complete character

In **3d studio**, choose the target **MOB / player character**, **Footprint and sheet format**, **Resolution**, **Model size**, and lighting before the first capture. New model imports start Z-up; restored workspaces retain their saved up direction. Load the animated model, choose a clip, pause or scrub to the desired moment, then use **Capture ready pose**, **Capture attack pose**, and **Capture prone pose**. Each button captures all six physical facings from the same evaluated animation instant. The eighteen-frame sheet uses one row per pose and the columns **E, NE, NW, W, SW, SE**.

Partial and complete captures autosave in this browser with the original source pixels, model files, lighting, model size and other studio settings. Use **Test in combat** to save a separate copy of the exact captured set and open Combat Setup in the same tab. **Return to 3d studio** restores that tested copy in the same tab for export or further edits. Studio battles return directly after victory, defeat, or manual exit, without entering the loot screen. Restored captures can be exported without reloading the 3D model. Candidate and stable workspaces/drafts are isolated by their site folders; neither modifies repository assets.

Combat Setup has a **Sprite test set** selector containing the existing ready-only Studio Kobold and any complete imported sets. A new set's `mobType` selects the existing creature factory and statistics: Kobold, Kobold Body Guard, Kobold Slinger, Orc, Orc Leader, Orc Shaman, or Juvenile Red Dragon. Legacy sets without that metadata use Kobold rules. The encounter places six creatures with their chosen footprints without overlapping occupied hexes. Choose **Begin Battle** to inspect the six starting facings. Before pressing Space, the **Ready**, **Attack**, **Prone**, and **Live** inspection buttons display those poses across all six units. These are presentation controls: they do not apply damage or conditions. Pressing Space starts combat and removes the inspection override. Actual attacks select attack art; prone, sleep, and unconscious conditions select prone art.

The three test player targets use the same path: `fighter` for Dungeon Crawler Carl, `ranger` for Elven Ranger, and `mage` for Baub. Carl's test uses the one existing player character, with no additional Carl allies, against six Kobolds. Ranger and Mage tests retain six friendly inspection copies. All retain their class, equipment and player/NPC controller, and the inspector includes the selected friendly test character or formation. Registered player-target collections also supply the corresponding character's sprites when its factory creates it. A `defaultFor` field in `data/sprite-sets.json` explicitly assigns the published collection to a player type; Carl's `dungeon-crawler-carl` set is assigned to `fighter` and appears in ordinary combat without choosing a studio encounter. The default must be unique for that player type and match the manifest's `mobType`. If the assigned package fails to load, the character retains its legacy artwork instead of switching to another collection. Choosing a set explicitly overrides that player type for the session; player types without an explicit assignment retain the earlier alphabetical package-ID default. Reimporting the same set preserves its assignment. Monster imports remain test-only unless separately wired into a normal encounter.

For a repository import, export the **asset ZIP** and run the small importer described in [SPRITE_SET_IMPORT.md](SPRITE_SET_IMPORT.md). It creates `assets/sprites/<character-id>/` with eighteen individual PNGs, `sheet.png`, and `manifest.json`, and updates `data/sprite-sets.json`. A new character requires no edit to the large game JavaScript file or the legacy flat sprite registry. Refresh the game and choose that character in **Sprite test set**.

The loader validates the manifest and decodes all eighteen images before making the set selectable. If a file is missing, invalid, or has the wrong dimensions, that set is not partially installed; the existing test characters remain usable. Re-imports receive a content revision in the index so replacement PNGs are not confused with cached older artwork.

## Footprints and image size

`js/sprite-layouts.mjs` offers four formats for new sets: single hex, three-hex triangle, inverted triangle, and seven-hex center/ring. Explicit legacy definitions preserve two-wide, five-hex trapezoid, and four-hex tall-diamond packages and saved drafts. The [studio format table](3D_STUDIO.md#choose-the-mob-footprint-and-resolution) lists source, sheet and base game render sizes. The 50–200% resolution slider changes source detail in 5% steps. The independent 25–2000% model-size slider, also in 5% steps, multiplies the base game render dimensions without resizing the source PNGs or changing occupied hexes.

The manifest's `layout` records the footprint ID and resolution percentage. Its optional top-level `modelScalePercent` records model size and requires layout metadata; omission retains 100% sizing. The runtime uses `frame.renderWidth` and `frame.renderHeight` directly, including fractional values, and does not apply the percentage a second time. Combat uses the complete occupied-hex footprint for movement, collision and targeting. Asymmetric arrangements rotate through **E, NE, NW, W, SW, SE** with the physical facing; the source-space ground anchor attaches the image to the footprint's center. Every creature remains a single unit.

The studio's model floor shows the actual selected footprint for size comparison. A 0–75-foot ruler and lower-corner model-height readout use the game's ten-foot hex scale and current posed mesh bounds, including equipment. Camera zoom and source resolution do not change the measured height. These guides are excluded from exported artwork. The footprint, source frame, orientation, resolution, and lighting lock after the first capture. Model size remains editable and updates all poses' shared render metadata without recapturing their pixels. Recovered older captures without layout metadata must be cleared and captured again before size can change.

Environmental lighting has color and intensity controls, while directional lighting has color, intensity, elevation, and a six-direction hex selector. Both colors default to white. Set the lighting before capturing so all saved poses share the same illumination; pixel color and outline controls remain available afterward. Captures and saved workspaces retain lighting and size settings.

## Try the first imported set

Open **Combat System Test**, select **6-facing Kobold**, and choose **Begin Battle**. This preset is selected initially. Six test kobolds start near Carl with all six facings represented. Inspect the starting formation before pressing **Space** to begin combat. Movement and attacks use each unit's current tactical facing.

The test uses the user-supplied 3d studio export as its **ready** artwork. The engine supports a separate **action** image for every direction. Until those images are supplied, an attack keeps the ready image for that same direction.

The ordinary Kobold, Orc, and Red Dragon encounters remain available from Combat Setup. The test kobolds use the existing Kobold combat rules; the imported model is a visual test.

## Imported artwork

Source: `tripo_convert_53b185b6-807f-4e15-8f41-8c3c5cdfbe15-six-facings-160x200.png`.

Source SHA-256: `2a4f87152417203c77915d4f0b419a58d2cb95fd89fe57c58a7da2d7f6f0eeb6`.

The sheet is 480 × 400 pixels. Each full 160 × 200 cell is extracted without rescaling, trimming, recoloring, or changing transparency. The source is already a studio render, so the older 4× import convention for low-resolution archive sprites does not apply. The six files preserve the complete sheet's decoded pixels and can reconstruct it.

The sheet's export order is independent of the arrangement of preview windows:

| Facing | Sheet column | Sheet row | Ready asset |
| --- | ---: | ---: | --- |
| E | 1 | 1 | `studio-kobold-ready-e.png` |
| NE | 2 | 1 | `studio-kobold-ready-ne.png` |
| NW | 3 | 1 | `studio-kobold-ready-nw.png` |
| W | 1 | 2 | `studio-kobold-ready-w.png` |
| SW | 2 | 2 | `studio-kobold-ready-sw.png` |
| SE | 3 | 2 | `studio-kobold-ready-se.png` |

Files live in `assets/sprites/`. Their source/workspace dimensions, facing, pose, provenance, render dimensions, and ground anchor are recorded in `data/sprite-asset-registry.json`.

All six initially use a 48 × 60 rendered frame and a shared source-space anchor of `(80, 150)`. The anchor is calibrated from the exported image because the PNG contains no 3D ground-plane metadata. Full-frame padding and a shared scale are retained so turns do not stretch individual silhouettes to fit different bounds.

## Pose registration

The pose framework uses `stand` for ready, `attack` for action, and `prone` for the prone capture. A unit may select a visual set with `spriteSetId`; its combat `type` and statistics are independent of that choice. Folder-backed sets receive the internal ID `sprite-set:<manifest.id>` to avoid collisions with built-in combat types.

`UNIT_POSE_DEFINITIONS` supports `directionalSprites`, keyed first by pose and then by direction (`E`, `NE`, `NW`, `W`, `SW`, `SE`). Each frame registers its loaded image and asset ID. `js/sprite-set-runtime.mjs` reads the small index and per-character manifests, then uses the one-time `window.adventurePartySpriteSets.register({manifest, images, sourceUrls, layout})` bridge. Images and source URLs are keyed by the filenames in the manifest; `layout` supplies the shared footprint definition. The bridge stages all eighteen frames before updating the pose definitions and Pixel Editor assets together.

The renderer chooses a physical facing from `facingHex`. A missing or still-loading action frame falls back to that facing's ready frame. Directional artwork is drawn without mirroring; existing single-frame sprites retain their left/right behavior. Existing attack timers select the action pose and return to ready when the action interval ends.

Preserve source frame dimensions and anchors when adding action art. Pose changes should use a consistent canvas and camera so the character's feet remain attached to its hex.

Folder-backed characters are registered automatically in Pixel Editor with `preserveFrame: true`. Their render size and source-space ground anchor come from the manifest, so every facing and all three poses retain the same complete frame, model size, and attachment to the footprint. Pixel Editor preserves fractional render dimensions when applying an edit. The older ready-only Studio Kobold remains registered in the legacy flat asset list for compatibility.

## Validation

Run `node scripts/test-directional-sprites.mjs`, `node scripts/test-sprite-set-package.mjs`, `node scripts/test-studio-footprints.mjs`, `node scripts/test-studio-geometry.mjs`, `node scripts/test-studio-combat-exit.mjs`, and `node scripts/validate-repo.mjs`. The pose and footprint tests exercise production selection, registration, timers, drawing, all seven MOB factories, six rotated facings, occupancy/collision/targeting, missing/loading action frames, action expiry, prone conditions, atomic registration, initial-only inspection, and legacy behavior. Browser QA checks exact saved-capture reload and combat return, direct studio return after victory/defeat/manual exit, decoded asset pixels, selected MOB statistics, initial placement, model-size parity, movement/attack-facing updates, and Pixel Editor anchor/render-size preservation.
