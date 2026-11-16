# Finer ground snow trial

Ground deposit brush diameters are halved (5/7 to 2.5/3.5 texels), with four deposits per previous deposit to retain accumulation pace. The accumulation texture stays 1024 square; snowfall intensity, elapsed-time clocks, falling flake count and coat completion gates remain unchanged. Three-pixel point sprites replace seven-pixel sprites. This adds particle bookkeeping/vertices but keeps total brush pixel work comparable, with no additional render pass.

The seeded 128-square timing regression compares the original first/powder completion times of 46.43/93.79 snowfall seconds, allowing 5% variation for rasterization and stochastic coverage. This is visual granularity, not higher terrain-mask resolution. Actual frame cost still depends on the scene and device; no FPS equivalence is assumed.

Run `node scripts/test-combat-snow-granularity.mjs` and the full combat regression runner. Water-edge fixtures check the adjacent dry texel within the smaller brush, and feather-reference module loading includes the shared brush helper.

The retained batch capacity scales from 32,768 to 131,072 grains, preserving the previous amount of snow processed per update. This adds about 1.9 MiB to the CPU batch arrays, plus corresponding GPU attribute storage. Production Chrome smoke checks on a 14.2-million-eligible-texel field showed progressing coverage, zero sampled backlog, and no shader/runtime errors. CPU-only seeded deposit comparison took approximately 18 ms versus 14 ms for two full coats on a 128-square field; this is not an FPS benchmark.
