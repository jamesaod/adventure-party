# Sun shadow mask reuse — 16 November 2026

Unchanged sun-only GPU model shadows now retain the existing shadow mask. Exact capture/part identities, placement transforms, view, receiver texture version/bounds, light vectors/strength and solar lighting form the reuse key. Any change redraws the mask. Canvas casters and scenes with local lights bypass reuse. Context restoration explicitly invalidates it. The retained mask is composited normally each frame, including current snow. No additional render target is allocated.

The early projected-shadow flush now appears in both CPU Shadows draw and GPU Shadows timings. Previous charts omitted that work; do not interpret its newly visible GPU value as a regression.

Warmed 1600x1000 local headless Chrome comparison (120 measured frames): projected-shadow exclusive CPU 2.10 -> 0.24 ms; total CPU frame submission 12.73 -> 10.53 ms (~17%). The held test scene avoided 366 model-shadow part submissions per reused frame. These numbers are scene/device-specific, not a promised FPS increase. Ground cover remained the largest sampled GPU category (~2.2–2.5 ms); floor including current water was ~0.29–0.31 ms. Nighttime fire/local-light shadow rendering remains live.

Validation: all 160 combat regressions pass. Browser checks cover held-scene reuse, camera rotation, unit movement, explicit invalidation and bypass with local lights. Asynchronous asset/pose warm-up must finish before asserting reuse. User retains visual QA.

Workspace work/performance-shadow-cache contains backups, before/after reports and the browser validation script. work/performance-attribution/warm.cjs captures warmed CPU/GPU reports and a Chrome CPU profile.
