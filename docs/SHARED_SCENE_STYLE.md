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

## Rev 230 - solid frames and grounded hinges

Rev 229 outline-only frames are superseded by opaque, texture-filled masonry piers and lintels. Only the doorway aperture remains clear. The closed leaf base is the canonical hinge for both states, in both orientations; opening changes the projected leaf direction without translating its bottom hinge. This fixes floating open door artwork and floor/grid showing through masonry. Wall height, material repeats, movement/LOS geometry and door interaction costs remain unchanged.

## Rev 231 - one edge geometry for both views

exploration-edges.mjs owns canonical h/v edge coordinates and geometry, independent of either renderer. Exploration builds thin wall sections around floor squares; doors use the edge opening width and hinge, and windows have shared sill/height plus transparent glass and bars. Combat projects the same endpoints and opening fraction into architectural movement/LOS/light/projectile geometry. Edge door art anchors to the real aperture jamb in both states. The fixed 35px tactical wall height and existing shared material repeats/lighting are retained. Thin side-facing surfaces use readable cutaways; this remains a display choice rather than a blocked-hex conversion.

Rev 232: edge doors are half their Rev 231 width (default 42% of an edge), with unchanged height. Existing Rev 231 door widths halve once on working-copy conversion, marked by doorWidthVersion=2. Windows are unchanged. Both views and physical apertures use the corrected width.

## Rev 237 — projection-aware solid doors and walls

Rev 236 screen-space door edge decoration and planar canvas rotation are superseded. Exploration combat draws solid prisms from independent ground-plane coordinates and vertical elevations. Broad wood/stone faces use filtered material tiles; top and end faces belong to the same solid and hinge transform. Door leaf depth is exactly half the compact wall depth; 35px wall height and authored apertures stay intact. The camera rotates ground coordinates before applying vertical compression, and heights remain vertical. Floor texture/exposure matrices share that projection. Existing shared perspective materials and physical thin-wall/half-depth leaf dimensions are unchanged.

## Rev 239 — shared sconces and flame animation

Torch placement now carries flame XYZ, wall-plane position, front-offset backplate position, wall direction, attachment flag and a stable map-coordinate seed. Both renderers use the shared plate/stem/cup dimensions and the same bounded torchAnimation waveform (intensity, height, width and two-axis sway). Perspective backplates sit in front of the thin wall surface; brackets join the plate to the stem/cup. Combat projects the mounted floor position with a separate 23.5px flame elevation, preserving isometric rotation. Authored torches without an adjacent solid wall retain a freestanding support rather than inventing a wall. Door/window openings are not mounting surfaces.

Exploration uses the waveform for flame shape/position and point-light intensity. Combat uses it for flame/core/halo, local wall brightness and a wall-occluded floor glow. Existing baked physical floor exposure stays stable; no whole-floor bake occurs per animation tick. Shadow geometry stays fixed while the flame and light intensity animate. Reduced motion freezes the waveform in both views.
