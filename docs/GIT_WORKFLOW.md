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

## Connector access troubleshooting

If repository automation unexpectedly appears unavailable:

1. Confirm the ChatGPT **GitHub** plugin is still installed and enabled under Settings → Plugins.
2. Confirm the GitHub account/repository connection still includes `jamesaod/adventure-party`.
3. Before assuming access is lost, test the repository connector directly with a repository metadata/read call.
4. If that succeeds, continue with the normal branch → commit → PR → validation → auto-merge workflow.

This recovered the apparent connector-access issue during R179 without reinstalling the plugin.
