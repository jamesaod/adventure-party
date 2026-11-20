# User follow-up list

Persistent notes requested by James. Add new requested follow-ups here; retain completed items with their outcome. Consult this list when James asks about notes or the next pass. Notes are not automatic authorization to implement or timed reminders.

## Open

- [ ] **Low-poly weapon replacement: confirmed rules** (2026-11-08): Apply these user-supplied rules during the selected-model migration. Two-Handed Falchion uses the existing Two-Handed Sword stats and two-hand requirement, with a distinct name/model. Staff uses Quarterstaff stats. Great Mace replaces the provisional Two-Handed Mace: 20 gp, 20 lb, size M, bludgeoning, speed 10, damage S/M 1d8+1 and L 2d4. Two-Handed Battle Axe: 10 gp, 10 lb, size M, slashing, speed 9, damage S/M 1d10 and L 2d8. Maul replaces the provisional Two-Handed Hammer: 5 gp, 10 lb, size L, bludgeoning, speed 9, damage S/M 2d4 and L 1d10. All three require two hands. These explicit values supersede the earlier closest-existing-stats fallback. This note records requirements; it does not mean the catalog migration is complete.

- [ ] **Equipment page rework** (2026-11-08): Revisit the new MOB Workshop pipeline equipment page after the initial Equipment Fit implementation. Remind James when discussing next pipeline work.
- [ ] **Replacement battle axe and sword models — James** (2026-11-08): Polygon reduction damaged the current battle axe and sword models. James plans to create new versions later. Keep this visible for asset replacement; do not treat the damaged reductions as approved final assets.

- Equipment distinction (2026-11-08, implemented): Staff is one-handed with the one-handed staff pose and no support-hand constraint; Quarterstaff (wooden-staff catalog ID) is two-handed. Both use quarterstaff combat statistics.

- [ ] **Modular customizable characters — deferred** (2026-11-09): Keep working on MOB Workshop first. Future Appearance module: compatible interchangeable heads, hair, body parts and clothing on one shared skeleton per character; rigid accessories use bone sockets, deforming parts use skin weights. Save character recipes (rig, parts, colors, animations, equipment). Validate bind poses, seams, weights, clipping, ground placement, equipment, shadows and outlines. Start with one compatible modular pack, two heads, three hairstyles, colors and one torso/armor swap. Prepare rig conversion/retargeting in the studio, not at combat entry; share assets and consider offline mesh/material consolidation only if profiling warrants it. References: https://threejs.org/docs/pages/SkinnedMesh.html ; https://threejs.org/docs/pages/module-SkeletonUtils.html ; https://dev.epicgames.com/documentation/en-us/unreal-engine/working-with-modular-characters-in-unreal-engine .
- [ ] **Creature definitions → combat integration** (2026-11-09): Authoring foundation implemented; see MOB_WORKSHOP_CREATURE_DEFINITION.md. Next prove one Workshop-authored orc end to end in combat, then connect structured attacks, traits, spells, movement and behavior. Creature-specific animation work remains deferred; missing optional animations must stay visible in Review.

- Progress on creature integration (2026-11-09): Basic repository publication, direct-model animations, equipment fits and stats now connected; controlled Workshop orc completed a real battle to victory. Structured attacks, spells, traits and special movement remain gated. See MOB_WORKSHOP_COMBAT_AUDIT.md for exact validation limits.

- User requested combat AI development soon (2026-11-12): expand supported authored policies, race/group behavior, target choice and ranged positioning. Orc Warrior currently uses the approved default AI; original export requests reckless hazard handling and does not avoid opportunity attacks.

- [ ] **Shield arrow deflection with sound — deferred** (2026-11-12): James requested filing this for later after trying the standalone local demo. Preserve `shield-deflection-test.html`, `js/shield-deflection-test.mjs`, and `js/shield-deflection-test-motion.mjs`; local URL: http://127.0.0.1:8276/shield-deflection-test.html. Combat is unchanged; integration remains deferred. Trigger: modified attack roll misses the required hit number by exactly 1 or 2, defender has a shield, and shot arrives within the forward shield arc (supersedes critical miss). Arrow converts forward motion into spin and a lofted deflection before landing. Selected trial sounds: Metal short tick by jorickhoofd (Freesound 160052, CC BY 4.0), spinning lasso by zapsplat.com (Freesound 719638, CC0), and existing bow Mud Thud for landing. Downloaded preview assets and provenance are in `assets/audio/sfx/shield-deflection/`; landing is `assets/audio/sfx/bow/miss.wav`. Demo has replay, pause, timeline, motion controls, volume and mute; browser load/audio decoding and 12 trigger combinations passed. Sound choices are experimental, not final approval for combat. Resume only when requested.

- [ ] **Ground-cover and map-authoring ideas — deferred** (2026-11-12): Improve contextual stick placement, with more debris around trees. Explore patches of other ground materials and a possible manual terrain-painting tool for battle maps. James is considering using the combat map for exploration with a switch to turn-based combat, but has not decided. These are future considerations, not authorization to change exploration architecture.

- [x] **Next title/QA batch — queued 2026-11-14:** Display published game version, candidate revision, local build, and last update date/time as four separate lines in that order. Use accurate build provenance and America/New_York for the requested timestamp. Also repair garbled punctuation/text encoding on the title screen and during combat. User requested these for the next batch while the current title/menu/module cleanup proceeds.

- [x] **Next title/pre-battle presentation batch — queued 2026-11-14:** Use the existing Press Start 2P font on the title screen (user called it Player Ready 2P). Pre-battle preparation uses a fixed-size centered box with a themed border, a scrollable action/history log, and a final "Press Space to Continue" prompt; wait for Space after preparation.

- [x] **Following menu cleanup — queued 2026-11-14:** Remove the visible COMBAT FONT / Press Start 2P status line from menus. Requested while the current presentation batch was underway; keep font loading itself.

- Completed 2026-11-14, local R238C407: removed title menu heading/button frames/font-status line; centered left-aligned uppercase green Press Start 2P lists use a separate asterisk column and mouse/keyboard selection. Renamed Combat Map Editor entry; its editor implementation remains a forthcoming task. Audio status is the sole borderless sound toggle, including keyboard activation.

- [x] **Next Combat Map Editor texture batch — queued 2026-11-14:** User asked to collect these links without interrupting the first editor build. Import/integrate in the next update, not this initial version:
  - https://polyhaven.com/a/forest_leaves_02
  - https://polyhaven.com/a/grass_ground
  - https://polyhaven.com/a/forest_ground_06
  - https://polyhaven.com/a/rocky_terrain_02
  - https://polyhaven.com/a/forrest_ground_01
  - https://polyhaven.com/a/mud_cracked_dry_riverbed_002
  - https://polyhaven.com/a/dry_river_pebbles

- [x] **Next map boundary update — queued 2026-11-14:** Add a hard/soft boundary selection. Hard boundaries connect straight lines across other hexes to form solid shapes. Requested for the next update; not part of the texture/isometric batch.

- Completed local R238C410: soft hex brush plus straight-sided hard polygons, preview/finish/cancel/remove, undo and export/import.

- Local R238C418: terrain snow physical depth capped at 12 inches in CPU and GLSL, including footprint rim deformation and manual depth controls. Snow coverage coats and particle deposition remain intact. Combat scrolling performance investigation requested alongside the cap.

- [ ] **Stream Phase 4 — requested 2026-11-14:** Reduce uniformity of the river-stone bed and add a muddy transition along the banks. User requested layering phases 2 and 3 first; keep this for the next tuning pass.


- **Superseded by R238C453, 2026-11-14:** Stream stone-bed variation/muddy-transition phases are replaced by the requested simpler bare-dirt, wet-mud, still-puddle baseline with grass-blended banks. Do not restore the decorative layers without a new request.


- [x] **Next batch — stream wading, requested 2026-11-14:** Make units visually follow the streambed, smoothly interpolating their height down/up the banks. Occlude submerged legs beneath the water surface and keep footstep splashes at the waterline. Preserve movement costs and combat rules. Completed locally in R238C454 after the requested batch authorization.

- Local R238C454: implemented streambed-following presentation, submerged-body clipping and preserved waterline foot splashes. Channel-fitted 1024px depth mask and derivative-filtered waterline replace the coarse shoreline. No flow animation or movement-rule changes.


- [x] **Snow exclusion on water — requested 2026-11-15:** Snow must not accumulate on puddles or streams. Apply this requirement to the environmental/grass-and-snow test and shared snow accumulation behavior. Implemented in shared accumulation and the terrain lab: water excludes grain deposits, Full cover and manual depth; rising water clears existing snow. CPU regressions and hidden-browser GPU checks pass.


- [ ] **Next thought experiment — 2026-11-15:** Discuss shafts of light through branches on foggy days and light beams shining upward from beneath trees. User explicitly queued this after tree wind/explosion response; no lighting implementation requested yet.

- [ ] **Tree catalog expansion — 2026-11-15:** Create two additional variants each of White Oak and Sugar Maple (three of each total). User asked to explore and establish tree wind/explosion response first; catalog authoring remains queued.

- [ ] **Jagged major branch ends — deferred (2026-11-15):** User rejected the native-cap fitting experiment. Active fall rendering is restored to the original detached limbs; torn trunk/stump remains. Source experiment is preserved under tools/tree-production/branch-breaks for later, low-priority work.

- [x] **Next pass — submerged shadows (2026-11-17):** Shadows appear to fall on the water surface rather than the streambed beneath it. Investigate receiver elevation and water compositing so submerged shadows follow bottom terrain. Implemented locally with shared streambed remapping and depth attenuation for tree/unit shadows; user visual QA pending.
- [ ] **Next pass — night rain (2026-11-17):** Rain particles remain too bright at night; apply appropriate scene lighting/darkening. Pending from the earlier performance pass.

- [ ] **Giant boulder pickup/throw and rain-filled depressions — idea saved (2026-11-19):** James proposes complete boulder models scattered partly buried in the map. Giants can lift and throw them. Preserve the same object's identity/model through ground placement, hand attachment, flight and settled obstacle; allow later pickup where appropriate. Lifting exposes the buried rock and leaves a persistent shallow depression with dirt and no grass. Use one local footprint/mask, matched to boulder dimensions and burial depth, for actual terrain vertex displacement, disturbed-soil material, grass-instance suppression and water-depth sampling. Normal/bump detail alone is not a geometric hole; assess local mesh resolution before promising sharp rims. Initial suggested depth stays within the existing six-inch basin range. Update local terrain data on pickup rather than doing per-frame terrain simulation.
  - **Accepted water approach:** All depressions, including newly exposed boulder holes, share the existing combat saturation/water system. No independent per-hole hydrology is required. A hole exposed in already saturated ground may fill quickly/immediately at the current shared water level; dry ground remains dirt. Reuse puddle rendering, rain ripples and impact/foot splashes; retain existing weather-driven filling/draining.
  - Reuse tree-pickup/equipment patterns, authored lift/throw release markers, existing combat hit/damage resolution, and event-based navigation updates. Landing may use brief settling before the boulder becomes a stationary obstacle. The original hole stays when the boulder lands elsewhere. Save-state persistence and interaction with ground sampling, snow, water and grass require implementation design.
  - Suggested first proof: one boulder, one giant, one lift/throw sequence and one newly exposed rain-fillable dirt hole. This is a deferred idea, not authorization to implement. References: COMBAT_WET_BASINS.md, COMBAT_PUDDLE_EFFECTS.md, TREE_AS_CLUB.md.

- Local proof added 2026-11-19 after James supplied five Meshy boulders and explicitly chose the pickup/throw proof: see BOULDER_PICKUP_PROOF.md and boulder-pickup-test.html. Asset conversion, stable-object pickup/flight/landing, shallow dirt holes and shared water are implemented in the isolated lab. Production combat integration remains pending; the original idea is not marked complete.
