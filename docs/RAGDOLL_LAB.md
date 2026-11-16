# Animated knockback and recovery lab — local R238C392N

Open `http://127.0.0.1:8276/ragdoll-test.html` through the existing local server.
This is an isolated animation-only experiment, not a combat rule or renderer change.

## Try it

- Select 1, 4 or 8 Orcs and press Blast. Orcs begin in an evenly spaced ring around the amber blast marker with random starting facings. At detonation the real root turns its +Z-forward axis outward, then the authored UAL1 Source `Death02` take plays while the root follows a short outward/upward arc. The final frame remains prone and faces outward. Adjust outward speed, upward speed and launch variation for the next launch. Variation independently samples the two speeds for every Orc: 0% is exact and 100% is 0–200% of the displayed setting. Death02 supplies the authored body fall/tumble.
- Keep units in view expands the camera when a body or dropped item approaches the edge. Drag to orbit; wheel zoom turns automatic framing off.
- Pause and Step inspect the physics and recovery. Reset restores independent fresh rigs.
- Disable Stand up automatically to inspect a resting survivor, then Recover survivors manually.
- Disable Survive the explosion to retain a frozen corpse. Reset before another corpse test.
- Measure 1 / 4 / 8 animation cost launches real rigs through Death02 and automatic recovery. It enables both survivor options and uses the current launch settings.

## Implementation

The published Orc Warrior Workshop package supplies the actual mesh, skeleton, materials and equipment. Its existing loader, appearance adapter and semantic bone map are reused. Its authored forward axis is +Z, so the test turns the real root outward from the blast before launching it and keeps that root turn through recovery. `cloneCombatRig` exports the existing skeleton-safe clone from `combat-model-source.mjs`; no production caller changes. The project-owner-supplied Universal Animation Library Source archive supplies `Death02` from its non-root-motion `UAL1.glb`; `assets/animations/ual1/ual1-death02-source.json` records its source, selected clip and checksum.

The lab samples retargeted Death02 and Crawl Exit at 24 poses per second, clamped to their authored final frames rather than wrapping to frame zero. During Death02 it updates the published root along a deterministic eased outward path with a small parabolic lift. It never creates a Rapier world, rigid body, joint, collider, dropped-equipment body, corpse bake or collision check. The actual weapon and shield remain under their authored sockets. At the final Death02 sample, a one-time bounds check puts the prone model on the floor. The presentation scheduler stops at idle; background tabs discard the time backlog.

Recovery blends from the final Death02 frame into the opening pose of UAL1 Source `Crawl_Exit`, plays the retargeted clip forward, and blends into the Orc package's existing UAL1 Idle. The recovery keeps the root's outward blast-facing turn, so an Orc stands facing its travel direction. Ground placement and terrain-aware alignment remain prototype work; combat damage, legal hex destinations, obstruction resolution, turns and resurrection are not connected.

## Measurements and checks

Pose timings include retargeted Death02/Crawl Exit pose sampling and root-trajectory updates. They exclude rendering, loading and GPU execution. This page reports no whole-game frame-rate guarantee.

Run Measure 1 / 4 / 8 animation cost to take fresh local device measurements; the results report the actual mean/peak pose update, last prone time and zero rigid bodies. These are fixture measurements, not a platform budget.

`scripts/test-combat-ragdoll-lab.mjs` verifies the Death02 and Crawl Exit source identities/checksum, then retains the existing isolated Rapier fixtures as regression coverage for the legacy optional solver module. Browser checks cover the real retargeted Death02 rig, outward heading, zero runtime rigid bodies, smooth survivor recovery and the 1/4/8 animation-only run.

No new game cache chain is required. Lab entry is R238C392O; all direct-unit registry imports remain R238C391 to preserve registry identity. Keep local until publishing is requested.
