# Development Notes

## Git workflow

Git is now the authoritative project history.

### Current working file

`index.html` is the current playable build.

Do not add a new numbered HTML file for every normal iteration. Instead:

1. modify `index.html`
2. test the change
3. commit with a descriptive message
4. tag notable milestones when useful

Example commit messages:

```
Add Wall of Fog wheel rotation
Fix fog/wall depth sorting
Tune Color Spray exterior outline
```

## Release numbering

The pre-Git development line reached **R158**.

We can continue using R-numbers for meaningful milestones if useful, but individual Git commits should carry the fine-grained history.

## Testing expectations

Before promoting a meaningful combat-engine change:

- load the exact current HTML build in Chromium or another modern browser
- check for JavaScript console/page errors
- test the affected combat path in-engine
- verify previews and actual spell/attack resolution agree
- preserve ZIP/export builds only when a downloadable milestone is useful

## Architecture principles

- Keep canonical spell/unit/item data centralized.
- Reuse shared mechanics instead of implementing one-off spell behavior where a generic system is appropriate.
- Do **not** force every spell into the same area/volume model.
- Keep VFX driven by gameplay state wherever practical.
- Keep rendering depth relationships consistent across normal render, LOS masking, and final foreground repaint passes.
- Avoid revealing unseen MOB identity or position through UI side effects.

## Repository organization

```
/
├── index.html
├── README.md
├── CHANGELOG.md
├── .gitignore
└── docs/
    ├── REQUIREMENTS.md
    ├── COMBAT_RULES.md
    └── DEVELOPMENT_NOTES.md
```

As the monolithic HTML grows, a future refactor can split code into JS/CSS/assets without changing gameplay behavior. That should be treated as a controlled migration rather than mixed into unrelated mechanics work.
