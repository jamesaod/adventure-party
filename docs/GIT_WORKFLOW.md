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

## Safe sprite import workflow

For every new or replacement sprite:

1. Use the **actual user-uploaded source** as the source of truth. Do not substitute an intermediate or similarly named generated file.
2. Convert to a browser-safe PNG before repository upload:
   - preserve transparency,
   - use nearest-neighbor scaling for pixel art,
   - use known-safe RGBA or validated indexed PNG output,
   - keep intended source/workspace/render/anchor dimensions explicit.
3. Verify the converted image locally before upload:
   - file opens successfully,
   - expected width/height,
   - transparency behaves correctly,
   - palette/color count is within the intended limit,
   - no animation/frame ambiguity remains.
4. Upload the **exact verified bytes** to the repository.
5. Verify the repository asset after upload:
   - expected file size,
   - expected blob SHA when available,
   - expected path.
6. Version-bust replaced sprite URLs (for example `fighter.png?v=R184`) so browsers cannot reuse stale art.
7. Keep runtime guards:
   - require `complete`,
   - require nonzero `naturalWidth` / `naturalHeight`,
   - skip or safely catch failed `drawImage()` calls.
8. Keep PNG integrity checks in CI and require validation before merge.
9. Only enable auto-merge after the sprite branch passes validation.
10. Visually confirm the rendered in-game asset before starting unrelated feature work.

The R179–R183 regression showed that browser caching, malformed binary transfer, and ambiguous intermediate assets can each produce a visually wrong or broken sprite even when surrounding code is correct. Treat sprite identity and decodeability as release-blocking checks.
