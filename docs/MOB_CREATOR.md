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


Validation: `node scripts/test-mob-generation.mjs` covers probability boundaries, invalid/incomplete tables, two-hand exclusion, guaranteed inventory, Unit Package round trips. Existing MOB authoring, library isolation and renderer checks remain required.

## Candidate Rev 183 — corrected creator layout

New MOBs open as Templates, with weighted class/level, primary weapon and off-hand tables at the top of MOB definition. Select Unique for a fixed individual; saved Unique definitions retain their category. The 100% validation and Always has controls are unchanged.

Appearance & shared poses now contains only the library selector, library identity and an assigned-pose checklist. Each populated group lists its assigned/missing slots; 1H Swing and Death/Prone are always shown as the baseline. Green means an actual frame assignment, never a fallback or proof of rendered sprites. Empty optional groups are omitted. Changing libraries refreshes the list immediately. Model selection lives in MOB definition. The embedded preview and pose-preview controls were removed from this page; Studio remains the animation authoring surface.

The unsolicited Orc Shaman preset and its repository seed files have been removed. Existing browser-saved custom libraries and pinned MOB snapshots are preserved. No extra library is added by this correction.

## Candidate Rev 186 — supplied Orc Fighter poses

The user-authorized orc-fighter library (display name Orc, revision 1) is supplied by data/pose-libraries/orc-fighter.json and its matching browser module. Preserve all ten source/time assignments exactly, including Stabbing in 1H Swing. The existing authoring store deduplicates by ID: saved orc-fighter data takes precedence over the seed, and deletion tombstones stay honored. No alias, Shaman entry, model binding or character stats are added. Select Orc in MOB Creator to link this library.

## Candidate Rev 187 — Studio-to-MOB workflow

1. In Studio, choose the model and set model size, footprint and equipment grips.
2. Choose/create the pose library and capture the needed weapon and shared actions.
3. Export Complete Capture ZIP. New exports include references.studioAppearance version 1 in unit-package.json: modelId, modelScalePercent, hexScalePercent, footprint and library size.
4. In MOB Creator, use Import Studio ZIP / JSON. The ZIP reader extracts only root unit-package.json (bounded to 2 MB); sprites remain in the ZIP for repository integration. An extracted Unit Package JSON also works. Old Studio packages missing appearance metadata must be re-exported. Existing MOB Creator JSON remains compatible.
5. Confirm read-only model, size and footprint. Model scale is shown as Studio metadata. New MOBs have no assumed model; character fields remain disabled until a package is imported. Pose-library JSON alone only supplies frame assignments.
6. Edit MOB name, ID, species, six scores, combat stats, Unique/Template settings, equipment probabilities and abilities. Save and export MOB JSON.
7. Supply both original Complete Capture ZIP and MOB JSON for repository registration, validation, PR, candidate publication and combat QA.

Library options show display name plus stable ID; orc-fighter is labeled Orc Fighter. Saved libraries with the same ID take precedence. Conflicting JSON imports require an explicit new ID in Studio, rather than silently creating duplicates. No user libraries are deleted by label cleanup.

## Candidate Rev 188 — one library export

This supersedes Rev 187's requirement for a ZIP. Load the repository model in Studio, choose the library, adjust size/footprint/equipment and capture required poses. Under Library settings click Export Library for MOB Creator. The single pose-library.json includes optional versioned studioAppearance metadata: model ID, model/hex scale, footprint, current equipment/shield/off-hand settings, recolor and captured per-pose equipment adjustments. Its source-frame assignments remain reusable; PNGs are not included. Export saves this enriched library in the existing authoring store.

In MOB Creator import that one JSON, or select its saved library on the same site. The appearance panel lists resolved model label/file, scales, footprint, humanoid size and whether equipment adjustments were supplied, followed by the pose checklist. Character fields unlock when the library supplies appearance. Older pose-only libraries remain readable but require a new Studio export before creating a linked MOB. Existing Unit Package/ZIP imports remain supported. Equal/newer revisions update the existing library ID; older conflicting imports are rejected. No duplicate alias is generated.

Finish stats, abilities and equipment probabilities, then export MOB JSON for repository integration. Complete Capture ZIP remains optional for handing off pre-rendered PNGs; it is not required to import a library into MOB Creator.

## Candidate Rev 189 — repository Orc template in combat

`data/mobs/orc-male-uniformed.unit-package.json` is the supplied MOB Creator export, with the user's approved None 50% off-hand row added. The ordinary Orc factory now uses this template; Orc Leader and Orc Shaman remain unchanged. Fighter levels 1/2/3 roll at 75/20/5%, battle axe/short sword at 50/50%, shield/empty at 50/50%. Stale preview equipment in the package does not override the generation table.

`repository-mobs.mjs` adapts the package to existing inventory, rules and offscreen sprite generation. Startup loads the package before enabling combat. Pinned animation/frame references, shared death/prone, 1H fallback, captured camera/light settings, model scale 140%, hex scale 109%, and model-specific catalog grips drive the existing renderer. Runtime pixels are regenerated for the actual sampled equipment; the JSON's external PNG paths are not required. Identical Orc appearances share the appearance cache.

Class levels are currently metadata: the authored 1d8 HP, THAC0 20 and other explicit rules remain in effect regardless of rolled level. Fighter-derived HP/THAC0 progression is deferred to the user's next change. Shield protection uses the existing equipment rules. Future package imports should extend this adapter/registration path rather than implement a renderer or duplicate generation logic. The current adapter requires a captured camera in spriteSets; a library-only package still needs that framing integration before this path is universal.

Validation: test-repository-mobs checks weighted boundaries, actual equipment, pinned pose fallback, scale and grips; existing footprint tests execute the actual Orc factory.

## Candidate Rev 190 — class-derived combatants and spell preparation

New MOBs default to Calculate from class and level. Fighter/Ranger, Mage, Cleric and Thief levels 1–20 derive hit dice, rolled HP with Constitution adjustment, post-hit-dice fixed gains, THAC0, saving throws and attack rate. Existing packages without the classRules flag retain authored HP/THAC0/attack rates; the registered Orc template explicitly opts into class rules. Authored values and individual HP/THAC0/attack overrides remain available. No-class creatures use authored values. AC/movement remain authored with existing equipment protection; selecting a class does not invent armor or change supplied equipment choices.

Mage and Cleric preparation each offer exact prepared copies or a weighted spell pool. Exact copies must fit every possible caster level in the template. Pools fill each available spell level independently, ignore choices above that caster's eligibility, and leave levels without choices empty. Mage Intelligence limits and Cleric Wisdom bonuses follow existing engine tables. Spell choices are the implemented base Wizard catalog plus implemented Priest spells, not an assertion that every AD&D spell is available. Slots for unimplemented/unselected spells remain empty. Ranger priest spell preparation is not added by this change.

Generate sample uses the same class calculator as repository spawns, displays rolled HP/THAC0/prepared count and exports a fixed individual. Its rolls and spell copies are independent from the template and other generated MOBs. Templates continue rolling separately per spawn. Explicit stats source, overrides and spellPreparation survive import/export. The old caster-ID text box is replaced by spell selectors.

Runtime sets stats, saves, knownSpellIds, memorizedSpellIds/memorizedPriestSpellIds and spellSlots on each generated combatant. Existing spell resolvers consume a prepared copy at commitment. Repository caster AI can select self spells, healing and single-target hostile spells using allegiance/range/LOS; complex area/directional spells remain controllable through the existing player targeting UI. Generated fractional attack rates alternate by round, including monster-controlled melee turns. No exploration spawning, encounter triggers or expanded area-spell AI is implemented here.

The reusable mob-class-rules module derives from the engine's existing class/catalog declarations; parity tests prevent changes to one copy without the other. Update both when changing these rules. Tests cover levels 1–20, Constitution caps, hit-dice caps, THAC0, saves, attack rates, slot/eligibility rejection, weighted pools, independent resources and persistence. The repository adapter continues to require captured camera metadata for model rendering; class calculation itself is model-independent.

## Candidate Rev 200 — refreshed Orc Fighter library

Replaces the existing `orc-fighter` seed with the user export revision 22, enriched to revision 23. Source archive is retained byte-for-byte at `assets/pose-libraries/orc-fighter/source-r22.zip`; provenance is in `data/pose-libraries/orc-fighter-import.json`. All 13 original frame assignments remain exact. At user request, the three Bayonet Stab references and captured equipment settings are copied from 2H Stab to 1H Stab, without removing 2H Stab. There are now 16 assigned references. The original ZIP contains eight complete six-facing captures and five Staff/Magic reference-only poses. Do not label the latter as captured sprites.

The library carries Male Orc appearance metadata from the package: model scale 150%, hex scale 109%, single footprint, and per-pose equipment/shield settings. It can be loaded directly by MOB Creator. No duplicate ID/alias is added. Saved browser libraries still take precedence; to replace a local draft explicitly, import the updated `data/pose-libraries/orc-fighter.json` in MOB Creator/Studio after exporting any desired local edits. Existing pinned MOB definitions and live combat roster are not silently updated.
