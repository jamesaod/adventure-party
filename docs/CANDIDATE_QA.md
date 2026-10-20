# Candidate QA Notes

Stable baseline: **R237**

## Current candidate: Rev 5

### Spell Effects Previewer — full implemented-spell coverage

Candidate Rev 5 expands the development Previewer from five proof profiles to **every currently implemented combat spell**.

The harness still reuses the production battlefield canvas, spell catalog, cast resolvers, VFX/SFX functions, floating combat text, persistent status rendering, area-effect rendering, and Candidate combat-result beat system.

### Selection behavior

- Selecting **any** spell immediately stops the current loop.
- The Previewer waits for any already-running production animation to finish its cleanup.
- The sandbox is then fully reset.
- The newly selected spell automatically begins playing; pressing Play is no longer required after selection.
- Spell-library buttons remain selectable while another spell is running.
- Caster-level, target-count, outcome, and presentation-mode changes also reset and automatically replay the current spell.

### Full spell coverage

All combat-implemented Level 1–3 Wizard spells are now marked **READY**.

Five especially presentation-heavy spells keep their proven bespoke Previewer profiles:

- Magic Missile
- Fireball
- Sleep
- Wall of Fog
- Lightning Bolt

Every other implemented spell is routed through the **actual production casting resolver** with a disposable Previewer scene tailored to its target mode and any special prerequisites.

Special sandbox preparation includes:

- adjacent targets for Burning Hands, Color Spray, Chill Touch, Shocking Grasp, and Vampiric Touch;
- friendly adjacent targets for touch buffs and protective spells;
- clustered targets for area spells;
- undead dummy targets for Hold Undead;
- a pre-existing magical ward/fog volume for Dispel Magic;
- a Flaming Sphere source for Pyrotechnics;
- production hostile-target routing for Melf's Minute Meteors;
- a post-cast Chill Touch contact demonstration;
- a post-cast Blink turn-start shift demonstration;
- reduced caster HP for a visible Vampiric Touch drain/heal result.

### Deterministic Previewer resolution

The production spell code is not duplicated. While a production cast is running inside the Previewer only:

- attack-resolution helpers are forced to produce a normal hit so attack-spell VFX can be inspected reliably;
- non-d20 damage/duration dice use deterministic midpoint values;
- **Deterministic demo** and **Force failed save** show the spell's successful effect branch;
- **Force successful save** exercises the save-success branch;
- normal combat rules remain unchanged outside the Previewer.

Candidate Rev 5 also suppresses victory/defeat and normal turn advancement inside the Previewer sandbox so spells such as Charm Person cannot accidentally terminate the development arena.

### Presentation modes

- **Full Sequence** — production VFX + production SFX.
- **VFX Only** — shared SFX bus is suppressed while production visuals continue.
- **SFX Only** — projectile, area, persistent-status, fog, illumination, and related production render passes are suppressed while the production audio/timing sequence continues.

### Timeline

For production-routed spells, the measured timeline now records important real resolution events, including:

- casting begins / casting cue complete;
- production effect dispatch;
- direct damage events;
- buff/debuff application;
- area-effect creation;
- production resolver completion;
- spell-specific post demonstrations;
- persistent-effect observation period;
- complete/reset/loop gap.

### QA focus

1. Open **Spell Previewer [DEV]** and confirm the launcher/header show **Candidate Rev 5**.
2. Confirm every implemented combat spell in Levels 1, 2, and 3 is labeled **READY**; there should be no PENDING spell entries.
3. While Magic Missile is looping, click another spell. Confirm the arena resets and the new spell automatically begins without pressing Play.
4. Rapidly select several different spells and confirm only the final selection runs; no old projectile, status, combat message, or delayed effect should bleed into the new scene.
5. Check representative Level 1 spells: Armor, Burning Hands, Charm Person, Chill Touch, Color Spray, Enlarge, Grease, Light, Protection From Evil, Shield, Shocking Grasp, Spook, Taunt.
6. Check representative Level 2 spells: Blindness, Continual Light, Darkness, Flaming Sphere, Fog Cloud, Glitterdust, Hypnotic Pattern, Melf's Acid Arrow, Mirror Image, Pyrotechnics, Scare, Stinking Cloud, Web.
7. Check all Level 3 spells, especially Dispel Magic, Flame Arrow, Gust of Wind, Haste, Hold Person, Hold Undead, Melf's Minute Meteors, Slow, Vampiric Touch, and Wind Wall.
8. Confirm Hold Undead displays undead dummy targets.
9. Confirm Dispel Magic has magic present to remove.
10. Confirm Pyrotechnics has a Flaming Sphere source and does not reject the cast for lack of fire.
11. Confirm Chill Touch shows both the cast and a follow-on contact effect.
12. Confirm Blink performs a visible turn-start shift after the initial cast.
13. Confirm Vampiric Touch visibly damages the adjacent target and restores the caster.
14. Test **Force successful save** and **Force failed save** on Blindness, Slow, Hold Person, Stinking Cloud, Flame Arrow, and other saving-throw spells.
15. Test Full Sequence / VFX Only / SFX Only on several projectile, status, cloud, illumination, and wall spells.
16. Change caster level while a spell is looping and confirm it resets and automatically replays.
17. Change target count while an AoE spell is looping and confirm it resets and automatically replays.
18. Stop a run with Space or Stop, then select another spell and confirm autoplay resumes for the new selection.
19. Return to Launcher, enter Combat System Test, and confirm normal initiative, victory/defeat, turn advancement, saves, dice randomness, VFX, and SFX remain unchanged.
20. Re-enter the Previewer repeatedly and confirm no duplicate animation loops or stale timers accumulate.

### Candidate lineage retained from R237

- 33% hidden LOS overlay and restored obscuring-volume LOS presentation.
- No loot on total party defeat.
- Ordered result beats: direct damage → rider damage → buffs → debuffs → conditions.
- White rising **Casting Interrupted** feedback and dedicated synthesized fumble SFX.
- Level 1–3 AoE AIM-footprint preview audit.
