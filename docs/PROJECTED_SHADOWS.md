# Shared projected combat shadows

Local prototype, November 5, 2026. Presentation only; gameplay LOS, targeting and damage are unchanged.

## Current caster source: actual character models

Latest corpse test settings: 50% saturation, with a single uniform-area position sampled inside the death hex at death-beat start. Wall intersections shorten the offset; sealed/non-renderable positions are rejected. Falling, prone, depth ordering, evaluated model shadows and blood emission/pool use that same persistent placement. Unit tactical coordinates/occupancy are unchanged. Persistent Carl clears corpse placement/orientation/timing on a new battle. His test inventory now equips Chain Mail +5 as an explicit base-AC-0 chain variant through the shared armor resolver.

Battle completion now waits at a visible right-panel “Press Space to end” button/prompt after all existing result holds. Space (or clicking the prompt) acknowledges the result, then runs the unchanged exploration/Studio/XP-loot routing once. No rewards or automatic navigation occur before acknowledgment. Manual exit and a new battle clean up the prompt. Tests cover victory/defeat, Studio and ordinary result routing, delayed acknowledgment and repeat guards.

Corpse continuity/appearance correction: a lethally damaged target stays in the render queue, upright, while awaiting its queued death beat. That beat still exclusively starts falling, death audio/marker and the expanded blood sequence; it no longer disappears between damage and death messages. At death-beat start, one random facing among the six captured world directions is stored as `deathFacingHex`; falling and prone select the same facing and camera rotation changes only its view. Original tactical facing, authored scale, occupancy and living-unit render behavior remain unchanged. Falling/prone corpse ink uses 75% saturation (25% toward luminance), in the GPU sprite shader with a Canvas `saturate(0.75)` reference fallback. This does not recolor source assets or shadow geometry. Regression covers pending-beat visibility, pose timing, world-fixed corpse orientation and GPU color readback/non-leakage into subsequent living sprites.

### Pre-combat preparation efficiencies

Appearance cache keys exclude only unit instance ID and display name; model, height, equipment, animation, pose captures and render settings remain part of the visual key. Differently named identical units now share in-flight and cached sprite/shadow work while retaining separate per-unit revision guards. Tests cover cross-unit reuse and equipment invalidation.

The combat model generator no longer renders/readbacks a second fixed-noon bitmap shadow for each facing: generated images always retain actual evaluated model shadow geometry, so those unused legacy captures were duplicate work. Studio's independent capture/export shadow path and PNG-only fallback remain. Source/native PNG decodes are started together instead of awaited serially. Loading text updates every stage, but paint yields are throttled to 50 ms instead of imposing one display-frame wait per facing.

Single matched local-browser sample (Carl, standing/attack/falling/prone): 1,539.9 ms before → 1,394.3 ms after, about 9.5% less total generation time. Shadow simplification 861.6 → 829.1 ms; output triangle counts stayed 435/440/441/437. Browser reported no errors and retained live GPU shadow submissions. This is a small sequential wall-clock sample, not a guaranteed speedup; roster-wide sharing gains were verified by tests but not timed. Main remaining cost is the r180 simplifier. Next candidates are content-keyed reuse of simplified body parts across equipment changes and cached model loading with correct skeleton/material ownership; neither is implemented in this pass.

Death presentation follow-up: model regeneration supplies an earlier frame from the same real death clip when an older profile has prone but no falling capture. Death presentation starts on the existing death-result beat, holds falling for 1,000 ms, then retains the prone body as depth-sorted scenery. Its posed model shadow follows the same source-image association. Dead bodies do not become tactical occupants, targetable units or initiative participants. Death emits 4× normal blood droplets spread over 4× the normal emission window, then a wall-bounded irregular pool grows from the prone transition for 3 seconds and persists for the encounter. The shared transient-effect scheduler drives the finite growth; completed pools do not keep a frame loop alive. Existing corpse-free occupancy checks remain authoritative. `test-combat-death-scene.mjs` verifies timings, count, lifecycle and movement access.

### Simplified model-derived shadow meshes

Shadow preparation now uses the official Three.js **r180** `SimplifyModifier`, matching the installed renderer (this older version uses Melax edge collapse, not the meshoptimizer implementation in newer Three.js documentation). The addon is vendored locally; only its Three import path is adapted. The existing BufferGeometryUtils import is likewise local for Node/browser parity.

Each evaluated pose is extracted into root-local, position-only meshes, welded and simplified toward a combined 500-triangle budget. Small mesh attachments receive a reserved budget so a weapon is not discarded in favour of the dense body. The result is prepared once per pose and reused for all six facings. Original visible model geometry and sprite generation are untouched. Equipment changes use the existing appearance-recipe invalidation/cache, preparing new shadows with new sprites; unchanged cached appearances reuse both. No simplification runs in the combat frame loop. Targets are approximate because edge-collapse topology determines the actual result.

Browser benchmark, November 5, 2026: Carl ready 435 triangles / 275.2 ms preparation, attack 440 / 217.9 ms, prone 437 / 215.8 ms, from 22,389 triangles each. Total shadow preparation 708.9 ms; complete sprite-set generation 1,304.7 ms including loading, captures and images. A combat frame submitted 435 shadow triangles, with no renderer errors. These are single local-browser wall-clock preparation measurements, not GPU render timings or guaranteed FPS. The latest generation breakdown is exposed as `html[data-shadow-preparation]` for reproducible inspection.

The generic anatomical stand-in was rejected by the user and is no longer imported or selected by the production shadow renderer. Earlier proxy notes below are historical.

`combat-model-shadow.mjs` retains evaluated model vertices (including skinning, morphs, equipped mesh attachments and the captured facing) while `combat-mob-renderer.mjs` renders each sprite frame. A WeakMap associates the compact typed geometry with both source and battlefield images. It stores normalized ground-plane frame coordinates and vertical displacement; these reconstruct the exact captured projection and use the same anchor, scaling and camera conversion at combat draw time. No alpha foot guessing or separately chosen animation is used for those models. Model resources may then be released normally; only the evaluated frame geometry remains with the sprite cache.

The existing GPU sun/point projection, source-owner exclusion, receiver falloff and local penumbra are unchanged. Real meshes are substantially denser than the rejected proxy (Carl submitted about 22,000 shadow triangles in a local sunlit browser check); no performance improvement is claimed. Older PNG-only/imported captures without retained model geometry keep their sprite-silhouette fallback rather than receiving an invented humanoid. These must be regenerated from the repository model to get real mesh shadows. Lighting conversion remains paused.

Validation: `scripts/test-combat-model-shadow.mjs` checks exact screen reconstruction, facing changes, visibility, evaluated skinning and image association. Shared projection, unit-shadow and architecture checks pass. Internal browser entered combat with real mesh shadow submissions and no renderer errors; local-light visual QA remains with the user.

## Ownership

- js/combat-projected-shadows.mjs owns GPU vertex projection, alpha-mask sampling/soft edges, receiver clipping, batching and pooled resource lifetime.
- js/combat-webgl.mjs owns its frame lifecycle and scene composition.
- js/combat-lighting-services.js adapts live solar/torch/lantern/spell emitters, ranks at most two local sources per caster, prepares a cached visible-floor receiver mask, and supplies unit/arrow caster geometry in physical metres.
- js/unit-sun-shadow.mjs reuses cached sprite alpha silhouettes and foot-contact information. Studio captures and the CPU fallback retain their prior behavior; combat uses live solar/light data through the GPU adapter.
- js/combat-render-frame.js submits ground shadows before the scenery/unit depth queue. Wall-lodged arrows use a receiving-wall plane immediately before their arrow artwork.

## Behavior

Sun shadows disappear below the horizon and do not project onto indoor receivers. Local lights can cast shadows at night. Point-light rays project away from the emitter, changing shape/length as it moves. Light/caster range and wall reach checks select local sources. Ground reception is clipped to authored/renderable floor and party visibility. Hidden/invisible units do not reveal themselves through shadows. Shader projection is capped at six caster heights near the horizon or a nearly level point source.

Unit sprites are upright silhouette approximations with a conservative near-ground prone treatment. Arrows use their thin shaft/fletching alpha mask with endpoint heights. Wall arrows receive shadows on the actual wall span; ordinary units currently cast onto ground, not onto other units or vertical walls. These are planar projected shadows, not full 3D shadow maps or a new scene lighting simulation.

## Performance and boundaries

One sun plus at most two strongest reachable local sources per caster. Casters sharing an alpha texture, light and receiver are batched. The existing 30 FPS scheduler drives light/effect movement; no new timers or shadow-map renders. Source alpha/foot-contact masks are cached. The 512px receiver mask is rebuilt for camera/party/terrain changes, rather than for solar-clock animation. Temporary GPU buffers and unused mask textures are released through the renderer lifecycle. Canvas still draws the visible unit/arrow artwork; GPU shaders project and rasterize their production shadows.

This first foundation checks light reach at the caster and clips to visible ground; it does not trace every projected shadow pixel against intervening architecture. Full per-pixel architectural shadow occlusion remains separate from gameplay LOS and is not claimed here.

## Verification

Shared shadow-pass tests cover directional/point-light uniforms, batching, wall receivers, shader clipping and resource retirement. Existing coordinate, sprite-foot contact, visibility, GPU lighting and frame pacing checks remain in place. Full suite: 121/122 initially passed; the exploration rendering harness needed the new frame hooks, then passed on rerun. Internal-browser WebGL compilation was clean; noon used six shadow batches and midnight three local-light batches in a four-unit grassy scene. GPU counters expose shadowBatches and shadowTriangles.

Production Fireball Previewer also completed without runtime errors. While its moving light was active, the shared pass increased from two to three batches (1152 to 1344 shadow triangles) in the six-unit night arena. Fog geometry revisions invalidate the receiver mask.

Midday corrections: shadow materials are double-sided in one pass, because projection and mirrored sprite facings can reverse triangle winding. Local shadow opacity now reflects the source contribution relative to authored ambient and daylight; weak lantern/torch shadows are suppressed in bright outdoor noon, while dark rooms/night retain them and powerful transient spell lights may remain visible. Solar selection is independent of local lamps.

Midday browser verification: at 12:00 solar the four-unit grass scene submits only three sun batches (768 triangles), with no normal lantern shadow batch and no shader/runtime errors. Double-sided silhouettes preserve both mirrored facings.

### Point-light silhouette correction

Carried lights now retain owner IDs; a unit is excluded from its own lantern or attached spell-light shadow. Flat unit sprites use one affine projection per light/caster instead of per-vertex point rays that could fold above a low lamp. The live source position still controls direction/length. Arrow geometry retains physical endpoint projection.

Ground shadow strength samples source falloff at the receiver pixel and normalizes the blocked source against ambient, sunlight and other local lights. The receiver mask stores authored ambient. A single reusable bounded GPU render target unions all caster masks for each source with MAX blending; the source is composited only once, avoiding repeated darkening of overlapping silhouettes. This is a contribution-weighted presentation model, not an alteration of gameplay lighting rules.

Validation after these corrections: 122/122 test files passed. Internal browser at midnight submitted 576 shadow triangles for the three orcs, excluding Carl from his own lantern; no shader/runtime errors. Receiver falloff and per-source union blending are covered by regression checks.

Attack-pose follow-up: level-foot sprites can become edge-on to a lateral light, collapsing their flat projected silhouette. GPU unit proxies now add a small (at most 30% width) ground depth only when that degeneracy is approached, tapering it to zero at the feet. The current attack artwork is retained and foot anchors do not move. Regression reproduces the flat-proxy collapse for both sprite facings.

### Invisible humanoid body proxy test

Combat humanoids now use cached low-poly head/torso/hips/limb volumes with shield and weapon shapes in combat-unit-shadow-proxy.mjs. Standing, attack, windup, ranged, casting and prone stances are supported; world facing and Enlarge scale the physical caster. Adult proxies start at 1.8 m, kobolds at 1.1 m. This is a lightweight anatomical approximation, not the original animated character mesh. Visible sprites and gameplay footprints are unchanged. Non-humanoid dragons retain the existing silhouette fallback pending a species-specific proxy.

The new casters use the physical GPU projection route with no flat silhouette thickness workaround. Humanoids skip sprite alpha/foot-line readback entirely. Existing per-source mask union, carried-light owner exclusion and receiver light falloff remain. A small filter softens the union mask during its existing composite draw. Tests exercise cached geometry, equipment, poses, scale/facing, and nonzero projected area through the solar cycle and all lateral light directions.

Close-range projection correction: the six-height safety cap now applies only to directional sun rays. Applying it per vertex to local point-light rays had pulled physically out-of-range upper-body/shield projections back into the lantern field, creating deformed large patches. Local rays now keep exact point-to-plane geometry; the existing receiver-distance light falloff removes projections beyond the source range. A regression reproduces the 1.9 m lamp / 1.79 m head / 2 m separation case and checks ordinary shield magnification. The canonical adult proxy (1.8 m) and lantern (1.9 m) share scene metres; neither is resized for this fix.

Triangles crossing a local emitter’s height are now clipped just below that plane before GPU projection; geometry entirely above the emitter casts no ground shadow. Most triangles take the unchanged fast path. This prevents weapon/head faces straddling the lamp height from folding backward into close-range wedges. UVs are interpolated at new cut vertices; the actual point-light projection and receiver falloff remain on the GPU.

Local-light penumbra test: non-sun shadows now carry caster-to-receiver separation into the GPU mask. A finite-emitter approximation grows edge softness with that separation (bounded to 0.6 scene metres / 24 mask pixels), while foot-contact regions remain sharp. The existing per-source mask composite samples this radius field and diffuses the far shadow edge in the same draw; no extra render target/pass or CPU pixel processing. The sun takes the unchanged five-tap composite branch. Regression checks assert source-kind selection and increasing/bounded softness.

Local-penumbra validation: projected-shadow, 3D proxy, unit-shadow and WebGL regressions pass. Internal browser compiled both sun and night/local-source branches without runtime errors. Visual softness remains a tunable first pass.

Boot-anchor correction: humanoid roots previously used the tactical hex centre, ignoring sprite-frame anchors, Orc draw offsets and stance-specific foot positions. GPU body proxies now reuse the cached alpha foot-contact detector and fit their root and lower-leg/boot stance to the current frame’s actual contacts after mirroring, camera conversion and Enlarge. Upper-body volume and world facing remain anatomical. Stance cache is bounded to 128 entries. Tests verify placed proxy sole centres against rendered contacts across six camera rotations, both mirror directions and normal/enlarged scale.

Boot-selection follow-up: disconnected shield bottoms could outrank boots by pixel area, shifting and widening the entire fitted proxy. Contact selection now prefers the lowest substantial components and excludes contacts more than 24% of the visible body height above the lowest pixel. A shield-versus-boots regression reproduces the incorrect old fit; the existing actual Orc and wide-stance regressions remain. This addresses a demonstrated fitting defect, not a claim that the anatomical approximation exactly matches every rendered pose or equipment silhouette.
