# Unit water effects

Wading reuses CombatPuddleEffects and the production floor ripple shader and droplet batch. A tracked animation rig no longer suppresses the water stride fallback unless a water impact actually occurred recently. Rig/fallback impacts share a 250ms deduplication window. Dry-ground footstep ownership remains unchanged.

Stationary living visible units in water emit a soft expanding ring after 1.8–3.6 seconds, then every 2.2–4.2 seconds. Idle rings have no droplets. Movement restarts the idle delay. Water contacts sustain the shared combat frame scheduler between rings; dry/hidden units stop after existing effects expire. Snow suppression, scene resets, fixed 96-ring/128-droplet budgets and water-surface elevations remain shared. No extra timer or render target.

Validation: test-combat-wading-effects.mjs covers tracked-rig fallback, deduplication, water height, idle timing, dry/hidden suppression and scene reset. Existing puddle checks and 153 combat regressions passed. Production browser startup and a stream foot impact rendered one ring and seven droplets without shader/runtime errors.

Standing ripples now originate at two independently sampled leg positions, spaced 0.24m across the world-facing stance. A dry leg emits no ring. Walking sprays retain seven droplets per impact, with varied upward speeds (1.15–1.5m/s), a wider spread and 0.72s maximum lifetime.

## Snow-covered ground and open water
Ground snow no longer clears the water effect buffers or skips the water drawing path. Local water depth continues to gate footsteps and paired idle ripples; snow suppresses rain-generated impacts only. Regression checks cover snowy movement, effect persistence across frames, paired idle contacts and dry ground. Production Chrome verified a stream footfall and retained ring/seven droplets with ground snow present.

Grass density now uses quintic-interpolated, domain-warped world-space noise in grass-canopy.mjs instead of summed sine waves. Broader coverage transitions break up periodic sparse bands exposed by snow. This is evaluated only during cached placement generation, with no new render passes or per-frame noise. Ground depressions, stream banks, snow grains and snowfall timing are unchanged. Mean canopy acceptance over the 128-metre field is approximately 74.2% versus 71.1% previously; local grass counts vary. The grass canopy determinism/clipping/exclusion test and all 157 combat regressions pass. Visual acceptance remains with the user.
