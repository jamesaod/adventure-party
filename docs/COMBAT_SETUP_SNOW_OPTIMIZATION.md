# R238C432 combat setup and snow scrolling optimization

Local implementation, 2026-11-14. No publishing.

Workshop runtime APIs reuse a private validated, deeply frozen template by source record identity. Unit stats and equipment remain independent. Appearance recipes retain that immutable template instead of cloning animation data; appearance hashing caches the template content digest. Direct MOB lookup no longer builds and validates the entire catalog. Creature instantiation omits animation clips from its gameplay-only clone. Replaced source records generate fresh runtime entries.

Snow floor buffers use indexed barycentric vertices: subdivision 8 uses 45 unique vertices instead of 192 repeated vertices per source triangle. The triangle order, UVs, lighting attributes, snow subdivision and physical surface are preserved. Index data is retained until topology changes. Camera movement still updates visible terrain buffers; this pass reduces that work rather than eliminating it.

Instrumented headless Chrome measurements (same local scenario, not a guarantee of display FPS):
- 25 matching orc enemies plus one matching controlled unit: warm setup approximately 19.6 seconds before, 0.58 seconds after. Repeated validation and large appearance cloning/hashing were the dominant avoidable work.
- Snow-covered camera pan: CPU frame submission approximately 74.2 ms before, 30.7 ms after; surface buffer preparation 36.6 ms before, 10.6 ms after. CPU categories are nested and must not be added together.
- Corrected profiling retained subdivision for all snow coverage. An experimental coverage shortcut was discarded because early coats also affect physical snow height. Do not reinstate it based on the hasDepth flag.

Validation: 127/127 combat regressions passed. Added exact expanded indexed/nonindexed attribute comparisons, topology/index reuse checks, immutable-template isolation and appearance-key invalidation tests. Browser startup profile reported no page errors. Visual QA remains with the user.
