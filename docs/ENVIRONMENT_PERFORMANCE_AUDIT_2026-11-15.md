# CPU/GPU environment audit — 2026-11-15

Implemented locally: exact stable radix-assisted depth sorting for ground cover, with reusable typed scratch buffers and full-precision tie resolution. Small batches retain native sorting. Camera-relative painter order, corpse/crown ordering and ground-litter handoff remain unchanged.

GPU: index identical complete vertex records at geometry creation. Canopy tufts now use 44 unique vertices rather than 60, retaining 20 triangles, every normal/UV seam, all blades and current appearance. Triangle diagnostics account for indices. Wind, snow deformation and fallen-wood depression remain on the GPU; no new render pass or frame loop.

## Measurements

Headless Chrome, local grass scene, seeded random generator, 1440x1000 viewport, about 109,000 cover instances / 434,000 canopy blades. Wait for unit assets and 30 warm frames; 45 frames per scenario, last 30 CPU snapshots averaged. CDP sampling profiler enabled in both runs. Milliseconds below are CPU submission costs, not total displayed frame time; categories overlap.

| Scenario | Cover before | Cover after | Submission before | Submission after |
|---|---:|---:|---:|---:|
| pan | 15.58 | 10.29 | 36.23 | 31.07 |
| rotate | 46.53 | 25.74 | 72.68 | 51.74 |
| snowPan | 14.83 | 10.27 | 54.85 | 51.41 |
| fall | 1.71 | 1.56 | 26.19 | 22.87 |

GPU cover rolling samples fell from roughly 4.3–4.4 ms to 2.9–3.2 ms. These asynchronous samples include preceding scenarios; they are directional evidence, not isolated per-scenario timings or a guaranteed FPS increase. The deterministic structural reduction is 60 to 44 unique canopy vertices (26.7%). Ground-cover instance and triangle totals matched for pan, rotation and snowPan. The fall scenario has slightly different time-driven deposit counts.

Caveats: idle baseline still included a shader compilation spike and is excluded from comparisons. SnowPan forces a depth adjustment and active snow, so its cost includes synthetic accumulation work. Fall holds the tree near impact at 3.2 seconds without invalidating the cached leaf source. Timings vary with scheduling, JIT and GPU load. User visual QA remains pending.

## Remaining priorities

The largest remaining CPU costs are ground-cover layout preparation, terrain attribute validation/uploads, and snow coat depth/recount work. GPU grass still shades a large population; avoid reducing density/LOD without an appearance decision. Any future GPU snow-state migration must preserve persistent deposits, local melt, water exclusion, footprints and CPU gameplay queries. Moving painter sorting wholesale to the GPU would require redesigning actor compositing, beyond this bounded pass.

## Validation

Passed test-cover-optimization.mjs (stable exact ordering, signed zero, close depths, buffer reuse/growth, identical indexed triangles and UV seams), test-combat-grass-pan.mjs, test-combat-ground-cover.mjs, test-debris-grass-pressure.mjs. Final hidden-browser audit covered idle/pan/rotation/snow/falling tree with no page errors. No publication.

Reproduction script and raw captures: workspace outputs/white-oak/audit-cpu-gpu.cjs, audit-warm-before.json, audit-warm-after.json (sort only), audit-final.json.

## Tree landing hitch — 16 November 2026

A warmed local grass-scene CPU profile showed synchronous shader program checks during tree falls, alongside the impact-triggered debris grass mask bake. First landing meshes/mask variants previously compiled only when visible. The direct tree pass now starts compileAsync for hidden landing meshes and wood masks during the fall, once per renderer/seasonal variant/break type; context loss clears that preparation cache. Material/shadow overrides restore synchronously. No new render pass, particle reduction or resolution change. Drivers without parallel shader compilation may still block during preparation.

The 256-square grass mask now rasterizes only each hull's feathered bounds, skips already-solid texels, precomputes edge lengths and uses squared edge distances. One/two/three-tree fixture outputs matched every byte of the previous implementation. Cold benchmark before/after: 29.8/20.7 ms, 42.3/20.3 ms, 64.8/28.5 ms. These are isolated CPU timings, not total frame-rate gains. Existing combat regressions: 166/166 passed; additional hidden-mesh preparation regression added. Hidden Chrome fall profiling completed after the change with reduced sampled blocking program-query time; no claim of eliminating every hitch until user visual/performance QA. Profiler: .local/profile-tree-impact.cjs.

## Remaining landing freeze: snow exposure — 16 November 2026

The earlier shader/grass-mask optimizations did not address the dominant near-second stall. Tree impact removes its canopy from firLitter, increments shelter revision, and previously caused setExposureField to sample the entire coat grid and recount all three layers, even with grassy terrain and no visible snow.

finalizeSnowShelter now compares the finalized (including trunk feathering) 1024-square field with its previous snapshot, records separate changed 32-square tile runs and a one-texel bilinear halo, and publishes the prior/current revision. Coat updates sample only those regions and incrementally adjust coverage/Fenwick indices/progress when zero interception changes. Existing snow pixels are retained. Initial state, changed bounds or skipped revisions use the full rebuild. Multiple distant trees retain separate regions rather than one map-sized bounding box.

Deterministic regression compared retained snow, coverage, progress and subsequent deposits with the full-rebuild reference. One removed tree sampled 1,120/65,536 texels; three removed trees sampled 3,280/65,536. Unchanged fields sample none; skipped revisions fall back correctly.

Headless Chrome production comparison, seeded same grass map and three trees dropped together: old full-map path worst CPU submission in the measured impact window 937.3 ms (snow 795.1 ms), next 717.0 ms (snow 630.8 ms). Local path worst 88.3 ms (snow 2.5 ms), next 73.2 ms (snow 4.8 ms). All three falls completed, no browser errors. Smaller grass/rendering spikes remain; this is CPU submission evidence, not a universal no-hitch guarantee. Reproduce with .local/compare-tree-impact.cjs; baseline mode intercepts only the test browser's snow module to disable local updates without modifying game files. Combined regressions 169/169 passed.

Cache follow-up: the new snowShelterChange export exposed a cached-module mismatch in an already-used browser. Active tree/snow module URLs and their test imports now share tree-landing2, with the classic entry scripts refreshed together. Do not update a stateful shelter module URL in isolation: all consumers must share one instance. Production startup verified exactly one shelter URL, six trees, no page errors, and the expected export. Reload the page to leave the old in-memory module graph; Retry alone cannot replace an already-loaded module.
