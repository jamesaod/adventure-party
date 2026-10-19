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
