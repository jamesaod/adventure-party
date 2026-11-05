# Local combat environment experiment

Not published yet. Both standalone Combat Test and exploration encounters load the same environment-action script after the existing attack/result wrappers.

- In AIM with a bow/crossbow equipped, click an empty hex to shoot. The existing ammunition, range and shots-per-round budget applies. The first wall or pane on the trajectory intercepts the shot.
- Break Window spends one attack when adjacent. Enemy AI can do the same when a window blocks its line to a hostile. Broken panes retain their frame, admit missiles, and remain impassable. Glass was already transparent to gameplay LOS/light; shattering does not reveal hidden enemies.
- Glass shatters into 24 fading shards using the existing frame scheduler. The user-selected replacement glass recording plays once per pane, respecting the sound toggle. See ATTRIBUTIONS.md and the bundled license.
- Fireball marks only the wall face exposed to its blast. Feathered soot modifies the existing wall texture in the current GPU surface pass; no shadow maps or extra render loop.
- All spell and missile targeting rejects hexes beyond intact panes before the action is committed. The pane’s own hex remains a valid environmental target. Broken panes allow targeting through the opening. Fireball also shatters exposed panes, and its immediate spillover hexes beyond each pane receive half the original roll, then their normal save for half. A unit is resolved once at its greatest exposure. Spillover does not recursively break more windows.
- Missed arrows stop at walls or fall beyond their target and remain as capped encounter-local decoration (256 maximum). Near armor deflections fall at the target.
- Firing into melee chooses the actual recipient before the attack roll, with size weighting. This can select an ally. The optional Stray arrows (test) checkbox is a separate house rule, OFF by default: at most one creature farther along the resolved missed trajectory receives a separate attack roll at −6, with ordinary armor and missile protections. It never consumes another arrow.

Environment damage is encounter-local in this experiment; it does not modify the editor source or save a campaign destruction history.

## Validation

Browser checks exercised live WebGL shader compilation and wall rendering, OGG decoding, an empty-hex arrow breaking the pane, projectile/movement parity after breakage, ammunition and shot accounting, persistent ground arrows, blast spillover/one-sided soot, adjacent breaking and the optional stray-hit path. Existing startup, edge geometry, spell-results and renderer regression checks also apply.

Wall Test now has seven windows across its north wall. Invalid window-blocked targets show a red aim outline, no area preview, an INVALID — INTACT WINDOW label, and a disabled Cast button. LOS and illumination still pass through glass.

Wall scorch correction: affected hex polygons clip the actual wall spans. There is no neighbouring-hex padding or whole-section expansion, and the shader feathers inward only. Stone soot now uses the floor’s neutral colour and 0.75 strength / 0.68–0.92 opacity modulation, retaining the masonry detail.

Wall scorch endpoint fades use the floor mask’s .88-hex radius / .52 transition width (about 0.46 hex), fading inward from the exact clipped boundary. This softens the outer wall/hex junction without expanding the blast.

Equipment rule: every humanoid uses the same catalogue-backed equipment behavior, independent of identity, faction or repository registration. Only explicit class/race eligibility rules may exclude equipment. The legacy missile sync helper no longer contains a repository/player identity gate. Carl’s bow and 20 arrows are a standalone combat-test starting loadout, not a special bow-use implementation.
