# Combat camera scrolling investigation — 2026-11-14

The initial investigation below preceded the local R238C419 shadow receiver optimization; measured follow-up results appear at the end. The 12-inch snow cap is a separate local change (R238C418).

## Controlled local measurement

The existing combat scene ran in headless Chrome at 1600×1000. After ten warmup frames, 35 samples compared a fixed camera, a smoothly panning camera, and the same panning with ground cover disabled. The actor simulation was not used to change these scenes: this isolates camera translation. These CPU submission timings are not hardware FPS or a GPU benchmark, and each condition ran once.

| CPU milliseconds | Fixed camera | Panning | Panning, cover disabled |
|---|---:|---:|---:|
| Whole frame submission | 18.21 | 26.59 | 23.75 |
| Terrain (nested cost) | 2.59 | 6.74 | 6.87 |
| Ground cover | 2.79 | 4.99 | 0.06 |
| Shadow setup | 0.03 | 1.59 | 1.63 |
| Unit submission | 2.29 | 2.25 | 2.22 |

Ground-cover layout reuse: 35/35 fixed-camera frames, 0/35 panning frames. Nested timers must not be added together. Differences between separate conditions are directional evidence, not isolated causal totals.

## Concrete findings and implementation order

1. `combat-ground-cover.mjs` includes every component of the view matrix (including translation), viewport and camera anchor in its layout snapshot. Any pan reruns filtering, ordering and instance-record comparison. Keep placements and GPU instance records in world space; use a padded visible region and rebuild only when its boundary is crossed, geometry/visibility changes, or view rotation changes. Preserve corpse-aware draw ordering and visibility, so this is not safely solved by simply deleting camera values from the cache key.
2. `combat-lighting-services.js:prepareCombatProjectedShadows` puts viewport bounds rounded to 0.1 units into its signature. During a pan it creates a new 512×512 canvas and redraws visibility/floor fragments. Use stable world-space chunks or a padded, quantized receiver region. New observer positions, doors, light/ambient state and scene edits must still invalidate it. Do not freeze gameplay LOS.
3. Terrain and surface-buffer costs also rise during the same test. Capture a CPU flame profile and GPU pass timing around actual moving units next, then retain static terrain buffers and update only camera uniforms where possible. Avoid rebuilding unaffected lighting/material buffers.
4. Re-run the same fixed-camera/pan comparison, then test unit movement with snow, corpses, trees, doors, multiple lights and camera rotation. Track median/p95 CPU and GPU costs and visible popping, not only average FPS.

## Primary guidance

- MDN WebGL best practices: batch draws, avoid synchronous GPU readbacks in normal rendering, manage texture uploads and allocations: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
- Three.js: merge/batch static objects to reduce per-object overhead: https://threejs.org/manual/pages/optimize-lots-of-objects.html
- Three.js on-demand rendering: useful when idle, but does not eliminate necessary frames during movement: https://threejs.org/manual/pages/rendering-on-demand.html
- web.dev rendering performance: measure frame work and avoid unnecessary layout/paint: https://web.dev/articles/rendering-performance/

CSS compositor scrolling advice is not a direct replacement for this game's WebGL world-camera transform. Do not add another animation loop or reduce fidelity before measuring the cache fixes.

## Applied optimization — local R238C419

The shadow receiver now covers a padded world-space region and is reused while the camera viewport remains inside it. Rebuilds retain existing scene, terrain, wall, fog and observer-position invalidation. Receiver raster density is preserved by sizing the padded mask accordingly. Lighting sources continue updating normally. This increases mask size modestly in exchange for fewer canvas allocations and visibility/floor rasterizations during camera translation.

A fixed-seed follow-up compared the original code with this change in the same headless Chrome setup (10 warmup frames, 35 samples per condition, one run per version):

| CPU milliseconds | Original | Shadow cache |
|---|---:|---:|
| Panning shadow setup | 1.594 | 0.294 |
| Panning whole frame submission | 25.266 | 24.969 |
| Fixed-camera whole frame submission | 13.729 | 14.897 |
| Panning without grass, whole frame | 22.274 | 21.066 |

Shadow setup fell about 82%. Overall panning submission improved only about 1%, which is too small to claim a meaningful FPS gain from these single-run timings. Fixed-camera timing varied upward, so these results are not evidence of a general frame-rate improvement. Actual moving-unit GPU/frame-time profiling remains necessary; observer movement can invalidate this cache, so the benefit is specifically reduced camera-only rebuilding.

A grass-layout cache experiment was discarded: its extra offscreen geometry increased draw work and did not produce a convincing whole-frame benefit. The original grass renderer is restored, with unchanged sampled panning geometry (3,272 instances, 96 draws, 1,256,120 triangles). No grass, shadows or other visual effects were disabled in the retained change.

Validation: 120/120 combat regressions passed, including a new receiver-cache test covering viewport containment, cache-boundary crossing, observer movement and wall replacement. Terrain and ground-cover submission remain the larger targets for a subsequent measured pass. The 12-inch snow cap remains in place.

