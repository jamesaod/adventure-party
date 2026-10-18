# Changelog

Adventure Party used numbered standalone HTML releases before Git became the primary version history. This repository starts from **R158**.


## R193 — Enlarge visual transformation

- Added full visual presentation for the already-implemented 1st-level Wizard spell Enlarge.
- The affected unit sprite grows from its current size to the spell's final size over exactly 1 second.
- Enlarge changes sprite render size only; occupied hexes, collision, pathfinding, melee reach, targeting footprint, and multi-hex occupancy remain unchanged.
- The growing unit uses the same white silhouette-glow treatment as the casting effect during the entire transformation.
- Added a synthesized one-second rising "growing" SFX synchronized to the enlargement.
- When Enlarge expires, the spell effect is removed normally but a retained transient visual interpolates the unit sprite back to normal size over 1 second.
- Expiration uses the same white glow in reverse and a matching descending "shrinking" SFX.
- HP bars move upward with the enlarged presentation so they remain above the scaled sprite.
- Existing Enlarge rules remain intact: 10% size increase per caster level, 5 rounds/level duration, hostile save to negate, unchanged HP/AC/attack rolls, and proportional weapon base-damage scaling.

## R192 — Tighter conical dragon breath

- Rebuilt the dragon-breath visual body as a true geometric cone from the attack-sprite muzzle instead of filling the tactical breath cells.
- Gameplay targeting still uses the same wall-aware breath cells; only the presentation geometry changed.
- Replaced the large R191 circles with much smaller overlapping flame lobes distributed continuously along 52 cone slices.
- The visual cone now widens gradually with distance instead of jumping from one tactical lane to three, removing the hex-fill appearance.
- Added a narrow independent white-hot center stream so the brightest flame stays on the cone axis.
- Smoke, grain, and embers now sample the mathematical cone rather than individual hex cells.
- Retained the R191 near-white palette, additive bloom, distal smoke, dragon attack pose, SFX, damage, saves, recharge, and multi-hex hover behavior.

## R191 — White-hot dragon breath

- Retuned the Juvenile Red Dragon breath toward the supplied bright fire-jet reference while preserving the pixel/tactical presentation.
- Increased flame sampling from 9 to 13 lobes per tactical breath cell and reduced positional jitter so the effect reads as one continuous projected jet.
- Shifted the heat palette toward pale yellow and near-white, enlarged the hot inner core, and made the main flame body nearly opaque.
- Added an additive blurred bloom pass plus a final hot additive pass so the breath reads as self-luminous rather than simply orange/yellow.
- Added dark gray smoke concentrated in the final third of the cone, leaving the mouth and near field clean and bright.
- Increased flame grain density and ember count while slightly reducing ember opacity so the jet itself remains the dominant visual.
- Breath mechanics, damage, saving throws, recharge, wall interaction, targeting cells, SFX, dragon poses, and multi-hex hover behavior are unchanged.

## R190 — Dedicated Red Dragon standing and attack poses

- Replaced the prior juvenile Red Dragon art with the user-supplied standing sprite.
- Added the user-supplied attacking sprite as a true action pose for breath attacks and the claw/claw/bite routine.
- Removed the source-image background programmatically while preserving the original pixel artwork; no generative image editing was used.
- Measured the user's seven-hex placement reference instead of estimating scale: the new dragon renders at 89 px wide, 104 px tall standing / 107 px tall attacking, with its bottom anchor 41 px below the footprint centroid and a 3 px facing-aware lateral bias.
- The new source art faces left natively, so engine mirroring now uses left as the canonical dragon facing.
- Dragon breath VFX now originates from a muzzle position measured against the attacking sprite.
- R189 full-footprint hover behavior and dense Fireball-style breath rendering remain unchanged.

## R189 — Multi-hex hover and denser dragon breath

- Hovering any visible multi-hex MOB now highlights every hex in its occupied footprint instead of only the single hex beneath the pointer.
- Wall/LOS visibility safeguards remain intact so hover highlighting does not reveal hidden hostile footprints.
- Dragon breath density is substantially increased: nine overlapping lobe samples per tactical breath cell, larger overlapping flame volumes, reduced jitter, broader hot-core fills, heavier grain, and more than twice the ember particle count.
- Breath weapon rules and affected tactical cells are unchanged.

## R188 — Dragon placement and Fireball-style breath VFX

- Retuned the Juvenile Red Dragon sprite to match the user-supplied seven-hex scale/placement template: approximately two hexes wide with its feet planted inside the lower half of the occupied footprint.
- Rebuilt the dragon breath renderer using the current Fireball construction method: one combined offscreen flame body, overlapping volumetric lobes, outside-only 2-pixel black silhouette, 75% translucent body, grain, and dense ember particles.
- Breath VFX now begins at an estimated mouth position derived from the same sprite anchor used for the battlefield dragon render, preventing the flame from appearing detached from the creature.
- Breath weapon rules, affected tactical cells, damage, saving throws, recharge timing, SFX, and wall interaction are unchanged.

## R187 — Juvenile Red Dragon multi-hex test

- Replaced the temporary Orc-backed 7-hex test MOB with a dedicated transparent juvenile red dragon sprite.
- Implemented the AD&D 2e juvenile red dragon combat profile for the test: 15 HD, AC -3, THAC0 7, movement 9, Fanatic morale, fire immunity, and 12,000 XP.
- Added the full claw/claw/bite routine with the juvenile +4 physical-damage combat modifier.
- Added a 90-foot cone of fire breath weapon at 8d10+4, save vs. breath for half, usable once every three rounds.
- Added wall-aware multi-hex breath targeting, procedural animated flame-cone VFX, and synthesized WebAudio breath SFX.
- Fireball now respects creature fire immunity.

## R159 — Grease VFX/SFX

- Grease now renders as a persistent animated glossy oil slick with an irregular puddle silhouette, moving specular streaks, and subtle oil-sheen colors.
- Casting Grease produces a short target-hex splash ring and viscous droplet burst.
- Added a synthesized wet magical splat / oily shimmer sound through the shared WebAudio SFX engine.
- Grease mechanics, saving throws, duration, and affected hex remain unchanged.

## R158 — Initial Git baseline

- Color Spray incantation set to **Coloris Aspersio**.
- Universal spellcasting glow remains active for every successfully committed spell.
- Current standalone development build promoted to the repository baseline.

## Recent pre-Git milestones

### R157
- Reduced Wall of Fog exterior outline thickness.
- Added a single exterior black outline around the complete Color Spray effect.

### R156
- Casting glow moved to the central spell-commit path so every successfully cast spell receives it, including spells without incantations.

### R155
- Mouse wheel rotates Wall of Fog orientation in 60° steps during targeting.
- Live area preview reflects the selected orientation.

### R154
- Corrected Wall of Fog versus architectural-wall depth ordering.

### R153
- Wall of Fog stopped using conserved-volume flood filling.
- Fog wall now terminates at map edges and solid obstacles.

### R152
- Added AD&D 2e-style confined-space Fireball volume behavior.
- Indoor Fireball uses a larger confined-space volume budget and converts remaining indoor volume to reduced outdoor spread when escaping through openings.

### R151
- Wall of Fog incantation set to **Murus Nebula!**
- Added animated fog and a single exterior outline.

### R150
- Added reusable architecture-aware volumetric propagation foundation.
- Wall of Fog later diverged from this behavior in R153.

### R149
- Casting glow changed to white and reduced in opacity.

### R148
- Color Spray simplified into seven broad solid rainbow arcs.

### R147
- Casting glow changed to a one-second 0% → peak → 0% opacity envelope with distance falloff and no particles.

### R144
- Large particle-density pass for Fireball and fire-hit effects.

### R143
- Corrected Fireball transparency so underlying terrain remains visible through the flames.

### R141
- Fireball changed to one exterior outline around the full effect rather than per-lobe outlines.

### R137
- Corrected sprite/wall clipping.
- Added spellcaster LOS repositioning.
- Added Listen/Hear Noise handling for off-LOS hostile movement.

## Older history

Earlier numbered releases established the core combat engine, sprites, morale, initiative, ranged AI, spells, status effects, architectural Wall Test, LOS rendering, launcher, character UI, and other foundational systems.

From this point forward, **Git commits and tags are the authoritative version history**.
