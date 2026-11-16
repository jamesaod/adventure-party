# Approved footstep replacements — local R238C424

User-approved sources replace only grass, mud and water pools. Dirt and selected male/female injury/death recordings are unchanged.

- Grass: OwlStorm, Grassy Footstep 1 (151230): one isolated footfall.
- Mud: Vrymaa, Footsteps Mud - Walk & run (770097): ten single transients from the walking portion before 15.2 seconds. Playback gain is 0.15, exactly half the previous 0.30; no normalization offsets that reduction.
- Water: pascalcolors, Walking in Puddles (787465): eleven individual footfalls from the first ten seconds only. The latest excerpt ends before eight seconds.

Files and precise source offsets/hashes are in `assets/audio/sfx/terrain-steps/approved/SOURCE.json`. These are derived from the sources' public high-quality MP3 previews, decoded to mono 48 kHz PCM16 with four-millisecond edge fades and no level normalization. They are not claimed to be the original lossless uploads. Each excerpt is <= 0.4 seconds and contains one primary transient, so no recorded walking sequence imposes a second cadence. CC0 provenance URLs remain with every excerpt. Grass uses the single approved clip; mud/water pick random variations without immediate repeats.

Rigged combat units now emit ground footfalls through the existing animated sole-contact sampler used for snow. A lifted foot planting within 2.5 cm of the calibrated sole triggers the ground callback only during walking and outside snow. Duplicate render passes and idle pose shifts do not retrigger. Recent rig callbacks suppress the distance-based event, preventing double steps. Baked/static poses and units lacking recognizable foot bones retain the established distance fallback. Puddle splashes follow those same planted-foot events. Snow contact sounds, movement speed, animations and rules are unchanged.

Validation: 124/124 combat regressions passed, including exact source hashes, the puddle time limit, half mud gain, planted/raised/idle foot behavior, duplicate-pass suppression, snow priority and fallback deduplication. Browser decoding and actual combat cadence verification are recorded below. Auditory mix approval remains with the user.

Browser verification passed: all 40 active recordings decoded; selected injury/death randomness and mute still worked; a rendered rigged unit produced three water-footfall events synchronized with its animated walk, while camera-only panning produced none. Water splashes followed the same events and all transient effects expired after rain stopped. No shader/audio/runtime errors; two established optional prepared-unit cache misses used their normal fallback.

## R238C426: softer grass replacement

User approved trexlasso Walking Through Grass (630006), CC0. Eight 0.32-second excerpts replace the rejected OwlStorm clip in the active pool, with a common measured boost and 6 ms fades. Exact source offsets, gain and hashes are in SOURCE.json. Samples retain peak headroom; playback gain stays 0.96. Random nonrepeating selection and planted-foot cadence remain. Mud, water and dirt are unchanged. Source is the public HQ MP3 preview, not the lossless original.
