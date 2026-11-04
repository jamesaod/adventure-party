# Combat rendering — Candidate Rev 247

Rev 250 adds shader point lighting for exploration encounters; see
[COMBAT_GPU_LIGHTING.md](COMBAT_GPU_LIGHTING.md) for the current boundary.
The original baseline below describes the initial hybrid renderer.

Combat requires WebGL 2 and presents through the repository's existing Three.js
distribution. The battlefield DOM canvas belongs exclusively to WebGLRenderer;
it never acquires a Canvas 2D context. Initialization finishes before combat is
created/revealed. Missing WebGL 2 produces a retryable startup error.

## Rendering boundary

`js/combat-webgl.mjs` owns GPU resources, orthographic projection, texture
sampling, surface shaders and compositing. The simulation retains hexes,
movement, attacks, spells, initiative, collision, LOS and saved encounter data.
There is no map or save-format migration.

Exploration encounter floors use architectural/hex intersection meshes. Walls,
window apertures, lintels and open/closed door leaves use the existing solid
prisms, including wall thickness and half-thickness doors. These are textured
GPU triangles, not wall snapshots. The vertex shader applies the ground-plane
azimuth and zoom used by tactical input; elevation stays vertical. All six
rotations preserve picking, wall height and the existing 1:2 map conversion.

Floor shaders sample bounded, world-anchored exposure maps. Wall faces retain
per-hex physical exposure, distance fading, torch flicker and spell radiance.
Multiply, over-ambient exposure and additive radiance compose in the shader.
Repeating artwork uses mipmaps, linear filtering and anisotropy capped at four
where supported. Display-RGB arithmetic deliberately matches the established
lighting; a second sRGB conversion would alter the artwork.

This is a hybrid renderer. Pre-rendered sprites, tactical overlays, LOS masks,
spell VFX, weather, text, and legacy standalone test-terrain drawing retain their
Canvas 2D code on a detached staging canvas. Dirty overlay batches upload and
composite between mesh batches in the established painter order. This is not a
single final-frame screenshot wrapped in WebGL. The tested actor ordering stays;
depth testing is deliberately disabled during this compatibility pass.

At GPU-to-Canvas boundaries the staging batch is seeded with the current scene.
This preserves destination-dependent spell/LOS operations such as additive
light and multiply. Prepare that backdrop before installing local clips.
These copies are a compatibility cost to profile and reduce during later VFX
migration; WebGL alone does not eliminate the Canvas workload.

Physical illumination/occlusion queries and exposure-map generation still run
in JavaScript. This change does not claim GPU ray tracing, GPU light transport,
GPU shadow maps, a complete legacy-terrain mesh conversion, or a measured speed
improvement. Future optimizations belong behind this renderer boundary.

## Compatibility and lifecycle

WebGL 2 is required; optional compressed textures, floating-point render targets,
compute shaders, Vulkan and a particular GPU vendor are not. The browser selects
its native backend. Render density remains capped at two. Existing combat
invalidation/animation drives frames; there is no additional animation loop.

Geometry slots are reused and surplus buffers disposed after a smaller scene.
Replaced exposure textures are released; static artwork is reused. Context loss
shows a recovery message. Three.js restores resources, textures are marked for
reupload, and combat redraws from current simulation state without resetting
units or the map.

Developer diagnostics are the battlefield canvas's `data-combat-renderer` and
`data-gpu-stats` DOM attributes.

## Validation

- `node scripts/test-combat-webgl.mjs`: GPU/tactical coordinate agreement at six
  azimuths and three zooms, prism height/thickness, light attributes and explicit
  unavailable-WebGL-2 failure.
- `scripts/fixtures/combat-webgl.html`: browser GPU readback for exposure, alpha
  compositing, overlay/mesh ordering, bounded resources and context recovery.
  Serve the repository over HTTP and use the fixture's recovery button. It calls
  the production renderer.
- Existing combat, exploration, doors, LOS, lighting, sprite and startup suites
  remain mandatory. Browser QA covers legacy standalone combat, exploration
  encounters, rotation, zoom, movement, spells and door/daylight transitions.

Chromium browser QA is available in the development environment. Firefox, Linux,
other drivers and integrated GPUs still need hardware/browser QA; selecting an
API baseline cannot certify every device.

## Candidate Rev 248 - standalone material origin

The standalone Wall Test previously fetched PamNawi stone from OpenGameArt without CORS. Drawing it tainted the shared Canvas staging layer, which WebGL refuses to upload. A Wall Test failure could then affect Grassy Battlefield in the same session. The exact original PNG is now vendored with attribution and loaded same-origin with anonymous CORS. Both entry points still use the same combat rules and renderer; only their map providers differ. The browser fixture exercises the actual floor asset and raster-only -> mesh -> raster-only transitions.

## Candidate Rev 249 - shared presentation cadence

Combat and the Previewer now coalesce invalidations through one 30 FPS scheduler. Finite missile/magic visuals run at half speed with continuous geometry sampling. Lighting and shadow transport remain unchanged. See [Combat frame pacing](COMBAT_FRAME_PACING.md) for lifecycle, profiling and verification.

## Direct fir rendering experiment

The grassy Combat Test defaults to direct tree meshes in the main WebGL context. treeScene flushes pending raster overlays, scopes ACES lighting/shadow renderer settings, clears only depth for each tree actor, and restores renderer state afterward. The context now has depth storage for internal tree self-occlusion; ordinary surface materials still use painter ordering. Ground silhouettes and softening remain GPU render targets; surfaces consume those textures directly and clip them to floor fragments. No per-tree color/shadow canvas capture is required on this path. Trees use the existing actor queue and scheduler. Self-shadow and ground-shadow targets cache by sun/view, variant/rotation and burnt state, and dispose on invalidation/context recovery. Small hidden-outline silhouettes use the existing atlas or a one-time bare-tree capture.

Append ?treeRenderer=images to select the previous reference path. Existing Canvas unit/effect composition and its framebuffer snapshots remain; this is not a complete removal of all CPU/GPU transfers. Local six-sun-update frame samples measured 36-46ms direct versus 124-146ms reference, with zero direct-path tree image capture calls. This small local test is not a cross-device FPS guarantee. Rotation, ignition/burn expiry, bare shadows, hidden-enemy outline protection and existing renderer/runtime checks pass.
