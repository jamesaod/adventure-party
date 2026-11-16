# Tree shelter and ground snow deposits

16 November 2026. Local fix; appearance review remains with James.

Canopy shelter now intercepts incoming snow grains instead of multiplying the opacity and height of retained snow. The old 120-second shelter-mask fade has been removed. Losing foliage admits future deposits immediately without filling the sheltered area instantly; restoring foliage preserves snow already deposited.

The +3/-3-inch and full-cover controls edit stored snow directly, including beneath trees. Water exclusion and the three-foot shore accumulation ceiling still apply. Ground color, height, burial, footprints and leaf landing read the retained coats without applying canopy exposure again. Snow grain size and snowfall timing constants are unchanged.

Exposure is cached at snow texel centers when the shelter revision changes. Rejected grains consume their normal deposition budget, and protected cores are excluded from global coat-completion gates. GPU deposits reject the same protected cores as the CPU brush. The cache adds one Float32 value per snow texel; interactive FPS has not been benchmarked.

Validation: all 160 combat regressions pass. The shelter history test now checks real deposits, manual adjustments, canopy removal/restoration and water corpse behavior. A hidden browser GPU fixture checks protected ground, +/-3-inch changes, unchanged stored snow on canopy removal and subsequent granular deposits; maximum sampled CPU/GPU channel error was zero.

Staging, before-change backups and verification scripts are in workspace work/tree-snow-deposits. Updated module consumers use tree-snow-grains1 to avoid stale imports and duplicate module state.
