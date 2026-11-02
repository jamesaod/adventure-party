# Adventure Party — Living Requirements

This document records the current high-level project direction. It should be updated when a design decision changes.

## Product direction

- Working title: **Adventure Party**.
- Browser-based game engine and playable prototype.
- Preserve a classic SSI Gold Box / Dark Knights of Krynn-inspired presentation.
- Keep the game practical to run locally in a browser.
- Prefer deterministic, inspectable game logic over hidden behavior.

## Launcher

The launcher provides these modules:

1. Combat System Test
2. Character Generation
3. Pixel Editor
4. Map Maker World
5. Map Maker Explorer
6. Map Maker Combat

Additional launcher requirements:

- Retro Gold Box-inspired visual treatment.
- MIDI title music support.
- Audio toggle in the lower-right area.
- Fullscreen-friendly layout.

## Combat presentation

- Isometric hex battlefield.
- Continuous navigation / map support where applicable.
- Units move step-by-step rather than teleporting when movement is visible.
- Camera should avoid unnecessary movement and center when combat presentation requires it.
- Architectural walls are independent of the tactical hex edges.
- Walls participate in movement blocking, melee blocking, line of sight, depth sorting, and spell interaction.
- Friendly-party LOS controls presentation of unseen enemies.

## Combat interaction

Current command direction includes:

- Aim
- Guard
- Wait / turn completion behavior
- Character
- Cast

Targeting previews should match actual resolution geometry.

## AI

- MOBs pursue usable tactical positions rather than blindly walking toward a target.
- Ranged units seek firing positions with line of sight.
- Spellcasters seek a position with line of sight before choosing the best spell for the situation.
- If a spellcaster cannot reach LOS this round, it may continue moving toward a suitable LOS position.
- Off-LOS enemy movement may be detected through Listen / Hear Noise checks.

## Magic

- Spell data should be centralized in the canonical spell catalog.
- Successfully committed spells receive the standard casting glow.
- Incantations, when assigned, come from the canonical spell record.
- Area previews, AI evaluation, damage/control resolution, and VFX should use the same spell geometry.
- Architectural interaction is spell-specific; not every area spell behaves as conserved volume.

Current examples:

- Fireball: confined-space / architectural volume behavior.
- Wall of Fog: forms a wall and terminates at map boundaries and solid obstacles.
- Color Spray: directional wedge with seven-color presentation.

## Visual effects

- Effects should remain readable against the battlefield and preserve tactical information where intended.
- Persistent status VFX are status-driven and disappear when the status ends.
- Fire damage produces a brief flame reaction on damaged units.
- Spellcasting glow is white, particle-free, and follows the caster sprite silhouette.

## Version control

- `index.html` is the current playable development baseline.
- Git commits replace the old practice of retaining every numbered HTML build in the main repository.
- Important milestones may be tagged or released when useful.
