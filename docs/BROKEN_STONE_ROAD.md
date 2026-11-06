# Broken City Streets

Select View > Floor Texture > Broken City Streets, then paint normally. The brush stays selected. Adjacent painted squares automatically connect; Erase and Undo rebuild their borders. The selection inspector can apply it to multiple selected squares too.

`ground` stores `r`, not hand-picked tile IDs. `broken-stone-road.mjs` generates a world-aligned partition of mixed square and rectangular slabs with seeded chips, cracks, color and missing slabs. Rounded corners, tight joints and occasional slight overlaps soften the packing. Small scattered recessed joints and rarer, smaller erosion patches expose the unchanged dirt. Nine warm ivory, cream, sand, olive-gray and taupe colors avoid the former cool cast. Boundary wear consults neighboring painted squares, including corners. Grass fringes reuse the existing dirt/grass compositor. No runtime AI service or random redraws are involved.

Editor thumbnails, both 3D overview modes, first-person exploration and combat use the shared generator. Combat uses authored-cell UVs, keeping the stone scale independent of the 1:2 tactical subdivision. Generated canvas textures are cached. Existing maps need no migration. Save, export, test snapshots and resize retain the material code.

This is a procedural first art pass rather than twelve separately generated bitmap assets. Directional lighting is supplied by the existing renderers. Gameplay movement, LOS and wall construction are unaffected.

Validation: `node scripts/test-broken-stone-road.mjs` plus existing terrain/editor/exploration checks. Internal browser: persistent road brush, adjacent paint and combat overview verified.

Depth art pass: cached substrate occlusion, stone contact shadows, rounded bevel highlights and dark lower rims emphasize recessed dirt and seams. This is baked texture relief, not displaced geometry or a new normal-map shader; existing scene lighting still applies.

Normal relief: lazy cached linear-data normal textures derive from the same rounded slabs, with bevels, bowl wear, pits and fine unevenness. Exploration and preview use roughness 0.98, metalness 0; combat applies those normals to local torch and spell diffuse lighting without changing LOS or terrain geometry. Combat sun/ambient exposure remains its existing baked path. No displacement or new shadow pass.

Tan refinement: warmer sandstone/tan palette. Dirt uses a cached nearest-stone-edge occlusion gradient, strongest at the rounded rim and fading over 0.075 authored squares toward patch centers; neighboring cells contribute for seamless borders. Overlapping gradients use maximum opacity, not accumulating blackness. Original dirt imagery and normal relief are preserved.

## Matching City Sidewalk
Paint City Sidewalk in the Floor Texture view. Ground code p persists through map packs and encounters. Connected squares omit their shared curb course; exposed edges get curb blocks. Slab orientation follows adjacent straight wall edges (including solid-square boundaries). Corners receive edge courses on both exposed sides. It shares the tan palette, worn bevels and cached normal maps, with fewer missing stones. Exploration and preview slabs rise 0.15 metres; combat projects the same shallow rise with exposed curb faces. This is visual curb height, not a new movement penalty or tactical elevation system. Curved walls clip the existing floor polygon; paving follows the square lattice, not concentric curved courses.
Validation: scripts/test-city-sidewalk.mjs. User visual QA pending.

Sidewalk brick scale: one-third original width and length (nine times as many face bricks). Curb bands retain their width but use three rows of smaller bricks; joints, corner radius and normal bevel width scale with the bricks. Raised height remains 15 cm.

Visual QA adjustment: sidewalk bricks now use half the original width and length, superseding the one-third trial. Joints, rounded corners and normal bevels use the same half-scale; curb bands contain two rows.

Road/sidewalk contrast: Broken City Streets diffuse tiles receive a subtle 13% brightness reduction. Raised sidewalk artwork and both materials normal maps remain unchanged.

## Broken City Streets Tiles Ver 2
Separate ground code v and editor brush ground-road2. Source assets/textures/exploration/broken-city-streets-v2.png is the approved imagegen reconstruction from the user-supplied street reference (built-in image generator; prompt requested only irregular rectangular pale paving and ochre dirt, muted hand-drawn map art, no buildings or props). Original street and sidewalk materials remain available. Image is mapped across four authored squares per side, then mirrored into an eight-square repeat to align outer edges. No random per-cell rotation; paint order does not affect alignment. Cached normal atlas is derived from stone/dirt color separation and smoothed height gradients, using the existing matte shader path. This approximates surface relief from artwork, not measured geometry. Visual QA pending.

V2 sharp-edge QA: stone/dirt segmentation now produces a narrow near-vertical riser normal instead of the former five-pixel smoothed bevel. Surface texture contributes separately at low strength. This is lighting relief only; the ground mesh remains flat.

V2 scale doubled: source crops are now 128px per authored square instead of 256px, with a 16-square mirrored repeat. Color and normal maps use the same crop so stones and relief remain aligned across editor, exploration and combat.
