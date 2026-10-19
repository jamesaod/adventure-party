# Changelog

Adventure Party used numbered standalone HTML releases before Git became the primary version history. This repository starts from **R158**.


## R197 — Clean architectural wall silhouette

- Reduced architectural wall height from 45 px to 35 px after visual review.
- Reduced dynamic wall illumination intensity by 50% while preserving source-facing behavior, distance falloff, source color, and wall occlusion.
- Removed all per-segment black base seams, end seams, and individual segment borders that produced internal lines at connected wall joints.
- Added a structure-level wall silhouette pass: all visible wall slabs are rasterized into one union mask, dilated by 2 px, and the original mask is subtracted.
- The resulting 2 px black outline appears only around the exterior of the combined wall shape, so joined segments read as one continuous stylized structure.
- Wall faces remain a solid unbanded masonry color and wall tops remain one flat solid cap color.
- The same exterior-only outline logic is used in both the primary battlefield pass and the post-LOS visible-wall repaint.
- Wall shadows automatically track the revised 35 px height.
- Movement, collision, LOS, volumetric blocking, and R195 illumination mechanics are unchanged.

## R196 — Taller illuminated architectural walls

- Increased architectural wall height from 30 px to 45 px, a 50% increase. Wall blocking mechanics are unchanged.
- Reworked wall rendering to remove the former per-height shade banding and use a solid masonry face color.
- Replaced the striped/highlighted wall top treatment with a single solid-color cap.
- Added a crisp 2 px black outline around each authored wall segment, including top, base, and vertical end seams.
- Wall cast shadows automatically lengthen with the new 45 px wall height.
- Integrated R195 dynamic illumination into wall rendering.
- A nearby light source brightens a wall surface only when the source has a meaningful component toward that wall face.
- Light intensity on walls uses source radius, radial distance falloff, and wall-face alignment.
- Other architectural walls can occlude a light source before it reaches a wall surface, preventing light from passing through intervening masonry.
- Long wall segments receive localized radial illumination near the source instead of uniformly brightening end-to-end.
- Wall top caps remain solid and are not dynamically banded by the wall-lighting pass for easier visual inspection.

## R195 — Illumination system and Light spell VFX

- Introduced a reusable battlefield illumination mechanic separate from line of sight.
- Added ambient illumination queries for outdoor and indoor/wall-test battlefields plus reusable dynamic illumination sources.
- Added moving unit-attached light sources and static area-light sources, with additive stacking and radial distance falloff.
- Dynamic illumination respects architectural LOS blockers, so magical light does not bleed through solid walls.
- Added shared queries for dynamic illumination, total illumination, and whether a hex counts as illuminated for future darkness/infravision/AI rules.
- The 1st-level Wizard spell Light now creates an actual 20-foot-radius illumination source for its full duration.
- Friendly Light targets carry the light source with them and visibly illuminate surrounding terrain.
- Hostile targets that fail their save are both blinded and illuminated; the light follows the affected creature.
- Hostile targets that save cause Light to form as a static source immediately behind them, preserving the existing spell behavior while still illuminating terrain.
- Added a persistent pale yellow-white unit aura with soft radial glow, restrained rays, and orbiting motes.
- Terrain uses aligned radial gradients clipped to reachable hexes, producing a continuous-looking pool of light rather than independent bright hex fills.
- The first illumination pass does not alter party LOS/detection yet; illumination and visibility are deliberately separate systems for later refinement.
- Existing Light blindness penalties and duration remain unchanged.

## R194 — Shield spell visual effect

- Added a persistent translucent magical Shield VFX for the 1st-level Wizard spell Shield.
- The barrier is drawn slightly forward of the affected unit and follows the unit's live six-direction tactical facing every frame.
- Shield VFX remains visible for the entire spell duration and disappears automatically when the buff expires.
- Added a pale blue-white translucent pane, brighter rim glow, subtle pulse, inner curvature highlight, and traveling glint.
- The barrier scales visually with Enlarge so it stays proportionate to an enlarged unit, while neither spell changes the unit's tactical footprint.
- Shield joins the shared persistent-status animation loop so its shimmer continues even while the battlefield is otherwise idle.
- Existing Shield mechanics are unchanged: frontal Magic Missile negation, AC 3 vs arrows/bolts/bullets, AC 4 vs other attacks, +1 applicable saves, and 5 rounds/level duration.

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
