# MOB Creator and reusable humanoid pose libraries (Candidate Rev 160)

## Current Studio workflow (Rev 181)

Use Action Pose Capture for both frame assignments and model-specific sprites. Shared Pose Library is the protected editable default; new libraries copy its assignments. JSON transfers reusable references only. Complete Capture ZIP supplies sprites, equipment settings and references for repository integration. The checklist distinguishes missing/current/outdated sprites; the dropdown's assignment checks are not sprite checks. Missing physical poses use 1H Swing; Falling/Prone use 1H Ready; Magic has no physical fallback. MOBs pin their own library snapshot. See [shared action captures](SHARED_ACTION_CAPTURES.md#rev-181--library-management-and-capture-checklist) for current controls and capture isolation.

## Historical Rev 160 data ownership (superseded where noted below)

A pose library (`adventure-party.pose-library`, version 1) contains **no model, pixels, equipment or grip transforms**. It stores all 12 canonical weapon types, each with seven nullable action slots: Ready, Wind Up, Attack, Falling, Prone, Casting Wind Up and Cast. Assigned slots contain a stable animation source ID, display name and exact source time in seconds. Missing slots stay null; a different animation is never substituted.

Humanoid Small, Medium and Large are empty starter libraries, not pre-authored animations. Size is descriptive metadata; it does not change model scale, skeleton bindings or combat footprint. Reuse is conditional on a compatible humanoid rig and the same animation source. Studio keeps the recovered world-bind retargeting recipe unchanged. New rigs still require compatibility QA.

The MOB remains an existing version-1 Unit Package: identity, model ID, STR/DEX/CON/INT/WIS/CHA, typed AD&D rules, allowed weapon types and ability metadata. `references.poseLibrary` embeds a complete pinned snapshot, including library ID/revision. Replacing the shared library does not rewrite saved MOBs. Model attachment profiles and per-pose rendered equipment remain model-specific.

## Historical Rev 160 workflow (separate capture controls superseded by Rev 174)

1. Open **MOB Creator** from the title screen or MOB Catalog. Choose the model and one of the humanoid libraries. Set all six scores, hit dice/fixed HP, AC, THAC0, movement, attacks, morale, XP, size and footprint. Select every weapon type the MOB can use. Bright-light penalty and spellcasting are typed abilities; other descriptions belong in notes. Spell IDs are integration metadata and must refer to existing spells.
2. **Save MOB**, then **Open in Studio**. This opens an isolated workspace for this MOB and model; the ordinary Studio draft is untouched. Adjust grips, scale, orientation and lighting through the existing controls.
3. Choose **Weapon type to capture**, animation and timeline frame. Under **Reusable pose library**, choose **Library action pose**, then **Record current frame**. Repeat for the needed weapon types/poses. Sliced or frozen local clips resolve back to their original source animation/time, so their recipe does not depend on a local clip name.
4. **Save library** persists the reusable definitions. **Export pose library JSON** exports them independently of any model. **Use existing capture references** copies animation references from the current model workspace, never sprite pixels or loadouts. It requires the matching source animations to be loaded; ambiguous source-index-only clips cannot be made portable.
5. Return to MOB Creator. Choose the new library or **Use latest saved library**, then save the MOB to pin that revision. Existing MOB pins do not update automatically. The dropdown always offers all 12 weapon types; the table lists all seven poses. Coverage checks physical poses, plus the two casting poses for spellcasters.
6. **Save & preview model**, choose weapon type/action, and **Preview assigned pose**. This embeds the existing Studio viewer and retargeter; it is not a second renderer. An unavailable source or out-of-range time produces an explicit message. Preview reads the saved MOB/model workspace for its grips and appearance. Its writes are disabled, so it cannot overwrite the editable Studio draft.
7. In Studio, **Capture assigned pose** samples the linked recipe on this model and records six facings. Use **Export all weapon sets (ZIP)** for the existing Unit Package, sprites, per-pose loadouts/grips and pinned library. A library change marks previous captures outdated, requiring recapture. QA sheets remain visual inspection artifacts.
8. **Export MOB JSON** exports the portable stats/model/library definition. Give the MOB JSON, pose library and optional Studio ZIP to the development session for repository MOB registration and combat integration.

This first creator saves browser drafts and produces integration packages. It does **not** add browser-authored MOB definitions to live encounter factories or implement new ability mechanics. Its scoped Studio disables the legacy archetype-based Test in combat button to avoid testing a Kobold's rules under the new MOB's name. Ordinary Studio combat QA is unchanged.

## Persistence and recovery

- Authoring JSON uses `adventure-party-authoring:<site-folder>` localStorage. Candidate and stable stay separate.
- Existing Studio IndexedDB name remains unchanged for an ordinary Studio URL. MOB workspaces append `:mob:<mob-id>:<model-id>`; embedded previews have a separate `:preview:mob:<mob-id>:<model-id>` namespace, read the matching editable workspace, and do not persist writes. Pose-library-only URLs have a separate namespace too.
- Changing models opens a separate workspace. Sprite references and attachment profiles from the old model are not copied to the new model's definition. Shared pose recipes remain portable.
- Save increments the MOB/library revision. Conflicting saves from another tab are rejected instead of overwriting that tab's changes. Refresh/reopen the saved version first.
- Imports validate schema, six scores, weapon/pose IDs and numeric ranges. Conflicting imported IDs become separate drafts; existing records are preserved. MOB JSON embeds its pinned library, so it can be imported without separately importing that library.
- Browser drafts are local to the origin and browser. Export JSON/ZIP for durable handoff and backup. Quota failures explicitly prompt export. Unsaved form/library edits show a navigation warning.

## Verification

`node scripts/test-mob-authoring.mjs` checks the 12×7 matrix, exact source/time lookup, missing-source failures, sliced/frozen source mapping, six scores, independent linked snapshots, revision conflicts, candidate/stable/MOB/model/preview namespaces, portable JSON round trips and preservation of grip data in existing Unit Package exports. Run the repository validation workflow as usual. UI QA covers save/reopen, library recording and reuse across Carl and the Scale Mail Woman; retain source animation/model bytes unchanged.

Rev 160 browser verification: saved/reopened all six distinct ability scores; recorded Sword And Shield Idle at source time 0; saved and replayed the same library on Carl and the Scale Mail Woman; captured six facings; independently reopened the actual downloaded MOB JSON and 14-entry Studio ZIP to verify stats, identity, model, library and animation references. The Creator preview also inherited saved sword/shield equipment from the editable model workspace. Existing model/animation asset bytes are unchanged.


## Rev 172 shared action groups

Pose library version 2 separates three physical poses per weapon from shared Magic and Death/Prone groups. Creator preview offers both groups, and readiness counts death/prone once and magic once for spellcasters. Existing version 1 libraries and pinned MOB snapshots migrate on read; no live combat registration is created. See [Shared action captures](SHARED_ACTION_CAPTURES.md).

## Candidate Rev 182 — Unique and Template MOBs

Choose Unique for a fixed class/level and equipped primary/off-hand pair. Choose Template for separate weighted class/level, primary weapon and off-hand tables. No character class and None equipment are explicit choices. Each row has a percentage; totals above 100 are rejected. Incomplete distributions can be saved/exported as drafts, but Generate sample requires every table to total 100%. Class/level entries are mutually exclusive (not multiclass). The supported existing classes are Fighter, Mage, Cleric, Thief and Ranger, levels 1–20.

Off-hand probabilities are conditional on a free hand: a two-handed primary suppresses off-hand selection. One-handed off-hand weapons use the existing Studio eligibility list. Always has items are guaranteed carried inventory with fixed quantities, additional to equipped items. They are not automatically equipped. Combat stats and spellcasting remain explicitly authored; class selection does not derive HP, AC, THAC0 or spells.

Save/Export MOB preserves `mob.generation` version 1 in the existing Unit Package. Unique definitions contain `fixed`; templates contain `classLevels`, `primary` and `offHand` weighted arrays. Both contain `alwaysItems`. Existing definitions without generation metadata remain valid. Selected equipment adds its required weapon pose types to coverage; shared action fallbacks remain unchanged.

Generate sample resolves choices using the shared `mob-generation.mjs` module and offers a separate generated Unique MOB JSON export. A sample is not automatically saved or deployed. Changing the definition requires generating a fresh sample. Existing model pixels are removed from samples because equipment changed; reusable pose references remain. Live combat registration still follows the existing repository integration workflow, not a second encounter engine.

The verified user Shaman library is preserved verbatim in `data/pose-libraries/orc-shaman-user-r2.json`; `orc-shaman-pose-library.mjs` supplies the browser preset named Orc Shaman — supplied poses. It has ten assignments: three 1H Swing, three Wizard Staff Grip, two Magic, Falling and Prone. The preset has its own identity and never replaces Shared or saved custom libraries. This adds reusable frame references, not the export ZIP's model-specific PNGs.

Validation: `node scripts/test-mob-generation.mjs` covers probability boundaries, invalid/incomplete tables, two-hand exclusion, guaranteed inventory, Unit Package round trips and preset fidelity. Existing MOB authoring, library isolation and renderer checks remain required.
