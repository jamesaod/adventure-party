# Adventure Party R167 migration build

This is the multi-file migration of the frozen R166 standalone browser build.

Run through a local HTTP server (recommended):

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

The project code intentionally remains dependency-free. R204 currently loads the credited PamNawi stone-floor PNG from its OpenGameArt source at runtime; see the attribution file below.

## Third-party assets

See [ATTRIBUTIONS.md](ATTRIBUTIONS.md) for third-party artwork credits and license notices.


## Development channels

Adventure Party uses two long-lived development channels:

- **main** — stable, QA-approved release.
- **candidate** — integrated QA build where validated feature/fix branches land first.

Normal feature work branches from `candidate` and returns to `candidate` through a validated pull request. Candidate is promoted to `main` only at an approved milestone.

See [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md) for the full branching, QA, release, and hotfix process.

## Preserved project workflows

See [workflow/README.md](workflow/README.md) for the agreed development and sprite-import procedures, preserved skill files, and instructions for restoring them in a future session. The separate `workflow/` directory is excluded from the published game.
