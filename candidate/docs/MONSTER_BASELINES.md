# Minimum HP and no-class baselines — Rev 203

MOB Creator stores `character.rules.minimumHp` (integer 1–100000, default 1). Generation applies `max(calculated HP, minimumHp)` once after the monster/class roll or fixed HP value, including Constitution adjustments. Both current and maximum HP receive that result. This is not regeneration or a damage floor. A floor above the dice/fixed value intentionally raises starting HP.

No class is not Fighter level 1. An empty template class table normalizes to No character class at 100%; a missing Unique class also becomes None. Nonempty incomplete distributions still fail generation. A mixed table resolves each sampled class separately: class samples retain the PHB progression and existing explicit overrides; None samples resolve their monster baseline.

`monsterBaseline` defaults to `auto`, matching the Species field exactly (case-insensitive). Explicit Orc/Kobold selections are available when the species label is customized. `authored` is an explicit escape hatch for custom/unregistered species. Unknown automatic species block generation and encounter readiness; they never silently receive Orc or Fighter stats. Existing packages normalize with a floor of 1 and automatic species selection. Model names do not choose statistical identity.

## Verified source

User-supplied *Monstrous Manual*, TSR 2140, 2nd edition, third printing (1994): Orc printed p. 281 / PDF p. 284; Kobold printed p. 214 / PDF p. 217. Tables were checked visually against the PDF. Source PDF and page images are not redistributed.

- Orc: 1 HD (1d8), THAC0 19, one attack, XP 15, morale 11–12 (engine target 11).
- Kobold: half HD (1d4 HP), THAC0 20, one attack, XP 7, morale 8–10 (engine target 9).
- Both entries specify unarmored AC 10. Orc unarmored movement 12; Kobold movement 6. Listed typical armored values are Orc AC 6 / movement 9 and Kobold AC 7. The runtime uses actual equipped armor/shields once, rather than granting the typical armor for free or double-counting a shield. Weapon damage follows the selected equipment, not a fixed monster weapon roll.
- Monster saving throws use the existing warrior bands at rounded-up HD (minimum 1); no class spell slots are granted.

These are the currently verified baseline entries, not a digitization of the entire Manual. Add future species to `js/monster-baselines.mjs` with verified numeric data and printed/PDF page references. Specialized leader/shaman rules are not inferred from model appearance.

Tests: `scripts/test-monster-baselines.mjs` exercises floor bounds, low/high rolls, fixed HP, fractional HD, mixed class behavior, empty class tables, unknown species, explicit authored fallback, package roundtrip and repository combat generation.
