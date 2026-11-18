# Fast local Workshop MOB imports

Use this process for user-supplied Workshop ZIPs. The user supplies the export and performs visual QA; the agent runs the command and reports the result. No preview screenshots, remote publish, duplicate MOB, or extra confirmation is part of a normal authorized replacement.

## One command

From the game repository:

```powershell
node scripts/import-workshop-mob.mjs "C:\Users\james\Downloads\Wood-Elf-Archer-workshop (2).zip" --base-url http://127.0.0.1:8276/
```

Use the available Node executable's full path if Node is not on PATH. Resolve the installed desktop runtime rather than hard-coding its changing version. The tool needs only Node 20+ and the repository's existing dependencies. No package installation is required.

- Default: replace the existing `publishedSource.id`. For exports without it, match exactly one existing Workshop MOB by name, ignoring case and surrounding whitespace. Keep the existing library ID, encounter type, entry count and availability.
- `--id wood-elf-archer`: explicitly choose an existing replacement target. A missing ID is an error, not permission to create one.
- `--new new-mob-id`: create a new library entry only when the user requests a new MOB. Existing IDs are rejected.
- `--check`: validate and print the result without writes, backups or live-server checks. Useful for inspecting an uncertain archive; not an extra required step before a normal import.
- `--base-url URL`: verify the running game's manifest and package after import. Use the currently running local game, normally `http://127.0.0.1:8276/`. Omit for an offline import.
- `--root PATH`: target an isolated test repository, primarily for automated validation.

## What the quick path checks

1. Parse the portable archive, validate its embedded model, and hash the model bytes.
2. Resolve a unique stable identity and reject duplicate library IDs or an accidental new MOB.
3. Reuse the current project, creature, package and runtime-support validators. These cover HP modes, racial identity, inventory, equipment fits, quiver controls, animation ranges, bow timing and supported combat capabilities.
4. Instantiate low/high HP samples through the real repository combat adapter. Check HP, AC, THAC0, movement, morale, race/gender, under-one-HD classification, preserved equipment settings, and selection/timing of assigned animation slots.
5. Back up the old package, source ZIP and manifest under ignored `.local/workshop-imports/`. Check for concurrent file changes, reuse unchanged immutable model assets, and write only changed files.
6. Compare the resulting files byte-for-byte with the validated payload. Failed writes restore the previous package/source/manifest and remove any new files written by that attempt. Optional live verification checks the served identity and package.

The JSON result includes status (`checked`, `replaced`, `created`, or `unchanged`), stable ID, changed fields/files, model reuse, HP and equipment summary, backup location, live verification result and elapsed milliseconds. A repeated identical import is a no-op with no new backup. Imported content gets no artificial version suffix or extra library entry. Browser data loading already requests fresh packages; no code/cache revision is needed for content-only replacement. Refresh the game and instantiate the MOB again for the new template to take effect. An existing browser-local override remains authoritative until cleared through its normal UI; this command does not erase browser work.

Exit 0 means checks/import succeeded (live check passed if requested). Exit 1 means validation/write failure. Exit 2 means the local import succeeded but the requested live check failed; investigate the server URL or served root without repeating the import blindly. Backups include `before.json` with paths and checksums and, after success, `report.json`. Do not delete an `active.lock` while another import is running; after a crashed process, inspect its backup/current files before removing a stale lock.

## Keeping it current

Use shared validators, not a second import schema. When adding Workshop fields or changing a combat consumer, update the owning validator and feature tests in that change. Extend `scripts/workshop-import-checks.mjs` when an additional runtime handoff should be verified. Maintain `scripts/test-workshop-import.mjs` for import behavior and failure recovery; it runs in CI. Run the relevant feature tests during code development. On later ZIP-only imports, the one-command quick checks are sufficient unless a check fails or the export changes a system needing further investigation.

The checks verify data and runtime connections. They do not replace the user's visual QA of animation, placement, textures or effects. The older `publish-workshop-unit.mjs` remains available for existing callers, but routine conversational imports should use `import-workshop-mob.mjs` for identity selection, backups and verification.

## Optional armed locomotion (16 November 2026)

Workshop now accepts armed-idle and armed-move (Armed Idle / Armed Walk). Assign and preview them like normal Idle and Move; the idle animation/frozen-pose checkbox applies to both idle slots. Missing armed slots fall back to normal Idle / Move. Export/import preserves and validates the assignments. Combat switches tree haulers only after carriedTreeLog exists, and other MOBs when a weapon is equipped. Death, pushing and pickup remain separate. Existing giant assignments are preserved for user editing.

## Natural Armor Class (16 November 2026)

Protection & saving throws now offers optional naturalArmorClass (-10 through 10, lower is better). Blank preserves legacy behavior. Equipment mode chooses the lowest base/manual AC, natural AC, or worn armor AC, then combat applies Dexterity, shields and existing bonuses plus the authored AC modifier. Manual mode uses the authored manual AC override. Exports, imports and the combat adapter preserve the value; no giant stat is assigned automatically.

## Walking preview grounding (16 November 2026)

Workshop walking previews now use the same foot-contact grounding and horizontal root-travel removal as combat. Applies to Move / Armed Walk assignments, shared clips tagged move, and legacy saved walk/run names including Great Sword Walk. Correction resets between samples and before switching clips; the source tracks remain unchanged. Attack, death and other previews retain authored motion.

Combat idle performance policy (16 November 2026): normal and armed idle now hold the assigned start pose regardless of Animation mode. The authored clips and Workshop preview settings remain intact; walking and action animations still run. This avoids continuously rebuilding idle silhouettes and occluded outlines.

### Workshop learned-spell bridge and Wood Elf Mage (2026-11-17)
- Imported `wood-elf-mage` from the supplied Wood-Elf-Mage-workshop.zip with the standard importer, backed up manifest/source, and verified the served package. Authored level 2 Mage: Magic Missile and Sleep, one use each at caster level 2. Other authored stats preserved.
- `workshop-spells.mjs` validates implemented catalog spells, matching primary Mage/Cleric class, unique rows and finite learned uses. Innate and at-will rules remain explicitly unsupported; they cannot pass publication validation. No silent spell dropping or schema bypass.
- Conversion supplies separate known/prepared arrays and per-spell authored caster levels for every instance. Existing casting lifecycle owns consumption/interruption. Per-day preparations initialize with a fresh combat instance; no new campaign resting/refill rules introduced.
- Repository AI uses authored caster levels and gains faction-relative, ally-safe Sleep/Fireball area selection. Prepared-list order remains the priority. Other existing single-target/heal/self selection stays unchanged; this is not a complete tactical planner for every catalog area spell.
- Import quick checks now verify spell state survives the actual adapter. New tests cover independent copies, spent uses, unsupported admission, authored level, safe Sleep targeting, and exhaustion fallback. Import workflow test and 186/186 combat regressions passed.

### Workshop spell animation activation (2026-11-17)
- Workshop renderer already mapped casting-windup -> Cast Spell and cast -> Aim and Fire Spell, but combat never activated these poses. Pending casting records now select wind-up and carry a dedicated start time; cancellation removes the token and releases that pose. Existing death/prone priorities remain higher.
- Successful spell commitment activates the release pose for at least the authored release duration. Release clips play once even if their Workshop loop flag is enabled. If no release clip is authored, Cast Spell is the explicit fallback instead of a melee swing.
- Added tests using Wood Elf Mage's actual assignments for time progression, correct release selection, end-frame hold and death priority. Existing isolated commitSpellCast fixture now supplies the presentation dependency.
- Immediate autonomous casting also passes through an authored wind-up hold in `castPreparedCombatSpell`; scheduled records mark that phase already presented, avoiding a duplicate wind-up at completion. Hold aborts after session replacement, combat end, death or fleeing. Final full suite: 187/187 passed.
