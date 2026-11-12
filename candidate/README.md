# Adventure Party R238

R238 is the stable milestone promoted from Candidate Rev 48. It includes the six-direction 3d studio, animated pose capture and sprite-set import, expanded creature artwork, and the accumulated spell preview, effects and audio work. See [CHANGELOG.md](CHANGELOG.md) for release notes.

Run through a local HTTP server (recommended):

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

The project runs as static HTML, CSS, and JavaScript without a build step. The optional 3d studio uses a locally bundled Three.js renderer. R204 currently loads the credited PamNawi stone-floor PNG from its OpenGameArt source at runtime; see the attribution file below.

## Third-party assets

See [ATTRIBUTIONS.md](ATTRIBUTIONS.md) for third-party artwork credits and license notices.

See [docs/THIRD_PARTY_3D_STUDIO.md](docs/THIRD_PARTY_3D_STUDIO.md) for the studio's renderer/loader versions and licenses.

## Candidate Rev 109 model QA

Open [Candidate 3d studio](https://jamesaod.github.io/adventure-party/candidate/3d-studio.html) and use **Model library → Load selected model** to load **New Carl — Original Tripo**, **New Orc — Original Tripo**, or **New Carl — Offline Sword & Shield Attack QA** directly from the repository. No local ZIP upload is needed. The first two are animationless originals; the last contains a single offline-baked Mixamo attack pending visual QA. See [Rev 109 QA instructions](docs/REV109_NEW_MODELS_PENDING_ASSETS.md) and [the permanent offline bake runbook](docs/TRIPO_MIXAMO_ANIMATION_BAKE.md).

## Candidate Rev 116 Blender two-turn corrective QA

The **New Orc — Blender-Corrected Turns (2 Clips QA)** entry in [Candidate 3D Studio](https://jamesaod.github.io/adventure-party/candidate/3d-studio.html) plays two exported Blender turning actions using a repaired pelvis yaw and limited skin-weight corrections. The raw Orc, all 17 experimental animations, and stable main are preserved. This remains a two-clip QA experiment; residual skin stretch is documented. See [Blender humanoid import/retarget workflow](docs/BLENDER_HUMANOID_ASSET_PIPELINE.md) and [provenance manifest](data/blender-orc-turn-qa.json).

## Candidate Rev 113 Orc anatomical full animation QA

In the [Candidate 3D Studio](https://jamesaod.github.io/adventure-party/candidate/3d-studio.html), choose **New Orc — Bone Direction + Hip Motion / All 17 (QA)** from Model Library. The viewer starts with quiet `Mixamo_sword_and_shield_idle`; inspect `block_idle`, `block`, and all remaining 14 clips using the Animation menu. The Rev 112 one-animation proof and original uploaded GLBs remain untouched. Reproducible biped procedure: [Anatomical biped retarget workflow](docs/ANATOMICAL_BIPED_RETARGET_WORKFLOW.md). Visual QA of all 17 remains pending.

## 3d studio

Choose **3d studio** on the title page to load a 3D model, inspect six synchronized VGA pixel views, play embedded animations, and export transparent PNGs. See [docs/3D_STUDIO.md](docs/3D_STUDIO.md) for supported files, orientation controls, rendering rules, and animation extension guidance.

Choose **Combat System Test → 6-facing Kobold → Begin Battle** to try the first exported six-direction ready sprite set in the game. See [docs/DIRECTIONAL_SPRITES.md](docs/DIRECTIONAL_SPRITES.md) for facing and ready/action pose registration.

## Units and assets

See [docs/UNIT_ASSETS.md](docs/UNIT_ASSETS.md) for the current unit roster, assigned sprite files, pose and facing coverage, footprints, saved 3D models, and equipment. It also identifies the runtime catalogs that control those assignments. Carl's imported six-direction, three-pose set is explicitly assigned to the normal Fighter player.


## Development channels

Adventure Party uses two long-lived development channels:

- **main** — stable, QA-approved release.
- **candidate** — integrated QA build where validated feature/fix branches land first.

Normal feature work branches from `candidate` and returns to `candidate` through a validated pull request. Candidate is promoted to `main` only at an approved milestone.

See [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md) for the full branching, QA, release, and hotfix process.

## Preserved project workflows

See [workflow/README.md](workflow/README.md) for the agreed development and sprite-import procedures, preserved skill files, and instructions for restoring them in a future session. The separate `workflow/` directory is excluded from the published game.
