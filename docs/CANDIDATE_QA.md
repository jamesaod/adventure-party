# Candidate QA Notes

Stable baseline: **R237**

## Current candidate: Rev 8

### Gaseous spell formation — softer individual tufts

Candidate Rev 8 keeps the Rev 7 gaseous formation behavior:

- complete circles/ovals/puffs appear in bottom-to-top layers;
- each shape is full-size on its first visible frame;
- each layer fades from 0 opacity to its production target opacity;
- the upper cap appears last;
- formation completes in approximately one second;
- mechanical LOS obstruction is immediate.

Rev 8 removes the outline painted around **individual forming tufts/body ovals/caps**.

During the one-second buildup:

- Fog Cloud / Wall of Fog tufts no longer receive black per-puff outlines;
- Stinking Cloud tufts no longer receive green per-puff outlines;
- tuft fills and opacity fades are otherwise unchanged;
- the finished production **union outline** still appears once the cloud is fully assembled.

This should make the formation read as soft gaseous masses rather than individually inked bubbles.

### Retained Previewer cleanup

- No on-field Friendly Dummy.
- Creature/touch buffs preview on the caster when legal.
- No overhead Mage "M".
- No temporary Ranger/archer bow glyph.
- Every implemented Level 1–3 Wizard combat spell remains READY.
- Selecting a spell resets and automatically plays it.

### Rev 8 QA focus

1. Open **Spell Previewer [DEV]** and confirm **Candidate Rev 8** appears.
2. Select Wall of Fog and inspect the first second of formation.
3. Confirm each individual tuft/oval has **no black outline** while fading in.
4. Confirm the bottom-to-top layering and complete-shape behavior from Rev 7 remain unchanged.
5. Confirm the finished overall cloud outline still appears after formation completes.
6. Repeat with Fog Cloud.
7. Repeat with Stinking Cloud and confirm its individual green tuft outlines are also absent.
8. Confirm Stinking Cloud's green fill palette remains unchanged.
9. Confirm cloud LOS blocking still begins immediately.
10. Confirm Fog Cloud / Stinking Cloud still produce the same hidden-area LOS presentation as Wall of Fog.
11. Confirm Dispel Magic Previewer still casts and removes its prepared test magic.
12. Rapidly switch among gaseous spells and confirm no stale formation layers remain.
13. Return to Combat System Test and confirm ordinary combat behavior remains unchanged.

### Candidate lineage retained from R237

- 33% hidden LOS overlay and obscuring-volume visibility presentation.
- No loot on total party defeat.
- Ordered result beats: direct damage → rider damage → buffs → debuffs → conditions.
- White rising **Casting Interrupted** feedback and dedicated synthesized fumble SFX.
- Level 1–3 AoE AIM-footprint preview audit.
