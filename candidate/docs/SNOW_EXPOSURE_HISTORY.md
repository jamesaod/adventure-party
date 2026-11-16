# Snow after canopy loss

Winter broadleaf trees and burnt trees no longer intercept incoming ground snow. Ground litter remains independent. When the canopy mask changes with snow present, preserve the previous displayed exposure deficit rather than revealing all previously stored snow. Only active snowfall repays that deficit, over 120 full-intensity snowfall seconds from fully sheltered to fully exposed. Paused snowfall, clear weather and hidden pages do not repay it. Sparse changed texels update the retained shelter texture; no extra render pass. Clear snow and scene resets clear history. Overlapping remaining crowns retain shelter.

Corpse amounts carry a water-blocked flag refreshed from the existing stream/ground sample during direct drawing. Wet corpses clear their coat and reject natural snowfall, depth adjustments and fill controls. A corpse back on dry ground starts fresh.

Validation: focused history and corpse tests, 154 existing combat regressions, and production browser summer-to-winter transition with full ground snow. Observed center exposure 0 before, 0 immediately after, and 0.251 after 30 full-intensity snowfall seconds; no shader/runtime errors.

## Bare-branch coating assessment (not implemented)

Existing createFirSnowCaps selects alpha-tested foliage meshes, so bare bark is not covered. Recommended first pass: extend bark shading with a world-up normal mask plus stable coarse variation, driven by an independent accumulated-snowfall amount. Keep trunks/undersides mostly bare. Reuse existing lighting and material draw; no new mesh, particles, render target or pass. This changes surface color only. If the result merits more detail, later add a small cached shell for large upward-facing branches, with a strict triangle budget and no subdivision of the entire tree.

## Implemented bare-branch coating

The lightweight bark-material option is implemented. Upward world normals and stable object-space variation limit the snow to branch tops; no geometry, render targets or draw passes are added. Each tree starts accumulating when first rendered bare and receives full coating after 120 full-intensity snowfall seconds. Paused/hidden time does not count. Clear-snow/scene epochs reset history; leafy trees, burning trees and falling-tree rendering disable this coat. Existing bark lighting and shadows shade the coating. This is a surface treatment, without a thick snow silhouette. The per-tree coating amount participates in image-cache invalidation.

Production winter browser check: zero on onset, half coated after 60 snowfall seconds, unchanged while paused, and absent on summer foliage; no shader/runtime errors.
