# Combat Rules Notes

Adventure Party currently implements a tactical interpretation of **AD&D 2nd Edition-inspired mechanics**, adapted where necessary for the hex engine.

This is a development reference, not a reproduction of any rulebook.

## Core battlefield assumptions

- Tactical movement uses a six-neighbor hex grid.
- Architecture can cut independently across the hex grid.
- Solid architecture blocks movement and line of sight where appropriate.
- Melee attacks cannot pass through solid walls.
- Ranged and spell targeting respect line of sight.

## Facing and positioning

The engine tracks six hex-facing directions.

Attack position can affect:

- shield protection
- Dexterity protection
- rear attack modifiers

## Movement and AI

- Visible movement occurs step-by-step.
- Guard can trigger attacks when enemies enter applicable range.
- Ranged AI searches for viable LOS/firing positions.
- Spellcaster AI establishes LOS before selecting its best available spell.

## Listen / Hear Noise

For off-LOS hostile movement, living conscious friendly characters can make individual listening checks.

Current racial baseline chances:

- Dwarf: 15%
- Elf: 20%
- Gnome: 25%
- Half-elf: 15%
- Halfling: 20%
- Human: 15%

An explicit Thief Detect Noise value overrides the racial baseline.

If any friendly succeeds for a moving MOB:

- movement is presented normally enough to indicate detected activity
- movement sound is played
- camera can center on the detected activity
- **Activity Detected** is displayed

If all fail, hidden movement resolves without the normal audible/visual movement presentation until the MOB enters friendly LOS.

## Fireball

Outdoor Fireball uses the established radius-2 tactical footprint.

For indoor casts, Adventure Party models confined-space Fireball behavior with a larger volume budget. The blast:

- respects solid architectural barriers
- fills reachable indoor volume
- can escape through openings
- converts remaining confined-space volume into reduced outdoor spread rather than treating indoor and outdoor hexes as equal volume

Damage, friendly-fire preview, AI evaluation, and VFX should all use the same resolved Fireball cell set.

## Wall of Fog

Wall of Fog:

- uses the incantation **Murus Nebula!**
- is a persistent LOS obstruction
- forms a directional wall
- can be rotated in 60° increments with the mouse wheel while aiming
- terminates at map boundaries and solid obstacles
- does not flood-fill around an obstruction
- is rendered partially transparent for battlefield readability

## Color Spray

Color Spray:

- uses the incantation **Coloris Aspersio**
- uses a directional wedge
- presents seven broad rainbow-color arcs
- remains bright initially, then fades with sharp random strobing during the fade period

## Spellcasting presentation

Every successfully committed spell triggers the standard caster glow:

- white
- no particles
- strongest near the sprite silhouette
- one-second 0% → peak → 0% opacity envelope

Spoken incantations are independent of the glow; spells without incantations still glow.
