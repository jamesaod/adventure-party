# Sugar Maple catalog variants

Two additional trees authored in SpeedTree Modeler 10.2.0 on 2026-11-15. These are Sugar Maples with scarlet fall foliage, not the separate Red Maple species. The original maple and oak remain intact.

## Using the catalog

Grassy Battlefield displays all four specimens simultaneously: one White Oak and the original, upright and broad-crown Sugar Maples. There is no Maple dropdown and old mapleVariant URL parameters are ignored. All four contribute to the performance display and can be felled independently with the God Tool.

| Variant | Height above ground | Crown width x depth | Leafy triangles | Winter triangles |
|---|---:|---:|---:|---:|
| Original | 66.90 ft | 58.52 x 58.49 ft | 25,944 | 13,162 |
| Tall / upright | 71.54 ft | 58.11 x 60.24 ft | 24,404 | 12,606 |
| Broad crown | 70.71 ft | 71.78 x 75.43 ft | 24,180 | 12,032 |

Dimensions measure the runtime balanced mesh above authored Z=0, excluding buried roots. Crown dimensions are axis-aligned bounds. The broad tree's shortened trunk still supports long upper branches, so total height is close to the upright tree; the main distinction is its wider crown. Native high-detail sources contain 87,394 and 87,288 triangles respectively. Runtime keeps LOD1 wood plus LOD2 leaves, as with the original. No runtime decimation or per-frame CPU deformation was added.

## Authoring changes

Save As from preserved original Green before editing. Randomize once for Tall, then preserve that seed through green/fall/winter. Tall trunk Spine Length Absolute 50 ft (original 45); Branch 1 length percent-parent .38 (original .50). Save seasonal siblings; swap existing cluster green/fall maps and accept companion maps. Winter hides the parent Leaf Mesh generator; do not delete it.

Broad starts from Tall Winter with another Randomize. Trunk Spine Length Absolute 38 ft; Branch 1 percent-parent .60 and Start Angle .46. Show parent Leaf Mesh for Broad Fall, then Save As Green and restore green cluster maps. Other authoring values, material colors, leaf cluster size and individual leaf art remain unchanged. Preserve the 10 cm nominal individual leaf blade; the particle card is .13 m including its petiole.

Export each seasonal source: Games, Wavefront OBJ, All LODs, scene Foot -> Meter, scale 1, no axis flips. Conversion maps (x,y,z) -> (x,z,-y), 43.38933076913966 model units/metre, native ground Z=0 and existing runtime scale .18. Normalize equivalent winter bark UV wraps to green after asserting identical positions/normals; single-precision UV tolerance is .0001.

## Matching assets and behavior

Each variant has its own balanced green/fall, winter, matching 1 m stump and severed trunk, and eight extracted connected limbs. They use existing single-leaf artwork for particles and scatter. All existing season, GPU wind/blast, outlines, immediate stump split, falling leaves, snow/leaves, weather shelter, grass flattening, navigation and God Tool behavior stays in the shared runtime. Species remains sugar-maple; the catalog chooses assets rather than introducing fake species or duplicating behavior.

Runtime assets: `assets/terrain/sugar-maple/variants/{tall,broad}`. Registry: `js/maple-catalog.mjs`, consumed by `broadleaf-family.mjs`. Each catalog maple occupies its own model range (11, 17, 23) and independent fall/leaf renderer. Botanical species remains sugar-maple for shared litter and environmental rules.

Native six seasonal SPMs and hashed export inventory are preserved under `tools/tree-production/sugar-maple/variants`. Original OBJ exports and texture sources remain in the working `outputs/sugar-maple` folder; native SPMs may need texture paths relinked there when moved. Reference conversion scripts are archived as `.txt`; they document the current workspace/repo paths and should be parameterized before reuse elsewhere. Do not rerun historical game patch installers.

## Validation

`node scripts/test-maple-catalog.mjs` verifies counts, finite positions, dependencies, byte-identical seasonal wood, distinct trees, eight limbs, and leaf scale. Existing `test-sugar-maple.mjs` protects the original. Hidden browser checks exercise both new maples through four seasons, independent oak/maple falls, twenty combined obstacle capsules, litter, rotation and reset. User retains visual QA; no publish/deploy.
