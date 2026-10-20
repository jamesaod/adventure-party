# Candidate QA Notes

Stable baseline: **R237**

## Current candidate: Rev 7

### Gaseous spell formation — layered complete puffs

Candidate Rev 7 replaces Rev 6's vertical clipping/wipe formation effect.

Wall of Fog, Fog Cloud, Stinking Cloud, and every other production area effect with `type:"fog"` now assemble like this:

- the lowest cloud layer appears first;
- every circle/oval/puff is drawn at its **complete final geometry** immediately when its layer starts;
- no puff is vertically cropped, scaled into view, or partially revealed;
- each newly introduced puff fades from **0 opacity** to its normal target opacity;
- successive layers are introduced from the battlefield floor upward;
- the bright upper cap is the final layer;
- each forming puff carries its own fading black outline (Fog / Wall of Fog) or green outline (Stinking Cloud);
- the finished union outline appears after the one-second formation completes;
- after one second the established continuous production fog animation is used unchanged.

Mechanical LOS obstruction remains immediate from the moment the gaseous effect is created. The layered formation is visual only.

### Spell Previewer cleanup

The extra on-field **Friendly Dummy** has been removed.

The Previewer arena now contains:

- one caster;
- the requested number of hostile dummy targets;
- the existing off-screen Preview Observer used by the renderer/system harness.

Production creature/touch buffs that previously targeted the Friendly Dummy now demonstrate on the caster when the spell legally permits that target. Haste centers its demonstration on the caster so the effect remains visible without another friendly unit.

This also makes Fog Cloud and Stinking Cloud LOS QA easier to read because there is no on-field friendly observer on the far side of an obscuring volume.

### Temporary class/role markers removed

The engine no longer overlays temporary class-identification graphics on friendly character art:

- the overhead **"M"** marker above Mage sprites is removed;
- the temporary bow glyph drawn beside Ranger/archer sprites is removed.

Unit identity should come from the eventual dedicated sprite art rather than floating class symbols.

### Retained Rev 6 fixes

- Wall of Fog, Fog Cloud, and Stinking Cloud all share the explicit `obscuresLOS:true` production contract unless a future gaseous effect deliberately opts out.
- Fog Cloud and Stinking Cloud Previewer scenes demonstrate the same obscuring-volume LOS behavior as Wall of Fog.
- Dispel Magic Previewer setup uses a dispellable Armor effect plus non-obscuring Preview Grease so the real production LOS gate permits the cast.
- Every currently implemented Level 1–3 Wizard combat spell remains READY in the Previewer.
- Selecting a spell resets the arena and automatically plays it.
- Full Sequence, VFX Only, and SFX Only remain available.

### Rev 7 QA focus

1. Open **Spell Previewer [DEV]** and confirm **Candidate Rev 7** appears in the launcher and Previewer header.
2. Confirm there is no Friendly Dummy in the arena or legend.
3. Select Armor, Protection From Evil, Invisibility, Strength, Infravision, Protection From Normal Missiles, and similar friendly creature/touch spells; confirm they visibly demonstrate on the caster.
4. Confirm the caster no longer displays an overhead "M".
5. Enter any combat/setup path that renders the temporary Ranger/archer art and confirm no bow glyph is painted beside the sprite.
6. Select Wall of Fog and closely watch the first second:
   - lowest full ovals appear first;
   - each oval is complete on its first visible frame;
   - opacity fades upward from 0 to the normal target;
   - higher puff layers appear later;
   - no vertical crop/wipe edge is visible.
7. Repeat for Fog Cloud.
8. Repeat for Stinking Cloud and confirm green puff/outline treatment remains intact.
9. Confirm the upper cap is the last layer to fade in.
10. Confirm individual forming puffs have outlines that fade with them rather than a finished full-height outline appearing immediately.
11. After one second, confirm the established continuous billow/drift animation looks unchanged.
12. Confirm LOS blocking begins immediately while the visible cloud is still assembling.
13. Confirm Fog Cloud and Stinking Cloud still produce the same hidden-area LOS presentation as Wall of Fog.
14. Confirm Dispel Magic still casts successfully and removes its prepared Preview Armor / Preview Grease test magic.
15. Rapidly switch among gaseous spells and confirm no stale puff layers or formation states bleed into the next spell.
16. Test gaseous spells in Full Sequence, VFX Only, and SFX Only.
17. Return to Combat System Test and confirm ordinary combat behavior, saves, initiative, targeting, and LOS remain unchanged.
18. Confirm no class markers reappear after returning from the Previewer.

### Candidate lineage retained from R237

- 33% hidden LOS overlay and obscuring-volume visibility presentation.
- No loot on total party defeat.
- Ordered result beats: direct damage → rider damage → buffs → debuffs → conditions.
- White rising **Casting Interrupted** feedback and dedicated synthesized fumble SFX.
- Level 1–3 AoE AIM-footprint preview audit.
