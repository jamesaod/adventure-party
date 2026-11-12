# Workshop HP modes — local revision 313

The Stats page has one Hit points panel with three mutually exclusive radio options:

- **Fixed hit points:** use the entered HP for each individual.
- **Hit dice + modifier:** roll the chosen number of dice, then add the signed modifier once. Dice default to eight sides. For example, 1d8 + 1 gives 2–9 HP.
- **HP range + modifier:** choose one uniformly random integer from the inclusive minimum/maximum range, then add the signed modifier. For example, 1–4 + 1 gives 2–5 HP.

HP is generated once when an individual is instantiated, and initializes both current and maximum HP. Results have a minimum of 1. Inactive settings stay saved for switching modes but do not contribute to HP or block validation. Fixed HP is stored in `stats.hp`; dice remain in `creature.combat.hitDice`; range bounds/modifier are `hpRangeMin`, `hpRangeMax`, and `hpRangeModifier`. `hpMode` accepts `fixed`, `roll`, or `range`.

Older `average` policies migrate to their identical deterministic result as fixed HP. Existing fixed and rolled definitions keep their behavior. The previous duplicate fixed-HP field and separate HP-policy/Hit Dice controls are replaced by the combined panel.

**Less than 1 Hit Die** is an explicit checkbox, independent of HP calculation or damage. It persists as `creature.combat.lessThanOneHitDie` and reaches live units as the same boolean and `hitDiceValue: 0.5`. The existing Sweep gate and other HD-aware checks therefore recognize the classification, while preserving their ordinary allegiance, alive/fled, reach, weapon and action restrictions. Unchecked units retain their existing authored HD metadata; HP is never used to infer HD. Legacy non-Workshop fractional-HD units are unchanged.

`workshop-hit-points.mjs` owns calculation, validation, migration and classification. `workshop-hit-points-panel.mjs` owns the radio/numeric controls; Workshop sampling and the real combat adapter both use the shared calculation. Drafts, portable ZIPs and published MOB packages retain all settings. No rendering, attack timing, visuals or remote publishing changes are included.

`node scripts/test-workshop-hit-points.mjs` covers each policy, random bounds, modifiers, inactive-field isolation, invalid values, legacy migration, live UI handlers, portable/published round-trips, and the actual Sweep and spell HD helpers. Visual QA remains with the user.
