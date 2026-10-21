# Six-direction combat sprites

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

## Ready and action registration

The pose framework uses `stand` for ready and `attack` for action. A unit may select a visual set with `spriteSetId`; its combat `type` and statistics are independent of that choice.

`UNIT_POSE_DEFINITIONS` supports `directionalSprites`, keyed first by pose and then by direction (`E`, `NE`, `NW`, `W`, `SW`, `SE`). Each frame registers its loaded image and asset ID. A future action sheet can fill the six `attack` entries using the same ordering, scale, and ground anchor as the ready set.

The renderer chooses a physical facing from `facingHex`. A missing or still-loading action frame falls back to that facing's ready frame. Directional artwork is drawn without mirroring; existing single-frame sprites retain their left/right behavior. Existing attack timers select the action pose and return to ready when the action interval ends.

Preserve source frame dimensions and anchors when adding action art. Pose changes should use a consistent canvas and camera so the character's feet remain attached to its hex.

Register each frame in both the engine's `pixelEditorAssets` list and the JSON asset registry. Use `preserveFrame: true` in its sprite specification to keep the full frame and calibrated anchor when opening or applying changes in Pixel Editor.

## Validation

Run `node scripts/test-directional-sprites.mjs` and `node scripts/validate-repo.mjs`. The pose tests exercise the production selection/timer/draw functions, covering six facings, movement, missing/loading action frames, action expiry, and legacy sprite behavior. Browser QA checks actual decoded assets, initial placement, rendering, movement/attack-facing updates, and Pixel Editor anchor preservation.
