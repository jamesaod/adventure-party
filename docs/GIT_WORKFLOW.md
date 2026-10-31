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


### Binary sprite transfer recovery

R190 exposed a second failure mode: an interrupted or oversized binary transfer can create a Git blob that exists at the expected path but contains a truncated PNG or a bad IDAT CRC. GitHub itself may accept that blob; the repository PNG-integrity validator is the release gate that catches it.

When sprite validation reports bad CRC, truncated PNG chunk, or another binary-integrity failure:

1. Stop retrying the same repository blob. Repeated commits of already-corrupted bytes only produce repeated validation failures and notification emails.
2. Return to the locally verified source file and decode it fully before upload.
3. Record the source dimensions and a local checksum when practical.
4. For pixel art, prefer a compact validated indexed/palette PNG when it preserves the intended pixels and transparency. Smaller binary payloads reduce connector-transfer risk.
5. Create a new Git blob from the verified bytes and replace the affected tree entry; do not reuse the failed blob SHA.
6. Let CI validate the replacement before making any additional sprite or gameplay changes.
7. Merge only after the PNG-integrity job passes. A failed PR validation does not mean the current playable main build is broken.
8. If the connection is interrupted during upload, inspect the branch head and Actions history before retrying; the operation may have completed even though the chat response was lost.

R190 was recovered by replacing the corrupted dragon pose blobs with compact, locally validated PNGs. The next validation run passed, and only then was the pull request merged.
