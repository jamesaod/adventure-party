> Historical implementation notes. For the current seasonal/falling-tree behavior and complete production procedure, use [Tree production workflow](TREE_PRODUCTION_WORKFLOW.md). Earlier “not connected” statements below are superseded.

# Tree environment settings
White oak uses a two-hex axial exclusion radius for other trees and grass. Grass is absent in the inner 1.35 hexes and smoothly returns across the outer 0.65 hex. Ground textures, rocks and sticks are retained. Deterministic density filtering runs only when cached grass layout rebuilds; animation remains on the GPU.

Species defaults live in tree-environment-profiles.mjs. Each tree can override exclusionRadiusHexes, grassFeatherHexes and environmentSizeScale. Size scales both spacing and grass feather. Unconfigured species preserve previous spacing.

The panel selects Winter, Spring, Summer or Fall (default Summer). adventurePartySeasons.getSeason/setSeason provides shared state; adventure-party:season-change emits {season}. Selection is independent of snow and weather. The raised-crown SpeedTree oak replaces the original Big Tree: Spring/Summer use green (14,447 triangles), Fall uses autumn (13,894), Winter uses bare branches (9,036). All share the original world scale and 0.20 m root burial. The original oak assets remain archived in place. Seasonal model indices keep image, silhouette, bounds, snow and shadow caches distinct. Leaf litter is not yet connected.

Winter refinement: WhiteOak_Winter_FineBranches.spm adds a child branch generator to Twigs (number 4, length 22% of parent, radius 24%, segment scalar 0.12). Game export: 35349 triangles. Original winter model and source retained. Fall oak outline uses deep reddish orange; other trees retain their outline tuning.
