# Candidate QA Notes

Stable baseline: **R237**

## Current candidate: Rev 6

### Gaseous spell LOS audit

Candidate Rev 6 makes the LOS contract explicit for every production area effect with `type:"fog"`.

- Wall of Fog, Fog Cloud, and Stinking Cloud all use the shared obscuring-volume LOS system.
- Newly created gaseous effects explicitly receive `obscuresLOS:true` unless a future effect deliberately opts out.
- Mechanical LOS blocking begins immediately when the cloud is created.
- The cloud itself remains visible as foreground scenery even while terrain/units beyond it are hidden.
- Normal open terrain remains unaffected when no obscuring volume is active.

### Spell Previewer LOS scene correction

The Previewer contains multiple friendly observers because its dummy arena includes a caster and a friendly-fire target.

Previously, Fog Cloud and Stinking Cloud left the friendly dummy on the far side of the cloud. The party-visibility union therefore correctly used that friendly observer's clear LOS and made the terrain beyond the cloud remain visible. Wall of Fog happened to span enough of the arena to hide the same region, which made the three spells appear inconsistent.

Rev 6 keeps all friendly observers on the caster side specifically for Fog Cloud and Stinking Cloud QA. This lets the Previewer visibly demonstrate the production obscuring-volume behavior without changing party LOS rules.

### Dispel Magic Previewer correction

The old Dispel Magic setup created **Preview Fog** at the dispel center. Because fog correctly blocks LOS into its own occupied hex, the real Dispel Magic resolver rejected the cast at its normal LOS gate.

Rev 6 replaces that setup with:

- a dispellable Armor effect on a dummy, and
- a non-obscuring Preview Grease area effect.

Both remain inside the Dispel Magic test volume, so the production spell can now pass its LOS gate and visibly remove unit and area magic.

### Bottom-up gaseous formation VFX

All `type:"fog"` spell volumes now visually form **from the tactical floor upward over 1.0 second**.

The existing fog/cloud body is not replaced. Instead, the production renderer is vertically revealed:

- the lowest portions of the cloud ovals appear first near the floor;
- progressively more of the billowing puffs and side volume is revealed;
- the bright upper cap becomes visible near the end of the one-second formation;
- the black Wall/Fog Cloud outline or green Stinking Cloud outline is clipped to the same growing volume;
- after one second, the existing continuously animated cloud renderer is unchanged.

This formation is presentation-only. LOS obstruction is immediate rather than gradually increasing with the visible cloud height.

### Spell Effects Previewer — retained Rev 5 behavior

- Selecting any spell stops the current preview, resets the arena, and automatically plays the new spell.
- Every currently implemented Level 1–3 Wizard combat spell is marked **READY**.
- Magic Missile, Fireball, Sleep, Wall of Fog, and Lightning Bolt retain bespoke preview profiles.
- Other implemented spells route through their production cast resolver.
- Full Sequence, VFX Only, and SFX Only remain available.
- Caster-level, target-count, save-outcome, and presentation-mode changes automatically reset/replay.
- Production attack and save outcomes remain deterministic only inside the Previewer.

### Rev 6 QA focus

1. Open **Spell Previewer [DEV]** and confirm **Candidate Rev 6** appears in the launcher and Previewer header.
2. Select Wall of Fog and confirm the hidden-area LOS indication appears behind the wall.
3. Select Fog Cloud and confirm the cloud now blocks/reveals LOS in the same manner; targets/terrain behind it should receive the hidden overlay.
4. Select Stinking Cloud and confirm the same LOS behavior while retaining its green gaseous rendering and cough/gag presentation.
5. For all three gaseous spells, watch the first second carefully:
   - cloud volume begins at the floor;
   - ovals/puffs fill upward;
   - no fully formed upper cap appears on frame 1;
   - full normal height is reached at approximately 1 second.
6. Confirm the fog/cloud outline rises with the body rather than appearing at full height immediately.
7. Confirm the cloud continues its existing billow/drift animation after formation completes.
8. Confirm LOS blocking begins immediately even while the visible cloud is still forming.
9. Select **Dispel Magic** and confirm it now casts rather than reporting blocked LOS.
10. Confirm Dispel Magic visibly removes both the prepared unit Armor effect and the Preview Grease area effect.
11. Rapidly switch Wall of Fog → Fog Cloud → Stinking Cloud and confirm old formation timers/effects do not bleed into the new selection.
12. Test Fog Cloud and Stinking Cloud in **VFX Only** and **SFX Only** modes.
13. Enter ordinary Combat System Test and cast Wall of Fog/Fog Cloud/Stinking Cloud if available; confirm the same one-second formation occurs outside the Previewer.
14. Confirm ordinary outdoor combat with no obscuring volume still has no hidden-area overlay.
15. Confirm the Wall Test architectural LOS system is unchanged.
16. Confirm all prior Rev 5 Previewer spell-selection/autoplay behavior still works.

### Candidate lineage retained from R237

- 33% hidden LOS overlay and restored obscuring-volume LOS presentation.
- No loot on total party defeat.
- Ordered result beats: direct damage → rider damage → buffs → debuffs → conditions.
- White rising **Casting Interrupted** feedback and dedicated synthesized fumble SFX.
- Level 1–3 AoE AIM-footprint preview audit.
