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
