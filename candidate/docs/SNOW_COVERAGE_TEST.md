# Particle snow experiment

Combat sidebar: Snowfall intensity (0–100%), Pause/Resume, Clear Snow. Default zero.

CPU tracks bounded analytic trajectories (4096 particles maximum); GPU renders flakes and batches each landing as a soft additive mark into a persistent 1024-square render target. Outdoor ground samples this world-space mask before lighting. No GPU readback. Frame scheduling uses the existing combat scheduler; idle snowfall stops requesting ticks. Pause freezes flakes and preserves deposits; clear removes flakes and deposits. New map identity resets the mask.

Prototype limits: snowfall samples rendered outdoor floor fragments; canopy interception, tree accumulation, wind collision, drifts and melting are not implemented. Flakes currently render as a foreground particle pass. Snow changes appearance only, not combat rules. Map mask resolution is bounded, so deposit size scales with map size.

## Per-hex random accumulation
Each exposed fragment carries its tactical hex key. Spawn locations are sampled by polygon/triangle area. A landing increments its owning hex snow amount and deposits four smaller GPU stamps at independently area-weighted random positions across that hex’s exposed fragments. The CPU hex ledger persists through redraws and clears with the mask. Fire/spell melting is not wired yet. Targeted sampling tests: scripts/test-combat-snow.mjs.

Full-map update: exposed floor fragments are prepared once per combat terrain over complete map bounds, independent of zoom/camera. Fireball/scorch events, Burning Hands and reflected Lightning Bolt remove snow in their effect cells. Burning firs melt their hex and adjacent hexes over time. GPU polygon erasure updates the same mask alongside the CPU hex ledger. Clear rebuilds full-map sampling immediately.

## Independent rate accumulation (supersedes particle landing deposits)
Every exposed hex gains intensity/60 coverage per second: full coverage in 60 seconds at 100%. Falling flakes are cosmetic and can be hidden using FALLING FLAKES without changing accumulation. World-space procedural patch masks rebuild at 4 Hz from the hex amounts; unchanged geometry buffers are reused. Melting changes those same amounts; snowfall can refill melted hexes. No collision/deposit work is done when a flake reaches ground. Performance improvement is not yet benchmarked.

### Additional fire spells
Flaming Sphere continuously melts its live footprint at rate 1.5/second (exponential, matching burning-tree heat); moving or expiring changes/removes that source. Flame Arrow and Melf's Minute Meteors clear snow only in the impact hex after flight, including near misses that visually land in that hex. Shared production flight paths cover player and AI volleys. Stored meteors and acid arrows do not melt snow. Wind interactions remain deferred.

### Branch-ridge experiment retained (2026-11-06)
User rejected current appearance for leafy firs, but explicitly wants this technique remembered for denuded trees. Preserve js/combat-fir-snow.mjs branch-component welding, axis extraction and tapered instanced ridges before replacing canopy snow. Potential reuse: bare/denuded branches, subject to visual testing (not validated there yet). Current failure: snow follows wood hidden inside foliage rather than the broad foliage-supported shelves; disconnected lobes remain visible. Future fir work should model connected canopy-supported snow surfaces with sky exposure and preserved tier gaps. Research only at this checkpoint; no new rendering change.

### Connected foliage-shelf prototype
Current fir snow samples alpha-tested foliage at multiple heights on a 36x36 grid, connects nearby supported samples within a height tolerance, and adds tapered boundary skirts. Sampling/mesh preparation happens once per tree variant. Coverage reveals patches and raises their geometry; blue directional shading operates after tone mapping. No extra shadow pass. Large height gaps remain disconnected. Branch-ridge implementation preserved in js/combat-fir-snow-branches.mjs for potential denuded-tree reuse. Geometry preparation timings and triangle counts are available in snow mesh userData.snowPreparation. Pure surface connectivity tests pass; browser appearance and startup cost still require measurement. This is an approximation, not a physical snow stability simulation.
