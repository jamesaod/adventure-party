# Adventure Party Development Workflow

Adventure Party uses a stable/candidate workflow.

## Branch roles

- `main` — stable, QA-approved release code only.
- `candidate` — integrated development build used for player QA.
- `feature/*` and `fix/*` — short-lived branches for one change or cohesive change set.
- `gh-pages` — generated publishing branch. Do not edit manually.

## Normal development flow

1. Start a `feature/*` or `fix/*` branch from `candidate`.
2. Implement the change.
3. Open a pull request targeting `candidate`.
4. Require **Adventure Party Validation** to pass.
5. Merge the PR into `candidate`.
6. The Pages publisher refreshes the candidate QA site automatically.
7. Perform QA on the candidate build.
8. Additional fixes/features repeat the same cycle.

Small candidate changes do **not** require a new formal R-number release.

## Milestone release flow

When candidate reaches an approved milestone:

1. Open one pull request from `candidate` to `main`.
2. Review the accumulated candidate diff and release notes.
3. Require **Adventure Party Validation** to pass.
4. Update formal release/cache metadata to the next R-number as part of that milestone PR.
5. Merge into `main`.
6. Fast-forward/reset `candidate` to the new `main` head so both branches share the same release baseline.
7. Continue development from the refreshed `candidate`.

## Stable hotfix flow

For a severe production-only issue:

1. Branch `hotfix/*` from `main`.
2. Validate and merge the hotfix to `main`.
3. Merge or fast-forward the same fix into `candidate`.
4. Republish both sites.

## QA URLs

Once GitHub Pages is configured to publish the generated `gh-pages` branch from its root:

- Stable: `https://jamesaod.github.io/adventure-party/`
- Candidate QA: `https://jamesaod.github.io/adventure-party/candidate/`

The publishing workflow copies `main` to the site root and `candidate` to the `candidate/` subdirectory.

## Spell Previewer parity rule

The Spell Effects Previewer is a **production harness**, not a second game engine.

- Implemented spells should use the same production resolver in battlefield combat and in the Previewer.
- The Previewer may control scene setup, target placement, deterministic rolls, VFX/SFX visibility, and observation timing.
- The Previewer must not duplicate spell mechanics, projectile/explosion sequencing, damage application, status rules, or spell-specific audio selection.
- A bespoke Previewer profile is allowed only when it is instrumentation around shared production functions, not an alternate implementation.
- Fireball and Magic Missile are CI-enforced examples: standalone Previewer implementations for either spell fail repository validation.

This rule prevents a spell from looking or behaving correctly in the Previewer while running different code in combat.

## Validation

The **Adventure Party Validation** workflow runs for:

- pull requests targeting `main`
- pull requests targeting `candidate`
- pushes to `main`
- pushes to `candidate`

The existing R-number validator remains useful for formal release branches named like `r237-...`. Ordinary feature/fix branches are not forced to create a new R-number.

## Reproducible equipment import

Use the canonical item catalog and shared Studio equipment registry; preserve source provenance, runtime checksum, grip, axis, scale and attachment offsets. [Spear integration](SPEAR_INTEGRATION.md) records the Rev 138 FBX reduction / 512px PBR / GLB process and verified local-file-to-GitHub-connector binary transfer. On Windows clone with `core.autocrlf=false` to preserve ASCII FBX and imported-package hashes. Validate the exact published asset after the candidate publisher completes.

Studio model offerings are controlled by `studioModelIds` in the model catalog; keep historical source records needed by combat separate from the selector. The Rev 139 section of [3D Studio](3D_STUDIO.md) documents Carl Ver 3 and its uploaded-FBX-only animation policy.

For Carl animation imports, follow the [recovered Carl recipe](CARL_ANIMATION_RECIPE.md). Do not use the shared retargeter's default as a rig compatibility decision. The restored offline FBX parser and independent pose fixtures make the original method reproducible and guard against the Rev 139 distortion.

For optimized textured assets, inspect decoded color values as well as embedded images, dimensions and hashes. The Rev 141 section of [Spear integration](SPEAR_INTEGRATION.md) documents the Blender sRGB export correction, image regression and checksum-based cache refresh without resetting grip settings.

[Recurve bow preparation](RECURVE_BOW_ASSET.md) documents lossless removal of separate prop objects, preservation of morph targets, and 512px texture resampling with source-color checks. It also records the catalog-selected attachment hand, preserved adjustable grip settings, and a shared opaque-material override required for the bow in the six-facing atlas.

[Crossbow integration](CROSSBOW_INTEGRATION.md) records nested-archive extraction, per-part geometry reduction, pre-encoded 512px PBR textures, normalized forward/up axes, and direct-fire profile selection through the existing equipment system. Preserve authored ranged support-arm poses instead of applying melee body IK.

[Staff, short sword and dagger batch](EQUIPMENT_BATCH_144.md) records manifest-driven FBX/glTF imports, under-10K triangle checks, color-preserving 512px textures, source attribution, and shared melee equipment registration. Set glTF imports to XYZ rotation mode before assigning Euler normalization; apply transforms so custom normals remain aligned. The Blender 5.1 FBX presentation-light workaround is local to the importer script.

## Candidate Rev 145 follow-up

[Wizard Staff Grip and blade visibility](WIZARD_STAFF_AND_BLADE_VISIBILITY.md) records the dedicated one-handed staff equipment/action profile and the short sword/dagger material adaptation. Blade texture pixels and geometry remain unchanged; current sizes/hashes and reproducible export settings are in the follow-up. Keep the original two-handed staff behavior and source-color regression checks.

## Candidate Rev 146 sling

[Sling integration](SLING_INTEGRATION.md) documents the checksum-pinned Grab3D download, deterministic hanging-shape deformation, 512px color-preserving textures and model-specific over-shoulder preview. Reuse the shared equipment system and existing Slings/Goalie Throw association. The static prop follows the hand; it does not simulate or release the rope/stone.

## Multi-weapon Studio captures (Candidate Rev 149)

Use the existing action-profile capture map and shared equipment attachment manager for multi-weapon work. Preserve stable animation IDs and each captured pose's full loadout, including off-hand adjustments. Export all fresh profile groups under distinct ZIP directories and reference them through the existing Unit Package schema. Do not flatten all profiles into the currently selected weapon or introduce a separate renderer. [3D Studio](3D_STUDIO.md#candidate-rev-149--compact-setup-weapon-capture-sets-and-off-hand-gear) documents selection, exclusions, persistence, export structure and verification.

## Casting capture datasets (Candidate Rev 153)

Use the same per-weapon capture maps and Unit Package export for `casting-windup` and `cast`. Preserve existing physical attack rows and older manifest layouts. [3D Studio](3D_STUDIO.md#candidate-rev-153--casting-captures-in-every-weapon-set) documents the seven-slot workflow, export keys, compatibility and QA checks. Casting frame selection remains in Studio; spell timing and mechanics remain in Engine QA.

## Battlefield text controls (Candidate Rev 154)

[Battlefield controls](BATTLEFIELD_CONTROLS.md) records font shortcut behavior, scoped persistence, layout handling and validation. Keep presentation scaling independent of map zoom, input editing and combat turn state.


## Candidate Rev 160 — reusable pose libraries and MOB Creator

See [MOB Creator](MOB_CREATOR.md) for six-score MOB definitions, separate model/library selection, all-weapon action recipes, pinned library revisions, isolated Studio workspaces, and the JSON/ZIP integration workflow. Reuse the existing renderer, retargeter, captures and Unit Package schema. Browser drafts are authoring data; live combat registration remains a repository integration step.


## Candidate Rev 161 — Male Orc import

[Male Orc model](MALE_ORC_MODEL.md) records the source hashes, preserved texture/topology, armature-scale normalization and independent animation acceptance. Add new model identities to the shared Studio catalog and selector without replacing archived models or changing their combat fallback order. MOB Creator automatically uses the same offerings.

## Rev 162: per-model grip corrections

For user-calibrated weapon offsets, extend `data/studio-models.json` attachment profiles and opt in the model by stable ID. Use `weaponAttachmentProfileIds` with explicit weapon lists for multiple grip groups. Keep global weapon presets unchanged; selection and Reset grip reuse Studio's existing resolver. Normalize the global preset first before applying model vectors, preserving its preset revision. See [Orc grip reproduction](MALE_ORC_MODEL.md#rev-162-model-specific-grip-defaults). Preserve saved custom adjustments and recapture explicitly after resetting a grip. A display rename must not rename model IDs, paths or package references.

## Candidate Rev 163 — reusing a calibrated model family

[Orc Leader model](ORC_LEADER_MODEL.md) follows the established Male Orc importer, including unit-scale bones and original encoded texture preservation. Append the new catalog identity without changing the historical fallback order. Reference the same attachment profile IDs to reuse approved calibrations; add new family corrections (such as the spear) to every intended model's list. Generate an independent animation reference for each new rig and run the existing 22-clip acceptance test. Model-specific saved custom grips still take precedence until Reset grip is used.


## Candidate Rev 165 — selected-model combat testing

[Studio combat test](STUDIO_COMBAT_TEST.md) records the single controlled model handoff, configurable opponent roster and exact workspace round trip. Reuse existing MOB factories, player turn handling, footprint deployment and sprite manifests. Keep model identity independent of allegiance, preserve scoped IndexedDB keys, and guard Fighter-only equipment/class logic when a monster is the test player.


## Candidate Rev 166 — time-of-day shadows

[Unit sun shadows](UNIT_SUN_SHADOWS.md) documents the Time of day controls, shared sun projection, separate ground pass, persistence and QA. Shadow direction/length change dynamically without changing material lighting or invalidating captured poses. Keep exported character artwork shadow-free so it can be reused at every hour.


## Candidate Rev 167 — shadow foot contact

[Unit sun shadows](UNIT_SUN_SHADOWS.md#foot-contact-correction-rev-167) records alpha-based foot-contact fitting, the shared Studio/combat projection and 45% daytime opacity. Fix presentation contact without moving the unit pivot or rewriting captured PNGs.

## Candidate Rev 168 — noon and connected-leg contacts

[Unit sun shadows](UNIT_SUN_SHADOWS.md) now uses fixed noon in Studio and combat. Do not restore previous query, local-storage or workspace hours; the sliders have been removed. Adaptive alpha separation fixes the missed boot when the legs connect below the original cut. Reproduce with the checked-in Orc silhouette fixture and verify both contacts through the shared projection without rewriting captures.

## Candidate Rev 169 — geometry projected onto the floor

[Unit sun shadows](UNIT_SUN_SHADOWS.md) documents the shared world-space floor projection for standing and death poses. Reuse the existing WebGL renderer and camera, preserve the body atlas before the shadow pass, and keep shadow sidecars separate in the atomic Studio combat draft. Do not reintroduce foot-line height inference for posed 3D models. Validate full-resolution combat image association as well as native shadow dimensions.


## Candidate Rev 170 — equipment refresh and animation library parity

[Studio combat testing](STUDIO_COMBAT_TEST.md#equipment-refresh-across-uploaded-humanoids-rev-170) records the source-only GLB failure and its regression coverage. Equipment regeneration must honor the catalog's `animationLibrary` through the appearance recipe, using the same shared FBX retargeter as Studio for every opted-in humanoid. Preserve paired workspace scope, captured poses/frames, footprint and asynchronous stale-render guards.


## Candidate Rev 171 — required script startup

[Game startup](GAME_STARTUP.md) documents ordered script loading, safe download retries and the missing-radius-invisibility regression. Add engine files to the existing inert manifest in dependency order; the shared loader executes each once and keeps combat unavailable on a failed prerequisite. Preserve the normal shared classic scope, module-last handoff and delayed Studio draft timeout.


## Candidate Rev 172 — shared action captures

[Shared action captures](SHARED_ACTION_CAPTURES.md) supersedes Rev 153 per-weapon casting/death guidance. Keep physical weapon recipes separate from Magic and Death/Prone, migrate older libraries/workspaces without losing alternative frames, and use versioned shared-group references in exports. Combat test assembles physical and shared groups using the existing renderer.


## Candidate Rev 173 — lossless capture handoff

Each pose owns its captured equipment settings. Preserve those snapshots when adjusting another pose. ZIPs include outdated pixels and source references under recovery/ instead of silently filtering them. Check both current manifests and references.captureRecovery during an asset handoff. See [Shared action captures](SHARED_ACTION_CAPTURES.md#rev-173--preserve-pose-snapshots-and-recover-excluded-exports).


## Candidate Rev 174 — unified action capture

Use the single Action Pose Capture panel for sprite and reusable-frame authoring. Capture automatically saves both; one action ZIP contains pose-library.json plus Unit Package/current/recovery data. Preserve the portable source-frame conversion and separate model-specific grip snapshots. See [Shared action captures](SHARED_ACTION_CAPTURES.md#rev-174--one-action-pose-capture-workflow).


## Candidate Rev 176 — Studio batch and female Orc shaman

[Female Orc shaman](ORC_FEMALE_SHAMAN_MODEL.md) records the preserved 512px model import, neutral export joint, 22-clip acceptance, world-axis grip editor conversion and catalog material brightness overrides. [Shared captures](SHARED_ACTION_CAPTURES.md#rev-176--assignment-checks-magic-and-explicit-fallbacks) records assigned-reference checks, the supplied pose preset and the new fallback contract. Keep saved bone-local mounts and model-specific pixels separate from reusable animation frames.

## Candidate Rev 177

Staff Pose is an explicitly opted-in posed-skeleton animation; see [Carl animation recipe](CARL_ANIMATION_RECIPE.md#staff-pose-proof-of-concept--candidate-rev-177). Keep the other animation recipes unchanged. Combat return must preserve full scoped captures, including groups other than the active selection; see [shared captures](SHARED_ACTION_CAPTURES.md#combat-return-preservation--candidate-rev-177).

## Candidate Rev 178 — Axe Stance correction

Rev 177 Staff Pose direction retargeting is superseded by the with-skin neutral-bind source and time-aligned FBX axis curves. Preserve the stable source ID and all earlier animation recipes. Reproduction, model import, independent Blender validation and capture recovery: [Orc Shaman V2 and Axe Stance](ORC_FEMALE_SHAMAN_V2_MODEL.md).

## Candidate Rev 181

Library management, protected Shared default, per-library capture banks, checklist semantics and JSON/ZIP boundaries are documented in [shared action captures](SHARED_ACTION_CAPTURES.md#rev-181--library-management-and-capture-checklist).

## Candidate Rev 182

[Unique and Template MOBs](MOB_CREATOR.md#candidate-rev-182--unique-and-template-mobs) documents weighted generation, explicit combat stats, guaranteed inventory, sample exports and the supplied Shaman pose preset. Keep generation metadata in the existing Unit Package and reuse the canonical item catalog.

## Candidate Rev 183

See [corrected MOB Creator layout](MOB_CREATOR.md#candidate-rev-183--corrected-creator-layout): visible Template probability tables, library-only checklist panel and removal of the unsolicited Shaman seed. Preserve saved user libraries.

## Candidate Rev 184

[Combat scale handoff](STUDIO_COMBAT_TEST.md#rev-184--delayed-ordinary-combat-scale-replacement) records the fallback body/camera calibration correction. Preserve explicit Studio placement and apply model/hex scale only once.

## Candidate Rev 185

[Editable library IDs](SHARED_ACTION_CAPTURES.md#rev-185--editable-library-ids) uses explicit save-as-copy semantics to preserve pinned MOB references and original capture banks. Never silently rename Shared or overwrite another library.

## Candidate Rev 187

[Studio-to-MOB workflow](MOB_CREATOR.md#candidate-rev-187--studio-to-mob-workflow) makes Studio appearance metadata authoritative and adds bounded ZIP metadata import. Do not infer a model from a pose-library name or default to Carl.

## Candidate Rev 188

[One library export](MOB_CREATOR.md#candidate-rev-188--one-library-export) supersedes Rev 187 ZIP-only appearance handoff. Optional studioAppearance belongs to the library envelope; individual pose samples remain animation references only.

## Candidate Rev 190

MOB Creator and repository spawns share class generation and spell preparation. See [class-derived combatants](MOB_CREATOR.md#candidate-rev-190--class-derived-combatants-and-spell-preparation). Preserve explicit authored overrides and run the class-rule parity tests when editing engine class tables or the base spell catalog.

## Candidate Rev 193 — weapon shaft roll

Studio Adjust grip includes a relative Roll around shaft slider (-180 to 180 degrees). It post-multiplies the existing grip quaternion by an axis-angle rotation around the weapon catalog primaryAxis, then stores ordinary XYZ Euler rotation. No asset or export schema migration is needed. Zero rebases on model/weapon selection, restored rotations, manual XYZ edits and Reset grip; it is an editing reference, not an additional saved transform. Position and animation time remain unchanged. New imports must define a nonzero primaryAxis along their length. Verify shaft direction invariance and round-trip saves with scripts/test-weapon-shaft-roll.mjs.

## Candidate Rev 194 — persistent grip calibration

Supersedes Rev 193 relative roll. Equipment stores base `rotation` (XYZ degrees) plus `shaftRollDegrees`; the shared Studio/combat attachment composes base quaternion times local primaryAxis roll. Missing roll means zero, preserving every legacy grip exactly, including Rev 193 baked rotations. XYZ and position edits preserve roll; Reset grip uses model/catalog defaults. Workspace, capture/export and combat mounts retain the independent value. Copy grip settings produces versioned JSON identifying model and weapon, size, exact hand-local position, base XYZ and shaft roll; use these settings for reproducible catalog defaults, not displayed world XYZ (which depends on pose and scale). Clipboard failure exposes selectable JSON instead. No user screenshot defaults were applied.

## Candidate Rev 196

[Weapon batch](EQUIPMENT_BATCH_196.md) records the nine 256px, under-5K-triangle imports, nested archives, ASCII FBX handling, normalized shaft axes, preserved color, permissions and stable-ID display renames. Reuse shared catalog/capture/attachment paths.

## Candidate Rev 197

[Equipment Library](EQUIPMENT_LIBRARY.md) describes item inheritance, optional existing models, independent unique/enchantment metadata, structured effect definitions, browser storage and portable equipment snapshots in MOB exports. Preserve the canonical catalog and shared renderer; pending weapon grip/scale adjustments are separate.

## Candidate Rev 198

[Shield, Orc](SHIELD_ORC.md) records atlas extraction and shared shield registration. Published equipment is shared across Library, MOB Creator and Studio registrations. Browser-local item variants currently feed MOB Creator, not Studio presets.

## MOB authoring and encounter integration

See [MOB library](MOB_LIBRARY.md) for Studio → sheet → combat, local saves versus publication, height calibration and manifest registration.
