> Historical implementation notes. For the current seasonal/falling-tree behavior and complete production procedure, use [Tree production workflow](TREE_PRODUCTION_WORKFLOW.md). Earlier “not connected” statements below are superseded.

# Full-crown oak combat test

The grassy Combat Test now replaces one existing dry, unoccupied tree near the party with the SpeedTree full-crown oak (10,726 source triangles). Start a fresh grass Combat Test after refreshing. Wall tests and exploration maps are unchanged.

Asset: assets/terrain/white-oak/oak-10726.gltf and oak-10726.bin. The lossless conversion rotates Z-up to Y-up, flips OBJ UV V for glTF, and uses the same metre normalization as the firs. All four native material groups and eight color/normal maps are retained. Source: WhiteOak_FullCrown.spm, Oak_FullCrown_LOD5.obj in the environmental workspace. Original lightweight oak assets remain intact there.

Ground is placed 0.20 metres above the authored trunk origin. Root tips are below ground; a GPU fragment clip suppresses buried geometry in both body and self-shadow depth passes, including the painter-composited path. Oak retains full size rather than randomized fir scaling. Existing tree rendering, lighting, shadows, fire, snow and movement obstruction are reused. Tree placement is selected once per combat session; camera movement cannot relocate it.

The source triangle count excludes runtime snow geometry. Visual review and final root-height adjustment remain with the user. No remote publication.

Oak follow-up: other tree anchors within hex distance 2 are excluded from both rendered decorations and movement obstacles. Grass beneath the spreading crown is ordered before the oak, preserving its ground roots and GPU wind animation; no extra render pass or depth readback. This is a canopy-footprint painter correction, not shared per-fragment tree/grass depth.
