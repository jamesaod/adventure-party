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

## Hill Giant — 16 November 2026

User selected Heavy Walking Footsteps by Universfield, Pixabay asset 352771. Downloaded original MP3 and five isolated, original-pitch footfalls are in assets/audio/sfx/hill-giant; SOURCE.json records source, license link, cuts, processing and hashes. The five WAVs are 48 kHz mono PCM16, 0.85 seconds each, with 2 ms attack/25 ms tail fades; these contain one footfall each rather than playing the five-second walk on every contact.

The existing animated ground-contact path now passes the entity to adventurePartyTerrainStep. Only repositoryMobId hill-giant or type mob:hill-giant selects the giant pool, gain 0.6384 (increased 33% from 0.48 at the user’s request). Water/mud retain quieter surface layers; snow retains its existing priority. Shared context, mute/cancellation, visibility checks, voice limits and nonrepeating selection remain. No added timer or animation loop.

Validation: all 35 selected terrain/giant samples decoded in the actual game; giant playback selected the new pool with no browser errors. Unit tests verify identity selection and five valid WAVs. The combined combat suite passed 169/169.

## Hill Giant club impact — Earth1 (16 November 2026)

Earth1.aif by pushtobreak: https://freesound.org/people/pushtobreak/sounds/16793/ — CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/). Noncommercial use with attribution; separate permission required for commercial release. High-quality preview archived with provenance in assets/audio/sfx/hill-giant/EARTH1-SOURCE.json. User selected the first 2 seconds, with the main thump at 0.70 seconds. Mono 48kHz WAV, original pitch, 20ms end fade, gain 1.3 (doubled from 0.65 at the user’s request). Starts at 1.70 seconds of giant attack so thump lands at 2.40. Both hits and misses strike the ground. Existing audio mute/voice limit and stale-session/action cancellation retained.

Giant confirmed damage now waits until animation time 2.45 seconds (50ms after the main thump) before changing HP or emitting damage text; stale sessions and dead participants cancel the pending hit.

Giant ground strikes now trigger a bounded 350ms battlefield-canvas translation impulse at animation time 2.40s (maximum 3px vertical / 2px horizontal). Web Animations handles the transient; no terrain, visibility, camera or lighting cache changes. Offscreen/hidden actors and reduced-motion preference suppress it. Concurrent strikes replace the previous shake rather than adding unbounded displacement. Based on Cinemachine impulse guidance: https://docs.unity.cn/Packages/com.unity.cinemachine%402.8/manual/CinemachineImpulseSourceOverview.html

Giant water footsteps: water sample gain is tripled for Hill Giants, Huge/Gargantuan creatures, and creatures at least 12 feet tall (including enlargement). Hill Giant water layer 0.22 → 0.66; other qualifying water footsteps 0.30 → 0.90. Heavy footfall, land, mud and ordinary-sized water gains remain unchanged.
