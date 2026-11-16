# Sugar Maple: authoring and game integration

15 November 2026. The grass Combat Test now contains exactly one White Oak and one nearby Sugar Maple. Firs are omitted from this test scene; their assets and procedural placement are preserved. White Oak sources, models and family configuration remain available. Local implementation only; appearance and performance approval remain with the user.

## Native SpeedTree production

One seed/structure is preserved in `SugarMaple_Green.spm`, `SugarMaple_Fall.spm` and `SugarMaple_Winter.spm`. Separate `SugarMaple_Cluster_Green.spm` and `SugarMaple_Cluster_Fall.spm` are twig/leaf baking sources, not extra trees. The winter source hides the parent leaf generator and retains the fine wood. Fall uses genuinely separate scarlet/red-orange leaf artwork and matching native map family.

Corrected trunk: root radius profile 1, tip .218; radial displacement .04; length segments 24, radial segments 10; absolute radius 1.8 ft. Primary branch generation starts .36 along the trunk. Secondary bifurcation spacing .23 fills the crown; fine branches have absolute count 6 and parent length .25. Parent leaf clusters use 2.3 ft cards, interval frequency 60, count 2, and zero fold/curl. Increase branch distribution to fill the crown rather than enlarging individual leaves.

The individual leaf artwork has a nominal 10 cm blade, excluding petiole/margins. Cornell reports sugar maple leaves commonly 3–5 inches; Kentucky gives 3–6 inches. Runtime single-leaf cards are .13 m square, including the petiole, and reuse the artwork baked into the native clusters. Cluster leaves overlap and vary in apparent size; the nominal blade size is not a claim that every baked leaf measures exactly 10 cm. Both original green/fall PNGs are retained.

- [Cornell sugar maple reference](https://s3.amazonaws.com/assets.cce.cornell.edu/attachments/22873/Sugar-maple-2012.pdf)
- [Kentucky sugar maple reference](https://horticulture.mgcafe.uky.edu/sites/horticulture.ca.uky.edu/files/Sugar%20Maple%20-%20Acer%20saccharum.pdf)

Written tutorials were reviewed and applied: [Unity cluster workflow](https://docs.unity3d.com/speedtree-modeler/manual/clusters.html), [mesh anchors](https://docs.unity3d.com/speedtree-modeler/manual/mesh-anchors.html), [generation editor](https://docs.unity3d.com/speedtree-modeler/manual/generation-editor.html), [leaf mesh properties](https://docs.unity3d.com/speedtree-modeler/manual/leaf-mesh-generator-properties.html), and [SpeedTree photogrammetry tree workflow](https://magazine.artstation.com/2019/11/creating-beautifully-merged-photogrammetry-trees-with-speedtree/). Applied connected twig clusters, base anchoring, separate branch levels and matched seasonal maps. Video playback was unavailable; do not describe the videos as watched.

## Export and runtime geometry

Native Games OBJ, all LODs, metres, Z-up, scale 1, no flips. Green and fall share identical geometry. Winter shares the same wood.

| Native export | Green / Fall triangles | Winter triangles |
|---|---:|---:|
| Full | 93,262 | 38,354 |
| LOD1, used in game | 43,352 | 13,162 |
| LOD2, preserved | 14,891 | 2,109 |

LOD1 is approximately 20.19 m above native ground, with a 17.49 × 17.47 m crown envelope. Roots extend .35 m below ground. Conversion uses `(x, z, -y) * 43.38933076913966`, then renderer scale .18. The native ground datum is Z=0; do not copy the oak's .20 m offset. Root clipping and the lower .5 m snow-shell exclusion remain active. This is a single specimen budget, not a forest-wide performance recommendation.

Eight major connected wood components are extracted from the same Winter LOD1 export; smaller components attach to the nearest major limb. Matching stump and trunk are cut at one metre using the existing `continuousTrunk` / `splitTrunk` pipeline. Live fall uses these same shared split operations and cap geometry; no unrelated posed log is swapped at impact. Standalone matching stump/fallen exports are preserved as supporting assets.

## Shared implementation

`js/broadleaf-family.mjs` holds the preserved oak and new maple definitions. Both families load together: oak model slots 5–10, maple slots 11–16. Each owns its seasonal models, airborne leaf pool, scatter texture/geometry, GPU snow-landing history, and falling model. `ACTIVE_BROADLEAF` remains a compatibility default only. The right-side God Tool selects cut mode; click a tree base hex to fell that specific tree. Escape exits the tool. Reset Trees restores both.

The maple inherits seasonal switching, black wood outlines, daylight-fading fall crown outline, continuous rotation, shadows, precipitation shelter, grass exclusion and snow response. A two-hex tree exclusion radius and .65-hex grass feather are registered separately for maple. Original ground textures are unchanged.

Fall retains the six random safe directions, immediate stump separation, 2.6-second impact, settlement by six seconds, eight rigid settling limbs, matching leaf trail/impact burst, ground litter handoff, navigation reservations, solid grass flattening and existing licensed sound. New litter can land on existing snow and be buried by later snow. Falling removes the canopy's precipitation shelter; reset restores it. GPU bounded particle pools, retained ground-cover data and the shared scheduler remain in place.

The historical `oak*` API names remain for compatibility. Broadleaf behavior is selected by registry/profile rather than pretending the maple is an oak. Detached limb obstacle classification uses explicit `userData.debrisLimb` so imported mesh names cannot silently disable branch collision. Every substantial limb contributes to navigation and grass pressure.

## Preservation and validation

Editable native sources and SHA-256 inventory are in `tools/tree-production/sugar-maple/`. Original exports and complete textures remain in `C:/Users/james/OneDrive/Documents/ChatGPT/_Adventure Party Development_/outputs/sugar-maple/`. Native source archive may require relinking textures from this workspace. Bark derives from SpeedTree's bundled Maple_Bark_1 learning material; preserve its applicable license. Leaf artwork was generated for this project; provenance is recorded in authoring notes. Archived conversion scripts are references, not blind integration patch chains.

Run `node scripts/test-sugar-maple.mjs` for seasonal wood identity, finite geometry, dependencies, eight limbs, nominal leaf scale and profile checks. Hidden-browser checks verified exactly one maple, six rendered camera views, snow rendering, identical cut faces/no stump overlap, branch ground contact, seasonal particle-to-litter handoff, particle shutdown, all six fall directions, ten wood obstacles, unit safety and navigation reset, and shelter removal/reset. Appearance approval remains with the user. The stale tree-cache fixture now supplies its existing `fallState` input; production cache behavior was not changed.

Export detail: winter bark UVs differed only by integer texture repeats; conversion verifies positions/normals and equivalent UV wraps, then shares the green UV representation for byte-identical seasonal wood. The footprint fixture also now includes the existing debris predicates used by production movement.

## Two-tree comparison and God Tool follow-up

Scene placement is scoped to the grass Combat Test: oak at the original test position, maple on a nearby dry, walkable, unoccupied hex four to six hexes away. Polygon counts are unchanged. The maple's reported flat-looking trunk side has not been reshaped in this comparison pass; inspection of the exported 1.8 m cross section found approximately 1.03 × .88 m dimensions, not a collapsed axis. Visual/native-shape review remains open.

Per-tree fall records live in game.treeFalls. Both trees can fall independently, including overlapping animations, with separate seasonal leaf maps and shelters. Navigation combines all active reservations/settled wood; revision/phase keys invalidate reachability. Explicit limb metadata includes all eight branches of each species. Grass pressure unions separate filled tree hulls, preserving grass between unrelated fallen-tree footprints. Ground leaf keys include tree coordinates; species-specific GPU snow landing buffers retain older deposits when the other tree falls. World leaf and wood arrays retain identity through camera movement. Sound sources are tracked together for a complete reset.

Validation: both species across four seasons, absence of fir instances, independent falls with 20 combined wood obstacles, both landed leaf types, fractional rotations with retained caches, tool selection/reset, no runtime/shader errors, and pressure-field gap regression. No polygon reduction or publication.

## Reduced leafy crown — current gameplay configuration

Green and Fall now use maple-green-balanced.gltf / maple-fall-balanced.gltf: preserved native LOD2 foliage (12,782 triangles) plus unchanged LOD1 wood (13,162), for 25,944 triangles total, down from 43,352 (40.16%). Winter remains 13,162. Original maple-green/fall assets and all native sources remain available. Revert the first two Sugar Maple model names in broadleaf-family.mjs to compare the previous detail level.

The wood buffers are byte-identical to the existing seasonal family; stump, break cap, limb geometry and navigation remain matched. No trunk reshaping or winter simplification is included. Native LOD2 uses fewer, larger cards: six fixed-view canopy-mask comparisons retained 106.3–108.4% of the prior projected leaf coverage, with silhouette intersection-over-union 85.3–87.7%. This measures coverage, not an FPS improvement or final visual approval. Leaves may look slightly larger; the crown is not identical pixel-for-pixel. Conversion and comparison references are archived under tools/tree-production/sugar-maple/reference-scripts/.

## Additional catalog variants
See [Maple catalog](MAPLE_CATALOG.md) for the two SpeedTree-authored variants, seasonal sources, dimensions, matching debris, runtime selection and validation.
