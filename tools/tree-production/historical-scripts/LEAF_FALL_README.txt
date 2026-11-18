OAK LEAF-FALL ASSETS
Preview: http://127.0.0.1:8791/litter.html
Source: WhiteOak_LeafFall.spm, copied from the same WhiteOak_Fall.spm.
Native SpeedTree setting: Season > Show dropped leaves, late autumn.
Original oak sources and game build unchanged.

Exported native source: WhiteOak_LeafFall.obj / .mtl and LOD1-5.
Reusable extracted assets: comparison/assets/litter/
OakLitter_FullSpread.obj: 3914 triangles, native horizontal litter distribution.
OakLitter_Sparse.obj: 70 triangles.
OakLitter_Dense.obj: 320 triangles.
OakLitter_Pile.obj: 600 triangles.
OakLitter_LeafCluster.obj: 2 triangles (textured cluster card, not a solid leaf).
Matching MTL, color, and normal textures accompany these assets.

Native dropped foliage was separated by connected component and height,
excluding bark and the elevated crown. Extraction preserves complete components.
Ground assets compress each component's vertical extent to 2.5% and raise its
base 8mm, so cards do not sink through flat terrain. Smaller patches rearrange
matching individual-leaf cards with deterministic placement; the pile adds a
shallow 12cm mound. These packaging steps are post-export processing, not new
native SpeedTree generator models. Editable native source retains the full tree
and dropped leaves. All OBJ files use metres and Z-up. Use alpha testing and
double-sided rendering; instance patches on the GPU for repeated placement.

Preview includes Carl at 1.9304m and a 1m ground grid. Hidden-browser checks passed
without script or missing-asset errors. Patch and full-spread renders inspected.
Gameplay placement, seasonal accumulation, snow masking, and runtime LOD are
not implemented by this asset extraction.
