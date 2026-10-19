# Changelog

Adventure Party used numbered standalone HTML releases before Git became the primary version history. This repository starts from **R158**.



## R202 — Hard wall shadows and readable corners

- Added a second, conservative architectural light-occlusion pass. Every solid wall subsection now casts an extruded world-space shadow volume away from each point light, and that shadow is subtracted from the rendered light layer.
- This makes the solid wall surface authoritative even when a visibility ray lands exactly on a wall endpoint/corner and avoids the repeated light bleed seen through solid wall sections.
- Light-transmitting gaps still work geometrically: full doorway gaps and window-glass apertures are omitted from the light-blocking wall subsections, so only those openings can transmit illumination.
- Old-wood texture is now limited to vertical wall faces. Wall tops use the flat cap material again and no longer display the repeating wood-board texture.
- Added explicit two-pixel vertical seams at connected 90-degree wall joints. Straight wall runs remain seamless, while inside/building corners regain the vertical depth cue needed to distinguish the two meeting wall planes.
- R201 hex-aligned doorway/window placement and window projectile blocking remain unchanged.



## R201 — Exact wall light clipping and hex-aligned openings

- Replaced Wall Test illumination's per-hex wall clipping with a continuous world-space light visibility polygon built from the actual thick architectural wall faces.
- Dynamic light now stops at the near face of solid walls instead of allowing an illuminated hex to paint pixels past the wall.
- Doorway and window apertures are still honored by the light polygon: door gaps and glass transmit illumination, solid wall surface does not.
- Added explicit opening-to-hex anchoring. North, south, and east windows are centered on actual tactical hex centers rather than arbitrary percentages between centers.
- Rebuilt the south doorway as a literal one-hex-wide wall gap centered on hex (-3,5). Its edges land on that hex's left/right borders, so the doorway is visually open and fully passable like the west entrance.
- The south window is centered over adjacent hex (-2,5), preventing overlap with the widened doorway.
- Split architectural ray rules into vision, light, and projectile modes.
- Window glass passes vision and light but blocks physical missile fire. Longbows, slings, and ranged AI now require a clear projectile lane; doorways remain valid firing openings.
- Spell LOS behavior is unchanged in this revision and continues to use vision LOS.



## R200 — Directional wall light and true window planes

- Wall illumination now paints only the physical half-face oriented toward each light source; the opposite side of the same wall is no longer brightened by that source.
- The old-wood wall sprite is scaled across the wall's complete visible slab height and vertically aligned so the top of the supplied texture reaches the actual top of the wall.
- North/south windows now cut a complete rectangular aperture through the rendered wall before the window frame/glass is drawn.
- The window art is placed on the wall center plane rather than pasted onto a surface face.
- East/west window planes are treated as edge-on in the current projection: their face-on texture and rectangular cutout are suppressed visually, while their authored LOS/illumination aperture remains active.
- Pure white window pixels remain translucent glass; source alpha outside the authored frame is preserved.
- Doorways remain literal geometric wall gaps from R199.
- Combat event log layout now permits true internal scrolling, and new entries are re-pinned to the bottom after layout/paint so the newest event remains visible.


## R199 — Centered wider windows and geometric doorways

- Removed the R198 doorway texture from the runtime presentation. Doorways now use the earlier architectural treatment: a literal gap between wall segments.
- South doorway remains in the test building at its current location, but no doorway sprite or white-pixel texture mask is involved.
- Centered every test-building window on its wall placement; the south window moves from its R198 offset to the horizontal center.
- Increased window visual width by 50% while retaining the existing window height and 2/3-wall-height vertical center.
- Expanded the window LOS/illumination aperture from 24 world units to 36 world units, matching the requested 50% widening.
- Window lattice/frame is visual only. LOS and illumination do not trace individual panes or bars; they use one continuous clear aperture spanning the apparent glass opening width.
- Windows still block movement and physical volumetric propagation.
- Wall silhouette generation and wall rendering now use movement-solid subsegments so doorways are genuine gaps in both the visible wall body and the exterior outline.
- Wall caps and wall illumination also respect those geometric doorway gaps.
- R197 wall height, old-wood texture, exterior-only outline, and reduced wall-light intensity remain unchanged.

## R198 — Old-wood walls, windows, and doorway

- Added the user-supplied old wooden wall tile as the repeating material for the Wall Test building.
- Added the user-supplied window and doorway artwork without generative alteration; pure-white pixels are interpreted semantically at runtime.
- Window white panes are rendered as translucent glass and cut through the wall face so terrain/units remain visible behind them.
- Window glass allows LOS and illumination to pass, while still blocking movement and physical volumetric propagation.
- Doorway white space is fully open: movement, LOS, illumination, and volumetric effects can pass through it.
- Window visual placement is horizontally centered on its opening position and vertically centered at two-thirds of the 35 px wall height.
- Added one centered north-facing window, one centered east-facing window, one south-facing window, and one south doorway on the test building.
- The south doorway and south window are separated along the same wall so both can be inspected at once.
- Architectural wall blocking is now opening-aware through reusable wall subsegments, including the LOS blackout ray geometry.
- The existing west-side open entrance remains in place for regression comparison.
- Doorway-aware wall shadows leave the open passage unshadowed.
- R197's 2 px exterior-only building outline, 35 px wall height, solid wall cap, and reduced wall-light response remain intact.

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
