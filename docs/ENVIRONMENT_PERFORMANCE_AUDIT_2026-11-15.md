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
