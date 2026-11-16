# MOB Workshop creature definitions

The experimental Workshop now authors version 1 creature definitions. No compendium entries were imported.

## Authoring flow

Model and animations → equipment fitting → stats, abilities and behavior → inventory and starting equipment → review and export.

Creature data includes identity and languages, size and movement modes, fixed/rolled/average hit points, natural armor and equipment AC breakdown, saving throws, magic resistance, ordered natural attack entries, structured traits, learned/innate spell entries, behavior preferences, and encounter/lore fields. Existing character classes remain separate from monster hit dice. THAC0 and saving throws are explicitly authored, not automatically derived from classes.

Natural attack animation slots are optional during authoring. Missing assignments are reported; existing 1H Swing/T-pose fallback rules remain in effect. Creature-specific rigs and animations are future work.

## Modules

- `js/mob-workshop-creature.mjs`: defaults, validation, equipment summary, definition export and independent individual generation.
- `js/mob-workshop-creature-panel.mjs`: form controls and sample generation.
- `js/mob-workshop-core.mjs`: project migration, animation slots and readiness checks.
- `js/mob-workshop.mjs`: Workshop integration and portable archive export.

Exports include `creature-definition.json` alongside the existing Workshop project and model. Old drafts receive defaults without losing their existing data. Generated individuals roll HP once and receive independent inventory and condition collections.

## Integration boundary

This is an authoring foundation. Structured natural attacks, traits, spells, movement capabilities and behavior preferences are not yet wired from this export into live combat. Export explicitly sets `deployment.ready` to false and records support warnings. Class-derived statistics and the Workshop-to-combat deployment adapter remain pending. Do not advertise these authored capabilities as working game mechanics.

Next integration milestone: round-trip one authored orc through export, library registration, equipment/animation resolution and combat; then extend capability adapters with targeted tests. Keep unimplemented capabilities visible in Review.

## Validation

Run `node scripts/test-mob-workshop-creature.mjs` and `node scripts/test-mob-workshop.mjs`. Browser smoke check covers Stats form editing, natural attack creation, warnings and individual sample generation; it does not establish live combat support.
