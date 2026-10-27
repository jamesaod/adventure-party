# Battlefield controls — Candidate Rev 158

While the Combat System Test is open:

- **+** or **=** increases battlefield text size by 10 percentage points.
- **-** reduces text size by 10 percentage points.
- Keypad **+** / **-** work as well. Range: 80%–160%, default 100%.
- The header displays the current percentage and shortcut reminder. The browser remembers the size separately for candidate and stable. If storage is unavailable, controls still work for the current session.

These keys adjust battlefield canvas labels/speech/status text and the combat interface (banner, unit information, log, commands and combat overlays). They work before the first turn and while aiming, without taking a turn or changing combat rules. Text panels scroll when necessary; the action bar scrolls horizontally so larger text does not make controls unreachable.

Typing in input/select/textarea/contenteditable controls is ignored. Ctrl/Command/Alt combinations, composition events and already-handled events are left alone, preserving browser zoom. Map zoom remains on **[** and **]** and is independent of text size. No Quick Command or Escape behavior changed in this revision.

Implementation uses the existing combat key handler, a CSS scale scoped to `#combatScreen`, and a shared canvas font formatter. Pixel Editor scale-test labels and other screens keep their existing font sizes. New battlefield text should use `battlefieldTextFont(basePixels)` on the canvas or `calc(<base-size> * var(--combat-font-scale, 1))` in CSS.

Validation: `node scripts/test-battlefield-font.mjs` exercises both keyboards, upper/lower bounds, before-turn/aiming operation, CSS/canvas scale parity, storage reload/failure, and editable/modifier guards. Run repository validation, then browser QA at 80%, 100%, 130% and 160%; check panel/action-bar scrolling and unchanged turn state. Reload and re-enter combat to confirm persistence.

## Compact combat information — Rev 155

The right-hand summary shows the unit name, then **HITPOINTS** (current/max), **AC**, and **WIELDED** equipment. Hostile names are yellow; all units sharing the player's current faction are light blue, including friendly or charmed MOBs. There is no divider or target-mode heading between the name and hitpoints. Rows use tight spacing and continue to respect battlefield text scaling; long equipment names wrap within the panel. Active status effects remain below the summary.

`updateUnitInfoPanel` reuses the existing active-unit/AIM selection and line-of-sight guard. `unitWieldedEquipmentLabels` reads the current ranged/melee hand state, equipped primary weapon and equipped shield/off-hand entries, with the existing weapon/shield names as catalog-MOB fallbacks. Carried backups and armor are not included. Explicitly unequipped shields stay absent. The summary does not mutate inventory, combat rules or Unit Package data. Use current faction rather than controller/species for name color, so charm and friendly MOBs stay correct.

Reproduce with `node scripts/test-combat-info-panel.mjs`, then the repository workflow. The regression exercises row order, damaged hitpoints, allegiance changes, ranged-to-melee switches, shields, off-hand weapons, hidden AIM targets, empty initiative gaps and text-safe equipment names. Browser QA: launch Combat System Test with the Carl sprite test, start combat, inspect a yellow Kobold and light-blue Carl, and use +/- to check the compact summary at 100% and 130%. Carl should show his currently equipped sword and shield; the Kobold should show its dagger. Preserve status effects and the last valid display between initiative slots.

Rev 156 presentation adjustment: HITPOINTS and AC labels are green, with each value following its own label by one literal space rather than a shared value column. The equipment line has no WIELDED label. Damaged hitpoints keep their existing yellow highlight.

## Equipment lines and group Quick — Rev 158

Each wielded weapon, off-hand weapon or shield now occupies its own summary row. The helper returns separate names rather than splitting a joined string, preserving names such as Sword +5. HITPOINTS and AC retain their green inline labels and damaged-HP highlighting.

**Ctrl+Q** enables the existing persistent Quick behavior for all living, non-fled units currently sharing the player's faction. **Q** (or the Quick button) still controls the active player-controlled unit individually. **Escape** clears every Quick assignment and invalidates pending Quick callbacks; the first Escape stays in combat. Existing NPC/MOB controllers continue their normal AI behavior. No controller, allegiance or turn rules are changed.

Ctrl+Q uses the existing Quick availability rules: combat must have started and must not be over, in an action pause, or currently casting. It can queue friendly units while a hostile unit is active. Typing, composition, already-handled events and Alt/Meta/Shift-modified Ctrl+Q are ignored. Held-key repeats do not enqueue additional turns. Adding more units keeps any in-flight Quick turn's cancellation token valid; only cancellation invalidates it.

Reproduce with `node scripts/test-combat-info-panel.mjs` and `node scripts/test-quick-command.mjs`, then repository validation. Browser QA: start Combat System Test, check a weapon/shield loadout displays two separate equipment rows, press Ctrl+Q on a friendly turn and Escape, and confirm Quick cancels without leaving combat. The focused regression additionally covers mixed friendly player/NPC/MOB rosters, enemy/dead/fled exclusion, controller preservation, hostile-turn queuing, repeated activation and cancellation before a queued callback runs.
