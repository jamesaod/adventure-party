# Adventure Party R167 migration build

This is the multi-file migration of the frozen R166 standalone browser build.

Run through a local HTTP server (recommended):

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

The project runs as static HTML, CSS, and JavaScript without a build step. The optional 3d studio uses a locally bundled Three.js renderer. R204 currently loads the credited PamNawi stone-floor PNG from its OpenGameArt source at runtime; see the attribution file below.

## Third-party assets

See [ATTRIBUTIONS.md](ATTRIBUTIONS.md) for third-party artwork credits and license notices.

See [docs/THIRD_PARTY_3D_STUDIO.md](docs/THIRD_PARTY_3D_STUDIO.md) for the studio's renderer/loader versions and licenses.

## 3d studio

Choose **3d studio** on the title page to load a 3D model, inspect six synchronized VGA pixel views, play embedded animations, and export transparent PNGs. See [docs/3D_STUDIO.md](docs/3D_STUDIO.md) for supported files, orientation controls, rendering rules, and animation extension guidance.

Choose **Combat System Test → 6-facing Kobold → Begin Battle** to try the first exported six-direction ready sprite set in the game. See [docs/DIRECTIONAL_SPRITES.md](docs/DIRECTIONAL_SPRITES.md) for facing and ready/action pose registration.


## Development channels

Adventure Party uses two long-lived development channels:

- **main** — stable, QA-approved release.
- **candidate** — integrated QA build where validated feature/fix branches land first.

Normal feature work branches from `candidate` and returns to `candidate` through a validated pull request. Candidate is promoted to `main` only at an approved milestone.

See [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md) for the full branching, QA, release, and hotfix process.

## Preserved project workflows

See [workflow/README.md](workflow/README.md) for the agreed development and sprite-import procedures, preserved skill files, and instructions for restoring them in a future session. The separate `workflow/` directory is excluded from the published game.
