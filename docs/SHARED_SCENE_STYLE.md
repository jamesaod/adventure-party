# Shared scene style — Candidate Rev 227

The user rejected Rev 226's enlarged wall blocks and approximate warm overlays. The required compact combat wall shows six brick courses. Floor slab size, lighting, doors and future windows must remain coherent when exploration squares convert to two tactical hex widths.

## One profile, two adapters

`js/exploration-scene-style.mjs` owns the visual scene coordinate system, material repeat counts, ambient hemisphere, lantern and torch settings, and reusable object dimensions. `exploration-materials.mjs` and `exploration.mjs` read it for the Three.js perspective scene. `exploration-encounters.mjs` re-exports it to the classic combat hooks so startup uses the same versioned profile.

| Property | Shared definition / policy |
| --- | --- |
| Scene tile | Existing 3-unit visual tile, described as metres; rules map metadata still labels a step ten feet. This is not a rewrite of rules distances. |
| Scene wall | 3.5 units high in perspective; compact tactical presentation stays 35 pixels high. |
| Tactical spacing | Two hex widths per exploration square. |
| Wall material | Six source brick courses over the full displayed wall face. Rev 226's vertical crop is superseded. |
| Floor material | Four source slabs per exploration square in each direction. Its footprint doubles with the terrain, preserving authored slab size relative to map cells. |
| Filtering | Progressive, anisotropic reduction to actual display width/height, accounting for battlefield zoom and render density. At most 512 pixels per source axis, with a bounded per-image cache. |
| Lighting | Shared sky/ground colors, hemisphere intensity, torch placement/color/intensity/range/decay, and party lantern placement/color/intensity/range/decay. |

Combat no longer adds a separately chosen warm floor veil or soft-light torch gradient. Its canvas adapter evaluates the shared hemisphere and Lambert point-light profile in scene coordinates, with the same inverse-distance exponent and smooth distance cutoff used by the bundled Three.js shader. The hemisphere and direct diffuse terms include the Lambert reciprocal-pi factor. Display exposure uses multiplicative darkening and color-dodge brightening to preserve black mortar/detail. These are renderer adapters, not identical raster pipelines: perspective foreshortening, shadow sampling, display gamma approximation and exploration flame flicker can still produce differences. Visual QA remains required.

The combat party lantern is presentation lighting; it does not grant new tactical sight or change the rules illumination source list. Existing architectural light-blocking geometry is consulted, preserving the engine's light/window blocking modes. The grid fallback exists for pure scene tests. Exploration torches now cast shadows as well as the lantern, avoiding the old unshadowed torch leakage through walls.

Floor exposure is baked over fixed encounter world bounds, then moved with the camera. Its cache invalidates when light positions, source properties or door snapshots change. Wall exposure is cached per wall and light state. Future mutable window/door geometry must also invalidate exposure caches when its light-blocking state changes; current combat doors remain snapshots.

## Objects: footprint is not artwork size

`projectSceneObject(kind, terrain, overrides)` accepts authored width/height/depth/sill dimensions. It returns:

- `width` and `depth`: the tactical placement footprint, projected through the current horizontal cell spacing.
- `height` and `sill`: vertical display measurements, referenced to compact wall height.
- `artwork.width` and `artwork.height`: a uniform, aspect-preserving display size, independent of tactical footprint expansion.

Doubling tactical spacing doubles the footprint, not the artwork's aspect ratio. Anchor artwork at the object's projected position and use its sill/attachment height; do not independently stretch a bitmap to the collision footprint. A closed broad-face door now exercises this path using the existing wood texture, centered in its logical doorway. Exploration's leaf, hinge and frame use the same door dimension record. Open combat door leaves are not newly simulated.

Window defaults and generic prop overrides are projection contracts with regression coverage, not a new window/prop authoring UI or imported asset library. When those objects are added, use their own authored dimensions, preserve bitmap aspect ratio, and register physical openings with the established movement/LOS/light geometry. Do not infer dimensions from a texture's pixel resolution or multiply heights by the 1:2 floor conversion.

## Validation

`scripts/test-exploration-scene-style.mjs` covers six courses/four slabs, shared profile values, door geometry, independent footprint/display axes, window sill behavior, generic props, lantern/torch settings, falloff and closed-door occlusion. `test-exploration-rendering.mjs` covers display-footprint filtering, texture phase, exposure caching and camera movement. Existing production collision tests retain open/closed doorway traversal at 1:2 and 35px wall height.

Browser QA uses one authored comparison room in both views, containing a torch and closed door. Confirm six courses, readable slabs without shimmer at normal/enlarged zoom, correct closed-door artwork, warm falloff, darkened distant surfaces, and no light/geometry regression on entry and retreat. The comparison fixture under local `work/` is scratch, not published game content.

## Rev 228 material adjustment

Floor slabs are half their former width and depth: eight slabs per exploration square, with the same source texture. Brick repeat width is halved independently of height; six rows still occupy each compact wall. Shared material settings change both views and the display-footprint filters continue to select anisotropic mips. Movement/door changes are recorded in EXPLORATION_ENCOUNTERS.md.

## Rev 229 — wider combat doors and edge-on cutaways

Combat door leaf artwork is twice its Rev 228 width (50px before zoom), retaining the 30.8px height. This is a tactical presentation override; the shared 2.5m scene leaf and one-square doorway footprint stay coherent with exploration. The broad face uses the original wood/iron texture. Doors on the edge-on axis use an oblique cutaway elevation with the same texture, stone surround and actual doorway threshold. Opening rotates the displayed leaf around a hinge and leaves a visible threshold. These compact elevations do not create extra blocking geometry or alter the 35px wall height. Both closed and open door entries participate in the existing actor depth queue and architectural visibility test.

Open Door rebuilds architectural movement/LOS/light geometry immediately. Lighting keys include the updated open-door list; the floor exposure and wall exposure caches consequently refresh. No separate indoor sun or artificial material glow is added.
