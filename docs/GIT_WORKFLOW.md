# Git Workflow

Adventure Party now uses Git as the authoritative development history.

## Main branch

- `main` is the current playable development baseline.
- Keep the browser-playable build at `index.html`.
- Use Git commits instead of accumulating numbered release HTML files.

## Commit style

Prefer short, descriptive commits such as:

- `Add Color Spray incantation`
- `Fix Wall of Fog depth ordering`
- `Add confined-space Fireball propagation`

## Milestones

Historical R-number milestones before repository initialization are summarized in `CHANGELOG.md`.

## Safety

Before large mechanical changes, preserve a known-good commit so regressions can be compared or reverted cleanly.
