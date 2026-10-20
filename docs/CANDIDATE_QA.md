# Candidate QA Notes

Stable baseline: **R237**

## Current candidate: Rev 4

### Spell Effects Previewer development harness

A new **Spell Previewer [DEV]** launcher entry provides an isolated presentation laboratory for spell VFX, SFX, timing, floating combat results, and persistent effects.

The previewer deliberately reuses the production battlefield canvas, renderer, spell catalog, combat-result text, and production VFX/SFX functions. It does not run initiative, MOB AI, victory/defeat, loot, or normal turn flow.

### Rev 4 preview-ready profiles

Rev 4 establishes the framework using five deliberately different spells:

- **Magic Missile** — repeated projectile launches, individual impact SFX, then damage feedback.
- **Fireball** — projectile, AoE explosion, affected dummy targets, fire damage presentation.
- **Sleep** — multi-target application VFX, debuff feedback, and persistent Sleep presentation.
- **Wall of Fog** — persistent animated/depth-sorted area VFX and obscuring-volume behavior.
- **Lightning Bolt** — production reflected-ray geometry, electrical SFX, and damage feedback.

Every implemented combat spell remains visible in the library. Spells without a dedicated Rev 4 preview profile are labeled **PENDING**, making missing preview coverage explicit rather than silently substituting a fake effect.

### Previewer controls

- Caster level: 1–20.
- Dummy targets: 1, 3, or 5.
- Outcome: deterministic demo, forced successful save, or forced failed save where the profile uses save-dependent damage.
- Presentation: Full Sequence (VFX + SFX), VFX Only, or SFX Only.
- Loop: enabled by default with a one-second reset gap.
- Play, Stop, and Reset Arena controls.
- Space toggles play/stop; Esc returns to the launcher.
- A measured timeline logs actual elapsed event timestamps and displays a moving playhead.
- The preview arena labels the caster, friendly dummy, and hostile targets.

### QA focus

1. Open **Spell Previewer [DEV]** from the Candidate Rev 4 launcher.
2. Confirm Magic Missile starts automatically, loops, and fully resets target HP/effects between runs.
3. Confirm the measured timeline advances continuously and logs launch/impact/damage beats in order.
4. Switch to **VFX Only** and confirm spell visuals remain while spell-specific preview audio is suppressed.
5. Switch to **SFX Only** and confirm the preview sequence/timing still runs without projectile/status visuals.
6. Change caster level and target-count controls and confirm the sandbox resets cleanly.
7. Confirm Magic Missile uses the production projectile and hit sounds.
8. Confirm Fireball uses the production projectile/explosion visuals and the dummy targets display production rising damage text.
9. Confirm Sleep applies production magical/status VFX and affected targets visibly remain asleep during the observation portion.
10. Confirm Wall of Fog remains continuously animated without mouse movement and participates in normal battlefield depth/LOS presentation.
11. Confirm Lightning Bolt uses the production reflected-ray renderer and electrical sound.
12. Stop a running loop and confirm no stale projectiles, floating text, combat beats, or audio-triggered follow-up events leak into the next run.
13. Return to the launcher and enter Combat System Test; confirm the battlefield canvas is restored to the combat screen and ordinary combat still initializes normally.
14. Re-enter the Previewer multiple times to check for duplicated loops, stale timers, or progressively delayed effects.

### Candidate lineage retained from R237

The candidate starts from the R237 stable milestone, including:

- 33% hidden LOS overlay and restored obscuring-volume LOS presentation.
- No loot on total party defeat.
- Ordered result beats: direct damage → rider damage → buffs → debuffs → conditions.
- White rising **Casting Interrupted** feedback and dedicated synthesized fumble SFX.
- Level 1–3 AoE AIM-footprint preview audit.
