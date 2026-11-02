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

## Candidate Rev 228 - door approaches and crossing

Closed doors no longer mark their entire exploration tile as a wall. Floor hexes on either side are standing spaces; the existing architectural door plane blocks crossing, and core-bisected hexes remain invalid. This fixes the hex immediately in front of a closed door without allowing wall clipping.

For player-controlled units, THROUGH DOOR [F] connects aligned legal standing hexes across an already-open doorway, skipping the intermediate NW/NE corner cells as standing destinations. Cost is two movement points. The existing full-move threshold, occupancy/footprint checks, departure reactions, landing area effects and guard reactions remain in the movement pipeline. No crossing is offered through closed doors, other walls, occupied landings or insufficient movement. Combat opening/closing of doors remains unimplemented; the command uses the exploration door snapshot. Ordinary AI pathfinding retains its normal hex steps.

## Rev 229 — exploration combat doors

**O / OPEN DOOR** opens one adjacent closed doorway for 1 movement point. **F / THROUGH DOOR** crosses an already-open doorway for 2 movement points. Both buttons show only in exploration-derived combat. Normal turn restrictions and remaining movement apply; keyboard shortcuts ignore text editing, held-key repeats and modified keys. Opening may activate Full Move if it exceeds the half-move attack threshold. Door state returns with the encounter to exploration.

## Rev 235 - ordinary doorway movement

Walk through open doors with the normal hex movement keys, at 1 movement point per adjacent step. The THROUGH DOOR button and special two-point crossing are removed. O or F operates the adjacent door: open when closed, close when open, costing 1 MP. Closing is refused while any living unit footprint occupies the leaf plane. The button label follows the current door state.

## Candidate Rev 251: starting angle and ordered result panel

Each new combat starts one counterclockwise rotation from the original view,
index 5 / -60 degrees. The compass and picking use that same azimuth. Rotation
buttons retain six 60-degree steps; labels show signed angles.

The right-hand summary temporarily shows the production action results, with
one second for each: primary hit (attacker, target, direct damage), each rider
such as fire/acid, buffs, debuffs, other conditions, then downed/dying status.
Misses also receive a result. The compass remains available; the current unit
summary returns after the final second. Combat log and floating results remain.

The existing candidate-combat-beat-sequence.js queue is shared with the panel.
Pending consequences sort by semantic category, then original insertion order.
Targets serialize globally so area attacks cannot overwrite one another in the
single panel. Simulation damage, saves and status application still resolve
normally; action progression and victory/defeat wait for presentation to finish.
A new game clears pending messages/timers and resets the angle. Beat callbacks
check game identity, and UI updates cannot replace an active result message.

Run node scripts/test-combat-result-panel.mjs for exact fake-clock boundaries,
order, multi-target serialization, death-before-victory hold, misses and cleanup.

Each next beat is timed from the actual previous presentation, so a stalled
frame cannot fast-forward several overdue messages. Studio inspection exits
remain immediate when there are no queued results; resolved Studio attacks
receive the same final presentation hold before returning.

Rev 252 completes live QA: legacy sling misses return no structured result.
The panel adapter captures the production flashAttack outcome for those paths;
structured results still take priority, and no hit/damage rules are changed.

## Rev 253: reference-style persistent combat information

This supersedes the temporary-summary behavior in Rev 251. Unit information
stays visible throughout combat. Messages append in order and remain in a
scrollable history until the battle is reset/exited; a one-second beat controls
when the next message arrives, never when the previous message disappears.

Blocks follow the supplied reference: uppercase stacked lines, cyan attacker,
green ATTACKS / HITTING FOR X / POINTS OF DAMAGE, yellow target, and a red
unit name above green GOES DOWN / AND IS DYING. Other effects/statuses append
matching blocks. Press Start 2P is self-hosted for pixel lettering, with its
OFL license and attribution bundled. Existing unit-summary typography stays.

The history follows new messages when already at the bottom. Scrolling up to
read older results keeps the reader's position. The compass remains available.

Rev 254 keeps the feed at its newest result when a change in the unit summary
resizes its viewport, while retaining the position of readers browsing above.

## Rev 255: pixel default and turn-scoped results

Press Start 2P is the default self-hosted font across game pages and editors,
including battlefield Canvas text. The result font increases from 12 to 16 px.
Pixel-aware sizes keep unit names, equipment, controls and headers within their
existing panels; the battlefield +/- preference continues to scale the text.

Result blocks remain visible during the current unit turn only. beginTurn
clears that area after previous action beats finish and before the new unit's
information is shown. The token includes round, initiative slot and actor ID,
so consecutive turns by the same unit still clear while duplicate same-turn
refreshes and temporary initiative gaps do not. Unit information stays visible.
The lower full combat log remains available for earlier events.

Reference viewed: https://www.youtube.com/watch?v=z82nvmnt1jw
AD&D Pool of Radiance Combat Scene - Low Level Party vs Trolls and Ogres,
dfortae - Game Reviews. Sampled at 1:33 (Ogre details and magic-damage text)
and 2:11 (Dain's turn, unit details retained and lower result area cleared).
The compact status/action split and per-unit message reset guide this pass;
Adventure Party retains its requested one-second sequence between consequences.


### Candidate Rev 256: result presentation

Each new attack replaces the previous attack's results when its first beat is presented, including repeated attacks by one unit. Consequences within an attack remain stacked in semantic order, one second apart. Turn boundaries still clear the panel. All unit details and results use uppercase Press Start 2P at the unit-name size (18px, 15px on narrow layouts, respecting the font scale preference).

Physical impact and secondary elemental sounds accompany their result messages. Death sound and skull are deferred until the death message; mechanics still resolve immediately. Cancelled encounters discard deferred cues. The yellow battlefield strip and visible Last Resolution/combat log are removed; message timing and hidden diagnostics remain for engine compatibility.
