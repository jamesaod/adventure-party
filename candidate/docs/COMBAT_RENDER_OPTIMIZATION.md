# Combat rendering optimization pass

Implemented locally, November 7, 2026. No deployment performed by this pass.

## Changes

1. Tree targets use projected model bounds, with extra space for flames, rather than the entire battlefield viewport.
2. Ordinary source-over Canvas overlays no longer require a preceding GPU-to-Canvas copy. Destination-dependent blending retains the backdrop path.
3. Consecutive non-overlapping direct units share a target/composite pass. Overlapping bounds retain separate composites to preserve ordering. Each shared rig is posed immediately before its own draw.
4. Terrain attributes retain their buffers and uploads when source values are unchanged. Changed values are detected even when callers mutate existing face objects.
5. Projected shadows share immutable bone palettes across lights and submit caster scenes once per light group. Meshes sharing a skeleton also share a snapshot within one capture. Light-fill arrays are packed once per flush.
6. Outline occluders are spatially indexed, projected wall polygons reused within a frame, and per-unit mask canvases retained. Wall/entity ordering uses spatial candidate filtering and a stable priority queue.
7. Bounded render targets use 32-pixel size buckets and LRU eviction: 16 entries and an estimated 64 MiB budget. A single larger target is allowed when needed. Disposal releases pooled targets.

## Validation

Focused renderer, direct-unit, tree-bounds, cache/order, surface-lighting, projected-shadow, model-shadow, outline and repository validation checks passed.

The full test run recorded 138 passes out of 153 in `work/render-optimization-test-results.json`. The remaining failures concern outdated model catalog lists (blue orc), literal version/source hashes, movement test mocks, exploration test constants, a studio source assertion, and Windows symlink permission. This pass does not claim the full suite is green.

Internal-browser checks covered a live grassy battle, night wall rendering and rotation, and five growing/shrinking outline masks. No WebGL errors were reported.

A controlled before/after fixture at `work/render-performance-test.html?combatProfile=1` measured:

| Counter | Before | After |
| --- | ---: | ---: |
| GPU-to-Canvas copies | 2 | 1 |
| Compatible unit composite passes | 3 | 1 |
| Draw calls | 9 | 7 |
| Canvas uploads | 2 | 2 |

The optimized fixture reused 12 surface attributes. Its rounded target used slightly more pixels (18,576 versus 17,028), illustrating the allocation-versus-fill tradeoff. The pixel comparison was not bit-identical: 1,240 of 576,000 channels differed by more than three, with maximum difference 22. Both renderers reported zero GL errors. No production FPS improvement is asserted from these counters.

## Remaining limits

Canvas overlays still exist. Unit meshes still require individual draws; composite batching is not instancing. Surface change detection still scans source values. Shadow masks still render per light. These changes reduce repeated work without changing gameplay LOS, targeting or combat rules.
