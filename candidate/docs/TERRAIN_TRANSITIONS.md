# Terrain transitions — Candidate Rev 258

Ground materials are independent of ceilings, sky and ambient light. Existing maps retain automatic outdoor grass and indoor stone. Optional `ground` rows match the grid dimensions, using `a` (automatic), `g` (grass), `d` (dirt) or `s` (stone). Editor brushes paint floor surfaces without changing movement, walls, LOS, indoor/outdoor settings or light levels. Import/export, encounters, undo and resize preserve this field.

Each dirt cell examines its eight neighbouring grass cells. Distance to those grass rectangles, perturbed by periodic noise, produces an irregular alpha mask with matching shared edges and rounded diagonal corners. A separate RGBA grass-tuft image enriches only the blend band. Grass extends into the dirt side of the boundary; stone and void are not blended. The composed ground stays opaque.

A tile bank caches at most 256 neighbour variants, at 256 by 256 pixels each (64 MiB maximum uncompressed CPU artwork, normally a small subset). Exploration uses filtered/mipmapped CanvasTextures; combat reuses these same composed canvas images through the existing GPU surface pipeline, including point lighting, visibility and fog. Composition happens once per used variant, not per animation frame. World anchoring repeats one authored three-metre square and retains the tactical 1:2 subdivision. No new animation loop or map-size texture atlas is introduced.

In Exploration Map Editor, choose **Add terrain sample**. This adds a separate unsaved map with bends, branches, an entrance and a patrol encounter. Test Map opens exploration; walk north three squares from the entrance to trigger combat. The sample does not replace or save existing maps. Save/export remains explicit.

Original generated artwork and provenance are under `assets/textures/exploration/`. Tests cover alpha preservation, cached composition, continuous seams/corners/junctions, schema validation, painting, map import/resize and encounter material handoff. Browser QA must inspect both first-person exploration and rotated combat.
