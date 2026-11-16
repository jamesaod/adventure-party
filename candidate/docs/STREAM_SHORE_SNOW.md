# Stream shore snow accumulation limit

16 November 2026. Local change; appearance review remains with James.

Permanent stream water receives no ground snow. Across 3 feet (0.9144 m) of adjacent dry bank, a smoothstep accumulation ceiling rises from zero to 18 inches. This caps the retained coat/depth values; it is not a snowfall-rate multiplier or merely a color overlay. Snowfall grain size, emission rate and elapsed timing are unchanged. The previous physical maximum was 12 inches; it is now 18 inches as requested, with existing six-inch layer units.

stream-snow-limit.mjs caches a separable Euclidean distance transform from the stream's permanent-water field, including connected inlets. Distances use metres in both axes despite the anisotropic field and projected ground coordinates. The sampled edge is accurate to the stream-field texel scale. Stream revision changes rebuild it; stable frames and rain level changes do not. Removing the stream restores unrestricted future accumulation without restoring melted snow.

combat-snow-coats.mjs stores per-channel ceilings. Natural deposits, fill and manual adjustments all respect them. Completion indexes use attainable local coat thresholds so the narrow shore band cannot prevent inland powder/depth accumulation. The existing water mask texture now carries RGBA ceilings; a minimum-blend pass enforces identical GPU values after deposit batches when the shore band is active. There is no new per-frame terrain bake, CPU vertex scan or runtime GPU readback. The cap texture uses four bytes per snow texel rather than one. The added GPU pass has not been benchmarked for interactive FPS.

Tests: scripts/test-combat-shore-snow.mjs covers metric width, smooth 0/9/18-inch limits, rotated anisotropic fields, disabled streams, cached updates, fill, manual adjustments, natural snowfall and completion gates. All 160 combat regressions passed. Hidden GPU fixture found zero physical-depth discrepancy across a 512-texel shore transect after full cover; manual changes and natural deposition also matched. Live Grassy Battlefield passed snow-free water, partial shore coverage, 18-inch maximum, startup, seasons and all-six-tree fall/reset checks without runtime errors. Verification readback occurs only in test tooling.

Staging, before-change backups and GPU/live check scripts: workspace work/shore-snow. Module consumers and test fixtures were refreshed consistently to shore-snow1 to avoid stale mixed imports or duplicate state owners.
