# Adventure Party — R166 Release Notes

## Summary
Restored the prone Kobold's previous apparent scale by removing transparent padding from the new prone source art.

## Fix
- The new prone sprite had a 64×64 source canvas, but the visible artwork occupied only `64×32` pixels.
- The engine was scaling the full transparent square to the prone render box, which made the visible Kobold look vertically flattened.
- R166 trims that transparent padding from the embedded prone source.
- The intended prone combat render size remains **35 × 18**, matching the previous apparent proportions.
- Stand and attack Kobold sprites are unchanged.

## Registry
- Kobold Prone source dimensions are now recorded as **64 × 32**.
- Workspace remains **64 × 64**.
- Render size remains **35 × 18**.

## Validation
- Extracted the inline JavaScript and passed `node --check` successfully.

## Included Files
- `adventure-party-r166.html`
- `sprite-asset-registry-r166.json`
- `R166_RELEASE_NOTES.md`
