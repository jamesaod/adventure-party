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
