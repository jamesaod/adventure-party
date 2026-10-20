# Candidate QA Notes

Stable baseline: **R237**

## Current candidate: Rev 9

### Gaseous spell formation — evolving total outline

Candidate Rev 9 keeps the Rev 8 cloud construction model:

- complete circles/ovals/puffs appear from bottom to top;
- each shape is full-size on first appearance;
- each layer fades from 0 opacity to its target opacity;
- individual tufts have **no per-puff outline**;
- LOS obstruction is immediate.

The new Rev 9 pass adds **one outline around the totality of the visible gaseous mass while the cloud is still building**.

During the one-second formation:

- the outline follows only the cloud shapes/layers that have appeared so far;
- it expands upward as higher layers fade in;
- it does not reveal the final full-height silhouette on frame one;
- overlapping puffs are treated as one combined silhouette rather than separately outlined bubbles;
- Fog Cloud / Wall of Fog use a dark overall outline;
- Stinking Cloud uses a green overall outline;
- the formation outline inherits the fade state of the visible cloud mass.

After formation completes, the existing finished production union outline takes over.

### Retained Previewer / spell fixes

- No on-field Friendly Dummy.
- Touch/creature buffs preview on the caster when legal.
- No overhead Mage "M".
- No Ranger/archer bow glyph.
- Fog Cloud, Stinking Cloud, and Wall of Fog use the same obscuring LOS contract.
- Dispel Magic Previewer uses visible non-obscuring test magic and still passes its normal LOS gate.
- Every implemented Level 1–3 Wizard combat spell remains READY and autoplays when selected.

### Rev 9 QA focus

1. Open **Spell Previewer [DEV]** and confirm **Candidate Rev 9** appears.
2. Select Wall of Fog.
3. During the first second, confirm individual tufts remain soft and unoutlined.
4. Confirm one combined dark outline appears around the total visible cloud mass.
5. Confirm the combined outline starts low and expands upward as new layers appear.
6. Confirm the final full-height silhouette is **not** visible immediately.
7. Confirm overlapping puffs merge into one exterior silhouette without interior bubble outlines.
8. Confirm the formation outline fades/grows naturally with the cloud rather than popping fully opaque.
9. After one second, confirm the established finished union outline takes over cleanly.
10. Repeat all outline checks for Fog Cloud.
11. Repeat for Stinking Cloud and confirm the overall outline is green.
12. Confirm Stinking Cloud individual tufts themselves still have no green per-puff outlines.
13. Confirm LOS blocking remains immediate throughout formation.
14. Rapidly switch among Wall of Fog, Fog Cloud, and Stinking Cloud and confirm no old outline mask persists.
15. Confirm Dispel Magic still casts successfully in the Previewer.
16. Return to Combat System Test and confirm normal combat and LOS behavior remain unchanged.

### Candidate lineage retained from R237

- 33% hidden LOS overlay and obscuring-volume visibility presentation.
- No loot on total party defeat.
- Ordered result beats: direct damage → rider damage → buffs → debuffs → conditions.
- White rising **Casting Interrupted** feedback and dedicated synthesized fumble SFX.
- Level 1–3 AoE AIM-footprint preview audit.
