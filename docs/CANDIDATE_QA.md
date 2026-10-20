# Candidate QA Notes

Stable baseline: **R236**

## Current candidate changes

### Outdoor LOS visibility indication

- Restores the outdoor LOS blackout that was accidentally disabled when R234 replaced the generalized R217 mask.
- Mechanical LOS behavior is unchanged.
- Architecture, Wall of Fog, Stinking Cloud, Darkness, and other registered obscuring LOS volumes use the same binary tactical-hex visibility presentation.
- A visible hex center reveals the complete hex.
- An unseen hex center renders the complete hex as a hidden tile.
- Open outdoor terrain with no active obscuring volume is unchanged.
- Fog/cloud VFX remain visible in the foreground while terrain and units behind them are visibly obscured.

### QA focus

- Cast Wall of Fog outdoors and confirm terrain behind the wall becomes visibly hidden.
- Cast Stinking Cloud outdoors and confirm terrain behind the cloud becomes visibly hidden.
- Move around either cloud and confirm hidden/visible hexes change as party sight lines change.
- Confirm enemies behind an obscuring volume remain hidden.
- Confirm the cloud itself remains visible rather than disappearing into the blackout.
- Confirm ordinary outdoor combat with no obscuring spell has no blackout.
- Recheck Wall Test rooms/windows/doors to ensure the R234 no-partial-hex fix remains intact.


### Party wipe loot suppression

- A total party defeat now produces no recoverable loot.
- Enemy slain/fled counts still appear in the post-combat summary.
- The loot panel should read: `No loot recovered — the party was defeated.`
- Victory loot behavior is unchanged.

QA checks:
- Kill all player-party members while at least one enemy is carrying equipment and confirm no loot is listed.
- Confirm XP remains 0 on defeat.
- Win a battle afterward and confirm normal enemy equipment still appears as loot.
