# Snow and terrain GPU pass — 2026-11-15

## Implementation

Refined outdoor floor batches use one indexed barycentric patch instanced per original triangle. A compact Float32 texture holds source positions, UVs, lighting samples and face attributes. The vertex shader interpolates those attributes, then runs the existing snow/footprint and stream/puddle displacement. This replaces CPU expansion and large refined attribute uploads while preserving triangle count, edge subdivision and draw order. No extra terrain pass. Unrefined, indoor/mixed-eligibility, wall, sprite and shadow batches retain the original buffer path. Geometry changes rebuild the small patch; unchanged source records retain the texture. Texture capacity grows by powers of two and is released with its renderer record.

Snow deposits retain their existing GPU accumulation draw and CPU coverage authority. CPU bookkeeping now batches completed texels per brush row, skips saturated texels and performs full coverage recounts with a linear Fenwick-tree build. Manual depth adjustments initialize retained heights in the encoding pass and reuse the inverse blend lookup. Depth-control/feather-melt uploads retain their shader, geometry and texture instead of destroying them after each operation. These changes preserve 100% first-coat and powder gates, 82% total powder opacity, local melt, footprints, indoor exclusion and water masks. No procedural replacement for retained grain deposits and no new scheduler.

## Measurements

Headless Chrome, 1440x1000, same seeded grass scene and camera path, ~109,000 ground-cover instances. Unit assets and initial frames warmed; each scenario gets 20 warm frames and 80 measured frames, discarding the first 10. SnowPan seeds three inches before warmup and then accumulates real snowfall while panning. CPU profiling is enabled in both runs. Values are milliseconds of CPU submission work, not display FPS; nested categories overlap.

| Scenario | Buffer prep | Terrain total | Snow | Frame submission |
|---|---:|---:|---:|---:|
| pan | 4.46 → 1.60 | 8.39 → 4.96 | 0.04 → 0.04 | 28.59 → 25.65 |
| snowPan | 11.20 → 1.49 | 15.94 → 4.89 | 7.33 → 4.49 | 44.88 → 29.51 |

GPU Floor rolling samples were about 0.82 → 0.51 ms by the snowPan endpoint; these asynchronous averages include prior frames/scenarios and are directional evidence only. Snow per-frame work also depends on elapsed time and deposited grain count, so faster frames contribute to its reduction.

Isolated 1024² snow-field comparison, three trials with identical random deposits: median manual depth adjustment 87.1 → 33.9 ms. Median 100,000-grain deposition 36.8 → 32.2 ms; individual trials varied. Encoded RGBA snow fields matched byte-for-byte. This isolates bookkeeping from frame pacing.

## Validation

- test-combat-gpu-surface.mjs: every source attribute matches the former refined expansion, including defaults, 1/4/8 subdivisions, capacity growth/reuse and in-place edits.
- Hidden-browser render comparison: 20 comparisons (10 attribute outputs at 4 and 8 subdivisions), pixel-identical with the CPU path. This verifies interpolation/rasterization; user visual QA of the complete game remains pending.
- Final production benchmark: no page or shader errors.
- Passed snow coats, depth controls, water exclusions, feather melt, deposits, timing, displacement, corpse snow map, footprints, snow surfaces, canopy snow surface, indexed snow, render cache, surface lighting and grass-pan regressions.

Workspace evidence: outputs/white-oak/audit-snow-terrain.cjs; snow-terrain-before.json; snow-terrain-gpu.json; snow-terrain-final.json; compare-snow-cpu.cjs; snow-cpu-comparison.json; check-gpu-surface.cjs; gpu-surface-render-check.json.

## Remaining costs

Grass layout preparation remains a substantial CPU cost during camera movement. Snow still needs CPU texels for exact completion gates, gap filling and gameplay/footprint depth queries. Moving that authority entirely to GPU would need an asynchronous reduction/readback design; this pass avoids synchronous GPU readbacks. Keep the compact source-texture path when extending terrain attributes, and add new fields to its equivalence test.

Local cache version: snow-terrain12. Nothing published.
