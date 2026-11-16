# Camera terrain preparation

Local implementation, 2026-11-16. Static world-space floor descriptions and ground-cover placements can be prepared beyond the visible viewport; rendered images are not cached for future views.

- Retain up to 4,096 floor-fragment descriptions across camera changes. Terrain/map/material/lighting changes invalidate them using the existing floor content key. Visibility remains live.
- Prepare a circular envelope around the viewport, with 25% extra radius plus two hex widths. This covers rotation and modest zoom-out; movement biases the center two hexes forward. Camera positions are quantized to two-hex buckets.
- Run inside the existing frame loop after visible work. Stop at 16 candidates or a 0.75 ms target, and skip when elapsed CPU submission time is already 12 ms. One atomic fragment/placement operation can exceed that soft deadline. Hidden pages skip preparation.
- Retain at most 256 speculative ground-cover faces / 32,768 placements, within the existing placement cache. Visible use promotes these entries. Full capacity pauses preparation. Stream/layout/scene invalidation restarts it.
- Enumerate only shell perimeters, yielding even for empty/out-of-bounds cells so sparse maps cannot scan the whole envelope in one frame.
- The CPU chart now exposes Terrain ahead separately. Diagnostics expose preparedFaces, preparedInstances and per-frame preparedHits.

No new rendering passes, GPU targets or timers. Camera-dependent grass ordering, shadows and unit outlines still run as required. Large zoom changes can reveal more terrain than the prepared envelope covers; on-demand generation remains the fallback.

Validation: 162/162 combat regressions passed. Focused coverage checks busy-frame and hidden-page skips, queue continuation, capacity stops, camera/zoom changes, terrain revision invalidation and empty-cell budgeting. Browser floor parity passed for pan, rotation, zoom, live visibility, terrain replacement, night lighting, snow and stream-width changes.

The initial deterministic 1600x1000 camera stress profile did not demonstrate an overall speedup: follow median 24.8 -> 27.4 ms, zoom 53.9 -> 56.9 ms, rotation 98.2 -> 103.0 ms in separate runs. These are sequential zoom/rotation stress scenarios with substantial dynamic grass and outline work, not isolated preparation timings. Do not describe this change as a measured FPS improvement. During these overloaded transitions preparation itself averaged under 0.01 ms because it yielded; its useful work happens during spare-time frames beforehand.

Workspace records: work/camera-preparation contains pre-change source backups, before/after profiles, browser verification and installation/refinement scripts. Do not rerun installation scripts: they are one-time source transformations. Visual QA remains with the user.

Final browser verification consumed 50 prepared patches while following, 100 during zoom-out and 95 during rotation. Median submission times in that run were 23.1 / 47.7 / 87.3 ms respectively. This confirms real reuse; the spread between runs means an overall FPS gain is not established by these samples.
