# Tree asset production and game integration

Current runbook — updated 16 November 2026. This is the maintained procedure; the [development history](history/TREE_PRODUCTION_WORKFLOW_2026-11-15.md) preserves earlier experiments and superseded fixes. Keep work local until publication is requested. Visual approval belongs to the user.

## Repeatable workflow for all tree work

1. Identify the exact specimen, species, source SPM, seed, seasonal siblings, ground datum, dimensions and runtime registry entry. Research botanical references for new species; distinguish targets from measured geometry.
2. Save a separate SpeedTree source beside its material dependencies. Preserve the originals. Honor existing computer-control authorization; otherwise follow the permission rule below.
3. Keep the same trunk and major branches across green, autumn, bare, stump and fallen assets. Check clearance explicitly: the oak's requested ten-foot clearance is not proof that all species meet it.
4. Export each specimen to its own directory: Games OBJ, metres, Z-up, scale 1, no axis flips. Keep OBJ, MTL and matching maps together; identical material filenames must never overwrite another specimen's bark.
5. Convert reproducibly, preserving coordinates, ground datum, UVs and material ownership. Record source/output hashes, dimensions, trim heights, transforms and triangle counts. Adapt historical converters; do not replay their old integration patches.
6. Register seasons, wind, shadows, snow and shelter, litter, falling leaves, fall/stump/debris, navigation, grass pressure, sound and reset behavior as applicable. Keep shared caches and frame scheduling. Harvestable specimens also need their own explicit clubId.
7. Check source-to-game dimensions and Workshop-to-combat proportions independently. Run relevant geometry/gameplay regressions for code changes; respect a user-requested no-test edit and record it. The user performs visual approval; do not deliver unsolicited previews.
8. Save the native sources, dependency locations, converter, measurements, test results and remaining limitations in the linked records. Keep local until publication is requested.

### Feature records

- [Individual tree clubs](TREE_AS_CLUB.md): one distinct SpeedTree asset per individual tree, including same-species specimens; true physical size in Workshop and combat; one-hand carry and two-hand attack.
- [Source archive](../tools/tree-production/README.md): native sources and historical conversion references. Full export dependencies remain in the authoring workspace.
- [Tree environment profiles](TREE_ENVIRONMENT_PROFILES.md), [wind](TREE_WIND_RESPONSE.md), [branch snow](TREE_SNOW_DEPOSITION.md), [snow exposure history](SNOW_EXPOSURE_HISTORY.md), and [shore snow](STREAM_SHORE_SNOW.md).
- [White oak](WHITE_OAK_TEST.md), [sugar maple](SUGAR_MAPLE_PRODUCTION.md), [maple specimens](MAPLE_CATALOG.md), [beech](AMERICAN_BEECH_PRODUCTION.md), [sweet birch](SWEET_BIRCH_PRODUCTION.md), and [firs](SPEEDTREE_FIRS.md).
- [Tree-breaking AI history](TREEBREAKER_ORC.md): the special orc is retired; Hill Giants now use this behavior. Tree pickup is implemented, not future work.

## Start here

1. Define the species, size, silhouette, seasonal family, LOD budgets and interaction footprint.
2. Save a separate SpeedTree source, author the family, export and measure it.
3. Convert with a common coordinate system, ground datum and scale; preserve original geometry and artwork.
4. Register seasonal models, environment profiles, lighting/shadows/snow and continuous camera rotation.
5. Connect matching ground litter, airborne leaves, falling wood, sound, navigation and grass pressure as required.
6. Validate appearance, geometry continuity, gameplay boundaries and CPU/GPU costs. Record provenance and user review.

The white oak is the working reference, not yet a fully generic species importer. Several consumers still identify `whiteOak`, material names containing `Bark`/`Leaf`, and model indices 5–10. Adding another species requires explicit registration and checking those assumptions; replacing filenames alone is insufficient.

## Preserved production material

- [Source and reference archive](../tools/tree-production/README.md): editable SpeedTree SPM copies, historical conversion/extraction scripts, validation references and a SHA-256 inventory.
- Runtime family and provenance: `assets/terrain/white-oak/`.
- Original working directory: `C:/Users/james/OneDrive/Documents/ChatGPT/_Adventure Party Development_/outputs/white-oak/`. This contains OBJ/MTL/LOD exports, original textures, comparison viewer and backups. Large export/texture sets remain there; the source archive is not a complete portable SpeedTree dependency bundle. Relink materials from those originals if necessary.
- Historical scripts contain old paths and source-replacement patches. Read/adapt their conversion portions in a staging directory; do not replay the old integration patches against today's game.

## 1. Define the asset contract

Record species/biome, mature height and crown width, lowest branch attachment and exterior clearance, ground plane, root reveal, bark/leaf palette, polygon budgets, tree-spacing radius, grass feather, snow shelter, seasons and required debris. Count **triangles**, including foliage; editor polygon labels can be ambiguous. Approximate LOD targets were accepted for comparison, but record actual export counts.

Reference oak: 25.473 m above source ground Z=0.20 m; requested lowest branches at least 10 ft (3.048 m) above ground. The measured exterior crown clearance outside a 2 m radius was 7.6308 m; this is not proof of every branch attachment height. Check geometry explicitly. Use Carl (1.9304 m in the comparison viewer), a metre grid and the 3.048 m marker for scale review.

## 2. SpeedTree authoring

Ask before using the computer-use tool, per the user's standing preference. Save new SPM versions; never overwrite the sole source. Preserve seed, trunk, roots and major branch structure across seasons.

- Begin with the same white oak and create LODs by reducing branch segmentation and foliage detail. Compare all five requested budgets (1k–5k targets) at the same camera/scale; do not independently generate five unrelated trees.
- For a fuller crown, increase leaf distribution/density and coverage of branch tips; inspect gaps and attachment to twigs. The user explicitly accepted exceeding the initial targets for a better crown.
- Raised crown: raise the primary branch start and reduce downward gravity. Check both attachment height and drooping tips after export.
- Spring/Summer: shared green leafy source. Fall: native autumn materials. Winter: remove leaves and baked leaf-bearing cards, retaining bare wood.
- Fine winter variant: child generator under Twigs, number 4, length 22% of parent, radius 24%, segment scalar 0.12. Keep the lighter winter version; the fine version is not a forest-wide budget decision.
- Authored Fallen: horizontal log, roots disabled, capped broken limbs. Authored Stump: roots retained, crown disabled, Knot Cap end grain. These remain useful independent assets; the live fall now uses a matching split of the standing trunk instead.
- LeafFall: copy Fall, enable native `Season > Show dropped leaves` in late autumn, retain full editable tree and dropped foliage.

Sources: `WhiteOak_Working`, `WhiteOak_FullCrown`, `WhiteOak_RaisedCrown`, `WhiteOak_Fall`, `WhiteOak_Winter`, `WhiteOak_Winter_FineBranches`, `WhiteOak_Fallen`, `WhiteOak_Stump`, `WhiteOak_LeafFall` (.spm).

## 3. Export, inventory and compare

Export **Games Wavefront OBJ**, metres, Z-up, scale 1, no coordinate flips, all LODs. Preserve OBJ, MTL, color/normal maps and source SPM together; keep SS maps even if the runtime does not consume them. Record triangle totals per material, bounds, texture dimensions, alpha, source filenames, export settings and hashes. Do not confuse the separate source exports with the eventual runtime-generated split trunk.

| Family | Base triangles | LOD1 / 2 / 3 / 4 / 5 |
|---|---:|---|
| Raised green | 14,447 | 11,111 / 9,639 / 8,303 / 7,117 / 6,114 |
| Fall | 13,894 | 10,758 / 9,397 / 8,149 / 7,081 / 6,046 |
| Original winter | 9,036 | 6,410 / 5,281 / 4,292 / 3,679 / 2,950 |
| Authored fallen log | 1,726 | 917 / 684 / 493 / 392 / 281 |
| Authored stump | 326 | 161 / 163 / 129 / 109 / 97 |

Current fine winter base: 35,349 triangles. Original full-crown in-game trial: 10,726 (`Oak_FullCrown_LOD5.obj`); retained as `oak-10726`. These counts exclude runtime snow shells, leaf particles and generated break caps.

`package-family.cjs` records exported family counts/bounds; `build-family-viewer.cjs` constructs the separate review page. Existing comparison folder has `StartComparison.cmd`; historical viewer URL was localhost:8791/family.html. Verify the launcher/port rather than assuming it is running. Keep comparison tooling outside gameplay.

## 4. Coordinate conversion and materials

Use the same transform for every family member. Reference conversion:

```text
units = 43.38933076913966 model units/metre
position = (source.x, source.z - 0.20, -source.y) * units
normal   = (source.nx, source.nz, -source.ny)
uv       = (source.u, 1 - source.v)
renderer model scale = 0.18
```

Do not normalize each seasonal model by its individual bounding box. Preserve fan-triangulated faces, material groups, normals, UV seams and alpha. Reference glTF uses interleaved position/normal/UV records (32-byte stride), metallic 0, roughness .9, normal scale .45, and double-sided foliage with alpha MASK cutoff .35. Use unique names/filenames and preserve texture ownership. Refer to provenance JSON and glTF extras for asset-specific overrides.

**Critical:** read Three.js interleaved attributes through `getX/getY/getZ/getW` (or `fromBufferAttribute`), not `array[index * itemSize]`. The latter corrupted the trunk and produced false bounds and apparent airborne motion. Validate every extracted vertex against its source.

Clip buried roots in body and depth/shadow shaders. Snow shells omit triangles entering the bottom 0.5 m so root/cap geometry cannot form a white lump; ground snow handles that area. Root clipping must not change the standing ground datum.

## 5. Runtime registration and seasons

| Owner | Responsibility |
|---|---|
| `js/combat-fir-trees.mjs` | Loads tree family; seasonal geometry, materials, bounds, shadows, outlines and fall rendering |
| `js/combat-seasons.mjs` | Shared season service; independent of weather/snow |
| `js/combat-environment-state.js` | Placement, tree exclusion, fall request/direction and navigation state |
| `js/combat-render-frame.js` | Live tree rendering, actor order, world litter conversion and ground-cover inputs |
| `js/tree-environment-profiles.mjs` | Species spacing and grass feather/size overrides |
| `js/combat-snow-shelter.mjs`, `js/combat-fir-snow.mjs` | Precipitation shelter and tree snow caps |
| `js/combat-runtime.js`, `js/adventure-party.js`, `index.html` | Runtime loading and browser cache-version chain |

Current model indices: 5 green, 6 fall, 7 fine winter, 8 authored stump, 9 authored fallen log, 10 detached limbs. Spring/Summer map to green, Fall to autumn, Winter to fine bare branches. The grass Combat Test replaces its designated Big Tree; this is not a forest-wide replacement. Changing season must invalidate geometry/silhouette/bounds/snow/shadow caches appropriately without setting weather or resetting accumulated snow.

White oak spacing: axial hex radius 2. Grass absent inside 1.35 hexes, smooth return across .65 hex. Overrides: `exclusionRadiusHexes`, `grassFeatherHexes`, `environmentSizeScale`. Keep original ground textures, rocks and sticks. Do not project grass roots onto low branches; resolve the tree/grass painter order instead.

Live tree transforms use continuous fractional camera rotation. Sprite/silhouette atlas selection still uses integer frames. Do not reintroduce 30-degree snapping in live trees or fallen pieces.

Outline policy: trunks, branches, matching cut faces and fallen wood always have black outlines in every season, including night. Leafy crowns retain normal spring/summer outlines and fall deep red-orange `[.29,.065,.018]`, fading with daylight smoothstep from 0 to .65; winter has no leafy-crown outline. Reset per-draw state so other species are unaffected. Preserve ground and self-shadows during the fall; particles are excluded from tree silhouettes/shadow caches.

## 6. Ground litter and leaf artwork

Native leaf-fall extraction separates connected foliage components near the ground, excluding bark and the high crown. Preserve complete components and original UVs. Packaging compresses component vertical extent to 2.5%, raises the base 8 mm, and optionally creates a shallow 12 cm pile. These are post-export processing steps, not new SpeedTree generator models.

Preserved extracted assets: full spread 3,914 triangles, sparse 70, dense 320, pile 600 and `OakLitter_LeafCluster` 2. Extraction references are `extract-leaves.cjs` then `package-litter.cjs`. The runtime cluster geometry/UVs live in `js/combat-tree-litter.mjs`.

Use the **same atlas artwork** for scatter and particles. Fall uses `oak-litter-fall.png`; green uses `Oak_English_Cluster_Leaf_Summer_Color.png`. The single-leaf card's glTF extras retain crop provenance: x688/y57, 88×126 pixels on a 1024² atlas; nominal card height .14 m before runtime effect scaling. Retain UV orientation/flip/repeat settings. Do not recolor autumn leaves as a substitute for true green artwork. Match apparent size and illumination in-game, not just in the asset viewer.

Standing fall litter uses deterministic clusters, feathered to 1.25 times the tree exclusion radius. Other standing seasons do not get this autumn trunk litter. Fallen green trees do receive their own green patch. Ground-cover shader applies season tint, local lighting, water rejection, terrain elevation and snow burial. Ground litter renders before characters. Source files: `combat-tree-litter.mjs`, `combat-ground-cover.mjs`, `combat-oak-fall-leaves.mjs`.

Standing autumn leaf fall uses a bounded 96-card GPU pool (192 triangles). Shared scheduler, reduced-motion handling, no emissions from burning/burnt trees or shadow passes. This effect does not create unbounded persistent accumulation.

## 7. Matching wood, tree fall and leaf handoff

Current implementation is an oak-specific prototype. Preserve the standing connected trunk, split it at 1.0 m above the authored ground datum, and generate a common wood-ring break cap for both lower stump and upper trunk. `oak-continuous-trunk.mjs` and `oak-trunk-cut.mjs` own extraction/splitting. Do not swap to the separately posed authored log at impact: that caused position jumps and mismatched stump/trunk shapes.

The moving crown is clipped at the matching cut plane before the first fall frame. The stump is visible and stationary from time zero; the upper tree retains its foliage/branches and matching cut face as it topples. At impact, only the connected upper trunk remains and branches/leaves transfer to their existing debris effects. The continuous hinge/clearance calculation must stay consistent with particle release positions and the final trunk pose. One model-unit horizontal clearance separates the resting trunk from the stump.

Detached limbs: eight large connected bark components from preserved `WhiteOak_Winter.obj`; nearby smaller components assigned to the nearest major limb. Retain bark UVs/normals and store source pivots in glTF extras/provenance. This extraction did not author a new SpeedTree SPM. `oak-branch-rest.mjs` searches 192 rigid resting planes at load and caches 33 contact-height samples; update transforms only during flight. Do not squash geometry or scan vertices per frame.

`combat-oak-fall.mjs`: 2.6-second topple/impact, settled by six seconds. Reduced motion jumps to settled; reset restores the standing seasonal tree and clears event-owned effects. Wood stays common across seasons. Leaf-bearing broken limbs remain a future refinement.

`combat-oak-fall-leaves.mjs`: 160 trail + 6,400 impact cards. Precompute origins from actual seasonal canopy triangles. At impact hide canopy and release particles from its toppled pose, not a new ground-level cloud. Use independent deterministic timing/direction/spread parameters; capture wind at start. Spring/Summer green, Fall autumn, Winter none. GPU flight includes flutter, tumble and lateral sway; all cards land by six seconds and the pool becomes invisible with instanceCount zero.

Draw airborne leaves separately in actor depth intervals, with the same effect time for all passes. They must not render in the tree body pass over characters. Landing records feed an irregular feathered ground patch made from the existing cluster artwork, not thousands of permanent particle cards. Ground patch population is sampled independently from flight particles (currently roughly 1,200 clusters, scene-dependent), with stable array identity, spatial buckets and GPU arrival-time gating. Avoid correlated ordered piles and per-frame patch rebuilding. Reset removes the patch.

## 8. Fall direction, navigation and grass pressure

Shuffle all six hex fall directions and choose a clear one; preserve initial tree orientation with local yaw compensation. All wood, shadows, particles and litter share that direction. Refuse while units are walking or all directions intersect occupied footprints (`CLEAR FALL AREA`); this prototype does not damage or trap units.

`oak-debris-footprints.mjs` fits cached capsules to principal connected wood: trunk, stump and eight major limbs. Exclude leaf cards and tiny detached twigs. Reserve the broader swept fall area immediately, then use settled debris after six seconds, regardless of visibility/rendering. Keep the original stump/root obstacle. Check destination footprints, AI/path edges, multi-hex rotations and smoothed walking curves. Reachability caches distinguish reservation, settled and reset states. These obstacles do not currently alter LOS or cover.

`debris-grass-pressure.mjs` bakes a 256² feathered capsule pressure field only when footprint identity changes. Both grass methods deform on the GPU; pressure ramps from impact to full weight at four seconds and clears on reset. Combine snow/wood pressure by maximum and reduce wind under load. Do not rebuild grass placement or process individual blades on CPU.

## 9. Sound

Reference: matt_beer, “timber tree falling 1,” CC0. `assets/audio/oak-fall-matt-beer.mp3` and accompanying license provenance. Current downloaded high-quality preview is 9.5 seconds; skip 1.1 seconds of lead-in to align impact. Use the existing SFX bus, respect mute/reduced motion and stop on reset. Preserve license/source attribution when replacing audio. Avoid a second independent audio/render scheduler.

## 10. Validation and performance gate

Use the shared combat scheduler. Prefer retained geometry, bounded instancing, shader deformation and cached world data. No per-frame vertex scans, synchronous GPU readbacks, terrain re-bakes on camera movement, or accumulating landed particle pools. Keep grass painter sorting and the GPU compact terrain-source path intact. See [environment audit](ENVIRONMENT_PERFORMANCE_AUDIT_2026-11-15.md) and [snow/terrain GPU pass](SNOW_TERRAIN_GPU_OPTIMIZATION.md).

Run relevant repository tests from the repository root (Node 24):

```powershell
node scripts/test-combat-tree-order.mjs
node scripts/test-combat-tree-cache.mjs
node scripts/test-combat-tree-bounds.mjs
node scripts/test-combat-tree-antialiasing.mjs
node scripts/test-combat-grass-pan.mjs
node scripts/test-debris-grass-pressure.mjs
node scripts/test-combat-destination-movement.mjs
node scripts/test-studio-footprints.mjs
```

Add snow/water/footprint tests when those consumers change, and source-membership/hinge/branch contact checks for geometry changes. Preserved hidden-browser check references cover seasonal oak, smooth rotation, matching break, source vertices, branch rest, leaf handoff, sound/reset and debris navigation. They contain workstation/browser paths and some older startup assumptions; adapt before running. Hidden-browser checks are authorized; ask separately before interactive computer use. Browser boot: wait for `showCombat`, allow initialization to settle, invoke `showCombat('grass')` without awaiting its long-running promise, then wait for tree/unit resources.

Acceptance checklist:

- All seasons at identical scale; original lighter assets retained; finite geometry and source-matching vertices.
- Root reveal, raised crown, alpha/texture seams, leaf color/size, daytime and dawn/dusk/night outlines.
- Continuous rotation and shadows while standing, falling and settled; no impact jump, stump overlap or floating cage of branches.
- Airborne leaves depth-order around Carl; ground patch replaces particles; no lingering pool; water/snow burial correct.
- Six clear fall directions; occupied/walking guards; swept reservation, settled obstacles, rotation-invariant world positions and reset.
- Snow accumulation, melt, footprints, streams/puddles and fallen-wood grass depression.
- No asset/shader errors; repeated fall/reset without retained object growth.
- Same camera, season/weather, viewport and warmed assets for CPU/GPU comparisons. Report submission vs GPU timings separately; do not infer FPS from overlapping timers. Watch tree/cover passes, draw/triangle counts and source-upload/cache reuse.

## Completion record / next species template

For each new tree, record: species/id; source SPM/export filenames and hashes; authoring settings/seed; texture/license provenance; units/axes/ground datum; measured height/clearance; seasonal and LOD triangle counts; material names; scale; spacing/grass/shelter profile; leaf crop and tint; break height/pivots; runtime registration/cache keys; sound; validation commands/results; performance baseline; user visual approval; unresolved tradeoffs. Save sources before edits and keep conversion inputs reproducible.

Still future: forest-scale LOD policy (especially 35k winter), gradual seasonal transitions, general persistent leaf accumulation, damage/knockback, cover/LOS changes, and a generic importer for all broadleaf species. Existing falling animation, seasonal swaps, ground handoff, stump/log integration, navigation and grass pressure are implemented; older notes saying otherwise are superseded.

Immediate-break validation (2026-11-15): nine combinations of green/fall/fine-winter and three local fall yaws passed. Stump present from frame zero and unchanged through six seconds; no below-cut bark travels with the crown; moving cap present; impact cap position continuous within 0.001 model units. Source hashes and runbook links verified.

Root-cap follow-up: SpeedTree baked atlas meshes can contain below-ground root/base-cap geometry even when their material is not named Bark. Clip every moving material at the break plane; retain the matching generated wood face only on the trunk. Checking bark alone allowed a circular old base to emerge during the fall. The updated real-asset check covers every moving mesh in nine season/yaw cases and preserves the stationary stump and continuous impact.

Continuous fallen-tree grass mat: grass pressure fills the convex envelope of the trunk/stump/major-limb capsules, including all gaps between branches. The outer edge feathers; the interior has full pressure and zero blade height on the GPU. Existing impact-to-four-second strength ramp and cached 256² bake remain. Navigation still uses individual physical wood capsules, not this visual envelope.

Wood-outline implementation: tree-wood-mask.mjs retains source alpha, deformation and ground clipping while rendering a wood/foliage ID mask. Foliage depth-occludes hidden wood. The composite applies black wood edges independently of seasonal leaf tint, snow-outline tint and daylight fading. Airborne particle passes are excluded. Mask render targets use a bounded reusable pool; materials are cached. This adds one GPU mask pass per live tree/body draw. Hidden-browser checks passed shader compilation, fall/reset/navigation, visible wood, foliage occlusion, cut-cap classification and material restoration.

Fallen canopy shelter: at impact (2.6 seconds), exclude the oak anchor from the standing precipitation-shelter input. Reset restores it. The shared shelter key rebakes once on transition, not every frame. Hidden-browser check: center exposure 0 before, 1 after, 0 on reset, unchanged revision on a repeated frame. Ground litter and physical stump obstruction remain independent.

Implemented snow-top leaf handoff: leaf-snow-landing.mjs uses a pair of small RGBA8 render targets, one texel per fallen leaf cluster, to capture filtered snow height (including shelter and footprints) when its arrival time is reached. Heights use 16-bit encoding; no runtime GPU readback. Subsequent surface changes may only lower the saved resting height, so melt/compression settles leaves and later snowfall buries them instead of lifting them. Existing standing-tree litter remains at ground level, and water rejection remains in the ground-cover placement path. The shared scheduler updates the small capture pass only for changed snow, newly due landings, or reset; grass layout is not rebuilt by capture updates. The ground-cover vertex shader adds the retained height, while its existing snow-burial shader hides subsequently covered leaves.

Snow-top validation: hidden GPU probe passed arrival timing, captured six-inch height, unchanged resting height under deeper snow, melt to ground, no rising with renewed snow, unchanged-frame reuse and reset. Production seasonal handoff/shader checks passed summer/fall/winter, existing litter, stable deposits, airborne shutdown, rotation, sound and reset. Grass placement/pan regression tests passed.

## Sugar Maple follow-through

See [Sugar Maple production](SUGAR_MAPLE_PRODUCTION.md) for the second species, preserved native sources, leaf dimensions, shared active-family registry and matching maple debris. The grass test now displays one oak and one nearby maple together, with fir instances hidden and preserved. The right-side God Tool targets either tree independently; Reset Trees restores both. Explicit debris-limb metadata replaces the old oak-only name assumption for navigation and grass flattening.

## Shared wind and spell response

See [Tree wind and explosion response](TREE_WIND_RESPONSE.md). New broadleaf variants should retain the common model coordinate/scale contract so GPU bending, normals, snow and shadow motion remain aligned. The current implementation uses a shared deformation field; it does not require native SpeedTree wind data.

## Sugar Maple catalog extension
[Maple catalog](MAPLE_CATALOG.md) records the upright and broad-crown variants. Keep botanical species separate from model choice, preserve the original, export matching seasonal siblings, and derive stump/limbs from each variant's own wood.

## American Beech catalog addition

[American Beech production](AMERICAN_BEECH_PRODUCTION.md) records the first Beech, native sources, botanical research, seasonal exports, 22,982-triangle runtime, matching debris and species-owned leaf/snow integration. Registry base 29 joins oak base 5 and maple bases 11/17/23; Grassy Battlefield displays all five together.

### Multiple simultaneous falls: transient GPU targets (2026-11-15)
There is no two-tree gameplay cap. At 1600 x 1000, the former 64 MiB cropped-target LRU thrashed when three or more crowns emitted leaves across actor depth slices. Three falls allocated 364 targets per frame; five allocated 606. Measured frame times reached 680–1663 ms (three) and 1009–1766 ms (five).

Particle slices now share one high-water scratch target, and sequential wood-outline masks share another (`combat-transient-target.mjs`). Each pass is composited immediately before reuse; persistent corpse images and unit caches retain their existing lifecycle. Full crop projection and normalized texture coordinates preserve alignment when the scratch texture is larger than the requested crop. Targets grow only as needed and dispose with the renderer. GPU wind/particle motion, leaf density, depth slicing, outlines and shadows remain enabled.

Same hidden-Chrome workload after the change: three warmed falls 60–126 ms; five 99–114 ms, with five remaining ordinary target allocations per frame instead of hundreds. Four-fall timings were variable (148–280 ms). This removes the allocation cliff, not every rendering bottleneck; approximately 1,596 draw calls remain with five falls. These are local controlled impact-frame measurements, not a guaranteed FPS or universal tree limit. Cold shader/setup frames remain slower.

Regression: `node scripts/test-combat-transient-target.mjs` covers 3,000 sequential scratch requests, growth, sample changes and disposal. `node scripts/test-combat-render-cache.mjs` covers retained cache behavior. Hidden-browser Beech checks validate seasonal assets, independent fall/reset, leaf scatter, GPU snow landings and shader compilation. The next performance target is redundant depth-sliced particle submissions while preserving actor occlusion.

### Frame timing coverage (2026-11-15)
The CPU Trees row previously timed only the renderer callback. Trees total now wraps the complete tree asset get/preparation path; Tree passes includes target selection, rendering, masks and compositing. Separate Leaf passes, Wood masks, Composite and Surface draws expose previously hidden work. GPU chart now includes Wood outline mask. Unattributed reports frame duration minus the union of measured synchronous scopes (nested scopes are counted once); category rows still overlap and must not be summed. A five-standing-tree smoke test passed without errors. A representative warm frame was 20.8 ms, with Trees total 1 ms and Unattributed 14.8 ms: do not assume polygon count explains this remaining cost. Cold loading/shader compilation can inflate the 120-frame rolling average.

### Fallen canopy outline correction (2026-11-15)
Hidden-unit outline candidates must reject trees with treeFallFor(tree) before computing standing canopy bounds. Fallen tree geometry still renders normally, but its former upright canopy cannot hide units. The canvas mask fallback must never call drawTreeDecoration during direct GPU rendering: doing so can render the tree again into the active scene instead of producing a mask. Standing-tree masks and wall occluders remain supported. This fix does not introduce a new fallen-branch unit-outline mask. Regression: scripts/test-fallen-tree-occlusion.mjs.

### Hidden-unit outline performance audit (2026-11-15)
At 1600 x 1000 in hidden Chrome, summer with five standing trees, 45 measured frames after 20 warm-up frames: baseline median frame submission 18.6–20.6 ms, hidden-unit outlines 8.1–10.3 ms. A diagnostic half-draw-range experiment gave 19.7 ms; disabling tree wood/crown masks gave 19.3 ms. These are diagnostic workloads, not production LOD assets or a forest capacity guarantee. GPU sampled Trees averaged about 0.73 ms and Wood outline mask 0.13 ms in the combined audit.

Hidden-unit occlusion masks now cache by stable tree coordinates, silhouette image/crop, relative placement, unit extent and water clipping, plus wall polygon structure/coordinates. Decoration objects are recreated per frame and MUST NOT serve as identity keys. Fallen trees stay excluded. Changed masks get a revision; GPU mask textures and unit silhouette render targets are retained in a 32-entry LRU, disposed on dimension change, eviction or renderer disposal. The animated unit silhouette still renders every required frame, so animation is never frozen. Canvas fallback masks without a stable silhouette are rebuilt each frame. CPU readback remains on cache misses; this is not a fully GPU occlusion solution.

Final same-scene medians: frame submission 10.6–12.4 ms, hidden-unit outlines 0.9–1.1 ms; P90 13.1–16.4 ms. Final frame reused eight masks with no mask builds/uploads. Preserve tree geometry for now; establish forest-scale LOD budgets separately. Camera rotation, moving units, and changing occluders invalidate masks and can cost more than this stationary benchmark.

Regression checks: scripts/test-outline-mask-cache.mjs, scripts/test-fallen-tree-occlusion.mjs, scripts/test-combat-performance-coverage.mjs, plus hidden-browser seasonal/all-five-fall/reset smoke checks. Unit outlines now have an explicit CPU chart row. Keep local; user performs visual QA.

## Sweet Birch catalog addition

[Sweet Birch production](SWEET_BIRCH_PRODUCTION.md) records Betula lenta, editable seasonal sources, 12,918-triangle leafy / 7,958-triangle bare runtime, matching wood and debris, litter type 7 and registry base 35. Grassy Battlefield now displays six specimens. Final appearance remains user QA.

Landing performance: prepare hidden landing/mask shaders before impact, retain cached debris masks and benchmark pixel parity when optimizing them. See the 16 November tree-landing entry in ENVIRONMENT_PERFORMANCE_AUDIT_2026-11-15.md.

Tree-impact snow rule (16 November): canopy removal must publish localized finalized shelter changes, including trunk feathering and bilinear neighbors. Never resample/recount the whole coat map for a local tree fall when the prior revision is available. Preserve retained snow and coverage accounting; use full rebuild only for first load, changed bounds or skipped revisions.

### Giant presentation adjustments — 16 November 2026

Giant footsteps use gain 0.6384 (+33%). The pushing turn retains the camera through the six-second fall and one extra second before advancing. Successful giant melee hit audio is scheduled at 2.4 seconds from the continuous attack pose start, guarded against changed sessions/actions; damage rules are unchanged. Missed giant swings temporarily add a random ±12 degrees to visual aim, restored after the attack pose; tactical hex facing stays unchanged. Giant Workshop models and saved grips are untouched.
